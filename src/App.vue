<script setup>
import { ref, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { Banknote, Moon, Sun } from 'lucide-vue-next'

const isDark = ref(false)

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <h1 style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" @click="$router.push('/')">
          <Banknote :size="28" /> SplitBill
        </h1>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <p class="header-subtitle">Bagi tagihan jadi lebih gampang!</p>
          <button @click="toggleTheme" class="theme-toggle-btn" :title="isDark ? 'Mode Terang' : 'Mode Gelap'">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
          </button>
        </div>
      </div>
    </header>
    
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style>
.theme-toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s;
}
.theme-toggle-btn:hover {
  background-color: var(--border);
}

@media (max-width: 640px) {
  .header-subtitle {
    display: none;
  }
}
</style>
