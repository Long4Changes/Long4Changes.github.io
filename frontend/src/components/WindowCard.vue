<script setup lang="ts">
import { onMounted, onUnmounted, ref, watchEffect } from 'vue'

const props = defineProps<{
  slug: string
  content: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

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

// Fill underscores based on a large fixed string and flex/overflow
</script>

<template>
  <div class="window-card">
    <div class="title-bar">
      <span>|_{{ slug }}.exe</span>
      <span class="fill">_</span>
      <span class="controls" @click="emit('close')" title="Close">-_=_X_|</span>
    </div>
    <div class="content">
      <pre>{{ content }}</pre>
    </div>
  </div>
</template>

<style scoped>
.window-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
}

.title-bar {
  display: flex;
  white-space: pre;
  overflow: hidden;
  margin-bottom: 10px;
  font-weight: 700;
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
}

.content {
  flex: 1;
  overflow: auto;
}

pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
}
</style>
