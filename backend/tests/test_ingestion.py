import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select
from backend.app.models import Document, DocumentChunk
from backend.app.parser import parse_markdown
from backend.app.chunker import chunk_text
from backend.app.ingestion import ingest_document
import os

# Use an in-memory SQLite database for testing, since pgvector mock is needed
# Actually, SQLite does not support Vector type directly.
# For simplicity, we can rely on standard postgres testing or mock Vector.
# To fully test pgvector, we need a postgres instance. Let us assume DATABASE_URL points to one.
# For now, we will test the parser and chunker locally without DB, and run integration test on postgres.

def test_parser():
    content = "---\ntitle: Test Title\nslug: test-slug\nvisibility: private\n---\n\nBody text here."
    parsed = parse_markdown(content)
    assert parsed["title"] == "Test Title"
    assert parsed["slug"] == "test-slug"
    assert parsed["visibility"] == "private"
    assert parsed["content"] == "Body text here."

def test_chunker():
    text = "A" * 1000
    chunks = chunk_text(text)
    assert len(chunks) > 1

@pytest.mark.asyncio
async def test_database_ingestion():
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Try to initialize db, but create pgvector extension first
    async with engine.begin() as conn:
        from sqlalchemy import text
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
        
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    os.environ["MOCK_EMBEDDINGS"] = "1"
    
    async with async_session() as db:
        with open("backend/content/sample-public.md", "r") as f:
            await ingest_document(f.read(), db)
        with open("backend/content/sample-private.md", "r") as f:
            await ingest_document(f.read(), db)
            
    async with async_session() as db:
        # Verify visibility partitioning
        stmt = select(DocumentChunk).join(Document).where(Document.visibility == "public")
        result = await db.execute(stmt)
        public_chunks = result.scalars().all()
        assert len(public_chunks) > 0
        
        stmt = select(DocumentChunk).join(Document).where(Document.visibility == "private")
        result = await db.execute(stmt)
        private_chunks = result.scalars().all()
        assert len(private_chunks) > 0