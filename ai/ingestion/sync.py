"""Aligning the road and cabin streams into single moments in time.

The pipeline reasons about one instant — "was the driver looking away *while*
the car ahead braked?" — so it needs a road frame and a cabin frame that were
captured together. Two independent cameras never deliver that for free: they
start at different times, run at different frame rates, and drift. Zipping the
two streams by position would pair frames that are seconds apart while looking
perfectly correct, which is exactly the kind of fault that produces confident
nonsense downstream.

This module pairs frames by timestamp instead, dropping frames that have no
counterpart rather than inventing one.
"""
from __future__ import annotations

from collections.abc import Iterable, Iterator
from dataclasses import dataclass

from ai.ingestion.sources import Frame

# 50ms — under two frames at 30fps. Wide enough to absorb ordinary jitter
# between two cameras, tight enough that the pair is still one moment at
# highway speed (a car at 100km/h moves ~1.4m in 50ms).
DEFAULT_MAX_SKEW_S = 0.05


@dataclass(frozen=True)
class FramePair:
    """A road frame and a cabin frame judged to be the same moment."""

    road: Frame
    cabin: Frame

    @property
    def timestamp_s(self) -> float:
        """The moment this pair represents, on the road stream's clock."""
        return self.road.timestamp_s

    @property
    def skew_s(self) -> float:
        """How far apart the two frames actually were. Always <= the tolerance
        the pair was matched under; useful for monitoring camera drift."""
        return abs(self.road.timestamp_s - self.cabin.timestamp_s)


def synchronize(
    road_frames: Iterable[Frame],
    cabin_frames: Iterable[Frame],
    max_skew_s: float = DEFAULT_MAX_SKEW_S,
) -> Iterator[FramePair]:
    """Pair road and cabin frames captured within `max_skew_s` of each other.

    Walks both streams in lockstep, advancing whichever one lags. Frames with
    no counterpart inside the tolerance are dropped: a faster stream is
    decimated to match the slower one, and the result ends when either stream
    does. Both streams must be ordered by timestamp, which every FrameSource
    guarantees.
    """
    if max_skew_s < 0:
        raise ValueError(f"max_skew_s must be non-negative, got {max_skew_s}")

    road_iter = iter(road_frames)
    cabin_iter = iter(cabin_frames)
    road = next(road_iter, None)
    cabin = next(cabin_iter, None)

    while road is not None and cabin is not None:
        skew = road.timestamp_s - cabin.timestamp_s
        if abs(skew) <= max_skew_s:
            yield FramePair(road=road, cabin=cabin)
            road = next(road_iter, None)
            cabin = next(cabin_iter, None)
        elif skew > 0:
            cabin = next(cabin_iter, None)  # cabin is behind; catch it up
        else:
            road = next(road_iter, None)
