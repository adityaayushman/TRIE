"""Does the learned fusion recover the *right* interactions? (Friedman's H).

    python -m ai.trie.interaction_analysis

fusion_study.py showed a gradient-boosted model beats the additive rule because
the ground truth compounds — but "it fits better" is not "it learned the right
structure". This checks the structure directly with Friedman & Popescu's (2008)
H-statistic, the standard way to quantify how much of a model's behaviour comes
from a pair of features *interacting* rather than acting alone. It needs no SHAP
(SHAP on the additive rule would be redundant — the rule is already exactly its
own attribution; and the library forces a numpy 2.x upgrade this repo's vision
stack cannot take), only partial dependence the model already supports.

The ground truth was authored with exactly three interactions — speed×road
surface, speed×VRU exposure, distraction×VRU exposure. A model that genuinely
learned the compounding should rank those three pairs far above the rest. That
is the check: the learned model is not just more accurate, it is right for the
right reason — and its reasons are inspectable.
"""
from __future__ import annotations

import json
from itertools import combinations

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

from ai.trie.fusion_study import FACTORS, _generate

SEED = 0

# Feature pairs the generative truth actually couples (fusion_study._TRUE_INTERACTIONS).
_TRUE_PAIRS = {
    ("speed", "road_quality"),
    ("speed", "vru_exposure"),
    ("driver_distraction", "vru_exposure"),
}


def _predict(model, x: np.ndarray) -> np.ndarray:
    return model.predict_proba(x)[:, 1]


def _partial_dependence(model, background: np.ndarray, points: np.ndarray, feats: list[int]) -> np.ndarray:
    """Centred partial dependence of `feats` evaluated at each row of `points`.

    PD(v) = mean over the background of f(background with `feats` set to v),
    then centred to mean zero over the evaluation points — the form Friedman's
    H-statistic is defined on.
    """
    n_bg = background.shape[0]
    out = np.empty(points.shape[0])
    for i, row in enumerate(points):
        grid = background.copy()
        for f in feats:
            grid[:, f] = row[f]
        out[i] = _predict(model, grid).mean()
    return out - out.mean()


def h_statistic(model, background: np.ndarray, points: np.ndarray, j: int, k: int) -> float:
    """Friedman's pairwise H: fraction of the pair's joint variance due to
    interaction rather than the two additive main effects. 0 = separable."""
    pd_j = _partial_dependence(model, background, points, [j])
    pd_k = _partial_dependence(model, background, points, [k])
    pd_jk = _partial_dependence(model, background, points, [j, k])
    numerator = np.sum((pd_jk - pd_j - pd_k) ** 2)
    denominator = np.sum(pd_jk**2)
    if denominator <= 1e-12:
        return 0.0
    return float(np.sqrt(numerator / denominator))


def run_analysis(n: int = 20000, sample: int = 200, seed: int = SEED) -> dict:
    rng = np.random.default_rng(seed)
    x, _p, y = _generate(n, rng)
    model = GradientBoostingClassifier(random_state=seed).fit(x, y)

    # A modest background/evaluation subsample keeps the O(pairs · sample · bg)
    # partial-dependence cost small while giving a stable ranking.
    idx = rng.choice(n, size=sample, replace=False)
    subset = x[idx]

    pairs = []
    for j, k in combinations(range(len(FACTORS)), 2):
        h = h_statistic(model, subset, subset, j, k)
        pairs.append(
            {
                "pair": [FACTORS[j], FACTORS[k]],
                "h": round(h, 3),
                "is_true_interaction": tuple(sorted((FACTORS[j], FACTORS[k])))
                in {tuple(sorted(p)) for p in _TRUE_PAIRS},
            }
        )
    pairs.sort(key=lambda p: p["h"], reverse=True)

    top3 = pairs[:3]
    recovered = sum(1 for p in top3 if p["is_true_interaction"])
    return {
        "samples": n,
        "subsample": sample,
        "true_interactions_recovered_in_top3": f"{recovered}/3",
        "ranked_pairs": pairs,
    }


if __name__ == "__main__":
    print(json.dumps(run_analysis(), indent=2))
