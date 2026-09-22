import pytest
import os
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk
from backend.app.auth import create_access_token, ADMIN_PASSKEY

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
        has_public_filter = any(v == "public" for v in params.values())

        # 1. Chunk search query (JOIN document_chunks)
        if "document_chunks" in sql_str:
            if has_public_filter:
                return MockResult(rows=[
                    (self.public_doc.slug, self.public_doc.title, self.public_chunk.chunk_index, self.public_chunk.content, 0.15, "public")
                ])
            else:
                # Root search: returns both private and public chunks
                return MockResult(rows=[
                    (self.private_doc.slug, self.private_doc.title, self.private_chunk.chunk_index, self.private_chunk.content, 0.08, "private"),
                    (self.public_doc.slug, self.public_doc.title, self.public_chunk.chunk_index, self.public_chunk.content, 0.15, "public")
                ])

        # 2. Query document by slug
        if "documents.slug =" in sql_str:
            slug_val = next((v for k, v in params.items() if k.startswith("slug")), None)

            if slug_val == "sample-public":
                return MockResult(scalar=self.public_doc)
            elif slug_val == "sample-private":
                if has_public_filter:
                    return MockResult(scalar=None)
                return MockResult(scalar=self.private_doc)
            return MockResult(scalar=None)

        # 3. List documents
        if "SELECT documents.slug" in sql_str:
            if has_public_filter:
                return MockResult(rows=[(self.public_doc.slug, self.public_doc.title, "public")])
            return MockResult(rows=[
                (self.public_doc.slug, self.public_doc.title, "public"),
                (self.private_doc.slug, self.private_doc.title, "private")
            ])

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
async def test_auth_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid passkey
        resp_bad = await client.post("/api/auth", json={"passkey": "wrong-secret"})
        assert resp_bad.status_code == 401
        assert "Invalid administrative passkey" in resp_bad.json()["detail"]

        # Valid passkey
        resp_good = await client.post("/api/auth", json={"passkey": ADMIN_PASSKEY})
        assert resp_good.status_code == 200
        data = resp_good.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "root"

@pytest.mark.asyncio
async def test_list_documents(mock_data):
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Guest list -> only public
        resp_guest = await client.get("/api/documents")
        assert resp_guest.status_code == 200
        data_guest = resp_guest.json()
        assert len(data_guest["documents"]) == 1
        assert data_guest["documents"][0]["slug"] == "sample-public"

        # Root list -> both public and private
        token = create_access_token(role="root")
        headers = {"Authorization": f"Bearer {token}"}
        resp_root = await client.get("/api/documents", headers=headers)
        assert resp_root.status_code == 200
        data_root = resp_root.json()
        assert len(data_root["documents"]) == 2

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
async def test_get_private_document_guest_and_root(mock_data):
    """Security test: Guest gets 403 Forbidden; Root with JWT gets 200 OK."""
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Guest access -> 403 Forbidden
        resp_guest = await client.get("/api/documents/sample-private")
        assert resp_guest.status_code == 403
        assert "Authentication required" in resp_guest.json()["detail"]

        # Root access -> 200 OK
        token = create_access_token(role="root")
        headers = {"Authorization": f"Bearer {token}"}
        resp_root = await client.get("/api/documents/sample-private", headers=headers)
        assert resp_root.status_code == 200
        data_root = resp_root.json()
        assert data_root["slug"] == "sample-private"
        assert "Secret access keys" in data_root["content"]
        assert data_root["visibility"] == "private"

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_search_documents_guest_and_root(mock_data):
    """Security test: Guest search strictly returns public chunks; Root search returns private chunks too."""
    pub_doc, priv_doc, pub_chunk, priv_chunk = mock_data
    fake_session = FakeAsyncSession(pub_doc, priv_doc, pub_chunk, priv_chunk)

    async def override_get_session():
        yield fake_session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Guest search
        resp_guest = await client.get("/api/search?q=secret+tokens")
        assert resp_guest.status_code == 200
        data_guest = resp_guest.json()
        for item in data_guest["results"]:
            assert item["visibility"] == "public"
            assert item["slug"] != "sample-private"

        # 2. Root search
        token = create_access_token(role="root")
        headers = {"Authorization": f"Bearer {token}"}
        resp_root = await client.get("/api/search?q=secret+tokens", headers=headers)
        assert resp_root.status_code == 200
        data_root = resp_root.json()
        results = data_root["results"]
        assert any(item["visibility"] == "private" and item["slug"] == "sample-private" for item in results)

    app.dependency_overrides.clear()
