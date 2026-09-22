<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  catalog: string[]
  isActive: boolean
}>()

const emit = defineEmits<{
  (e: 'open', slug: string): void
}>()

const history = ref<{ command: string; response: string }[]>([])
const inputBuffer = ref('')
const inputElement = ref<HTMLInputElement | null>(null)
const container = ref<HTMLElement | null>(null)

const promptStr = 'guest@long4changes:/$'

function handleCommand(cmd: string) {
  const trimmedCmd = cmd.trim()
  if (!trimmedCmd) return

  const parts = trimmedCmd.split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1)

  let response = ''

  if (command === 'help') {
    response = 'Available commands: help, ls, open <slug>, cat <slug>, clear'
  } else if (command === 'ls') {
    response = props.catalog.join('  ')
  } else if (command === 'clear') {
    history.value = []
    return
  } else if (command === 'open' || command === 'cat') {
    const slug = args[0]
    if (slug) {
      if (props.catalog.includes(slug)) {
        response = `Opening ${slug}...`
        emit('open', slug)
      } else {
        response = `Error: slug '${slug}' not found.`
      }
    } else {
      response = `Usage: ${command} <slug>`
    }
  } else {
    response = `Command not found: ${command}`
  }

  history.value.push({ command: trimmedCmd, response })
  
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
      <div v-if="item.response" class="response" style="white-space: pre-wrap;">{{ item.response }}</div>
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
  padding: 10px;
  height: 100%;
  font-family: inherit;
  font-size: inherit;
  position: relative;
}

.prompt {
  margin-right: 8px;
}

.history-item {
  margin-bottom: 8px;
}

.response {
  margin-top: 4px;
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
</style>
