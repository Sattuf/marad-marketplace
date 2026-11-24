"""أدوات الأمان — Security dependencies for the fraud service.

Secrets are mandatory: a default secret committed to the repository is a public secret.
"""
import hashlib
import hmac
import os

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from jwt_keys import verify_access_token

_bearer = HTTPBearer()


def require_secret(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable {name}")
    if os.getenv("ENV") == "production" and len(value) < 32:
        raise RuntimeError(f"{name} must be at least 32 characters in production")
    return value


def safe_equal(provided: str | None, expected: str) -> bool:
    if not provided or not expected:
        return False
    a = hashlib.sha256(provided.encode()).digest()
    b = hashlib.sha256(expected.encode()).digest()
    return hmac.compare_digest(a, b)


async def verify_internal(x_internal_secret: str | None = Header(default=None)) -> None:
    """Only other services (holding INTERNAL_SECRET) may call ingestion endpoints."""
    if not safe_equal(x_internal_secret, require_secret("INTERNAL_SECRET")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal secret")


async def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    try:
        payload = verify_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return payload
