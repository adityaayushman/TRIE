"""Frame sources — where camera data actually enters the pipeline.

ai/pipeline.py consumes raw BGR frames but has no way to produce one; this is
that missing half. A source is a lazy iterator of timestamped frames, so an
hour of video never lands in memory at once.

OpenCV is imported only when a source that needs it is constructed, so the
synthetic source (and therefore the test suite) works on machines without it.
"""
from __future__ import annotations

import abc
import time
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from types import TracebackType

import numpy as np

DEFAULT_FPS = 30.0


class FrameSourceError(RuntimeError):
    """Raised when a camera or video file cannot be opened or read."""


@dataclass(frozen=True)
class Frame:
    """One captured image, timestamped on its own source's clock.

    `timestamp_s` is relative to the start of the stream — elapsed time into a
    video file, or time since capture began for a live camera. It is what
    ai/ingestion/sync.py aligns the road and cabin streams on, so it must be
    monotonically increasing within a source.
    """

    image: np.ndarray
    timestamp_s: float
    index: int


def _require_cv2():
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - depends on the environment
        raise FrameSourceError(
            "OpenCV is required to read video files and cameras. "
            "Install it with `pip install -r ai/requirements.txt`."
        ) from exc
    return cv2


class FrameSource(abc.ABC):
    """A stream of frames from one camera or video.

    Sources are context managers because most hold an OS handle on a device or
    file:

        with VideoFileSource("road.mp4") as source:
            for frame in source:
                ...
    """

    @property
    @abc.abstractmethod
    def fps(self) -> float:
        """Nominal frames per second, used to pace playback and size buffers."""

    @abc.abstractmethod
    def frames(self) -> Iterator[Frame]:
        """Yield frames until the stream ends. Live sources never end."""

    def close(self) -> None:
        """Release the underlying device or file handle. Idempotent."""

    def __iter__(self) -> Iterator[Frame]:
        return self.frames()

    def __enter__(self) -> "FrameSource":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()


class VideoFileSource(FrameSource):
    """Frames from a recorded video file — the source used to replay dashcam
    footage through the pipeline offline."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(f"No such video file: {self.path}")

        cv2 = _require_cv2()
        self._cv2 = cv2
        self._capture = cv2.VideoCapture(str(self.path))
        if not self._capture.isOpened():
            raise FrameSourceError(f"OpenCV could not open video file: {self.path}")

        # Some containers report 0 or NaN rather than a real frame rate.
        reported = self._capture.get(cv2.CAP_PROP_FPS)
        self._fps = float(reported) if reported and reported > 0 else DEFAULT_FPS

    @property
    def fps(self) -> float:
        return self._fps

    def frames(self) -> Iterator[Frame]:
        index = 0
        while True:
            ok, image = self._capture.read()
            if not ok:
                return

            # CAP_PROP_POS_MSEC must be read *after* read(): it reports the
            # position of the frame just decoded, so reading it first yields
            # the previous frame's timestamp and skews the whole stream by one
            # frame period. Prefer the container's timestamp over index/fps,
            # which is only correct for constant-frame-rate video.
            position_ms = self._capture.get(self._cv2.CAP_PROP_POS_MSEC)
            timestamp_s = position_ms / 1000.0 if position_ms > 0 else index / self._fps
            yield Frame(image=image, timestamp_s=timestamp_s, index=index)
            index += 1

    def close(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None


class CameraSource(FrameSource):
    """Frames from a live camera — the road- or cabin-facing feed on a vehicle.

    Timestamps come from a monotonic clock at capture time rather than from the
    driver, so they stay comparable across two independent cameras.
    """

    def __init__(
        self,
        device: int = 0,
        resolution: tuple[int, int] | None = None,
        fps: float | None = None,
    ) -> None:
        cv2 = _require_cv2()
        self._cv2 = cv2
        self.device = device
        self._capture = cv2.VideoCapture(device)
        if not self._capture.isOpened():
            raise FrameSourceError(
                f"OpenCV could not open camera device {device}. "
                "Check that it exists and is not in use by another process."
            )

        if resolution is not None:
            width, height = resolution
            self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if fps is not None:
            self._capture.set(cv2.CAP_PROP_FPS, fps)

        reported = self._capture.get(cv2.CAP_PROP_FPS)
        self._fps = float(fps or (reported if reported > 0 else DEFAULT_FPS))

    @property
    def fps(self) -> float:
        return self._fps

    def frames(self) -> Iterator[Frame]:
        index = 0
        started = time.monotonic()
        while True:
            ok, image = self._capture.read()
            if not ok:
                # A live camera returning nothing means it was unplugged or
                # claimed by another process — distinct from a file ending.
                raise FrameSourceError(f"Camera device {self.device} stopped returning frames")

            yield Frame(image=image, timestamp_s=time.monotonic() - started, index=index)
            index += 1

    def close(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None


class SyntheticFrameSource(FrameSource):
    """Deterministic generated frames, needing no camera, video, or OpenCV.

    This is what makes the ingestion path testable and demoable before any
    hardware exists. Frames are reproducible for a given seed.
    """

    def __init__(
        self,
        count: int | None = 30,
        fps: float = DEFAULT_FPS,
        size: tuple[int, int] = (480, 640),
        seed: int = 0,
        start_s: float = 0.0,
    ) -> None:
        if fps <= 0:
            raise ValueError(f"fps must be positive, got {fps}")
        self._count = count
        self._fps = fps
        self._size = size
        self._seed = seed
        self._start_s = start_s

    @property
    def fps(self) -> float:
        return self._fps

    def frames(self) -> Iterator[Frame]:
        rng = np.random.default_rng(self._seed)
        height, width = self._size
        index = 0
        while self._count is None or index < self._count:
            image = rng.integers(0, 256, size=(height, width, 3), dtype=np.uint8)
            yield Frame(
                image=image,
                timestamp_s=self._start_s + index / self._fps,
                index=index,
            )
            index += 1
