<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Terminal from './components/Terminal.vue'
import WindowCard from './components/WindowCard.vue'
import SiteIntro from './components/SiteIntro.vue'
import { fetchDocumentCatalog, fetchDocument, type Visibility, type Role } from './services/api'

const terminalRef = ref<InstanceType<typeof Terminal> | null>(null)
const isWindowOpen = ref(false)
const activeSlug = ref('')
const activeContent = ref('')
const activeVisibility = ref<Visibility>('public')
const catalog = ref<string[]>(['ark', 'articles', 'about'])

async function loadCatalog() {
  try {
    const items = await fetchDocumentCatalog()
    if (items && items.length > 0) {
      catalog.value = items.map(d => d.slug)
    }
  } catch {
    catalog.value = ['ark', 'articles', 'about']
  }
}

async function handleOpenSlug(slug: string) {
  try {
    const doc = await fetchDocument(slug)
    activeSlug.value = doc.slug
    activeContent.value = doc.content
    activeVisibility.value = doc.visibility
    isWindowOpen.value = true
  } catch (err: any) {
    terminalRef.value?.displayError(err.message || `Error opening slug '${slug}'`)
  }
}

function handleCloseWindow() {
  isWindowOpen.value = false
  activeSlug.value = ''
  activeContent.value = ''
  activeVisibility.value = 'public'
}

async function handleAuthChange(newRole: Role) {
  await loadCatalog()
  // If guest, immediately close any active private document WindowCard
  if (newRole === 'guest' && activeVisibility.value === 'private') {
    handleCloseWindow()
  }
}

function handleRenameDocument(oldSlug: string, newSlug: string) {
  const idx = catalog.value.indexOf(oldSlug)
  if (idx !== -1) {
    catalog.value[idx] = newSlug
  }
  if (activeSlug.value === oldSlug) {
    activeSlug.value = newSlug
  }
}

function handleRemoveDocument(slug: string) {
  const idx = catalog.value.indexOf(slug)
  if (idx !== -1) {
    catalog.value.splice(idx, 1)
  }
  if (activeSlug.value === slug) {
    handleCloseWindow()
  }
}

function handleDocumentUpdated(slug: string, content: string) {
  if (activeSlug.value === slug) {
    activeContent.value = content
  }
}

onMounted(() => {
  loadCatalog()
})
</script>

<template>
  <div class="page-container">
    <SiteIntro />
    <div class="workspace-layout" :class="{ 'split-pane': isWindowOpen }">
      <div class="terminal-pane">
        <Terminal
          ref="terminalRef"
          :catalog="catalog"
          @open="handleOpenSlug"
          @auth-change="handleAuthChange"
          @rename-document="handleRenameDocument"
          @remove-document="handleRemoveDocument"
          @document-updated="handleDocumentUpdated"
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
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--surface);
}

.workspace-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
}

@media (min-width: 768px) {
  .workspace-layout.split-pane {
    flex-direction: row;
  }
}

.terminal-pane {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.window-pane {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: auto;
  border-top: 1px solid var(--primary);
  background-color: var(--surface);
}

@media (max-width: 767px) {
  .window-pane {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 100;
    border-top: none;
    animation: drawerSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

@keyframes drawerSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@media (min-width: 768px) {
  .window-pane {
    border-top: none;
    border-left: 1px solid var(--primary);
  }
}
</style>

