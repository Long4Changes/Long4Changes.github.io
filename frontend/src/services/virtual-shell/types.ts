export interface ShellContext {
  args: string[]
  rawCommand: string
  cwd: string
  role: 'guest' | 'root'
  catalog: string[]
  history: string[]
  getDocument: (slug: string) => Promise<{ slug: string; title: string; content: string; visibility: string }>
  setCwd: (newCwd: string) => void
  renameDocument?: (oldSlug: string, newSlug: string) => void
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
