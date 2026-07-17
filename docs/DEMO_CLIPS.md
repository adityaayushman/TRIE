# Vehicle/Traffic Intelligence demo clips

The Vehicle Intelligence and Traffic Analytics pages run the real
`ai.perception.PerceptionEngine` (YOLOv11) and `ai.traffic_intelligence.
TrafficIntelligenceEngine` against recorded street footage, since the
deployed API has no live camera. The clips are real, licensed stock footage,
not synthetic or generated video.

| File | Source | License |
|---|---|---|
| `clip1.mp4` | Pexels — "Autowala" (video 27876732) | Pexels License — free to use, no attribution required |
| `clip2.mp4` | Pexels — "Kolkata Street Traffic with Rickshaws and Taxis" (video 32665220) | Pexels License — free to use, no attribution required |
| `clip3.mp4` | Pexels — "Busy Street India" (video 27000602) | Pexels License — free to use, no attribution required |

Each clip was trimmed to ~10-12s, downscaled to 960px width, and stripped of
audio with ffmpeg before processing — the reduction is presentation-only
(file size, load time); detection runs on the same footage either way.

Regenerate the detection JSON and copy of the clips with:

```
python -m ai.demo.build_traffic_demo
```

which reads from `ai/demo/source_clips/` (not committed — see the script) and
writes to `backend/static/demo/vehicle-intelligence/`, served by the FastAPI
app's `/demo` static mount.
