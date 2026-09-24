import type { ShellCommand, ShellContext, CommandResult } from '../types'
import { vfs } from '../vfs'

export const whoamiCommand: ShellCommand = {
  name: 'whoami',
  description: 'print effective userid / current role',
  usage: 'whoami',
  execute: (ctx: ShellContext): CommandResult => {
    return { output: ctx.role || 'guest' }
  }
}

export const pwdCommand: ShellCommand = {
  name: 'pwd',
  description: 'print name of current/working directory',
  usage: 'pwd',
  execute: (ctx: ShellContext): CommandResult => {
    const cwd = ctx.cwd || '/home/liangchen'
    if (cwd === '/home/liangchen' || cwd === '~') {
      return { output: '~' }
    }
    if (cwd.startsWith('/home/liangchen/')) {
      return { output: '~' + cwd.slice('/home/liangchen'.length) }
    }
    return { output: cwd }
  }
}

export const cdCommand: ShellCommand = {
  name: 'cd',
  description: 'change the working directory',
  usage: 'cd [directory]',
  execute: (ctx: ShellContext): CommandResult => {
    const rawTarget = ctx.args[0]
    const target = rawTarget ? rawTarget.trim() : '~'
    const resolved = vfs.resolvePath(ctx.cwd, target, ctx.catalog)
    if (!resolved || !vfs.isDir(resolved)) {
      return { output: 'cd: no such file or directory: ' + (rawTarget || '') }
    }
    ctx.setCwd?.(resolved)
    return { output: '', newCwd: resolved }
  }
}

export const unameCommand: ShellCommand = {
  name: 'uname',
  description: 'print system information',
  usage: 'uname [-a]',
  aliases: ['uname -a'],
  execute: (): CommandResult => {
    return { output: 'Linux long4changes 6.6.0-cyberkb #1 SMP PREEMPT x86_64 GNU/Linux' }
  }
}

export const dateCommand: ShellCommand = {
  name: 'date',
  description: 'display current date and time',
  usage: 'date',
  execute: (): CommandResult => {
    return { output: new Date().toString() }
  }
}

export const uptimeCommand: ShellCommand = {
  name: 'uptime',
  description: 'tell how long the system has been running',
  usage: 'uptime',
  execute: (): CommandResult => {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    return { output: `${time} up 42 days, 1 user, load average: 0.08, 0.03, 0.01` }
  }
}

export const echoCommand: ShellCommand = {
  name: 'echo',
  description: 'display a line of text',
  usage: 'echo [string...]',
  execute: (ctx: ShellContext): CommandResult => {
    return { output: ctx.args ? ctx.args.join(' ') : '' }
  }
}

export const historyCommand: ShellCommand = {
  name: 'history',
  description: 'display command history list',
  usage: 'history',
  execute: (ctx: ShellContext): CommandResult => {
    const history = ctx.history || []
    const output = history
      .map((cmd, i) => `${String(i + 1).padStart(3, ' ')}  ${cmd}`)
      .join('\n')
    return { output }
  }
}

export const manCommand: ShellCommand = {
  name: 'man',
  description: 'an interface to the system reference manuals',
  usage: 'man <command>',
  execute: (ctx: ShellContext): CommandResult => {
    if (ctx.args && ctx.args.length > 0) {
      const target = ctx.args[0]
      return {
        output: `No manual entry for ${target}.\nType 'tldr <cmd>' for simplified cheatsheets. (Try: 'tldr ${target}')`
      }
    }
    return {
      output: `What manual page do you want?\nType 'tldr <cmd>' for simplified cheatsheets.`
    }
  }
}

export const mvCommand: ShellCommand = {
  name: 'mv',
  description: 'move (rename) files',
  usage: 'mv [options] <source> <destination>',
  execute: (ctx: ShellContext): CommandResult => {
    const rawArgs = ctx.args || []
    const isVerbose = rawArgs.includes('-v') || rawArgs.includes('--verbose')
    const isHelp = rawArgs.includes('--help') || rawArgs.includes('-h')

    if (isHelp) {
      return {
        output: `Usage: mv [OPTION]... SOURCE DEST\nRename SOURCE to DEST, or move SOURCE to DIRECTORY.\n\nOptions:\n  -v, --verbose   explain what is being done\n  --help          display this help and exit\n\nType 'tldr mv' for simplified cheat sheets.`
      }
    }

    const posArgs = rawArgs.filter(a => !a.startsWith('-'))

    if (posArgs.length === 0) {
      return {
        output: "mv: missing file operand\nTry 'tldr mv' for more information.",
        type: 'error'
      }
    }

    if (posArgs.length === 1) {
      return {
        output: `mv: missing destination file operand after '${posArgs[0]}'\nTry 'tldr mv' for more information.`,
        type: 'error'
      }
    }

    const source = posArgs[0]
    const destination = posArgs[1]

    let resolvedSrc = vfs.resolvePath(ctx.cwd, source, ctx.catalog)
    // Also support finding slug in catalog if source is without /docs
    if (!resolvedSrc && ctx.catalog && ctx.catalog.includes(source.replace(/\.md$/, ''))) {
      resolvedSrc = `/docs/${source.replace(/\.md$/, '')}.md`
    }

    if (!resolvedSrc) {
      return {
        output: `mv: cannot stat '${source}': No such file or directory`,
        type: 'error'
      }
    }

    if (ctx.role !== 'root') {
      return {
        output: `mv: cannot move '${source}' to '${destination}': Permission denied`,
        type: 'error'
      }
    }

    if (resolvedSrc.startsWith('/bin') || resolvedSrc.startsWith('/etc')) {
      return {
        output: `mv: cannot move '${source}': Read-only file system (system files are immutable)`,
        type: 'error'
      }
    }

    if (vfs.isDir(resolvedSrc)) {
      return {
        output: `mv: cannot move '${source}': Device or resource busy`,
        type: 'error'
      }
    }

    // Process document renaming
    const oldFilename = resolvedSrc.split('/').pop() || ''
    const oldSlug = oldFilename.replace(/\.md$/, '')

    let destFilename = destination.trim().split('/').pop() || destination.trim()
    if (!destFilename || destination.endsWith('/')) {
      destFilename = oldFilename
    }
    const destSlug = destFilename.replace(/\.md$/, '')

    if (oldSlug === destSlug && destination === source) {
      return {
        output: `mv: '${source}' and '${destination}' are the same file`,
        type: 'error'
      }
    }

    if (ctx.catalog) {
      const idx = ctx.catalog.indexOf(oldSlug)
      if (idx !== -1) {
        ctx.catalog[idx] = destSlug
      }
    }

    ctx.renameDocument?.(oldSlug, destSlug)

    return {
      output: isVerbose ? `renamed '${source}' -> '${destination}'` : ''
    }
  }
}

export const rmCommand: ShellCommand = {
  name: 'rm',
  description: 'remove files or directories',
  usage: 'rm [options] <file...>',
  execute: (ctx: ShellContext): CommandResult => {
    const rawArgs = ctx.args || []
    const isRecursive = rawArgs.includes('-r') || rawArgs.includes('-R') || rawArgs.includes('--recursive')
    const isForce = rawArgs.includes('-f') || rawArgs.includes('--force')
    const isVerbose = rawArgs.includes('-v') || rawArgs.includes('--verbose')
    const isHelp = rawArgs.includes('--help') || rawArgs.includes('-h')

    if (isHelp) {
      return {
        output: `Usage: rm [OPTION]... [FILE]...
Remove (unlink) the FILE(s).

Options:
  -f, --force     ignore nonexistent files and arguments, never prompt
  -r, -R, --recursive   remove directories and their contents recursively
  -v, --verbose   explain what is being done
  --help          display this help and exit

Type 'tldr rm' for simplified cheat sheets.`
      }
    }

    const posArgs = rawArgs.filter(a => !a.startsWith('-'))

    if (posArgs.length === 0) {
      if (isForce) {
        return { output: '' }
      }
      return {
        output: "rm: missing operand\nTry 'tldr rm' for more information.",
        type: 'error'
      }
    }

    const removedList: string[] = []

    for (const file of posArgs) {
      let resolved = vfs.resolvePath(ctx.cwd, file, ctx.catalog)
      if (!resolved && ctx.catalog && ctx.catalog.includes(file.replace(/\.md$/, ''))) {
        resolved = `/docs/${file.replace(/\.md$/, '')}.md`
      }

      if (!resolved) {
        if (!isForce) {
          return {
            output: `rm: cannot remove '${file}': No such file or directory`,
            type: 'error'
          }
        }
        continue
      }

      if (resolved === '/') {
        return {
          output: "rm: it is dangerous to operate recursively on '/'",
          type: 'error'
        }
      }

      if (ctx.role !== 'root') {
        return {
          output: `rm: cannot remove '${file}': Permission denied`,
          type: 'error'
        }
      }

      if (resolved.startsWith('/bin') || resolved.startsWith('/etc')) {
        return {
          output: `rm: cannot remove '${file}': Read-only file system (system files and directories are protected)`,
          type: 'error'
        }
      }

      if (vfs.isDir(resolved)) {
        if (!isRecursive) {
          return {
            output: `rm: cannot remove '${file}': Is a directory`,
            type: 'error'
          }
        }
        if (['/docs', '/home', '/bin', '/etc'].includes(resolved)) {
          return {
            output: `rm: cannot remove '${file}': Device or resource busy`,
            type: 'error'
          }
        }
      }

      const filename = resolved.split('/').pop() || ''
      const slug = filename.replace(/\.md$/, '')

      if (ctx.catalog) {
        const idx = ctx.catalog.indexOf(slug)
        if (idx !== -1) {
          ctx.catalog.splice(idx, 1)
        }
      }

      ctx.removeDocument?.(slug)
      removedList.push(file)
    }

    if (isVerbose && removedList.length > 0) {
      return {
        output: removedList.map(f => `removed '${f}'`).join('\n')
      }
    }

    return { output: '' }
  }
}

export const builtinCommands: ShellCommand[] = [
  whoamiCommand,
  pwdCommand,
  cdCommand,
  unameCommand,
  dateCommand,
  uptimeCommand,
  echoCommand,
  historyCommand,
  manCommand,
  mvCommand,
  rmCommand
]
