# Smart Road Guardian AI X — Architecture Reference

> **Predict. Explain. Prevent.**
>
> An Explainable Multimodal Edge AI Transportation Intelligence Platform for
> Real-Time Accident Prevention and Causal Risk Analysis.

This document is the source-of-truth spec that the scaffold in this repo
implements as stubs. See the root [README.md](../README.md) for how the
folders map to the modules below.

## Vision

Smart Road Guardian AI X transforms road safety from **reactive accident
detection** into **proactive accident prevention** by fusing driver behavior,
vehicle dynamics, road infrastructure, traffic flow, and environmental
conditions into a single causal risk-reasoning engine, deployed at the edge
on NVIDIA Jetson hardware.

## Core Innovation — Transportation Risk Intelligence Engine (TRIE)

Instead of isolated perception tasks (vehicle detection, lane detection,
driver monitoring), TRIE performs **multimodal context-aware risk fusion**:

```
Driver Distraction + High Speed + Lane Drift + Poor Road Condition + Heavy Traffic
        -> Collision Risk Increasing -> Preventive Recommendation
```

## System Architecture

```
Cameras
  -> Frame Ingestion                    (capture, timestamping, road/cabin sync)
  -> Transportation Perception Engine   (YOLOv11 + Vision Transformers)
  -> Driver Intelligence Engine         (MediaPipe + CNN)
  -> Road Intelligence Engine           (YOLO + OpenCV)
  -> Traffic Intelligence Engine
  -> Transportation Risk Intelligence Engine (Risk Fusion Framework)
  -> Temporal Prediction Engine         (LSTM + Transformers)
  -> Causal Intelligence Engine
  -> Explainable AI Recommendation Engine (SHAP + rule-based)
  -> Edge AI Deployment Layer           (TensorRT, ONNX Runtime, Docker)
  -> Dashboard + Alerts + Reports
```

Aggregated across vehicles and time, the same causal output feeds a second,
slower loop:

```
Per-vehicle causal risk (above, on the edge, in real time)
  -> Backend persistence (geo-tagged near-miss telemetry)
  -> Predictive Black-Spot Engine   (exposure-normalised spatial aggregation)
  -> Ranked road stretches + causal attribution
  -> Engineering / Enforcement / Education work orders
```

## Module -> Folder Map

| Module                              | Folder                          |
|--------------------------------------|----------------------------------|
| Frame Ingestion (cameras, video, sync) | `ai/ingestion/`                |
| Transportation Perception Engine     | `ai/perception/`                 |
| Driver Intelligence Engine           | `ai/driver_intelligence/`        |
| Road Intelligence Engine             | `ai/road_intelligence/`          |
| Traffic Intelligence Engine          | `ai/traffic_intelligence/`       |
| Transportation Risk Intelligence Engine (TRIE) | `ai/trie/`              |
| Temporal Prediction Engine           | `ai/temporal_prediction/`        |
| Causal Intelligence Engine           | `ai/causal_intelligence/`        |
| Explainable AI Engine                | `ai/explainable_ai/`             |
| Predictive Black-Spot Engine         | `ai/blackspot/`                  |
| Shared types (DriverState, etc.)     | `ai/common/`                     |
| End-to-end orchestration             | `ai/pipeline.py`                 |
| API / persistence / websockets       | `backend/`                       |
| Dashboard, alerts, reports UI        | `frontend/`                      |
| Jetson / TensorRT / ONNX deployment  | `edge/`                          |

## Two Axes of the Same Framework

TRIE and the black-spot engine are not separate products. They are one causal
framework applied along two axes:

| | `ai/trie/` | `ai/blackspot/` |
|---|---|---|
| Question | How dangerous is *this vehicle, now*? | How dangerous is *this road, for everyone*? |
| Axis | One vehicle, one instant | Many vehicles, over time |
| Runs on | Edge (Jetson), real time | Backend, batch |
| Acts on | The driver | The road authority |
| Output | Warning + recommendation | Ranked stretch + causal attribution |

The platform's stated Research Gap — *"reactive accident detection instead of
proactive prevention"* — is not only true of vehicles. It is true of
**infrastructure**, and far more starkly. India identifies black spots through
[iRAD/e-DAR](https://morth.gov.in/) only after a 500m stretch records five or
more fatal/grievous crashes, or ten deaths, in three years: a location must
kill people before it earns the label. Of ~13,795 stretches identified between
2016 and 2022, ~5,036 had been rectified.

Applying the platform's own thesis to road segments rather than only to drivers
is what `ai/blackspot/` does. It is the concrete realisation of two items the
vision already lists under Future Scope — *Fleet-Wide Predictive Safety
Analytics* and *V2I* — pulled forward into scope, and it is what makes
*Predict. Explain. Prevent.* apply to the road itself, not just to the person
driving on it.

## Designing for Indian Roads

The vision targets road safety generally; the deployment context is India,
where the problem is both larger and structurally different
([MoRTH 2024](https://morth.gov.in/): 1,77,175 deaths; two-wheeler riders 46.2%
and pedestrians 20.6% of fatalities — over two-thirds combined).

Three consequences for the architecture, none of which discard the vision:

1. **Structure-adaptive fusion, not lane-free.** Lane drift stays a TRIE factor
   — National Highways are marked and it is meaningful there. But the
   [India Driving Dataset](https://idd.insaan.iiit.ac.in/) exists precisely
   because most Indian roads lack "well-delineated infrastructure such as
   lanes". The engine should therefore *detect whether lane structure exists*
   and weight accordingly, falling back to a clearance/proximity envelope where
   it does not. Risk fusion that adapts to road structure is a stronger
   contribution than either assumption alone.
2. **Vulnerable road users are first-class.** Risk should rise because a
   vehicle is surrounded by two-wheelers and pedestrians — the two groups that
   actually die — not only because the driver blinked.
3. **Cost governs reach.** Jetson stays the reference target for the real-time
   edge loop, but an Android phone is 10–50x cheaper, and for a two-wheeler
   rider a handlebar phone is the only realistic sensor. The black-spot loop
   needs only GPS + causal telemetry, so it runs from far cheaper hardware than
   full perception does.

## Technology Stack

- **AI**: Python, PyTorch, YOLOv11, Vision Transformers, OpenCV, MediaPipe, LSTM, Transformers, SHAP
- **Backend**: FastAPI, PostgreSQL, SQLAlchemy, WebSockets
- **Frontend**: Next.js, React, TailwindCSS, TypeScript, Framer Motion
- **Edge**: NVIDIA Jetson Nano/Orin Nano, TensorRT, ONNX Runtime, Docker

## Status

**Real, running models:**
- `ai/perception/` — YOLOv11 (Ultralytics) on real frames, GPU-accelerated,
  with two-wheelers kept separate from cars. Verified: a real street image
  yields the correct bus + pedestrian detections. Weights are COCO-pretrained;
  fine-tuning on the India Driving Dataset is the accuracy upgrade.
- `ai/driver_intelligence/` — MediaPipe FaceLandmarker (Tasks API) with EAR
  blink detection, PERCLOS, and solvePnP head pose. Reports `face_detected=
  False` honestly when no driver is visible (e.g. a two-wheeler rider).
- `ai/road_intelligence/` — classical CV (`ai/road_intelligence/damage.py`):
  adaptive thresholding + contour shape for potholes/cracks (elongation via
  `minAreaRect`, so a diagonal crack isn't misjudged by its axis-aligned
  bounding box), texture-and-colour heuristics for waterlogging. Not a learned
  detector and not benchmarked against a labelled road-damage dataset — a
  genuine, responsive signal, not an accuracy claim. Validated against a real
  street photo, not only synthetic fixtures: ordinary dry pavement correctly
  reads as *not* waterlogged (an earlier threshold flagged plain grey
  sidewalk as water about as often as actual water would). The upgrade is a
  YOLOv11 fine-tuned on RDD2022 or equivalent Indian road-damage data.
- `ai/ingestion/` (frames reach the pipeline from video and cameras),
  `ai/blackspot/` (exposure-normalised aggregation, fed by GPS through the
  API), the FastAPI backend, the dashboard, and the 137-test suite.

The whole pipeline has been run end to end on a real street frame: it detected
four pedestrians, named *Vulnerable Road Users Nearby* as the primary cause,
predicted a *Pedestrian or Two-Wheeler Collision*, and flagged driver
distraction as unobserved — the India-specific design working on real input.
`ai/road_intelligence/` on the same frame reported a quality score of 0.39 and
several candidate potholes/cracks — plausible for a busy street, but classical
CV on a cluttered real photo is noisier than on a clean synthetic one, which
the module's own docstring says plainly.

**Rule-based, not learned:** TRIE fusion is a weighted formula rather than a
trained model; temporal prediction extrapolates linearly rather than via an
LSTM; causal reasoning ranks factors against a rule table rather than a causal
DAG; explainability derives importance from the additive score rather than
SHAP. All produce sensible output and are honest placeholders.

**Not started:** no model runs on any frame yet — every vision engine above is
a classical CV or pretrained-COCO baseline, not fine-tuned on Indian road data.
`ai/traffic_intelligence/` computes real metrics, but from `ai/perception/`'s
detections, which is where the accuracy ceiling actually is.

Replace one engine at a time, keeping the `ai/common/types.py` contracts stable
so the rest of the pipeline keeps working.
