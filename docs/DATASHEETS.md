# Dataset Datasheets

Following the datasheet convention (Gebru et al., 2021, *Datasheets for
Datasets*), one datasheet per dataset used anywhere in this project. Provenance
was independently verified for each — including one rejection, kept here as a
record of the check rather than erased, because it is directly relevant to the
project's honesty stance.

---

## 1. DfT STATS19 — Great Britain Road Safety Data

- **Motivation.** Official UK Department for Transport collision database;
  used as the inferential validation set because it is the largest open,
  record-level, severity-labelled crash dataset available (non-fatal and fatal
  both present, which is what an inferential severity model requires).
- **Composition.** ~128,000 casualty records, Great Britain, 2024. Fields used:
  casualty type, casualty severity, light conditions, road surface conditions,
  speed limit.
- **Collection process.** Official police (STATS19 form) reporting, published
  by the UK Department for Transport.
- **Provenance verification.** Government open-data portal, well-known and
  widely used in transportation-safety literature (e.g., Cheng & Washington
  2005; Johnsson et al. 2018 cite this data family).
- **Uses.** `ai/trie/external_validation.py`, `ai/trie/statistical_validation.py`,
  `ai/trie/conformal_validation.py`.
- **License.** UK Open Government Licence.
- **Distribution.** Downloaded on demand by the validation scripts from the DfT
  open-data endpoint (`_ensure_data` in `external_validation.py`); not vendored
  in the repo.
- **Honest scope note.** **Great Britain, not India.** This is the explicit
  motivation for datasets #3 and #4 below — the cross-domain difference
  (protected cyclists in GB score lower fatality risk than the Indian picture
  would suggest) is reported as a finding, not smoothed over.

---

## 2. India Driving Dataset (IDD)

- **Motivation.** Fine-tune road-user perception for the actual Indian visual
  distribution — unmarked lanes, auto-rickshaws, mixed traffic — which COCO
  does not represent.
- **Composition.** IDD Detection, YOLO-format release (`redzapdos123/indian-driving-dataset-detections-yolov11`
  on Kaggle), 15 classes covering Indian road-user and vehicle types.
- **Collection process.** Dashcam footage across Indian cities/highways,
  originally released by IIIT Hyderabad / Intel for the IDD benchmark; this
  project uses the pre-converted YOLO-format Kaggle mirror.
- **Provenance verification.** IDD is a well-established, widely cited academic
  benchmark (Varma et al., IDD: A Dataset for Exploring Problems of Autonomous
  Navigation in Unconstrained Environments); the Kaggle mirror is a format
  conversion of that same source, not an independent/unverified upload.
- **Uses.** `ai/training/train_perception.py`; not yet in production (see
  Model Card #2 — training pending, `ROADMAP.md` 0.3).
- **License.** IDD's own research license (non-commercial); respected — this
  project does not redistribute the imagery, only the training script.
- **Honest scope note.** Local training was halted rather than shipped
  undertrained when hardware could not sustain a full run (see Model Card #2).
  No number from that partial run is reported anywhere as a system capability.

---

## 3. Media-Reported Fatal Road Traffic Crash Data, India (2022–2023)

- **Motivation.** The first check of the VRU-first premise on real *Indian*
  crashes, closing the "GB, not India" gap in dataset #1.
- **Composition.** 2,898 fatal crashes reported nationally in 2022–2023, with
  6,584 fatalities, extracted via NLP from Times of India coverage. Fields:
  victim vehicle/road-user type, collision-partner type, road type.
- **Collection process.** Automated NLP extraction of structured crash
  attributes from published news articles (Sharma et al., *Data in Brief*,
  2025).
- **Provenance verification.** Peer-reviewed data-descriptor paper (*Data in
  Brief*), Mendeley Data DOI 10.17632/bc5sv6wnd9.7, CC BY license — a citable,
  documented academic release, independently checked against the paper's
  stated methodology before use.
- **Uses.** `ai/trie/india_validation.py`.
- **License.** CC BY (Mendeley Data).
- **Distribution.** Manually downloaded (`News Crashes.xlsx`) from the Mendeley
  record; not auto-fetched (the Mendeley SPA blocks scripted downloads — the
  actual archive endpoint was found via a headless-browser diagnostic and is
  documented in project history for reproducibility).
- **Honest scope note.** **Media-reported, not police-reported** — a fatal,
  newsworthy, and likely million-plus-city-skewed sample. **Fatal-only**, so it
  has no non-fatal comparison group and supports only a *descriptive*
  validation (victim-composition rates), not an inferential severity model.
  This is exactly why dataset #4 was sourced.

---

## 4. NHAI Highway Accident Data (Indian inferential severity source)

- **Motivation.** Remove the fatal-only limitation of dataset #3: a real
  Indian dataset with a genuine non-fatal comparison group, enabling the first
  *inferential* Indian severity model (the direct counterpart to dataset #1's
  role for the UK model).
- **Composition.** 8,116 record-level accidents from four National Highways
  Authority of India (NHAI) highway segments: Pune-Solapur & Nagpur region,
  Barwa-Adda–Panagarh (NH-2, Jharkhand & West Bengal, 3,710 records),
  Chengapally–Walayar (Tamil Nadu, 422 records), 2013–2022. 13 fields: date,
  day of week, time, location/chainage, severity (1=Fatal, 2=Grievous,
  3=Minor, 4=Non-injury), cause, road feature, road condition, weather,
  vehicle types (up to 2 per accident).
- **Collection process.** Accident records collected from NHAI concessionaires
  operating the four highway stretches, compiled by the authors for a
  peer-reviewed severity-prediction study.
- **Provenance verification (see `docs/DATASHEETS.md` §"Rejected dataset"
  below for the negative case).** Independently confirmed genuine and Indian
  by:
  1. Cross-referencing the peer-reviewed source (Khanum, Garg, Faheem &
     Kulkarni, *Scientific Reports*, 2025 / *IntechOpen* chapter) which names
     the exact four highway segments and record counts;
  2. Inspecting the actual downloaded CSV: date range 1 Sep 2013 – 7 Jun 2022,
     highway **chainage-km** location markers (a distinctly Indian
     highway-engineering convention, absent from any Western or mislabeled
     dataset checked in this project);
  3. Reproducing the paper's reported class distribution exactly from the raw
     data (severity levels 2 and 3 most frequent, overspeeding the dominant
     cause) before writing any analysis code against it.
- **Codebook (Table 1, Khanum et al.).** Severity: 1=Fatal, 2=Grievous
  Injury, 3=Minor Injury, 4=Non-injury. Vehicle type: 6=Two-Wheeler, 8=Cycle,
  9=Pedestrian (→ VRU); 3/4/5=Bus/Mini-Bus/Truck, 10/14/15=Tractor/LCV/MAV
  (→ heavier vehicle). Cause: 2=Overspeeding. Full mapping in
  `ai/trie/india_severity_model.py` module docstring and constants.
- **Uses.** `ai/trie/india_severity_model.py`.
- **License.** CC-BY-4.0 (Zenodo).
- **Distribution.** Auto-downloaded on demand from the Zenodo API
  (`https://zenodo.org/api/records/16946653/files/.../content`) by
  `india_severity_model.py`; not vendored in the repo. DOI:
  10.5281/zenodo.16946653.
- **Honest scope note.** **NHAI *national highways* only** — a high-speed,
  inter-urban exposure profile, not representative of urban Indian roads where
  most VRU deaths occur. Outcome is injury severity (Killed-or-Seriously-
  Injured), not TRIE's live risk score. "Night" is an 18:00–06:00 time-of-day
  proxy because the dataset carries no measured light-condition field.

---

## 5. RDD2022 (Road Damage Detection 2022), Indian split

- **Motivation.** Give the road-quality/road-damage layer a measured accuracy
  number instead of an unbenchmarked classical-CV heuristic.
- **Composition.** RDD2022's India-labelled subset: images with
  longitudinal/transverse/alligator cracks and potholes, D00/D10/D20/D40
  damage-taxonomy annotations; 1,542 held-out validation images.
- **Collection process.** Multi-national road-imagery collection effort
  (Japan, India, Czech Republic, Norway, US, China), Arya et al.
- **Provenance verification.** Peer-reviewed, widely cited (*Geoscience Data
  Journal*, 2024; original preprint arXiv:2209.08538, 2022) — one of the
  standard open road-damage-detection benchmarks.
- **Uses.** `ai/training/train_road_damage.py`.
- **License.** As released by the RDD2022 consortium (research use).
- **Honest scope note.** The trained model's `transverse_crack` class is
  reported at 1.9% mAP@50 — a genuine weak point disclosed in Model Card #4,
  not smoothed into an aggregate.

---

## 6. Traffic Violations (Triple Riding / No Helmet / Plate) — Kaggle

- **Motivation.** Train the VRU vulnerability layer to detect *why* a rider is
  exposed (unhelmeted, three-up), not just detect a two-wheeler as a generic
  object.
- **Composition.** 11,195 training images, 4 classes: plate, with_helmet,
  without_helmet, triple_riding.
- **Collection process.** Community-compiled traffic-camera / dashcam imagery,
  released openly on Kaggle for the specific task of helmet/triple-riding
  detection.
- **Provenance verification.** Inspected directly — class balance, image
  content, and annotation format all consistent with the stated task; no
  geographic-mislabelling red flags of the kind found in dataset §"Rejected."
- **Uses.** `ai/training/train_helmet.py`.
- **License.** As released on Kaggle (open, attribution).
- **Honest scope note.** Class imbalance: `with_helmet` has the fewest
  validation instances and is the noisiest class (62.9% mAP@50, the lowest of
  the four) — disclosed in Model Card #3.

---

## 7. MoRTH "Road Accidents in India" (annual reports)

- **Motivation.** The official national statistical reference for headline
  numbers cited throughout the project (VRU share of deaths, total fatalities)
  — used for **context and cross-checking**, not as a training/validation
  dataset itself.
- **Composition.** Government-published annual aggregate statistics (not
  record-level data), 2021–2024 editions.
- **Provenance verification.** Ministry of Road Transport & Highways,
  Government of India — the primary official source; cited directly in the
  paper's reference list.
- **Uses.** Reference figures only (e.g., "MoRTH 2024: two-wheeler riders
  46.2%, pedestrians 20.6%" in `risk_fusion.py`); explicitly **not** used to
  fit any model, because it is aggregate, not record-level, data — using it as
  training ground truth would overstate what the numbers support.
- **License.** Government of India public report.

---

## Rejected dataset — recorded for transparency

### Kaggle "Road Accident Severity in India" (s3programmer)

- **Claim on Kaggle.** "Prepared from manual records of road traffic accidents
  for the years 2017–22," 12,316 instances, 32 features, India.
- **Verification performed.** Downloaded and inspected column-by-column before
  any analysis code was written.
- **Finding.** This is **not an Indian dataset**. It is the well-known **Addis
  Ababa, Ethiopia** road traffic accident dataset, re-uploaded with an
  incorrect geographic label. Diagnostic evidence found directly in the data:
  - `Road_allignment` contains `"Escarpments"` and `"mountainous terrain"`
    (Ethiopian highland geography, not used in Indian road datasets);
  - `Area_accident_occured` contains `"Church areas"`;
  - `Educational_level` contains `"Illiterate"` and `"Writing & reading"`
    (matching the original Ethiopian dataset's exact category labels);
  - `Type_of_vehicle` contains Ethiopian public-transport categories
    ("Public (> 45 seats)") not used in Indian vehicle-registration taxonomy;
  - Row/column count (12,316 × 32) is an exact match to the original,
    well-documented Addis Ababa dataset's published dimensions.
- **Action taken.** Rejected outright. Not used for any model, statistic, or
  claim anywhere in this project. Recorded here — and in project memory — so
  the check is not silently repeated or, worse, skipped in a future revision.
- **Why this matters for the project's credibility.** Training an "Indian
  severity model" on mislabeled Ethiopian data and presenting it as Indian
  evidence would have been exactly the kind of overclaim this project commits
  not to make. The rejection, not just the acceptance, is part of the
  methodology.

---

## Cross-cutting notes

- Every "real, Indian" claim anywhere in the paper, the `/research` page, or
  this documentation traces to datasets #3, #4, #5, #6 or #7 above — each
  independently provenance-checked, not accepted at face value from a
  platform listing.
- Datasets #1–#6 are all fetched or converted by code in this repository
  (`_ensure_data` / `--prepare` patterns), not manually staged, so the
  provenance chain is reproducible by a third party from the commands in
  `README.md` and `paper/smart-road-guardian.md` Appendix A.
