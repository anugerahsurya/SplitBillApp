<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../services/api';
import { CheckSquare, Save, Copy, Edit, Trash2 } from 'lucide-vue-next';

const toast = inject('toast');

const route = useRoute();
const activityId = route.query.id;

const isLoading = ref(true);
const error = ref('');
const activity = ref(null);
const members = ref([]);
const transactions = ref([]);

// Form State
const itemName = ref('');
const paidById = ref('');
const amount = ref('');
const involvedMemberIds = ref([]);
const isSubmitting = ref(false);
const editingTransactionId = ref(null);

const isRecapModalOpen = ref(false);
const selectedRecapMemberId = ref('');
const tempRecapMemberId = ref('');

const confirmRecapMember = () => {
  if (tempRecapMemberId.value) {
    selectedRecapMemberId.value = tempRecapMemberId.value;
    isRecapModalOpen.value = false;
  }
};

const recapData = computed(() => {
  if (!selectedRecapMemberId.value || !transactions.value.length || !members.value.length) return null;
  
  const member = members.value.find(m => String(m.id) === String(selectedRecapMemberId.value));
  if (!member) return null;
  
  const items = [];
  let total = 0;
  
  transactions.value.forEach(t => {
    const involved = t.involved_member_ids ? String(t.involved_member_ids).split(',') : [];
    if (involved.includes(String(member.id))) {
      const splitAmt = Number(t.amount) / involved.length;
      items.push({
        name: t.item_name || '-',
        amount: splitAmt
      });
      total += splitAmt;
    }
  });
  
  return {
    member: member,
    items: items,
    total: total
  };
});

const fetchData = async () => {
  if (!activityId) {
    isLoading.value = false;
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  try {
    const res = await api.getActivity(activityId);
    if (res.success) {
      activity.value = res.data.activity;
      members.value = res.data.members;
      transactions.value = res.data.transactions;
    } else {
      error.value = res.error || 'Kegiatan tidak ditemukan.';
    }
  } catch (err) {
    error.value = 'Gagal memuat data dari server.';
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

// Calculate statistics
const topContributor = computed(() => {
  if (!transactions.value.length || !members.value.length) return null;
  const contributions = {};
  transactions.value.forEach(t => {
    contributions[t.paid_by_member_id] = (contributions[t.paid_by_member_id] || 0) + Number(t.amount);
  });
  
  let topId = null;
  let maxAmount = 0;
  for (const [id, amt] of Object.entries(contributions)) {
    if (amt > maxAmount) {
      maxAmount = amt;
      topId = id;
    }
  }
  
  const member = members.value.find(m => String(m.id) === String(topId));
  return member ? { name: member.name, amount: maxAmount } : null;
});

const totalExpense = computed(() => {
  return transactions.value.reduce((sum, t) => sum + Number(t.amount), 0);
});

// Calculate Top Spenders
const spendersRanking = computed(() => {
  if (!transactions.value.length || !members.value.length) return [];
  
  const expenses = {};
  members.value.forEach(m => expenses[m.id] = 0);
  
  transactions.value.forEach(t => {
    const amt = Number(t.amount);
    const involved = t.involved_member_ids ? String(t.involved_member_ids).split(',') : [];
    if (involved.length === 0) return;
    const splitAmt = amt / involved.length;
    
    involved.forEach(id => {
      if (expenses[id] !== undefined) {
        expenses[id] += splitAmt;
      }
    });
  });
  
  return members.value
    .map(m => ({ id: m.id, name: m.name, amount: expenses[m.id] }))
    .filter(m => m.amount > 0)
    .sort((a, b) => b.amount - a.amount);
});

// Settlement Algorithm (Debt Simplification)
const settlements = computed(() => {
  if (!transactions.value.length || !members.value.length) return [];
  
  // Calculate net balances for each member
  const balances = {};
  members.value.forEach(m => balances[m.id] = 0);
  
  transactions.value.forEach(t => {
    const amt = Number(t.amount);
    const involved = t.involved_member_ids ? String(t.involved_member_ids).split(',') : [];
    const splitAmt = amt / involved.length;
    
    // Payer gets positive balance
    if (balances[t.paid_by_member_id] !== undefined) {
      balances[t.paid_by_member_id] += amt;
    }
    
    // Involved get negative balance
    involved.forEach(id => {
      if (balances[id] !== undefined) {
        balances[id] -= splitAmt;
      }
    });
  });
  
  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors = [];
  const creditors = [];
  
  for (const [id, bal] of Object.entries(balances)) {
    if (bal < -0.01) debtors.push({ id, amount: -bal });
    else if (bal > 0.01) creditors.push({ id, amount: bal });
  }
  
  // Sort by amount descending to minimize transactions
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  
  const results = [];
  let d = 0;
  let c = 0;
  
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    
    const minAmount = Math.min(debtor.amount, creditor.amount);
    
    const debtorObj = members.value.find(m => String(m.id) === String(debtor.id));
    const creditorObj = members.value.find(m => String(m.id) === String(creditor.id));
    
    if (debtorObj && creditorObj) {
      results.push({
        from: debtorObj.name,
        to: creditorObj.name,
        amount: minAmount,
        bankName: creditorObj.bank_name,
        bankAccount: creditorObj.bank_account
      });
    }
    
    debtor.amount -= minAmount;
    creditor.amount -= minAmount;
    
    if (debtor.amount < 0.01) d++;
    if (creditor.amount < 0.01) c++;
  }
  
  return results;
});

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

const selectAllInvolved = () => {
  if (involvedMemberIds.value.length === members.value.length) {
    involvedMemberIds.value = [];
  } else {
    involvedMemberIds.value = members.value.map(m => m.id);
  }
};

const submitTransaction = async () => {
  if (!paidById.value || !amount.value || involvedMemberIds.value.length === 0) {
    toast("Mohon lengkapi form transaksi.", "error");
    return;
  }
  
  isSubmitting.value = true;
  try {
    let res;
    if (editingTransactionId.value) {
      res = await api.editTransaction({
        transaction_id: editingTransactionId.value,
        item_name: itemName.value,
        paid_by_member_id: paidById.value,
        amount: amount.value,
        involved_member_ids: involvedMemberIds.value
      });
    } else {
      res = await api.addTransaction({
        activity_id: activityId,
        item_name: itemName.value,
        paid_by_member_id: paidById.value,
        amount: amount.value,
        involved_member_ids: involvedMemberIds.value
      });
    }
    
    if (res.success) {
      cancelEditTransaction();
      await fetchData();
      toast("Transaksi berhasil disimpan!", "success");
    } else {
      toast("Gagal menyimpan transaksi: " + res.error, "error");
    }
  } catch (err) {
    toast("Terjadi kesalahan koneksi.", "error");
    console.error(err);
  } finally {
    isSubmitting.value = false;
  }
};

const deleteTransaction = async (id) => {
  if (confirm('Yakin ingin menghapus pengeluaran ini?')) {
    try {
      const res = await api.deleteTransaction(id);
      if (res.success) {
        toast("Transaksi berhasil dihapus.", "success");
        await fetchData();
      } else {
        toast('Gagal menghapus: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi.', 'error');
    }
  }
};

const editTransaction = (t) => {
  editingTransactionId.value = t.id;
  itemName.value = t.item_name && t.item_name !== '-' ? t.item_name : '';
  paidById.value = t.paid_by_member_id;
  amount.value = t.amount;
  involvedMemberIds.value = t.involved_member_ids ? String(t.involved_member_ids).split(',') : [];
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEditTransaction = () => {
  editingTransactionId.value = null;
  itemName.value = '';
  paidById.value = '';
  amount.value = '';
  involvedMemberIds.value = [];
};

const copyAccount = (account) => {
  if (!account) return;
  navigator.clipboard.writeText(account);
  toast("Nomor rekening disalin!", "success");
};
</script>

<template>
  <div>
    <!-- Landing Page -->
    <div v-if="!activityId" class="text-center" style="padding: 3rem 1rem;">
      <h2 style="color: var(--primary); margin-bottom: 1rem; font-size: 2rem;">Selamat Datang di SplitBill</h2>
      <p style="color: var(--text-muted); margin-bottom: 2.5rem; font-size: 1.125rem;">Bagi tagihan bersama teman jadi lebih mudah dan transparan.</p>
      
      <div class="card" style="max-width: 400px; margin: 0 auto; background: var(--surface);">
        <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">Area Admin</h3>
        <p style="margin-bottom: 1.5rem; color: var(--text-muted); font-size: 0.875rem;">Buat kegiatan baru atau kelola kegiatan yang sudah ada.</p>
        <router-link to="/admin" class="btn btn-primary btn-block" style="padding: 0.75rem;">
          Masuk ke Laman Admin
        </router-link>
      </div>
    </div>

    <div v-else-if="isLoading" class="text-center" style="padding: 3rem;">
      <p>Memuat data kegiatan...</p>
    </div>
    
    <div v-else-if="error" class="card" style="border-color: var(--danger);">
      <h3 class="text-danger">Oops!</h3>
      <p>{{ error }}</p>
    </div>
    
    <div v-else-if="activity">
      <div style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.75rem; color: var(--primary);">{{ activity.name }}</h2>
        <span class="badge" :class="activity.status === 'finished' ? 'badge-finished' : 'badge-active'">
          {{ activity.status === 'finished' ? 'Selesai' : 'Sedang Berjalan' }}
        </span>
      </div>

      <!-- Dashboard Cards -->
      <div class="summary-cards-container mb-4">
        <div class="card summary-card" style="background: linear-gradient(135deg, #f79039, #e65c00); color: white;">
          <h4>Total Pengeluaran</h4>
          <div class="amount">{{ formatCurrency(totalExpense) }}</div>
        </div>
        <div class="card summary-card" style="background: linear-gradient(135deg, #10B981, #059669); color: white;">
          <h4>Kontributor Terbanyak</h4>
          <div v-if="topContributor">
            <div class="amount" style="font-size: 1.25rem;">{{ topContributor.name }}</div>
            <div style="font-size: 0.875rem; opacity: 0.9;">{{ formatCurrency(topContributor.amount) }}</div>
          </div>
          <div v-else style="opacity: 0.8;">Belum ada</div>
        </div>
      </div>

      <!-- Recap Trigger -->
      <div class="card mb-4 text-center" style="background: var(--surface);">
        <p class="mb-3 font-semibold text-secondary">Ingin melihat rincian belanjamu?</p>
        <button class="btn btn-secondary" @click="isRecapModalOpen = true">Klik Disini</button>
      </div>

      <!-- Recap Table -->
      <div class="card mb-4" v-if="recapData">
        <div class="recap-header">
          <h3 class="card-title mb-0">Rekap Belanjaan: {{ recapData.member.name }}</h3>
          <button class="btn btn-secondary btn-sm" @click="selectedRecapMemberId = ''">Tutup</button>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; min-width: 300px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 0.75rem; font-weight: 600;">Nama Aktivitas</th>
                <th style="padding: 0.75rem; font-weight: 600; text-align: right;">Biaya</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in recapData.items" :key="idx" style="border-bottom: 1px solid var(--border);">
                <td style="padding: 0.75rem;">{{ item.name }}</td>
                <td style="padding: 0.75rem; text-align: right;">{{ formatCurrency(item.amount) }}</td>
              </tr>
              <tr v-if="recapData.items.length === 0">
                <td colspan="2" style="padding: 1rem; text-align: center; color: var(--secondary);">Tidak ada pengeluaran.</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td style="padding: 0.75rem; font-weight: 700;">Total</td>
                <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: var(--danger);">{{ formatCurrency(recapData.total) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Add Transaction Form -->
      <div class="card mb-4" v-if="activity.status !== 'finished'">
        <h3 class="card-title">{{ editingTransactionId ? 'Edit Pengeluaran' : 'Catat Pengeluaran' }}</h3>
        
        <div class="form-group">
          <label class="form-label">Nama Item / Keperluan</label>
          <input type="text" v-model="itemName" class="form-control" placeholder="Contoh: Tiket Masuk, Makan Siang">
        </div>

        <div class="form-group">
          <label class="form-label">Dibayar Oleh</label>
          <select v-model="paidById" class="form-control">
            <option value="" disabled>Pilih Anggota</option>
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Besaran (Rp)</label>
          <input type="number" v-model="amount" class="form-control" placeholder="Contoh: 150000">
        </div>
        
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label class="form-label" style="margin-bottom: 0;">Yang Terlibat</label>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" @click="selectAllInvolved">
              <CheckSquare :size="14" /> Pilih Semua
            </button>
          </div>
          <div class="checkbox-grid">
            <label v-for="m in members" :key="'inv'+m.id" class="toggle-switch">
              <input type="checkbox" :value="m.id" v-model="involvedMemberIds">
              <span class="toggle-slider"></span>
              <span class="toggle-label">{{ m.name }}</span>
            </label>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; flex-direction: column;" class="mt-4 form-actions">
          <button class="btn btn-primary" style="flex: 1;" @click="submitTransaction" :disabled="isSubmitting">
            <Save :size="20" v-if="!isSubmitting" />
            {{ isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi' }}
          </button>
          <button v-if="editingTransactionId" class="btn btn-secondary" style="flex: 1;" @click="cancelEditTransaction" :disabled="isSubmitting">
            Batal
          </button>
        </div>
      </div>

      <!-- Transaction List -->
      <div class="card mb-4" v-if="transactions.length > 0">
        <h3 class="card-title">Daftar Pengeluaran</h3>
        <div class="transaction-list">
          <div v-for="t in transactions" :key="t.id" class="transaction-item mb-3 p-3" style="border: 1px solid var(--border); border-radius: 8px;">
            <div class="transaction-header">
              <div>
                <div style="font-weight: 600;">
                  {{ members.find(m => String(m.id) === String(t.paid_by_member_id))?.name || 'Unknown' }}
                  membayar
                  <span style="color: var(--danger);">{{ formatCurrency(t.amount) }}</span>
                  untuk {{ t.item_name || '-' }}
                </div>
                <div style="font-size: 0.875rem; color: var(--secondary); margin-top: 0.25rem;">
                  Untuk: 
                  {{ 
                    (t.involved_member_ids ? String(t.involved_member_ids).split(',') : [])
                      .map(id => members.find(m => String(m.id) === String(id))?.name || id)
                      .join(', ')
                  }}
                </div>
              </div>
              
              <div style="display: flex; gap: 0.5rem;" v-if="activity.status !== 'finished'">
                <button @click="editTransaction(t)" class="btn btn-secondary btn-sm" style="color: var(--primary);" title="Edit">
                  <Edit :size="16" />
                </button>
                <button @click="deleteTransaction(t.id)" class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Hapus">
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Spenders Ranking -->
      <div class="card mb-4" v-if="spendersRanking.length > 0">
        <h3 class="card-title">Ranking Pengeluaran Terbanyak</h3>
        <p class="text-muted mb-4" style="font-size: 0.875rem;">Urutan anggota berdasarkan total tagihan (pengeluaran).</p>
        
        <div class="ranking-list">
          <div v-for="(spender, index) in spendersRanking" :key="spender.id" class="ranking-item">
            <div class="ranking-rank">
              <span v-if="index === 0" style="font-size: 1.5rem;" title="Peringkat 1">🥇</span>
              <span v-else-if="index === 1" style="font-size: 1.5rem;" title="Peringkat 2">🥈</span>
              <span v-else-if="index === 2" style="font-size: 1.5rem;" title="Peringkat 3">🥉</span>
              <span v-else class="rank-number">{{ index + 1 }}</span>
            </div>
            <div class="ranking-name" style="flex: 1; font-weight: 600;">{{ spender.name }}</div>
            <div class="ranking-amount" style="font-weight: 700; color: var(--danger);">{{ formatCurrency(spender.amount) }}</div>
          </div>
        </div>
      </div>

      <!-- Settlement List -->
      <div class="card">
        <h3 class="card-title">Hasil Pembagian (Settlement)</h3>
        <p class="text-muted mb-4" style="font-size: 0.875rem;">Siapa bayar ke siapa secara ringkas.</p>
        
        <div v-if="settlements.length === 0" class="text-center text-muted py-4">
          Belum ada tagihan.
        </div>
        
        <div v-else class="settlement-list">
          <div v-for="(s, idx) in settlements" :key="idx" class="settlement-item">
            <div class="settlement-info">
              <div class="settlement-names">
                <strong>{{ s.from }}</strong> <span style="color:var(--text-muted);">bayar ke</span> <strong>{{ s.to }}</strong>
              </div>
              <div class="settlement-amount">{{ formatCurrency(s.amount) }}</div>
            </div>
            
            <div v-if="s.bankAccount" class="settlement-action">
              <div class="account-badge">
                <span class="badge-orange">{{ s.bankName || 'Rekening/E-Wallet' }}</span>
                {{ s.bankAccount }}
              </div>
              <button class="btn btn-secondary btn-sm" @click="copyAccount(s.bankAccount)">
                <Copy :size="14" /> Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Select Member for Recap -->
      <div v-if="isRecapModalOpen" class="modal-overlay" @click.self="isRecapModalOpen = false">
        <div class="modal-content card">
          <h3 class="card-title">Pilih Anggota</h3>
          <p class="text-muted mb-4">Siapa yang ingin dilihat rekap belanjanya?</p>
          <div class="form-group">
            <select v-model="tempRecapMemberId" class="form-control">
              <option value="" disabled>Pilih Anggota</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
            <button class="btn btn-secondary" @click="isRecapModalOpen = false">Batal</button>
            <button class="btn btn-primary" @click="confirmRecapMember">Lihat Rekap</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-active { background: #DBEAFE; color: #1E40AF; }
.badge-finished { background: #F3F4F6; color: #4B5563; }

.summary-card h4 {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 0.5rem;
}
.summary-card .amount {
  font-size: 1.75rem;
  font-weight: 700;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  background: #F8FAFC;
  padding: 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

/* Remove old checkbox styles */

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.ranking-item {
  display: flex;
  align-items: center;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  gap: 1rem;
}
.ranking-rank {
  width: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.rank-number {
  background: var(--surface);
  color: var(--secondary);
  font-weight: 700;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--border);
  font-size: 0.875rem;
}

.settlement-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.settlement-item {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
}
.settlement-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
@media (min-width: 640px) {
  .settlement-info {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
}
.settlement-amount {
  font-weight: 700;
  color: var(--danger);
}
.settlement-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px dashed var(--border);
}
.account-badge {
  font-family: monospace;
  font-size: 0.875rem;
  flex: 1;
}
.badge-orange {
  background-color: #f97316;
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 0.5rem;
  display: inline-block;
}
.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

/* Responsive Overrides */
.summary-cards-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.transaction-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recap-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.form-actions {
  flex-direction: column;
}

@media (min-width: 640px) {
  .summary-cards-container {
    grid-template-columns: 1fr 1fr;
  }
  .transaction-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
  .recap-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .form-actions {
    flex-direction: row;
  }
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-content {
  width: 100%;
  max-width: 400px;
  background: var(--background);
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}
</style>
