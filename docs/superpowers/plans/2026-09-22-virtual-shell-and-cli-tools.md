# Virtual Shell & Modern CLI Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side Virtual Shell engine in Vue 3 that emulates Linux built-in commands (`whoami`, `pwd`, `cd`, `uname`, `date`, `uptime`, `echo`, `history`, `man`) and modern CLI developer tools (`bat`, `glow`, `tldr`, `neofetch`, `tree`) with dynamic prompt updates and multi-level Tab autocompletion.

**Architecture:** A decoupled `virtual-shell/` service module provides an in-memory Virtual File System (VFS) and command registry. `Terminal.vue` delegates command execution and autocomplete to this service while retaining UI rendering, IME composition preview, and RAG streaming typewriter display.

**Tech Stack:** Vue 3, TypeScript, Vitest, `@vue/test-utils`, Vite.

**Spec:** `docs/superpowers/specs/2026-09-22-virtual-shell-and-cli-tools-design.md`

## Global Constraints

- High-contrast monochrome theme: `#1f1f1f` on `#fefefe`.
- Strict `0px` border-radius and `none` box-shadow.
- Font stack: `"JetBrains Mono", "Noto Sans SC", monospace`.
- Zero external runtime binary or container dependencies (100% browser client-side sandbox).
- All existing 28 frontend tests and features must continue to pass without regression.

---

### Task 1: Virtual File System (VFS) & Shell Core Types

**Files:**
- Create: `frontend/src/services/virtual-shell/types.ts`
- Create: `frontend/src/services/virtual-shell/vfs.ts`
- Test: `frontend/src/__tests__/vfs.test.ts`

**Interfaces:**
- Produces:
  - `ShellContext`, `CommandResult`, `ShellCommand` in `types.ts`
  - `class VirtualFileSystem`: `resolvePath(cwd: string, target: string): string | null`, `listDir(path: string, catalog: string[]): string[]`, `isDir(path: string): boolean`

- [ ] **Step 1: Write the failing test for VFS**

```typescript
// frontend/src/__tests__/vfs.test.ts
import { describe, it, expect } from 'vitest'
import { VirtualFileSystem } from '../services/virtual-shell/vfs'

describe('VirtualFileSystem', () => {
  const vfs = new VirtualFileSystem()
  const catalog = ['ark', 'articles', 'about']

  it('resolves tilde ~ to /home/liangchen', () => {
    expect(vfs.resolvePath('/', '~')).toBe('/home/liangchen')
    expect(vfs.resolvePath('/home/liangchen', '.')).toBe('/home/liangchen')
  })

  it('resolves relative paths and parent paths', () => {
    expect(vfs.resolvePath('/', 'docs')).toBe('/docs')
    expect(vfs.resolvePath('/docs', '..')).toBe('/')
    expect(vfs.resolvePath('/home/liangchen', '..')).toBe('/home')
  })

  it('returns null for nonexistent paths', () => {
    expect(vfs.resolvePath('/', 'invalid_dir')).toBeNull()
  })

  it('lists directory contents including virtual documents', () => {
    const docs = vfs.listDir('/docs', catalog)
    expect(docs).toContain('ark.md')
    expect(docs).toContain('articles.md')
    expect(docs).toContain('about.md')

    const root = vfs.listDir('/', catalog)
    expect(root).toContain('bin/')
    expect(root).toContain('docs/')
    expect(root).toContain('home/')
    expect(root).toContain('etc/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/vfs.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement types.ts and vfs.ts**

Write `frontend/src/services/virtual-shell/types.ts` and `frontend/src/services/virtual-shell/vfs.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/vfs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/virtual-shell/ frontend/src/__tests__/vfs.test.ts
git commit -m "feat(shell): implement virtual file system and core shell types"
```

---

### Task 2: Standard Linux Builtin Commands

**Files:**
- Create: `frontend/src/services/virtual-shell/commands/builtins.ts`
- Test: `frontend/src/__tests__/builtins.test.ts`

**Interfaces:**
- Consumes: `ShellContext`, `CommandResult`, `ShellCommand` from `../types` and `VirtualFileSystem` from `../vfs`
- Produces: `builtinCommands: ShellCommand[]` implementing:
  - `whoami`: `guest` or `root`
  - `pwd`: formatted path (e.g. `~` or `/docs`)
  - `cd`: validates directory against VFS, updates `newCwd`
  - `uname`: `Linux long4changes 6.6.0-cyberkb #1 SMP PREEMPT x86_64 GNU/Linux`
  - `date`: current date/time string
  - `uptime`: uptime report with load average
  - `echo`: arguments joined by space
  - `history`: numbered command history
  - `man`: delegates to tldr

- [ ] **Step 1: Write the failing test for builtins**

```typescript
// frontend/src/__tests__/builtins.test.ts
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
  })

  it('cd navigates to valid directories and errors on invalid', async () => {
    const cd = builtinCommands.find(c => c.name === 'cd')!
    const resValid = await cd.execute({ ...baseContext, args: ['/docs'] })
    expect(resValid.newCwd).toBe('/docs')

    const resInvalid = await cd.execute({ ...baseContext, args: ['/nonexistent'] })
    expect(resInvalid.output).toContain('no such file or directory')
    expect(resInvalid.newCwd).toBeUndefined()
  })

  it('uname returns kernel signature', async () => {
    const uname = builtinCommands.find(c => c.name === 'uname')!
    const res = await uname.execute(baseContext)
    expect(res.output).toContain('Linux long4changes 6.6.0-cyberkb')
  })

  it('echo joins arguments with space', async () => {
    const echo = builtinCommands.find(c => c.name === 'echo')!
    expect(await echo.execute({ ...baseContext, args: ['hello', 'cyber', 'world'] })).toEqual({ output: 'hello cyber world' })
  })

  it('history lists indexed previous commands', async () => {
    const history = builtinCommands.find(c => c.name === 'history')!
    const res = await history.execute(baseContext)
    expect(res.output).toContain('  1  help')
    expect(res.output).toContain('  2  whoami')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/builtins.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement builtins.ts**

Create `frontend/src/services/virtual-shell/commands/builtins.ts` implementing all built-in commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/builtins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/virtual-shell/commands/builtins.ts frontend/src/__tests__/builtins.test.ts
git commit -m "feat(shell): implement standard Linux builtin commands"
```

---

### Task 3: Modern CLI Utilities (`bat`, `glow`, `tldr`, `neofetch`, `tree`)

**Files:**
- Create: `frontend/src/services/virtual-shell/commands/modern.ts`
- Test: `frontend/src/__tests__/modern-cli.test.ts`

**Interfaces:**
- Consumes: `ShellContext`, `CommandResult`, `ShellCommand` from `../types`
- Produces: `modernCommands: ShellCommand[]` implementing:
  - `neofetch` / `fastfetch`: ASCII mascot + specs layout
  - `bat <slug>`: File header box, line numbers, and formatted content
  - `glow <slug>`: Terminal Markdown rendering with double-line title box
  - `tldr [command]`: Community-style simplified command manuals
  - `tree [dir]`: ASCII hierarchy representation of VFS

- [ ] **Step 1: Write the failing test for modern CLI tools**

```typescript
// frontend/src/__tests__/modern-cli.test.ts
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

  it('neofetch renders ASCII art badge and system specs', async () => {
    const neofetch = modernCommands.find(c => c.name === 'neofetch')!
    const res = await neofetch.execute(baseContext)
    expect(res.output).toContain('guest@long4changes')
    expect(res.output).toContain('CyberKB GNU/Linux')
    expect(res.output).toContain('梁晨')
    expect(res.type).toBe('neofetch')
  })

  it('bat renders bordered file header and right-aligned line numbers', async () => {
    const bat = modernCommands.find(c => c.name === 'bat')!
    const res = await bat.execute({ ...baseContext, args: ['ark'] })
    expect(res.output).toContain('File: ark.md')
    expect(res.output).toContain('1 │ # 扁舟')
    expect(res.output).toContain('2 │ 这是一艘飞船。')
    expect(res.type).toBe('bat')
  })

  it('glow renders formatted terminal markdown title box', async () => {
    const glow = modernCommands.find(c => c.name === 'glow')!
    const res = await glow.execute({ ...baseContext, args: ['ark'] })
    expect(res.output).toContain('╔═')
    expect(res.output).toContain('扁舟 (Ark Project)')
    expect(res.output).toContain('这是一艘飞船。')
    expect(res.type).toBe('glow')
  })

  it('tldr without args lists all command summaries', async () => {
    const tldr = modernCommands.find(c => c.name === 'tldr')!
    const res = await tldr.execute(baseContext)
    expect(res.output).toContain('tldr - simplified command pages')
    expect(res.output).toContain('search')
    expect(res.output).toContain('bat')
    expect(res.output).toContain('glow')
  })

  it('tldr with specific command provides practical usage examples', async () => {
    const tldr = modernCommands.find(c => c.name === 'tldr')!
    const res = await tldr.execute({ ...baseContext, args: ['search'] })
    expect(res.output).toContain('search -')
    expect(res.output).toContain('search <query>')
  })

  it('tree prints ASCII directory structure', async () => {
    const tree = modernCommands.find(c => c.name === 'tree')!
    const res = await tree.execute(baseContext)
    expect(res.output).toContain('├── bin/')
    expect(res.output).toContain('├── docs/')
    expect(res.output).toContain('ark.md')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/modern-cli.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement modern.ts**

Create `frontend/src/services/virtual-shell/commands/modern.ts` with complete implementations for `neofetch`, `bat`, `glow`, `tldr`, `tree`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/modern-cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/virtual-shell/commands/modern.ts frontend/src/__tests__/modern-cli.test.ts
git commit -m "feat(shell): implement modern CLI utilities bat, glow, tldr, neofetch, and tree"
```

---

### Task 4: Shell Registry & Command Router

**Files:**
- Create: `frontend/src/services/virtual-shell/registry.ts`
- Test: `frontend/src/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: all commands from `builtins.ts` and `modern.ts`
- Produces:
  - `class ShellRegistry`: `registerCommand(cmd: ShellCommand)`, `getCommand(name: string): ShellCommand | undefined`, `getAllCommands(): ShellCommand[]`, `execute(input: string, ctx: ShellContext): Promise<CommandResult>`, `getAutocompleteSuggestions(prefix: string, cwd: string, catalog: string[]): { matches: string[]; commonPrefix: string }`

- [ ] **Step 1: Write the failing test for ShellRegistry**

```typescript
// frontend/src/__tests__/registry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { defaultShellRegistry } from '../services/virtual-shell/registry'
import type { ShellContext } from '../services/virtual-shell/types'

describe('ShellRegistry and Dispatcher', () => {
  const baseContext: ShellContext = {
    args: [],
    rawCommand: '',
    cwd: '/home/liangchen',
    role: 'guest',
    catalog: ['ark', 'articles'],
    history: [],
    getDocument: vi.fn(),
    setCwd: vi.fn()
  }

  it('routes commands correctly and returns result', async () => {
    const res = await defaultShellRegistry.execute('whoami', baseContext)
    expect(res.output).toBe('guest')
  })

  it('returns command not found for unknown commands', async () => {
    const res = await defaultShellRegistry.execute('unknown_cmd', baseContext)
    expect(res.output).toContain('Command not found: unknown_cmd')
  })

  it('provides autocomplete candidates for command prefixes', () => {
    const auto = defaultShellRegistry.getAutocomplete('neo', baseContext)
    expect(auto.matches).toContain('neofetch')
  })

  it('provides autocomplete candidates for tldr subcommands', () => {
    const auto = defaultShellRegistry.getAutocomplete('tldr sea', baseContext)
    expect(auto.matches).toContain('tldr search')
  })

  it('provides autocomplete candidates for slug arguments in bat/glow', () => {
    const auto = defaultShellRegistry.getAutocomplete('bat a', baseContext)
    expect(auto.matches).toContain('bat ark')
    expect(auto.matches).toContain('bat articles')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement registry.ts**

Create `frontend/src/services/virtual-shell/registry.ts` aggregating builtin commands, modern CLI commands, and autocomplete matching engine.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/virtual-shell/registry.ts frontend/src/__tests__/registry.test.ts
git commit -m "feat(shell): implement shell registry and autocomplete router"
```

---

### Task 5: Terminal UI Integration, Dynamic Prompt & Multi-level Autocomplete

**Files:**
- Modify: `frontend/src/components/Terminal.vue`
- Test: `frontend/src/__tests__/Terminal-shell.test.ts`

**Interfaces:**
- Integrates `defaultShellRegistry` into `Terminal.vue`.
- Replaces hardcoded command routing with `defaultShellRegistry.execute()`.
- Updates `promptStr` to compute current working directory:
  - Guest: `guest@long4changes:~# ` or `guest@long4changes:<cwd>$ `
  - Root: `root@long4changes:~# ` or `root@long4changes:<cwd># `
- Integrates multi-level Tab completion (`tldr <cmd>`, `bat <slug>`, `glow <slug>`, `cd <dir>`).

- [ ] **Step 1: Write integration test for Terminal with Virtual Shell**

```typescript
// frontend/src/__tests__/Terminal-shell.test.ts
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import Terminal from '../components/Terminal.vue'

describe('Terminal with Virtual Shell Integration', () => {
  it('executes neofetch and renders system specs in terminal stream', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('neofetch')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('guest@long4changes')
    expect(wrapper.text()).toContain('CyberKB GNU/Linux')
  })

  it('executes cd and dynamically updates terminal prompt string', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')

    // Initial prompt
    expect(wrapper.text()).toContain('guest@long4changes:~$')

    // CD to /docs
    await input.setValue('cd /docs')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    // Prompt updated to /docs
    expect(wrapper.text()).toContain('guest@long4changes:/docs$')
  })

  it('completes tldr subcommands on Tab', async () => {
    const wrapper = mount(Terminal, {
      props: { catalog: ['ark', 'articles'], isActive: true }
    })
    const input = wrapper.find('input')
    await input.setValue('tldr sea')
    await input.trigger('keydown', { key: 'Tab' })
    await flushPromises()

    // Input buffer autocompleted to 'tldr search'
    expect((input.element as HTMLInputElement).value).toBe('tldr search')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Terminal-shell.test.ts`
Expected: FAIL.

- [ ] **Step 3: Modify Terminal.vue to integrate Virtual Shell**

Update `Terminal.vue` to bind `defaultShellRegistry` for command execution and prompt computation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Terminal-shell.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Terminal.vue frontend/src/__tests__/Terminal-shell.test.ts
git commit -m "feat(terminal): integrate virtual shell engine and dynamic prompt"
```

---

### Task 6: Full Verification, Documentation & Production Build

**Files:**
- Modify: `docs/agents/domain.md` or `CONTEXT.md` (record Virtual Shell architecture)
- Test: All suites (`npm run test`)

- [ ] **Step 1: Run full test suite across all files**

Run: `npm run test`
Expected: All 32+ tests across all test suites PASS.

- [ ] **Step 2: Run production build and typechecking**

Run: `npm run build`
Expected: `vue-tsc -b && vite build` succeeds with 0 errors.

- [ ] **Step 3: Commit and push**

```bash
git add docs/ frontend/
git commit -m "docs: document virtual shell engine and verify production build"
git push origin main
```
