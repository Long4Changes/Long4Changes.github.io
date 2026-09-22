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

export const builtinCommands: ShellCommand[] = [
  whoamiCommand,
  pwdCommand,
  cdCommand,
  unameCommand,
  dateCommand,
  uptimeCommand,
  echoCommand,
  historyCommand,
  manCommand
]
