import { describe, it, expect, vi } from 'vitest'
import { modernCommands } from '../services/virtual-shell/commands/modern'
import type { ShellContext } from '../services/virtual-shell/types'

describe('Modern CLI Tools', () => {
  const mockDoc = {
    slug: 'ark',
    title: '扁舟 (Ark Project)',
    content: '# 扁舟\n这是一艘飞船。',
    visibility: 'public'
  }

  const baseContext: ShellContext = {
    args: [],
    rawCommand: '',
    cwd: '/home/liangchen',
    role: 'guest',
    catalog: ['ark', 'articles'],
    history: [],
    getDocument: vi.fn().mockResolvedValue(mockDoc),
    setCwd: vi.fn()
  }

  describe('neofetch & fastfetch', () => {
    it('neofetch renders ASCII art badge and system specs', async () => {
      const neofetch = modernCommands.find(c => c.name === 'neofetch')!
      expect(neofetch).toBeDefined()
      const res = await neofetch.execute(baseContext)
      expect(res.output).toContain('guest@long4changes')
      expect(res.output).toContain('CyberKB GNU/Linux')
      expect(res.output).toContain('Long4Changes WebStation')
      expect(res.output).toContain('6.6.0-vibe-kernel')
      expect(res.output).toContain('梁晨')
      expect(res.output).toContain('liangchen0920@gmail.com')
      expect(res.output).toContain('Independent Developer / Vibe Coding Enthusiast')
      expect(res.output).toContain('███')
      expect(res.type).toBe('neofetch')
    })

    it('neofetch reflects root role when authenticated', async () => {
      const neofetch = modernCommands.find(c => c.name === 'neofetch')!
      const res = await neofetch.execute({ ...baseContext, role: 'root' })
      expect(res.output).toContain('root@long4changes')
    })

    it('fastfetch alias works identically to neofetch', async () => {
      const fastfetch = modernCommands.find(c => c.name === 'fastfetch')
      expect(fastfetch).toBeDefined()
      const res = await fastfetch!.execute(baseContext)
      expect(res.output).toContain('guest@long4changes')
      expect(res.type).toBe('neofetch')
    })
  })

  describe('bat', () => {
    it('bat renders bordered file header and right-aligned line numbers', async () => {
      const bat = modernCommands.find(c => c.name === 'bat')!
      const res = await bat.execute({ ...baseContext, args: ['ark'] })
      expect(res.output).toContain('File: ark.md')
      expect(res.output).toContain('1 │ # 扁舟')
      expect(res.output).toContain('2 │ 这是一艘飞船。')
      expect(res.type).toBe('bat')
    })

    it('bat strips .md extension if passed', async () => {
      const bat = modernCommands.find(c => c.name === 'bat')!
      const res = await bat.execute({ ...baseContext, args: ['ark.md'] })
      expect(res.output).toContain('File: ark.md')
      expect(res.type).toBe('bat')
    })

    it('bat returns error when slug argument is missing', async () => {
      const bat = modernCommands.find(c => c.name === 'bat')!
      const res = await bat.execute({ ...baseContext, args: [] })
      expect(res.output).toContain('Usage: bat <slug>')
      expect(res.type).toBe('error')
    })

    it('bat returns error when document fetch fails', async () => {
      const bat = modernCommands.find(c => c.name === 'bat')!
      const getDocument = vi.fn().mockRejectedValue(new Error('Document not found'))
      const res = await bat.execute({ ...baseContext, args: ['nonexistent'], getDocument })
      expect(res.output).toContain('bat: nonexistent: No such document or file')
      expect(res.type).toBe('error')
    })
  })

  describe('glow', () => {
    it('glow renders formatted terminal markdown title box', async () => {
      const glow = modernCommands.find(c => c.name === 'glow')!
      const res = await glow.execute({ ...baseContext, args: ['ark'] })
      expect(res.output).toContain('╔═')
      expect(res.output).toContain('扁舟 (Ark Project)')
      expect(res.output).toContain('这是一艘飞船。')
      expect(res.type).toBe('glow')
    })

    it('glow formats markdown code blocks and blockquotes', async () => {
      const glow = modernCommands.find(c => c.name === 'glow')!
      const docWithMd = {
        slug: 'code-sample',
        title: 'Code Sample',
        content: 'Intro text\n\n> A quoted thought\n\n```python\nprint("hello")\n```',
        visibility: 'public'
      }
      const getDocument = vi.fn().mockResolvedValue(docWithMd)
      const res = await glow.execute({ ...baseContext, args: ['code-sample'], getDocument })
      expect(res.output).toContain('Code Sample')
      expect(res.output).toContain('A quoted thought')
      expect(res.output).toContain('print("hello")')
      expect(res.type).toBe('glow')
    })

    it('glow returns error when slug argument is missing', async () => {
      const glow = modernCommands.find(c => c.name === 'glow')!
      const res = await glow.execute({ ...baseContext, args: [] })
      expect(res.output).toContain('Usage: glow <slug>')
      expect(res.type).toBe('error')
    })

    it('glow returns error when document not found', async () => {
      const glow = modernCommands.find(c => c.name === 'glow')!
      const getDocument = vi.fn().mockRejectedValue(new Error('Not found'))
      const res = await glow.execute({ ...baseContext, args: ['nonexistent'], getDocument })
      expect(res.output).toContain('glow: nonexistent: No such document or file')
      expect(res.type).toBe('error')
    })
  })

  describe('tldr', () => {
    it('tldr without args lists all command summaries', async () => {
      const tldr = modernCommands.find(c => c.name === 'tldr')!
      const res = await tldr.execute(baseContext)
      expect(res.output).toContain('tldr - simplified command pages')
      expect(res.output).toContain('search')
      expect(res.output).toContain('bat')
      expect(res.output).toContain('glow')
      expect(res.output).toContain('tree')
      expect(res.output).toContain('whoami')
    })

    it('tldr with specific command provides practical usage examples', async () => {
      const tldr = modernCommands.find(c => c.name === 'tldr')!
      const res = await tldr.execute({ ...baseContext, args: ['search'] })
      expect(res.output).toContain('search -')
      expect(res.output).toContain('search <query>')
    })

    it('tldr provides examples for bat, cd, sudo', async () => {
      const tldr = modernCommands.find(c => c.name === 'tldr')!
      const resBat = await tldr.execute({ ...baseContext, args: ['bat'] })
      expect(resBat.output).toContain('bat <slug>')

      const resCd = await tldr.execute({ ...baseContext, args: ['cd'] })
      expect(resCd.output).toContain('cd <directory>')

      const resSudo = await tldr.execute({ ...baseContext, args: ['sudo'] })
      expect(resSudo.output).toContain('sudo su')
    })

    it('tldr handles unknown command gracefully', async () => {
      const tldr = modernCommands.find(c => c.name === 'tldr')!
      const res = await tldr.execute({ ...baseContext, args: ['unknown'] })
      expect(res.output).toContain('No tldr entry for unknown')
    })
  })

  describe('tree', () => {
    it('tree prints ASCII directory structure', async () => {
      const tree = modernCommands.find(c => c.name === 'tree')!
      const res = await tree.execute(baseContext)
      expect(res.output).toContain('├── bin/')
      expect(res.output).toContain('├── docs/')
      expect(res.output).toContain('ark.md')
      expect(res.output).toContain('articles.md')
      expect(res.type).toBe('text')
    })

    it('tree can target specific directory like docs', async () => {
      const tree = modernCommands.find(c => c.name === 'tree')!
      const res = await tree.execute({ ...baseContext, args: ['docs'] })
      expect(res.output).toContain('docs/')
      expect(res.output).toContain('ark.md')
      expect(res.output).toContain('articles.md')
    })

    it('tree returns error on non-existent directory', async () => {
      const tree = modernCommands.find(c => c.name === 'tree')!
      const res = await tree.execute({ ...baseContext, args: ['invalid_folder'] })
      expect(res.output).toContain('tree: invalid_folder: No such directory')
      expect(res.type).toBe('error')
    })
  })
})
