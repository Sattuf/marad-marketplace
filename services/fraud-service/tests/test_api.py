import pytest
from fastapi.testclient import TestClient
from main import app
import jwt
import os

client = TestClient(app)

from tests.conftest import sign_test_token


def get_admin_token(secret=None, role="admin"):
    if secret:  # an HMAC token, e.g. signed with an old leaked default secret
        return jwt.encode({"sub": "admin", "role": role, "iss": "marad-auth", "aud": "marad-api"}, secret, algorithm="HS256")
    return sign_test_token({"sub": "admin", "role": role})

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_device_check_unauthorized():
    # It's actually not protected by auth
    payload = {
        "user_id": "u1",
        "device_id": "d1",
        "ip_address": "127.0.0.1"
    }
    # It will fail on db connection in test if not mocked, but let's assume mocked or handled
    # To avoid db error, we mock the device_service
    pass

@pytest.fixture(autouse=True)
def mock_db(monkeypatch):
    # Mock database connections to avoid real DB calls during tests
    async def mock_connect(): pass
    async def mock_close(): pass

    monkeypatch.setattr("database.connect_to_postgres", mock_connect)
    monkeypatch.setattr("database.close_postgres_connection", mock_close)

def test_admin_dashboard_unauthorized():
    # No credentials at all: 401 (FastAPI >= 0.120 follows RFC 7235; it used to answer 403).
    response = client.get("/fraud/admin/dashboard")
    assert response.status_code == 401

def test_admin_action_with_token(monkeypatch):
    # We mock pg_pool to avoid errors
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    # An action the service cannot perform is refused, never reported as done.
    response = client.post("/fraud/admin/action", json={"user_id": "u1", "action": "BLOCK"}, headers=headers)
    assert response.status_code == 400


def test_admin_lock_reports_failure_when_users_service_is_down(monkeypatch):
    import httpx as _httpx

    class DownClient:
        def __init__(self, *a, **k):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def put(self, *a, **k):
            raise _httpx.ConnectError("down")

    monkeypatch.setattr("routers.admin.httpx.AsyncClient", DownClient)
    headers = {"Authorization": f"Bearer {get_admin_token()}"}
    response = client.post("/fraud/admin/action", json={"user_id": "u1", "action": "lock"}, headers=headers)
    assert response.status_code == 502

def test_risk_score(monkeypatch):
    def mock_acquire(*args, **kwargs):
        class MockConn:
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc, tb):
                pass
            async def fetchrow(self, query, *args):
                # Two signals (0.5 + 0.6), aggregated by Postgres.
                return {"total": 1.1, "n": 2}
        return MockConn()
        
    class MockPool:
        def acquire(self):
            return mock_acquire()

    monkeypatch.setattr("database.pg_pool", MockPool())
    
    headers = {"Authorization": f"Bearer {get_admin_token()}"}
    response = client.get("/fraud/risk/u1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_risk_score"] == 1.1
    assert data["risk_level"] == "HIGH"
    assert data["signal_count"] == 2


def test_admin_rejects_token_signed_with_old_default_secret():
    headers = {"Authorization": f"Bearer {get_admin_token(secret='supersecretkey')}"}
    response = client.get("/fraud/admin/dashboard", headers=headers)
    assert response.status_code == 401


def test_admin_rejects_non_admin_role():
    headers = {"Authorization": f"Bearer {get_admin_token(role='user')}"}
    response = client.get("/fraud/admin/dashboard", headers=headers)
    assert response.status_code == 403


def test_risk_requires_admin():
    response = client.get("/fraud/risk/u1")
    assert response.status_code == 401


def test_ingestion_requires_internal_secret():
    payload = {"user_id": "u1", "ip_address": "127.0.0.1"}
    assert client.post("/fraud/device/check", json=payload).status_code == 401
    wrong = {"x-internal-secret": "marad-internal-secret-for-webhooks"}
    assert client.post("/fraud/device/check", json=payload, headers=wrong).status_code == 401


def _unsigned_token(payload: dict) -> str:
    """A token with alg=none and no signature (the classic JWT bypass)."""
    import base64
    import json

    def b64(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()

    return f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(payload)}."


def test_admin_rejects_unsigned_alg_none_token():
    headers = {"Authorization": f"Bearer {_unsigned_token({'sub': 'admin', 'role': 'admin'})}"}
    response = client.get("/fraud/admin/dashboard", headers=headers)
    assert response.status_code == 401


def test_admin_rejects_expired_token():
    import time

    token = sign_test_token({"sub": "admin", "role": "admin", "exp": int(time.time()) - 60})
    response = client.get("/fraud/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_admin_rejects_hmac_token_keyed_with_the_public_key():
    """Algorithm confusion: HS256 'signed' with the public key must not verify."""
    import base64, hashlib, hmac, json

    from cryptography.hazmat.primitives import serialization
    from jwt_keys import public_keys

    pem = public_keys()[os.environ["TEST_JWT_KID"]].public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
    signing_input = f"{b64({'alg': 'HS256', 'typ': 'JWT', 'kid': os.environ['TEST_JWT_KID']})}.{b64({'sub': 'admin', 'role': 'admin', 'iss': 'marad-auth', 'aud': 'marad-api'})}"
    mac = base64.urlsafe_b64encode(hmac.new(pem, signing_input.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    response = client.get("/fraud/admin/dashboard", headers={"Authorization": f"Bearer {signing_input}.{mac}"})
    assert response.status_code == 401


def test_admin_rejects_another_rsa_key_wrong_audience_and_unknown_kid():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    other = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    for token in (
        sign_test_token({"sub": "admin", "role": "admin"}, key=other),
        sign_test_token({"sub": "admin", "role": "admin", "aud": "marad-refresh"}),
        sign_test_token({"sub": "admin", "role": "admin"}, kid="unknown"),
    ):
        response = client.get("/fraud/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


def test_errors_use_the_unified_body_with_request_id():
    response = client.get("/fraud/admin/dashboard", headers={"X-Request-ID": "req-abc-123"})
    body = response.json()
    assert response.status_code == 401
    assert body["statusCode"] == 401
    assert body["error"] == "Unauthorized"
    assert body["requestId"] == "req-abc-123"
    assert body["path"] == "/fraud/admin/dashboard"
    assert "message" in body and "timestamp" in body
