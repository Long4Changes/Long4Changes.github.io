import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDocumentCatalog, fetchDocument, searchDocuments } from '../services/api'

describe('API Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to local document catalog if no API is configured or available', async () => {
    const catalog = await fetchDocumentCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(3)
    const slugs = catalog.map(c => c.slug)
    expect(slugs).toContain('ark')
    expect(slugs).toContain('articles')
    expect(slugs).toContain('about')
  })

  it('falls back to local document detail if no API is configured or available', async () => {
    const doc = await fetchDocument('ark')
    expect(doc.slug).toBe('ark')
    expect(doc.title).toContain('扁舟')
    expect(doc.content).toContain('这是一艘飞船。')
  })

  it('throws error when requesting non-existent slug with fallback', async () => {
    await expect(fetchDocument('non-existent-xyz')).rejects.toThrow("Document 'non-existent-xyz' not found.")
  })

  it('performs fallback keyword search when API is unavailable', async () => {
    const results = await searchDocuments('飞船')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].slug).toBe('ark')
    expect(results[0].similarity).toBeGreaterThan(0)
  })
})
