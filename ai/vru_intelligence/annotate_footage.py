"""Annotate the Vehicle-Intelligence demo footage with helmet / triple-riding
detections and a per-scene vulnerability score.

`ai.demo.build_traffic_demo` already ran the COCO perception engine over the
recorded clips and wrote one JSON per clip (vehicles / pedestrians /
two_wheelers per frame). This is the second, VRU-specific pass: it runs the
fine-tuned helmet detector (`ai/training/train_helmet.py`, classes
plate / with_helmet / without_helmet / triple_riding) over the *same* frames at
the *same* stride, turns each frame's counts into a
`ai.vru_intelligence.vulnerability` assessment, and folds both back into the
existing clip JSONs — additively, leaving every field build_traffic_demo wrote
untouched. It also augments the manifest with each clip's peak vulnerability and
dominant factor, so the dashboard can surface "why" without re-reading frames.

    # once ai/training/train_helmet.py has produced weights:
    python -m ai.vru_intelligence.annotate_footage
    python -m ai.vru_intelligence.annotate_footage --weights runs/helmet_vru/weights/best.pt --conf 0.35

Design notes:

* Idempotent and additive. Re-running overwrites only the `riders` /
  `vulnerability` keys it owns; the base detections are never rewritten. Safe to
  run repeatedly as the detector improves.
* Vulnerability is scored per frame and the clip is summarised by its *peak*
  frame (the worst moment the camera saw), which is the number a safety operator
  acts on — not an average that dilutes a single dangerous scene.
* Boxes are stored as normalised xyxy, matching build_traffic_demo, so the
  overlay geometry is resolution-independent and shares the frontend's scaling.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai.vru_intelligence.vulnerability import assess

REPO_ROOT = Path(__file__).resolve().parents[2]
CLIPS_DIR = REPO_ROOT / "ai" / "demo" / "source_clips"
OUTPUT_DIR = REPO_ROOT / "backend" / "static" / "demo" / "vehicle-intelligence"
DEFAULT_WEIGHTS = REPO_ROOT / "runs" / "helmet_vru" / "weights" / "best.pt"

# Same clips and stride as build_traffic_demo, so frame `t` lines up exactly and
# the rider overlay replays in sync with the existing vehicle overlay.
FRAME_STRIDE = 3
CLIPS = [
    {"file": "clip1_final.mp4", "name": "clip1"},
    {"file": "clip2_final.mp4", "name": "clip2"},
    {"file": "clip3_final.mp4", "name": "clip3"},
]

# The detector's class names (lowercased in train_helmet's data.yaml). Read from
# the model at runtime too, but kept here as the canonical mapping.
HELMET_CLASS = "with_helmet"
NO_HELMET_CLASS = "without_helmet"
TRIPLE_CLASS = "triple_riding"
PLATE_CLASS = "plate"


def _rider_dict(label: str, confidence: float, bbox: tuple[float, ...]) -> dict:
    return {"label": label, "confidence": round(confidence, 3), "bbox": [round(v, 4) for v in bbox]}


def _classify(model, frame, conf: float) -> list[dict]:
    """Run the helmet detector on one frame -> a list of rider detections."""
    names = model.names  # {id: name}
    predictions = model.predict(frame, conf=conf, verbose=False)
    riders: list[dict] = []
    for prediction in predictions:
        for box in prediction.boxes:
            label = str(names[int(box.cls)]).lower()
            bounds = tuple(float(v) for v in box.xyxyn[0])
            riders.append(_rider_dict(label, float(box.conf), bounds))
    return riders


def _counts(riders: list[dict]) -> tuple[int, int, int]:
    with_helmet = sum(1 for r in riders if r["label"] == HELMET_CLASS)
    without_helmet = sum(1 for r in riders if r["label"] == NO_HELMET_CLASS)
    triple = sum(1 for r in riders if r["label"] == TRIPLE_CLASS)
    return with_helmet, without_helmet, triple


def process_clip(video_path: Path, base: dict, model, conf: float) -> dict:
    """Attach `riders` to each frame of an existing clip JSON, in frame order.

    We re-decode the video and walk it at the same stride the base JSON used, so
    the Nth sampled frame here is the Nth frame there. `t` values are taken from
    the base so the two overlays cannot drift.
    """
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"could not open {video_path}")

    base_frames = base["frames"]
    peak = {"multiplier": 1.0, "dominant_factor": "no_riders", "without_helmet": 0, "triple_riding": 0}
    totals = {"with_helmet": 0, "without_helmet": 0, "triple_riding": 0}

    frame_index = 0
    sample_index = 0
    while sample_index < len(base_frames):
        ok, frame = cap.read()
        if not ok:
            break
        if frame_index % FRAME_STRIDE == 0:
            riders = _classify(model, frame, conf)
            with_helmet, without_helmet, triple = _counts(riders)
            totals["with_helmet"] += with_helmet
            totals["without_helmet"] += without_helmet
            totals["triple_riding"] += triple

            va = assess(with_helmet, without_helmet, triple)
            base_frames[sample_index]["riders"] = riders
            base_frames[sample_index]["vulnerability"] = {
                "multiplier": va.multiplier,
                "dominant_factor": va.dominant_factor,
                "with_helmet": with_helmet,
                "without_helmet": without_helmet,
                "triple_riding": triple,
            }
            if va.multiplier > peak["multiplier"]:
                peak = {
                    "multiplier": va.multiplier,
                    "dominant_factor": va.dominant_factor,
                    "without_helmet": without_helmet,
                    "triple_riding": triple,
                }
            sample_index += 1
        frame_index += 1

    cap.release()

    base["vulnerability"] = {
        "peak_multiplier": peak["multiplier"],
        "dominant_factor": peak["dominant_factor"],
        "riders_seen": totals["with_helmet"] + totals["without_helmet"],
        "without_helmet_total": totals["without_helmet"],
        "triple_riding_total": totals["triple_riding"],
    }
    return base


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report per-clip vulnerability without writing the JSONs back",
    )
    args = parser.parse_args()

    if not args.weights.exists():
        raise SystemExit(
            f"helmet weights not found at {args.weights}. Train first with "
            f"`python -m ai.training.train_helmet`, or pass --weights."
        )

    from ultralytics import YOLO

    model = YOLO(str(args.weights))
    print(f"loaded {args.weights} — classes: {model.names}")

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_name = {entry["name"]: entry for entry in manifest}

    for clip in CLIPS:
        source = CLIPS_DIR / clip["file"]
        json_path = OUTPUT_DIR / f"{clip['name']}.json"
        if not json_path.exists():
            print(f"  skip {clip['name']}: base JSON missing — run build_traffic_demo first")
            continue

        print(f"annotating {clip['name']} ...")
        base = json.loads(json_path.read_text(encoding="utf-8"))
        data = process_clip(source, base, model, args.conf)
        v = data["vulnerability"]
        print(
            f"  peak vulnerability x{v['peak_multiplier']:.2f} ({v['dominant_factor']}), "
            f"{v['without_helmet_total']} no-helmet / {v['triple_riding_total']} triple-riding "
            f"across {v['riders_seen']} riders"
        )

        if not args.dry_run:
            json_path.write_text(json.dumps(data), encoding="utf-8")
            if clip["name"] in by_name:
                by_name[clip["name"]]["peak_vulnerability"] = v["peak_multiplier"]
                by_name[clip["name"]]["vulnerability_factor"] = v["dominant_factor"]

    if not args.dry_run:
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"updated {manifest_path}")


if __name__ == "__main__":
    main()
