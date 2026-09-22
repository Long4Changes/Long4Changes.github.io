import { describe, it, expect, vi } from 'vitest'
import { defaultShellRegistry } from '../services/virtual-shell/registry'
import type { ShellContext } from '../services/virtual-shell/types'

describe('ShellRegistry and Dispatcher', () => {
  const baseContext: ShellContext = {
    args: [],
    rawCommand: '',
    cwd: '/home/liangchen',
    role: 'guest',
    catalog: ['ark', 'articles', 'about'],
    history: ['help', 'whoami'],
    getDocument: vi.fn(),
    setCwd: vi.fn()
  }

  it('routes builtin commands correctly and returns result', async () => {
    const res = await defaultShellRegistry.execute('whoami', baseContext)
    expect(res.output).toBe('guest')
  })

  it('routes modern CLI commands correctly and returns result', async () => {
    const res = await defaultShellRegistry.execute('neofetch', baseContext)
    expect(res.output).toContain('guest@long4changes')
    expect(res.type).toBe('neofetch')
  })

  it('returns command not found for unknown commands', async () => {
    const res = await defaultShellRegistry.execute('unknown_cmd', baseContext)
    expect(res.output).toContain('Command not found: unknown_cmd')
  })

  it('provides autocomplete candidates for command prefixes', () => {
    const auto = defaultShellRegistry.getAutocomplete('neo', baseContext)
    expect(auto.matches).toContain('neofetch')

    const autoB = defaultShellRegistry.getAutocomplete('ba', baseContext)
    expect(autoB.matches).toContain('bat')
  })

  it('provides autocomplete candidates for tldr subcommands', () => {
    const auto = defaultShellRegistry.getAutocomplete('tldr sea', baseContext)
    expect(auto.matches).toContain('tldr search')

    const autoBat = defaultShellRegistry.getAutocomplete('tldr ba', baseContext)
    expect(autoBat.matches).toContain('tldr bat')
  })

  it('provides autocomplete candidates for slug arguments in bat and glow', () => {
    const autoBat = defaultShellRegistry.getAutocomplete('bat a', baseContext)
    expect(autoBat.matches).toContain('bat ark')
    expect(autoBat.matches).toContain('bat articles')
    expect(autoBat.matches).toContain('bat about')

    const autoGlow = defaultShellRegistry.getAutocomplete('glow ar', baseContext)
    expect(autoGlow.matches).toContain('glow ark')
    expect(autoGlow.matches).toContain('glow articles')
  })

  it('provides autocomplete candidates for cd paths', () => {
    const autoCd = defaultShellRegistry.getAutocomplete('cd /do', baseContext)
    expect(autoCd.matches).toContain('cd /docs')
  })
})
