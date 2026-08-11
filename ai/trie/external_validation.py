"""External validation of the risk model's premise on real crash data.

Every other evidence script in this repo runs on an *authored* ground truth,
because no public dataset labels India's six live telemetry factors against real
crash outcomes (SHRP2 is access-gated; MoRTH publishes no per-incident feature
table). That is the honest ceiling on the fusion claim — until you step outside
India for the *validation* while keeping the *design* Indian.

Great Britain's DfT publishes STATS19: every police-reported injury collision,
openly downloadable, with exactly the factors the fusion weights — casualty
type (pedestrian / cyclist / motorcyclist vs car occupant), light conditions,
speed limit, road surface — and an outcome label (Fatal / Serious / Slight).

This asks one question on ~128k real 2024 casualties: do the factors the model
treats as important actually predict who dies? It does NOT fit the shipped
weights to GB data, and it does NOT claim GB ≈ India. It tests the *premise* —
that these are the right factors and VRUs are disproportionately killed — against
reality, which an authored ground truth cannot do.

Honest scope, stated up front:

* GB, not India. Reported here because the model's *design* is Indian while its
  *validation* needs real labelled crashes, and GB has them. The two VRU classes
  that dominate Indian deaths — pedestrians and motorcyclists — are precisely the
  high-fatality classes here; GB cyclists are comparatively protected (segregated
  infrastructure) and score low, which is itself an honest India-vs-GB caveat.
* Crash *severity* is the outcome, which is not identical to the model's
  real-time *risk* score. What transfers is the factor structure: the same
  variables, the same directions, the same rough ordering.

    python -m ai.trie.external_validation            # downloads STATS19 to a cache dir, prints metrics
    python -m ai.trie.external_validation --data-dir /path/to/csvs
"""
from __future__ import annotations

import argparse
import json
import tempfile
import urllib.request
from pathlib import Path

_BASE = "https://data.dft.gov.uk/road-accidents-safety-data"
_FILES = {
    "collision": "dft-road-casualty-statistics-collision-2024.csv",
    "casualty": "dft-road-casualty-statistics-casualty-2024.csv",
}
# STATS19 code lists (see the DfT "Road Safety Open Dataset Data Guide").
_VRU_CASUALTY_TYPES = {0, 1, 2, 3, 4, 5, 23, 97}  # pedestrian, cyclist, motorcyclists
_CAR_OCCUPANT_TYPES = {8, 9}
_DARK_LIGHT = {4, 5, 6, 7}
_POOR_SURFACE = {2, 3, 4, 5}


def _ensure_data(data_dir: Path) -> dict[str, Path]:
    data_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for key, name in _FILES.items():
        dest = data_dir / name
        if not dest.exists() or dest.stat().st_size < 1_000_000:
            print(f"downloading {name} ...")
            urllib.request.urlretrieve(f"{_BASE}/{name}", dest)
        paths[key] = dest
    return paths


def run(data_dir: Path) -> dict:
    import numpy as np
    import pandas as pd

    paths = _ensure_data(data_dir)
    cas = pd.read_csv(paths["casualty"], low_memory=False)
    col = pd.read_csv(paths["collision"], low_memory=False)

    # --- VRU over-representation, casualty level ---
    cas["is_vru"] = cas["casualty_type"].isin(_VRU_CASUALTY_TYPES).astype(int)
    cas["is_car_occ"] = cas["casualty_type"].isin(_CAR_OCCUPANT_TYPES).astype(int)
    cas["fatal"] = (cas["casualty_severity"] == 1).astype(int)

    vru_rate = cas.loc[cas.is_vru == 1, "fatal"].mean()
    car_rate = cas.loc[cas.is_car_occ == 1, "fatal"].mean()
    vru_share_all = cas["is_vru"].mean()
    vru_share_fatal = cas.loc[cas.fatal == 1, "is_vru"].mean()

    # --- Environment factors, collision level ---
    col["fatal"] = (col["collision_severity"] == 1).astype(int)
    light = pd.to_numeric(col["light_conditions"], errors="coerce")
    surface = pd.to_numeric(col["road_surface_conditions"], errors="coerce")
    speed = pd.to_numeric(col["speed_limit"], errors="coerce")
    dark_rate = col.loc[light.isin(_DARK_LIGHT), "fatal"].mean()
    day_rate = col.loc[light == 1, "fatal"].mean()
    by_speed = {int(s): round(col.loc[speed == s, "fatal"].mean() * 100, 2)
                for s in (20, 30, 40, 50, 60, 70)}

    # --- Joint discrimination: do the fusion's factors predict who dies? ---
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import cross_val_predict
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    c = col.assign(
        is_dark=light.isin(_DARK_LIGHT).astype(int),
        poor_surface=surface.isin(_POOR_SURFACE).astype(int),
        speed_limit_n=speed,
    )[["collision_index", "is_dark", "poor_surface", "speed_limit_n"]]
    m = cas[["collision_index", "is_vru", "fatal"]].merge(c, on="collision_index", how="inner")
    m = m.dropna(subset=["speed_limit_n"])
    m = m[(m.speed_limit_n >= 20) & (m.speed_limit_n <= 70)]

    features = ["is_vru", "is_dark", "poor_surface", "speed_limit"]
    X = m[["is_vru", "is_dark", "poor_surface", "speed_limit_n"]].to_numpy(float)
    y = m["fatal"].to_numpy()
    pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight="balanced"))
    proba = cross_val_predict(pipe, X, y, cv=5, method="predict_proba")[:, 1]
    auc = roc_auc_score(y, proba)
    pipe.fit(X, y)
    coefs = {f: round(float(c), 3) for f, c in zip(features, pipe.named_steps["logisticregression"].coef_[0])}

    result = {
        "source": "DfT STATS19, Great Britain, 2024 (police-reported injury collisions)",
        "n_collisions": int(len(col)),
        "n_casualties": int(len(cas)),
        "vru_first": {
            "vru_fatality_rate_pct": round(vru_rate * 100, 2),
            "car_occupant_fatality_rate_pct": round(car_rate * 100, 2),
            "vru_relative_risk": round(vru_rate / car_rate, 2),
            "vru_share_of_all_casualties_pct": round(vru_share_all * 100, 1),
            "vru_share_of_fatal_casualties_pct": round(vru_share_fatal * 100, 1),
        },
        "low_light": {
            "dark_fatality_rate_pct": round(dark_rate * 100, 2),
            "daylight_fatality_rate_pct": round(day_rate * 100, 2),
            "relative_risk": round(dark_rate / day_rate, 2),
        },
        "speed_fatality_rate_pct_by_limit": by_speed,
        "joint_model": {
            "features": features,
            "n": int(len(m)),
            "cv5_roc_auc": round(float(auc), 3),
            "standardised_coefficients": coefs,
        },
    }
    print(json.dumps(result, indent=2))
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.trie.external_validation", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(tempfile.gettempdir()) / "stats19")
    args = parser.parse_args(argv)
    run(args.data_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
