<script setup lang="ts">
import { ref } from 'vue'
import Terminal from './components/Terminal.vue'
import WindowCard from './components/WindowCard.vue'

const isWindowOpen = ref(false)
const activeSlug = ref('')
const activeContent = ref('')

const documents: Record<string, string> = {
  ark: '# 扁舟\n这是一艘飞船。',
  articles: '# 文章\n这里是一些文章。',
  about: '# 关于\n我是博主。'
}

function handleOpenSlug(slug: string) {
  if (documents[slug]) {
    activeSlug.value = slug
    activeContent.value = documents[slug]
    isWindowOpen.value = true
  }
}

function handleCloseWindow() {
  isWindowOpen.value = false
  activeSlug.value = ''
  activeContent.value = ''
}
</script>

<template>
  <div class="layout" :class="{ 'split-pane': isWindowOpen }">
    <div class="terminal-pane">
      <Terminal
        :catalog="Object.keys(documents)"
        @open="handleOpenSlug"
        :isActive="!isWindowOpen"
      />
    </div>
    <div v-if="isWindowOpen" class="window-pane">
      <WindowCard
        :slug="activeSlug"
        :content="activeContent"
        @close="handleCloseWindow"
      />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
}

@media (min-width: 768px) {
  .layout.split-pane {
    flex-direction: row;
  }
}

.terminal-pane {
  flex: 1;
  height: 100%;
  overflow: auto;
}

.window-pane {
  flex: 1;
  height: 100%;
  overflow: auto;
  border-top: 1px solid var(--primary);
}

@media (min-width: 768px) {
  .window-pane {
    border-top: none;
    border-left: 1px solid var(--primary);
  }
}
</style>
