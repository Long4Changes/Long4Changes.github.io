import type { DocumentDetail, Visibility } from './api'

export function parseMarkdownWithFrontmatter(rawContent: string, defaultSlug: string): DocumentDetail {
  const trimmed = rawContent.trim()
  const frontmatterMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  let title = defaultSlug
  let slug = defaultSlug
  let visibility: Visibility = 'public'
  let bodyContent = trimmed

  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1]
    bodyContent = frontmatterMatch[2].trim()

    for (const line of yamlBlock.split('\n')) {
      const trimmedLine = line.trim()
      const colonIdx = trimmedLine.indexOf(':')
      if (colonIdx !== -1) {
        const key = trimmedLine.slice(0, colonIdx).trim().toLowerCase()
        let val = trimmedLine.slice(colonIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (key === 'title') title = val
        else if (key === 'slug') slug = val
        else if (key === 'visibility') {
          if (val === 'private') visibility = 'private'
          else visibility = 'public'
        }
      }
    }
  } else {
    // Try to extract first heading as title
    const headingMatch = trimmed.match(/^#\s+(.+)$/m)
    if (headingMatch) {
      title = headingMatch[1].trim()
    }
  }

  return {
    slug,
    title,
    content: bodyContent,
    visibility
  }
}

export function loadStaticDocuments(): Record<string, DocumentDetail> {
  const docs: Record<string, DocumentDetail> = {}

  try {
    const rawModules = import.meta.glob('/src/content/*.md', { query: '?raw', eager: true }) as Record<string, { default: string } | string>

    for (const [path, mod] of Object.entries(rawModules)) {
      const rawText = typeof mod === 'string' ? mod : (mod?.default || '')
      const filenameMatch = path.match(/\/([^/]+)\.md$/)
      const defaultSlug = filenameMatch ? filenameMatch[1] : 'document'
      const parsed = parseMarkdownWithFrontmatter(rawText, defaultSlug)
      docs[parsed.slug] = parsed
    }
  } catch {
    // Fallback if import.meta.glob is not supported in non-Vite environments
  }

  return docs
}
