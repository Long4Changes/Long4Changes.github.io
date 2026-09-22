import pytest
import os
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from unittest.mock import patch

from backend.app.main import app
from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk

# Set mock embeddings mode for all tests
os.environ["MOCK_EMBEDDINGS"] = "1"

class MockResult:
    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar = scalar

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._scalar

class FakeAsyncSession:
    def __init__(self, public_doc, private_doc, public_chunk, private_chunk):
        self.public_doc = public_doc
        self.private_doc = private_doc
        self.public_chunk = public_chunk
        self.private_chunk = private_chunk

    async def execute(self, statement):
        sql_str = str(statement)
        compiled = statement.compile()
        params = compiled.params or {}

        # 1. Chunk search query (JOIN document_chunks)
        if "document_chunks" in sql_str:
            # Check if query strictly filters by visibility == 'public'
            has_public_filter = any(v == "public" for v in params.values())
            if has_public_filter:
                return MockResult(rows=[
                    (self.public_doc.slug, self.public_doc.title, self.public_chunk.chunk_index, self.public_chunk.content, 0.15)
                ])
            else:
                return MockResult(rows=[
                    (self.public_doc.slug, self.public_doc.title, self.public_chunk.chunk_index, self.public_chunk.content, 0.15),
                    (self.private_doc.slug, self.private_doc.title, self.private_chunk.chunk_index, self.private_chunk.content, 0.10)
                ])

        # 2. Query document by slug
        if "documents.slug =" in sql_str:
            slug_val = next((v for k, v in params.items() if k.startswith("slug")), None)
            vis_val = next((v for k, v in params.items() if k.startswith("visibility")), None)

            if slug_val == "sample-public":
                return MockResult(scalar=self.public_doc)
            elif slug_val == "sample-private":
                # If filtered by visibility = 'public', the private document must NOT match!
                if vis_val == "public":
                    return MockResult(scalar=None)
                return MockResult(scalar=self.private_doc)
            return MockResult(scalar=None)

        # 3. List public documents
        if "SELECT documents.slug" in sql_str:
            return MockResult(rows=[(self.public_doc.slug, self.public_doc.title)])

        return MockResult()

@pytest.fixture
def mock_data():
    pub_doc = Document(
        id=1,
        slug="sample-public",
        title="Public Guide to Ark",
        content="# Public Content\nWelcome to the ark project.",
        visibility="public",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    priv_doc = Document(
        id=2,
        slug="sample-private",
        title="Secret Personal Notes",
        content="# Private Note\nSecret access keys and tokens.",
        visibility="private",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    pub_chunk = DocumentChunk(
        id=1,
        document_id=1,
        chunk_index=0,
        content="Welcome to the ark project.",
        embedding=[0.1] * 1024
    )
    priv_chunk = DocumentChunk(
        id=2,
        document_id=2,
        chunk_index=0,
        content="Secret access keys and tokens.",
        embedding=[0.1] * 1024
    )
    return pub_doc, priv_doc, pub_chunk, priv_chunk

@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_list_documents(mock_data):
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/documents")
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data
        assert len(data["documents"]) == 1
        assert data["documents"][0]["slug"] == "sample-public"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_public_document_success(mock_data):
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/documents/sample-public")
        assert resp.status_code == 200
        data = resp.json()
        assert data["slug"] == "sample-public"
        assert "Public Content" in data["content"]
        assert data["visibility"] == "public"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_private_document_blocked(mock_data):
    """Security test: Unauthenticated access to private document MUST return 404."""
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/documents/sample-private")
        assert resp.status_code == 404
        assert "not found or permission denied" in resp.json()["detail"].lower()

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_search_documents_public_only(mock_data):
    """Security test: Vector search MUST strictly return only public chunks."""
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/search?q=secret+tokens")
        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "secret tokens"
        results = data["results"]
        assert len(results) > 0

        for item in results:
            assert item["slug"] != "sample-private"
            assert "Secret access keys" not in item["content"]
            assert item["slug"] == "sample-public"
            assert item["similarity"] > 0.0

    app.dependency_overrides.clear()
