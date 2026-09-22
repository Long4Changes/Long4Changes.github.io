from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk
from backend.app.embedding import get_embeddings

app = FastAPI(title="CyberKB Terminal API", version="0.1.0")

# Enable CORS for frontend clients (GitHub Pages & local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchResultItem(BaseModel):
    slug: str
    title: str
    chunk_index: int
    content: str
    similarity: float

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]

class DocumentListItem(BaseModel):
    slug: str
    title: str

class DocumentListResponse(BaseModel):
    documents: List[DocumentListItem]

class DocumentDetailResponse(BaseModel):
    slug: str
    title: str
    content: str
    visibility: str
    updated_at: datetime

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "CyberKB Terminal API"}

@app.get("/api/documents", response_model=DocumentListResponse)
async def list_documents(db: AsyncSession = Depends(get_session)):
    """List all public documents."""
    stmt = select(Document.slug, Document.title).where(Document.visibility == "public").order_by(Document.slug)
    res = await db.execute(stmt)
    docs = [DocumentListItem(slug=row[0], title=row[1]) for row in res.all()]
    return DocumentListResponse(documents=docs)

@app.get("/api/documents/{slug}", response_model=DocumentDetailResponse)
async def get_document(slug: str, db: AsyncSession = Depends(get_session)):
    """Fetch full markdown content of a public document."""
    stmt = select(Document).where(Document.slug == slug, Document.visibility == "public")
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{slug}' not found or permission denied")
    return DocumentDetailResponse(
        slug=doc.slug,
        title=doc.title,
        content=doc.content,
        visibility=doc.visibility,
        updated_at=doc.updated_at
    )

@app.get("/api/search", response_model=SearchResponse)
async def search_documents(
    q: str = Query(..., min_length=1, description="Semantic search query"),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_session)
):
    """Execute vector cosine similarity search over public document chunks."""
    query_embeddings = get_embeddings([q])
    if not query_embeddings or not query_embeddings[0]:
        raise HTTPException(status_code=500, detail="Failed to generate search embedding")
    query_vec = query_embeddings[0]

    # Use pgvector cosine distance: lower is closer.
    distance_expr = DocumentChunk.embedding.cosine_distance(query_vec).label("distance")

    stmt = (
        select(Document.slug, Document.title, DocumentChunk.chunk_index, DocumentChunk.content, distance_expr)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.visibility == "public")
        .order_by(distance_expr)
        .limit(limit)
    )

    res = await db.execute(stmt)
    items: List[SearchResultItem] = []
    for row in res.all():
        slug, title, chunk_idx, content, dist = row
        # Convert cosine distance to approximate similarity score (1 - distance)
        similarity = round(max(0.0, 1.0 - (dist if dist is not None else 1.0)), 4)
        items.append(
            SearchResultItem(
                slug=slug,
                title=title,
                chunk_index=chunk_idx,
                content=content,
                similarity=similarity
            )
        )

    return SearchResponse(query=q, results=items)
