<script setup>
import { ref, computed } from 'vue';
import { api } from '../services/api';
import { LogIn, UserPlus, Trash2, PlusCircle, Link as LinkIcon, Copy } from 'lucide-vue-next';

const isLoggedIn = ref(false);
const password = ref('');
const loginError = ref(false);

const activityName = ref('');
const members = ref([{ name: '', bank_account: '' }]);
const isLoading = ref(false);
const generatedLink = ref('');

const checkPassword = () => {
  if (password.value === 'adminsurya') {
    isLoggedIn.value = true;
    loginError.value = false;
  } else {
    loginError.value = true;
  }
};

const addMember = () => {
  members.value.push({ name: '', bank_account: '' });
};

const removeMember = (index) => {
  if (members.value.length > 1) {
    members.value.splice(index, 1);
  }
};

const createActivity = async () => {
  if (!activityName.value || members.value.some(m => !m.name)) {
    alert("Mohon lengkapi nama kegiatan dan semua nama anggota.");
    return;
  }

  isLoading.value = true;
  try {
    const res = await api.createActivity({
      name: activityName.value,
      members: members.value.filter(m => m.name.trim() !== '')
    });
    
    if (res.success) {
      const baseUrl = window.location.origin;
      generatedLink.value = `${baseUrl}/?id=${res.id}`;
      // Reset form
      activityName.value = '';
      members.value = [{ name: '', bank_account: '' }];
    } else {
      alert("Gagal membuat kegiatan: " + (res.error || "Unknown error"));
    }
  } catch (err) {
    alert("Terjadi kesalahan koneksi. Pastikan URL Web App GAS sudah diatur di src/services/api.js");
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const copyLink = () => {
  navigator.clipboard.writeText(generatedLink.value);
  alert("Link disalin!");
};
</script>

<template>
  <div>
    <!-- Login Screen -->
    <div v-if="!isLoggedIn" class="card" style="max-width: 400px; margin: 0 auto; margin-top: 2rem;">
      <h2 class="card-title text-center">Admin Login</h2>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input 
          type="password" 
          v-model="password" 
          class="form-control" 
          @keyup.enter="checkPassword"
          placeholder="Masukkan password admin..."
        >
        <p v-if="loginError" class="text-danger mb-2 mt-2" style="font-size: 0.875rem;">Password salah.</p>
      </div>
      <button @click="checkPassword" class="btn btn-primary btn-block">
        <LogIn :size="20" /> Login
      </button>
    </div>

    <!-- Admin Dashboard -->
    <div v-else>
      <div class="card">
        <h2 class="card-title">Buat Kegiatan Baru</h2>
        
        <div class="form-group">
          <label class="form-label">Nama Kegiatan</label>
          <input type="text" v-model="activityName" class="form-control" placeholder="Contoh: Makan Siang Bersama">
        </div>

        <div class="form-group mt-4">
          <label class="form-label">Daftar Anggota</label>
          <div v-for="(member, index) in members" :key="index" class="member-row mb-2">
            <input type="text" v-model="member.name" class="form-control" placeholder="Nama Anggota" style="flex: 1;">
            <input type="text" v-model="member.bank_account" class="form-control" placeholder="No Rekening (Opsional)" style="flex: 1;">
            <button @click="removeMember(index)" class="btn btn-secondary" style="padding: 0.5rem 1rem;" v-if="members.length > 1">
              <Trash2 :size="16" /> Hapus
            </button>
          </div>
          <button @click="addMember" class="btn btn-secondary mt-2" style="font-size: 0.875rem;">
            <UserPlus :size="16" /> Tambah Anggota
          </button>
        </div>

        <button @click="createActivity" class="btn btn-primary btn-block mt-4" :disabled="isLoading">
          <PlusCircle :size="20" v-if="!isLoading" />
          {{ isLoading ? 'Membuat...' : 'Buat Kegiatan & Generate Link' }}
        </button>

        <!-- Result Link -->
        <div v-if="generatedLink" class="link-result mt-4">
          <label class="form-label text-secondary">Sukses! Bagikan link ini ke peserta:</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" readonly :value="generatedLink" class="form-control" style="background: var(--background); color: var(--primary); font-weight: 600;">
            <button @click="copyLink" class="btn btn-primary">
              <Copy :size="20" /> Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.link-result {
  background-color: #F0FDF4;
  padding: 1rem;
  border-radius: var(--radius);
  border: 1px solid #BBF7D0;
}
.text-secondary {
  color: var(--secondary);
}
</style>
