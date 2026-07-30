"""Learned horizon forecasting vs linear extrapolation — a controlled study.

    python -m ai.temporal_prediction.forecast_study

The shipped TemporalPredictionEngine (engine.py) extrapolates each vehicle's
risk linearly: it projects the recent trend straight ahead. That is exactly
wrong at a turning point — approaching a hazard risk ramps then *peaks* then
falls, and a straight line shot from the ramp overshoots through the peak.

Unlike the fusion, this needs no external labels: forecasting is self-
supervised, the target is simply the risk that actually occurs H steps later in
the sequence. So a real sequence model can be trained and compared honestly. The
sequences themselves are still authored (non-linear hazard dynamics: ramps,
peaks, stop-go oscillation, noise), because no public feed of Indian per-vehicle
risk trajectories exists — so this shows a learned forecaster captures curvature
the linear rule cannot, not a field-measured error. Reported: mean absolute and
RMS forecast error on held-out sequences for a persistence floor, the shipped
linear extrapolation, and a small LSTM.
"""
from __future__ import annotations

import json

import numpy as np

WINDOW = 12       # past risk samples the forecaster sees
HORIZON = 6       # steps ahead to predict
SEQ_LEN = 64
N_SEQUENCES = 2500
SEED = 0


def _make_sequence(rng: np.random.Generator) -> np.ndarray:
    """One vehicle's risk trajectory: a low baseline plus a few non-linear
    hazard events (ramp-peak-decay), slow stop-go oscillation, and noise."""
    t = np.arange(SEQ_LEN)
    seq = np.full(SEQ_LEN, rng.uniform(8, 20), dtype=float)

    for _ in range(rng.integers(1, 4)):  # hazard bumps
        centre = rng.uniform(0, SEQ_LEN)
        width = rng.uniform(3, 8)
        amp = rng.uniform(20, 55)
        seq += amp * np.exp(-((t - centre) ** 2) / (2 * width**2))

    seq += rng.uniform(3, 9) * np.sin(2 * np.pi * t / rng.uniform(10, 22) + rng.uniform(0, 6.28))
    seq += rng.normal(0, 3, SEQ_LEN)
    return np.clip(seq, 0, 100)


def _windows(sequences: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """(window of WINDOW past values, value HORIZON steps past the window)."""
    xs, ys = [], []
    for seq in sequences:
        last = len(seq) - HORIZON
        for i in range(WINDOW, last):
            xs.append(seq[i - WINDOW : i])
            ys.append(seq[i + HORIZON - 1])
    return np.asarray(xs, dtype=np.float32), np.asarray(ys, dtype=np.float32)


def _linear_forecast(windows: np.ndarray) -> np.ndarray:
    """Least-squares slope over the window, projected HORIZON steps ahead —
    the standard form of what engine.py does. Clamped to [0, 100]."""
    x = np.arange(WINDOW)
    xm = x.mean()
    denom = ((x - xm) ** 2).sum()
    ym = windows.mean(axis=1, keepdims=True)
    slope = ((windows - ym) * (x - xm)).sum(axis=1) / denom
    intercept = ym.squeeze(1) - slope * xm
    pred = slope * (WINDOW - 1 + HORIZON) + intercept
    return np.clip(pred, 0, 100)


def _persistence_forecast(windows: np.ndarray) -> np.ndarray:
    """Floor baseline: assume risk stays at its last observed value."""
    return windows[:, -1]


def _train_lstm(x_tr, y_tr, x_te) -> np.ndarray:
    import torch
    from torch import nn

    torch.manual_seed(SEED)
    dev = torch.device("cpu")  # tiny model; avoids the machine's GPU contention

    class Forecaster(nn.Module):
        def __init__(self, hidden=48):
            super().__init__()
            self.lstm = nn.LSTM(input_size=1, hidden_size=hidden, batch_first=True)
            self.head = nn.Linear(hidden, 1)

        def forward(self, seq):
            out, _ = self.lstm(seq)
            return self.head(out[:, -1, :]).squeeze(1)

    # Normalise to [0,1]; the target scale (0-100) is recovered at the end.
    xt = torch.tensor(x_tr / 100.0, device=dev).unsqueeze(-1)
    yt = torch.tensor(y_tr / 100.0, device=dev)
    xe = torch.tensor(x_te / 100.0, device=dev).unsqueeze(-1)

    model = Forecaster().to(dev)
    opt = torch.optim.Adam(model.parameters(), lr=5e-3)
    loss_fn = nn.MSELoss()

    n = xt.shape[0]
    batch = 256
    for _epoch in range(25):
        perm = torch.randperm(n)
        for start in range(0, n, batch):
            idx = perm[start : start + batch]
            opt.zero_grad()
            loss = loss_fn(model(xt[idx]), yt[idx])
            loss.backward()
            opt.step()

    model.eval()
    with torch.no_grad():
        pred = model(xe).cpu().numpy() * 100.0
    return np.clip(pred, 0, 100)


def _errors(pred: np.ndarray, actual: np.ndarray) -> dict:
    err = pred - actual
    return {"mae": round(float(np.abs(err).mean()), 2), "rmse": round(float(np.sqrt((err**2).mean())), 2)}


def run_study() -> dict:
    rng = np.random.default_rng(SEED)
    sequences = [_make_sequence(rng) for _ in range(N_SEQUENCES)]
    split = int(0.7 * len(sequences))
    train_seq, test_seq = sequences[:split], sequences[split:]

    x_tr, y_tr = _windows(train_seq)
    x_te, y_te = _windows(test_seq)

    results = {
        "persistence": _errors(_persistence_forecast(x_te), y_te),
        "linear_extrapolation": _errors(_linear_forecast(x_te), y_te),
        "lstm": _errors(_train_lstm(x_tr, y_tr, x_te), y_te),
    }
    return {
        "window": WINDOW,
        "horizon": HORIZON,
        "train_windows": int(len(y_tr)),
        "test_windows": int(len(y_te)),
        "forecast_error": results,
    }


if __name__ == "__main__":
    print(json.dumps(run_study(), indent=2))
