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

## Module -> Folder Map

| Module                              | Folder                          |
|--------------------------------------|----------------------------------|
| Transportation Perception Engine     | `ai/perception/`                 |
| Driver Intelligence Engine           | `ai/driver_intelligence/`        |
| Road Intelligence Engine             | `ai/road_intelligence/`          |
| Traffic Intelligence Engine          | `ai/traffic_intelligence/`       |
| Transportation Risk Intelligence Engine (TRIE) | `ai/trie/`              |
| Temporal Prediction Engine           | `ai/temporal_prediction/`        |
| Causal Intelligence Engine           | `ai/causal_intelligence/`        |
| Explainable AI Engine                | `ai/explainable_ai/`             |
| Shared types (DriverState, etc.)     | `ai/common/`                     |
| End-to-end orchestration             | `ai/pipeline.py`                 |
| API / persistence / websockets       | `backend/`                       |
| Dashboard, alerts, reports UI        | `frontend/`                      |
| Jetson / TensorRT / ONNX deployment  | `edge/`                          |

## Technology Stack

- **AI**: Python, PyTorch, YOLOv11, Vision Transformers, OpenCV, MediaPipe, LSTM, Transformers, SHAP
- **Backend**: FastAPI, PostgreSQL, SQLAlchemy, WebSockets
- **Frontend**: Next.js, React, TailwindCSS, TypeScript, Framer Motion
- **Edge**: NVIDIA Jetson Nano/Orin Nano, TensorRT, ONNX Runtime, Docker

## Status

Every module below is currently a **stub**: real interfaces and data shapes
exist and are wired together end-to-end via `ai/pipeline.py` and the FastAPI
backend, but detection/inference logic returns deterministic mock data
instead of running real models. Replace one engine at a time, keeping the
`ai/common/types.py` contracts stable so the rest of the pipeline keeps
working.
