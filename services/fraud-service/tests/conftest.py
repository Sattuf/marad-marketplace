import os

# Test-only secrets. Real deployments must inject their own values.
os.environ.setdefault("INTERNAL_SECRET", "test-internal-secret-not-for-production-use")

# Throwaway RS256 key pair for this test run; must run before the app is imported.
import base64 as _b64, hashlib as _hl, json as _json, os as _os
if not _os.environ.get("JWT_PUBLIC_JWKS"):
    from cryptography.hazmat.primitives import serialization as _ser
    from cryptography.hazmat.primitives.asymmetric import rsa as _rsa

    _key = _rsa.generate_private_key(public_exponent=65537, key_size=2048)
    _nums = _key.public_key().public_numbers()
    _b = lambda i: _b64.urlsafe_b64encode(i.to_bytes((i.bit_length() + 7) // 8, "big")).rstrip(b"=").decode()
    _jwk = {"kty": "RSA", "n": _b(_nums.n), "e": _b(_nums.e)}
    _kid = _b64.urlsafe_b64encode(_hl.sha256(_json.dumps({"e": _jwk["e"], "kty": "RSA", "n": _jwk["n"]}, separators=(",", ":")).encode()).digest()).rstrip(b"=").decode()
    _os.environ["JWT_PUBLIC_JWKS"] = _json.dumps({"keys": [{**_jwk, "kid": _kid, "alg": "RS256", "use": "sig"}]})
    _os.environ["TEST_JWT_KID"] = _kid
    _os.environ["TEST_JWT_PRIVATE_PEM"] = _key.private_bytes(_ser.Encoding.PEM, _ser.PrivateFormat.PKCS8, _ser.NoEncryption()).decode()


def sign_test_token(claims: dict, **overrides) -> str:
    """Signs like auth-service (RS256, kid, iss, aud, 15 min expiry)."""
    import time
    import jwt as _jwt
    payload = {"iss": "marad-auth", "aud": "marad-api", "exp": int(time.time()) + 900, **claims}
    key = overrides.pop("key", _os.environ["TEST_JWT_PRIVATE_PEM"])
    headers = {"kid": overrides.pop("kid", _os.environ["TEST_JWT_KID"])}
    return _jwt.encode(payload, key, algorithm=overrides.pop("algorithm", "RS256"), headers=headers)
