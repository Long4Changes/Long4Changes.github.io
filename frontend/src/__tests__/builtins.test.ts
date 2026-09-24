import { describe, it, expect, vi } from 'vitest'
import { builtinCommands } from '../services/virtual-shell/commands/builtins'
import type { ShellContext } from '../services/virtual-shell/types'

describe('Builtin Shell Commands', () => {
  const baseContext: ShellContext = {
    args: [],
    rawCommand: '',
    cwd: '/home/liangchen',
    role: 'guest',
    catalog: ['ark', 'articles'],
    history: ['help', 'whoami'],
    getDocument: vi.fn(),
    setCwd: vi.fn()
  }

  it('whoami outputs guest for unauthenticated session and root for root session', async () => {
    const whoami = builtinCommands.find(c => c.name === 'whoami')!
    expect(await whoami.execute(baseContext)).toEqual({ output: 'guest' })
    expect(await whoami.execute({ ...baseContext, role: 'root' })).toEqual({ output: 'root' })
  })

  it('pwd returns formatted working directory', async () => {
    const pwd = builtinCommands.find(c => c.name === 'pwd')!
    expect(await pwd.execute(baseContext)).toEqual({ output: '~' })
    expect(await pwd.execute({ ...baseContext, cwd: '/docs' })).toEqual({ output: '/docs' })
    expect(await pwd.execute({ ...baseContext, cwd: '/' })).toEqual({ output: '/' })
  })

  it('cd navigates to valid directories and errors on invalid', async () => {
    const cd = builtinCommands.find(c => c.name === 'cd')!
    const resValid = await cd.execute({ ...baseContext, args: ['/docs'] })
    expect(resValid.newCwd).toBe('/docs')
    expect(resValid.output).toBe('')

    const resHome = await cd.execute({ ...baseContext, args: [] })
    expect(resHome.newCwd).toBe('/home/liangchen')
    expect(resHome.output).toBe('')

    const resInvalid = await cd.execute({ ...baseContext, args: ['/nonexistent'] })
    expect(resInvalid.output).toContain('no such file or directory')
    expect(resInvalid.newCwd).toBeUndefined()

    const resFile = await cd.execute({ ...baseContext, args: ['/etc/motd'] })
    expect(resFile.output).toContain('no such file or directory')
    expect(resFile.newCwd).toBeUndefined()
  })

  it('uname returns kernel signature', async () => {
    const uname = builtinCommands.find(c => c.name === 'uname')!
    const res = await uname.execute(baseContext)
    expect(res.output).toContain('Linux long4changes 6.6.0-cyberkb')
  })

  it('date returns formatted current date/time string', async () => {
    const date = builtinCommands.find(c => c.name === 'date')!
    const res = await date.execute(baseContext)
    expect(res.output).toBeTruthy()
    expect(typeof res.output).toBe('string')
  })

  it('uptime returns simulated uptime with load averages', async () => {
    const uptime = builtinCommands.find(c => c.name === 'uptime')!
    const res = await uptime.execute(baseContext)
    expect(res.output).toContain('up 42 days')
    expect(res.output).toContain('load average: 0.08, 0.03, 0.01')
  })

  it('echo joins arguments with space', async () => {
    const echo = builtinCommands.find(c => c.name === 'echo')!
    expect(await echo.execute({ ...baseContext, args: ['hello', 'cyber', 'world'] })).toEqual({ output: 'hello cyber world' })
    expect(await echo.execute({ ...baseContext, args: [] })).toEqual({ output: '' })
  })

  it('history lists indexed previous commands', async () => {
    const history = builtinCommands.find(c => c.name === 'history')!
    const res = await history.execute(baseContext)
    expect(res.output).toContain('  1  help')
    expect(res.output).toContain('  2  whoami')
  })

  it('man delegates to tldr with advice', async () => {
    const man = builtinCommands.find(c => c.name === 'man')!
    const resNoArgs = await man.execute(baseContext)
    expect(resNoArgs.output).toContain("Type 'tldr <cmd>' for simplified cheatsheets.")

    const resWithArg = await man.execute({ ...baseContext, args: ['cat'] })
    expect(resWithArg.output).toContain("Type 'tldr <cmd>' for simplified cheatsheets.")
  })

  describe('mv command', () => {
    it('requires source and destination operands', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const resNoArgs = await mv.execute(baseContext)
      expect(resNoArgs.output).toContain('missing file operand')
      expect(resNoArgs.type).toBe('error')

      const resOneArg = await mv.execute({ ...baseContext, args: ['file.txt'] })
      expect(resOneArg.output).toContain("missing destination file operand after 'file.txt'")
      expect(resOneArg.type).toBe('error')
    })

    it('errors on nonexistent source file', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const res = await mv.execute({ ...baseContext, args: ['nonexistent.md', 'dest.md'] })
      expect(res.output).toContain("cannot stat 'nonexistent.md': No such file or directory")
      expect(res.type).toBe('error')
    })

    it('blocks non-root guest execution with permission denied', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const res = await mv.execute({ ...baseContext, role: 'guest', cwd: '/docs', args: ['ark.md', 'new_ark.md'] })
      expect(res.output).toContain("cannot move 'ark.md' to 'new_ark.md': Permission denied")
      expect(res.type).toBe('error')
    })

    it('renames document when executed as root', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const mockCatalog = ['ark', 'articles']
      const renameDocMock = vi.fn()
      const res = await mv.execute({
        ...baseContext,
        role: 'root',
        cwd: '/docs',
        catalog: mockCatalog,
        args: ['ark.md', 'ark_v2.md'],
        renameDocument: renameDocMock
      })
      expect(res.output).toBe('')
      expect(mockCatalog).toEqual(['ark_v2', 'articles'])
      expect(renameDocMock).toHaveBeenCalledWith('ark', 'ark_v2')
    })

    it('supports -v verbose flag', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const mockCatalog = ['ark', 'articles']
      const res = await mv.execute({
        ...baseContext,
        role: 'root',
        cwd: '/docs',
        catalog: mockCatalog,
        args: ['-v', 'ark.md', 'ark_v2.md']
      })
      expect(res.output).toBe("renamed 'ark.md' -> 'ark_v2.md'")
    })

    it('protects immutable system binaries from being moved', async () => {
      const mv = builtinCommands.find(c => c.name === 'mv')!
      const res = await mv.execute({
        ...baseContext,
        role: 'root',
        args: ['/bin/ls', '/home/liangchen/ls']
      })
      expect(res.output).toContain('Read-only file system')
      expect(res.type).toBe('error')
    })
  })

  describe('rm command', () => {
    it('requires operand unless force is specified', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const resNoArgs = await rm.execute(baseContext)
      expect(resNoArgs.output).toContain('missing operand')
      expect(resNoArgs.type).toBe('error')

      const resForce = await rm.execute({ ...baseContext, args: ['-f'] })
      expect(resForce.output).toBe('')
    })

    it('errors on nonexistent file unless force is specified', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const res = await rm.execute({ ...baseContext, args: ['nonexistent.md'] })
      expect(res.output).toContain("cannot remove 'nonexistent.md': No such file or directory")
      expect(res.type).toBe('error')

      const resForce = await rm.execute({ ...baseContext, args: ['-f', 'nonexistent.md'] })
      expect(resForce.output).toBe('')
    })

    it('blocks non-root guest execution with permission denied', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const res = await rm.execute({ ...baseContext, role: 'guest', cwd: '/docs', args: ['ark.md'] })
      expect(res.output).toContain("cannot remove 'ark.md': Permission denied")
      expect(res.type).toBe('error')
    })

    it('removes document when executed as root', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const mockCatalog = ['ark', 'articles']
      const removeDocMock = vi.fn()
      const res = await rm.execute({
        ...baseContext,
        role: 'root',
        cwd: '/docs',
        catalog: mockCatalog,
        args: ['ark.md'],
        removeDocument: removeDocMock
      })
      expect(res.output).toBe('')
      expect(mockCatalog).toEqual(['articles'])
      expect(removeDocMock).toHaveBeenCalledWith('ark')
    })

    it('supports -v verbose flag', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const mockCatalog = ['ark', 'articles']
      const res = await rm.execute({
        ...baseContext,
        role: 'root',
        cwd: '/docs',
        catalog: mockCatalog,
        args: ['-v', 'ark.md']
      })
      expect(res.output).toBe("removed 'ark.md'")
    })

    it('protects root / and immutable system files', async () => {
      const rm = builtinCommands.find(c => c.name === 'rm')!
      const resRoot = await rm.execute({
        ...baseContext,
        role: 'root',
        args: ['-rf', '/']
      })
      expect(resRoot.output).toContain("it is dangerous to operate recursively on '/'")
      expect(resRoot.type).toBe('error')

      const resBin = await rm.execute({
        ...baseContext,
        role: 'root',
        args: ['/bin/ls']
      })
      expect(resBin.output).toContain('Read-only file system')
      expect(resBin.type).toBe('error')
    })
  })
})
