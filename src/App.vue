<script setup>
import { RouterView } from 'vue-router'
import { Banknote } from 'lucide-vue-next'
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <h1 style="display: flex; align-items: center; gap: 0.5rem;">
          <Banknote :size="28" /> SplitBill
        </h1>
        <p>Bagi tagihan jadi lebih gampang!</p>
      </div>
    </header>
    
    <main class="main-content">
      <RouterView />
    </main>

    <footer class="app-footer">
      <p>
        <router-link to="/admin" class="admin-link">Admin Access</router-link>
      </p>
    </footer>
  </div>
</template>
