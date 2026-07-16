"""Tests for the camera-to-pipeline ingestion path."""
from __future__ import annotations

import numpy as np
import pytest

from ai.common.types import VehicleDynamics

from tests.fakes import fake_pipeline
from ai.ingestion import (
    Frame,
    PipelineRunner,
    SyntheticFrameSource,
    VideoFileSource,
    synchronize,
)
from ai.ingestion.sources import FrameSourceError

try:
    import cv2
except ImportError:  # pragma: no cover - depends on the environment
    cv2 = None

# Only the video-file source needs OpenCV. The synthetic source, the
# synchronizer and the runner must stay testable without it — that is the
# reason SyntheticFrameSource exists.
requires_opencv = pytest.mark.skipif(cv2 is None, reason="OpenCV is not installed")


def frames_at(*timestamps: float) -> list[Frame]:
    """Frames carrying only a timestamp — enough to test synchronization."""
    return [
        Frame(image=np.zeros((2, 2, 3), dtype=np.uint8), timestamp_s=timestamp, index=index)
        for index, timestamp in enumerate(timestamps)
    ]


class TestSyntheticFrameSource:
    def test_yields_the_requested_number_of_frames(self):
        assert len(list(SyntheticFrameSource(count=5))) == 5

    def test_frames_are_timestamped_by_frame_rate(self):
        frames = list(SyntheticFrameSource(count=3, fps=10.0))
        assert [frame.timestamp_s for frame in frames] == pytest.approx([0.0, 0.1, 0.2])
        assert [frame.index for frame in frames] == [0, 1, 2]

    def test_frames_have_the_requested_shape(self):
        [frame] = list(SyntheticFrameSource(count=1, size=(120, 160)))
        assert frame.image.shape == (120, 160, 3)
        assert frame.image.dtype == np.uint8

    def test_same_seed_gives_identical_frames(self):
        [first] = list(SyntheticFrameSource(count=1, seed=7))
        [second] = list(SyntheticFrameSource(count=1, seed=7))
        assert np.array_equal(first.image, second.image)

    def test_count_none_is_an_endless_stream(self):
        source = SyntheticFrameSource(count=None)
        frames = [frame for _, frame in zip(range(100), source)]
        assert len(frames) == 100

    def test_rejects_a_nonpositive_frame_rate(self):
        with pytest.raises(ValueError, match="fps must be positive"):
            SyntheticFrameSource(fps=0)


class TestSynchronize:
    def test_pairs_frames_captured_together(self):
        pairs = list(synchronize(frames_at(0.0, 0.1, 0.2), frames_at(0.0, 0.1, 0.2)))

        assert len(pairs) == 3
        assert [pair.timestamp_s for pair in pairs] == pytest.approx([0.0, 0.1, 0.2])
        assert all(pair.skew_s == 0 for pair in pairs)

    def test_tolerates_jitter_within_the_skew_budget(self):
        pairs = list(synchronize(frames_at(0.0, 0.1), frames_at(0.02, 0.12), max_skew_s=0.05))

        assert len(pairs) == 2
        assert all(pair.skew_s == pytest.approx(0.02) for pair in pairs)

    def test_drops_frames_that_have_no_counterpart(self):
        """A cabin frame with no road frame near it must not be paired with a
        distant one — the pair would not be a single moment."""
        pairs = list(synchronize(frames_at(0.0, 0.5), frames_at(0.0, 0.25, 0.5), max_skew_s=0.05))

        assert [pair.timestamp_s for pair in pairs] == pytest.approx([0.0, 0.5])
        assert [pair.cabin.timestamp_s for pair in pairs] == pytest.approx([0.0, 0.5])

    def test_decimates_a_faster_stream_to_match_a_slower_one(self):
        road = list(SyntheticFrameSource(count=10, fps=30.0))
        cabin = list(SyntheticFrameSource(count=5, fps=15.0))

        pairs = list(synchronize(road, cabin, max_skew_s=0.01))

        assert len(pairs) == 5
        assert all(pair.skew_s <= 0.01 for pair in pairs)

    def test_realigns_streams_that_start_at_different_times(self):
        """A camera that starts late must not shift every pair by the offset."""
        road = frames_at(0.0, 0.1, 0.2, 0.3)
        cabin = frames_at(0.2, 0.3)

        pairs = list(synchronize(road, cabin, max_skew_s=0.01))

        assert [pair.timestamp_s for pair in pairs] == pytest.approx([0.2, 0.3])

    def test_ends_with_the_shorter_stream(self):
        assert len(list(synchronize(frames_at(0.0, 0.1, 0.2), frames_at(0.0)))) == 1

    def test_no_overlap_produces_no_pairs(self):
        assert list(synchronize(frames_at(0.0, 0.1), frames_at(9.0, 9.1))) == []

    def test_rejects_a_negative_skew_budget(self):
        with pytest.raises(ValueError, match="max_skew_s must be non-negative"):
            list(synchronize(frames_at(0.0), frames_at(0.0), max_skew_s=-1))


class TestPipelineRunner:
    def test_assesses_every_paired_frame(self):
        pairs = synchronize(SyntheticFrameSource(count=4), SyntheticFrameSource(count=4))

        assessments = list(PipelineRunner(pipeline=fake_pipeline()).run(pairs))

        assert len(assessments) == 4
        assert all(0 <= a.result.risk.risk_score <= 100 for a in assessments)

    def test_carries_the_frame_moment_onto_the_assessment(self):
        pairs = synchronize(SyntheticFrameSource(count=3, fps=10.0), SyntheticFrameSource(count=3, fps=10.0))

        assessments = list(PipelineRunner(pipeline=fake_pipeline()).run(pairs))

        assert [a.timestamp_s for a in assessments] == pytest.approx([0.0, 0.1, 0.2])
        assert [a.frame_index for a in assessments] == [0, 1, 2]

    def test_stride_assesses_every_nth_frame(self):
        pairs = synchronize(SyntheticFrameSource(count=10), SyntheticFrameSource(count=10))

        assessments = list(PipelineRunner(pipeline=fake_pipeline(), stride=3).run(pairs))

        assert [a.frame_index for a in assessments] == [0, 3, 6, 9]

    def test_records_per_frame_latency(self):
        pairs = synchronize(SyntheticFrameSource(count=1), SyntheticFrameSource(count=1))

        [assessment] = list(PipelineRunner(pipeline=fake_pipeline()).run(pairs))

        assert assessment.latency_ms > 0

    def test_constant_telemetry_reaches_the_pipeline(self):
        pairs = synchronize(SyntheticFrameSource(count=1), SyntheticFrameSource(count=1))

        [assessment] = list(PipelineRunner(pipeline=fake_pipeline(), telemetry=VehicleDynamics(speed_kmh=95)).run(pairs))

        assert assessment.result.vehicle.speed_kmh == 95

    def test_telemetry_is_sampled_per_moment(self):
        """Speed changes between frames, so the provider is called with each
        pair's timestamp rather than once up front."""
        pairs = synchronize(SyntheticFrameSource(count=3, fps=1.0), SyntheticFrameSource(count=3, fps=1.0))

        runner = PipelineRunner(pipeline=fake_pipeline(), telemetry=lambda t: VehicleDynamics(speed_kmh=t * 10))
        speeds = [a.result.vehicle.speed_kmh for a in runner.run(pairs)]

        assert speeds == pytest.approx([0.0, 10.0, 20.0])

    def test_is_lazy_so_a_live_stream_can_be_consumed_incrementally(self):
        pairs = synchronize(SyntheticFrameSource(count=None), SyntheticFrameSource(count=None))

        assessments = PipelineRunner(pipeline=fake_pipeline()).run(pairs)

        assert next(assessments).frame_index == 0
        assert next(assessments).frame_index == 1

    def test_rejects_a_stride_below_one(self):
        with pytest.raises(ValueError, match="stride must be at least 1"):
            PipelineRunner(stride=0)


@requires_opencv
class TestVideoFileSource:
    @pytest.fixture
    def video(self, tmp_path):
        """A real encoded video file, so this exercises OpenCV rather than a mock."""
        path = tmp_path / "road.mp4"
        writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0, (64, 48))
        assert writer.isOpened(), "OpenCV could not open an mp4 writer"
        for _ in range(5):
            writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
        writer.release()
        return path

    def test_reads_every_frame_of_a_real_video_file(self, video):
        with VideoFileSource(video) as source:
            frames = list(source)

        assert len(frames) == 5
        assert [frame.index for frame in frames] == [0, 1, 2, 3, 4]
        assert frames[0].image.shape == (48, 64, 3)

    def test_reports_the_frame_rate_from_the_container(self, video):
        with VideoFileSource(video) as source:
            assert source.fps == pytest.approx(10.0)

    def test_timestamps_advance_with_the_frame_rate(self, video):
        """Every frame's timestamp is checked, not just the first interval: an
        off-by-one against OpenCV's frame position skews later frames only,
        and leaves the first two correct by coincidence."""
        with VideoFileSource(video) as source:
            timestamps = [frame.timestamp_s for frame in source]

        assert timestamps == pytest.approx([0.0, 0.1, 0.2, 0.3, 0.4], abs=0.001)

    def test_timestamps_are_strictly_increasing(self, video):
        """Duplicate timestamps would silently mispair road and cabin frames."""
        with VideoFileSource(video) as source:
            timestamps = [frame.timestamp_s for frame in source]

        assert all(
            later > earlier for earlier, later in zip(timestamps, timestamps[1:])
        ), timestamps

    def test_a_video_file_drives_the_pipeline_end_to_end(self, video):
        """The whole point of the layer: a file on disk produces risk scores."""
        with VideoFileSource(video) as road, VideoFileSource(video) as cabin:
            assessments = list(
                PipelineRunner(pipeline=fake_pipeline(), telemetry=VehicleDynamics(speed_kmh=95)).run(synchronize(road, cabin))
            )

        assert len(assessments) == 5
        assert all(a.result.recommendation.actions for a in assessments)

    def test_missing_file_fails_immediately(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            VideoFileSource(tmp_path / "nope.mp4")

    def test_unreadable_file_reports_which_file(self, tmp_path):
        not_a_video = tmp_path / "broken.mp4"
        not_a_video.write_bytes(b"not video data")

        with pytest.raises(FrameSourceError, match="broken.mp4"):
            VideoFileSource(not_a_video)

    def test_close_is_idempotent(self, video):
        source = VideoFileSource(video)
        source.close()
        source.close()
