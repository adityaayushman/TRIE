"""Tests for the `python -m ai.cli` entry point."""
from __future__ import annotations

import json

import numpy as np
import pytest

from ai.cli import main

from tests.fakes import fake_pipeline

try:
    import cv2
except ImportError:  # pragma: no cover - depends on the environment
    cv2 = None

# --demo needs no OpenCV, so those tests must run without it.
requires_opencv = pytest.mark.skipif(cv2 is None, reason="OpenCV is not installed")


@pytest.fixture
def video(tmp_path):
    if cv2 is None:
        pytest.skip("OpenCV is not installed")
    path = tmp_path / "clip.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0, (64, 48))
    assert writer.isOpened(), "OpenCV could not open an mp4 writer"
    for _ in range(4):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()
    return str(path)


def test_demo_runs_without_a_camera_or_video(capsys):
    assert main(["--demo", "--max-frames", "3"], pipeline=fake_pipeline()) == 0
    assert len(capsys.readouterr().out.strip().splitlines()) == 3


def test_demo_terminates_on_its_own(capsys):
    """--demo is an endless source; a bare --demo must still stop rather than
    stream forever."""
    assert main(["--demo"], pipeline=fake_pipeline()) == 0
    assert len(capsys.readouterr().out.strip().splitlines()) == 30


def test_json_output_is_machine_readable(capsys):
    main(["--demo", "--speed", "95", "--max-frames", "1", "--json"], pipeline=fake_pipeline())

    [line] = capsys.readouterr().out.strip().splitlines()
    payload = json.loads(line)
    assert payload["risk_level"] in {"low", "moderate", "high", "critical"}
    assert 0 <= payload["risk_score"] <= 100
    assert payload["recommended_actions"]


def test_stride_is_applied(capsys):
    main(["--demo", "--stride", "4", "--max-frames", "3", "--json"], pipeline=fake_pipeline())

    indices = [json.loads(line)["frame_index"] for line in capsys.readouterr().out.splitlines()]
    assert indices == [0, 4, 8]


def test_speed_reaches_the_risk_score(capsys):
    """Telemetry passed on the command line must actually affect the output."""
    main(["--demo", "--speed", "0", "--max-frames", "1", "--json"], pipeline=fake_pipeline())
    slow = json.loads(capsys.readouterr().out)

    main(["--demo", "--speed", "110", "--max-frames", "1", "--json"], pipeline=fake_pipeline())
    fast = json.loads(capsys.readouterr().out)

    assert fast["risk_score"] > slow["risk_score"]


def test_video_files_drive_the_pipeline(capsys, video):
    assert main(["--road-video", video, "--cabin-video", video, "--speed", "95"], pipeline=fake_pipeline()) == 0
    assert len(capsys.readouterr().out.strip().splitlines()) == 4


def test_missing_source_explains_the_options():
    with pytest.raises(SystemExit, match="No road source given"):
        main(["--speed", "90"], pipeline=fake_pipeline())


def test_missing_cabin_source_is_reported(video):
    """Uses a video file rather than --road-camera: a test must not depend on
    (or switch on) real camera hardware."""
    with pytest.raises(SystemExit, match="No cabin source given"):
        main(["--road-video", video], pipeline=fake_pipeline())


def test_missing_video_file_reports_cleanly(capsys):
    assert main(["--road-video", "nope.mp4", "--cabin-video", "nope.mp4"], pipeline=fake_pipeline()) == 1
    assert "nope.mp4" in capsys.readouterr().err


def test_video_and_camera_are_mutually_exclusive():
    with pytest.raises(SystemExit):
        main(["--road-video", "a.mp4", "--road-camera", "0", "--demo"], pipeline=fake_pipeline())
