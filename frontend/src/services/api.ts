export interface DocumentItem {
  slug: string
  title: string
}

export interface DocumentDetail {
  slug: string
  title: string
  content: string
  visibility: string
  updated_at?: string
}

export interface SearchResultItem {
  slug: string
  title: string
  chunk_index: number
  content: string
  similarity: number
}

export interface SearchResponse {
  query: string
  results: SearchResultItem[]
}

const API_BASE = import.meta.env.VITE_API_URL || ''

export const FALLBACK_DOCUMENTS: Record<string, DocumentDetail> = {
  ark: {
    slug: 'ark',
    title: '扁舟 (Ark Project)',
    content: `# 扁舟 (Ark Project)

> 「在星际迷航与记忆回廊中穿行的黑客终端。」

这是一艘飞船。在星际空间中穿行，提供知识归档与检索。

## 系统概述
扁舟是一个基于语义向量检索与大模型问答的个人知识库系统。
采用纯黑白高对比、零圆角、零阴影的 ASCII 视窗卡片交互。

\`\`\`python
# 示例语义检索核心调用
def vector_search(query: str, limit: int = 5):
    return db.query("SELECT * FROM chunks WHERE cosine_dist(vec, q) < 0.3")
\`\`\`

## 交互指令
- 输入 \`help\` 查看可用指令列表
- 输入 \`search <关键词>\` 触发向量语义检索
- 输入 \`open <slug>\` 或 \`cat <slug>\` 打开对应卡片视窗
`,
    visibility: 'public'
  },
  articles: {
    slug: 'articles',
    title: '文章索引 (Articles)',
    content: `# 归档文章与手记

## 目录
1. **01_arch**: 关于极简终端交互界面的设计思考
2. **02_vector**: 向量数据库与 pgvector 实践
3. **03_deepseek**: 本地与私有化知识库问答构建

输入 \`search <query>\` 可跨文章进行切片检索。
`,
    visibility: 'public'
  },
  about: {
    slug: 'about',
    title: '关于作者 (About)',
    content: `# 关于 Long4Changes

软件工程师 / 系统黑客 / 开源爱好者。

- GitHub: [Long4Changes](https://github.com/Long4Changes)
- 理念: 简约、确定性、高信息密度。
`,
    visibility: 'public'
  }
}

export async function fetchDocumentCatalog(): Promise<DocumentItem[]> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: { Accept: 'application/json' }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.documents) && data.documents.length > 0) {
          return data.documents
        }
      }
    } catch {
      // Backend unreachable, fallback gracefully
    }
  }

  return Object.values(FALLBACK_DOCUMENTS).map(d => ({
    slug: d.slug,
    title: d.title
  }))
}

export async function fetchDocument(slug: string): Promise<DocumentDetail> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json' }
      })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Network unreachable, fallback gracefully
    }
  }

  const fallback = FALLBACK_DOCUMENTS[slug]
  if (fallback) {
    return fallback
  }
  throw new Error(`Document '${slug}' not found.`)
}

export async function searchDocuments(query: string, limit: number = 5): Promise<SearchResultItem[]> {
  if (API_BASE) {
    try {
      const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
      const res = await fetch(url, {
        headers: { Accept: 'application/json' }
      })
      if (res.ok) {
        const data: SearchResponse = await res.json()
        return data.results || []
      }
    } catch {
      // Backend unreachable, fallback to client-side text match
    }
  }

  // Client-side fallback search
  const qLower = query.toLowerCase()
  const results: SearchResultItem[] = []
  for (const doc of Object.values(FALLBACK_DOCUMENTS)) {
    if (doc.title.toLowerCase().includes(qLower) || doc.content.toLowerCase().includes(qLower)) {
      const excerpt = doc.content.slice(0, 120).replace(/\n/g, ' ') + '...'
      results.push({
        slug: doc.slug,
        title: doc.title,
        chunk_index: 0,
        content: excerpt,
        similarity: 0.88
      })
    }
  }
  return results
}
