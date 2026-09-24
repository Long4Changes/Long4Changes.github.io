export type Visibility = 'public' | 'private'
export type Role = 'guest' | 'root'

export interface DocumentItem {
  slug: string
  title: string
  visibility?: Visibility
}

export interface DocumentDetail {
  slug: string
  title: string
  content: string
  visibility: Visibility
  updated_at?: string
}

export interface SearchResultItem {
  slug: string
  title: string
  chunk_index: number
  content: string
  similarity: number
  visibility?: Visibility
}

export interface SearchResponse {
  query: string
  results: SearchResultItem[]
}

export interface AuthResponse {
  access_token: string
  token_type: string
  role: Role
}

let apiBase = import.meta.env.VITE_API_URL || ''
export function setApiBase(url: string) {
  apiBase = url
}
export function getApiBase(): string {
  return apiBase
}

const TOKEN_KEY = 'cyberkb_auth_token'
const ROLE_KEY = 'cyberkb_auth_role'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAuthRole(): Role {
  try {
    return (localStorage.getItem(ROLE_KEY) as Role) || 'guest'
  } catch {
    return 'guest'
  }
}

export function setAuthSession(token: string, role: Role = 'root') {
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

import { loadStaticDocuments } from './content-loader'

// ADR 0001: Only public documents are bundled for offline fallback
const staticDocs = loadStaticDocuments()
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
  ...staticDocs
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
  const cleanKey = (passkey || '').trim()

  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ passkey: cleanKey })
      })
      if (res.ok) {
        const data: AuthResponse = await res.json()
        setAuthSession(data.access_token, data.role)
        return data
      }
      if (res.status === 401) {
        throw new Error('Invalid administrative passkey.')
      }
      throw new Error(`Authentication error (status ${res.status})`)
    } catch (err: any) {
      if (err.message && err.message.includes('Invalid administrative passkey')) {
        throw err
      }
      throw new Error(`Authentication failed: ${err.message || 'backend unreachable'}`)
    }
  }

  // Offline / Static deployment fallback (e.g. GitHub Pages)
  if (cleanKey === 'liangchen' || cleanKey === 'cyberkb-root-secret' || cleanKey === 'cyberkb-root-secret-2026') {
    const mockToken = 'offline-root-session-token'
    setAuthSession(mockToken, 'root')
    return {
      access_token: mockToken,
      token_type: 'bearer',
      role: 'root'
    }
  }

  throw new Error('Invalid administrative passkey.')
}

export async function fetchDocumentCatalog(): Promise<DocumentItem[]> {
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/documents`, {
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
    .filter(d => role === 'root' || d.visibility !== 'private')
    .map(d => ({
      slug: d.slug,
      title: d.title,
      visibility: d.visibility
    }))
}

export async function fetchDocument(slug: string): Promise<DocumentDetail> {
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(slug)}`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        return await res.json()
      }
      if (res.status === 403) {
        throw new Error(`Visibility restricted: '${slug}' is private. Run 'sudo su' or 'auth' to authenticate.`)
      }
      if (res.status === 404) {
        if (!FALLBACK_DOCUMENTS[slug]) {
          throw new Error(`Document '${slug}' not found.`)
        }
      }
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('Visibility restricted') || err.message.includes('not found'))
      ) {
        throw err
      }
      // Fallback if network failed
    }
  }

  const fallback = FALLBACK_DOCUMENTS[slug]
  if (fallback) {
    if (fallback.visibility === 'private' && getAuthRole() !== 'root') {
      throw new Error(`Visibility restricted: '${slug}' is private. Run 'sudo su' or 'auth' to authenticate.`)
    }
    return fallback
  }
  throw new Error(`Document '${slug}' not found.`)
}

export function renameDocument(oldSlug: string, newSlug: string) {
  if (FALLBACK_DOCUMENTS[oldSlug]) {
    const orig = FALLBACK_DOCUMENTS[oldSlug]
    FALLBACK_DOCUMENTS[newSlug] = {
      ...orig,
      slug: newSlug,
      title: orig.title.includes(oldSlug) ? orig.title.replace(oldSlug, newSlug) : orig.title
    }
    delete FALLBACK_DOCUMENTS[oldSlug]
  }
}

export function removeDocument(slug: string) {
  if (FALLBACK_DOCUMENTS[slug]) {
    delete FALLBACK_DOCUMENTS[slug]
  }
}

export async function saveDocument(slug: string, content: string): Promise<DocumentDetail> {
  const cleanSlug = slug.replace(/\.md$/, '')
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/documents/${encodeURIComponent(cleanSlug)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        const data = await res.json()
        if (FALLBACK_DOCUMENTS[cleanSlug]) {
          FALLBACK_DOCUMENTS[cleanSlug].content = content
          FALLBACK_DOCUMENTS[cleanSlug].updated_at = data.updated_at || new Date().toISOString()
        }
        return data
      }
    } catch {
      // Fallback to local storage update
    }
  }

  if (FALLBACK_DOCUMENTS[cleanSlug]) {
    FALLBACK_DOCUMENTS[cleanSlug].content = content
    FALLBACK_DOCUMENTS[cleanSlug].updated_at = new Date().toISOString()
    return FALLBACK_DOCUMENTS[cleanSlug]
  }

  const newDoc: DocumentDetail = {
    slug: cleanSlug,
    title: cleanSlug,
    content,
    visibility: 'public',
    updated_at: new Date().toISOString()
  }
  FALLBACK_DOCUMENTS[cleanSlug] = newDoc
  return newDoc
}

export async function searchDocuments(query: string, limit: number = 5): Promise<SearchResultItem[]> {
  if (apiBase) {
    try {
      const url = `${apiBase}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
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

  const qLower = query.toLowerCase()
  const results: SearchResultItem[] = []
  const role = getAuthRole()

  for (const doc of Object.values(FALLBACK_DOCUMENTS)) {
    if (role !== 'root' && doc.visibility === 'private') {
      continue
    }
    if (doc.title.toLowerCase().includes(qLower) || doc.content.toLowerCase().includes(qLower)) {
      const excerpt = doc.content.slice(0, 120).replace(/\n/g, ' ') + '...'
      results.push({
        slug: doc.slug,
        title: doc.title,
        chunk_index: 0,
        content: excerpt,
        similarity: 0.88,
        visibility: doc.visibility
      })
    }
  }
  return results
}

export interface CitationItem {
  slug: string
  title: string
  visibility?: Visibility
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onCitations: (citations: CitationItem[]) => void
  onDone: () => void
  onError: (err: Error) => void
}

export async function askQuestionStream(
  query: string,
  callbacks: StreamCallbacks
): Promise<void> {
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/ask`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`)
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by response')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      let isCompleted = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) {
            currentEvent = ''
            continue
          }
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim()
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim()
            if (currentEvent === 'delta') {
              try {
                const parsed = JSON.parse(dataStr)
                if (parsed.content) {
                  callbacks.onToken(parsed.content)
                }
              } catch {}
            } else if (currentEvent === 'citations') {
              try {
                const parsed = JSON.parse(dataStr)
                if (Array.isArray(parsed.citations)) {
                  callbacks.onCitations(parsed.citations)
                }
              } catch {}
            } else if (currentEvent === 'done' || dataStr === '[DONE]') {
              if (!isCompleted) {
                isCompleted = true
                callbacks.onDone()
              }
            } else if (currentEvent === 'error') {
              try {
                const parsed = JSON.parse(dataStr)
                callbacks.onError(new Error(parsed.error || 'Stream error'))
              } catch {
                callbacks.onError(new Error(dataStr))
              }
            }
          }
        }
      }

      if (!isCompleted) {
        callbacks.onDone()
      }
      return
    } catch (err: any) {
      callbacks.onError(err)
      return
    }
  }

  // Fallback offline simulator
  const qLower = query.toLowerCase()
  const matchedDocs = Object.values(FALLBACK_DOCUMENTS).filter(
    d => d.title.toLowerCase().includes(qLower) || d.content.toLowerCase().includes(qLower)
  )

  const citations: CitationItem[] = matchedDocs.map(d => ({
    slug: d.slug,
    title: d.title,
    visibility: d.visibility
  }))

  const answer = matchedDocs.length > 0
    ? `基于知识库记录：针对您的问题“${query}”，相关系统切片已索引。`
    : `抱歉，本地知识库中未检索到与“${query}”相关的信息。`

  const chunkSize = 4
  for (let i = 0; i < answer.length; i += chunkSize) {
    callbacks.onToken(answer.slice(i, i + chunkSize))
    await new Promise(r => setTimeout(r, 10))
  }

  if (citations.length > 0) {
    callbacks.onCitations(citations)
  }
  callbacks.onDone()
}

export interface SyncResult {
  status: string
  synced_documents: string[]
  total: number
}

export async function syncDocuments(): Promise<SyncResult> {
  if (apiBase) {
    const res = await fetch(`${apiBase}/api/sync`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (res.status === 403) {
      throw new Error("Permission denied: 'sync' requires root administrative privileges. Run 'sudo su' or 'auth' to authenticate.")
    }
    if (!res.ok) {
      throw new Error(`Sync failed with status ${res.status}`)
    }
    return await res.json()
  }

  // Offline fallback (e.g. static mode)
  const role = getAuthRole()
  if (role !== 'root') {
    throw new Error("Permission denied: 'sync' requires root administrative privileges. Run 'sudo su' or 'auth' to authenticate.")
  }

  const fallbackSlugs = Object.keys(FALLBACK_DOCUMENTS)
  return {
    status: 'synchronized',
    synced_documents: fallbackSlugs,
    total: fallbackSlugs.length
  }
}

