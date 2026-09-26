"""Retrospective test of black-spot discovery's precursor thesis on REAL Indian crashes.

The full field validation of TRIE's black-spot engine needs near-miss *telemetry*
at real black-spot locations, which nobody publishes (ROADMAP 0.1). What real
Indian data does carry is a lower-severity crash record: the NHAI dataset has,
per crash, a date, a chainage (km marker, so a 500 m cell — iRAD's own unit) and
a severity (fatal / grievous / minor / non-injury). Minor and non-injury crashes
are a genuine, if coarse, *precursor* class: the same road, the same stretch, the
same failure mode, one severity rung down. This tests the idea underneath
predictive black-spot discovery in that space:

    Does the record of lower-severity crashes at a 500 m stretch anticipate the
    fatal/grievous crashes iRAD waits for — beyond what the stretch's own
    fatal/grievous history already says?

It is NOT a validation of the telemetry engine (a recorded minor crash is not a
near-miss trace), and says nothing about the risk score. It validates the
hypothesis the engine is built on, on real Indian roads.

Pre-specified (fixed before looking at results, so they cannot be tuned to flatter):

* Unit: 500 m cell (chainage // 0.5) on one road. The file has no highway ID, so
  a road is inferred from its structure: a block of rows between backward date
  resets (> 300 days), split at the 2019-2021 gap in the records (era). Blocks
  under 200 rows cannot be tied to a road and are excluded.
* At risk: cells with at least one recorded crash. This drops trivially easy
  negatives (empty cells), which makes the test *conservative* for AUC.
* Part A — predictive. Split each road at its median crash date. From the earlier
  window take KSI count (reactive: what iRAD sees), minor/non-injury count
  (precursor) and total count (volume). Target: >= 2 KSI in the later window
  (about iRAD's 5-per-3-years rate over the 1-2 year windows available).
  Scores are used unfitted, so their AUCs are directly comparable; a
  cluster bootstrap over 5 km blocks gives CIs and paired differences. A Poisson
  regression (road fixed effects, exposure offset, cluster-robust SEs) tests the
  precursor's rate ratio *given* KSI history.
* Part B — lead time. For cells that meet the iRAD rule (>= 5 KSI within 3 years),
  when does a fixed precursor rule (>= M minor/non-injury crashes in a trailing
  365 days; M = 2, 3, 4 all reported) first fire relative to iRAD's date? A
  severity-permutation null (severities shuffled among crashes within each road,
  dates and places fixed) asks whether severity structure matters beyond crash
  volume, the obvious confound.

    python -m ai.trie.blackspot_crash_validation
"""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

CELL_KM = 0.5
IRAD_MIN_KSI = 5
IRAD_WINDOW_DAYS = 3 * 365
MIN_BLOCK_ROWS = 200
BLOCK_KM = 5.0          # spatial block for clustering / bootstrap
TARGET_KSI = 2
PRECURSOR_WINDOW_DAYS = 365
PRECURSOR_THRESHOLDS = (2, 3, 4)
N_BOOT = 1000
N_PERM = 200


def _prepare(data_dir: Path):
    """Deduplicated crashes with inferred road, 500 m cell and spatial block."""
    import numpy as np
    import pandas as pd

    from ai.trie.india_severity_model import load_deduplicated

    df = load_deduplicated(data_dir).reset_index(drop=True)
    df["dt"] = pd.to_datetime(df["Date"], dayfirst=True)
    df["ch"] = df["Accident_Location_A_Chainage_km"].astype(float)
    df["sev"] = df["Accident_Severity_C"].astype(int)

    resets = np.where(df["dt"].diff().dt.days.to_numpy() < -300)[0]
    block = np.zeros(len(df), int)
    for i in resets:
        block[i:] += 1
    df["block"] = block
    sizes = df.groupby("block")["block"].transform("size")
    n_dropped = int((sizes < MIN_BLOCK_ROWS).sum())
    df = df[sizes >= MIN_BLOCK_ROWS].copy()

    df["era"] = (df["dt"].dt.year >= 2019).astype(int)   # records skip 2019-2021
    df["road"] = df["block"].astype(str) + "-" + df["era"].astype(str)
    df["cell"] = (df["ch"] / CELL_KM).astype(int)
    df["kblock"] = df["road"] + ":" + (df["ch"] // BLOCK_KM).astype(int).astype(str)
    return df.reset_index(drop=True), n_dropped


def _irad_dates(ksi_times):
    """First date the >=5-KSI-within-3-years rule is satisfied, else None."""
    import numpy as np

    t = np.sort(ksi_times)
    span = np.timedelta64(IRAD_WINDOW_DAYS, "D")
    for i in range(len(t) - IRAD_MIN_KSI + 1):
        if t[i + IRAD_MIN_KSI - 1] - t[i] <= span:
            return t[i + IRAD_MIN_KSI - 1]
    return None


def _precursor_date(times, m):
    """First date >= m precursor crashes fall inside a trailing 365 days."""
    import numpy as np

    t = np.sort(times)
    span = np.timedelta64(PRECURSOR_WINDOW_DAYS, "D")
    for i in range(len(t) - m + 1):
        if t[i + m - 1] - t[i] <= span:
            return t[i + m - 1]
    return None


def _lead_stats(df, thresholds=PRECURSOR_THRESHOLDS):
    """Part B statistics for one labelling of severities."""
    import numpy as np

    out = {m: {"irad": 0, "hits": 0, "fired": 0, "fired_and_irad": 0, "leads": []} for m in thresholds}
    for _, g in df.groupby(["road", "cell"]):
        ksi_t = g.loc[g["sev"].isin([1, 2]), "dt"].to_numpy()
        prec_t = g.loc[g["sev"].isin([3, 4]), "dt"].to_numpy()
        d_irad = _irad_dates(ksi_t) if len(ksi_t) >= IRAD_MIN_KSI else None
        for m in thresholds:
            d_prec = _precursor_date(prec_t, m) if len(prec_t) >= m else None
            s = out[m]
            s["irad"] += d_irad is not None
            s["fired"] += d_prec is not None
            if d_irad is not None and d_prec is not None:
                s["fired_and_irad"] += 1
                lead = (d_irad - d_prec) / np.timedelta64(1, "D")
                if lead > 0:
                    s["hits"] += 1
                    s["leads"].append(float(lead))
    return out


def _summ(s):
    import numpy as np

    return {
        "irad_cells": s["irad"],
        "precursor_fired_cells": s["fired"],
        "precision_fired_then_irad_pct": round(100 * s["fired_and_irad"] / s["fired"], 1) if s["fired"] else None,
        "recall_precursor_before_irad_pct": round(100 * s["hits"] / s["irad"], 1) if s["irad"] else None,
        "median_lead_days": float(np.median(s["leads"])) if s["leads"] else None,
    }


def part_b(df) -> dict:
    import numpy as np

    obs = _lead_stats(df)
    rng = np.random.default_rng(0)
    null = {m: {"precision": [], "recall": [], "median_lead": []} for m in PRECURSOR_THRESHOLDS}
    base = df.copy()
    for _ in range(N_PERM):
        base["sev"] = df.groupby("road")["sev"].transform(lambda s: rng.permutation(s.to_numpy()))
        st = _lead_stats(base)
        for m in PRECURSOR_THRESHOLDS:
            s = st[m]
            if s["fired"] and s["irad"]:
                null[m]["precision"].append(100 * s["fired_and_irad"] / s["fired"])
                null[m]["recall"].append(100 * s["hits"] / s["irad"])
                null[m]["median_lead"].append(float(np.median(s["leads"])) if s["leads"] else 0.0)

    res = {}
    for m in PRECURSOR_THRESHOLDS:
        o = _summ(obs[m])
        n = null[m]
        nn = len(n["precision"])
        def p_ge(val, arr):
            return round(float((1 + sum(a >= val for a in arr)) / (1 + len(arr))), 4) if val is not None and arr else None
        res[f"precursor_ge_{m}_minor_in_365d"] = {
            **o,
            "null_mean_precision_pct": round(float(np.mean(n["precision"])), 1) if nn else None,
            "null_mean_recall_pct": round(float(np.mean(n["recall"])), 1) if nn else None,
            "null_mean_median_lead_days": round(float(np.mean(n["median_lead"])), 1) if nn else None,
            "perm_p_precision_ge_obs": p_ge(o["precision_fired_then_irad_pct"], n["precision"]),
            "perm_p_recall_ge_obs": p_ge(o["recall_precursor_before_irad_pct"], n["recall"]),
            "n_permutations": nn,
        }
    return res


def _cells_part_a(df):
    """Per (road, cell): history counts and later-window KSI count."""
    import numpy as np
    import pandas as pd

    rows, split_info = [], {}
    for road, g in df.groupby("road"):
        split = g["dt"].sort_values().iloc[len(g) // 2]
        end = g["dt"].max()
        out_days = max(int((end - split).days), 1)
        split_info[road] = {"split": str(split.date()), "end": str(end.date()), "out_days": out_days, "n": int(len(g))}
        hist, later = g[g["dt"] < split], g[g["dt"] >= split]
        cells = set(g["cell"])
        for c in cells:
            h = hist[hist["cell"] == c]
            o = later[later["cell"] == c]
            rows.append({
                "road": road, "cell": c,
                "kblock": road + ":" + str(int(c * CELL_KM // BLOCK_KM)),
                "ksi_hist": int(h["sev"].isin([1, 2]).sum()),
                "minor_hist": int(h["sev"].isin([3, 4]).sum()),
                "all_hist": int(len(h)),
                "ksi_out": int(o["sev"].isin([1, 2]).sum()),
                "out_days": out_days,
            })
    return pd.DataFrame(rows), split_info


def _auc(y, s):
    from sklearn.metrics import roc_auc_score
    return float(roc_auc_score(y, s))


def part_a(df) -> dict:
    import numpy as np
    import statsmodels.api as sm
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GroupKFold

    cells, split_info = _cells_part_a(df)
    cells["y"] = (cells["ksi_out"] >= TARGET_KSI).astype(int)
    y = cells["y"].to_numpy()
    groups = cells["kblock"].to_numpy()

    scores = {
        "reactive_ksi_hist": cells["ksi_hist"].to_numpy(float),
        "precursor_minor_hist": cells["minor_hist"].to_numpy(float),
        "volume_all_hist": cells["all_hist"].to_numpy(float),
    }
    # Combined model: grouped-CV out-of-fold probabilities (block CV, so
    # neighbouring cells never straddle train/test).
    X = np.column_stack([cells["ksi_hist"], cells["minor_hist"]] +
                        [(cells["road"] == r).astype(float) for r in sorted(cells["road"].unique())[1:]])
    oof = np.zeros(len(cells))
    for tr, te in GroupKFold(n_splits=5).split(X, y, groups):
        oof[te] = LogisticRegression(max_iter=1000).fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    scores["combined_ksi_and_minor_cv"] = oof
    # Control for the confound in that comparison: the raw scores above are
    # unfitted and road-blind, but the combined model has road intercepts, which
    # alone can raise a pooled AUC (roads differ in base rate). Same model, same
    # folds, minor crashes removed — the difference between the two is the
    # precursor's own contribution.
    Xc = np.column_stack([cells["ksi_hist"]] +
                         [(cells["road"] == r).astype(float) for r in sorted(cells["road"].unique())[1:]])
    oof_c = np.zeros(len(cells))
    for tr, te in GroupKFold(n_splits=5).split(Xc, y, groups):
        oof_c[te] = LogisticRegression(max_iter=1000).fit(Xc[tr], y[tr]).predict_proba(Xc[te])[:, 1]
    scores["reactive_plus_road_cv"] = oof_c

    point = {k: _auc(y, v) for k, v in scores.items()}

    # Cluster bootstrap over spatial blocks.
    rng = np.random.default_rng(0)
    ublocks = np.unique(groups)
    idx_by_block = {b: np.where(groups == b)[0] for b in ublocks}
    boots = {k: [] for k in scores}
    for _ in range(N_BOOT):
        pick = rng.choice(ublocks, size=len(ublocks), replace=True)
        idx = np.concatenate([idx_by_block[b] for b in pick])
        if 0 < y[idx].sum() < len(idx):
            for k, v in scores.items():
                boots[k].append(_auc(y[idx], v[idx]))

    def ci(a):
        return [round(float(np.percentile(a, 2.5)), 3), round(float(np.percentile(a, 97.5)), 3)]

    auc = {k: {"auc": round(point[k], 3), "ci95": ci(boots[k])} for k in scores}
    diffs = {}
    for k in ("precursor_minor_hist", "volume_all_hist", "combined_ksi_and_minor_cv"):
        d = np.array(boots[k]) - np.array(boots["reactive_ksi_hist"])
        diffs[f"{k}_minus_reactive"] = {"delta_auc": round(point[k] - point["reactive_ksi_hist"], 3), "ci95": ci(d),
                                        "ci_excludes_zero": bool(np.percentile(d, 2.5) > 0 or np.percentile(d, 97.5) < 0)}
    d = np.array(boots["combined_ksi_and_minor_cv"]) - np.array(boots["reactive_plus_road_cv"])
    diffs["minor_crashes_own_contribution (combined - reactive_plus_road)"] = {
        "delta_auc": round(point["combined_ksi_and_minor_cv"] - point["reactive_plus_road_cv"], 3), "ci95": ci(d),
        "ci_excludes_zero": bool(np.percentile(d, 2.5) > 0 or np.percentile(d, 97.5) < 0)}

    # Poisson rate ratio for minor_hist given ksi_hist.
    Xp = sm.add_constant(np.column_stack([cells["ksi_hist"], cells["minor_hist"]] +
                                         [(cells["road"] == r).astype(float) for r in sorted(cells["road"].unique())[1:]]))
    fit = sm.GLM(cells["ksi_out"].to_numpy(), Xp, family=sm.families.Poisson(),
                 offset=np.log(cells["out_days"].to_numpy())).fit(
        cov_type="cluster", cov_kwds={"groups": np.unique(groups, return_inverse=True)[1]})
    def rr(i):
        b, se = fit.params[i], fit.bse[i]
        return {"rate_ratio_per_event": round(float(np.exp(b)), 3),
                "ci95": [round(float(np.exp(b - 1.96 * se)), 3), round(float(np.exp(b + 1.96 * se)), 3)],
                "p_value": float(f"{fit.pvalues[i]:.3g}")}
    return {
        "n_cells": int(len(cells)),
        "n_cells_target_positive": int(y.sum()),
        "target": f">= {TARGET_KSI} KSI crashes in the later window",
        "windows": split_info,
        "auc": auc,
        "paired_auc_differences_vs_reactive": diffs,
        "poisson_rate_ratios_given_each_other": {"ksi_hist": rr(1), "minor_hist": rr(2)},
    }


def run(data_dir: Path) -> dict:
    df, n_dropped = _prepare(data_dir)
    n_ksi_cells = sum(
        _irad_dates(g.loc[g["sev"].isin([1, 2]), "dt"].to_numpy()) is not None
        for _, g in df.groupby(["road", "cell"]) if g["sev"].isin([1, 2]).sum() >= IRAD_MIN_KSI
    )
    result = {
        "source": "NHAI Indian highway crashes (Khanum et al., Zenodo 10.5281/zenodo.16946653), de-duplicated",
        "scope": (
            "recorded lower-severity crashes as a precursor CLASS, on 3 inferred road segments; "
            "not near-miss telemetry, not the risk score. Tests the hypothesis black-spot "
            "discovery rests on, not the telemetry engine."
        ),
        "n_crashes_used": int(len(df)),
        "n_crashes_excluded_unattributable_blocks": n_dropped,
        "roads": sorted(df["road"].unique().tolist()),
        "n_cells_with_crashes": int(df.groupby(["road", "cell"]).ngroups),
        "n_cells_meeting_irad_rule": int(n_ksi_cells),
        "part_a_predictive": part_a(df),
        "part_b_lead_time": part_b(df),
    }
    print(json.dumps(result, indent=2))
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.trie.blackspot_crash_validation", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(tempfile.gettempdir()) / "nhai_india")
    run(parser.parse_args(argv).data_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
