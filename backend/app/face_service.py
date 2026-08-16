import base64
import json
import os
import time
import threading
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image

from .config import settings


# ============================================================
# FACE ENGINE
# ============================================================

_face_app = None
_face_engine = None
_engine_initialized = False
_engine_lock = threading.Lock()
_analysis_cache: dict[str, tuple[float, dict]] = {}
_analysis_cache_lock = threading.Lock()


def _cache_key(image_b64: str) -> str:
    # Frames are large; keep only a short deterministic key, never expose it.
    import hashlib
    return hashlib.sha256(image_b64.encode()).hexdigest()


def _cached_attendance_analysis(image_b64: str) -> dict:
    key, now = _cache_key(image_b64), time.monotonic()
    with _analysis_cache_lock:
        cached = _analysis_cache.get(key)
        if cached and now - cached[0] < 3:
            return cached[1]
    result = analyze_attendance_frame(image_b64)
    with _analysis_cache_lock:
        _analysis_cache.clear()  # one current camera frame is sufficient
        _analysis_cache[key] = (now, result)
    return result


def _ensure_engine() -> str | None:
    """Lazy, process-wide model initialization; never load a model per frame."""
    global _face_app, _face_engine, _engine_initialized
    if _engine_initialized:
        return _face_engine
    with _engine_lock:
        if _engine_initialized:
            return _face_engine
        try:
            from insightface.app import FaceAnalysis
            _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            # 480 keeps CPU detection responsive while retaining adequate facial detail.
            _face_app.prepare(ctx_id=-1, det_size=(480, 480))
            _face_engine = "insightface"
        except Exception:
            try:
                import face_recognition  # noqa: F401
                _face_engine = "face_recognition"
            except Exception:
                _face_engine = None
        _engine_initialized = True
    return _face_engine


# ============================================================
# IMAGE HELPERS
# ============================================================

def _b64_to_image(image_b64: str) -> Image.Image:
    if not image_b64:
        raise ValueError("Image data is empty.")

    try:
        encoded = image_b64.split(",", 1)[-1]

        raw = base64.b64decode(
            encoded,
            validate=False,
        )

        return Image.open(
            BytesIO(raw)
        ).convert("RGB")

    except Exception as exc:
        raise ValueError(
            f"Invalid image data: {exc}"
        ) from exc


def _image_to_numpy(
    image_b64: str,
) -> np.ndarray:
    return np.array(
        _b64_to_image(image_b64)
    )



# ============================================================
# FACE DETECTION
# ============================================================

def _detect_faces(
    image: np.ndarray,
) -> list:

    engine = _ensure_engine()
    import logging
    logger = logging.getLogger("lifeos.face")
    logger.debug("_detect_faces: engine=%s image_shape=%s dtype=%s", engine, image.shape, image.dtype)

    if engine == "insightface":

        if _face_app is None:
            logger.warning("_detect_faces: _face_app is None")
            return []

        bgr = np.ascontiguousarray(image[:, :, ::-1])
        logger.debug("_detect_faces: converted to BGR shape=%s", bgr.shape)
        faces = _face_app.get(bgr)
        logger.debug("_detect_faces: insightface found %s faces", len(faces))
        return faces

    if engine == "face_recognition":
        import face_recognition
        faces = face_recognition.face_locations(image)
        logger.debug("_detect_faces: face_recognition found %s faces", len(faces))
        return faces

    return []

# ============================================================

def _to_embedding(
    image_b64: str,
):
    """
    Returns:

        embedding
        face_count

    Exactly one face is required.
    """

    cached = _analysis_cache.get(_cache_key(image_b64))
    if cached and time.monotonic() - cached[0] < 3:
        result = cached[1]
        return result.get("embedding"), result.get("face_count", 0)
    image = _image_to_numpy(
        image_b64
    )

    faces = _detect_faces(
        image
    )

    if not faces:
        return None, 0

    if len(faces) > 1:
        return None, len(faces)

    # --------------------------------------------------------
    # INSIGHTFACE
    # --------------------------------------------------------

    if _face_engine == "insightface":

        face = faces[0]

        embedding = getattr(
            face,
            "normed_embedding",
            None,
        )

        if embedding is None:
            embedding = getattr(
                face,
                "embedding",
                None,
            )

        if embedding is None:
            return None, 1

        embedding = np.asarray(
            embedding,
            dtype=np.float64,
        )

        norm = np.linalg.norm(
            embedding
        )

        if norm <= 1e-12:
            return None, 1

        embedding = embedding / norm

        return (
            embedding.tolist(),
            1,
        )

    # --------------------------------------------------------
    # FACE RECOGNITION
    # --------------------------------------------------------

    if _face_engine == "face_recognition":

        import face_recognition

        encodings = face_recognition.face_encodings(
            image,
            known_face_locations=faces,
            num_jitters=1,
            model="small",
        )

        if not encodings:
            return None, 1

        embedding = np.asarray(
            encodings[0],
            dtype=np.float64,
        )

        return (
            embedding.tolist(),
            1,
        )

    return None, 0


# ============================================================
# SIMILARITY
# ============================================================

def _cosine_similarity(
    a,
    b,
) -> float:

    a = np.asarray(
        a,
        dtype=np.float64,
    )

    b = np.asarray(
        b,
        dtype=np.float64,
    )

    denominator = (
        np.linalg.norm(a)
        * np.linalg.norm(b)
    )

    if denominator <= 1e-12:
        return 0.0

    return float(
        np.dot(a, b) / denominator
    )


def _euclidean_distance(
    a,
    b,
) -> float:

    a = np.asarray(
        a,
        dtype=np.float64,
    )

    b = np.asarray(
        b,
        dtype=np.float64,
    )

    return float(
        np.linalg.norm(a - b)
    )


# ============================================================
# PUBLIC EMBEDDING API
# ============================================================

def extract_embedding(
    image_b64: str,
):
    """
    Returns:

        (embedding, number_of_faces)
    """

    return _to_embedding(
        image_b64
    )


def register_embedding(
    image_b64: str,
):
    """
    Used when registering a student's face.
    """

    return _to_embedding(
        image_b64
    )


# ============================================================
# FACE MATCH
# ============================================================

def match_face(
    image_b64: str,
    known_embeddings: list,
    threshold: Optional[float] = None,
):
    """
    Returns:

        (
            current_embedding,
            best_score,
            matched_student
        )

    If the score is below threshold,
    matched_student is None.
    """

    if threshold is None:
        threshold = float(
            getattr(
                settings,
                "FACE_MATCH_THRESHOLD",
                0.50,
            )
        )

    embedding, face_count = _to_embedding(image_b64)
    return match_embedding(embedding, face_count, known_embeddings, threshold)


def match_embedding(embedding, face_count: int, known_embeddings: list, threshold: Optional[float] = None):
    """Compare an already extracted embedding without re-running detection."""
    if threshold is None:
        threshold = float(getattr(settings, "FACE_MATCH_THRESHOLD", 0.50))

    # No face.
    if embedding is None:
        return None, 0.0, None

    # Multiple faces.
    if face_count != 1:
        return (
            embedding,
            0.0,
            None,
        )

    if not known_embeddings:
        return (
            embedding,
            0.0,
            None,
        )

    best = None
    best_score = 0.0

    for item in known_embeddings:

        if not isinstance(
            item,
            dict,
        ):
            continue

        known_embedding = item.get(
            "embedding"
        )

        if not known_embedding:
            continue

        try:

            if (
                _ensure_engine()
                == "face_recognition"
            ):

                distance = _euclidean_distance(
                    embedding,
                    known_embedding,
                )

                score = 1.0 / (
                    1.0 + distance
                )

            else:

                score = _cosine_similarity(
                    embedding,
                    known_embedding,
                )

            if score > best_score:
                best_score = score
                best = item

        except Exception:
            continue

    if best is None:
        return (
            embedding,
            0.0,
            None,
        )

    # IMPORTANT:
    # Never return a student when threshold
    # is not reached.
    if best_score < threshold:
        return (
            embedding,
            best_score,
            None,
        )

    return (
        embedding,
        best_score,
        best,
    )


# ============================================================
# FACE COUNT
# ============================================================

def detect_faces_count(
    image_b64: str,
) -> int:

    try:

        image = _image_to_numpy(
            image_b64
        )

        return len(
            _detect_faces(image)
        )

    except Exception:
        return 0


# ============================================================
# LAPLACIAN / BLUR
# ============================================================

def _laplacian(
    gray: np.ndarray,
) -> float:

    gray = np.asarray(
        gray,
        dtype=np.float32,
    )

    if (
        gray.ndim != 2
        or gray.shape[0] < 3
        or gray.shape[1] < 3
    ):
        return 0.0

    gx = np.zeros_like(
        gray,
        dtype=np.float32,
    )

    gy = np.zeros_like(
        gray,
        dtype=np.float32,
    )

    gx[:, 1:-1] = (
        gray[:, 2:]
        - gray[:, :-2]
    )

    gy[1:-1, :] = (
        gray[2:, :]
        - gray[:-2, :]
    )

    lapl = (
        gx ** 2
        + gy ** 2
    )

    return float(
        np.mean(lapl)
    )


# ============================================================
# IMAGE QUALITY
# ============================================================

def check_image_quality(
    image_b64: str,
) -> dict:

    try:

        image = _image_to_numpy(
            image_b64
        )

        gray = np.mean(
            image,
            axis=2,
        )

        # ----------------------------------------------------
        # BLUR
        # ----------------------------------------------------

        blur_score = _laplacian(
            gray
        )

        min_blur = float(
            getattr(
                settings,
                "FACE_MIN_BLUR_SCORE",
                30,
            )
        )

        if blur_score < min_blur:

            return {
                "passed": False,
                "reason": "Face image is blurry.",
                "blur_score": round(
                    blur_score,
                    2,
                ),
            }

        # ----------------------------------------------------
        # BRIGHTNESS
        # ----------------------------------------------------

        brightness = float(
            np.mean(gray)
        )

        min_brightness = float(
            getattr(
                settings,
                "FACE_MIN_BRIGHTNESS",
                40,
            )
        )

        max_brightness = float(
            getattr(
                settings,
                "FACE_MAX_BRIGHTNESS",
                245,
            )
        )

        if brightness < min_brightness:

            return {
                "passed": False,
                "reason": "Lighting is insufficient.",
                "brightness": round(
                    brightness,
                    2,
                ),
            }

        if brightness > max_brightness:

            return {
                "passed": False,
                "reason": "Lighting is too bright.",
                "brightness": round(
                    brightness,
                    2,
                ),
            }

        # ----------------------------------------------------
        # FACE DETECTION
        # ----------------------------------------------------

        faces = _detect_faces(
            image
        )

        if not faces:

            return {
                "passed": False,
                "reason": "No face detected.",
            }

        if len(faces) > 1:

            return {
                "passed": False,
                "reason": (
                    "Multiple faces detected. "
                    "Please keep only one student "
                    "in front of the camera."
                ),
            }

        # ----------------------------------------------------
        # FACE SIZE
        # ----------------------------------------------------

        height, width = image.shape[:2]

        if _face_engine == "insightface":

            bbox = np.asarray(
                faces[0].bbox
            )

            x1, y1, x2, y2 = bbox

            face_width = max(
                0.0,
                x2 - x1,
            )

            face_height = max(
                0.0,
                y2 - y1,
            )

        else:

            top, right, bottom, left = (
                faces[0]
            )

            face_width = (
                right - left
            )

            face_height = (
                bottom - top
            )

        face_ratio = (
            face_width
            * face_height
        ) / max(
            1,
            width * height,
        )

        min_face_ratio = float(
            getattr(
                settings,
                "FACE_MIN_AREA_RATIO",
                0.04,
            )
        )

        if face_ratio < min_face_ratio:

            return {
                "passed": False,
                "reason": "Face is too far.",
                "face_ratio": round(
                    face_ratio,
                    4,
                ),
            }

        return {
            "passed": True,
            "reason": "OK",
            "blur_score": round(
                blur_score,
                2,
            ),
            "brightness": round(
                brightness,
                2,
            ),
            "face_ratio": round(
                face_ratio,
                4,
            ),
        }

    except Exception as exc:

        return {
            "passed": False,
            "reason": (
                f"Face image validation failed: "
                f"{exc}"
            ),
        }


# ============================================================
# SINGLE-PASS ATTENDANCE FRAME ANALYSIS
# ============================================================

def analyze_attendance_frame(image_b64: str) -> dict:
    """Decode, detect, quality-check and embed exactly once for attendance."""
    cached = _analysis_cache.get(_cache_key(image_b64))
    if cached and time.monotonic() - cached[0] < 3:
        result = cached[1]
        return {"passed": result["passed"], "reason": result["reason"] if not result["passed"] else "OK", **result.get("quality", {})}
    try:
        image = _image_to_numpy(image_b64)
        gray = np.mean(image, axis=2)
        blur_score = _laplacian(gray)
        brightness = float(np.mean(gray))
        faces = _detect_faces(image)
        if len(faces) != 1:
            return {"passed": False, "reason": "No face detected." if not faces else "Multiple faces detected. Please keep only one student in front of the camera.", "face_count": len(faces)}
        if blur_score < float(getattr(settings, "FACE_MIN_BLUR_SCORE", 30)):
            return {"passed": False, "reason": "Face image is blurry.", "face_count": 1}
        if not float(getattr(settings, "FACE_MIN_BRIGHTNESS", 40)) <= brightness <= float(getattr(settings, "FACE_MAX_BRIGHTNESS", 245)):
            return {"passed": False, "reason": "Lighting is insufficient." if brightness < 40 else "Lighting is too bright.", "face_count": 1}
        face = faces[0]
        if _ensure_engine() == "insightface":
            x1, y1, x2, y2 = np.asarray(face.bbox)
            area = max(0, x2-x1) * max(0, y2-y1)
            embedding = getattr(face, "normed_embedding", None)
            if embedding is None:
                embedding = getattr(face, "embedding", None)
        else:
            import face_recognition
            top, right, bottom, left = face
            area = max(0, right-left) * max(0, bottom-top)
            encodings = face_recognition.face_encodings(image, known_face_locations=faces, num_jitters=1, model="small")
            embedding = encodings[0] if encodings else None
        if area / max(1, image.shape[0] * image.shape[1]) < float(getattr(settings, "FACE_MIN_AREA_RATIO", 0.04)):
            return {"passed": False, "reason": "Face is too far.", "face_count": 1}
        if embedding is None:
            return {"passed": False, "reason": "Face embedding could not be generated.", "face_count": 1}
        embedding = np.asarray(embedding, dtype=np.float64)
        norm = np.linalg.norm(embedding)
        if norm <= 1e-12: return {"passed": False, "reason": "Face embedding could not be generated.", "face_count": 1}
        embedding = (embedding / norm).tolist()
        # This is explicitly a quality heuristic, not biometric anti-spoofing.
        live_score = min(max(blur_score / 120.0, 0.0), 1.0) * 0.9 + 0.1
        if live_score < float(getattr(settings, "LIVENESS_MIN_SCORE", 0.35)):
            return {"passed": False, "reason": "Image quality is too low.", "face_count": 1, "liveness": {"passed": False, "score": round(live_score, 3), "heuristic": True}}
        return {"passed": True, "embedding": embedding, "face_count": 1, "liveness": {"passed": True, "score": round(live_score, 3), "heuristic": True}, "quality": {"blur_score": round(blur_score, 2), "brightness": round(brightness, 2)}}
    except Exception:
        return {"passed": False, "reason": "Face image validation failed.", "face_count": 0}


# ============================================================
# LIVENESS
# ============================================================

def liveness_check(
    image_b64: str,
) -> dict:
    """
    Basic liveness/image-quality check.

    This is NOT certified anti-spoofing.
    """

    analysis = _cached_attendance_analysis(image_b64)
    return analysis.get("liveness", {"passed": False, "score": 0.0, "reason": analysis.get("reason", "Image quality is too low.")})
    cached = _analysis_cache.get(_cache_key(image_b64))
    if cached and time.monotonic() - cached[0] < 3:
        result = cached[1]
        return result.get("liveness", {"passed": result["passed"], "score": 0.0, "reason": result.get("reason", "OK")})
    try:

        image = _image_to_numpy(
            image_b64
        )

        gray = np.mean(
            image,
            axis=2,
        )

        sharpness_value = _laplacian(
            gray
        )

        faces = _detect_faces(
            image
        )

        if not faces:

            return {
                "passed": False,
                "score": 0.0,
                "reason": "No face detected.",
            }

        if len(faces) > 1:

            return {
                "passed": False,
                "score": 0.1,
                "reason": "Multiple faces detected.",
            }

        sharpness = min(
            max(
                sharpness_value / 120.0,
                0.0,
            ),
            1.0,
        )

        score = (
            sharpness * 0.9
            + 0.1
        )

        minimum_score = float(
            getattr(
                settings,
                "LIVENESS_MIN_SCORE",
                0.35,
            )
        )

        passed = (
            score >= minimum_score
        )

        return {
            "passed": passed,
            "score": round(
                score,
                3,
            ),
            "reason": (
                "OK"
                if passed
                else "Image quality is too low."
            ),
        }

    except Exception as exc:

        # Fail closed.
        return {
            "passed": False,
            "score": 0.0,
            "reason": (
                f"Liveness check failed: {exc}"
            ),
        }


# ============================================================
# SNAPSHOT
# ============================================================

def save_snapshot(
    image_b64: str,
    folder: str = "snapshots",
) -> str:

    image = _b64_to_image(
        image_b64
    )

    upload_dir = getattr(
        settings,
        "UPLOAD_DIR",
        None,
    )

    if upload_dir is None:
        raise ValueError(
            "UPLOAD_DIR is not configured."
        )

    folder_path = (
        upload_dir
        / folder
    )

    folder_path.mkdir(
        parents=True,
        exist_ok=True,
    )

    filename = (
        f"{int(time.time() * 1000)}_"
        f"{os.urandom(4).hex()}.jpg"
    )

    path = (
        folder_path
        / filename
    )

    image.save(
        path,
        "JPEG",
        quality=90,
    )

    return str(path)


# ============================================================
# EMBEDDING ENCRYPTION
# ============================================================

def encrypt_embedding(
    emb: list,
) -> str:

    raw = json.dumps(
        emb,
        separators=(",", ":"),
    )

    key = str(
        getattr(
            settings,
            "EMBEDDING_ENCRYPT_KEY",
            "",
        )
    ).encode("utf-8")

    if not key:
        raise ValueError(
            "EMBEDDING_ENCRYPT_KEY is not configured."
        )

    data = raw.encode(
        "utf-8"
    )

    output = bytearray()

    for index, byte in enumerate(data):

        output.append(
            byte ^ key[
                index % len(key)
            ]
        )

    return base64.b64encode(
        bytes(output)
    ).decode("ascii")


def decrypt_embedding(
    encoded: str,
) -> list:

    key = str(
        getattr(
            settings,
            "EMBEDDING_ENCRYPT_KEY",
            "",
        )
    ).encode("utf-8")

    if not key:
        raise ValueError(
            "EMBEDDING_ENCRYPT_KEY is not configured."
        )

    data = base64.b64decode(
        encoded
    )

    output = bytearray()

    for index, byte in enumerate(data):

        output.append(
            byte ^ key[
                index % len(key)
            ]
        )

    return json.loads(
        bytes(output).decode(
            "utf-8"
        )
    )


# ============================================================
# ENGINE STATUS
# ============================================================

def get_engine() -> str:
    return _ensure_engine() or "unavailable"
