export interface DocumentItem {
  slug: string
  title: string
  visibility?: string
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
  visibility?: string
}

export interface SearchResponse {
  query: string
  results: SearchResultItem[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  role: string
}

const API_BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'cyberkb_auth_token'
const ROLE_KEY = 'cyberkb_auth_role'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAuthRole(): 'guest' | 'root' {
  try {
    return (localStorage.getItem(ROLE_KEY) as 'guest' | 'root') || 'guest'
  } catch {
    return 'guest'
  }
}

export function setAuthSession(token: string, role: string = 'root') {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // Ignore storage failure
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
  } catch {
    // Ignore
  }
}

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
  },
  'secret-vault': {
    slug: 'secret-vault',
    title: '私有保险箱 (Private Vault)',
    content: `# 私有归档与内部手记

> [!CAUTION]
> 机密知识切片：仅限拥有 root 权限的所有者访问。

- 内部部署配置与私钥凭证
- 个人未公开研究计划与架构草稿
- 离线知识库全量索引
`,
    visibility: 'private'
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function loginAuth(passkey: string): Promise<AuthResponse> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ passkey })
      })
      if (res.ok) {
        const data: AuthResponse = await res.json()
        setAuthSession(data.access_token, data.role)
        return data
      }
      if (res.status === 401) {
        throw new Error('Invalid administrative passkey.')
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid administrative passkey')) {
        throw err
      }
      // Fallback
    }
  }

  // Local fallback auth
  if (passkey === 'cyberkb-root-secret' || passkey === 'owner123') {
    const authData: AuthResponse = {
      access_token: 'mock-root-jwt-token-2026',
      token_type: 'bearer',
      role: 'root'
    }
    setAuthSession(authData.access_token, authData.role)
    return authData
  }

  throw new Error('Invalid administrative passkey.')
}

export async function fetchDocumentCatalog(): Promise<DocumentItem[]> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: getAuthHeaders()
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

  const role = getAuthRole()
  return Object.values(FALLBACK_DOCUMENTS)
    .filter(d => role === 'root' || d.visibility === 'public')
    .map(d => ({
      slug: d.slug,
      title: d.title,
      visibility: d.visibility
    }))
}

export async function fetchDocument(slug: string): Promise<DocumentDetail> {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(slug)}`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        return await res.json()
      }
      if (res.status === 403) {
        throw new Error(`Permission denied: '${slug}' is a private document. Run 'sudo su' or 'auth' to authenticate.`)
      }
      if (res.status === 404) {
        throw new Error(`Document '${slug}' not found.`)
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Permission denied') || err.message.includes('not found'))) {
        throw err
      }
      // Fallback
    }
  }

  const role = getAuthRole()
  const fallback = FALLBACK_DOCUMENTS[slug]
  if (fallback) {
    if (fallback.visibility === 'private' && role !== 'root') {
      throw new Error(`Permission denied: '${slug}' is a private document. Run 'sudo su' or 'auth' to authenticate.`)
    }
    return fallback
  }
  throw new Error(`Document '${slug}' not found.`)
}

export async function searchDocuments(query: string, limit: number = 5): Promise<SearchResultItem[]> {
  if (API_BASE) {
    try {
      const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
      const res = await fetch(url, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data: SearchResponse = await res.json()
        return data.results || []
      }
    } catch {
      // Fallback
    }
  }

  const role = getAuthRole()
  const qLower = query.toLowerCase()
  const results: SearchResultItem[] = []

  for (const doc of Object.values(FALLBACK_DOCUMENTS)) {
    if (doc.visibility === 'private' && role !== 'root') {
      continue
    }
    if (doc.title.toLowerCase().includes(qLower) || doc.content.toLowerCase().includes(qLower)) {
      const excerpt = doc.content.slice(0, 120).replace(/\n/g, ' ') + '...'
      results.push({
        slug: doc.slug,
        title: doc.title,
        chunk_index: 0,
        content: excerpt,
        similarity: doc.visibility === 'private' ? 0.95 : 0.88,
        visibility: doc.visibility
      })
    }
  }
  return results
}
