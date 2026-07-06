<script setup>
import { ref, computed, inject } from 'vue';
import { api } from '../services/api';
import { LogIn, UserPlus, Trash2, PlusCircle, Link as LinkIcon, Copy, List, RefreshCw, Edit, Save, Users } from 'lucide-vue-next';

const toast = inject('toast');

const isLoggedIn = ref(false);
const password = ref('');
const loginError = ref(false);

const activeTab = ref('dashboard');
const allActivities = ref([]);
const isLoadingActivities = ref(false);

const activityName = ref('');
const members = ref([{ name: '', bank_name: '', bank_account: '' }]);
const isLoading = ref(false);
const generatedLink = ref('');

const manageMembersActivityId = ref(null);
const membersToManage = ref([]);
const isLoadingMembers = ref(false);
const newMember = ref({ name: '', bank_name: '', bank_account: '' });

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
    toast('Nama kegiatan tidak boleh kosong', 'error');
    return;
  }
  
  try {
    const res = await api.editActivity(editingActivityId.value, editActivityName.value);
    if (res.success) {
      await fetchActivities();
      cancelEdit();
      toast('Berhasil menyimpan kegiatan!', 'success');
    } else {
      toast('Gagal mengedit kegiatan: ' + (res.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    toast('Terjadi kesalahan koneksi saat menyimpan.', 'error');
  }
};

const deleteActivityItem = async (id) => {
  if (confirm('Yakin ingin menghapus kegiatan ini? Semua data terkait (anggota, transaksi) akan ikut terhapus.')) {
    try {
      const res = await api.deleteActivity(id);
      if (res.success) {
        toast('Kegiatan berhasil dihapus!', 'success');
        await fetchActivities();
      } else {
        toast('Gagal menghapus kegiatan: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi.', 'error');
    }
  }
};

const copyActivityLink = (id) => {
  const baseUrl = window.location.origin;
  navigator.clipboard.writeText(`${baseUrl}/?id=${id}`);
  toast("Link disalin!", "success");
};

const manageMembers = async (activityId) => {
  if (manageMembersActivityId.value === activityId) {
    manageMembersActivityId.value = null;
    return;
  }
  manageMembersActivityId.value = activityId;
  isLoadingMembers.value = true;
  try {
    const res = await api.getActivity(activityId);
    if (res.success) {
      membersToManage.value = res.data.members;
    }
  } catch (err) {
    console.error(err);
    toast('Gagal mengambil data anggota', 'error');
  } finally {
    isLoadingMembers.value = false;
  }
};

const closeManageMembers = () => {
  manageMembersActivityId.value = null;
};

const saveMember = async (member) => {
  try {
    const res = await api.editMember({
      member_id: member.id,
      name: member.name,
      bank_name: member.bank_name,
      bank_account: member.bank_account
    });
    if (res.success) {
      toast('Berhasil menyimpan perubahan anggota', 'success');
    } else {
      toast('Gagal menyimpan: ' + (res.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    toast('Terjadi kesalahan koneksi', 'error');
  }
};

const removeExistingMember = async (member, index) => {
  if (!confirm(`Yakin ingin menghapus anggota ${member.name}?`)) return;
  
  try {
    const res = await api.deleteMember(member.id);
    if (res.success) {
      membersToManage.value.splice(index, 1);
      toast('Anggota berhasil dihapus', 'success');
    } else {
      toast('Gagal menghapus: ' + (res.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    toast('Terjadi kesalahan koneksi', 'error');
  }
};

const addNewMember = async () => {
  if (!newMember.value.name.trim()) return;
  
  try {
    const res = await api.addMember({
      activity_id: manageMembersActivityId.value,
      name: newMember.value.name,
      bank_name: newMember.value.bank_name,
      bank_account: newMember.value.bank_account
    });
    
    if (res.success) {
      membersToManage.value.push({
        id: res.id,
        activity_id: manageMembersActivityId.value,
        name: newMember.value.name,
        bank_name: newMember.value.bank_name,
        bank_account: newMember.value.bank_account
      });
      newMember.value = { name: '', bank_name: '', bank_account: '' };
      toast('Berhasil menambah anggota', 'success');
    } else {
      toast('Gagal menambah anggota: ' + (res.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    toast('Terjadi kesalahan koneksi', 'error');
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const addMember = () => {
  members.value.push({ name: '', bank_name: '', bank_account: '' });
};

const removeMember = (index) => {
  if (members.value.length > 1) {
    members.value.splice(index, 1);
  }
};

const createActivity = async () => {
  if (!activityName.value || members.value.some(m => !m.name)) {
    toast("Mohon lengkapi nama kegiatan dan semua nama anggota.", "error");
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
      members.value = [{ name: '', bank_name: '', bank_account: '' }];
      toast("Kegiatan berhasil dibuat!", "success");
    } else {
      toast("Gagal membuat kegiatan: " + (res.error || "Unknown error"), "error");
    }
  } catch (err) {
    toast("Terjadi kesalahan koneksi. Pastikan URL Web App GAS sudah diatur di src/services/api.js", "error");
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const copyLink = () => {
  navigator.clipboard.writeText(generatedLink.value);
  toast("Link disalin!", "success");
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
            <div class="activity-header">
              <div style="flex: 1;">
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
              <div class="activity-actions">
                <button @click="copyActivityLink(act.id)" class="btn btn-secondary btn-sm" title="Copy Link">
                  <Copy :size="16" /> Copy Link
                </button>
                <div class="activity-actions-row">
                  <button @click="manageMembers(act.id)" class="btn btn-secondary btn-sm" style="color: var(--primary);" title="Kelola Anggota">
                    <Users :size="16" /> Kelola Anggota
                  </button>
                  <button v-if="editingActivityId !== act.id" @click="startEdit(act)" class="btn btn-secondary btn-sm" style="color: var(--primary);" title="Edit Nama">
                    <Edit :size="16" /> Edit
                  </button>
                  <button @click="deleteActivityItem(act.id)" class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Hapus">
                    <Trash2 :size="16" /> Hapus
                  </button>
                </div>
              </div>
            </div>

            <!-- Manage Members Section -->
            <div v-if="manageMembersActivityId === act.id" class="mt-3 p-3" style="background: var(--background); border-radius: var(--radius); border: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 1rem; color: var(--primary);">Kelola Anggota</h4>
                <button @click="closeManageMembers" class="btn btn-secondary btn-sm">Tutup</button>
              </div>
              
              <div v-if="isLoadingMembers" class="text-center py-2 text-secondary">Memuat anggota...</div>
              <div v-else>
                <div v-for="(member, index) in membersToManage" :key="member.id || index" class="mb-3 manage-member-row">
                  <input type="text" v-model="member.name" class="form-control" placeholder="Nama" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <input type="text" v-model="member.bank_name" class="form-control" placeholder="Bank" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <input type="text" v-model="member.bank_account" class="form-control" placeholder="No Rek" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <button @click="saveMember(member)" class="btn btn-primary btn-sm" title="Simpan">
                    <Save :size="16" />
                  </button>
                  <button @click="removeExistingMember(member, index)" class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Hapus">
                    <Trash2 :size="16" />
                  </button>
                </div>
                
                <div class="mt-4 add-member-row" style="border-top: 1px dashed var(--border); padding-top: 1rem;">
                  <input type="text" v-model="newMember.name" class="form-control" placeholder="Nama Baru" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <input type="text" v-model="newMember.bank_name" class="form-control" placeholder="Bank" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <input type="text" v-model="newMember.bank_account" class="form-control" placeholder="No Rek" style="flex: 1; min-width: 0; font-size: 0.875rem;">
                  <button @click="addNewMember" class="btn btn-primary btn-sm" :disabled="!newMember.name">
                    <PlusCircle :size="16" /> Tambah
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
          <div v-for="(member, index) in members" :key="index" class="member-row mb-3">
            <input type="text" v-model="member.name" class="form-control" placeholder="Nama Anggota" style="flex: 1;">
            <input type="text" v-model="member.bank_name" class="form-control" placeholder="Bank/E-Wallet" style="flex: 1;">
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

/* Responsive Adjustments */
.activity-header {
  display: flex;
  flex-direction: column;
}

.activity-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  align-items: stretch;
}

.activity-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.member-row, .manage-member-row, .add-member-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface);
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

@media (min-width: 768px) {
  .activity-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
  .activity-header > div:first-child {
    padding-right: 1rem;
  }
  .activity-actions {
    align-items: flex-end;
    margin-top: 0 !important;
  }
  .activity-actions-row {
    flex-wrap: nowrap;
  }
  .member-row, .manage-member-row, .add-member-row {
    flex-direction: row;
    align-items: center;
    background: transparent;
    padding: 0;
    border: none;
    border-radius: 0;
  }
}
</style>
