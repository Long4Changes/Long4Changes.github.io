import os
import json
import asyncio
import httpx
from typing import AsyncGenerator, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.models import Document, DocumentChunk
from backend.app.embedding import get_embeddings

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MOCK_LLM = os.getenv("MOCK_LLM", "0")

async def retrieve_rag_context(
    query: str,
    role: str,
    db: AsyncSession,
    limit: int = 4
) -> List[Dict[str, Any]]:
    """Retrieve top-k relevant chunks matching query filtered by caller Role and Document Visibility."""
    query_embeddings = get_embeddings([query])
    if not query_embeddings or not query_embeddings[0]:
        return []
    query_vec = query_embeddings[0]

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
    chunks = []
    for row in res.all():
        slug, title, chunk_idx, content, dist, visibility = row
        chunks.append({
            "slug": slug,
            "title": title,
            "chunk_index": chunk_idx,
            "content": content,
            "visibility": visibility,
            "similarity": round(max(0.0, 1.0 - (dist if dist is not None else 1.0)), 4)
        })
    return chunks

def extract_citations(chunks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Deduplicate citations from retrieved chunks."""
    seen = set()
    citations = []
    for c in chunks:
        slug = c["slug"]
        if slug not in seen:
            seen.add(slug)
            citations.append({
                "slug": slug,
                "title": c["title"],
                "visibility": c.get("visibility", "public")
            })
    return citations

def build_rag_prompts(query: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Construct system prompt and user prompt strictly grounded in retrieved chunks with citation markers."""
    system_prompt = (
        "You are the CyberKB Terminal Knowledge Assistant.\n"
        "Your task is to provide an accurate, concise, and professional answer to the user's question, "
        "grounded strictly and solely in the provided Reference Context.\n"
        "Guidelines:\n"
        "1. If the provided context does not contain enough information to answer the question, clearly state that "
        "the knowledge base does not contain this information.\n"
        "2. Do not invent or assume facts not present in the reference context.\n"
        "3. Explicitly insert inline citation markers (e.g., [1] or [ark]) immediately following facts derived from reference chunks.\n"
        "4. Reply in Chinese by default unless the question explicitly asks for another language.\n"
        "5. Format any technical content cleanly using monospace conventions."
    )

    if not chunks:
        context_str = "【暂无相关知识库切片】"
    else:
        parts = []
        for i, c in enumerate(chunks, start=1):
            parts.append(
                f"[{i}] 文档: {c['title']} (slug: {c['slug']}, 可见性: {c.get('visibility', 'public')})\n"
                f"{c['content']}"
            )
        context_str = "\n\n---\n\n".join(parts)

    user_message = (
        f"【参考知识库上下文】:\n{context_str}\n\n"
        f"【用户问题】: {query}\n\n"
        f"请依据上述知识切片进行回答："
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]

async def stream_rag_answer(
    query: str,
    role: str,
    db: AsyncSession
) -> AsyncGenerator[str, None]:
    """Execute RAG pipeline and yield Server-Sent Events (SSE)."""
    chunks = await retrieve_rag_context(query, role, db)
    citations = extract_citations(chunks)

    # 1. If mock LLM mode or API key not set, yield mock stream for testing/offline
    is_mock = os.getenv("MOCK_LLM", "0") == "1" or not os.getenv("DEEPSEEK_API_KEY")
    if is_mock:
        if not chunks:
            text = f"抱歉，知识库中未检索到与“{query}”相关的信息。"
        else:
            titles = "、".join([c['title'] for c in citations])
            text = f"基于【{titles}】的记录：针对您的问题“{query}”，知识切片已成功匹配并给出回答。"

        words = [text[i:i+4] for i in range(0, len(text), 4)]
        for w in words:
            yield f"event: delta\ndata: {json.dumps({'content': w}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.005)

        yield f"event: citations\ndata: {json.dumps({'citations': citations}, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"
        return

    # 2. Live DeepSeek API Streaming
    messages = build_rag_prompts(query, chunks)
    url = f"{DEEPSEEK_BASE_URL.rstrip('/')}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "stream": True,
        "temperature": 0.3
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    err_msg = f"DeepSeek API error ({response.status_code}): {err_body.decode('utf-8', errors='ignore')}"
                    yield f"event: error\ndata: {json.dumps({'error': err_msg}, ensure_ascii=False)}\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            delta = data_json.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                yield f"event: delta\ndata: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        return

    yield f"event: citations\ndata: {json.dumps({'citations': citations}, ensure_ascii=False)}\n\n"
    yield "event: done\ndata: [DONE]\n\n"
