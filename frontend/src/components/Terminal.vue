<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { searchDocuments, type SearchResultItem } from '../services/api'

export interface HistoryItem {
  command: string
  response?: string
  type?: 'text' | 'search-results' | 'error'
  searchResults?: SearchResultItem[]
}

const props = defineProps<{
  catalog: string[]
  isActive: boolean
}>()

const emit = defineEmits<{
  (e: 'open', slug: string): void
}>()

const history = ref<HistoryItem[]>([])
const inputBuffer = ref('')
const inputElement = ref<HTMLInputElement | null>(null)
const container = ref<HTMLElement | null>(null)

const promptStr = 'guest@long4changes:/$'

async function handleCommand(cmd: string) {
  const trimmedCmd = cmd.trim()
  if (!trimmedCmd) return

  const parts = trimmedCmd.split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1)

  if (command === 'help') {
    history.value.push({
      command: trimmedCmd,
      response: 'Available commands:\n  help             - Show this help menu\n  ls               - List available document slugs\n  search <query>   - Semantic vector search across all documents\n  open <slug>      - Open document in split-pane ASCII window card\n  cat <slug>       - Alias for open <slug>\n  clear            - Clear terminal screen'
    })
  } else if (command === 'ls') {
    history.value.push({
      command: trimmedCmd,
      response: props.catalog.length > 0 ? props.catalog.join('  ') : 'No public documents found.'
    })
  } else if (command === 'clear') {
    history.value = []
    return
  } else if (command === 'open' || command === 'cat') {
    const slug = args[0]
    if (!slug) {
      history.value.push({
        command: trimmedCmd,
        response: `Usage: ${command} <slug>`
      })
    } else {
      history.value.push({
        command: trimmedCmd,
        response: `Opening ${slug}...`
      })
      emit('open', slug)
    }
  } else if (command === 'search') {
    const query = args.join(' ')
    if (!query) {
      history.value.push({
        command: trimmedCmd,
        response: 'Usage: search <query>'
      })
    } else {
      const pendingIndex = history.value.length
      history.value.push({
        command: trimmedCmd,
        response: `Searching semantic index for "${query}"...`
      })
      scrollToBottom()

      try {
        const results = await searchDocuments(query)
        if (results.length === 0) {
          history.value[pendingIndex] = {
            command: trimmedCmd,
            response: `No matching document chunks found for: "${query}".`
          }
        } else {
          history.value[pendingIndex] = {
            command: trimmedCmd,
            type: 'search-results',
            searchResults: results
          }
        }
      } catch (err: any) {
        history.value[pendingIndex] = {
          command: trimmedCmd,
          response: `Search error: ${err.message || 'Failed to query vector database'}`
        }
      }
    }
  } else {
    history.value.push({
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

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleCommand(inputBuffer.value)
    inputBuffer.value = ''
  }
}

function handleOpenSlug(slug: string) {
  history.value.push({
    command: `open ${slug}`,
    response: `Opening ${slug}...`
  })
  emit('open', slug)
  scrollToBottom()
}

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
      <div class="prompt-line">
        <span class="prompt">{{ promptStr }}</span>
        <span class="command">{{ item.command }}</span>
      </div>

      <!-- Plain text output -->
      <div v-if="!item.type || item.type === 'text'" class="response" style="white-space: pre-wrap;">
        {{ item.response }}
      </div>

      <!-- Semantic search result cards -->
      <div v-else-if="item.type === 'search-results' && item.searchResults" class="search-results-container">
        <div class="search-summary-line">
          >> Query matched {{ item.searchResults.length }} semantic chunk(s):
        </div>

        <div v-for="(res, rIdx) in item.searchResults" :key="rIdx" class="ascii-card">
          <div class="card-header">
            ┌─ [{{ (rIdx + 1).toString().padStart(2, '0') }}] {{ Math.round(res.similarity * 100) }}% MATCH ::
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
    </div>
    
    <div class="input-line">
      <span class="prompt">{{ promptStr }}</span>
      <span class="input-display">{{ inputBuffer }}</span>
      <span class="cursor" :class="{ 'inactive': !isActive }">█</span>
    </div>
    
    <input
      type="text"
      class="hidden-input"
      v-model="inputBuffer"
      @keydown="onKeyDown"
      ref="inputElement"
      autocomplete="off"
      spellcheck="false"
    />
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

.input-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.input-display {
  white-space: pre;
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
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
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
</style>
