<script setup>
import { ref, computed } from 'vue';
import { api } from '../services/api';
import { LogIn, UserPlus, Trash2, PlusCircle, Link as LinkIcon, Copy, List, RefreshCw, Edit } from 'lucide-vue-next';

const isLoggedIn = ref(false);
const password = ref('');
const loginError = ref(false);

const activeTab = ref('dashboard');
const allActivities = ref([]);
const isLoadingActivities = ref(false);

const activityName = ref('');
const members = ref([{ name: '', bank_account: '' }]);
const isLoading = ref(false);
const generatedLink = ref('');

const checkPassword = () => {
  if (password.value === 'adminsurya') {
    isLoggedIn.value = true;
    loginError.value = false;
    fetchActivities();
  } else {
    loginError.value = true;
  }
};

const fetchActivities = async () => {
  isLoadingActivities.value = true;
  try {
    const res = await api.getAllActivities();
    if (res.success) {
      allActivities.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    isLoadingActivities.value = false;
  }
};

const editingActivityId = ref(null);
const editActivityName = ref('');

const startEdit = (act) => {
  editingActivityId.value = act.id;
  editActivityName.value = act.name;
};

const cancelEdit = () => {
  editingActivityId.value = null;
  editActivityName.value = '';
};

const saveEdit = async () => {
  if (!editActivityName.value.trim()) {
    alert('Nama kegiatan tidak boleh kosong');
    return;
  }
  
  try {
    const res = await api.editActivity(editingActivityId.value, editActivityName.value);
    if (res.success) {
      await fetchActivities();
      cancelEdit();
    } else {
      alert('Gagal mengedit kegiatan: ' + (res.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi saat menyimpan.');
  }
};

const deleteActivityItem = async (id) => {
  if (confirm('Yakin ingin menghapus kegiatan ini? Semua data terkait (anggota, transaksi) akan ikut terhapus.')) {
    try {
      const res = await api.deleteActivity(id);
      if (res.success) {
        await fetchActivities();
      } else {
        alert('Gagal menghapus kegiatan: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    }
  }
};

const copyActivityLink = (id) => {
  const baseUrl = window.location.origin;
  navigator.clipboard.writeText(`${baseUrl}/?id=${id}`);
  alert("Link disalin!");
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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
      <div class="tabs mb-4" style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem;">
        <button @click="activeTab = 'dashboard'" :class="['btn', activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary']">
          <List :size="18" /> Dashboard
        </button>
        <button @click="activeTab = 'create'" :class="['btn', activeTab === 'create' ? 'btn-primary' : 'btn-secondary']">
          <PlusCircle :size="18" /> Buat Kegiatan Baru
        </button>
      </div>

      <!-- Dashboard Tab -->
      <div v-if="activeTab === 'dashboard'" class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 class="card-title mb-0">Daftar Kegiatan</h2>
          <button @click="fetchActivities" class="btn btn-secondary btn-sm" :disabled="isLoadingActivities">
            <RefreshCw :size="16" :class="{'spin': isLoadingActivities}" /> Refresh
          </button>
        </div>
        
        <div v-if="isLoadingActivities" class="text-center py-4 text-secondary">
          Memuat data...
        </div>
        <div v-else-if="allActivities.length === 0" class="text-center py-4 text-secondary">
          Belum ada kegiatan.
        </div>
        <div v-else class="activities-list">
          <div v-for="act in allActivities" :key="act.id" class="activity-item mb-3 p-4" style="border: 1px solid var(--border); border-radius: var(--radius); background: var(--card);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1; padding-right: 1rem;">
                <div v-if="editingActivityId === act.id" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <input type="text" v-model="editActivityName" class="form-control" style="flex: 1; padding: 0.25rem 0.5rem; font-size: 1rem;">
                  <button @click="saveEdit" class="btn btn-primary btn-sm">Simpan</button>
                  <button @click="cancelEdit" class="btn btn-secondary btn-sm">Batal</button>
                </div>
                <h3 v-else style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--primary);">{{ act.name }}</h3>
                
                <div style="font-size: 0.875rem; color: var(--secondary); margin-bottom: 0.5rem;">
                  Tanggal: {{ formatDate(act.created_at) }}
                </div>
                <div>
                  <span :class="['badge', act.status === 'active' ? 'badge-success' : 'badge-secondary']">
                    {{ act.status === 'active' ? 'Aktif' : 'Selesai' }}
                  </span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                <button @click="copyActivityLink(act.id)" class="btn btn-secondary btn-sm" title="Copy Link">
                  <Copy :size="16" /> Copy Link
                </button>
                <div style="display: flex; gap: 0.5rem;">
                  <button v-if="editingActivityId !== act.id" @click="startEdit(act)" class="btn btn-secondary btn-sm" style="color: var(--primary);" title="Edit">
                    <Edit :size="16" /> Edit
                  </button>
                  <button @click="deleteActivityItem(act.id)" class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Hapus">
                    <Trash2 :size="16" /> Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Tab -->
      <div v-if="activeTab === 'create'" class="card">
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
.badge {
  display: inline-block;
  padding: 0.25em 0.5em;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 0.25rem;
}
.badge-success {
  background-color: #dcfce7;
  color: #166534;
}
.badge-secondary {
  background-color: #f1f5f9;
  color: #475569;
}
.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}
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
