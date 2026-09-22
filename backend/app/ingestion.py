from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models import Document, DocumentChunk
from backend.app.parser import parse_markdown
from backend.app.chunker import chunk_text
from backend.app.embedding import get_embeddings
from datetime import datetime, timezone

async def ingest_document(markdown_content: str, db: AsyncSession):
    # Parse Markdown
    parsed = parse_markdown(markdown_content)
    
    # Check if doc exists
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
        await db.commit()
        await db.refresh(doc)
    else:
        doc.title = parsed["title"]
        doc.content = parsed["content"]
        doc.visibility = parsed["visibility"]
        doc.updated_at = datetime.now(timezone.utc)
        await db.commit()
        
    # Delete existing chunks
    stmt_chunks = select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
    chunks_result = await db.execute(stmt_chunks)
    for chunk in chunks_result.scalars().all():
        await db.delete(chunk)
    await db.commit()
    
    # Chunk text
    chunks = chunk_text(parsed["content"])
    if not chunks:
        return doc
        
    # Generate embeddings
    embeddings = get_embeddings(chunks)
    
    # Save new chunks
    for i, (chunk_text_str, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_obj = DocumentChunk(
            document_id=doc.id,
            chunk_index=i,
            content=chunk_text_str,
            embedding=embedding
        )
        db.add(chunk_obj)
        
    await db.commit()
    return doc