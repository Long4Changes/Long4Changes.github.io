import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchDocumentCatalog,
  fetchDocument,
  searchDocuments,
  loginAuth,
  clearAuthSession,
  getAuthRole
} from '../services/api'

describe('API Service Unit & Auth Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAuthSession()
  })

  it('falls back to local document catalog if no API is configured', async () => {
    const catalog = await fetchDocumentCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(3)
    const slugs = catalog.map(c => c.slug)
    expect(slugs).toContain('ark')
    expect(slugs).toContain('articles')
    expect(slugs).toContain('about')
    expect(slugs).not.toContain('secret-vault')
  })

  it('falls back to local document detail if no API is configured', async () => {
    const doc = await fetchDocument('ark')
    expect(doc.slug).toBe('ark')
    expect(doc.title).toContain('扁舟')
    expect(doc.content).toContain('这是一艘飞船。')
  })

  it('blocks guest from opening private documents with permission denied', async () => {
    await expect(fetchDocument('secret-vault')).rejects.toThrow(/Permission denied.*private document/)
  })

  it('allows root to open private documents after authentication', async () => {
    const authRes = await loginAuth('cyberkb-root-secret')
    expect(authRes.role).toBe('root')
    expect(getAuthRole()).toBe('root')

    const doc = await fetchDocument('secret-vault')
    expect(doc.slug).toBe('secret-vault')
    expect(doc.visibility).toBe('private')
    expect(doc.content).toContain('机密知识切片')
  })

  it('rejects invalid passkey', async () => {
    await expect(loginAuth('incorrect-secret')).rejects.toThrow('Invalid administrative passkey.')
    expect(getAuthRole()).toBe('guest')
  })

  it('performs fallback keyword search: guest sees only public, root sees private', async () => {
    // 1. Guest search for '机密'
    const guestResults = await searchDocuments('机密')
    expect(guestResults.length).toBe(0)

    // 2. Root search for '机密'
    await loginAuth('cyberkb-root-secret')
    const rootResults = await searchDocuments('机密')
    expect(rootResults.length).toBe(1)
    expect(rootResults[0].slug).toBe('secret-vault')
    expect(rootResults[0].visibility).toBe('private')
  })
})
