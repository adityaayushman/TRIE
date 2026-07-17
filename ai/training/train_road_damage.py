"""Fine-tune YOLOv11 for road damage on RDD2022's Indian split.

    python -m ai.training.train_road_damage --prepare   # unzip -> YOLO format
    python -m ai.training.train_road_damage --train     # fine-tune
    python -m ai.training.train_road_damage --evaluate  # mAP on the val split

This is what turns `ai/road_intelligence/` from classical CV — which its own
docstring admits "has not been benchmarked against any labelled road-damage
dataset" and "will confuse a strong shadow for a pothole" — into a detector
with a number attached.

The output is a real accuracy claim on Indian roads: mAP50 and mAP50-95 per
class, measured on a held-out split of Indian images. COCO-pretrained weights
have no pothole class at all, so this is not a tuning exercise; it is the
difference between guessing and detecting.
"""
from __future__ import annotations

import argparse
import json
import shutil
import zipfile
from pathlib import Path

from ai.training.rdd2022 import CLASS_NAMES, convert, write_data_yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASETS = REPO_ROOT / "datasets"
ARCHIVE = DATASETS / "RDD2022.zip"
EXTRACTED = DATASETS / "RDD2022"
PREPARED = DATASETS / "rdd2022_india_yolo"
RUNS = REPO_ROOT / "runs"

# yolo11s over yolo11n: the nano model is tuned for latency on constrained
# hardware, and road cracks are thin, low-contrast, and small in frame —
# exactly what capacity buys. Still comfortable on a 6GB card.
DEFAULT_MODEL = "yolo11s.pt"
DEFAULT_EPOCHS = 60
DEFAULT_IMAGE_SIZE = 640
# 16 fits 6GB at 640px for yolo11s; Ultralytics OOMs loudly rather than
# silently degrading, so this is a starting point to lower if needed.
DEFAULT_BATCH = 16
# Each dataloader worker is a full `spawn`-ed Python process that re-imports
# torch — on Windows that means reloading torch's CUDA DLLs (cufft, cublas,
# ...) per worker, not just per GPU. Confirmed on this machine in order:
# workers=8 (Ultralytics' own default) crashed with `WinError 1455: the
# paging file is too small` after leaving 13+ orphaned processes and dropping
# free RAM from 8GB to 1.8GB; workers=4 did not crash but hung, silently
# accumulating 12 processes with zero training progress -- a retry loop
# hitting the same underlying spawn cost, worse than an outright failure
# because nothing in the log said so. workers=0 removes the risk class
# entirely: data loading runs in the main process, no subprocess spawned at
# all. Slower per epoch (no I/O/GPU overlap) on ~7,700 small images already
# disk-cached, and correct, which an unattended multi-hour run needs more.
DEFAULT_WORKERS = 0


def _extract_country(country: str) -> Path:
    """Extract one country's images from the 13.3GB archive.

    RDD2022.zip is not a flat tree: it is seven *nested* per-country zips
    (`RDD2022/India.zip`, `RDD2022/Norway.zip`, ...), the largest of which
    (Norway) is 10.6GB alone. Extracting the outer archive naively would pull
    every country to disk to reach one; this reads only the one nested zip
    needed, then extracts only that.
    """
    if (EXTRACTED / country).is_dir():
        return EXTRACTED

    if not ARCHIVE.exists():
        raise SystemExit(
            f"{ARCHIVE} not found. Download it first:\n"
            f"  curl -L https://ndownloader.figshare.com/files/38030910 -o {ARCHIVE}"
        )

    inner_name = f"RDD2022/{country}.zip"
    with zipfile.ZipFile(ARCHIVE) as archive:
        if inner_name not in archive.namelist():
            available = sorted(
                n.removeprefix("RDD2022/").removesuffix(".zip")
                for n in archive.namelist()
                if n.startswith("RDD2022/") and n.endswith(".zip")
            )
            raise SystemExit(f"No {inner_name} in the archive. Available: {available}")

        size_mb = archive.getinfo(inner_name).file_size / 1e6
        print(f"extracting {inner_name} ({size_mb:.0f} MB) from the archive...")
        nested_path = DATASETS / f"{country}.zip"
        # Streamed, not read() in one shot: correct for India (527MB) either
        # way, but this same path also serves Norway's nested zip (10.6GB),
        # where loading it whole would be a needless memory spike.
        with archive.open(inner_name) as nested_bytes, open(nested_path, "wb") as out:
            shutil.copyfileobj(nested_bytes, out)

    print(f"extracting {nested_path} -> {EXTRACTED}...")
    with zipfile.ZipFile(nested_path) as nested:
        nested.extractall(EXTRACTED)
    nested_path.unlink()  # the copy inside DATASETS/, not the 13.3GB original

    return EXTRACTED


def prepare(country: str = "India") -> None:
    """Extract one country from RDD2022 if needed, then convert to YOLO format."""
    root = _extract_country(country)

    print(f"converting {country} -> {PREPARED}")
    report = convert(root, PREPARED, country=country)
    data_yaml = write_data_yaml(PREPARED)

    print(f"\n  images written          {report.images_written}")
    print(f"  labels written          {report.labels_written}")
    print(f"  boxes written           {report.boxes_written}")
    print(f"  images without XML      {report.images_without_annotation} (excluded)")
    print(f"  boxes dropped (unknown) {report.boxes_dropped_unknown_class}")
    print(f"  boxes dropped (degenerate) {report.boxes_dropped_degenerate}")
    print("\n  class distribution:")
    for name, count in report.class_counts.items():
        print(f"    {name:<22} {count:>6}")
    print(f"\n  data.yaml -> {data_yaml}")


def train(
    model_path: str = DEFAULT_MODEL,
    epochs: int = DEFAULT_EPOCHS,
    image_size: int = DEFAULT_IMAGE_SIZE,
    batch: int = DEFAULT_BATCH,
    workers: int = DEFAULT_WORKERS,
) -> None:
    from ultralytics import YOLO

    data_yaml = PREPARED / "data.yaml"
    if not data_yaml.exists():
        raise SystemExit(f"{data_yaml} not found — run --prepare first.")

    model = YOLO(model_path)
    model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=image_size,
        batch=batch,
        workers=workers,
        project=str(RUNS),
        name="road_damage_india",
        exist_ok=True,
        # Road damage is viewpoint-locked (a forward dashcam), so vertical
        # flips would teach the model an orientation that never occurs.
        # Horizontal flips are legitimate: a crack is not chiral.
        flipud=0.0,
        fliplr=0.5,
        patience=15,
    )
    print(f"\nweights -> {RUNS / 'road_damage_india' / 'weights' / 'best.pt'}")


def evaluate(weights: Path | None = None) -> dict:
    """Report mAP per class on the held-out Indian split."""
    from ultralytics import YOLO

    weights = weights or RUNS / "road_damage_india" / "weights" / "best.pt"
    if not Path(weights).exists():
        raise SystemExit(f"{weights} not found — run --train first.")

    metrics = YOLO(str(weights)).val(data=str(PREPARED / "data.yaml"))

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

    output = RUNS / "road_damage_india" / "evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"\nsaved -> {output}")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai.training.train_road_damage", description=__doc__)
    parser.add_argument("--prepare", action="store_true", help="unzip + convert to YOLO format")
    parser.add_argument("--train", action="store_true", help="fine-tune YOLOv11")
    parser.add_argument("--evaluate", action="store_true", help="mAP on the val split")
    parser.add_argument("--country", default="India")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH)
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help="dataloader worker processes (see DEFAULT_WORKERS docstring re: Windows pagefile)",
    )
    parser.add_argument("--imgsz", type=int, default=DEFAULT_IMAGE_SIZE)
    args = parser.parse_args(argv)

    if not (args.prepare or args.train or args.evaluate):
        parser.print_help()
        return 1

    if args.prepare:
        prepare(country=args.country)
    if args.train:
        train(
            model_path=args.model,
            epochs=args.epochs,
            image_size=args.imgsz,
            batch=args.batch,
            workers=args.workers,
        )
    if args.evaluate:
        evaluate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
