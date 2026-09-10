"""Conformal risk sets with an observability-conditional coverage guarantee.

The shipped fusion reports a heuristic uncertainty band (floor = every unmeasured
factor benign, ceiling = every one at its worst). That is honest but has no formal
guarantee. This is the principled upgrade a reviewer asks for: split-conformal
prediction gives a distribution-free coverage guarantee, and we make it
*class-conditional* (guarantee the FATAL class) and *observability-conditional*
(a separate guarantee per sensor regime) — which is exactly the model's own thesis
in a theorem.

The claim, validated on real crashes (DfT STATS19, GB 2024):

  In every sensor regime, at least 1-alpha of the crashes that were actually
  FATAL fall inside the model's "cannot rule out fatal" set.

That safety coverage is held fixed by construction; the *cost* — the alarm rate,
how often the system flags "possibly fatal" — is what rises as observability
shrinks. So the heuristic "less observable ⇒ wider band" becomes "less
observable ⇒ higher alarm rate at a fixed, guaranteed fatal-recall," with a proof.

    python -m ai.trie.conformal_validation
    python -m ai.trie.conformal_validation --alpha 0.1 --data-dir /path/to/csvs

Method: class-conditional (Mondrian-by-label) split conformal. Nonconformity for
a fatal example is s = 1 - p_hat(fatal | x). The threshold q is the
ceil((n+1)(1-alpha))/n empirical quantile of s over the *fatal* calibration
examples; a test point's set includes "fatal" iff 1 - p_hat(fatal | x) <= q. This
guarantees P(fatal in set | Y = fatal) >= 1 - alpha, distribution-free, per regime.

Scope is unchanged from external_validation: GB not India; this validates the
uncertainty *method*, on real outcomes, not the Indian deployment.
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from ai.trie.external_validation import (
    _DARK_LIGHT,
    _POOR_SURFACE,
    _VRU_CASUALTY_TYPES,
    _ensure_data,
)

# Sensor regimes mirroring the deployment: speed is always available (telemetry),
# time-of-day light is free from the assessment clock, and VRU exposure + road
# surface need the camera. Fewer sensors ⇒ fewer features ⇒ more uncertainty.
REGIMES = {
    "full sensor suite": ["is_vru", "is_dark", "poor_surface", "speed_z"],
    "no camera (telemetry + clock)": ["is_dark", "speed_z"],
    "telemetry only": ["speed_z"],
}


def _load(data_dir: Path):
    import numpy as np
    import pandas as pd

    paths = _ensure_data(data_dir)
    cas = pd.read_csv(paths["casualty"], low_memory=False)
    col = pd.read_csv(paths["collision"], low_memory=False)
    cas = cas.assign(
        is_vru=cas["casualty_type"].isin(_VRU_CASUALTY_TYPES).astype(int),
        fatal=(cas["casualty_severity"] == 1).astype(int),
    )
    light = pd.to_numeric(col["light_conditions"], errors="coerce")
    surface = pd.to_numeric(col["road_surface_conditions"], errors="coerce")
    speed = pd.to_numeric(col["speed_limit"], errors="coerce")
    c = col.assign(
        is_dark=light.isin(_DARK_LIGHT).astype(int),
        poor_surface=surface.isin(_POOR_SURFACE).astype(int),
        speed_limit_n=speed,
    )[["collision_index", "is_dark", "poor_surface", "speed_limit_n"]]
    m = cas[["collision_index", "is_vru", "fatal"]].merge(c, on="collision_index", how="inner")
    m = m.dropna(subset=["speed_limit_n"])
    m = m[(m.speed_limit_n >= 20) & (m.speed_limit_n <= 70)].reset_index(drop=True)
    m["speed_z"] = (m.speed_limit_n - m.speed_limit_n.mean()) / m.speed_limit_n.std()
    return m


def run(data_dir: Path, alpha: float = 0.1) -> dict:
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split

    m = _load(data_dir)
    # Proper three-way split: fit / calibrate / test, stratified on the rare class.
    train, rest = train_test_split(m, test_size=0.5, stratify=m.fatal, random_state=0)
    calib, test = train_test_split(rest, test_size=0.5, stratify=rest.fatal, random_state=0)

    cal_fatal = calib[calib.fatal == 1]
    test_fatal = test.fatal.values == 1

    regimes = {}
    for name, feats in REGIMES.items():
        lr = LogisticRegression(max_iter=1000).fit(train[feats].to_numpy(float), train.fatal.to_numpy())
        # Class-conditional conformal: calibrate on the FATAL calibration examples.
        p_cal = lr.predict_proba(cal_fatal[feats].to_numpy(float))[:, 1]
        scores = 1.0 - p_cal  # nonconformity of the true (fatal) label
        n = len(scores)
        q_level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
        q = float(np.quantile(scores, q_level, method="higher"))

        p_test = lr.predict_proba(test[feats].to_numpy(float))[:, 1]
        includes_fatal = (1.0 - p_test) <= q  # set contains "fatal"
        fatal_coverage = float(includes_fatal[test_fatal].mean())  # guarantee target
        alarm_rate = float(includes_fatal.mean())  # the cost that grows with fewer sensors
        # A conformal analogue of the heuristic band's width: how much of the
        # population the model can no longer confidently clear of a fatal outcome.
        regimes[name] = {
            "features": feats,
            "n_features": len(feats),
            "fatal_coverage": round(fatal_coverage, 3),
            "alarm_rate": round(alarm_rate, 3),
            "conformal_threshold_q": round(q, 3),
        }

    result = {
        "source": "DfT STATS19, Great Britain 2024",
        "method": "class-conditional (by-label) split conformal, per observability regime",
        "target_coverage": 1 - alpha,
        "n_train": int(len(train)),
        "n_calibration": int(len(calib)),
        "n_calibration_fatal": int(len(cal_fatal)),
        "n_test": int(len(test)),
        "regimes": regimes,
        "reading": (
            "fatal_coverage >= target in every regime is the distribution-free guarantee; "
            "alarm_rate rises as sensors drop — the quantified, guaranteed-recall cost of "
            "reduced observability, replacing the heuristic uncertainty band."
        ),
    }
    print(json.dumps(result, indent=2))
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.trie.conformal_validation", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(tempfile.gettempdir()) / "stats19")
    parser.add_argument("--alpha", type=float, default=0.1)
    args = parser.parse_args(argv)
    run(args.data_dir, alpha=args.alpha)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
