<script setup lang="ts">
import { ref } from 'vue'

const isExpanded = ref(true)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <header class="site-intro" :class="{ 'is-collapsed': !isExpanded }">
    <div class="intro-bar">
      <div class="author-info">
        <span class="author-title"># 梁晨</span>
        <a class="email-link" href="mailto:liangchen0920@gmail.com">&lt;liangchen0920@gmail.com&gt;</a>
        <span v-if="!isExpanded" class="collapsed-role">│ Independent Developer / Vibe Coding Enthusiast</span>
      </div>
      <button
        class="toggle-btn"
        @click="toggleExpand"
        :aria-expanded="isExpanded"
        type="button"
      >
        [ {{ isExpanded ? '- HIDE' : '+ EXPAND' }} ]
      </button>
    </div>

    <div v-if="isExpanded" class="intro-content">
      <pre class="ascii-banner" aria-label="LONG4CHANGES ASCII Art Banner">
 _                            _  _    ____  _                                
| |    ___  _ __   __ _  _  _| || |  / ___|| |__    __ _  _ __    __ _   ___  ___ 
| |   / _ \| '_ \ / _` || || | || |_| |    | '_ \  / _` || '_ \  / _` | / _ \/ __|
| |__| (_) | | | | (_| || || |__   _| |___ | | | || (_| || | | || (_| ||  __/\__ \
|_____\___/|_| |_|\__, | \_, |  |_|  \____||_| |_| \__,_||_| |_| \__, | \___||___/
                  |___/  |__/                                    |___/            (LONG4CHANGES)
      </pre>

      <div class="meta-section">
        <div class="meta-row">
          <span class="meta-prefix">│</span>
          <span class="meta-label">Role  :</span>
          <span class="meta-value">Independent Developer / Vibe Coding Enthusiast</span>
        </div>
        <div class="meta-row">
          <span class="meta-prefix">│</span>
          <span class="meta-label">Shell :</span>
          <span class="meta-value">Ready below. Type 'help', 'ls', or 'open hello-world' to explore.</span>
        </div>
      </div>

      <div class="separator-line">
        +dwb========================================================================dwb+
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-intro {
  background-color: var(--surface);
  color: var(--primary);
  border-bottom: 1px solid var(--primary);
  font-family: inherit;
  user-select: text;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.intro-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--surface);
}

.author-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-weight: 700;
}

.author-title {
  font-size: 1.05em;
  letter-spacing: 0.5px;
}

.email-link {
  color: var(--primary);
  text-decoration: underline;
  text-decoration-style: wavy;
  font-weight: 400;
  opacity: 0.9;
}

.email-link:hover {
  background-color: var(--primary);
  color: var(--surface);
  text-decoration: none;
}

.collapsed-role {
  font-weight: 400;
  font-size: 0.9em;
  opacity: 0.85;
}

.toggle-btn {
  background: transparent;
  color: var(--primary);
  border: 1px solid transparent;
  border-radius: 0px;
  font-family: inherit;
  font-size: 0.9em;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 6px;
  white-space: nowrap;
}

.toggle-btn:hover {
  background-color: var(--primary);
  color: var(--surface);
}

.toggle-btn:focus-visible {
  outline: 1px dashed var(--primary);
}

.intro-content {
  padding: 0 12px 10px 12px;
}

.ascii-banner {
  margin: 0;
  padding: 4px 0 8px 0;
  font-family: inherit;
  font-size: clamp(8px, 1.15vw, 12px);
  line-height: 1.15;
  white-space: pre;
  overflow-x: auto;
  color: var(--primary);
}

.meta-section {
  margin: 6px 0 8px 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.92em;
  line-height: 1.4;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-prefix {
  font-weight: 700;
  opacity: 0.7;
}

.meta-label {
  font-weight: 700;
  min-width: 54px;
}

.meta-value {
  font-weight: 400;
}

.separator-line {
  font-family: inherit;
  font-size: 0.82em;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  margin-top: 4px;
}
</style>
