"""Learned risk fusion vs the hand-set rule — a controlled, calibrated study.

    python -m ai.trie.fusion_study

The shipped TRIE fusion (ai/trie/risk_fusion.py) is a linear additive model with
weights set by hand from the MoRTH fatality split. Two honest questions follow:
are those weights defensible, and does the additive form leave signal on the
table? A learned model can answer both — but only against a ground truth, and no
public dataset labels these six telemetry factors against real crash outcomes
(SHRP2 is access-gated and its features do not map; the same wall as the MoRTH
black-spot validation).

So this is a *controlled* study, framed exactly like ai/blackspot/evaluate.py.
A generative "true" risk is authored with something the linear rule provably
cannot represent — factor *interactions* (fast on a bad surface is worse than
fast plus bad separately; distraction near vulnerable road users compounds).
Binary near-miss/crash outcomes are sampled from it, and three models compete on
a held-out split:

  * rule        — the shipped fixed linear weights, Platt-scaled to a probability
                  (given its best shot at calibration);
  * logistic    — a learned *linear* model (learns weights, still additive);
  * gbm         — a learned model that can represent interactions.

Reported: ROC-AUC (ranking), Brier score and expected calibration error
(calibration), and the learned linear coefficients vs the hand-set weights. The
result supports "the architecture admits a learned, calibrated fusion that
captures interactions the rule cannot, and the hand-set weights are in the right
order" — not a field-measured accuracy. Deploying a learned fusion needs labelled
telemetry that does not publicly exist; that remains the open experiment.
"""
from __future__ import annotations

import json

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

# Factor order is fixed and matches ai/trie/risk_fusion.py so the learned
# coefficients are directly comparable to the hand-set weights.
FACTORS = [
    "driver_distraction",
    "speed",
    "vru_exposure",
    "road_quality",
    "lane_drift",
    "traffic_congestion",
]

# The shipped rule's weights (ai/trie/risk_fusion._BASE_WEIGHTS), in FACTORS order.
RULE_WEIGHTS = np.array([0.28, 0.22, 0.20, 0.13, 0.09, 0.08])

# Realistic skew: most driving is low on every factor, with a tail. Beta(a,b)
# per factor; speed and congestion sit a little higher than the rest.
_BETA = {
    "driver_distraction": (1.8, 5.0),
    "speed": (2.4, 3.2),
    "vru_exposure": (1.6, 5.5),
    "road_quality": (1.8, 4.5),
    "lane_drift": (1.5, 6.0),
    "traffic_congestion": (2.2, 4.0),
}

# Generative "true" risk on the logit scale. The linear part echoes the MoRTH
# ordering; the interaction part carries a large share of the signal, because on
# real roads fatal crashes cluster where conditions compound (fast AND bad
# surface AND vulnerable road users), not where one factor is high alone. That
# compounding is precisely what an additive model cannot represent.
_TRUE_INTERCEPT = -3.6
_TRUE_LINEAR = {
    "driver_distraction": 0.6,
    "speed": 0.5,
    "vru_exposure": 0.5,
    "road_quality": 0.3,
    "lane_drift": 0.2,
    "traffic_congestion": 0.2,
}
_TRUE_INTERACTIONS = {
    ("speed", "road_quality"): 8.5,        # fast on a bad surface compounds
    ("speed", "vru_exposure"): 8.0,        # fast near VRUs compounds
    ("driver_distraction", "vru_exposure"): 8.0,  # distracted near VRUs compounds
}


def _generate(n: int, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Sample factor vectors, their true crash probability, and binary outcomes."""
    x = np.column_stack([rng.beta(a, b, size=n) for a, b in (_BETA[f] for f in FACTORS)])
    idx = {f: i for i, f in enumerate(FACTORS)}

    logit = np.full(n, _TRUE_INTERCEPT)
    for f, beta in _TRUE_LINEAR.items():
        logit += beta * x[:, idx[f]]
    for (f1, f2), gamma in _TRUE_INTERACTIONS.items():
        logit += gamma * x[:, idx[f1]] * x[:, idx[f2]]

    p_true = 1.0 / (1.0 + np.exp(-logit))
    y = (rng.random(n) < p_true).astype(int)
    return x, p_true, y


def _expected_calibration_error(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Mean |confidence - accuracy| over equal-width probability bins."""
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (p >= lo) & (p < hi) if hi < 1.0 else (p >= lo) & (p <= hi)
        if not mask.any():
            continue
        ece += (mask.mean()) * abs(p[mask].mean() - y[mask].mean())
    return float(ece)


def _platt(scores: np.ndarray, y: np.ndarray, fit_scores: np.ndarray, fit_y: np.ndarray) -> np.ndarray:
    """Turn a raw score into a probability via 1-D logistic (Platt) scaling,
    fit on the train scores — the rule's fairest shot at calibration."""
    lr = LogisticRegression()
    lr.fit(fit_scores.reshape(-1, 1), fit_y)
    return lr.predict_proba(scores.reshape(-1, 1))[:, 1]


def run_study(n: int = 40000, seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    x, _p_true, y = _generate(n, rng)
    x_tr, x_te, y_tr, y_te = train_test_split(x, y, test_size=0.3, random_state=seed, stratify=y)

    # rule: fixed linear weights -> raw score in [0,1], Platt-scaled to a prob.
    rule_tr = x_tr @ RULE_WEIGHTS
    rule_te = x_te @ RULE_WEIGHTS
    rule_prob = _platt(rule_te, y_te, rule_tr, y_tr)

    # logistic: a learned *linear* model.
    logit = LogisticRegression(max_iter=1000)
    logit.fit(x_tr, y_tr)
    logit_prob = logit.predict_proba(x_te)[:, 1]

    # gbm: a learned model that can represent interactions.
    gbm = GradientBoostingClassifier(random_state=seed)
    gbm.fit(x_tr, y_tr)
    gbm_prob = gbm.predict_proba(x_te)[:, 1]

    def metrics(prob: np.ndarray) -> dict:
        return {
            "roc_auc": round(float(roc_auc_score(y_te, prob)), 4),
            "brier": round(float(brier_score_loss(y_te, prob)), 4),
            "ece": round(_expected_calibration_error(y_te, prob), 4),
        }

    # Learned linear weights, renormalised to sum to 1 like the rule's, so the
    # ordering is directly comparable to the hand-set values.
    learned = np.clip(logit.coef_[0], 0, None)
    learned = learned / learned.sum() if learned.sum() > 0 else learned

    return {
        "samples": n,
        "test_samples": int(len(y_te)),
        "positive_rate": round(float(y.mean()), 4),
        "models": {
            "rule_fixed_linear": metrics(rule_prob),
            "learned_linear": metrics(logit_prob),
            "learned_gbm": metrics(gbm_prob),
        },
        "weights_comparison": [
            {
                "factor": f,
                "hand_set": round(float(RULE_WEIGHTS[i]), 3),
                "learned_linear": round(float(learned[i]), 3),
            }
            for i, f in enumerate(FACTORS)
        ],
    }


if __name__ == "__main__":
    print(json.dumps(run_study(), indent=2))
