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
})
