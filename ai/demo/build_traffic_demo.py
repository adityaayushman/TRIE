"""Build the Vehicle/Traffic Intelligence demo data from recorded clips.

The deployed API has no camera, so there is no live feed to show on a Vehicle
or Traffic Intelligence page. There is, however, a real trained perception
pipeline (`ai.perception.PerceptionEngine`, `ai.traffic_intelligence.
TrafficIntelligenceEngine`) with nothing to point it at in production.

This script points it at real, licensed recorded traffic footage instead,
runs the real detectors frame by frame, and writes the result as JSON next to
a trimmed copy of the clip. Output goes to backend/static/demo/ — the backend
deploys via git push with no inline-payload size limit, unlike the frontend's
deploy path, and a few MB of video has no business round-tripping through
that. The frontend fetches these over HTTP from the backend and replays the
precomputed detections in sync with the video — real model output, on
recorded input, clearly labelled as such (not a live camera).

    python -m ai.demo.build_traffic_demo

See docs/DEMO_CLIPS.md for clip provenance and licensing.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

import cv2

from ai.perception.engine import PerceptionEngine
from ai.traffic_intelligence.engine import TrafficIntelligenceEngine

CLIPS_DIR = Path(__file__).resolve().parent / "source_clips"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "backend" / "static" / "demo" / "vehicle-intelligence"

# Every-3rd-frame at ~24fps output is 8 detections/sec -- fine-grained enough
# for the overlay to feel continuous without tripling CPU-only inference time.
FRAME_STRIDE = 3

CLIPS = [
    {"file": "clip1_final.mp4", "name": "clip1", "title": "Street traffic, three-wheelers and two-wheelers"},
    {"file": "clip2_final.mp4", "name": "clip2", "title": "Kolkata street, mixed rickshaw and car traffic"},
    {"file": "clip3_final.mp4", "name": "clip3", "title": "Busy Indian city street"},
]


def _detected_object_to_dict(obj) -> dict:
    return {"label": obj.label, "confidence": round(obj.confidence, 3), "bbox": [round(v, 4) for v in obj.bbox]}


def process_clip(video_path: Path, perception: PerceptionEngine, traffic: TrafficIntelligenceEngine) -> dict:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"could not open {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frames: list[dict] = []
    peak_vehicle_count = 0
    congestion_sum = 0.0

    frame_index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_index % FRAME_STRIDE == 0:
            result = perception.analyze(frame)
            traffic_state = traffic.analyze(result)
            peak_vehicle_count = max(peak_vehicle_count, traffic_state.vehicle_count)
            congestion_sum += traffic_state.congestion_level
            frames.append(
                {
                    "t": round(frame_index / fps, 3),
                    "vehicles": [_detected_object_to_dict(o) for o in result.vehicles],
                    "pedestrians": [_detected_object_to_dict(o) for o in result.pedestrians],
                    "two_wheelers": [_detected_object_to_dict(o) for o in result.two_wheelers],
                    "traffic": asdict(traffic_state),
                }
            )
        frame_index += 1

    cap.release()

    sample_count = len(frames) or 1
    return {
        "fps_source": fps,
        "frame_stride": FRAME_STRIDE,
        "duration_s": round(frame_index / fps, 2),
        "sample_count": len(frames),
        "peak_vehicle_count": peak_vehicle_count,
        "avg_congestion_level": round(congestion_sum / sample_count, 3),
        "frames": frames,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    perception = PerceptionEngine(device="cpu")
    traffic = TrafficIntelligenceEngine()

    manifest = []
    for clip in CLIPS:
        source = CLIPS_DIR / clip["file"]
        print(f"processing {source} ...")
        data = process_clip(source, perception, traffic)

        video_out = OUTPUT_DIR / f"{clip['name']}.mp4"
        video_out.write_bytes(source.read_bytes())

        json_out = OUTPUT_DIR / f"{clip['name']}.json"
        json_out.write_text(json.dumps(data), encoding="utf-8")

        manifest.append(
            {
                "name": clip["name"],
                "title": clip["title"],
                "video": f"/demo/vehicle-intelligence/{clip['name']}.mp4",
                "detections": f"/demo/vehicle-intelligence/{clip['name']}.json",
                "duration_s": data["duration_s"],
                "peak_vehicle_count": data["peak_vehicle_count"],
                "avg_congestion_level": data["avg_congestion_level"],
            }
        )
        print(
            f"  {data['sample_count']} samples, peak {data['peak_vehicle_count']} road users, "
            f"avg congestion {data['avg_congestion_level']:.2f}"
        )

    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote manifest for {len(manifest)} clips to {OUTPUT_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
