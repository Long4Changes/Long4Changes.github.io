export class VirtualFileSystem {
  private static readonly DIRECTORIES = new Set([
    '/',
    '/bin',
    '/docs',
    '/home',
    '/home/liangchen',
    '/etc'
  ])

  private static readonly STATIC_FILES = new Set([
    '/etc/motd',
    '/etc/os-release',
    '/bin/bat',
    '/bin/bat*',
    '/bin/cat',
    '/bin/cat*',
    '/bin/glow',
    '/bin/glow*',
    '/bin/ls',
    '/bin/ls*',
    '/bin/neofetch',
    '/bin/neofetch*',
    '/bin/tldr',
    '/bin/tldr*'
  ])

  /**
   * Checks whether the given path resolves to an existing virtual directory.
   */
  isDir(path: string): boolean {
    const resolved = this.normalize(path)
    return VirtualFileSystem.DIRECTORIES.has(resolved)
  }

  /**
   * Normalizes a raw path string (handling ~, relative segments, and aliases).
   */
  private normalize(path: string): string {
    let clean = path.trim()
    if (!clean) return '/'

    if (clean === '~') {
      clean = '/home/liangchen'
    } else if (clean.startsWith('~/')) {
      clean = '/home/liangchen/' + clean.slice(2)
    }

    const rawSegments = clean.split('/')
    const segments: string[] = []
    for (const seg of rawSegments) {
      if (!seg || seg === '.') continue
      if (seg === '..') {
        segments.pop()
      } else {
        segments.push(seg)
      }
    }
    const normalized = '/' + segments.join('/')
    if (normalized === '/home/liangchen/docs') {
      return '/docs'
    }
    return normalized
  }

  /**
   * Resolves a target path relative to cwd, returning normalized path or null if nonexistent.
   */
  resolvePath(cwd: string, target: string, catalog?: string[]): string | null {
    const cleanTarget = target.trim()
    if (!cleanTarget) {
      return null
    }

    let fullPath = cleanTarget
    if (fullPath === '~') {
      fullPath = '/home/liangchen'
    } else if (fullPath.startsWith('~/')) {
      fullPath = '/home/liangchen/' + fullPath.slice(2)
    } else if (!fullPath.startsWith('/')) {
      const baseCwd = cwd === '~' ? '/home/liangchen' : cwd
      fullPath = `${baseCwd.replace(/\/+$/, '')}/${fullPath}`
    }

    const normalized = this.normalize(fullPath)

    // Check if it matches a known directory
    if (VirtualFileSystem.DIRECTORIES.has(normalized)) {
      return normalized
    }

    // Check static files
    if (VirtualFileSystem.STATIC_FILES.has(normalized)) {
      return normalized
    }

    // Check docs directory contents
    if (normalized.startsWith('/docs/')) {
      const filename = normalized.slice('/docs/'.length)
      if (!filename.includes('/')) {
        const slug = filename.replace(/\.md$/, '')
        if (catalog && catalog.length > 0) {
          if (catalog.includes(slug)) {
            return filename.endsWith('.md') ? normalized : `${normalized}.md`
          }
          return null
        }
        return filename.endsWith('.md') ? normalized : `${normalized}.md`
      }
    }

    return null
  }

  /**
   * Lists the entries in a virtual directory.
   */
  listDir(path: string, catalog: string[] = []): string[] {
    const resolved = this.resolvePath('/', path)
    if (!resolved || !this.isDir(resolved)) {
      return []
    }

    switch (resolved) {
      case '/':
        return ['bin/', 'docs/', 'etc/', 'home/']
      case '/docs':
        return catalog.map(slug => (slug.endsWith('.md') ? slug : `${slug}.md`)).sort()
      case '/bin':
        return ['bat*', 'cat*', 'glow*', 'ls*', 'neofetch*', 'tldr*']
      case '/etc':
        return ['motd', 'os-release']
      case '/home':
        return ['liangchen/']
      case '/home/liangchen':
        return ['docs/']
      default:
        return []
    }
  }
}

export const vfs = new VirtualFileSystem()
