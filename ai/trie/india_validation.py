"""Corroborate the VRU-first premise on REAL Indian fatal crashes.

The STATS19 validation (external_validation, statistical_validation,
conformal_validation) is real but British. This is the Indian-data counterpart:
2,898 real fatal road crashes reported across India in 2022-2023, extracted from
Times of India coverage via NLP (Sharma et al., *Data in Brief*, 2025; Mendeley
Data 10.17632/bc5sv6wnd9.7, CC BY).

It cannot run the fatal-vs-non-fatal severity model — media coverage is
fatal-only, with no non-fatal comparison group — so this is a *descriptive*
validation of the VRU-first premise, not the inferential one. What it shows, on
real Indian crashes:

* the VRU share of fatal-crash victims (two-wheeler riders + pedestrians +
  cyclists) — the core VRU-first claim, cross-checked against MoRTH's 66.8%;
* the exposure asymmetry — how often a VRU victim was killed by a *heavier*
  road user (car / bus / truck), the "a vehicle moving through the exposed is
  lethal however alert its driver is" argument, made on real data;
* the road-type split.

Honest scope: media-reported (a fatal, newsworthy, million-plus-city-skewed
sample), NLP-extracted (some noise), descriptive not inferential. It is,
nonetheless, the first corroboration of the premise on real *Indian* crashes.

    # download "News Crashes.xlsx" from the Mendeley dataset above, then:
    python -m ai.trie.india_validation --file "path/to/News Crashes.xlsx"
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

# Keyword -> road-user class, matched case-insensitively against the free-text
# vehicle fields, so varied codings ("2W", "Two Wheeler", "motorcycle", "bike")
# all resolve. Order matters: first hit wins.
_CLASS_RULES = [
    ("two_wheeler", r"\b(2\s*w|two[\s-]*wheeler|motor\s*cycle|motorcycle|scooter|scooty|bike|moped)\b"),
    ("pedestrian", r"\b(pedestrian|pedestrain|walker|on\s*foot|foot)\b"),
    ("cyclist", r"\b(cycle|bicycle|cyclist)\b"),
    ("auto_rickshaw", r"\b(auto|rickshaw|three[\s-]*wheeler|3\s*w|tempo)\b"),
    ("car", r"\b(car|4\s*w|four[\s-]*wheeler|suv|jeep|van|taxi|cab|sedan)\b"),
    ("heavy", r"\b(truck|lorry|bus|tractor|trailer|dumper|hgv|tanker|container)\b"),
    ("train", r"\b(train|rail)\b"),
    ("fixed_object", r"\b(tree|pole|divider|wall|barrier|stationary|parked|ditch)\b"),
]
_VRU = {"two_wheeler", "pedestrian", "cyclist"}
_HEAVIER_THAN_VRU = {"car", "heavy", "auto_rickshaw", "train"}


def _classify(text) -> str:
    if text is None:
        return "unknown"
    s = str(text).lower()
    for label, pat in _CLASS_RULES:
        if re.search(pat, s):
            return label
    return "other"


def _load(path: Path):
    import pandas as pd

    df = pd.read_excel(path) if path.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(path)
    # Resolve the victim / partner / road-type columns tolerantly.
    cols = {c.lower().strip(): c for c in df.columns}
    def pick(*cands):
        for cand in cands:
            for lc, orig in cols.items():
                if cand in lc:
                    return orig
        return None
    victim = pick("vehicle 1", "vehicle1", "victim")
    partner = pick("vehicle/object 2", "vehicle 2", "object 2", "vehicle2")
    road = pick("road type", "road_type", "road")
    killed = pick("killed", "fatalit", "death")
    return df, victim, partner, road, killed


def run(path: Path) -> dict:
    df, victim_col, partner_col, road_col, killed_col = _load(path)
    n = int(len(df))
    if victim_col is None:
        raise SystemExit(f"could not find the victim vehicle column in {list(df.columns)}")

    df["_victim"] = df[victim_col].map(_classify)
    victim_counts = df["_victim"].value_counts()
    vru_mask = df["_victim"].isin(_VRU)
    vru_share = float(vru_mask.mean())
    tw_share = float((df["_victim"] == "two_wheeler").mean())
    ped_share = float((df["_victim"] == "pedestrian").mean())

    result = {
        "source": "Media-Reported Road Traffic Crash Data, India 2022-2023 (Mendeley 10.17632/bc5sv6wnd9.7, CC BY)",
        "n_fatal_crashes": n,
        "victim_composition_pct": {k: round(v / n * 100, 1) for k, v in victim_counts.items()},
        "vru_first": {
            "vru_victim_share_pct": round(vru_share * 100, 1),
            "two_wheeler_share_pct": round(tw_share * 100, 1),
            "pedestrian_share_pct": round(ped_share * 100, 1),
            "morth_reference_pct": 66.8,
            "note": "share of fatal-crash victims who are two-wheeler riders, pedestrians or cyclists",
        },
    }

    # Exposure asymmetry: a VRU killed in a collision with a heavier road user.
    if partner_col is not None:
        df["_partner"] = df[partner_col].map(_classify)
        vru = df[vru_mask]
        killed_by_heavier = vru["_partner"].isin(_HEAVIER_THAN_VRU)
        result["exposure_asymmetry"] = {
            "vru_victims": int(len(vru)),
            "killed_by_heavier_vehicle_pct": round(float(killed_by_heavier.mean()) * 100, 1),
            "note": "of VRU fatal-crash victims, share whose collision partner was a car/bus/truck/auto — the exposure the VRU-first weighting encodes",
        }

    if road_col is not None:
        rc = df[road_col].astype(str).str.lower()
        result["road_type_pct"] = {
            "national_highway": round(float(rc.str.contains(r"national|\bnh\b").mean()) * 100, 1),
            "state_highway": round(float(rc.str.contains(r"state|\bsh\b").mean()) * 100, 1),
        }

    print(json.dumps(result, indent=2))
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.trie.india_validation", description=__doc__)
    parser.add_argument("--file", type=Path, required=True, help='path to "News Crashes.xlsx" from the Mendeley dataset')
    args = parser.parse_args(argv)
    if not args.file.exists():
        raise SystemExit(f"{args.file} not found — download it from https://data.mendeley.com/datasets/bc5sv6wnd9/7")
    run(args.file)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
