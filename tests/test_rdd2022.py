"""Tests for the RDD2022 -> YOLO converter.

Built against synthetic VOC XML rather than the real 13GB archive, so the
conversion is verified before a long download rather than after it. The
format is the contract: a coordinate bug here silently trains a model on
wrong boxes and shows up only as unexplained low mAP.
"""
from __future__ import annotations

import pytest

from ai.training.rdd2022 import (
    CLASS_NAMES,
    CLASS_TO_ROADSTATE,
    RDD_CLASSES,
    convert,
    write_data_yaml,
)

VOC_TEMPLATE = """<annotation>
  <size><width>{width}</width><height>{height}</height><depth>3</depth></size>
  {objects}
</annotation>"""

OBJECT_TEMPLATE = """<object>
    <name>{name}</name>
    <bndbox><xmin>{x1}</xmin><ymin>{y1}</ymin><xmax>{x2}</xmax><ymax>{y2}</ymax></bndbox>
  </object>"""


def write_sample(root, stem, objects, width=1000, height=600, with_xml=True):
    """Create one image + optional VOC XML in RDD2022's own layout."""
    images = root / "India" / "train" / "images"
    xmls = root / "India" / "train" / "annotations" / "xmls"
    images.mkdir(parents=True, exist_ok=True)
    xmls.mkdir(parents=True, exist_ok=True)

    # Content is irrelevant: the converter copies bytes and never decodes.
    (images / f"{stem}.jpg").write_bytes(b"\xff\xd8\xff\xe0 not-a-real-jpeg")

    if with_xml:
        body = "\n  ".join(
            OBJECT_TEMPLATE.format(name=n, x1=a, y1=b, x2=c, y2=d) for n, a, b, c, d in objects
        )
        (xmls / f"{stem}.xml").write_text(
            VOC_TEMPLATE.format(width=width, height=height, objects=body), encoding="utf-8"
        )


class TestCoordinateConversion:
    def test_a_voc_box_becomes_normalised_yolo_centre_form(self, tmp_path):
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        # x 200..400 of 1000 -> centre 300 (0.3), width 200 (0.2)
        # y 150..450 of 600  -> centre 300 (0.5), height 300 (0.5)
        write_sample(source, "India_000000", [("D40", 200, 150, 400, 450)])

        convert(source, out, val_fraction=0.0)

        label = (out / "labels" / "train" / "India_000000.txt").read_text().strip()
        class_id, cx, cy, w, h = label.split()
        assert int(class_id) == RDD_CLASSES["D40"]
        assert float(cx) == pytest.approx(0.3)
        assert float(cy) == pytest.approx(0.5)
        assert float(w) == pytest.approx(0.2)
        assert float(h) == pytest.approx(0.5)

    def test_every_coordinate_lands_inside_the_unit_square(self, tmp_path):
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D00", 0, 0, 1000, 600)])

        convert(source, out, val_fraction=0.0)

        values = [float(v) for v in (out / "labels" / "train" / "India_000000.txt").read_text().split()[1:]]
        assert all(0.0 <= v <= 1.0 for v in values)

    def test_a_box_beyond_the_stated_bounds_is_clamped_not_dropped(self, tmp_path):
        """A few RDD boxes exceed their image bounds; a >1.0 coordinate would
        corrupt training silently rather than raising."""
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D40", 900, 500, 1200, 800)])

        report = convert(source, out, val_fraction=0.0)

        assert report.boxes_written == 1
        values = [float(v) for v in (out / "labels" / "train" / "India_000000.txt").read_text().split()[1:]]
        assert all(0.0 <= v <= 1.0 for v in values)


class TestFiltering:
    def test_classes_outside_the_taxonomy_are_dropped_and_counted(self, tmp_path):
        """RDD2022 carries D01/D11/D43/D44 in some national subsets; they are
        not consistently annotated, so they are dropped rather than guessed."""
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D40", 10, 10, 50, 50), ("D43", 60, 60, 90, 90)])

        report = convert(source, out, val_fraction=0.0)

        assert report.boxes_written == 1
        assert report.boxes_dropped_unknown_class == 1

    def test_a_degenerate_box_is_dropped(self, tmp_path):
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D40", 100, 100, 100, 200)])  # zero width

        report = convert(source, out, val_fraction=0.0)

        assert report.boxes_written == 0
        assert report.boxes_dropped_degenerate == 1

    def test_an_image_with_no_xml_is_excluded_not_treated_as_empty_road(self, tmp_path):
        """~20% of RDD2022's India images have no annotation. Training on them
        as negatives would teach the model that visible damage is background."""
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D40", 10, 10, 50, 50)])
        write_sample(source, "India_000001", [], with_xml=False)

        report = convert(source, out, val_fraction=0.0)

        assert report.images_written == 1
        assert report.images_without_annotation == 1
        assert not (out / "images" / "train" / "India_000001.jpg").exists()

    def test_an_annotated_image_with_no_valid_boxes_becomes_a_true_negative(self, tmp_path):
        """An empty label file is a legitimate signal: road, no damage."""
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        write_sample(source, "India_000000", [("D99", 10, 10, 50, 50)])

        report = convert(source, out, val_fraction=0.0)

        assert report.images_written == 1
        assert (out / "labels" / "train" / "India_000000.txt").read_text() == ""


class TestSplitting:
    def test_the_val_split_gets_roughly_its_fraction(self, tmp_path):
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        for i in range(100):
            write_sample(source, f"India_{i:06d}", [("D40", 10, 10, 50, 50)])

        convert(source, out, val_fraction=0.2)

        assert len(list((out / "images" / "train").glob("*.jpg"))) == 80
        assert len(list((out / "images" / "val").glob("*.jpg"))) == 20

    def test_splitting_is_deterministic_for_a_seed(self, tmp_path):
        source = tmp_path / "rdd"
        for i in range(50):
            write_sample(source, f"India_{i:06d}", [("D40", 10, 10, 50, 50)])

        def val_names(out):
            convert(source, out, val_fraction=0.2, seed=7)
            return sorted(p.name for p in (out / "images" / "val").glob("*.jpg"))

        assert val_names(tmp_path / "a") == val_names(tmp_path / "b")

    def test_every_image_gets_a_label_file(self, tmp_path):
        """A missing label is read by YOLO as an unlabelled image, not an
        error — so the counts must match exactly."""
        source, out = tmp_path / "rdd", tmp_path / "yolo"
        for i in range(20):
            write_sample(source, f"India_{i:06d}", [("D40", 10, 10, 50, 50)])

        report = convert(source, out, val_fraction=0.25)

        assert report.images_written == report.labels_written == 20
        for split in ("train", "val"):
            images = {p.stem for p in (out / "images" / split).glob("*.jpg")}
            labels = {p.stem for p in (out / "labels" / split).glob("*.txt")}
            assert images == labels


class TestTaxonomy:
    def test_only_pothole_maps_to_potholes(self, tmp_path):
        """RoadState distinguishes potholes from cracks because that is what
        risk fusion acts on; the three crack types collapse."""
        assert CLASS_TO_ROADSTATE[RDD_CLASSES["D40"]] == "potholes"
        for crack in ("D00", "D10", "D20"):
            assert CLASS_TO_ROADSTATE[RDD_CLASSES[crack]] == "cracks"

    def test_every_class_has_a_roadstate_mapping(self):
        assert set(CLASS_TO_ROADSTATE) == set(range(len(CLASS_NAMES)))


class TestDataYaml:
    def test_names_are_indexed_in_class_id_order(self, tmp_path):
        """A mismatch between data.yaml order and the converter's class ids
        would train correct boxes onto wrong labels."""
        written = write_data_yaml(tmp_path).read_text()
        for index, name in enumerate(CLASS_NAMES):
            assert f"  {index}: {name}" in written

    def test_it_points_at_the_split_directories(self, tmp_path):
        written = write_data_yaml(tmp_path).read_text()
        assert "train: images/train" in written
        assert "val: images/val" in written


def test_missing_source_fails_loudly(tmp_path):
    with pytest.raises(FileNotFoundError):
        convert(tmp_path / "nope", tmp_path / "out")
