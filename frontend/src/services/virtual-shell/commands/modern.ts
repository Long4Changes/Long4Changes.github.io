import type { ShellCommand, ShellContext, CommandResult } from '../types'

/**
 * Calculates visual display width of a string in monospace terminal font,
 * taking full-width CJK characters into account (width 2).
 */
function getVisualWidth(str: string): number {
  let width = 0
  for (const char of str) {
    const code = char.codePointAt(0) || 0
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

// -----------------------------------------------------------------------------
// 1. neofetch / fastfetch
// -----------------------------------------------------------------------------

const mascotArt = [
  '      /\\_/\\     ',
  '     ( o.o )    ',
  '      > ^ <     ',
  '     /|   |\\    ',
  '    (_|   |_)   ',
  '     /|___|\\    ',
  '    (_______)   ',
  '     |  |  |    ',
  '    (___|___)   ',
  '                ',
  '                ',
  '                '
]

function renderNeofetch(ctx: ShellContext): CommandResult {
  const user = ctx.role === 'root' ? 'root' : 'guest'
  const userHost = `${user}@long4changes`
  const separator = '-'.repeat(userHost.length)
  const catalogCount = ctx.catalog?.length ?? 0

  const specs = [
    userHost,
    separator,
    'OS: CyberKB GNU/Linux x86_64',
    'Host: Long4Changes WebStation',
    'Kernel: 6.6.0-vibe-kernel',
    'Uptime: 42 days, 13 hours, 37 mins',
    `Packages: ${catalogCount} (virtual docs)`,
    'Shell: vibe-sh 2.0 (Vue-DOM)',
    'Author: 梁晨 <liangchen0920@gmail.com>',
    'Role: Independent Developer / Vibe Coding Enthusiast',
    '',
    '███  ███  ███  ███  ███  ███  ███  ███'
  ]

  const maxLines = Math.max(mascotArt.length, specs.length)
  const outputLines: string[] = []

  for (let i = 0; i < maxLines; i++) {
    const art = mascotArt[i] ?? '                '
    const spec = specs[i] ?? ''
    outputLines.push(`${art}   ${spec}`.trimEnd())
  }

  return {
    output: outputLines.join('\n'),
    type: 'neofetch'
  }
}

const neofetchCommand: ShellCommand = {
  name: 'neofetch',
  description: 'Display system information badge and mascot',
  usage: 'neofetch',
  aliases: ['fastfetch'],
  execute: (ctx) => renderNeofetch(ctx)
}

const fastfetchCommand: ShellCommand = {
  name: 'fastfetch',
  description: 'Display system information badge and mascot (fastfetch alias)',
  usage: 'fastfetch',
  execute: (ctx) => renderNeofetch(ctx)
}

// -----------------------------------------------------------------------------
// 2. bat <slug>
// -----------------------------------------------------------------------------

const batCommand: ShellCommand = {
  name: 'bat',
  description: 'View document with syntax framing and line numbers',
  usage: 'bat <slug>',
  execute: async (ctx): Promise<CommandResult> => {
    if (!ctx.args[0]) {
      return {
        output: 'bat: missing file argument\nUsage: bat <slug>',
        type: 'error'
      }
    }

    let slug = ctx.args[0].trim()
    if (slug.endsWith('.md')) {
      slug = slug.slice(0, -3)
    }

    try {
      const doc = await ctx.getDocument(slug)
      if (!doc || typeof doc.content !== 'string') {
        return {
          output: `bat: ${slug}: No such document or file`,
          type: 'error'
        }
      }

      const lines = doc.content.split('\n')
      const numWidth = Math.max(1, String(lines.length).length)
      const leftBorder = '─'.repeat(numWidth + 2)
      const rightBorder = '─'.repeat(58)

      const header = `${leftBorder}┬${rightBorder}\n${' '.repeat(numWidth + 2)}│ File: ${slug}.md\n${leftBorder}┼${rightBorder}`
      const body = lines
        .map((line, idx) => {
          const numStr = String(idx + 1).padStart(numWidth, ' ')
          return `${numStr} │ ${line}`
        })
        .join('\n')
      const footer = `${leftBorder}┴${rightBorder}`

      return {
        output: `${header}\n${body}\n${footer}`,
        type: 'bat'
      }
    } catch {
      return {
        output: `bat: ${slug}: No such document or file`,
        type: 'error'
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 3. glow <slug>
// -----------------------------------------------------------------------------

const glowCommand: ShellCommand = {
  name: 'glow',
  description: 'Render document with terminal Markdown formatting',
  usage: 'glow <slug>',
  execute: async (ctx): Promise<CommandResult> => {
    if (!ctx.args[0]) {
      return {
        output: 'glow: missing file argument\nUsage: glow <slug>',
        type: 'error'
      }
    }

    let slug = ctx.args[0].trim()
    if (slug.endsWith('.md')) {
      slug = slug.slice(0, -3)
    }

    try {
      const doc = await ctx.getDocument(slug)
      if (!doc || typeof doc.content !== 'string') {
        return {
          output: `glow: ${slug}: No such document or file`,
          type: 'error'
        }
      }

      const title = doc.title || slug
      const titleWidth = getVisualWidth(title)
      const boxInnerWidth = Math.max(63, titleWidth + 4)

      const topBorder = `╔${'═'.repeat(boxInnerWidth)}╗`
      const rightPadding = ' '.repeat(Math.max(0, boxInnerWidth - 2 - titleWidth))
      const titleLine = `║  ${title}${rightPadding}║`
      const bottomBorder = `╚${'═'.repeat(boxInnerWidth)}╝`
      const titleBox = `${topBorder}\n${titleLine}\n${bottomBorder}`

      // Markdown formatting:
      // - Code blocks framed with dashed borders
      // - Blockquotes indented with │
      // - Normal lines indented by 2 spaces
      const rawLines = doc.content.split('\n')
      const formattedLines: string[] = []
      let inCodeBlock = false
      let codeLang = ''

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i]
        const trimmed = line.trim()

        if (trimmed.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true
            codeLang = trimmed.slice(3).trim()
            const codeHeader = codeLang ? ` [${codeLang}] ` : ' '
            const dashWidth = Math.max(40, boxInnerWidth - 2)
            formattedLines.push(`  ┌${codeHeader}${'─'.repeat(Math.max(0, dashWidth - getVisualWidth(codeHeader)))}┐`)
          } else {
            inCodeBlock = false
            const dashWidth = Math.max(40, boxInnerWidth - 2)
            formattedLines.push(`  └${'─'.repeat(dashWidth)}┘`)
          }
          continue
        }

        if (inCodeBlock) {
          formattedLines.push(`  │ ${line}`)
        } else if (trimmed.startsWith('>')) {
          const quoteText = trimmed.replace(/^>\s*/, '')
          formattedLines.push(`  │  ${quoteText}`)
        } else if (trimmed === '') {
          formattedLines.push('')
        } else {
          formattedLines.push(`  ${line}`)
        }
      }

      return {
        output: `${titleBox}\n\n${formattedLines.join('\n')}`,
        type: 'glow'
      }
    } catch {
      return {
        output: `glow: ${slug}: No such document or file`,
        type: 'error'
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 4. tldr [command]
// -----------------------------------------------------------------------------

const tldrPages: Record<string, string> = {
  search: `search - Search knowledge base documents

- Search for articles matching keyword:
  search <query>

- Search with multi-word phrase:
  search "vibe coding"`,

  bat: `bat - Cat clone with syntax framing and line numbers

- View a document with line numbers:
  bat <slug>

- View a document explicitly with extension:
  bat <slug>.md`,

  glow: `glow - Terminal Markdown reader

- Render a markdown document in terminal:
  glow <slug>`,

  tldr: `tldr - Simplified command cheat sheets

- View directory of all available commands:
  tldr

- View cheat sheet for a specific command:
  tldr <command>`,

  tree: `tree - Visual directory hierarchy tree

- Display entire directory tree from root:
  tree

- Display tree of a specific directory:
  tree <directory>`,

  neofetch: `neofetch - Fast, customizable system info badge

- Display system information and mascot:
  neofetch`,

  fastfetch: `fastfetch - Fast, customizable system info badge

- Display system information and mascot:
  fastfetch`,

  cd: `cd - Change working directory

- Change to specific directory:
  cd <directory>

- Go to home directory:
  cd ~

- Go to root directory:
  cd /

- Go to docs directory:
  cd /docs

- Go to parent directory:
  cd ..`,

  pwd: `pwd - Print working directory

- Print the current working directory path:
  pwd`,

  whoami: `whoami - Print current user role

- Display current username / role:
  whoami`,

  uname: `uname - Print system and kernel info

- Display all system information:
  uname -a`,

  date: `date - Display current date and time

- Print current system date:
  date`,

  uptime: `uptime - Display system uptime and load average

- Show how long the system has been running:
  uptime`,

  echo: `echo - Print arguments to standard output

- Print a text string:
  echo <text>`,

  history: `history - Display shell command history

- View command history:
  history`,

  sudo: `sudo - Execute command with superuser privileges

- Elevate to root interactive shell:
  sudo su`,

  cat: `cat - Print file contents

- Print document content in plain text:
  cat <slug>`,

  ls: `ls - List directory contents

- List files in current directory:
  ls

- List files in long format:
  ls -l`,

  ask: `ask - RAG interactive AI assistant

- Ask AI assistant a question about the knowledge base:
  ask <question>`,

  open: `open - Open document in split card reader

- Open a document:
  open <slug>`,

  sync: `sync - Synchronize knowledge base

- Fetch latest documents:
  sync`,

  clear: `clear - Clear terminal display buffer

- Clear screen:
  clear`,

  help: `help - Display system command manual

- Show quick help:
  help`,

  man: `man - Format and display manual pages

- View command manual (delegates to tldr):
  man <command>`,

  mv: `mv - Move and rename files

- Rename a file:
  mv <source> <destination>

- Move a file into another directory:
  mv <source> <directory/>

- Move with verbose output:
  mv -v <source> <destination>`,

  rm: `rm - Remove files or directories

- Remove specific files:
  rm <file1> <file2>

- Recursively remove a directory:
  rm -r <directory>

- Force removal without prompting:
  rm -f <file>

- Verbose removal:
  rm -v <file>`,

  vim: `vim - Ubiquitous text editor

- Open a document in full-screen editor:
  vim <slug>

- Switch to Insert mode:
  i

- Return to Normal mode:
  <Escape>

- Save changes:
  :w

- Save and exit:
  :wq

- Quit without saving:
  :q!`,

  nvim: `nvim - Hyperextensible Vim-based text editor

- Open document in full-screen Neovim:
  nvim <slug>

- Switch to Insert mode:
  i

- Save changes:
  :w

- Save and exit:
  :wq

- Force quit without saving:
  :q!`
}

const tldrCommand: ShellCommand = {
  name: 'tldr',
  description: 'Simplified, practical command reference pages',
  usage: 'tldr [command]',
  execute: (ctx): CommandResult => {
    const target = ctx.args[0]?.toLowerCase().trim()

    if (!target) {
      const summary = `tldr - simplified command pages

NAVIGATION & SYSTEM
  whoami   - Display current username and privilege role
  pwd      - Print current working directory
  cd       - Change virtual directory
  ls       - List directory files and documents
  tree     - View visual directory hierarchy
  uname    - Display system and kernel information
  date     - Print current system date and time
  uptime   - Show session uptime and system load
  echo     - Print arguments to terminal output
  history  - Show shell command execution history
  clear    - Clear terminal screen
  mv       - Move or rename documents and files
  rm       - Remove files or directories

EDITORS & CONTENT
  vim      - Full-screen Vim modal text editor
  nvim     - Full-screen Neovim modal text editor
  cat      - Print document contents in plain text
  bat      - View document with line numbers and syntax framing
  glow     - Render document in terminal Markdown styling
  open     - Open document in graphic split card view
  search   - Search knowledge base with BM25 & semantic indexing
  ask      - RAG interactive AI assistant streaming responses

UTILITIES & ADMIN
  neofetch - Display system information badge and mascot
  fastfetch- Alias for neofetch
  tldr     - Quick reference guides for commands
  sudo     - Execute command as superuser (root)
  sync     - Fetch latest documents from remote repository
  help     - Display help information

Type 'tldr <command>' to view usage examples for a specific command.`

      return {
        output: summary,
        type: 'text'
      }
    }

    const entry = tldrPages[target]
    if (entry) {
      return {
        output: entry,
        type: 'text'
      }
    }

    return {
      output: `No tldr entry for ${target}. Try running 'tldr' to see available commands.`,
      type: 'text'
    }
  }
}

// -----------------------------------------------------------------------------
// 5. tree [dir]
// -----------------------------------------------------------------------------

const virtualBinaries = [
  'ask*',
  'bat*',
  'cat*',
  'cd*',
  'clear*',
  'date*',
  'echo*',
  'fastfetch*',
  'glow*',
  'help*',
  'history*',
  'ls*',
  'neofetch*',
  'open*',
  'pwd*',
  'search*',
  'sudo*',
  'sync*',
  'tldr*',
  'tree*',
  'uname*',
  'whoami*'
]

const treeCommand: ShellCommand = {
  name: 'tree',
  description: 'Print visual directory tree of virtual filesystem',
  usage: 'tree [dir]',
  execute: (ctx): CommandResult => {
    let target = ctx.args[0]?.trim() || ''
    if (target.endsWith('/') && target !== '/') {
      target = target.slice(0, -1)
    }

    const docsFiles = (ctx.catalog || []).map((slug) => (slug.endsWith('.md') ? slug : `${slug}.md`))
    const etcFiles = ['motd', 'os-release']

    if (!target || target === '/' || target === '.') {
      const lines: string[] = ['/']

      // ├── bin/
      lines.push('├── bin/')
      virtualBinaries.forEach((b, idx) => {
        const isLast = idx === virtualBinaries.length - 1
        lines.push(`│   ${isLast ? '└──' : '├──'} ${b}`)
      })

      // ├── docs/
      lines.push('├── docs/')
      docsFiles.forEach((d, idx) => {
        const isLast = idx === docsFiles.length - 1
        lines.push(`│   ${isLast ? '└──' : '├──'} ${d}`)
      })

      // ├── etc/
      lines.push('├── etc/')
      etcFiles.forEach((e, idx) => {
        const isLast = idx === etcFiles.length - 1
        lines.push(`│   ${isLast ? '└──' : '├──'} ${e}`)
      })

      // └── home/
      lines.push('└── home/')
      lines.push('    └── liangchen/')

      const totalDirs = 4
      const totalFiles = virtualBinaries.length + docsFiles.length + etcFiles.length
      lines.push(`\n${totalDirs} directories, ${totalFiles} files`)

      return {
        output: lines.join('\n'),
        type: 'text'
      }
    }

    const normalized = target.startsWith('/') ? target.slice(1) : target

    if (normalized === 'docs') {
      const lines: string[] = ['docs/']
      docsFiles.forEach((d, idx) => {
        const isLast = idx === docsFiles.length - 1
        lines.push(`${isLast ? '└──' : '├──'} ${d}`)
      })
      lines.push(`\n0 directories, ${docsFiles.length} files`)
      return {
        output: lines.join('\n'),
        type: 'text'
      }
    }

    if (normalized === 'bin') {
      const lines: string[] = ['bin/']
      virtualBinaries.forEach((b, idx) => {
        const isLast = idx === virtualBinaries.length - 1
        lines.push(`${isLast ? '└──' : '├──'} ${b}`)
      })
      lines.push(`\n0 directories, ${virtualBinaries.length} files`)
      return {
        output: lines.join('\n'),
        type: 'text'
      }
    }

    if (normalized === 'etc') {
      const lines: string[] = ['etc/']
      etcFiles.forEach((e, idx) => {
        const isLast = idx === etcFiles.length - 1
        lines.push(`${isLast ? '└──' : '├──'} ${e}`)
      })
      lines.push(`\n0 directories, ${etcFiles.length} files`)
      return {
        output: lines.join('\n'),
        type: 'text'
      }
    }

    if (normalized === 'home' || normalized === 'home/liangchen' || normalized === '~') {
      const lines: string[] = ['home/']
      lines.push('└── liangchen/')
      lines.push('\n1 directory, 0 files')
      return {
        output: lines.join('\n'),
        type: 'text'
      }
    }

    return {
      output: `tree: ${target}: No such directory`,
      type: 'error'
    }
  }
}

export const modernCommands: ShellCommand[] = [
  neofetchCommand,
  fastfetchCommand,
  batCommand,
  glowCommand,
  tldrCommand,
  treeCommand
]
