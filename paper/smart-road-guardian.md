# Observability-Aware, VRU-First Risk Fusion for Indian Roads: A Predictive, Explainable Transportation-Risk System Validated on Real Crash Records

**Authors:** Aditya Ayushman Sahoo (add co-authors / advisor)
**Affiliation:** (institution)
**Target venue (candidates):** IEEE Transactions on Intelligent Transportation Systems (T-ITS) · Accident Analysis & Prevention · IEEE ITSC · IEEE Access

> **Status: working skeleton (2026-08).** Every number below is produced by the
> open-source repository and reproducible with the command noted in the appendix.
> References (Appendix B) are verified against author/year/venue/DOI. The one
> substantive research gap — a field validation on real *Indian* data — is named
> as future work (§6), not glossed over.

---

## Abstract

Road-safety technology in low- and middle-income motorisation contexts inherits
three assumptions from the high-income, car-dominated setting it was designed
for: it is **reactive** (acts after crashes accrue), **occupant-centric** (scores
risk to the person inside the vehicle), and **opaque** (reports a single number).
On Indian roads — where lanes are frequently unmarked, two-wheelers outnumber
cars, and 66.8% of the 1.68–1.77 lakh annual deaths are vulnerable road users
(VRUs) with no metal around them — all three assumptions fail. We present a
transportation-risk system that inverts each: an **observability-aware risk
fusion** that scores only the factors a given sensor suite can actually measure
and redistributes the rest, reporting a **calibrated uncertainty band** whose
width is driven by sensor coverage; a **VRU-first weighting** extended by a
fine-tuned helmet/triple-riding detector into a per-rider vulnerability
multiplier; and **predictive black-spot discovery** that nominates dangerous
road segments from near-misses before a crash record exists. Because no public
dataset labels India's live telemetry factors against real crash outcomes, we
validate the model's *premise* on 128,269 real casualties from the UK STATS19
database: the factors the model weights predict fatal outcomes with ROC-AUC
0.725 (95% CI 0.713–0.737), every factor carries the expected direction, and a
likelihood-ratio test confirms a significant speed×VRU interaction (p<1e-9) — the
compounding the VRU-first thesis predicts. We report honest limitations
prominently: the black-spot evaluation is a controlled simulation, and the
external validation is UK, not Indian, data. All code and evaluations are open.

**Keywords:** road safety, vulnerable road users, surrogate safety measures,
explainable AI, uncertainty quantification, risk fusion, India.

---

## 1. Introduction

**1.1 The problem.** India records ~1.68 lakh (2022, MoRTH) to ~1.77 lakh (2024)
road deaths annually. Two-wheeler riders (46.2%) and pedestrians (20.6%) together
are 66.8% of the dead. Yet the dominant safety paradigms were built elsewhere and
carry assumptions that do not hold here:

1. **Reactive.** India's official black-spot programme (iRAD/e-DAR) flags a ~500 m
   stretch only after **five fatal/grievous crashes or ten fatalities in three
   years** — a location must kill people before it earns the label.
2. **Occupant-centric.** ADAS and collision-warning systems model time-to-collision
   and driver state for the ego-vehicle occupant, not the exposed road users a
   vehicle threatens.
3. **Opaque and over-confident.** Risk is a single number; a missing sensor is
   silently treated as "safe" (no lane-departure signal reads as "in lane"), and
   the number carries the same confidence whether every sensor fired or one did.

**1.2 Contributions.** We invert each assumption and, crucially, *validate the
core premise on real crash data*:

- **(C1) Observability-aware risk fusion with calibrated uncertainty** — a
  transparent additive model that scores only observed factors, redistributes the
  weight of the unobserved, and reports a confidence band whose floor/ceiling are
  "every unmeasured factor is benign / at its worst." *(Primary contribution;
  fully validated on real data — §4.1.)*
- **(C2) VRU-first weighting + per-rider vulnerability** — VRUs are first-class,
  exposure-weighted; a fine-tuned detector reads helmet/no-helmet/triple-riding
  and amplifies scene exposure by a WHO-grounded multiplier.
- **(C3) Predictive black-spot discovery** — the iRAD 500 m unit nominated from
  near-misses, exposure-normalised and ranked by a Wilson lower bound, days before
  a crash record. *(Secondary; controlled evaluation — §4.3.)*
- **(C4) A reproducible, honesty-first evaluation** — 7 studies, each one command
  away, with limitations stated as prominently as results.

**1.3 What is genuinely new.** Predicting hazard from near-misses is not itself
new (§2, surrogate safety measures). Our novelty is the *system design*: fusing
heterogeneous, partially-observed factors into a **single explainable score that
is honest about its own uncertainty**, tilted toward the road users who actually
die, and demonstrated to rest on factor relationships that hold in real crash
records.

---

## 2. Related Work and Positioning

| Prior area | Representative work | What it does | What we add |
|---|---|---|---|
| **Surrogate safety measures (SSM) / traffic conflict techniques** | SSAM (Gettman et al. 2008, FHWA-HRT-08-051); TTC/PET indicators; VRU surrogate-indicator review (Johnsson, Laureshyn & De Ceunynck 2018, *Transport Reviews*) | Use near-misses (TTC, PET) as proactive safety precursors, increasingly for VRUs | We fold surrogate exposure into a **multi-factor, explainable fusion** with sensor-aware uncertainty, not a single conflict indicator; and use it for **segment nomination** |
| **Hotspot / black-spot identification** | Empirical Bayes (Hauer et al. 2002, *TRR* 1784); AASHTO Highway Safety Manual (2010); comparative evaluation (Cheng & Washington 2005, *AA&P* 37) | Combine a Safety Performance Function with observed crash counts (EB shrinkage) to rank sites, correcting regression-to-the-mean | EB still needs **crash history**; we nominate from **near-misses** with a Wilson lower bound, before crashes accrue — complementary, earlier |
| **Explainable ML for crash severity** | SHAP/LIME over ensemble severity models, e.g. Chang et al. (2022, *AA&P* 166) — XGBoost + SHAP on fatal pedestrian crashes | Post-hoc attribution (SHAP) over black-box severity classifiers | Our shipped model is **exactly additive by construction** — explanation needs no post-hoc attribution; we add **calibrated uncertainty from observability**, which post-hoc XAI does not provide |
| **VRU & helmet safety** | WHO helmet fatality-reduction (~42%); helmet-detection CV | Detect/enforce; quantify helmet benefit | We convert detection into a **scene vulnerability multiplier** wired into the risk score |
| **Uncertainty quantification** | Bayesian/ensemble UQ in ML | Predictive uncertainty from model/data | Our band is **driven by sensor coverage** (which factors were measurable), an interpretable, deployment-relevant notion |

**Gap we occupy.** No prior system, to our knowledge, combines (i) observability-
aware fusion that never scores an unmeasured factor as safe, (ii) a calibrated
uncertainty band tied to sensor coverage, (iii) a VRU-first weighting extended to
per-rider vulnerability, and (iv) predictive segment nomination — and then
validates the premise on real crash records. Positioning against SSM and EB is
essential: reviewers will (correctly) note near-miss prediction is established;
our claim is the *fusion + honesty + VRU-first* combination, not near-miss
prediction alone.

---

## 3. System and Method

### 3.1 Observability-aware risk fusion (C1)

Given driver, vehicle, road, traffic, perception and (optional) environmental
state, the engine computes per-factor magnitudes in [0,1] and fuses them as a
weighted sum. The base weights, ordered by the share of Indian deaths they
address rather than ease of measurement, are: driver-distraction 0.28, speed
0.22, VRU-exposure 0.20, road-quality 0.13, lane-drift 0.09, traffic-congestion
0.08, with a 7th environmental (low-light) factor of 0.10 folded in so the six
perception factors keep their exact relative weights when it is absent.

Two design choices are the contribution:

- **Redistribution, not imputation.** A factor with no sensor (no cabin camera →
  no distraction; no lane markings → no lane-drift) is **dropped and its weight
  renormalised over the observed factors** — never scored as 0 (safe). This keeps
  the score a true 0–100 comparable across sensor suites and road types.
- **Calibrated uncertainty band.** The point score assumes an unobserved factor
  scores like the observed average. The band makes that explicit: `risk_lower` =
  every unmeasured factor benign, `risk_upper` = every one at its worst; width =
  unobserved-factor weight. Full suite → band collapses to a point; speed-only →
  ~30-point band (e.g., 28% → 17–54%), an honest "we cannot see enough to be
  sure."

The additive form makes `contributing_factors` **exactly additive**, so the
explanation is the decomposition itself — no post-hoc attribution.

### 3.2 VRU-first weighting and per-rider vulnerability (C2)

Two-wheelers and pedestrians are kept as separate perception classes end-to-end
and weighted for exposure (proximity × crowding). A fine-tuned YOLOv11 detector
classifies each rider as helmeted / bare-headed / triple-riding; counts become a
scene **vulnerability multiplier** (WHO ~42% helmet fatality reduction →
1/(1−0.42) ≈ **1.72×** for a bare head; triple-riding a bounded ~1.4× aggravator;
product capped at 1.85×) that amplifies the VRU-exposure magnitude before
weighting, keeping the score additive and the reason reported.

### 3.3 Predictive black-spot discovery (C3)

The iRAD 500 m unit is nominated from near-misses instead of crashes:
exposure-normalised (every vehicle pass is the denominator) and ranked by a
**Wilson score lower bound**, so a stretch can be flagged before anyone dies and a
barely-observed cell cannot outrank a well-attested one.

### 3.4 Environmental context and temporal forecast

Time-of-day lighting risk is grounded in real MoRTH data (18:00–21:00 holds 20.4%
of accidents, the highest three-hour band) and is free from the assessment clock,
so it needs no hardware. A self-supervised temporal model extrapolates each
vehicle's own risk trend.

---

## 4. Experiments and Results

### 4.1 External validation of the premise on real crashes (primary result)

**Data.** DfT STATS19 (Great Britain, 2024): 100,928 police-reported injury
collisions, 128,272 casualties. Merged to 128,269 casualty records with
speed-limit, light, road-surface and casualty-type (VRU vs occupant) features and
a fatal/non-fatal outcome.

**Multivariable logistic regression** (mutually adjusted):

| Factor | Odds ratio (95% CI) | p |
|---|---|---|
| Vulnerable road user | **3.66** (3.27–4.09) | <1e-115 |
| Speed limit (per SD) | **2.23** (2.12–2.34) | <1e-229 |
| Darkness | **1.73** (1.56–1.92) | <1e-24 |
| Poor road surface | 1.02 (0.92–1.15) | 0.67 (n.s.) |

**Interactions (likelihood-ratio test, χ²=39.2, df=2, p=3e-9).** speed×VRU is
significant (OR 1.34, p<1e-9) — VRU risk compounds with speed, as the VRU-first
thesis predicts; speed×darkness is **not** significant (p=0.21). Notably, an
earlier raw-rate visualisation *suggested* a widening dark penalty; the formal
test demoted it — a demonstration that the method disciplines the eye.

**Discrimination and calibration.** 5-fold CV ROC-AUC **0.725** (95% CI
0.713–0.737); a gradient-boosted baseline reaches 0.733, i.e. the four factors
carry almost all available signal. The model is **well calibrated** (Brier 0.0121,
ECE 0.18%). Leave-one-out ablation: dropping speed costs most (ΔAUC −0.13),
dropping poor surface costs nothing (−0.00), consistent with its null OR.

**Interpretation and scope.** This validates the **factor structure** the model
rests on — the right factors, directions and ordering — on real crashes. It is GB,
not India (the two VRU classes that dominate Indian deaths, pedestrians and
motorcyclists, are exactly the high-fatality classes here; GB's protected cyclists
score low, an honest cross-domain difference), and crash severity is not identical
to the live risk score. Reproduce: `python -m ai.trie.external_validation`,
`python -m ai.trie.statistical_validation`.

### 4.2 Per-rider vulnerability detector

YOLOv11s fine-tuned (helmet/no-helmet/triple-riding/plate), 383 val images,
trained to 25 epochs (best checkpoint epoch 15). **mAP@50 78.2%**; per class:
triple-riding 91.0, plate 83.2, no-helmet 75.6, with-helmet 62.9 (noisiest — 27
val instances). Positioned as a component metric feeding the multiplier, not a
leaderboard claim. Reproduce: `python -m ai.training.train_helmet --evaluate`.

### 4.3 Predictive black-spot discovery (controlled evaluation)

40 seeds × two traffic volumes, a genuinely dangerous stretch vs a busy-but-safe
one: **100% detection, 0% false-positive** on the busy-but-safe road (the
load-bearing result — it flags danger, not volume), median lead time **1 day
(busy) / 7.5 days (quiet)** vs iRAD's 170–888 days (or never within its 3-year
window). **Honest limit:** authored ground truth; a field retrospective against
MoRTH's black-spot list needs near-miss telemetry for real Indian locations, which
is not publicly available. Reproduce: `python -m ai.blackspot.evaluate`.

### 4.4 Learned fusion and interaction analysis

On a controlled ground truth where risk compounds, a learned fusion beats the
hand-set additive rule (ROC-AUC 0.781 → 0.815 linear → **0.819 GBM**, all
calibrated, Brier ~0.16). Friedman's H-statistic on the GBM recovers the three
authored interactions in its top-3 (speed×road 0.25, speed×VRU 0.22,
distraction×VRU 0.19). The transparent rule ships; the learned model is evidence
the architecture admits a learned/calibrated fusion. (We use the H-statistic, not
SHAP, deliberately: the shipped model is already additive.) Reproduce:
`python -m ai.trie.fusion_study`, `python -m ai.trie.interaction_analysis`.

### 4.5 Supporting components

Road-damage detector (YOLOv11s on RDD2022-India, 1,542 val): mAP@50 **33.0%**
(alligator crack 57.7, pothole 44.3) — a working component, not SOTA. Temporal
forecast: a self-critical finding that shipped linear extrapolation (MAE 19.0) is
*worse* than persistence (13.4), while a small LSTM (10.1) cuts error ~47%.

---

## 5. Discussion

The result that carries the paper is §4.1: the model's premise is not asserted
from authored scenarios but demonstrated on six figures of real crashes, with
significance, calibration and an ablation. The system-level inversions (predictive,
VRU-first, observability-aware, explainable) are each defensible against the prior
art in §2, and the honesty — dropping unmeasured factors, reporting a band,
demoting an interaction the eye over-read — is itself the contribution reviewers of
safety-critical ML increasingly demand.

---

## 6. Limitations and Future Work

- **The headline predictive-discovery claim is simulation-only.** The highest-value
  next experiment is a **field retrospective against MoRTH's black-spot list**,
  which requires near-miss telemetry for real Indian locations — a data
  partnership (traffic police / a city / iRAD access), not a modelling change.
- **External validation is UK, not India.** The factor *structure* transfers; the
  magnitudes and the India-specific mix (auto-rickshaws, six-up motorcycles) do
  not. An Indian labelled crash-feature dataset is the enabling asset.
- **Perception is a baseline** (COCO-pretrained for general road users; the helmet
  detector is the fine-tuned exception). No leaderboard claim is made or needed.
- **The learned fusion is not shipped** — it waits on labelled Indian telemetry;
  the transparent rule ships in production.

---

## 7. Conclusion

Road safety for the road India actually has needs a system that acts before the
crash, protects the exposed, and is honest about what it cannot see. We presented
one, and — uniquely for a project of this kind — showed that the factor
relationships it rests on hold on real crash records. The remaining gap is real
Indian field data, which we name as the next experiment rather than paper over.

---

## Appendix A — Reproducibility

Every result is one command from the open-source repository:

| Result | Command |
|---|---|
| External validation (real crashes) | `python -m ai.trie.external_validation` |
| Statistical validation (ORs, interactions, calibration) | `python -m ai.trie.statistical_validation` |
| Black-spot discovery evaluation | `python -m ai.blackspot.evaluate` |
| Learned-fusion study | `python -m ai.trie.fusion_study` |
| Interaction analysis (H-statistic) | `python -m ai.trie.interaction_analysis` |
| Temporal forecast study | `python -m ai.temporal_prediction.forecast_study` |
| Helmet detector eval | `python -m ai.training.train_helmet --evaluate` |
| Road-damage detector eval | `python -m ai.training.train_road_damage --evaluate` |

## Appendix B — References

All references below verified against author/year/venue/DOI.

1. Ministry of Road Transport & Highways (MoRTH), Government of India. *Road Accidents in India* (annual reports, 2021–2024).
2. Hauer, E., Harwood, D. W., Council, F. M., & Griffith, M. S. (2002). "Estimating Safety by the Empirical Bayes Method: A Tutorial." *Transportation Research Record*, 1784, 126–131. doi:10.3141/1784-16.
3. American Association of State Highway and Transportation Officials (AASHTO) (2010). *Highway Safety Manual*, 1st ed.
4. Gettman, D., Pu, L., Sayed, T., & Shelby, S. (2008). *Surrogate Safety Assessment Model and Validation: Final Report.* FHWA-HRT-08-051, Federal Highway Administration.
5. Cheng, W., & Washington, S. P. (2005). "Experimental Evaluation of Hotspot Identification Methods." *Accident Analysis & Prevention*, 37(5), 870–881. doi:10.1016/j.aap.2005.04.015.
6. Johnsson, C., Laureshyn, A., & De Ceunynck, T. (2018). "In search of surrogate safety indicators for vulnerable road users: a review of surrogate safety indicators." *Transport Reviews*, 38(6), 765–785. doi:10.1080/01441647.2018.1442888.
7. World Health Organization (2006). *Helmets: A Road Safety Manual for Decision-Makers and Practitioners.* WHO, Geneva. ISBN 978-92-4-156299-7. (2nd ed., 2023.)
8. Arya, D., Maeda, H., Ghosh, S. K., Toshniwal, D., & Sekimoto, Y. (2024). "RDD2022: A multi-national image dataset for automatic road damage detection." *Geoscience Data Journal*, 11(4). doi:10.1002/gdj3.260. (Preprint: arXiv:2209.08538, 2022.)
9. Department for Transport (Great Britain). *Road Safety Data (STATS19)*, 2024.
10. Chang, I., Park, H., Hong, E., Lee, J., & Kwon, N. (2022). "Predicting effects of built environment on fatal pedestrian accidents at location-specific level: application of XGBoost and SHAP." *Accident Analysis & Prevention*, 166, 106545. — representative SHAP-over-ensemble crash-severity work; contrast with our by-construction additive explanation.
