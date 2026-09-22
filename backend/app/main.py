from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from backend.app.database import get_session
from backend.app.models import Document, DocumentChunk
from backend.app.embedding import get_embeddings
from backend.app.auth import (
    create_access_token,
    verify_passkey,
    get_current_role
)

app = FastAPI(title="CyberKB Terminal API", version="0.2.0")

# Enable CORS for frontend clients (GitHub Pages & local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    passkey: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class SearchResultItem(BaseModel):
    slug: str
    title: str
    chunk_index: int
    content: str
    similarity: float
    visibility: str = "public"

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]

class DocumentListItem(BaseModel):
    slug: str
    title: str
    visibility: str = "public"

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

@app.post("/api/auth", response_model=AuthResponse)
async def login_auth(req: AuthRequest):
    """Authenticate with owner passkey and receive signed JWT."""
    if not verify_passkey(req.passkey):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative passkey"
        )
    token = create_access_token(role="root")
    return AuthResponse(access_token=token, token_type="bearer", role="root")

@app.get("/api/documents", response_model=DocumentListResponse)
async def list_documents(
    role: str = Depends(get_current_role),
    db: AsyncSession = Depends(get_session)
):
    """List documents. Guests see public only; root sees all."""
    stmt = select(Document.slug, Document.title, Document.visibility)
    if role != "root":
        stmt = stmt.where(Document.visibility == "public")
    stmt = stmt.order_by(Document.slug)

    res = await db.execute(stmt)
    docs = [
        DocumentListItem(slug=row[0], title=row[1], visibility=row[2])
        for row in res.all()
    ]
    return DocumentListResponse(documents=docs)

@app.get("/api/documents/{slug}", response_model=DocumentDetailResponse)
async def get_document(
    slug: str,
    role: str = Depends(get_current_role),
    db: AsyncSession = Depends(get_session)
):
    """Fetch full markdown content of a document. Private docs require root role."""
    stmt = select(Document).where(Document.slug == slug)
    if role != "root":
        stmt = stmt.where(Document.visibility == "public")

    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        if role != "root":
            # Check if document exists as private to return explicit 403 Forbidden
            check_stmt = select(Document).where(Document.slug == slug)
            check_res = await db.execute(check_stmt)
            if check_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Document '{slug}' is private. Authentication required."
                )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{slug}' not found"
        )

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
    role: str = Depends(get_current_role),
    db: AsyncSession = Depends(get_session)
):
    """Execute vector cosine similarity search. Root role retrieves both public and private chunks."""
    query_embeddings = get_embeddings([q])
    if not query_embeddings or not query_embeddings[0]:
        raise HTTPException(status_code=500, detail="Failed to generate search embedding")
    query_vec = query_embeddings[0]

    # Use pgvector cosine distance: lower is closer.
    distance_expr = DocumentChunk.embedding.cosine_distance(query_vec).label("distance")

    stmt = (
        select(
            Document.slug,
            Document.title,
            DocumentChunk.chunk_index,
            DocumentChunk.content,
            distance_expr,
            Document.visibility
        )
        .join(Document, Document.id == DocumentChunk.document_id)
    )

    if role != "root":
        stmt = stmt.where(Document.visibility == "public")

    stmt = stmt.order_by(distance_expr).limit(limit)

    res = await db.execute(stmt)
    items: List[SearchResultItem] = []
    for row in res.all():
        slug, title, chunk_idx, content, dist, visibility = row
        similarity = round(max(0.0, 1.0 - (dist if dist is not None else 1.0)), 4)
        items.append(
            SearchResultItem(
                slug=slug,
                title=title,
                chunk_index=chunk_idx,
                content=content,
                similarity=similarity,
                visibility=visibility
            )
        )

    return SearchResponse(query=q, results=items)
