# Edge Deployment (NVIDIA Jetson)

Deploys `ai/` engines directly on Jetson Nano / Orin Nano for low-latency,
offline inference, per the Edge AI Deployment Layer in
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Pipeline

1. Train / fine-tune each engine's model (PyTorch) off-device.
2. Export to ONNX with `export_onnx.py`.
3. Convert ONNX -> TensorRT engine on the Jetson itself (TensorRT engines are
   not portable across GPU architectures, so this step must run on-device or
   on a matching architecture).
4. Swap each stub engine's inference call for the TensorRT/ONNX Runtime
   session, keeping the `ai/common/types.py` return contracts unchanged.
5. Build and run `Dockerfile.jetson`, which targets NVIDIA's L4T base image.

## Local build (on a Jetson device, with the NVIDIA Container Toolkit installed)

```bash
docker build -f edge/Dockerfile.jetson -t trie-edge .
docker run --runtime nvidia --rm -it trie-edge
```

## Status

Stub — no models have been exported or converted yet. `export_onnx.py` is a
placeholder showing the intended interface for each engine.
