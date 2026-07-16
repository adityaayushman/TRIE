"""Export a trained PyTorch model from one of the ai/*/ engines to ONNX,
the intermediate format converted to a TensorRT engine on-device (see
edge/README.md). Stub: no trained weights exist yet, so this only documents
the intended interface.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def export_to_onnx(checkpoint_path: Path, output_path: Path, input_shape: tuple[int, ...]) -> None:
    raise NotImplementedError(
        "Wire this up once a real PyTorch model (e.g. ai/perception's YOLOv11 "
        "weights) exists. Typical body: torch.load checkpoint, "
        "torch.onnx.export(model, dummy_input, output_path)."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--input-shape", type=int, nargs="+", default=[1, 3, 640, 640])
    args = parser.parse_args()

    export_to_onnx(args.checkpoint, args.output, tuple(args.input_shape))
