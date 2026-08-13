# Train the IDD perception model on Kaggle's free GPU

The local 6 GB laptop GPU + 16 GB RAM cannot sustain a full YOLOv11 fine-tune on
IDD's 33.6k dense images — it OOMs on the GPU at any usable batch and exhausts
host RAM during image decode. Kaggle gives a free **T4 (16 GB VRAM) + ~30 GB RAM**
where the exact same run finishes in ~2 hours with no OOM, and the dataset is
already hosted there.

## Steps

1. New Kaggle Notebook → **Settings → Accelerator → GPU T4 x2** (or P100).
2. **Add data** → search `indian-driving-dataset-detections-yolov11`
   (`redzapdos123/...`) → Add. It mounts at
   `/kaggle/input/indian-driving-dataset-detections-yolov11/IDDDetectionsYOLODataset`.
3. Paste the cells below, Run All. Download `best.pt` and `evaluation.json` from
   the output when done, then locally:
   `PerceptionEngine(model_path="best.pt")` — the engine already maps IDD classes
   by name (`ai/perception/engine.py`), so no other change is needed.

## Cell 1 — setup

```python
!pip -q install ultralytics
import yaml, os
ROOT = "/kaggle/input/indian-driving-dataset-detections-yolov11/IDDDetectionsYOLODataset"
names = ["animal","autorickshaw","bicycle","bus","car","caravan","motorcycle",
         "person","rider","traffic light","traffic sign","trailer","train",
         "truck","vehicle fallback"]
yaml.safe_dump({"path": ROOT, "train": "train/images", "val": "val/images",
                "test": "test/images", "nc": len(names), "names": names},
               open("/kaggle/working/idd.yaml", "w"))
print(open("/kaggle/working/idd.yaml").read())
```

## Cell 2 — train (full set, full resolution)

```python
from ultralytics import YOLO
# yolo11s, COCO-pretrained: Ultralytics remaps the 8 shared classes (car/bus/
# truck/bicycle/motorcycle/person/train + one) into the 15-class head by name,
# a warm start. Full 33.6k images, 640px, 40 epochs — a T4 handles batch 16.
YOLO("yolo11s.pt").train(
    data="/kaggle/working/idd.yaml",
    epochs=40, imgsz=640, batch=16, patience=12,
    project="/kaggle/working/runs", name="perception_idd",
    fliplr=0.5, flipud=0.0, exist_ok=True,
)
```

## Cell 3 — evaluate → per-class mAP

```python
import json
m = YOLO("/kaggle/working/runs/perception_idd/weights/best.pt").val(data="/kaggle/working/idd.yaml")
result = {
    "mAP50": round(float(m.box.map50), 4), "mAP50_95": round(float(m.box.map), 4),
    "precision": round(float(m.box.mp), 4), "recall": round(float(m.box.mr), 4),
    "per_class": {n: {"mAP50": round(float(m.box.ap50[i]), 4)}
                  for i, n in enumerate(names) if i < len(m.box.ap50)},
}
json.dump(result, open("/kaggle/working/evaluation.json", "w"), indent=2)
print(json.dumps(result, indent=2))
```

## When you have `best.pt` and the mAP

Send me the `evaluation.json` numbers (or drop `best.pt` into `runs/perception_idd/
weights/`) and I will: flip the honest caveat on `/research` and the README from
"COCO-pretrained baseline" to "fine-tuned on IDD, mAP X" with the per-class table,
and (optionally) re-run the demo footage through the Indian weights so the Vehicle
Intelligence overlays detect auto-rickshaws and riders.

> The local pipeline (`ai/training/train_perception.py`, weights-agnostic
> `ai/perception/engine.py`) is identical to what runs here — this is purely a
> venue with enough memory, not different code.
