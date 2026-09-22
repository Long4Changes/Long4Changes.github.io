import os
import hmac
import hashlib
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models import Document, DocumentChunk
from backend.app.ingestion import ingest_document

def get_webhook_secret() -> str:
    return os.getenv("GITHUB_WEBHOOK_SECRET", "cyberkb-github-webhook-secret-2026")

def verify_github_signature(payload_bytes: bytes, signature_header: Optional[str], secret: Optional[str] = None) -> bool:
    """Validate GitHub webhook HMAC-SHA256 signature."""
    if not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False

    webhook_secret = secret or get_webhook_secret()
    expected_hash = signature_header[7:].strip()
    mac = hmac.new(
        webhook_secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256
    )
    return hmac.compare_digest(mac.hexdigest(), expected_hash)

def parse_github_push_diff(payload: Dict[str, Any]) -> Dict[str, List[str]]:
    """Extract added, modified, and removed Markdown file paths from GitHub push payload."""
    added_set = set()
    modified_set = set()
    removed_set = set()

    commits = payload.get("commits", [])
    for c in commits:
        for path in c.get("added", []):
            if path.endswith(".md"):
                added_set.add(path)
        for path in c.get("modified", []):
            if path.endswith(".md"):
                modified_set.add(path)
        for path in c.get("removed", []):
            if path.endswith(".md"):
                removed_set.add(path)

    # If removed, remove from added / modified
    added_set = added_set - removed_set
    modified_set = modified_set - removed_set

    return {
        "added": sorted(list(added_set)),
        "modified": sorted(list(modified_set)),
        "removed": sorted(list(removed_set))
    }

async def delete_document_by_slug(slug: str, db: AsyncSession) -> bool:
    """Delete Document and all its associated DocumentChunks atomically."""
    stmt = select(Document).where(Document.slug == slug)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        return False

    stmt_chunks = select(DocumentChunk).where(DocumentChunk.document_id == doc.id)
    chunk_res = await db.execute(stmt_chunks)
    for chunk in chunk_res.scalars().all():
        await db.delete(chunk)

    await db.delete(doc)
    await db.commit()
    return True

def resolve_content_dir() -> str:
    env_dir = os.getenv("CONTENT_DIR", "")
    if env_dir and os.path.exists(env_dir):
        return env_dir
    for c in ["content", "backend/content", "../content", "../backend/content"]:
        if os.path.exists(c) and os.path.isdir(c):
            return c
    return "backend/content"

def resolve_file_path(path: str, base_dir: str = "") -> Optional[str]:
    candidates = [
        os.path.join(base_dir, path) if base_dir else path,
        os.path.join("backend", path),
        os.path.join("..", path),
        path.replace("content/", "backend/content/") if path.startswith("content/") else "",
        path.replace("backend/content/", "content/") if path.startswith("backend/content/") else "",
    ]
    for c in candidates:
        if c and os.path.exists(c) and os.path.isfile(c):
            return c
    return None

async def sync_repository_documents(
    content_dir: Optional[str] = None,
    db: AsyncSession = None
) -> Dict[str, Any]:
    """Full repository scan and index synchronization."""
    target_dir = content_dir or resolve_content_dir()
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)

    synced = []
    for root, _, files in os.walk(target_dir):
        for file in sorted(files):
            if file.endswith(".md"):
                full_path = os.path.join(root, file)
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
                doc = await ingest_document(content, db)
                synced.append(doc.slug)

    return {
        "status": "synchronized",
        "synced_documents": synced,
        "total": len(synced)
    }

async def process_webhook_diff(
    diff: Dict[str, List[str]],
    base_dir: str = "",
    db: AsyncSession = None
) -> Dict[str, Any]:
    """Process added, modified, and removed files from webhook push."""
    updated = []
    removed = []

    for path in diff.get("added", []) + diff.get("modified", []):
        full_path = resolve_file_path(path, base_dir=base_dir)
        if full_path and os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
            doc = await ingest_document(content, db)
            updated.append(doc.slug)

    for path in diff.get("removed", []):
        slug = os.path.splitext(os.path.basename(path))[0]
        deleted = await delete_document_by_slug(slug, db)
        if deleted:
            removed.append(slug)

    return {
        "status": "processed",
        "updated": updated,
        "removed": removed
    }
