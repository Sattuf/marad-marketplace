"""Access-token verification (RS256), identical copy in fraud-service and
personalization-service (checked by scripts/check-shared-copies.mjs).

auth-service signs access tokens with an RSA private key no other service holds. Services
verify with the public keys in JWT_PUBLIC_JWKS (a one-line JWK Set); the token's `kid`
picks the key and an unknown `kid` is rejected. Issuer and audience are always checked.
"""
import json
import os
from functools import lru_cache

import jwt
from jwt.algorithms import RSAAlgorithm

ACCESS_TOKEN_ISSUER = "marad-auth"
ACCESS_TOKEN_AUDIENCE = "marad-api"


@lru_cache(maxsize=1)
def public_keys() -> dict:
    """Parsed once; call at startup so a missing or malformed key fails the boot."""
    raw = os.getenv("JWT_PUBLIC_JWKS")
    if not raw:
        raise RuntimeError("Missing required environment variable JWT_PUBLIC_JWKS")
    keys = {}
    for jwk in json.loads(raw).get("keys", []):
        if not isinstance(jwk.get("kid"), str) or jwk.get("kty") != "RSA" or jwk.get("alg", "RS256") != "RS256":
            raise RuntimeError('JWT_PUBLIC_JWKS: every key needs a kid, kty "RSA" and alg "RS256"')
        keys[jwk["kid"]] = RSAAlgorithm.from_jwk(json.dumps(jwk))
    if not 1 <= len(keys) <= 2:
        raise RuntimeError("JWT_PUBLIC_JWKS must contain one or two keys")
    return keys


def verify_access_token(token: str) -> dict:
    """Returns the claims, or raises jwt.PyJWTError."""
    kid = jwt.get_unverified_header(token).get("kid")
    key = public_keys().get(kid) if isinstance(kid, str) else None
    if key is None:
        raise jwt.InvalidTokenError("unknown signing key")
    return jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        issuer=ACCESS_TOKEN_ISSUER,
        audience=ACCESS_TOKEN_AUDIENCE,
        options={"require": ["exp", "sub"]},
    )
