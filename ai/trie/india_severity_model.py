"""Inferential severity model on REAL Indian highway crashes.

`india_validation.py` corroborates the VRU-first premise on Indian data, but it
is *descriptive*: media coverage is fatal-only, so it has no non-fatal
comparison group and cannot ask "does VRU involvement raise the *odds* of a
severe outcome, holding other factors constant?". This is the Indian inferential
counterpart to `statistical_validation.py` (which does exactly that on UK
STATS19), run on a real Indian record-level dataset that *does* carry non-fatal
crashes:

    8,116 accident records from four National Highways Authority of India (NHAI)
    highway segments (Pune-Solapur & Nagpur; Barwa-Adda–Panagarh, NH-2, Jharkhand
    & West Bengal; Chengapally–Walayar, Tamil Nadu), 2013-2022, released
    CC-BY-4.0 by Khanum, Garg, Faheem & Kulkarni, Zenodo 10.5281/zenodo.16946653,
    the dataset behind their *Scientific Reports* severity-prediction paper.

Every code is decoded with the authors' published Table 1 codebook (severity
1=Fatal, 2=Grievous, 3=Minor, 4=Non-injury; vehicle 6=two-wheeler, 8=cycle,
9=pedestrian; cause 2=overspeeding; ...). The outcome is KSI (Killed or
Seriously Injured = Fatal or Grievous), the same severity dichotomy the UK model
uses, so the two are directly comparable.

What it produces:

* Multivariable logistic regression — odds ratios, 95% CIs and p-values for VRU
  involvement, the VRU-vs-heavier-vehicle mismatch, overspeeding, night,
  undivided carriageway, adverse weather and sharp curves. The VRU and
  VRU×heavy terms are the Indian inferential test of the VRU-first premise.
* Discrimination — 5-fold-CV AUC with a bootstrap 95% CI, plus a learned GBM
  baseline and a leave-one-factor-out ablation.
* Calibration — Brier score, expected calibration error, reliability table.

Honest scope: these are NHAI *national-highway* crashes (a high-speed,
inter-urban exposure profile, not all-India urban roads), the outcome is injury
severity (not TRIE's live risk score), and "night" is an 18:00-06:00 time-of-day
proxy because the dataset has no measured light-condition field. Within that
scope it is a real, inferential, Indian confirmation of the factor structure the
risk model rests on.

    python -m ai.trie.india_severity_model
    python -m ai.trie.india_severity_model --data-dir /path/to/cache
"""
from __future__ import annotations

import argparse
import json
import tempfile
import urllib.request
from pathlib import Path

_ZENODO_CSV = "https://zenodo.org/api/records/16946653/files/ETP_4_New_Data_Accidents.csv/content"

# Khanum et al. (2025) Table 1 codebook, Vehicle Type (J).
_VRU_VEHICLES = {6, 8, 9}          # two-wheeler, cycle, pedestrian
_HEAVY_VEHICLES = {3, 4, 5, 10, 14, 15}  # bus, mini-bus, truck, tractor, LCV, MAV
_SPEEDING_CAUSE = 2                # overspeeding
_DIVIDED_ROAD_FEATURE = 4          # four+ lanes with central divider
_SHARP_CURVE = 3                   # road condition: sharp curve
_FINE_WEATHER = 1                  # weather: fine


def _ensure_data(data_dir: Path) -> Path:
    data_dir.mkdir(parents=True, exist_ok=True)
    dest = data_dir / "nhai_accidents.csv"
    if not dest.exists():
        import sys
        print(f"downloading NHAI dataset -> {dest}", file=sys.stderr)
        req = urllib.request.Request(_ZENODO_CSV, headers={"User-Agent": "trie-research/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            f.write(r.read())
    return dest


def _hour(t) -> float:
    import numpy as np

    try:
        return int(str(t).split(":")[0])
    except (ValueError, AttributeError, IndexError):
        return np.nan


def _load(data_dir: Path):
    import numpy as np
    import pandas as pd

    df = pd.read_csv(_ensure_data(data_dir))
    sev = pd.to_numeric(df["Accident_Severity_C"], errors="coerce")
    v1 = pd.to_numeric(df["Vehicle_Type_Involved_J_V1"], errors="coerce")
    v2 = pd.to_numeric(df["Vehicle_Type_Involved_J_V2"], errors="coerce")
    cause = pd.to_numeric(df["Causes_D"], errors="coerce")
    feature = pd.to_numeric(df["Road_Feature_E"], errors="coerce")
    cond = pd.to_numeric(df["Road_Condition_F"], errors="coerce")
    weather = pd.to_numeric(df["Weather_Conditions_H"], errors="coerce")
    hour = df["Time_of_Accident"].map(_hour)

    vru = v1.isin(_VRU_VEHICLES) | v2.isin(_VRU_VEHICLES)
    heavy = v1.isin(_HEAVY_VEHICLES) | v2.isin(_HEAVY_VEHICLES)

    m = pd.DataFrame({
        # KSI = Killed or Seriously Injured (Fatal=1 or Grievous=2), the same
        # dichotomy the UK model uses.
        "ksi": sev.isin([1, 2]).astype(int),
        "fatal": (sev == 1).astype(int),
        "vru_involved": vru.astype(int),
        # the lethal mismatch: an unprotected road user struck by a heavier one.
        "vru_vs_heavy": (vru & heavy).astype(int),
        "speeding": (cause == _SPEEDING_CAUSE).astype(int),
        # no light-condition field in the data; 18:00-06:00 is a documented proxy.
        "night": ((hour >= 18) | (hour < 6)).astype(int),
        "undivided": (feature != _DIVIDED_ROAD_FEATURE).astype(int),
        "adverse_weather": ((weather != _FINE_WEATHER) & weather.notna()).astype(int),
        "sharp_curve": (cond == _SHARP_CURVE).astype(int),
    })
    return m.dropna().reset_index(drop=True)


def run(data_dir: Path) -> dict:
    import numpy as np
    import statsmodels.api as sm
    from scipy.stats import chi2
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import cross_val_predict

    m = _load(data_dir)
    y = m["ksi"].to_numpy()
    feats = [
        "vru_involved", "vru_vs_heavy", "speeding", "night",
        "undivided", "adverse_weather", "sharp_curve",
    ]

    # --- Multivariable logistic (statsmodels: OR, CI, p) ---
    Xr = sm.add_constant(m[feats])
    fit = sm.Logit(y, Xr).fit(disp=0)
    ci = fit.conf_int()
    coeffs = {}
    for name in feats:
        coeffs[name] = {
            "odds_ratio": round(float(np.exp(fit.params[name])), 3),
            "ci95": [round(float(np.exp(ci.loc[name, 0])), 3), round(float(np.exp(ci.loc[name, 1])), 3)],
            "p_value": float(f"{fit.pvalues[name]:.2e}"),
        }

    # --- Discrimination: out-of-fold probs, AUC + bootstrap CI ---
    X = m[feats].to_numpy(float)
    lr = LogisticRegression(max_iter=1000)
    proba = cross_val_predict(lr, X, y, cv=5, method="predict_proba")[:, 1]
    auc = roc_auc_score(y, proba)
    rng = np.random.default_rng(0)
    boot = []
    n = len(y)
    for _ in range(300):
        idx = rng.integers(0, n, n)
        if 0 < y[idx].sum() < len(idx):
            boot.append(roc_auc_score(y[idx], proba[idx]))
    lo, hi = np.percentile(boot, [2.5, 97.5])

    # --- Calibration ---
    brier = brier_score_loss(y, proba)
    bins = np.quantile(proba, np.linspace(0, 1, 11))
    bins[-1] += 1e-9
    which = np.clip(np.digitize(proba, bins) - 1, 0, 9)
    reliability, ece = [], 0.0
    for b in range(10):
        mask = which == b
        if mask.sum() == 0:
            continue
        pred, obs, w = proba[mask].mean(), y[mask].mean(), mask.mean()
        reliability.append({"bin": b + 1, "mean_pred_pct": round(pred * 100, 3), "observed_pct": round(obs * 100, 3), "n": int(mask.sum())})
        ece += w * abs(pred - obs)

    # --- Learned baseline + leave-one-factor-out ablation ---
    gbm = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.1, max_iter=200)
    gbm_proba = cross_val_predict(gbm, X, y, cv=5, method="predict_proba")[:, 1]
    gbm_auc = roc_auc_score(y, gbm_proba)
    ablation = {}
    for i, f in enumerate(feats):
        keep = [j for j in range(len(feats)) if j != i]
        p = cross_val_predict(LogisticRegression(max_iter=1000), X[:, keep], y, cv=5, method="predict_proba")[:, 1]
        ablation[f"drop_{f}"] = {"auc": round(float(roc_auc_score(y, p)), 3), "delta": round(float(roc_auc_score(y, p) - auc), 3)}

    result = {
        "source": "NHAI Indian highway accidents, 2013-2022 (Khanum et al., Zenodo 10.5281/zenodo.16946653, CC-BY-4.0)",
        "scope": "national-highway crashes; outcome = KSI (Fatal or Grievous); 'night' is an 18:00-06:00 time proxy (no light field)",
        "n": int(len(m)),
        "ksi": int(y.sum()),
        "ksi_rate_pct": round(float(y.mean()) * 100, 1),
        "fatal": int(m["fatal"].sum()),
        "multivariable_logistic_odds_ratios": coeffs,
        "discrimination": {
            "cv5_auc": round(float(auc), 3),
            "auc_ci95_bootstrap": [round(float(lo), 3), round(float(hi), 3)],
            "gbm_baseline_auc": round(float(gbm_auc), 3),
        },
        "calibration": {"brier": round(float(brier), 5), "ece": round(float(ece), 5), "reliability": reliability},
        "ablation_leave_one_out": ablation,
    }
    print(json.dumps(result, indent=2))
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.trie.india_severity_model", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(tempfile.gettempdir()) / "nhai_india")
    args = parser.parse_args(argv)
    run(args.data_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
