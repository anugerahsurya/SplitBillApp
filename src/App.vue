<script setup>
import { ref, onMounted, provide } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { Banknote, Moon, Sun, CheckCircle, AlertCircle } from 'lucide-vue-next'

const isDark = ref(false)
const toasts = ref([])

const showToast = (message, type = 'success') => {
  const id = Date.now()
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 3000)
}

provide('toast', showToast)

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

    <!-- Toast Notifications -->
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]">
        <CheckCircle v-if="t.type === 'success'" :size="20" />
        <AlertCircle v-else :size="20" />
        <span>{{ t.message }}</span>
      </div>
    </div>
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

.toast-container {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.3s ease-out forwards;
}

.toast-success {
  background-color: var(--secondary);
}

.toast-error {
  background-color: var(--danger);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
