"""Paper-grade statistical validation of the risk model's premise on STATS19.

`external_validation.py` establishes *that* the model's factors predict who dies
(descriptive rates + a CV AUC). This is the inferential companion a reviewer
asks for: are the effects statistically significant, is the speed×darkness
interaction real (not an artefact of the eye), is the model calibrated, and how
tight is the discrimination estimate? Every number here is one a methods section
can cite.

    python -m ai.trie.statistical_validation
    python -m ai.trie.statistical_validation --data-dir /path/to/csvs

Produces, on ~128k real GB 2024 casualties:

* Multivariable logistic regression — odds ratios, 95% CIs and p-values for each
  factor (VRU, darkness, poor surface, speed), the honest multivariable estimate
  rather than four univariate rates.
* A likelihood-ratio test for the speed×darkness (and speed×VRU) interactions —
  the statistical backing for the 3D "the dark penalty widens with speed" claim.
* Calibration — Brier score, expected calibration error, and a reliability table.
* Discrimination — AUC with a bootstrap 95% CI, plus a learned-GBM baseline and a
  leave-one-factor-out ablation, so the factor set earns its place.

Honest scope is unchanged from external_validation: GB not India, severity not the
live risk score; this validates the factor structure the model rests on.
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
    # Centre + scale speed so the interaction term is interpretable and the main
    # effect reads at the mean speed, not at 0 mph.
    m["speed_z"] = (m.speed_limit_n - m.speed_limit_n.mean()) / m.speed_limit_n.std()
    return m


def run(data_dir: Path) -> dict:
    import numpy as np
    import statsmodels.api as sm
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import brier_score_loss, roc_auc_score
    from sklearn.model_selection import cross_val_predict

    m = _load(data_dir)
    y = m["fatal"].to_numpy()
    base_feats = ["is_vru", "is_dark", "poor_surface", "speed_z"]

    # --- Multivariable logistic (statsmodels: OR, CI, p) ---
    Xr = sm.add_constant(m[base_feats])
    reduced = sm.Logit(y, Xr).fit(disp=0)
    ci = reduced.conf_int()
    coeffs = {}
    for name in base_feats:
        coeffs[name] = {
            "odds_ratio": round(float(np.exp(reduced.params[name])), 3),
            "ci95": [round(float(np.exp(ci.loc[name, 0])), 3), round(float(np.exp(ci.loc[name, 1])), 3)],
            "p_value": float(f"{reduced.pvalues[name]:.2e}"),
        }

    # --- Interaction model + likelihood-ratio test ---
    mi = m.assign(speed_x_dark=m.speed_z * m.is_dark, speed_x_vru=m.speed_z * m.is_vru)
    full_feats = base_feats + ["speed_x_dark", "speed_x_vru"]
    Xf = sm.add_constant(mi[full_feats])
    full = sm.Logit(y, Xf).fit(disp=0)
    from scipy.stats import chi2

    lr_stat = 2 * (full.llf - reduced.llf)
    lr_df = len(full_feats) - len(base_feats)
    lr_p = float(chi2.sf(lr_stat, lr_df))
    interactions = {
        "speed_x_dark": {
            "odds_ratio": round(float(np.exp(full.params["speed_x_dark"])), 3),
            "p_value": float(f"{full.pvalues['speed_x_dark']:.2e}"),
        },
        "speed_x_vru": {
            "odds_ratio": round(float(np.exp(full.params["speed_x_vru"])), 3),
            "p_value": float(f"{full.pvalues['speed_x_vru']:.2e}"),
        },
        "likelihood_ratio_test": {
            "chi2": round(float(lr_stat), 2),
            "df": lr_df,
            "p_value": float(f"{lr_p:.2e}"),
            "verdict": "interactions jointly significant" if lr_p < 0.05 else "not significant",
        },
    }

    # --- Discrimination: out-of-fold probs, AUC + bootstrap CI ---
    X = m[base_feats].to_numpy(float)
    lr = LogisticRegression(max_iter=1000)
    proba = cross_val_predict(lr, X, y, cv=5, method="predict_proba")[:, 1]
    auc = roc_auc_score(y, proba)
    rng = np.random.default_rng(0)
    boot = []
    n = len(y)
    for _ in range(300):
        idx = rng.integers(0, n, n)
        if y[idx].sum() == 0:
            continue
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
    for i, f in enumerate(base_feats):
        keep = [j for j in range(len(base_feats)) if j != i]
        p = cross_val_predict(LogisticRegression(max_iter=1000), X[:, keep], y, cv=5, method="predict_proba")[:, 1]
        ablation[f"drop_{f}"] = {"auc": round(float(roc_auc_score(y, p)), 3), "delta": round(float(roc_auc_score(y, p) - auc), 3)}

    result = {
        "source": "DfT STATS19, Great Britain 2024",
        "n": int(len(m)),
        "fatal": int(y.sum()),
        "multivariable_logistic_odds_ratios": coeffs,
        "interactions": interactions,
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
    parser = argparse.ArgumentParser(prog="python -m ai.trie.statistical_validation", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(tempfile.gettempdir()) / "stats19")
    args = parser.parse_args(argv)
    run(args.data_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
