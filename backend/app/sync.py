import os
import subprocess
import hmac
import hashlib
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models import Document
from backend.app.ingestion import ingest_document, purge_document_chunks

class PushDiff(BaseModel):
    added: List[str]
    modified: List[str]
    removed: List[str]

class SyncSummary(BaseModel):
    status: str
    synced_documents: List[str]
    total: int

class WebhookSummary(BaseModel):
    status: str
    updated: List[str]
    removed: List[str]

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

def parse_github_push_diff(payload: Dict[str, Any]) -> PushDiff:
    """Extract added, modified, and removed Markdown Document paths from GitHub push payload."""
    added_set = set()
    modified_set = set()
    removed_set = set()

    commits = payload.get("commits", [])
    for commit_obj in commits:
        for path in commit_obj.get("added", []):
            if path.endswith(".md"):
                added_set.add(path)
        for path in commit_obj.get("modified", []):
            if path.endswith(".md"):
                modified_set.add(path)
        for path in commit_obj.get("removed", []):
            if path.endswith(".md"):
                removed_set.add(path)

    # If removed, purge from added / modified sets
    added_set = added_set - removed_set
    modified_set = modified_set - removed_set

    return PushDiff(
        added=sorted(list(added_set)),
        modified=sorted(list(modified_set)),
        removed=sorted(list(removed_set))
    )

async def delete_document_by_slug(slug: str, db: AsyncSession) -> bool:
    """Delete Document and all its associated DocumentChunks atomically."""
    stmt = select(Document).where(Document.slug == slug)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        return False

    await purge_document_chunks(doc.id, db)
    await db.delete(doc)
    await db.commit()
    return True

def resolve_content_dir() -> str:
    env_dir = os.getenv("CONTENT_DIR", "")
    if env_dir and os.path.exists(env_dir):
        return env_dir
    for candidate_dir in ["content", "backend/content", "../content", "../backend/content"]:
        if os.path.exists(candidate_dir) and os.path.isdir(candidate_dir):
            return candidate_dir
    return "backend/content"

def resolve_document_file_path(path: str) -> Optional[str]:
    candidates = [
        path,
        os.path.join("backend", path),
        os.path.join("..", path),
        path.replace("content/", "backend/content/") if path.startswith("content/") else "",
        path.replace("backend/content/", "content/") if path.startswith("backend/content/") else "",
    ]
    for candidate_path in candidates:
        if candidate_path and os.path.exists(candidate_path) and os.path.isfile(candidate_path):
            return candidate_path
    return None

async def ingest_markdown_file(file_path: str, db: AsyncSession) -> Optional[str]:
    """Read a Markdown file and ingest it into the database."""
    if not os.path.exists(file_path):
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    doc = await ingest_document(content, db)
    return doc.slug

def pull_repository_changes() -> bool:
    """Optionally perform git pull to synchronize working tree if running in a Git clone."""
    try:
        res = subprocess.run(
            ["git", "pull", "--ff-only"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
            text=True
        )
        return res.returncode == 0
    except Exception:
        return False

async def sync_repository_documents(
    content_dir: Optional[str] = None,
    db: AsyncSession = None
) -> SyncSummary:
    """Full repository pull and index verification."""
    # Attempt to pull latest changes from upstream repository
    pull_repository_changes()

    target_dir = content_dir or resolve_content_dir()
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)

    synced = []
    for root, _, files in os.walk(target_dir):
        for file in sorted(files):
            if file.endswith(".md"):
                full_path = os.path.join(root, file)
                slug = await ingest_markdown_file(full_path, db)
                if slug:
                    synced.append(slug)

    return SyncSummary(
        status="synchronized",
        synced_documents=synced,
        total=len(synced)
    )

async def process_webhook_diff(
    diff: PushDiff,
    db: AsyncSession = None
) -> WebhookSummary:
    """Process added, modified, and removed Documents from webhook push."""
    # Pull latest Git commits to ensure local working tree has new files
    pull_repository_changes()

    updated = []
    removed = []

    for path in diff.added + diff.modified:
        full_path = resolve_document_file_path(path)
        if full_path:
            slug = await ingest_markdown_file(full_path, db)
            if slug:
                updated.append(slug)

    for path in diff.removed:
        slug = os.path.splitext(os.path.basename(path))[0]
        deleted = await delete_document_by_slug(slug, db)
        if deleted:
            removed.append(slug)

    return WebhookSummary(
        status="processed",
        updated=updated,
        removed=removed
    )
