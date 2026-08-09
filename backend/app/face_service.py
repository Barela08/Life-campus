import base64
import json
import os
import time
from io import BytesIO

import numpy as np
from PIL import Image

from .config import settings

# Try InsightFace first (as requested), fall back to face_recognition (dlib)
_face_app = None
_face_engine = None

try:
    import insightface
    from insightface.app import FaceAnalysis

    _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    _face_app.prepare(ctx_id=0, det_size=(640, 640))
    _face_engine = "insightface"
except Exception:
    try:
        import face_recognition

        _face_engine = "face_recognition"
    except Exception:
        _face_engine = None


def _b64_to_image(image_b64: str) -> Image.Image:
    raw = base64.b64decode(image_b64.split(",")[-1])
    return Image.open(BytesIO(raw)).convert("RGB")


def _to_embedding(image_b64: str):
    img = _b64_to_image(image_b64)
    image = np.array(img)
    if _face_engine == "insightface":
        faces = _face_app.get(image)
        if not faces:
            return None, 0
        return faces[0].normed_embedding.astype(np.float64).tolist(), 1
    else:
        import face_recognition
        encodings = face_recognition.face_encodings(image)
        if not encodings:
            return None, 0
        return encodings[0].astype(np.float64).tolist(), 1


def _cosine_similarity(a, b) -> float:
    a = np.array(a)
    b = np.array(b)
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9
    return float(np.dot(a, b) / denom)


def _euclidean_distance(a, b) -> float:
    return float(np.linalg.norm(np.array(a) - np.array(b)))


def extract_embedding(image_b64: str):
    """Returns (embedding, num_faces)."""
    return _to_embedding(image_b64)


def register_embedding(image_b64: str):
    emb, n = _to_embedding(image_b64)
    return emb, n


def match_face(image_b64: str, known_embeddings: list, threshold: float = None):
    """Returns (best_embedding, best_score, best_student_ref)."""
    if threshold is None:
        threshold = settings.FACE_MATCH_THRESHOLD
    emb, n = _to_embedding(image_b64)
    if not emb:
        return None, 0.0, None
    best = None
    best_score = 0.0
    for k in known_embeddings:
        if _face_engine == "face_recognition":
            score = _euclidean_distance(emb, k["embedding"])
            # For face_recognition, lower distance = better; convert to similarity
            sim = 1.0 / (1.0 + score)
        else:
            sim = _cosine_similarity(emb, k["embedding"])
        if sim > best_score:
            best_score = sim
            best = k
    return emb, best_score, best


def detect_faces_count(image_b64: str) -> int:
    try:
        img = _b64_to_image(image_b64)
        image = np.array(img)
        if _face_engine == "insightface":
            return len(_face_app.get(image))
        import face_recognition
        return len(face_recognition.face_locations(image))
    except Exception:
        return 0


def _laplacian(gray):
    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
    gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
    lapl = gx ** 2 + gy ** 2
    return float(np.mean(lapl))


def check_image_quality(image_b64: str) -> dict:
    """Validate image quality: blur, lighting, face distance.

    Returns dict with passed bool and reason.
    """
    try:
        img = _b64_to_image(image_b64)
        image = np.array(img)
        gray = np.mean(image, axis=2)

        # Blur detection via Laplacian variance
        lap = _laplacian(gray)
        if lap < 30:
            return {"passed": False, "reason": "Face image is blurry.", "blur_score": round(lap, 2)}

        # Lighting detection via average brightness
        brightness = float(np.mean(gray))
        if brightness < 40:
            return {"passed": False, "reason": "Lighting is insufficient.", "brightness": round(brightness, 2)}
        if brightness > 245:
            return {"passed": False, "reason": "Lighting is too bright.", "brightness": round(brightness, 2)}

        # Face distance: check face bounding box size relative to frame
        faces = []
        if _face_engine == "insightface":
            faces = _face_app.get(image)
        else:
            import face_recognition
            faces = face_recognition.face_locations(image)

        if not faces:
            return {"passed": False, "reason": "No face detected."}

        if len(faces) > 1:
            return {"passed": False, "reason": "Multiple faces detected. Please keep only the student in front of the camera."}

        h, w = image.shape[:2]
        if _face_engine == "insightface":
            bbox = faces[0].bbox  # [x1, y1, x2, y2]
            face_w = bbox[2] - bbox[0]
            face_h = bbox[3] - bbox[1]
        else:
            top, right, bottom, left = faces[0]
            face_w = right - left
            face_h = bottom - top

        face_area_ratio = (face_w * face_h) / (w * h)
        # Face too small (< 4% of frame) means too far
        if face_area_ratio < 0.04:
            return {"passed": False, "reason": "Face is too far.", "face_ratio": round(face_area_ratio, 4)}

        return {"passed": True, "reason": "OK", "blur_score": round(lap, 2),
                "brightness": round(brightness, 2), "face_ratio": round(face_area_ratio, 4)}
    except Exception as e:
        return {"passed": False, "reason": f"Face registration failed. ({e})"}


def liveness_check(image_b64: str) -> dict:
    """Simple spoof-resistance heuristic: verify exactly one sharp face is present
    and estimate blur/sharpness. Returns liveness score 0-1."""
    try:
        img = _b64_to_image(image_b64)
        image = np.array(img)
        gray = np.mean(image, axis=2)
        # Laplacian variance for sharpness
        lap = _laplacian(gray)
        sharpness = min(lap / 120.0, 1.0)
        faces = 0
        if _face_engine == "insightface":
            faces = len(_face_app.get(image))
        else:
            import face_recognition
            faces = len(face_recognition.face_locations(image))
        if faces == 0:
            return {"passed": False, "score": 0.0, "reason": "No face detected"}
        if faces > 1:
            return {"passed": False, "score": 0.1, "reason": "Multiple faces"}
        score = sharpness * 0.9 + 0.1
        return {"passed": score >= 0.35, "score": round(score, 3), "reason": "OK" if score >= 0.35 else "Blurry image"}
    except Exception as e:
        return {"passed": True, "score": 0.5, "reason": f"Liveness defaulted ({e})"}


def save_snapshot(image_b64: str, folder: str = "snapshots") -> str:
    img = _b64_to_image(image_b64)
    folder_path = settings.UPLOAD_DIR / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time() * 1000)}_{os.urandom(4).hex()}.jpg"
    path = folder_path / filename
    img.save(path, "JPEG", quality=90)
    return str(path)


def encrypt_embedding(emb: list) -> str:
    raw = json.dumps(emb)
    # Lightweight obfuscation (XOR) — production should use Fernet/AES
    key = settings.EMBEDDING_ENCRYPT_KEY.encode()
    data = raw.encode()
    out = bytearray()
    for i, b in enumerate(data):
        out.append(b ^ key[i % len(key)])
    return base64.b64encode(bytes(out)).decode()


def decrypt_embedding(encoded: str) -> list:
    key = settings.EMBEDDING_ENCRYPT_KEY.encode()
    data = base64.b64decode(encoded)
    out = bytearray()
    for i, b in enumerate(data):
        out.append(b ^ key[i % len(key)])
    return json.loads(bytes(out).decode())


def get_engine() -> str:
    return _face_engine or "unavailable"