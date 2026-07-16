"""Regression tests for the real YOLOv11 perception engine.

Everywhere else in the suite, PerceptionEngine is faked (tests/fakes.py) so
the pipeline/API tests stay fast and offline. These tests exercise the actual
model: skipped entirely if torch/ultralytics aren't installed, and downloading
weights + a sample image on first run if they are. Marked `model` so CI's
default fast job excludes them; run explicitly with `pytest -m model`.
"""
from __future__ import annotations

from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
import pytest

torch = pytest.importorskip("torch", reason="perception needs the torch/ultralytics stack")
pytest.importorskip("ultralytics", reason="perception needs the torch/ultralytics stack")

from ai.perception.engine import PerceptionEngine  # noqa: E402

pytestmark = pytest.mark.model


@pytest.fixture(scope="module")
def engine():
    return PerceptionEngine(device="cpu")


@pytest.fixture(scope="module")
def street_photo(tmp_path_factory):
    """A real street scene: one bus, several pedestrians, per Ultralytics'
    own sample assets."""
    path = tmp_path_factory.mktemp("images") / "bus.jpg"
    try:
        urlretrieve("https://ultralytics.com/images/bus.jpg", path)
    except OSError:
        pytest.skip("no network access to fetch the validation photo")

    import cv2

    return cv2.imread(str(path))


def test_a_blank_frame_detects_nothing(engine):
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    result = engine.analyze(blank)
    assert result.vehicles == []
    assert result.two_wheelers == []
    assert result.pedestrians == []


def test_a_real_street_photo_detects_the_bus_and_pedestrians(engine, street_photo):
    """The validation that matters: not that YOLO runs, but that it produces
    the taxonomy TRIE actually depends on — vehicles and VRUs kept separate."""
    result = engine.analyze(street_photo)

    assert any(vehicle.label == "bus" for vehicle in result.vehicles)
    assert len(result.pedestrians) >= 1
    assert result.two_wheelers == []  # none in this particular photo


def test_pedestrians_count_as_vulnerable_road_users(engine, street_photo):
    result = engine.analyze(street_photo)
    assert result.vulnerable_road_users == result.pedestrians + result.two_wheelers
    assert len(result.vulnerable_road_users) == len(result.pedestrians)


def test_detections_are_normalised_to_the_frame(engine, street_photo):
    result = engine.analyze(street_photo)
    for detection in (*result.vehicles, *result.pedestrians):
        x1, y1, x2, y2 = detection.bbox
        assert 0.0 <= x1 < x2 <= 1.0
        assert 0.0 <= y1 < y2 <= 1.0
        assert 0.0 < detection.confidence <= 1.0


def test_an_empty_frame_does_not_crash(engine):
    result = engine.analyze(np.zeros((0, 0, 3), dtype=np.uint8))
    assert result.vehicles == []
