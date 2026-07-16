"""Run the risk pipeline over a real frame stream.

    python -m ai.cli --demo
    python -m ai.cli --road-video road.mp4 --cabin-video cabin.mp4 --stride 5
    python -m ai.cli --road-camera 0 --cabin-camera 1 --speed 90

This is the entry point an edge device runs; see edge/README.md.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import sys
from collections.abc import Iterator

from ai.common.types import VehicleDynamics
from ai.ingestion import (
    DEFAULT_MAX_SKEW_S,
    CameraSource,
    FrameAssessment,
    FrameSource,
    FrameSourceError,
    PipelineRunner,
    SyntheticFrameSource,
    VideoFileSource,
    synchronize,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m ai.cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    road = parser.add_mutually_exclusive_group()
    road.add_argument("--road-video", metavar="PATH", help="road-facing video file")
    road.add_argument("--road-camera", type=int, metavar="DEVICE", help="road-facing camera index")

    cabin = parser.add_mutually_exclusive_group()
    cabin.add_argument("--cabin-video", metavar="PATH", help="cabin-facing video file")
    cabin.add_argument("--cabin-camera", type=int, metavar="DEVICE", help="cabin-facing camera index")

    parser.add_argument(
        "--demo",
        action="store_true",
        help="use generated frames — needs no camera or video file",
    )
    parser.add_argument("--speed", type=float, default=0.0, metavar="KMH", help="constant vehicle speed")
    parser.add_argument(
        "--stride", type=int, default=1, metavar="N", help="assess every Nth synchronized frame"
    )
    parser.add_argument(
        "--max-frames", type=int, default=None, metavar="N", help="stop after N assessments"
    )
    parser.add_argument(
        "--max-skew",
        type=float,
        default=DEFAULT_MAX_SKEW_S,
        metavar="SECONDS",
        help="how far apart road and cabin frames may be and still pair",
    )
    parser.add_argument("--json", action="store_true", help="emit one JSON object per assessment")
    return parser


def _open_source(video: str | None, camera: int | None, demo: bool, which: str) -> FrameSource:
    if video is not None:
        return VideoFileSource(video)
    if camera is not None:
        return CameraSource(camera)
    if demo:
        return SyntheticFrameSource(count=None)
    raise SystemExit(
        f"No {which} source given. Pass --{which}-video/--{which}-camera, or --demo for generated frames."
    )


def _format(assessment: FrameAssessment, as_json: bool) -> str:
    result = assessment.result
    if as_json:
        return json.dumps(
            {
                "timestamp_s": round(assessment.timestamp_s, 3),
                "frame_index": assessment.frame_index,
                "latency_ms": round(assessment.latency_ms, 2),
                "risk_score": result.risk.risk_score,
                "risk_level": result.risk.risk_level.value,
                "primary_cause": result.causal.primary_cause,
                "predicted_event": result.causal.predicted_event,
                "recommended_actions": result.recommendation.actions,
            }
        )
    return (
        f"[{assessment.timestamp_s:7.2f}s] "
        f"risk {result.risk.risk_score:5.1f}% {result.risk.risk_level.value:<8} "
        f"cause: {result.causal.primary_cause:<20} "
        f"-> {result.causal.predicted_event:<20} "
        f"({assessment.latency_ms:.1f}ms)"
    )


def _limited(assessments: Iterator[FrameAssessment], limit: int | None) -> Iterator[FrameAssessment]:
    for count, assessment in enumerate(assessments, start=1):
        yield assessment
        if limit is not None and count >= limit:
            return


def main(argv: list[str] | None = None, pipeline=None) -> int:
    """Run the CLI. `pipeline` is injectable so tests can drive the entry point
    with model-free engines; production passes None and gets the real one."""
    args = build_parser().parse_args(argv)

    # Default --demo to a finite stream so a bare `--demo` terminates, while an
    # explicit --max-frames still governs.
    if args.demo and args.max_frames is None and not (args.road_video or args.road_camera):
        args.max_frames = 30

    with contextlib.ExitStack() as stack:
        try:
            road = stack.enter_context(
                _open_source(args.road_video, args.road_camera, args.demo, "road")
            )
            cabin = stack.enter_context(
                _open_source(args.cabin_video, args.cabin_camera, args.demo, "cabin")
            )
        except (FrameSourceError, FileNotFoundError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

        runner = PipelineRunner(
            pipeline=pipeline,
            telemetry=VehicleDynamics(speed_kmh=args.speed),
            stride=args.stride,
        )
        pairs = synchronize(road, cabin, max_skew_s=args.max_skew)

        assessed = 0
        try:
            for assessment in _limited(runner.run(pairs), args.max_frames):
                print(_format(assessment, args.json), flush=True)
                assessed += 1
        except KeyboardInterrupt:
            pass
        except FrameSourceError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

    if assessed == 0:
        print(
            "error: no frames could be paired — check that the two streams overlap in time "
            "(try raising --max-skew)",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
