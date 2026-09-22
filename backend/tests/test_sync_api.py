import pytest
import os
import hmac
import hashlib
import json
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock

from backend.app.main import app
from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk
from backend.app.auth import create_access_token
from backend.app.sync import (
    verify_github_signature,
    parse_github_push_diff,
    delete_document_by_slug,
    get_webhook_secret,
    SyncSummary,
    WebhookSummary
)

# Enable mock embeddings
os.environ["MOCK_EMBEDDINGS"] = "1"

def calculate_signature(payload_bytes: bytes, secret: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    return f"sha256={mac.hexdigest()}"

def test_verify_github_signature():
    secret = "test-secret-123"
    body = b'{"ref": "refs/heads/main"}'
    valid_sig = calculate_signature(body, secret)

    # Valid
    assert verify_github_signature(body, valid_sig, secret=secret) is True
    # Invalid secret / wrong signature
    assert verify_github_signature(body, "sha256=badhash", secret=secret) is False
    # Missing header
    assert verify_github_signature(body, None, secret=secret) is False
    # Malformed header (missing sha256= prefix)
    assert verify_github_signature(body, "badprefix", secret=secret) is False

def test_parse_github_push_diff():
    payload = {
        "commits": [
            {
                "added": ["content/article1.md", "images/logo.png"],
                "modified": ["content/article2.md", "README.md"],
                "removed": ["old.txt"]
            },
            {
                "added": ["content/article3.md"],
                "modified": ["content/article1.md"],
                "removed": ["content/deprecated.md"]
            }
        ]
    }
    diff = parse_github_push_diff(payload)
    assert "content/article1.md" in diff.added or "content/article1.md" in diff.modified
    assert "content/article2.md" in diff.modified
    assert "README.md" in diff.modified
    assert "content/deprecated.md" in diff.removed
    # Non-markdown ignored
    assert "images/logo.png" not in diff.added
    assert "old.txt" not in diff.removed

@pytest.mark.asyncio
async def test_webhook_endpoint_unauthorized():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing signature
        resp1 = await client.post("/api/webhook/github", json={"zen": "keep it simple"})
        assert resp1.status_code == 401
        assert "Invalid or missing GitHub HMAC-SHA256 signature" in resp1.json()["detail"]

        # Invalid signature
        resp2 = await client.post(
            "/api/webhook/github",
            json={"zen": "keep it simple"},
            headers={"X-Hub-Signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000"}
        )
        assert resp2.status_code == 401

@pytest.mark.asyncio
async def test_webhook_endpoint_success():
    secret = get_webhook_secret()
    payload = {
        "commits": [
            {
                "added": ["content/sample-public.md"],
                "modified": [],
                "removed": ["content/old-doc.md"]
            }
        ]
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = calculate_signature(payload_bytes, secret)

    with patch("backend.app.main.process_webhook_diff", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = WebhookSummary(
            status="processed",
            updated=["sample-public"],
            removed=["old-doc"]
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/webhook/github",
                content=payload_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-Hub-Signature-256": sig
                }
            )
            assert resp.status_code == 202
            data = resp.json()
            assert data["status"] == "queued"
            assert "content/sample-public.md" in data["updated"]
            assert "content/old-doc.md" in data["removed"]

@pytest.mark.asyncio
async def test_manual_sync_guest_forbidden():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unauthenticated guest
        resp_anon = await client.post("/api/sync")
        assert resp_anon.status_code == 403
        assert "Permission denied" in resp_anon.json()["detail"]

        # Guest role token
        token_guest = create_access_token(role="guest")
        resp_guest = await client.post(
            "/api/sync",
            headers={"Authorization": f"Bearer {token_guest}"}
        )
        assert resp_guest.status_code == 403

@pytest.mark.asyncio
async def test_manual_sync_root_success():
    token_root = create_access_token(role="root")
    with patch("backend.app.main.sync_repository_documents", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = SyncSummary(
            status="synchronized",
            synced_documents=["sample-public", "sample-private"],
            total=2
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/sync",
                headers={"Authorization": f"Bearer {token_root}"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "synchronized"
            assert data["synced_documents"] == ["sample-public", "sample-private"]
            assert data["total"] == 2

