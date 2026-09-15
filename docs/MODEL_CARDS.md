# Model Cards

Following the model-card convention (Mitchell et al., 2019, *Model Cards for
Model Reporting*), one card per model in the system. Every number below is
either a measured evaluation artifact in `runs/*/evaluation.json` /
`ai/trie/*.py` output, or is explicitly labelled a design choice rather than a
measurement. No model in this system is presented as state-of-the-art; each
card states its actual, current scope.

---

## 1. Risk Fusion Engine

**File:** `ai/trie/risk_fusion.py`

| | |
|---|---|
| **Type** | Rule-based additive fusion (transparent weights), not a learned model |
| **Inputs** | driver distraction, speed, VRU exposure, road quality, lane drift, traffic congestion, low-light (7 factors) |
| **Output** | 0–100 risk score + exactly additive `contributing_factors` breakdown |
| **Intended use** | The system's single risk number, explainable by construction |
| **Not intended for** | Standalone safety-critical deployment without the validation below |

**Design rationale.** Weights are ordered by each factor's share of Indian road
deaths (MoRTH 2024), not by ease of measurement — VRU exposure is weighted
0.20, not treated symmetrically with occupant-centric factors. When a factor is
unobservable (no lane markings, no driver-facing camera) its weight is
redistributed across the rest so the score stays comparable across sensor
regimes.

**Validation status.** The **factor structure** (not this exact rule-based
weighting) is validated on two real crash datasets:
- UK STATS19 (~128k casualties, 2024): AUC 0.725 (95% CI 0.713–0.737); every
  factor direction confirmed; speed×VRU interaction significant (p<10⁻⁹).
  `python -m ai.trie.statistical_validation`
- Indian NHAI highways (8,116 records): VRU involvement OR 1.97 (95% CI
  1.80–2.17, p≈7×10⁻⁴⁵) for a killed-or-seriously-injured outcome.
  `python -m ai.trie.india_severity_model`

**Known limitation.** The exact rule-based weights themselves are a
*transparent approximation*, stated as such in the module docstring — the
factor *directions and relative importance* are what the validation confirms,
not this specific weight vector. A learned fusion model trained on labelled
near-miss/accident telemetry is the stated upgrade path (blocked on data
access — see `docs/DATASHEETS.md` §"What is not yet available").

**Uncertainty.** A distribution-free conformal-prediction layer
(`ai/trie/conformal_validation.py`) gives a mathematically guaranteed ≥90%
fatal-outcome coverage per sensor regime (full / no-camera / telemetry-only),
with the alarm-rate cost reported alongside — not a hand-tuned confidence band.

---

## 2. Road-User Perception (VRU/vehicle detector)

**File:** `ai/perception/engine.py`

| | |
|---|---|
| **Architecture** | YOLOv11n (default weights) |
| **Training data (current)** | COCO — pretrained, not fine-tuned |
| **Task** | Detect + classify road users into TRIE's taxonomy (two-wheeler, car, pedestrian, etc.) from COCO classes |
| **Measured accuracy** | None — COCO's own benchmark numbers apply, not an Indian-road accuracy claim |

**Explicit limitation (by design, stated in the module docstring).** COCO is a
Western, lane-disciplined, car-dominated distribution with **no auto-rickshaw
class**, no six-person-motorcycle concept, and no cattle. On Indian roads it
will miss and mislabel these. It is used as a legitimate, real baseline — not
represented anywhere as a publishable Indian-road accuracy figure.

**Upgrade path (in progress).** Fine-tuning on the India Driving Dataset (IDD)
via `ai/training/train_perception.py`. Local training was attempted and halted
honestly rather than shipped undertrained (6 GB GPU / 16 GB RAM insufficient
for a full run; a partial 2-epoch/320px run reached mAP50 11.8%, which is not
reported anywhere as a system capability). A Kaggle T4 notebook
(`ai/training/kaggle_idd_notebook.md`) is the planned completion path — see
`ROADMAP.md` item 0.3.

---

## 3. VRU Vulnerability Detector (helmet / triple-riding / plate)

**File:** `ai/vru_intelligence/vulnerability.py` (inference), `ai/training/train_helmet.py` (training)

| | |
|---|---|
| **Architecture** | YOLOv11s, fine-tuned |
| **Training data** | Kaggle "Traffic Violations: Triple Riding / No Helmet / Plate" (open dataset), 11,195 training images |
| **Classes** | `plate`, `with_helmet`, `without_helmet`, `triple_riding` |
| **Epochs** | 40, batch 12, 640px |

**Measured evaluation** (`runs/helmet_vru/evaluation.json`, held-out val split):

| Metric | Value |
|---|---|
| mAP@50 (overall) | **78.2%** |
| mAP@50–95 (overall) | 56.2% |
| Precision / Recall | 79.3% / 72.8% |

| Class | mAP@50 | mAP@50–95 |
|---|---|---|
| triple_riding | 91.0% | 69.2% |
| plate | 83.2% | 45.4% |
| without_helmet | 75.6% | 60.0% |
| with_helmet | 62.9% | 50.0% |

**Known weak point.** `with_helmet` is the noisiest class (fewest validation
instances) — reported plainly rather than only the headline mAP.

**Intended use.** Feeds the VRU-exposure factor's severity multiplier (an
unhelmeted or triple-riding rider is scored as more exposed, not just
"present"). Not validated as a standalone traffic-enforcement tool.

---

## 4. Road-Damage Detector

**File:** `ai/road_intelligence/damage.py` (classical-CV baseline), `ai/training/train_road_damage.py` (fine-tuned detector)

| | |
|---|---|
| **Architecture** | YOLOv11s, fine-tuned |
| **Training data** | RDD2022, Indian split (Arya et al. 2024, *Geoscience Data Journal*) |
| **Classes** | longitudinal_crack, transverse_crack, alligator_crack, pothole |
| **Epochs trained** | 55, 640px |

**Measured evaluation** (`runs/road_damage_india/evaluation.json`, held-out val split, 1,542 images):

| Metric | Value |
|---|---|
| mAP@50 (overall) | **33.0%** |
| mAP@50–95 (overall) | 14.2% |
| Precision / Recall | 61.7% / 31.1% |

| Class | mAP@50 | mAP@50–95 |
|---|---|---|
| alligator_crack | 57.7% | 27.3% |
| pothole | 44.3% | 16.5% |
| longitudinal_crack | 28.0% | 12.5% |
| transverse_crack | **1.9%** | 0.4% |

**Known weak point, stated plainly.** `transverse_crack` detection is close to
non-functional (1.9% mAP@50) — almost certainly a thin/low-instance-count class
that needs more data or a class-balancing pass before being relied on. This is
reported rather than folded into an aggregate that would hide it.

**Context.** The engine's own prior state (`ai/road_intelligence/damage.py`,
classical computer vision) explicitly documents that it "has not been
benchmarked against any labelled road-damage dataset" and "will confuse a
strong shadow for a pothole." This detector is the first measured accuracy
number for that layer — a real improvement over an unbenchmarked heuristic,
not a claim of matching published RDD2022 leaderboard results.

---

## 5. Indian Severity Model (inferential)

**File:** `ai/trie/india_severity_model.py`

| | |
|---|---|
| **Type** | Multivariable logistic regression (statsmodels), plus a HistGradientBoosting baseline for comparison |
| **Training/eval data** | 8,116 real NHAI-highway crash records, 2013–2022 (Khanum et al., Zenodo 10.5281/zenodo.16946653, CC-BY-4.0) |
| **Outcome** | Killed-or-Seriously-Injured (KSI) — Fatal or Grievous injury |
| **Validation** | 5-fold cross-validated AUC + bootstrap 95% CI, calibration (Brier/ECE), leave-one-factor-out ablation |

**Measured performance:** AUC 0.603 (95% CI 0.589–0.617), GBM baseline AUC
0.622, ECE 0.036 (well-calibrated), Brier 0.239.

**Key result:** VRU involvement OR 1.97 (95% CI 1.80–2.17, p≈7×10⁻⁴⁵); VRU
struck by a heavier vehicle OR 1.48 (95% CI 1.18–1.87, p<10⁻³). Dropping VRU
from the feature set costs more discrimination than dropping any other factor.

**Reported honestly:** three geometry/weather terms (undivided road, adverse
weather, sharp curve) come out *protective*, a known highway-exposure /
behavioural-compensation artefact (severe crashes concentrate on high-speed
divided straights; drivers slow in rain), not hidden from the result.

**Scope.** NHAI *national highways* only (a high-speed, inter-urban exposure
profile — not representative of urban Indian roads); outcome is injury
severity, not TRIE's live risk score; "night" is an 18:00–06:00 time-of-day
proxy (the dataset has no measured light-condition field).

---

## 6. UK STATS19 Severity Model (inferential baseline)

**File:** `ai/trie/statistical_validation.py`, `ai/trie/external_validation.py`, `ai/trie/conformal_validation.py`

| | |
|---|---|
| **Type** | Multivariable logistic regression + HistGradientBoosting baseline + class-conditional split conformal prediction |
| **Training/eval data** | DfT STATS19, Great Britain, 2024 (~128k casualties) |
| **Outcome** | Fatal vs non-fatal |

**Measured performance:** AUC 0.725 (95% CI 0.713–0.737); conformal coverage
≥90% fatal-outcome guarantee under each of three sensor regimes (full /
no-camera / telemetry-only), with the corresponding alarm-rate cost reported.

**Scope, stated plainly.** Great Britain, not India. The VRU classes that
dominate Indian deaths (pedestrians, motorcyclists) are the classes that score
highest fatality risk here too — an encouraging cross-domain consistency — but
GB's protected, high-cycling-infrastructure environment means cyclists score
lower here than the Indian picture would suggest. This is the explicit
motivation for model #5 above.

---

## 7. Predictive Black-Spot Discovery Engine

**File:** `ai/blackspot/engine.py`, `ai/blackspot/simulation.py`, `ai/blackspot/evaluate.py`

| | |
|---|---|
| **Type** | Rule-based accumulation of near-miss/risk-factor signals over a location, compared against India's iRAD/e-DAR reactive threshold (5 grievous/fatal crashes or 10 fatalities in 3 years) |
| **Evaluation** | Controlled, multi-seed simulation — 40 seeds × 2 traffic volumes, dangerous vs busy-but-safe location |

**Measured result (simulation):** 100% detection rate at 0% false-positive rate
across all 80 runs; median lead time 1 day (busy junction) to 7.5 days (quiet
road) ahead of the reactive iRAD threshold.

**Explicit, load-bearing limitation — this is the most important line in this
document.** This is a **controlled evaluation, not a field trial.** The
"dangerous" and "safe" locations are *authored* from the causal factors
`risk_fusion.py` already models, and the near-miss→crash conversion rate has no
measured empirical constant (it is swept across an order of magnitude rather
than fixed to one assumed value). The result supports the claim "the discovery
methodology is sensitive, specific and early across a wide range of
assumptions" — it does **not** support "these are field-measured rates on real
Indian roads." Field validation against MoRTH's published black spots requires
near-miss telemetry for real locations, which is not publicly available. This
is `ROADMAP.md` item 0.1 — named as the open experiment, not papered over.

---

## Cross-cutting notes

- **No model in this system claims state-of-the-art detector accuracy.** The
  system's contribution is the VRU-first, explainable, predictive *framework*
  and its validation on real crash data — not a leaderboard result.
- **Every number above traces to a file**: either a `runs/*/evaluation.json`
  artifact from a real held-out split, or a `python -m ai.trie.*` command that
  reproduces the statistic from raw public data on demand.
- Retraining reproduces the exact commands in `README.md` and `paper/smart-road-guardian.md` Appendix A.
