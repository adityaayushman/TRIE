# Smart Road Guardian AI X — presentation kit

Everything needed to present or evaluate the project in one place: the thesis,
every headline number, the honest real-vs-prototype status, a five-minute live
demo script, and the reproduction commands. The interactive version is the
live [/research](https://trie-dashboard.vercel.app/research) page; this is the
condensed, hand-it-to-a-reviewer form.

---

## One line

A **predictive, VRU-first, explainable, calibrated** transportation-risk
platform for Indian roads — it acts before crashes, weights the people most
likely to die, decomposes every score, and says how sure it is.

## Abstract

Conventional road-safety tooling is **reactive** (acts after crashes),
**occupant-centric** (scores the person in the car), and **opaque** (a single
number). On Indian roads — unmarked lanes, two-wheelers outnumbering cars, and
the exposed outnumbering the enclosed — all three assumptions fail. This system
inverts each: it nominates dangerous road stretches from *near-misses* before a
crash record exists; it weights risk toward vulnerable road users (two-wheelers
and pedestrians are 66.8% of Indian road deaths); and it reports every score as
a transparent, sensor-aware decomposition with a calibrated uncertainty band. A
real fine-tuned detector, learned-model studies, and a full multi-page product
sit on top, all deployed live. Every claim is quantified, reproducible, and
honestly scoped — where a stronger claim would need data that does not publicly
exist, the system says so rather than faking it.

---

## The problem (MoRTH, Road Accidents in India)

| Figure | Meaning |
|---|---|
| **1,77,175** | road deaths in India, 2024 |
| **66.8%** | were two-wheeler riders (46.2%) or pedestrians (20.6%) |
| **13,795** | black spots identified 2016–22; only ~5,036 treated |
| **20.4%** | of accidents fall in the 18:00–21:00 window (highest 3-hr band) |

---

## Contributions & headline results

### 1. Predictive black-spot discovery (the core novelty)
India's iRAD/e-DAR flags a 500 m stretch only after **5 fatal crashes or 10
deaths in 3 years** — people must die first. This nominates the same stretch
from near-misses, exposure-normalised, Wilson-lower-bound ranked.

| | Detection | False-positive | Lead time |
|---|---|---|---|
| Busy junction | 100% | 0% | median **1 day** |
| Quiet road | 100% | 0% | median **7.5 days** |
| iRAD (crash rule) | — | — | **170 / 450 / 888 / never** days |

0% false-positive on a *busy-but-safe* road is the load-bearing result — it
flags danger, not traffic volume. `python -m ai.blackspot.evaluate`

### 2. VRU-first risk weighting
Two-wheelers and pedestrians are first-class factors, weighted for exposure
(66.8% of deaths), not treated as obstacles to the occupant.

### 3. Explainability + calibrated uncertainty
Every score decomposes into additive factor shares, and carries a
**sensor-suite-aware band**: full sensors → collapses to a point; telemetry-only
(no camera) → ~30 points wide (e.g. 17–50%), an honest "we can't see enough."

### 4. Real fine-tuned road-damage detector
YOLOv11s on RDD2022 India, **mAP50 33.0%** on 1,542 held-out Indian images
(alligator crack 57.7%, pothole 44.3%). A working component, not a leaderboard
claim. `python -m ai.training.train_road_damage --evaluate`

### 5. Learned fusion beats the hand-set rule (study)
| Model | ROC-AUC | Brier |
|---|---|---|
| Hand-set rule (shipped) | 0.781 | 0.180 |
| Learned linear | 0.815 | 0.164 |
| Learned non-linear (GBM) | **0.819** | **0.162** |

And Friedman's **H-statistic recovers 3/3** of the true interactions in the
top 3 — the learned model is right *for the right reason*.
`python -m ai.trie.fusion_study` · `python -m ai.trie.interaction_analysis`

### 6. Horizon forecasting (study)
| Forecaster | MAE |
|---|---|
| Persistence | 13.4 |
| Linear extrapolation (shipped) | **19.0** |
| Learned LSTM | **10.1** |

The self-critical finding: linear extrapolation is *worse than doing nothing* at
a 6-step horizon; the LSTM cuts error ~47%. `python -m ai.temporal_prediction.forecast_study`

### 7. Environmental context (real, live)
A MoRTH-grounded time-of-day lighting factor — free from the clock, no camera —
folded into every live assessment.

---

## What is real vs. prototype (state it up front)

| Real model on real input | Transparent rule, learned replacement benchmarked |
|---|---|
| Road-damage detection (YOLOv11, mAP50 33%) | TRIE fusion (rule shipped; learned model studied) |
| Perception (YOLOv11), driver monitoring (MediaPipe) | Temporal forecast (linear shipped; LSTM studied) |
| Traffic intelligence; environmental context | Explainability (exact additive shares) |
| Uncertainty band | — |

The learned-fusion and forecast results are **controlled evaluations on authored
ground truth**: no public dataset labels these telemetry factors against real
Indian crash outcomes, so they demonstrate the method and architecture, not a
field number. The road-damage mAP and the environmental factor rest on real data.

---

## Five-minute live demo script

1. **Landing → Research** (`/research`) — 45s. Read the thesis and the three
   structural mismatches. Scroll to Benchmarks: point at the black-spot table
   (100% / 0% / 1–7.5 days vs iRAD) and the learned-fusion + forecast tables.
2. **Dashboard → Black Spots** — 60s. Show the map (illustrative sample): five
   stretches across NCR coloured by intervention (engineering/enforcement/
   education). Toggle to Live to show the honest single real data point.
3. **Live Risk → Run an Assessment** (sign in first) — 90s. Push speed up; watch
   the gauge and its **uncertainty band**. Point at "not observed" (no camera →
   distraction & lane drift dropped) and the **time-of-day** context line.
4. **Vehicle Intelligence** — 45s. The monitoring wall: real YOLOv11 boxes on
   recorded footage, live counts, "Rec" label (honest — not a live camera).
5. **Settings** — 30s. The model-status table: green = real, and the measured
   road-damage per-class mAP. Close on the honesty: "every amber row and every
   'authored ground truth' is stated, not hidden."

---

## Reproduce every number

```bash
pip install -r ai/requirements.txt
python -m ai.blackspot.evaluate                      # black-spot metrics
python -m ai.trie.fusion_study                       # learned vs rule fusion
python -m ai.trie.interaction_analysis               # H-statistic interactions
python -m ai.temporal_prediction.forecast_study      # LSTM vs linear
python -m ai.training.train_road_damage --evaluate   # road-damage mAP
pytest -m "not model"                                # 225 tests, incl. study guards
```

## Honesty statement (a strength, not a disclaimer)

Three claims are deliberately **not** made, because the data to back them does
not publicly exist: a fusion trained on real Indian crash telemetry, a field
validation of black spots against MoRTH's published list, and live camera/edge
(Jetson) pages. Each is named as an open experiment on the site. V2X is likewise
omitted rather than mocked. What *is* claimed is measured and reproducible.

**Stack:** FastAPI + PostgreSQL (Render) · Next.js + TypeScript (Vercel) ·
YOLOv11 · MediaPipe · scikit-learn · PyTorch. 225 tests.
