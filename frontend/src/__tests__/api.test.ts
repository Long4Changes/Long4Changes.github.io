import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchDocumentCatalog,
  fetchDocument,
  searchDocuments,
  loginAuth,
  clearAuthSession,
  getAuthRole,
  getAuthToken,
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
})
