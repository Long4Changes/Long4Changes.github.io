<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

const props = defineProps<{
  slug: string
  content: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Configure marked renderer with code highlighting
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const validLang = (lang && hljs.getLanguage(lang)) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language: validLang }).value
      return `<pre class="code-block"><code class="hljs language-${validLang}">${highlighted}</code></pre>`
    }
  }
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  const rawHtml = marked.parse(props.content, { async: false }) as string
  return DOMPurify.sanitize(rawHtml)
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="window-card">
    <div class="title-bar">
      <span>|_{{ slug }}.exe</span>
      <span class="fill">_</span>
      <span class="controls" @click="emit('close')" title="Close (Esc)">-_=_X_|</span>
    </div>
    <div class="content markdown-body" v-html="renderedHtml"></div>
  </div>
</template>

<style scoped>
.window-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  background-color: var(--surface);
  color: var(--primary);
  font-family: inherit;
}

.title-bar {
  display: flex;
  white-space: pre;
  overflow: hidden;
  margin-bottom: 12px;
  font-weight: 700;
  user-select: none;
}

.fill {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
}

.fill::after {
  content: "________________________________________________________________________________________________________________________________________________________________________________________________________";
  position: absolute;
  left: 0;
  top: 0;
}

.controls {
  cursor: pointer;
  z-index: 1;
  background: var(--surface);
  padding: 0 4px;
}

.controls:hover {
  background: var(--primary);
  color: var(--surface);
}

.content {
  flex: 1;
  overflow-y: auto;
  line-height: 1.6;
}

/* Monochromatic Markdown Typography */
:deep(h1), :deep(h2), :deep(h3), :deep(h4) {
  margin: 1.2em 0 0.5em 0;
  font-weight: 700;
  line-height: 1.2;
}

:deep(h1) {
  font-size: 1.4em;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 4px;
}

:deep(h2) {
  font-size: 1.2em;
  border-bottom: 1px dashed var(--primary);
  padding-bottom: 3px;
}

:deep(h3) {
  font-size: 1.05em;
}

:deep(p) {
  margin: 0.8em 0;
}

:deep(blockquote) {
  margin: 0.8em 0;
  padding: 4px 12px;
  border-left: 3px solid var(--primary);
  background: #f8f8f8;
}

:deep(pre.code-block) {
  margin: 1em 0;
  padding: 10px;
  background: #f4f4f4;
  border: 1px solid var(--primary);
  overflow-x: auto;
  font-size: 0.92em;
}

:deep(code) {
  font-family: inherit;
}

:deep(:not(pre) > code) {
  background: #f0f0f0;
  padding: 2px 4px;
  border: 1px solid #ccc;
}

:deep(ul), :deep(ol) {
  padding-left: 24px;
  margin: 0.8em 0;
}

:deep(li) {
  margin-bottom: 4px;
}

:deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: wavy;
  font-weight: 600;
}

:deep(a:hover) {
  background: var(--primary);
  color: var(--surface);
  text-decoration: none;
}

:deep(hr) {
  border: none;
  border-top: 1px dashed var(--primary);
  margin: 1.5em 0;
}
</style>
