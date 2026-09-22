<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import {
  searchDocuments,
  askQuestionStream,
  loginAuth,
  clearAuthSession,
  getAuthRole,
  syncDocuments,
  type SearchResultItem,
  type CitationItem,
  type Role
} from '../services/api'

interface HistoryItem {
  prompt?: string
  command: string
  response?: string
  type?: 'text' | 'search-results' | 'rag-answer' | 'error'
  searchResults?: SearchResultItem[]
  ragContent?: string
  citations?: CitationItem[]
  isStreaming?: boolean
}

const props = defineProps<{
  catalog: string[]
  isActive: boolean
}>()

const emit = defineEmits<{
  (e: 'open', slug: string): void
  (e: 'auth-change', role: Role): void
}>()

const history = ref<HistoryItem[]>([])
const inputBuffer = ref('')
const inputElement = ref<HTMLInputElement | null>(null)
const container = ref<HTMLElement | null>(null)

const commandHistory = ref<string[]>([])
const historyIndex = ref<number>(-1)
const draftInput = ref<string>('')

const AVAILABLE_COMMANDS = [
  'help',
  'ls',
  'search',
  'ask',
  'open',
  'cat',
  'sudo',
  'auth',
  'logout',
  'sync',
  'clear'
]

const role = ref<Role>(getAuthRole())
const isPasswordMode = ref(false)
const isComposing = ref(false)
const compositionBuffer = ref('')
const passwordPrompt = ref('[sudo] password for guest: ')

const promptStr = computed(() => {
  return role.value === 'root' ? 'root@long4changes:~#' : 'guest@long4changes:/$'
})

function onCompositionStart() {
  isComposing.value = true
  compositionBuffer.value = ''
}

function onCompositionUpdate(e: CompositionEvent) {
  isComposing.value = true
  compositionBuffer.value = e.data || ''
}

function onCompositionEnd() {
  isComposing.value = false
  compositionBuffer.value = ''
}

function onInput(e: Event) {
  if (isComposing.value) {
    const target = e.target as HTMLInputElement
    if (!compositionBuffer.value && target && target.value.startsWith(inputBuffer.value)) {
      compositionBuffer.value = target.value.slice(inputBuffer.value.length)
    }
  }
}

async function handleCommand(cmd: string) {
  // If in password prompt mode
  if (isPasswordMode.value) {
    const enteredPassword = cmd.trim()
    isPasswordMode.value = false
    const maskedLen = Math.max(4, enteredPassword.length)
    const maskedDisplay = '*'.repeat(maskedLen)
    
    const pendingIndex = history.value.length
    history.value.push({
      prompt: passwordPrompt.value,
      command: maskedDisplay,
      response: 'Authenticating...'
    })
    scrollToBottom()

    try {
      const authRes = await loginAuth(enteredPassword)
      role.value = 'root'
      history.value[pendingIndex] = {
        prompt: passwordPrompt.value,
        command: maskedDisplay,
        response: `Authentication successful. Welcome, ${authRes.role}. Prompt updated to root.`
      }
      emit('auth-change', 'root')
    } catch (err: any) {
      history.value[pendingIndex] = {
        prompt: passwordPrompt.value,
        command: maskedDisplay,
        response: `sudo: 1 incorrect password attempt. ${err.message || 'Access denied.'}`
      }
    }
    scrollToBottom()
    return
  }

  const trimmedCmd = cmd.trim()
  if (!trimmedCmd) return

  commandHistory.value.push(trimmedCmd)
  historyIndex.value = -1
  draftInput.value = ''

  const currentPrompt = promptStr.value
  const parts = trimmedCmd.split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1)

  if (command === 'help') {
    history.value.push({
      prompt: currentPrompt,
      command: trimmedCmd,
      response: 'Available commands:\n  help             - Show this help menu\n  ls               - List available document slugs\n  search <query>   - Semantic vector search across documents\n  ask <question>   - RAG conversational Q&A with token streaming\n  open <slug>      - Open document in split-pane ASCII window card\n  cat <slug>       - Alias for open <slug>\n  sudo su / auth   - Authenticate with owner passkey (root mode)\n  logout           - Exit root session and revert to guest\n  sync             - Synchronize repository markdown documents (requires root)\n  clear            - Clear terminal screen'
    })
  } else if (command === 'ls') {
    history.value.push({
      prompt: currentPrompt,
      command: trimmedCmd,
      response: props.catalog.length > 0 ? props.catalog.join('  ') : 'No documents found.'
    })
  } else if (command === 'clear') {
    history.value = []
    return
  } else if (command === 'sudo' || command === 'auth') {
    if (command === 'sudo' && args.join(' ') !== 'su') {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: "Usage: sudo su (or type 'auth')"
      })
    } else if (role.value === 'root') {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: 'Already running as root.'
      })
    } else {
      isPasswordMode.value = true
      passwordPrompt.value = '[sudo] password for guest: '
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: ''
      })
    }
  } else if (command === 'logout') {
    if (role.value === 'root') {
      clearAuthSession()
      role.value = 'guest'
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: 'Session closed. Reverted to guest privileges.'
      })
      emit('auth-change', 'guest')
    } else {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: 'Already in guest session.'
      })
    }
  } else if (command === 'open' || command === 'cat') {
    const slug = args[0]
    if (!slug) {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: `Usage: ${command} <slug>`
      })
    } else {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: ''
      })
      emit('open', slug)
    }
  } else if (command === 'search') {
    const query = args.join(' ')
    if (!query) {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: 'Usage: search <query>'
      })
    } else {
      const pendingIndex = history.value.length
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: `Searching semantic index for "${query}"...`
      })
      scrollToBottom()

      try {
        const results = await searchDocuments(query)
        if (results.length === 0) {
          history.value[pendingIndex] = {
            prompt: currentPrompt,
            command: trimmedCmd,
            response: `No matching document chunks found for: "${query}".`
          }
        } else {
          history.value[pendingIndex] = {
            prompt: currentPrompt,
            command: trimmedCmd,
            type: 'search-results',
            searchResults: results
          }
        }
      } catch (err: any) {
        history.value[pendingIndex] = {
          prompt: currentPrompt,
          command: trimmedCmd,
          response: `Search error: ${err.message || 'Failed to query vector database'}`
        }
      }
    }
  } else if (command === 'ask') {
    const question = args.join(' ')
    if (!question) {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: 'Usage: ask <question>'
      })
    } else {
      const ragItem: HistoryItem = {
        prompt: currentPrompt,
        command: trimmedCmd,
        type: 'rag-answer',
        ragContent: '',
        citations: [],
        isStreaming: true
      }
      history.value.push(ragItem)
      scrollToBottom()

      await askQuestionStream(question, {
        onToken(token: string) {
          ragItem.ragContent = (ragItem.ragContent || '') + token
          scrollToBottom()
        },
        onCitations(citations: CitationItem[]) {
          ragItem.citations = citations
          scrollToBottom()
        },
        onDone() {
          ragItem.isStreaming = false
          scrollToBottom()
        },
        onError(err: Error) {
          ragItem.isStreaming = false
          ragItem.type = 'error'
          ragItem.response = `RAG Error: ${err.message || 'Stream failed'}`
          scrollToBottom()
        }
      })
    }
  } else if (command === 'sync') {
    if (role.value !== 'root') {
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: "Permission denied: 'sync' requires root administrative privileges. Run 'sudo su' or 'auth' to authenticate.",
        type: 'error'
      })
    } else {
      const pendingIndex = history.value.length
      history.value.push({
        prompt: currentPrompt,
        command: trimmedCmd,
        response: '>> Initiating repository markdown sync and pgvector re-indexing...'
      })
      scrollToBottom()

      try {
        const syncRes = await syncDocuments()
        const innerWidth = 59
        const contentWidth = 55 // 59 - 4 (margin '│ ' and ' │')
        const docLines = syncRes.synced_documents && syncRes.synced_documents.length > 0
          ? syncRes.synced_documents.map(s => `│   - ${s.padEnd(contentWidth - 4)} │`)
          : [`│   (no documents indexed)${' '.repeat(contentWidth - 23)} │`]

        const summaryBox = [
          `┌${'─'.repeat(innerWidth)}┐`,
          `│ ${'GITOPS INGESTION SUMMARY'.padEnd(contentWidth)}   │`,
          `├${'─'.repeat(innerWidth)}┤`,
          `│ ${`Status   : ${syncRes.status.toUpperCase()}`.padEnd(contentWidth)}   │`,
          `│ ${`Documents: ${syncRes.total}`.padEnd(contentWidth)}   │`,
          `├${'─'.repeat(innerWidth)}┤`,
          `│ ${'Synced Documents:'.padEnd(contentWidth)}   │`,
          ...docLines,
          `└${'─'.repeat(innerWidth)}┘`
        ].join('\n')

        history.value[pendingIndex] = {
          prompt: currentPrompt,
          command: trimmedCmd,
          response: summaryBox
        }
      } catch (err: any) {
        history.value[pendingIndex] = {
          prompt: currentPrompt,
          command: trimmedCmd,
          response: `Sync failed: ${err.message || 'Unknown synchronization error'}`,
          type: 'error'
        }
      }
    }
  } else {
    history.value.push({
      prompt: currentPrompt,
      command: trimmedCmd,
      response: `Command not found: ${command}. Type 'help' for available commands.`
    })
  }

  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (container.value) {
      container.value.scrollTop = container.value.scrollHeight
    }
  })
}

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

function resolveAutocompleteMatch(
  prefix: string,
  candidates: string[],
  prefixBase = '',
  appendSpace = false
): boolean {
  const matches = candidates.filter(c => c.toLowerCase().startsWith(prefix.toLowerCase()))
  if (matches.length === 1) {
    const res = prefixBase ? `${prefixBase} ${matches[0]}` : matches[0]
    inputBuffer.value = appendSpace ? res + ' ' : res
    return true
  } else if (matches.length > 1) {
    const commonPrefix = findLongestCommonPrefix(matches)
    if (commonPrefix.length > prefix.length) {
      inputBuffer.value = prefixBase ? `${prefixBase} ${commonPrefix}` : commonPrefix
    } else {
      history.value.push({
        prompt: promptStr.value,
        command: inputBuffer.value,
        response: matches.join('   ')
      })
      scrollToBottom()
    }
    return true
  }
  return false
}

function handleTabAutocomplete() {
  const raw = inputBuffer.value
  const trimmedLeft = raw.trimStart()
  if (!trimmedLeft) return

  const parts = trimmedLeft.split(/\s+/)

  // Case 1: Completing the command word itself (no trailing space)
  if (parts.length === 1 && !raw.endsWith(' ')) {
    const prefix = parts[0].toLowerCase()
    resolveAutocompleteMatch(prefix, AVAILABLE_COMMANDS, '', true)
    return
  }

  const commandWord = parts[0].toLowerCase()

  // Case 2: Completing sub-command for 'sudo'
  if (commandWord === 'sudo') {
    const subArg = parts.length > 1 ? parts[1].toLowerCase() : ''
    resolveAutocompleteMatch(subArg, ['su'], 'sudo', false)
    return
  }

  // Case 3: Completing slug for 'open' or 'cat'
  if ((commandWord === 'open' || commandWord === 'cat') && props.catalog && props.catalog.length > 0) {
    const slugPrefix = parts.length > 1 ? parts[1].toLowerCase() : ''
    resolveAutocompleteMatch(slugPrefix, props.catalog, commandWord, false)
  }
}

function onKeyDown(e: KeyboardEvent) {
  // If user is currently composing with an IME (e.g. Chinese input), do not intercept Enter or Tab
  if (e.isComposing || isComposing.value || e.keyCode === 229) {
    return
  }

  if (e.key === 'Enter') {
    const val = inputBuffer.value
    inputBuffer.value = ''
    historyIndex.value = -1
    draftInput.value = ''
    handleCommand(val)
  } else if (e.key === 'ArrowUp') {
    if (isPasswordMode.value || commandHistory.value.length === 0) return
    e.preventDefault()
    if (historyIndex.value === -1) {
      draftInput.value = inputBuffer.value
    }
    const nextIdx = historyIndex.value + 1
    if (nextIdx < commandHistory.value.length) {
      historyIndex.value = nextIdx
      inputBuffer.value = commandHistory.value[commandHistory.value.length - 1 - nextIdx]
    }
  } else if (e.key === 'ArrowDown') {
    if (isPasswordMode.value) return
    e.preventDefault()
    if (historyIndex.value > 0) {
      historyIndex.value--
      inputBuffer.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value]
    } else if (historyIndex.value === 0) {
      historyIndex.value = -1
      inputBuffer.value = draftInput.value
    }
  } else if (e.key === 'Tab') {
    e.preventDefault()
    if (isPasswordMode.value) return
    handleTabAutocomplete()
  }
}

function handleOpenSlug(slug: string) {
  history.value.push({
    prompt: promptStr.value,
    command: `open ${slug}`,
    response: ''
  })
  emit('open', slug)
  scrollToBottom()
}

function displayError(msg: string) {
  history.value.push({
    command: '',
    response: msg,
    type: 'error'
  })
  scrollToBottom()
}

defineExpose({
  displayError,
  role
})

watch(() => props.isActive, (active) => {
  if (active) {
    nextTick(() => {
      inputElement.value?.focus()
    })
  }
})

onMounted(() => {
  inputElement.value?.focus()
})

function focusInput() {
  inputElement.value?.focus()
}
</script>

<template>
  <div class="terminal" @click="focusInput" ref="container">
    <div v-for="(item, index) in history" :key="index" class="history-item">
      <div v-if="item.command" class="prompt-line">
        <span class="prompt">{{ item.prompt || promptStr }}</span>
        <span class="command">{{ item.command }}</span>
      </div>

      <!-- Plain text output -->
      <div v-if="item.response" class="response" :class="{ 'error-text': item.type === 'error' }" style="white-space: pre-wrap;">
        {{ item.response }}
      </div>

      <!-- Semantic search result cards -->
      <div v-if="item.type === 'search-results' && item.searchResults" class="search-results-container">
        <div class="search-summary-line">
          >> Query matched {{ item.searchResults.length }} semantic chunk(s):
        </div>

        <div v-for="(res, rIdx) in item.searchResults" :key="rIdx" class="ascii-card" :class="{ 'private-card': res.visibility === 'private' }">
          <div class="card-header">
            ┌─ [{{ (rIdx + 1).toString().padStart(2, '0') }}] {{ Math.round(res.similarity * 100) }}% MATCH ::
            <span v-if="res.visibility === 'private'" class="private-tag">[PRIVATE] </span>
            <span class="slug-link" @click.stop="handleOpenSlug(res.slug)">{{ res.slug }}</span>
            <span class="header-fill">────────────────────────────────────────────</span>┐
          </div>
          <div class="card-body">
            <div class="field"><span class="field-label">│ Title: </span>{{ res.title }}</div>
            <div class="field excerpt"><span class="field-label">│ Excerpt: </span>{{ res.content }}</div>
          </div>
          <div class="card-footer">
            <span class="footer-border">└─────────────────────────────────────────────────────────────┘</span>
            <span class="action-tag" @click.stop="handleOpenSlug(res.slug)">[Open: {{ res.slug }}]</span>
          </div>
        </div>

        <div class="search-hint">
          [Tip: Click a slug link or enter 'open &lt;slug&gt;' to view document]
        </div>
      </div>

      <!-- RAG Streaming Answer with Citations -->
      <div v-if="item.type === 'rag-answer'" class="rag-answer-container">
        <div class="rag-text">
          <span style="white-space: pre-wrap;">{{ item.ragContent }}</span>
          <span v-if="item.isStreaming" class="streaming-cursor">█</span>
        </div>

        <!-- Citation Badges -->
        <div v-if="item.citations && item.citations.length > 0" class="citations-container">
          <div class="citations-title">>> Citations (click to open):</div>
          <div class="citation-badges">
            <span
              v-for="(cite, cIdx) in item.citations"
              :key="cIdx"
              class="citation-badge"
              :class="{ 'private-citation': cite.visibility === 'private' }"
              @click.stop="handleOpenSlug(cite.slug)"
              :title="`Open ${cite.title}`"
            >
              [📄 <span v-if="cite.visibility === 'private'" class="private-tag">[PRIVATE]</span>{{ cite.slug }} :: {{ cite.title }}]
            </span>
          </div>
          <div class="citation-hint">
            [Tip: Click any citation badge above to open the source document in window card]
          </div>
        </div>
      </div>
    </div>
    
    <div class="input-line">
      <span class="prompt">{{ isPasswordMode ? passwordPrompt : promptStr }}</span>
      <span class="input-display"><span>{{ isPasswordMode ? '*'.repeat(inputBuffer.length) : inputBuffer }}</span><span v-if="compositionBuffer" class="composition-preview">{{ isPasswordMode ? '*'.repeat(compositionBuffer.length) : compositionBuffer }}</span></span>
      <span class="cursor" :class="{ 'inactive': !isActive }">█</span>
      <input
        :type="isPasswordMode ? 'password' : 'text'"
        class="hidden-input"
        v-model="inputBuffer"
        @input="onInput"
        @keydown="onKeyDown"
        @compositionstart="onCompositionStart"
        @compositionupdate="onCompositionUpdate"
        @compositionend="onCompositionEnd"
        ref="inputElement"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
  </div>
</template>

<style scoped>
.terminal {
  padding: 12px;
  height: 100%;
  font-family: inherit;
  font-size: inherit;
  position: relative;
  overflow-y: auto;
  background-color: var(--surface);
  color: var(--primary);
}

.prompt {
  margin-right: 8px;
  font-weight: 700;
  user-select: none;
}

.history-item {
  margin-bottom: 12px;
}

.response {
  margin-top: 4px;
  line-height: 1.5;
}

.error-text {
  font-weight: 700;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.input-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  position: relative;
}

.input-display {
  white-space: pre;
}

.composition-preview {
  text-decoration: underline;
  text-decoration-style: dashed;
  opacity: 0.85;
}

.cursor {
  animation: blink 1s step-start infinite;
  display: inline-block;
  width: 9px;
  height: 1em;
  background-color: var(--primary);
  color: transparent;
  vertical-align: bottom;
  margin-left: 1px;
}

.cursor.inactive {
  animation: none;
  opacity: 0.3;
}

@keyframes blink {
  50% { opacity: 0; }
}

.hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  color: transparent;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  pointer-events: auto;
  caret-color: transparent;
  z-index: 2;
}

/* ASCII Search Result Card Styles */
.search-results-container {
  margin-top: 8px;
  margin-bottom: 8px;
}

.search-summary-line {
  font-weight: 700;
  margin-bottom: 6px;
}

.ascii-card {
  margin: 8px 0;
  font-family: inherit;
  line-height: 1.4;
}

.card-header {
  overflow: hidden;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.private-tag {
  font-weight: 800;
  background: var(--primary);
  color: var(--surface);
  padding: 0 4px;
  margin-right: 4px;
}

.header-fill {
  overflow: hidden;
  flex: 1;
}

.card-body {
  padding-left: 2px;
}

.field {
  white-space: pre-wrap;
  word-break: break-word;
}

.field-label {
  font-weight: 700;
}

.excerpt {
  color: #333;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slug-link {
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: wavy;
  margin: 0 4px;
}

.slug-link:hover {
  background-color: var(--primary);
  color: var(--surface);
  text-decoration: none;
}

.action-tag {
  font-weight: 700;
  cursor: pointer;
  padding: 0 4px;
  border: 1px solid var(--primary);
}

.action-tag:hover {
  background-color: var(--primary);
  color: var(--surface);
}

.search-hint {
  font-size: 0.9em;
  opacity: 0.8;
  margin-top: 6px;
}

/* RAG Answer & Citations Styles */
.rag-answer-container {
  margin-top: 6px;
  margin-bottom: 8px;
  line-height: 1.6;
}

.streaming-cursor {
  animation: blink 0.8s step-start infinite;
  display: inline-block;
  width: 9px;
  height: 1em;
  background-color: var(--primary);
  color: transparent;
  vertical-align: bottom;
  margin-left: 2px;
}

.citations-container {
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px dashed var(--primary);
}

.citations-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.citation-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.citation-badge {
  cursor: pointer;
  font-weight: 600;
  padding: 2px 6px;
  border: 1px solid var(--primary);
  background-color: var(--surface);
  user-select: none;
}

.citation-badge:hover {
  background-color: var(--primary);
  color: var(--surface);
}

.private-citation {
  border: 1px double var(--primary);
}

.citation-hint {
  font-size: 0.88em;
  opacity: 0.8;
  margin-top: 6px;
}
</style>
