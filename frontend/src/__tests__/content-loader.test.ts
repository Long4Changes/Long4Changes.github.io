import { describe, it, expect } from 'vitest'
import { parseMarkdownWithFrontmatter, loadStaticDocuments } from '../services/content-loader'

describe('content-loader', () => {
  it('parses markdown with full YAML frontmatter correctly', () => {
    const raw = `---
title: My Cool Post
slug: cool-post
visibility: private
---

# Heading 1
Some text here.
`
    const doc = parseMarkdownWithFrontmatter(raw, 'fallback-slug')
    expect(doc.title).toBe('My Cool Post')
    expect(doc.slug).toBe('cool-post')
    expect(doc.visibility).toBe('private')
    expect(doc.content).toContain('# Heading 1')
    expect(doc.content).toContain('Some text here.')
    expect(doc.content).not.toContain('title: My Cool Post')
    expect(doc.raw).toBe(raw)
  })

  it('infers title and slug when frontmatter is missing', () => {
    const raw = `# First Line Heading

Here is content without frontmatter.
`
    const doc = parseMarkdownWithFrontmatter(raw, 'untyped-doc')
    expect(doc.slug).toBe('untyped-doc')
    expect(doc.title).toBe('First Line Heading')
    expect(doc.visibility).toBe('public')
    expect(doc.content).toBe(raw.trim())
  })

  it('loads real markdown files from src/content directory', () => {
    const docs = loadStaticDocuments()
    expect(docs).toBeDefined()
    expect(Object.keys(docs).length).toBeGreaterThanOrEqual(1)

    // Verify user article exists
    expect(docs['hello-world']).toBeDefined()
    expect(docs['hello-world'].title).toContain('你好，世界')
    expect(docs['hello-world'].visibility).toBe('public')
    expect(docs['hello-world'].content).toContain('这是直接保存在本地')
  })
})
