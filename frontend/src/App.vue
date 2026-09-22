<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Terminal from './components/Terminal.vue'
import WindowCard from './components/WindowCard.vue'
import { fetchDocumentCatalog, fetchDocument, getAuthRole } from './services/api'

const terminalRef = ref<InstanceType<typeof Terminal> | null>(null)
const isWindowOpen = ref(false)
const activeSlug = ref('')
const activeContent = ref('')
const catalog = ref<string[]>([])

async function loadCatalog() {
  try {
    const items = await fetchDocumentCatalog()
    if (items && items.length > 0) {
      catalog.value = items.map(d => d.slug)
    }
  } catch {
    const role = getAuthRole()
    catalog.value = role === 'root'
      ? ['ark', 'articles', 'about', 'secret-vault']
      : ['ark', 'articles', 'about']
  }
}

async function handleOpenSlug(slug: string) {
  try {
    const doc = await fetchDocument(slug)
    activeSlug.value = doc.slug
    activeContent.value = doc.content
    isWindowOpen.value = true
  } catch (err: any) {
    terminalRef.value?.displayError(err.message || `Error opening slug '${slug}'`)
  }
}

function handleCloseWindow() {
  isWindowOpen.value = false
  activeSlug.value = ''
  activeContent.value = ''
}

async function handleAuthChange(newRole: 'guest' | 'root') {
  await loadCatalog()
  if (newRole === 'guest' && activeSlug.value === 'secret-vault') {
    handleCloseWindow()
  }
}

onMounted(() => {
  loadCatalog()
})
</script>

<template>
  <div class="layout" :class="{ 'split-pane': isWindowOpen }">
    <div class="terminal-pane">
      <Terminal
        ref="terminalRef"
        :catalog="catalog"
        @open="handleOpenSlug"
        @auth-change="handleAuthChange"
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
