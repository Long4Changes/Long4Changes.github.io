import type { ShellCommand, ShellContext, CommandResult } from './types'
import { builtinCommands } from './commands/builtins'
import { modernCommands } from './commands/modern'

function findLongestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (!prefix) return ''
    }
  }
  return prefix
}

export class ShellRegistry {
  private commands = new Map<string, ShellCommand>()
  private aliasMap = new Map<string, string>()

  constructor() {
    this.registerAll(builtinCommands)
    this.registerAll(modernCommands)
  }

  public registerCommand(cmd: ShellCommand): void {
    this.commands.set(cmd.name.toLowerCase(), cmd)
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliasMap.set(alias.toLowerCase(), cmd.name.toLowerCase())
      }
    }
  }

  public registerAll(cmds: ShellCommand[]): void {
    for (const cmd of cmds) {
      this.registerCommand(cmd)
    }
  }

  public getCommand(name: string): ShellCommand | undefined {
    const key = name.toLowerCase()
    if (this.commands.has(key)) {
      return this.commands.get(key)
    }
    const realName = this.aliasMap.get(key)
    if (realName && this.commands.has(realName)) {
      return this.commands.get(realName)
    }
    return undefined
  }

  public getAllCommands(): ShellCommand[] {
    return Array.from(this.commands.values())
  }

  public getAllCommandNames(): string[] {
    const names = new Set<string>()
    for (const name of this.commands.keys()) {
      names.add(name)
    }
    for (const alias of this.aliasMap.keys()) {
      names.add(alias)
    }
    return Array.from(names).sort()
  }

  public async execute(rawInput: string, ctx: ShellContext): Promise<CommandResult> {
    const trimmed = rawInput.trim()
    if (!trimmed) {
      return { output: '' }
    }

    const parts = trimmed.split(/\s+/)
    const cmdName = parts[0]
    const args = parts.slice(1)

    const cmd = this.getCommand(cmdName)
    if (!cmd) {
      return {
        output: `Command not found: ${cmdName}. Type 'help' or 'tldr' for available commands.`,
        type: 'error'
      }
    }

    const commandCtx: ShellContext = {
      ...ctx,
      args,
      rawCommand: trimmed
    }

    return await cmd.execute(commandCtx)
  }

  public getAutocomplete(
    input: string,
    ctx: ShellContext
  ): { matches: string[]; commonPrefix: string; appendSpace: boolean } {
    const trimmedLeft = input.trimStart()
    if (!trimmedLeft) {
      return { matches: [], commonPrefix: '', appendSpace: false }
    }

    const parts = trimmedLeft.split(/\s+/)

    // Case 1: Typing the command name itself
    if (parts.length === 1 && !input.endsWith(' ')) {
      const prefix = parts[0].toLowerCase()
      const allNames = this.getAllCommandNames()
      // Also include system commands if any
      const systemNames = ['help', 'ls', 'search', 'ask', 'open', 'cat', 'sudo', 'auth', 'logout', 'sync', 'clear']
      const combined = Array.from(new Set([...allNames, ...systemNames]))
      const matches = combined.filter(c => c.toLowerCase().startsWith(prefix))
      const common = findLongestCommonPrefix(matches)
      return { matches, commonPrefix: common, appendSpace: true }
    }

    const cmdName = parts[0].toLowerCase()
    const arg = parts.length > 1 ? parts[1].toLowerCase() : ''

    // Case 2: tldr <cmd>
    if (cmdName === 'tldr' || cmdName === 'man') {
      const allNames = Array.from(new Set([...this.getAllCommandNames(), 'help', 'ls', 'search', 'ask', 'open', 'sudo', 'sync']))
      const matches = allNames
        .filter(c => c.toLowerCase().startsWith(arg))
        .map(c => `${cmdName} ${c}`)
      const common = findLongestCommonPrefix(matches)
      return { matches, commonPrefix: common, appendSpace: false }
    }

    // Case 3: bat/glow/cat/open <slug>
    if (['bat', 'glow', 'cat', 'open'].includes(cmdName)) {
      const catalog = ctx.catalog || []
      const matches = catalog
        .filter(slug => slug.toLowerCase().startsWith(arg))
        .map(slug => `${cmdName} ${slug}`)
      const common = findLongestCommonPrefix(matches)
      return { matches, commonPrefix: common, appendSpace: false }
    }

    // Case 4: cd <dir>
    if (cmdName === 'cd') {
      const dirs = ['~', '/docs', '/bin', '/etc', '/home', '/']
      const matches = dirs
        .filter(d => d.toLowerCase().startsWith(arg))
        .map(d => `cd ${d}`)
      const common = findLongestCommonPrefix(matches)
      return { matches, commonPrefix: common, appendSpace: false }
    }

    // Case 5: sudo su
    if (cmdName === 'sudo') {
      if ('su'.startsWith(arg)) {
        return { matches: ['sudo su'], commonPrefix: 'sudo su', appendSpace: false }
      }
    }

    return { matches: [], commonPrefix: '', appendSpace: false }
  }
}

export const defaultShellRegistry = new ShellRegistry()
