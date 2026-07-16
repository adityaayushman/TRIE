"""Driver Intelligence Engine — real facial analysis via MediaPipe Face Mesh.

Established methods rather than invented ones:

* **Eye Aspect Ratio (EAR)** — Soukupová & Čech (2016), the standard geometric
  blink measure.
* **PERCLOS** — proportion of time the eyes are closed over a rolling window.
  This is the drowsiness metric validated against driving impairment and used
  in production DMS. Instantaneous eye closure cannot distinguish a blink from
  a microsleep; PERCLOS can, and that distinction is the whole point.
* **Head pose** — `cv2.solvePnP` against a canonical 3D face model, the
  conventional monocular approach.

What is honestly weak: phone detection leans on COCO's `cell phone` class,
which was not trained on cabin viewpoints; and the canonical face model is
generic rather than fitted per driver, so absolute pose angles carry a few
degrees of bias. Relative change is reliable; absolute angles are indicative.
"""
from __future__ import annotations

import time
from collections import deque

import numpy as np

from ai.common.types import DriverState

# MediaPipe Face Mesh indices. Six points per eye, ordered as EAR expects:
# outer corner, upper pair, inner corner, lower pair.
_LEFT_EYE = (33, 160, 158, 133, 153, 144)
_RIGHT_EYE = (362, 385, 387, 263, 373, 380)
_UPPER_LIP, _LOWER_LIP = 13, 14
_MOUTH_LEFT, _MOUTH_RIGHT = 78, 308

# Points paired with the canonical 3D model below, in the same order.
_POSE_LANDMARKS = (1, 152, 33, 263, 61, 291)
_FACE_MODEL_3D = np.array(
    [
        (0.0, 0.0, 0.0),          # nose tip
        (0.0, -330.0, -65.0),     # chin
        (-225.0, 170.0, -135.0),  # left eye, outer corner
        (225.0, 170.0, -135.0),   # right eye, outer corner
        (-150.0, -150.0, -125.0), # mouth, left corner
        (150.0, -150.0, -125.0),  # mouth, right corner
    ],
    dtype=np.float64,
)

EAR_CLOSED_THRESHOLD = 0.21  # below this the eye is treated as shut
MAR_YAWN_THRESHOLD = 0.6
PERCLOS_WINDOW_S = 60.0
_PHONE_CLASS_ID = 67  # COCO 'cell phone'

# Beyond this the driver is not looking at the road. Generous, because the
# canonical face model biases absolute angles.
_HEAD_OFF_ROAD_YAW_DEG = 30.0
_HEAD_OFF_ROAD_PITCH_DEG = 25.0


_FACE_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)


def _ensure_face_landmarker_bundle():
    """Fetch and cache the FaceLandmarker model bundle. Returns its path."""
    from pathlib import Path
    from urllib.request import urlretrieve

    cache_dir = Path.home() / ".cache" / "trie"
    cache_dir.mkdir(parents=True, exist_ok=True)
    bundle = cache_dir / "face_landmarker.task"
    if not bundle.exists():
        urlretrieve(_FACE_LANDMARKER_URL, bundle)
    return bundle


def _distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def eye_aspect_ratio(points: np.ndarray) -> float:
    """EAR for one eye, from its six landmarks.

    Vertical opening over horizontal width, so it is invariant to face size and
    camera distance — the property that makes a fixed threshold meaningful.
    """
    vertical = _distance(points[1], points[5]) + _distance(points[2], points[4])
    horizontal = _distance(points[0], points[3])
    if horizontal <= 0:
        return 0.0
    return vertical / (2.0 * horizontal)


class DriverIntelligenceEngine:
    """Monitors the driver from a cabin-facing frame.

    Stateful by necessity: PERCLOS and blink rate are defined over time, so the
    engine keeps a rolling history. One instance per driver — sharing one
    across vehicles would blend their eyelids into nonsense.

    Args:
        detector: An Ultralytics YOLO model for phone detection. Injected so a
            deployment can share one model with PerceptionEngine rather than
            loading a second copy onto a 6GB Jetson.
        model_path: Weights used if no detector is injected.
    """

    def __init__(
        self,
        model_path: str = "yolo11n.pt",
        detector=None,
        perclos_window_s: float = PERCLOS_WINDOW_S,
        min_face_confidence: float = 0.5,
    ) -> None:
        self.model_path = model_path
        self.perclos_window_s = perclos_window_s
        self.min_face_confidence = min_face_confidence
        self._detector = detector
        self._face_mesh = None
        self._mp = None
        # (timestamp, eyes_closed) — the PERCLOS and blink-rate window.
        self._history: deque[tuple[float, bool]] = deque()
        self._previous_closed = False
        self._blink_timestamps: deque[float] = deque()

    def _face_mesh_or_load(self):
        """Load the MediaPipe FaceLandmarker (Tasks API).

        The legacy `mp.solutions.face_mesh` was removed in recent MediaPipe
        builds; the Tasks API returns the same 478-point face topology, so the
        EAR and head-pose geometry downstream is unchanged. The model bundle is
        fetched once and cached beside the weights.
        """
        if self._face_mesh is None:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision

            model_path = _ensure_face_landmarker_bundle()
            options = vision.FaceLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
                running_mode=vision.RunningMode.IMAGE,
                num_faces=1,
                min_face_detection_confidence=self.min_face_confidence,
                min_face_presence_confidence=self.min_face_confidence,
            )
            self._mp = mp
            self._face_mesh = vision.FaceLandmarker.create_from_options(options)
        return self._face_mesh

    def _detector_or_load(self):
        if self._detector is None:
            from ultralytics import YOLO

            self._detector = YOLO(self.model_path)
        return self._detector

    def _head_pose(self, landmarks, width: int, height: int) -> tuple[float, float, float]:
        """Yaw, pitch, roll in degrees via solvePnP against the canonical model."""
        import cv2

        image_points = np.array(
            [(landmarks[i].x * width, landmarks[i].y * height) for i in _POSE_LANDMARKS],
            dtype=np.float64,
        )
        # Focal length approximated by frame width — standard when the camera
        # is uncalibrated, which on a retrofitted dashcam it always is.
        camera_matrix = np.array(
            [[width, 0, width / 2], [0, width, height / 2], [0, 0, 1]], dtype=np.float64
        )
        ok, rotation, _ = cv2.solvePnP(
            _FACE_MODEL_3D,
            image_points,
            camera_matrix,
            np.zeros((4, 1)),
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return 0.0, 0.0, 0.0

        matrix, _ = cv2.Rodrigues(rotation)
        sy = float(np.sqrt(matrix[0, 0] ** 2 + matrix[1, 0] ** 2))
        if sy > 1e-6:
            pitch = np.degrees(np.arctan2(matrix[2, 1], matrix[2, 2]))
            yaw = np.degrees(np.arctan2(-matrix[2, 0], sy))
            roll = np.degrees(np.arctan2(matrix[1, 0], matrix[0, 0]))
        else:  # gimbal lock
            pitch = np.degrees(np.arctan2(-matrix[1, 2], matrix[1, 1]))
            yaw = np.degrees(np.arctan2(-matrix[2, 0], sy))
            roll = 0.0
        return float(yaw), float(pitch), float(roll)

    def _update_history(self, timestamp_s: float, eyes_closed: bool) -> None:
        self._history.append((timestamp_s, eyes_closed))
        cutoff = timestamp_s - self.perclos_window_s
        while self._history and self._history[0][0] < cutoff:
            self._history.popleft()

        # A blink is the transition into closure, not the closed state itself —
        # otherwise a long microsleep would count as hundreds of blinks.
        if eyes_closed and not self._previous_closed:
            self._blink_timestamps.append(timestamp_s)
        self._previous_closed = eyes_closed
        while self._blink_timestamps and self._blink_timestamps[0] < cutoff:
            self._blink_timestamps.popleft()

    def _perclos(self) -> float:
        if not self._history:
            return 0.0
        return sum(1 for _, closed in self._history if closed) / len(self._history)

    def _blink_rate_per_min(self, timestamp_s: float) -> float:
        if not self._history:
            return 0.0
        span_s = timestamp_s - self._history[0][0]
        if span_s < 1.0:
            # Too short a window to extrapolate: one blink in 0.1s would imply
            # 600 blinks/min.
            return 0.0
        return len(self._blink_timestamps) * 60.0 / span_s

    def _detect_phone(self, frame: np.ndarray) -> bool:
        predictions = self._detector_or_load().predict(frame, conf=0.25, verbose=False)
        return any(
            int(box.cls) == _PHONE_CLASS_ID
            for prediction in predictions
            for box in prediction.boxes
        )

    def analyze(self, frame: np.ndarray, timestamp_s: float | None = None) -> DriverState:
        """Assess the driver from one cabin frame.

        `timestamp_s` should come from the frame's own clock so PERCLOS stays
        correct when replaying recorded video faster than real time. It falls
        back to the wall clock for live capture.
        """
        if timestamp_s is None:
            timestamp_s = time.monotonic()

        if frame is None or frame.size == 0:
            return DriverState(face_detected=False)

        import cv2

        landmarker = self._face_mesh_or_load()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        results = landmarker.detect(mp_image)
        if not results.face_landmarks:
            # No face: report it rather than guessing. See DriverState.face_detected.
            return DriverState(face_detected=False)

        landmarks = results.face_landmarks[0]
        height, width = frame.shape[:2]
        points = np.array([(mark.x * width, mark.y * height) for mark in landmarks])

        ear = (
            eye_aspect_ratio(points[list(_LEFT_EYE)])
            + eye_aspect_ratio(points[list(_RIGHT_EYE)])
        ) / 2.0
        eyes_closed = ear < EAR_CLOSED_THRESHOLD
        self._update_history(timestamp_s, eyes_closed)

        mouth_width = _distance(points[_MOUTH_LEFT], points[_MOUTH_RIGHT])
        mouth_open = _distance(points[_UPPER_LIP], points[_LOWER_LIP])
        is_yawning = bool(mouth_width > 0 and mouth_open / mouth_width > MAR_YAWN_THRESHOLD)

        yaw, pitch, roll = self._head_pose(landmarks, width, height)
        is_using_phone = self._detect_phone(frame)
        perclos = self._perclos()

        return DriverState(
            eye_closure_ratio=round(float(np.clip(1.0 - ear / EAR_CLOSED_THRESHOLD, 0.0, 1.0)), 3),
            blink_rate_per_min=round(self._blink_rate_per_min(timestamp_s), 1),
            perclos=round(perclos, 3),
            is_yawning=is_yawning,
            is_using_phone=is_using_phone,
            head_pose_deg=(round(yaw, 1), round(pitch, 1), round(roll, 1)),
            attention_score=self._attention_score(perclos, is_yawning, is_using_phone, yaw, pitch),
            face_detected=True,
        )

    def _attention_score(
        self, perclos: float, is_yawning: bool, is_using_phone: bool, yaw: float, pitch: float
    ) -> float:
        """Fuse the signals into one attentiveness figure.

        Additive rather than max() because the failure modes compound: a drowsy
        driver looking away is worse than either alone. Weights are ordered by
        how well each signal predicts a crash — PERCLOS leads because it is the
        only one validated against driving impairment, and a yawn contributes
        least because yawning is common and weakly predictive on its own.
        """
        head_off_road = max(
            min(abs(yaw) / _HEAD_OFF_ROAD_YAW_DEG, 1.0),
            min(abs(pitch) / _HEAD_OFF_ROAD_PITCH_DEG, 1.0),
        )
        inattention = (
            0.55 * perclos
            + 0.35 * (1.0 if is_using_phone else 0.0)
            + 0.30 * head_off_road
            + 0.10 * (1.0 if is_yawning else 0.0)
        )
        return round(float(np.clip(1.0 - inattention, 0.0, 1.0)), 3)
