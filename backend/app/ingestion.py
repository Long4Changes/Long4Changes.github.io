from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models import Document, DocumentChunk
from backend.app.parser import parse_markdown
from backend.app.chunker import chunk_text
from backend.app.embedding import get_embeddings
from datetime import datetime, timezone

async def purge_document_chunks(document_id: int, db: AsyncSession) -> int:
    """Purge all DocumentChunks belonging to a Document."""
    stmt_chunks = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    chunks_result = await db.execute(stmt_chunks)
    count = 0
    for chunk in chunks_result.scalars().all():
        await db.delete(chunk)
        count += 1
    return count

async def ingest_document(markdown_content: str, db: AsyncSession) -> Document:
    """Ingest a Markdown document with atomic updates to Documents and pgvector chunks."""
    # 1. Parse Markdown & generate chunks and embeddings upfront
    parsed = parse_markdown(markdown_content)
    chunks = chunk_text(parsed["content"])
    embeddings = get_embeddings(chunks) if chunks else []

    try:
        # 2. Find or create Document record
        stmt = select(Document).where(Document.slug == parsed["slug"])
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()

        if not doc:
            doc = Document(
                slug=parsed["slug"],
                title=parsed["title"],
                content=parsed["content"],
                visibility=parsed["visibility"]
            )
            db.add(doc)
            await db.flush()  # Generate doc.id without committing transaction
        else:
            doc.title = parsed["title"]
            doc.content = parsed["content"]
            doc.visibility = parsed["visibility"]
            doc.updated_at = datetime.now(timezone.utc)
            # Purge existing chunks in the same transaction
            await purge_document_chunks(doc.id, db)

        # 3. Insert newly generated chunks with embeddings
        for i, (chunk_text_str, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_obj = DocumentChunk(
                document_id=doc.id,
                chunk_index=i,
                content=chunk_text_str,
                embedding=embedding
            )
            db.add(chunk_obj)

        # 4. Atomically commit document and all vector chunks
        await db.commit()
        await db.refresh(doc)
        return doc
    except Exception:
        await db.rollback()
        raise