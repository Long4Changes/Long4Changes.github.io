<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { vim, Vim, getCM } from '@replit/codemirror-vim'
import type { Role } from '../services/api'

const props = withDefaults(defineProps<{
  slug: string
  filename: string
  initialContent: string
  role: Role
  isNvim?: boolean
}>(), {
  isNvim: false
})

const emit = defineEmits<{
  (e: 'save', slug: string, content: string): void
  (e: 'close'): void
}>()

const editorHost = ref<HTMLDivElement | null>(null)
let editorView: EditorView | null = null

const isModified = ref(false)
const currentMode = ref<'NORMAL' | 'INSERT' | 'VISUAL'>('NORMAL')
const cursorLine = ref(1)
const cursorCol = ref(1)
const totalLines = ref(1)
const statusMessage = ref('')
const isError = ref(false)

function calculateStats(view: EditorView) {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  cursorLine.value = line.number
  cursorCol.value = head - line.from + 1
  totalLines.value = view.state.doc.lines
}

function handleSave() {
  if (!editorView) return
  if (props.role !== 'root') {
    statusMessage.value = "E212: Can't open file for writing: Permission denied (run 'sudo su' to authenticate)"
    isError.value = true
    return
  }
  const content = editorView.state.doc.toString()
  emit('save', props.slug, content)
  isModified.value = false
  const byteLength = new TextEncoder().encode(content).length
  statusMessage.value = `"${props.filename}" ${totalLines.value}L, ${byteLength}B written`
  isError.value = false
}

function handleQuit(force = false) {
  if (!force && isModified.value) {
    statusMessage.value = 'E37: No write since last change (add ! to override)'
    isError.value = true
    return
  }
  emit('close')
}

function handleWriteAndQuit() {
  if (!editorView) return
  if (props.role !== 'root') {
    statusMessage.value = "E212: Can't open file for writing: Permission denied (run 'sudo su' to authenticate)"
    isError.value = true
    return
  }
  const content = editorView.state.doc.toString()
  emit('save', props.slug, content)
  isModified.value = false
  emit('close')
}

// Register custom Ex commands for this session
function registerExCommands() {
  try {
    Vim.defineEx('write', 'w', () => {
      handleSave()
    })
    Vim.defineEx('quit', 'q', (_cm: any, params: any) => {
      const force = params?.input?.includes('!') || false
      handleQuit(force)
    })
    Vim.defineEx('wq', 'wq', () => {
      handleWriteAndQuit()
    })
  } catch {
    // Ignore if already registered
  }
}

onMounted(async () => {
  await nextTick()
  if (!editorHost.value) return

  registerExCommands()

  const retroTheme = EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: 'var(--surface, #fefefe)',
      color: 'var(--text, #1f1f1f)',
      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
      fontSize: '14px',
      lineHeight: '1.6'
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit'
    },
    '.cm-content': {
      padding: '8px 12px',
      caretColor: 'var(--text, #1f1f1f)'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--surface, #fefefe)',
      color: 'var(--text-muted, #767676)',
      borderRight: '1px solid var(--border, #e0e0e0)',
      paddingRight: '6px'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--text, #1f1f1f)',
      fontWeight: 'bold'
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(0, 0, 0, 0.03)'
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(0, 0, 0, 0.1)'
    },
    '.cm-vim-panel': {
      backgroundColor: 'var(--surface, #fefefe)',
      color: 'var(--text, #1f1f1f)',
      borderTop: '1px solid var(--border, #e0e0e0)',
      fontFamily: 'inherit',
      padding: '2px 8px'
    },
    '.cm-fat-cursor': {
      backgroundColor: 'var(--text, #1f1f1f) !important',
      color: 'var(--surface, #fefefe) !important'
    },
    '&.cm-focused': {
      outline: 'none'
    }
  }, { dark: false })

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      isModified.value = true
    }
    if (update.selectionSet || update.docChanged) {
      calculateStats(update.view)
    }
  })

  const state = EditorState.create({
    doc: props.initialContent,
    extensions: [
      basicSetup,
      vim({ status: true }),
      markdown(),
      retroTheme,
      updateListener
    ]
  })

  editorView = new EditorView({
    state,
    parent: editorHost.value
  })

  calculateStats(editorView)

  // Listen to Vim mode changes via CM5 compatibility adapter
  const cm = getCM(editorView)
  if (cm && typeof cm.on === 'function') {
    cm.on('vim-mode-change', (data: any) => {
      if (data && data.mode) {
        if (data.mode === 'insert') {
          currentMode.value = 'INSERT'
        } else if (data.mode === 'visual') {
          currentMode.value = 'VISUAL'
        } else {
          currentMode.value = 'NORMAL'
        }
      }
    })
  }

  editorView.focus()
})

onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="vim-fullscreen-container" data-testid="vim-editor">
      <!-- Top ASCII Retro Title Bar -->
      <header class="vim-titlebar">
        <div class="titlebar-left">
          <span class="app-tag">[{{ isNvim ? 'NVIM' : 'VIM' }}]</span>
          <span class="file-tag">{{ filename }}</span>
          <span v-if="isModified" class="mod-flag">[+]</span>
          <span v-if="role === 'guest'" class="readonly-badge">[RO]</span>
        </div>
        <div class="titlebar-help">
          <span>:w save | :q quit | :wq save&quit</span>
          <button
            type="button"
            class="close-btn"
            title="Exit editor (:q)"
            @click="handleQuit(false)"
          >
            _X_
          </button>
        </div>
      </header>

      <!-- CodeMirror 6 Editor Mount Area -->
      <main ref="editorHost" class="editor-viewport" />

      <!-- Lualine-style Monochrome Status Line -->
      <footer class="vim-statusline">
        <div class="status-left">
          <span class="mode-badge" :class="currentMode.toLowerCase()">
            {{ currentMode }}
          </span>
          <span class="status-info" :class="{ 'error-text': isError }">
            {{ statusMessage || `${filename}${isModified ? ' [+]' : ''}` }}
          </span>
        </div>
        <div class="status-right">
          <span class="encoding">utf-8</span>
          <span class="sep">│</span>
          <span class="pos">Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
          <span class="sep">│</span>
          <span class="pct">{{ totalLines > 1 ? Math.round((cursorLine / totalLines) * 100) : 100 }}%</span>
        </div>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.vim-fullscreen-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background-color: var(--surface, #fefefe);
  color: var(--text, #1f1f1f);
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  box-sizing: border-box;
}

.vim-titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  padding: 0 8px 0 12px;
  background-color: var(--surface, #fefefe);
  border-bottom: 1px solid var(--border, #1f1f1f);
  font-size: 13px;
  user-select: none;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-tag {
  font-weight: 700;
  color: var(--text, #1f1f1f);
}

.file-tag {
  font-weight: 600;
}

.mod-flag {
  font-weight: 700;
  color: var(--text, #1f1f1f);
}

.readonly-badge {
  font-size: 11px;
  background: var(--text, #1f1f1f);
  color: var(--surface, #fefefe);
  padding: 1px 4px;
}

.titlebar-help {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted, #767676);
}

.close-btn {
  background: none;
  border: 1px solid var(--border, #1f1f1f);
  color: var(--text, #1f1f1f);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 1px 6px;
  line-height: 1.2;
}

.close-btn:hover {
  background-color: var(--text, #1f1f1f);
  color: var(--surface, #fefefe);
}

.editor-viewport {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.vim-statusline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 24px;
  background-color: var(--surface, #fefefe);
  border-top: 1px solid var(--border, #1f1f1f);
  font-size: 12px;
  user-select: none;
  padding: 0 8px;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-badge {
  padding: 1px 6px;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.mode-badge.normal {
  background-color: var(--text, #1f1f1f);
  color: var(--surface, #fefefe);
  border: 1px solid var(--text, #1f1f1f);
}

.mode-badge.insert {
  background-color: var(--surface, #fefefe);
  color: var(--text, #1f1f1f);
  border: 1px solid var(--text, #1f1f1f);
}

.mode-badge.visual {
  background-color: var(--text, #1f1f1f);
  color: var(--surface, #fefefe);
  text-decoration: underline;
  border: 1px solid var(--text, #1f1f1f);
}

.status-info {
  font-size: 12px;
}

.status-info.error-text {
  font-weight: 700;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #767676);
}

.sep {
  color: var(--border, #ccc);
}
</style>
