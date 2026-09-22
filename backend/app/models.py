from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, String, Text

class Document(SQLModel, table=True):
    __tablename__ = "documents"
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True)
    title: str
    content: str = Field(sa_column=Column(Text))
    visibility: str = Field(default="public")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    chunks: List["DocumentChunk"] = Relationship(back_populates="document")

class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents.id")
    chunk_index: int
    content: str = Field(sa_column=Column(Text))
    embedding: Optional[List[float]] = Field(sa_column=Column(Vector(1024)))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    document: Document = Relationship(back_populates="chunks")