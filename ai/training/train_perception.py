"""Fine-tune YOLOv11 road-user perception on the India Driving Dataset (IDD).

    python -m ai.training.train_perception --prepare     # write an absolute-path data.yaml
    python -m ai.training.train_perception --train       # fine-tune
    python -m ai.training.train_perception --resume      # continue from last.pt
    python -m ai.training.train_perception --evaluate    # mAP on the val split

This closes the honest gap named on /research and in the README: general
road-user detection was COCO-pretrained — a Western, car-dominated distribution
with **no class for an auto-rickshaw**, no separate "rider", no cattle. IDD is
Indian dashcam footage annotated for exactly those: 15 classes including
`autorickshaw`, `rider`, `animal` and `vehicle fallback`. Fine-tuning here is
what lets the perception layer *see* the Indian road, not approximate it.

Data: the YOLO-format IDD-Detection redistribution
(`redzapdos123/indian-driving-dataset-detections-yolov11` on Kaggle), extracted
to `--data-dir` (default D:/tmp/idd/IDDDetectionsYOLODataset). Its shipped
data.yaml uses a relative `path:`; `--prepare` rewrites an absolute one so
Ultralytics resolves the splits regardless of cwd.

Same hard-won Windows config as train_helmet/train_road_damage: workers=0,
because each dataloader worker here is a full spawn()-ed process reloading
torch's CUDA DLLs and the pagefile cannot take it. Real mAP lands in
runs/perception_idd/evaluation.json — a measured number, not a claim.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNS = REPO_ROOT / "runs"
RUN_NAME = "perception_idd"

# The IDD detection taxonomy (data.yaml order). The ids matter: the fine-tuned
# model emits THESE, so ai/perception/engine.py maps them (not COCO) when the
# IDD weights are loaded.
CLASS_NAMES = [
    "animal", "autorickshaw", "bicycle", "bus", "car", "caravan", "motorcycle",
    "person", "rider", "traffic light", "traffic sign", "trailer", "train",
    "truck", "vehicle fallback",
]

DEFAULT_DATA_DIR = Path("D:/tmp/idd/IDDDetectionsYOLODataset")
DEFAULT_MODEL = "yolo11s.pt"
DEFAULT_EPOCHS = 40
DEFAULT_BATCH = 12
DEFAULT_IMAGE_SIZE = 640
DEFAULT_WORKERS = 0


def _data_yaml(data_dir: Path) -> Path:
    return RUNS / RUN_NAME / "data.yaml"


def prepare(data_dir: Path) -> Path:
    """Write an absolute-path data.yaml so training is cwd-independent."""
    data_dir = data_dir.resolve()
    if not (data_dir / "train" / "images").exists():
        raise SystemExit(
            f"{data_dir}/train/images not found — extract the Kaggle dataset first "
            f"(kaggle datasets download -d redzapdos123/indian-driving-dataset-detections-yolov11)."
        )
    out = _data_yaml(data_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"path: {data_dir.as_posix()}",
        "train: train/images",
        "val: val/images",
        "test: test/images",
        f"nc: {len(CLASS_NAMES)}",
        "names:",
        *[f"  - {name}" for name in CLASS_NAMES],
    ]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out}\n  path: {data_dir.as_posix()}\n  classes: {len(CLASS_NAMES)}")
    return out


def train(data_dir=DEFAULT_DATA_DIR, model_path=DEFAULT_MODEL, epochs=DEFAULT_EPOCHS,
          batch=DEFAULT_BATCH, image_size=DEFAULT_IMAGE_SIZE, workers=DEFAULT_WORKERS) -> None:
    from ultralytics import YOLO

    data_yaml = _data_yaml(Path(data_dir))
    if not data_yaml.exists():
        data_yaml = prepare(Path(data_dir))

    YOLO(model_path).train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=image_size,
        batch=batch,
        workers=workers,
        project=str(RUNS),
        name=RUN_NAME,
        exist_ok=True,
        # Dashcam viewpoint is upright; a horizontal flip is legitimate augmentation
        # (Indian traffic is left-hand, but a mirrored road user is still valid),
        # a vertical one is not.
        flipud=0.0,
        fliplr=0.5,
        patience=12,
    )
    print(f"\nweights -> {RUNS / RUN_NAME / 'weights' / 'best.pt'}")


def resume() -> None:
    from ultralytics import YOLO

    last = RUNS / RUN_NAME / "weights" / "last.pt"
    if not last.exists():
        raise SystemExit(f"{last} not found — nothing to resume; run --train first.")
    YOLO(str(last)).train(resume=True)
    print(f"\nweights -> {RUNS / RUN_NAME / 'weights' / 'best.pt'}")


def evaluate(weights: Path | None = None, data_dir=DEFAULT_DATA_DIR) -> dict:
    from ultralytics import YOLO

    weights = weights or RUNS / RUN_NAME / "weights" / "best.pt"
    if not Path(weights).exists():
        raise SystemExit(f"{weights} not found — run --train first.")
    data_yaml = _data_yaml(Path(data_dir))

    metrics = YOLO(str(weights)).val(data=str(data_yaml), workers=0)
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
    parser = argparse.ArgumentParser(prog="python -m ai.training.train_perception", description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH)
    args = parser.parse_args(argv)

    if args.prepare:
        prepare(args.data_dir)
    elif args.resume:
        resume()
    elif args.evaluate:
        evaluate(data_dir=args.data_dir)
    elif args.train:
        train(data_dir=args.data_dir, model_path=args.model, epochs=args.epochs, batch=args.batch)
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
