"""Regression check for the paper's headline, reproducible-from-public-data claims.

Runs the statistics-only validation modules end to end (they auto-download
their own public source data) and asserts each headline number stays within a
sane tolerance band of what the paper/`/research` page cites. This is a
*regression* check, not an exact-match test: STATS19 and the NHAI/Zenodo
release can both be revised upstream, so bounds are wide enough to absorb a
routine data refresh but tight enough to catch a real break (a swapped sign, a
broken merge key, a coding error).

Deliberately excludes anything needing torch/ultralytics/mediapipe (covered by
the separate `model-tests` CI job) and `india_validation` (needs a manually
downloaded xlsx the Mendeley SPA blocks scripted access to).

    python scripts/check_reproducibility.py
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path


def _check(label: str, value: float, lo: float, hi: float) -> bool:
    ok = lo <= value <= hi
    status = "OK  " if ok else "FAIL"
    print(f"[{status}] {label}: {value} (expected [{lo}, {hi}])")
    return ok


def check_statistical_validation() -> bool:
    from ai.trie.statistical_validation import run

    r = run(Path(tempfile.gettempdir()) / "stats19")
    ok = True
    ok &= _check("STATS19 AUC", r["discrimination"]["cv5_auc"], 0.65, 0.80)
    or_vru = r["multivariable_logistic_odds_ratios"]["is_vru"]["odds_ratio"]
    ok &= _check("STATS19 VRU odds ratio", or_vru, 3.0, 15.0)
    p_interact = r["interactions"]["likelihood_ratio_test"]["p_value"]
    ok &= _check("STATS19 speed x VRU interaction p-value", p_interact, 0.0, 0.01)
    return ok


def check_conformal_validation() -> bool:
    from ai.trie.conformal_validation import run

    r = run(Path(tempfile.gettempdir()) / "stats19", alpha=0.10)
    ok = True
    target = r["target_coverage"]  # 0.90
    for name, reg in r["regimes"].items():
        # The distribution-free guarantee: empirical fatal coverage must clear
        # the target in every sensor regime, every run, by construction.
        ok &= _check(f"conformal fatal_coverage [{name}] >= target", reg["fatal_coverage"], target, 1.0)
    return ok


def check_india_severity_model() -> bool:
    from ai.trie.india_severity_model import run

    r = run(Path(tempfile.gettempdir()) / "nhai_india")
    ok = True
    ok &= _check("NHAI n records", r["n"], 7000, 9000)
    or_vru = r["multivariable_logistic_odds_ratios"]["vru_involved"]["odds_ratio"]
    ok &= _check("NHAI VRU odds ratio", or_vru, 1.5, 3.0)
    p_vru = r["multivariable_logistic_odds_ratios"]["vru_involved"]["p_value"]
    ok &= _check("NHAI VRU p-value", p_vru, 0.0, 0.001)
    ok &= _check("NHAI AUC", r["discrimination"]["cv5_auc"], 0.55, 0.70)
    return ok


def main() -> int:
    checks = [
        ("UK STATS19 statistical validation", check_statistical_validation),
        ("UK STATS19 conformal validation", check_conformal_validation),
        ("Indian NHAI inferential severity model", check_india_severity_model),
    ]
    all_ok = True
    for label, fn in checks:
        print(f"\n=== {label} ===")
        try:
            all_ok &= fn()
        except Exception as exc:  # noqa: BLE001 - surface any failure as a check failure
            print(f"[FAIL] {label} raised: {exc!r}")
            all_ok = False
    print("\n" + ("ALL REPRODUCIBILITY CHECKS PASSED" if all_ok else "REPRODUCIBILITY CHECK FAILED"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
