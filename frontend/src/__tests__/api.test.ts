import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchDocumentCatalog,
  fetchDocument,
  searchDocuments,
  askQuestionStream,
  loginAuth,
  clearAuthSession,
  setAuthSession,
  getAuthRole,
  getAuthToken,
  syncDocuments,
  setApiBase
} from '../services/api'

describe('API Service Unit & Auth Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
    setApiBase('')
  })

  it('falls back to local document catalog if backend is unreachable', async () => {
    setApiBase('')
    const catalog = await fetchDocumentCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(3)
    const slugs = catalog.map(c => c.slug)
    expect(slugs).toContain('ark')
    expect(slugs).toContain('articles')
    expect(slugs).toContain('about')
  })

  it('falls back to local document detail for public docs if backend is unreachable', async () => {
    setApiBase('')
    const doc = await fetchDocument('ark')
    expect(doc.slug).toBe('ark')
    expect(doc.title).toContain('扁舟')
    expect(doc.content).toContain('这是一艘飞船。')
    expect(doc.visibility).toBe('public')
  })

  it('authenticates with backend POST /api/auth and stores JWT session', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({
        access_token: 'signed-jwt-token-xyz',
        token_type: 'bearer',
        role: 'root'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    const authRes = await loginAuth('correct-passkey')
    expect(authRes.role).toBe('root')
    expect(getAuthRole()).toBe('root')
    expect(getAuthToken()).toBe('signed-jwt-token-xyz')
  })

  it('rejects invalid passkey with 401 error', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ detail: 'Invalid administrative passkey' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    await expect(loginAuth('wrong-passkey')).rejects.toThrow('Invalid administrative passkey.')
    expect(getAuthRole()).toBe('guest')
  })

  it('blocks guest from private documents with 403 Forbidden', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ detail: 'Private' }), { status: 403 })
    })

    await expect(fetchDocument('secret-doc')).rejects.toThrow(/Visibility restricted.*private/)
  })

  it('retrieves private documents when authenticated as root', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({
        slug: 'secret-doc',
        title: 'Secret Notes',
        content: '# Secret Content',
        visibility: 'private',
        updated_at: '2026-09-22T00:00:00Z'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    const doc = await fetchDocument('secret-doc')
    expect(doc.slug).toBe('secret-doc')
    expect(doc.visibility).toBe('private')
    expect(doc.content).toBe('# Secret Content')
  })

  it('performs search and returns private chunks when root', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({
        query: 'confidential',
        results: [
          {
            slug: 'secret-doc',
            title: 'Secret Notes',
            chunk_index: 0,
            content: 'Confidential credentials',
            similarity: 0.94,
            visibility: 'private'
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    const results = await searchDocuments('confidential')
    expect(results.length).toBe(1)
    expect(results[0].slug).toBe('secret-doc')
    expect(results[0].visibility).toBe('private')
  })

  it('streams RAG answer and citations via askQuestionStream with SSE response', async () => {
    setApiBase('http://localhost:8000')

    const sseBody = [
      'event: delta',
      'data: {"content": "扁舟是一艘"}',
      '',
      'event: delta',
      'data: {"content": "飞船。"}',
      '',
      'event: citations',
      'data: {"citations": [{"slug": "ark", "title": "扁舟 (Ark Project)", "visibility": "public"}]}',
      '',
      'event: done',
      'data: [DONE]',
      ''
    ].join('\n')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody))
        controller.close()
      }
    })

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      })
    })

    let streamedTokens = ''
    let receivedCitations: any[] = []
    let isDone = false

    await askQuestionStream('什么是扁舟？', {
      onToken: (token) => { streamedTokens += token },
      onCitations: (citations) => { receivedCitations = citations },
      onDone: () => { isDone = true },
      onError: (err) => { throw err }
    })

    expect(streamedTokens).toBe('扁舟是一艘飞船。')
    expect(receivedCitations.length).toBe(1)
    expect(receivedCitations[0].slug).toBe('ark')
    expect(isDone).toBe(true)
  })

  it('streams fallback RAG answer when apiBase is not configured', async () => {
    setApiBase('')
    let streamedTokens = ''
    let isDone = false

    await askQuestionStream('飞船', {
      onToken: (token) => { streamedTokens += token },
      onCitations: () => {},
      onDone: () => { isDone = true },
      onError: (err) => { throw err }
    })

    expect(streamedTokens.length).toBeGreaterThan(0)
    expect(isDone).toBe(true)
  })

  it('syncDocuments rejects guest caller with permission denied error', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ detail: "Permission denied: 'sync' requires root" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    await expect(syncDocuments()).rejects.toThrow(/Permission denied.*requires root/)
  })

  it('syncDocuments succeeds for authenticated root', async () => {
    setApiBase('http://localhost:8000')
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
      return new Response(JSON.stringify({
        status: 'synchronized',
        synced_documents: ['sample-public', 'sample-private'],
        total: 2
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const result = await syncDocuments()
    expect(result.status).toBe('synchronized')
    expect(result.total).toBe(2)
    expect(result.synced_documents).toEqual(['sample-public', 'sample-private'])
  })

  it('syncDocuments offline fallback respects guest vs root', async () => {
    setApiBase('')
    clearAuthSession()
    // Guest
    await expect(syncDocuments()).rejects.toThrow(/Permission denied/)

    // Root
    setAuthSession('dummy-token', 'root')
    const result = await syncDocuments()
    expect(result.status).toBe('synchronized')
    expect(result.total).toBeGreaterThanOrEqual(3)
  })

  it('authenticates offline fallback with liangchen passkey', async () => {
    setApiBase('')
    clearAuthSession()
    const res = await loginAuth('liangchen')
    expect(res.role).toBe('root')
    expect(getAuthRole()).toBe('root')
  })
})


