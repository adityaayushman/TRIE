"""Prepare RDD2022's Indian split for YOLO fine-tuning.

RDD2022 (Arya et al., 2022) is 47,420 road images across six countries,
annotated with 55,000+ road-damage instances. **India is 9,665 images (7,706
annotated)** — real Indian road damage, which is exactly what
`ai/road_intelligence/` currently approximates with classical CV and cannot
validate against anything.

Two format gaps this bridges:

* RDD2022 ships **Pascal VOC XML** with absolute pixel corners; YOLO wants
  **normalised centre/width/height** in a `.txt` beside each image.
* RDD2022 labels damage as D00/D10/D20/D40; `ai/common/types.py` distinguishes
  only potholes from cracks, because that is the distinction
  `ai/trie/risk_fusion.py` acts on.

The four RDD classes are kept as-is for training and mapped down at inference
(see CLASS_TO_ROADSTATE): a model that can tell a longitudinal crack from an
alligator crack is strictly more informative than one trained on a collapsed
2-class target, and collapsing is free at inference while un-collapsing is
impossible.
"""
from __future__ import annotations

import random
import shutil
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass
from pathlib import Path

# RDD2022's own damage taxonomy (label_map.pbtxt in the release).
RDD_CLASSES = {
    "D00": 0,  # longitudinal crack
    "D10": 1,  # transverse crack
    "D20": 2,  # alligator crack
    "D40": 3,  # pothole
}

CLASS_NAMES = ["longitudinal_crack", "transverse_crack", "alligator_crack", "pothole"]

# How a detection maps onto ai/common/types.py RoadState. Only D40 is a
# pothole; the three crack types collapse to `cracks`, which is all risk
# fusion distinguishes today.
CLASS_TO_ROADSTATE = {
    0: "cracks",
    1: "cracks",
    2: "cracks",
    3: "potholes",
}

# Classes RDD2022 defines but does not consistently annotate across countries
# (D01/D11/D43/D44/D50 appear in some national subsets). Anything outside
# RDD_CLASSES is dropped rather than guessed at.
DEFAULT_SEED = 0
DEFAULT_VAL_FRACTION = 0.2


@dataclass(frozen=True)
class ConversionReport:
    """What actually happened, so a silent no-op cannot look like success."""

    images_written: int
    labels_written: int
    boxes_written: int
    images_without_annotation: int
    boxes_dropped_unknown_class: int
    boxes_dropped_degenerate: int
    class_counts: dict[str, int]


def _voc_boxes(xml_path: Path) -> tuple[list[tuple[int, float, float, float, float]], int, int]:
    """Parse one VOC XML into YOLO rows plus drop counts.

    Returns `(rows, unknown_class_drops, degenerate_drops)` where each row is
    `(class_id, cx, cy, w, h)` normalised to [0, 1].
    """
    root = ElementTree.parse(xml_path).getroot()
    size = root.find("size")
    width = float(size.findtext("width", "0"))
    height = float(size.findtext("height", "0"))
    if width <= 0 or height <= 0:
        return [], 0, 0

    rows: list[tuple[int, float, float, float, float]] = []
    unknown = 0
    degenerate = 0

    for obj in root.findall("object"):
        name = (obj.findtext("name") or "").strip()
        if name not in RDD_CLASSES:
            unknown += 1
            continue

        box = obj.find("bndbox")
        if box is None:
            degenerate += 1
            continue

        x1 = float(box.findtext("xmin", "0"))
        y1 = float(box.findtext("ymin", "0"))
        x2 = float(box.findtext("xmax", "0"))
        y2 = float(box.findtext("ymax", "0"))

        # Clamp to the image: a few RDD boxes exceed the stated bounds, and a
        # box outside [0,1] silently corrupts training rather than erroring.
        x1, x2 = max(0.0, min(x1, width)), max(0.0, min(x2, width))
        y1, y2 = max(0.0, min(y1, height)), max(0.0, min(y2, height))

        if x2 <= x1 or y2 <= y1:
            degenerate += 1
            continue

        rows.append(
            (
                RDD_CLASSES[name],
                ((x1 + x2) / 2) / width,
                ((y1 + y2) / 2) / height,
                (x2 - x1) / width,
                (y2 - y1) / height,
            )
        )

    return rows, unknown, degenerate


def convert(
    rdd_root: Path,
    output_root: Path,
    country: str = "India",
    val_fraction: float = DEFAULT_VAL_FRACTION,
    seed: int = DEFAULT_SEED,
) -> ConversionReport:
    """Convert one country's RDD2022 train split into a YOLO dataset.

    RDD2022's own `test/` folders carry no annotations (they were the
    challenge's held-out set), so the validation split is carved out of
    `train/` — otherwise there is nothing to compute mAP against.
    """
    source = rdd_root / country / "train"
    images_dir = source / "images"
    xml_dir = source / "annotations" / "xmls"

    if not images_dir.is_dir():
        raise FileNotFoundError(f"No images at {images_dir}")
    if not xml_dir.is_dir():
        raise FileNotFoundError(f"No annotations at {xml_dir}")

    annotated: list[tuple[Path, Path]] = []
    images_without_annotation = 0
    for image_path in sorted(images_dir.glob("*.jpg")):
        xml_path = xml_dir / f"{image_path.stem}.xml"
        if xml_path.exists():
            annotated.append((image_path, xml_path))
        else:
            # ~20% of RDD2022's India images have no XML. Training on them as
            # implicit negatives would teach the model that visible damage is
            # background, so they are excluded and counted.
            images_without_annotation += 1

    random.Random(seed).shuffle(annotated)
    split_at = int(len(annotated) * (1 - val_fraction))
    splits = {"train": annotated[:split_at], "val": annotated[split_at:]}

    report = ConversionReport(0, 0, 0, images_without_annotation, 0, 0, {})
    images_written = labels_written = boxes_written = 0
    unknown_total = degenerate_total = 0
    class_counts = {name: 0 for name in CLASS_NAMES}

    for split, pairs in splits.items():
        (output_root / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_root / "labels" / split).mkdir(parents=True, exist_ok=True)

        for image_path, xml_path in pairs:
            rows, unknown, degenerate = _voc_boxes(xml_path)
            unknown_total += unknown
            degenerate_total += degenerate

            shutil.copy2(image_path, output_root / "images" / split / image_path.name)
            images_written += 1

            label_path = output_root / "labels" / split / f"{image_path.stem}.txt"
            # An image whose boxes all dropped still gets an empty label file:
            # YOLO reads that as a true negative (road with no damage), which
            # is a legitimate and useful training signal.
            label_path.write_text(
                "\n".join(f"{c} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for c, cx, cy, w, h in rows),
                encoding="utf-8",
            )
            labels_written += 1
            boxes_written += len(rows)
            for class_id, *_ in rows:
                class_counts[CLASS_NAMES[class_id]] += 1

    return ConversionReport(
        images_written=images_written,
        labels_written=labels_written,
        boxes_written=boxes_written,
        images_without_annotation=images_without_annotation,
        boxes_dropped_unknown_class=unknown_total,
        boxes_dropped_degenerate=degenerate_total,
        class_counts=class_counts,
    )


def write_data_yaml(output_root: Path) -> Path:
    """The dataset descriptor Ultralytics trains against."""
    path = output_root / "data.yaml"
    names = "\n".join(f"  {i}: {name}" for i, name in enumerate(CLASS_NAMES))
    path.write_text(
        f"# RDD2022 India split, converted by ai/training/rdd2022.py\n"
        f"path: {output_root.resolve().as_posix()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"names:\n{names}\n",
        encoding="utf-8",
    )
    return path
