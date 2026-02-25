# apps/ag/services/hashing.py
import hashlib

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha256_filelike(f) -> str:
    h = hashlib.sha256()
    for chunk in iter(lambda: f.read(8192), b""):
        h.update(chunk)
    return h.hexdigest()