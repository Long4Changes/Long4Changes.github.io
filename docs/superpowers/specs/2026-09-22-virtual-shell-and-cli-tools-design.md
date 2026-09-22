# Technical Design Specification: Virtual Shell & Modern CLI Tools (bat, glow, tldr, neofetch)

**Date**: 2026-09-22  
**Status**: Approved  
**Author**: Antigravity Agent & 梁晨  

---

## 1. Context & Motivation

The Long4Changes web station integrates a retro ASCII interface inspired by `kanjousen.com` and `jiangyy.github.io`. While the system already provides core operations (`help`, `ls`, `search`, `ask`, `open`, `cat`, `sudo`, `auth`, `logout`, `sync`, `clear`), visitors expect a richer, authentic terminal emulator experience mimicking a real Linux developer workstation.

This specification details the architecture and implementation of a client-side **Virtual Shell Engine**, incorporating:
1. **Modern CLI utilities**: `bat`, `glow`, `tldr`, `neofetch`, and `tree`.
2. **Standard Linux shell builtins**: `whoami`, `pwd`, `cd`, `uname`, `date`, `uptime`, `echo`, `history`, and `man`.
3. **Context-aware Tab autocomplete**: Expanding to 20+ commands, sub-commands, document slugs, and VFS paths.
4. **Dynamic prompt updates**: Synchronizing current directory (`cwd`) and authentication role (`guest` vs `root`).

---

## 2. Architecture & Directory Structure

To prevent component bloat and maintain clean boundaries, the shell logic is decoupled from `Terminal.vue` into a dedicated virtual shell service module:

```
frontend/src/
├── services/
│   ├── api.ts                  # Document fetching, vector search, RAG stream, auth
│   └── virtual-shell/          # Virtual Shell Engine
│       ├── types.ts            # Shell types, execution context, command interfaces
│       ├── vfs.ts              # In-memory virtual file system and path resolution
│       ├── registry.ts         # Command registry and dispatch router
│       └── commands/
│           ├── builtins.ts     # whoami, pwd, cd, uname, date, uptime, echo, history
│           ├── modern.ts       # bat, glow, tldr, neofetch, tree
│           └── system.ts       # Bridges to search, ask, sudo, sync, clear, help, open
├── components/
│   ├── Terminal.vue            # View layer: input capture, IME composition, history stream
│   └── ...
```

---

## 3. Interfaces & Execution Context

### 3.1 Types (`types.ts`)

```typescript
export interface ShellContext {
  args: string[]
  rawCommand: string
  cwd: string
  role: 'guest' | 'root'
  catalog: string[]
  history: string[]
  getDocument: (slug: string) => Promise<{ slug: string; title: string; content: string; visibility: string }>
  setCwd: (newCwd: string) => void
}

export type CommandOutputType = 'text' | 'bat' | 'glow' | 'neofetch' | 'search-results' | 'rag-answer' | 'error'

export interface CommandResult {
  output: string
  type?: CommandOutputType
  newCwd?: string
}

export interface ShellCommand {
  name: string
  description: string
  usage: string
  aliases?: string[]
  execute: (ctx: ShellContext) => Promise<CommandResult> | CommandResult
}
```

---

## 4. Virtual File System (VFS)

The virtual file system provides simulated directories and files matching Linux conventions:

- `/`: Root directory. Contains `home/`, `docs/`, `bin/`, `etc/`.
- `~` (`/home/liangchen`): Default home directory for the user.
- `/docs`: Virtual directory containing all catalog documents (`ark.md`, `articles.md`, `about.md`).
- `/bin`: Virtual executables (`bat*`, `glow*`, `neofetch*`, `tldr*`, `ls*`, `cat*`).
- `/etc`: Configuration files (`motd`, `os-release`).

Path resolution supports:
- Absolute paths: `/docs`, `/home/liangchen`
- Relative paths: `docs`, `..`, `./bin`
- Tilde shorthand: `~`, `~/docs`

---

## 5. Modern CLI Tools & Output Specifications

### 5.1 `neofetch` / `fastfetch`
Outputs ASCII pet/station art on the left and system specs on the right:
- Monospaced ASCII badge.
- OS: `CyberKB GNU/Linux (x86_64)`
- Host: `Long4Changes WebStation`
- Kernel: `6.6.0-vibe-kernel`
- Uptime: dynamic session elapsed time + mock days.
- Packages: count of documents in catalog.
- Shell: `vibe-sh 2.0 (Vue-DOM)`
- Author: `梁晨 (liangchen0920@gmail.com)`
- Role: `Independent Developer / Vibe Coding Enthusiast`
- Retro color swatch blocks: `███ ███ ███ ███ ███`.

### 5.2 `bat <slug>`
Renders code or document with two-column layout:
- ASCII border header displaying `File: <slug>.md`.
- Right-aligned line numbers followed by separator `│`.
- Document lines preserving whitespace and syntax.
- Footer line closing the table.

### 5.3 `glow <slug>`
Renders formatted Markdown in the terminal stream:
- ASCII double-line title box:
  ```text
  ╔═══════════════════════════════════════════════════════════════╗
  ║ <Document Title>                                              ║
  ╚═══════════════════════════════════════════════════════════════╝
  ```
- Sub-headings highlighted with retro hashes `##`.
- Monospace blockquote indentation `│`.
- Code blocks framed in dashed borders.

### 5.4 `tldr [command]`
- When run without arguments: outputs a categorized quick-reference index of all available commands.
- When run with `<command>`: outputs concise, actionable examples (e.g. `tldr search`, `tldr bat`, `tldr sudo`).

### 5.5 `tree [dir]`
Generates an ASCII tree diagram representing the VFS hierarchy, displaying directories and files.

---

## 6. Linux Shell Builtins

1. `whoami`: Returns `guest` or `root` depending on current session authentication.
2. `pwd`: Returns the normalized current working directory (e.g. `~` or `/docs`).
3. `cd [dir]`: Changes current directory, updating the terminal prompt. Invalid paths return `cd: no such file or directory: <dir>`.
4. `uname -a`: Returns `Linux long4changes 6.6.0-cyberkb #1 SMP PREEMPT x86_64 GNU/Linux`.
5. `date`: Returns ISO/locale formatted current real time.
6. `uptime`: Returns simulated uptime and load averages (`load average: 0.08, 0.03, 0.01`).
7. `echo [args...]`: Echoes back the arguments joined by space.
8. `history`: Returns 1-indexed list of commands executed in the current session.
9. `man <cmd>`: Alias directing to `tldr <cmd>`.

---

## 7. Context-Aware Tab Autocomplete

1. **Command completion**: Tab on command prefix matches all registered commands (20+ commands).
2. **Document slug completion**: For `bat`, `glow`, `cat`, `open`: matches catalog slugs.
3. **Command argument completion**: For `tldr`: matches all command names.
4. **Path completion**: For `cd`: matches VFS subdirectories.

---

## 8. Terminal Integration & Prompt

Prompt format dynamically reflects cwd and role:
- Guest in home: `guest@long4changes:~$ `
- Guest in docs: `guest@long4changes:/docs$ `
- Root in home: `root@long4changes:~# `

All existing features (IME composition preview, password masking for `sudo su`, RAG streaming typewriter effect, WindowCard split-pane integration) remain untouched and verified.

---

## 9. Verification & Test Plan

1. **Unit tests (`src/__tests__/virtual-shell.test.ts`)**:
   - VFS navigation (`cd`, `pwd`, path resolution, invalid paths).
   - Builtin commands output (`whoami`, `uname`, `date`, `uptime`, `echo`, `history`).
   - Modern tools output formatting (`neofetch`, `bat`, `glow`, `tldr`, `tree`).
2. **Integration tests (`src/__tests__/Terminal-shell.test.ts`)**:
   - Command dispatch and rendering in `Terminal.vue`.
   - Dynamic prompt transformation upon `cd`.
   - Multi-level Tab autocomplete verification.
3. **Full Suite Regression**:
   - Run all 28 existing frontend tests.
   - Run `npm run build` with zero TypeScript errors.
