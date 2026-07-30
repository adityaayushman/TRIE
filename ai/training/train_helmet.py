"""Fine-tune YOLOv11 for VRU vulnerability: helmet compliance + triple-riding.

    python -m ai.training.train_helmet --train      # fine-tune
    python -m ai.training.train_helmet --resume     # continue from last.pt
    python -m ai.training.train_helmet --evaluate   # mAP on the val split

This is the perception behind the *vulnerability layer*: most systems detect a
two-wheeler rider as a generic obstacle; this scores WHY that rider is
vulnerable — no helmet, or three-up on one bike — which on Indian roads is the
difference between a fall and a fatality. Classes:
`[plate, with_helmet, without_helmet, triple_riding]`, from the open Kaggle
"Traffic Violations: Triple Riding / No Helmet / Plate" set (11,195 train images).

Same hard-won config as train_road_damage: workers=0, because each dataloader
worker on this Windows box is a full spawn()-ed process reloading torch's CUDA
DLLs and the pagefile cannot take it. Real mAP is written to
runs/helmet_vru/evaluation.json — a measured number on real images, not a claim.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_YAML = REPO_ROOT / "datasets" / "helmet2" / "master_traffic_violation_dataset" / "data.yaml"
RUNS = REPO_ROOT / "runs"
RUN_NAME = "helmet_vru"

CLASS_NAMES = ["plate", "with_helmet", "without_helmet", "triple_riding"]

# yolo11s over nano: without-helmet and triple-riding are fine-grained calls a
# little extra capacity earns; still fits 6GB. Batch 12 (not 16) leaves more
# host RAM headroom than the road-damage run, which OOMed at batch 16 on 7.7k
# images — this set is larger (11k).
DEFAULT_MODEL = "yolo11s.pt"
DEFAULT_EPOCHS = 40
DEFAULT_BATCH = 12
DEFAULT_IMAGE_SIZE = 640
DEFAULT_WORKERS = 0  # see module docstring / train_road_damage for the why


def train(model_path=DEFAULT_MODEL, epochs=DEFAULT_EPOCHS, batch=DEFAULT_BATCH,
          image_size=DEFAULT_IMAGE_SIZE, workers=DEFAULT_WORKERS) -> None:
    from ultralytics import YOLO

    if not DATA_YAML.exists():
        raise SystemExit(f"{DATA_YAML} not found — download the dataset first.")

    YOLO(model_path).train(
        data=str(DATA_YAML),
        epochs=epochs,
        imgsz=image_size,
        batch=batch,
        workers=workers,
        project=str(RUNS),
        name=RUN_NAME,
        exist_ok=True,
        # Dashcam/CCTV viewpoint is upright; a helmet is not chiral, so a
        # horizontal flip is legitimate and a vertical one is not.
        flipud=0.0,
        fliplr=0.5,
        patience=12,
    )
    print(f"\nweights -> {RUNS / RUN_NAME / 'weights' / 'best.pt'}")


def resume() -> None:
    """Continue an interrupted run from its own last.pt (see train_road_damage)."""
    from ultralytics import YOLO

    last = RUNS / RUN_NAME / "weights" / "last.pt"
    if not last.exists():
        raise SystemExit(f"{last} not found — nothing to resume; run --train first.")
    YOLO(str(last)).train(resume=True)
    print(f"\nweights -> {RUNS / RUN_NAME / 'weights' / 'best.pt'}")


def evaluate(weights: Path | None = None) -> dict:
    from ultralytics import YOLO

    weights = weights or RUNS / RUN_NAME / "weights" / "best.pt"
    if not Path(weights).exists():
        raise SystemExit(f"{weights} not found — run --train first.")

    metrics = YOLO(str(weights)).val(data=str(DATA_YAML), workers=0)
    result = {
        "weights": str(weights),
        "mAP50": round(float(metrics.box.map50), 4),
        "mAP50_95": round(float(metrics.box.map), 4),
        "precision": round(float(metrics.box.mp), 4),
        "recall": round(float(metrics.box.mr), 4),
        "per_class": {
            name: {
                "mAP50": round(float(metrics.box.ap50[i]), 4),
                "mAP50_95": round(float(metrics.box.ap[i]), 4),
            }
            for i, name in enumerate(CLASS_NAMES)
            if i < len(metrics.box.ap50)
        },
    }
    out = RUNS / RUN_NAME / "evaluation.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"\nsaved -> {out}")
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.training.train_helmet", description=__doc__)
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH)
    parser.add_argument("--imgsz", type=int, default=DEFAULT_IMAGE_SIZE)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    args = parser.parse_args(argv)

    if not (args.train or args.resume or args.evaluate):
        parser.print_help()
        return 1
    if args.train:
        train(model_path=args.model, epochs=args.epochs, batch=args.batch, image_size=args.imgsz, workers=args.workers)
    if args.resume:
        resume()
    if args.evaluate:
        evaluate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
