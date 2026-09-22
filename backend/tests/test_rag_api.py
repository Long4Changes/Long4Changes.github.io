import pytest
import os
import json
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk
from backend.app.auth import create_access_token
from backend.app.rag import build_rag_prompts, extract_citations
from backend.tests.test_search_api import FakeAsyncSession

os.environ["MOCK_EMBEDDINGS"] = "1"
os.environ["MOCK_LLM"] = "1"

@pytest.fixture
def mock_data():
    pub_doc = Document(
        id=1,
        slug="ark-guide",
        title="Ark Guide",
        content="Ark is an exploration space vessel designed for memory retrieval.",
        visibility="public",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    priv_doc = Document(
        id=2,
        slug="secret-notes",
        title="Secret Notes",
        content="Master deploy key: sk_live_99887766.",
        visibility="private",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    pub_chunk = DocumentChunk(
        id=1,
        document_id=1,
        chunk_index=0,
        content="Ark is an exploration space vessel designed for memory retrieval.",
        embedding=[0.1] * 1024
    )
    priv_chunk = DocumentChunk(
        id=2,
        document_id=2,
        chunk_index=0,
        content="Master deploy key: sk_live_99887766.",
        embedding=[0.1] * 1024
    )
    return pub_doc, priv_doc, pub_chunk, priv_chunk

def test_prompt_engineering_and_citations():
    chunks = [
        {"slug": "ark", "title": "Ark Guide", "content": "Vessel info", "visibility": "public"},
        {"slug": "ark", "title": "Ark Guide", "content": "Vessel engines", "visibility": "public"},
        {"slug": "secret", "title": "Secret Doc", "content": "Confidential", "visibility": "private"}
    ]
    citations = extract_citations(chunks)
    assert len(citations) == 2
    assert citations[0]["slug"] == "ark"
    assert citations[1]["slug"] == "secret"

    prompts = build_rag_prompts("How does Ark work?", chunks)
    assert len(prompts) == 2
    assert prompts[0]["role"] == "system"
    assert "strictly and solely in the provided Reference Context" in prompts[0]["content"]
    assert prompts[1]["role"] == "user"
    assert "Ark Guide" in prompts[1]["content"]

@pytest.mark.asyncio
async def test_ask_empty_query_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/ask", json={"query": "  "})
        assert resp.status_code == 400

@pytest.mark.asyncio
async def test_ask_guest_streaming_public_only(mock_data):
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/ask", json={"query": "What is Ark?"})
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]

        body_text = resp.text
        assert "event: delta" in body_text
        assert "event: citations" in body_text
        assert "event: done" in body_text

        # Extract citations event from SSE stream
        citations_line = [
            line for line in body_text.splitlines()
            if line.startswith("data: ") and "citations" in line
        ][0]
        citations_data = json.loads(citations_line[6:])["citations"]

        # Guest MUST strictly receive only public citations
        assert len(citations_data) > 0
        for cite in citations_data:
            assert cite["visibility"] == "public"
            assert cite["slug"] != "secret-notes"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_ask_root_streaming_includes_private(mock_data):
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    token = create_access_token(role="root")
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/ask", json={"query": "What is the deploy key?"}, headers=headers)
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]

        body_text = resp.text
        assert "event: delta" in body_text
        assert "event: citations" in body_text

        citations_line = [
            line for line in body_text.splitlines()
            if line.startswith("data: ") and "citations" in line
        ][0]
        citations_data = json.loads(citations_line[6:])["citations"]

        # Root can receive private citations
        assert any(cite["slug"] == "sample-private" or cite["visibility"] == "private" for cite in citations_data)

    app.dependency_overrides.clear()
