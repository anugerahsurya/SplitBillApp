import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { CheckSquare, Save, Copy, Edit, Trash2 } from 'lucide-react';
import { useToast } from '../App';

export default function UserView() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get('id');

  const [activity, setActivity] = useState(null);
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [paidById, setPaidById] = useState('');
  const [amount, setAmount] = useState('');
  const [itemName, setItemName] = useState('');
  const [involvedMemberIds, setInvolvedMemberIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchData = async () => {
    if (!activityId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getActivity(activityId);
      if (res.success) {
        setActivity(res.data.activity);
        setMembers(res.data.members);
        
        const sortedTrans = res.data.transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setTransactions(sortedTrans);
      } else {
        setErrorMsg('Kegiatan tidak ditemukan atau link tidak valid.');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan koneksi saat memuat data.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  const toggleMemberInvolved = (id) => {
    setInvolvedMemberIds(prev => 
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const selectAllMembers = () => {
    setInvolvedMemberIds(members.map(m => m.id));
  };

  const clearMembers = () => {
    setInvolvedMemberIds([]);
  };

  const getMemberName = (id) => {
    const member = members.find((m) => String(m.id) === String(id));
    return member ? member.name : 'Unknown';
  };

  const formatRupiah = (number) => {
    if (!number) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  const settlement = useMemo(() => {
    if (members.length === 0 || transactions.length === 0) return [];
    
    let balances = {};
    members.forEach(m => balances[m.id] = 0);
    
    transactions.forEach(t => {
      const paidBy = t.paid_by_member_id;
      const amountVal = parseFloat(t.amount);
      const involvedStr = t.involved_member_ids;
      
      let involvedIds = [];
      if (typeof involvedStr === 'string' && involvedStr.trim() !== '') {
        involvedIds = involvedStr.split(',').map(s => s.trim()).filter(s => s);
      } else if (Array.isArray(involvedStr)) {
        involvedIds = involvedStr;
      }
      
      if (involvedIds.length === 0) return;
      
      const splitAmount = amountVal / involvedIds.length;
      
      if (balances[paidBy] !== undefined) {
        balances[paidBy] += amountVal;
      }
      
      involvedIds.forEach(id => {
        if (balances[id] !== undefined) {
          balances[id] -= splitAmount;
        }
      });
    });
    
    let debtors = [];
    let creditors = [];
    
    for (const [id, balance] of Object.entries(balances)) {
      if (balance < -0.01) debtors.push({ id, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ id, amount: balance });
    }
    
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    
    let results = [];
    let i = 0, j = 0;
    
    while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i];
      let creditor = creditors[j];
      
      let minAmount = Math.min(debtor.amount, creditor.amount);
      
      const debtorObj = members.find(m => String(m.id) === String(debtor.id));
      const creditorObj = members.find(m => String(m.id) === String(creditor.id));
      
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
      
      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }
    
    return results;
  }, [members, transactions]);

  const totalExpense = useMemo(() => {
    return transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  }, [transactions]);

  const submitTransaction = async () => {
    if (!paidById || !amount || involvedMemberIds.length === 0) {
      toast("Mohon lengkapi form transaksi.", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await api.addTransaction({
        activity_id: activityId,
        paid_by_member_id: paidById,
        amount: amount,
        item_name: itemName,
        involved_member_ids: involvedMemberIds
      });
      
      if (res.success) {
        setPaidById('');
        setAmount('');
        setItemName('');
        setInvolvedMemberIds([]);
        await fetchData();
        toast("Pengeluaran berhasil ditambahkan!", "success");
      } else {
        toast("Gagal menambahkan transaksi: " + res.error, "error");
      }
    } catch (err) {
      toast("Terjadi kesalahan koneksi.", "error");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditTransaction = (t) => {
    setEditingTransactionId(t.id);
    setPaidById(t.paid_by_member_id);
    setAmount(t.amount);
    setItemName(t.item_name !== '-' ? t.item_name : '');
    
    const involved = typeof t.involved_member_ids === 'string' 
      ? t.involved_member_ids.split(',') 
      : t.involved_member_ids;
    setInvolvedMemberIds(involved);
  };

  const cancelEditTransaction = () => {
    setEditingTransactionId(null);
    setPaidById('');
    setAmount('');
    setItemName('');
    setInvolvedMemberIds([]);
  };

  const saveEditTransaction = async () => {
    if (!paidById || !amount || involvedMemberIds.length === 0) {
      toast("Mohon lengkapi form transaksi.", "error");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await api.editTransaction({
        transaction_id: editingTransactionId,
        paid_by_member_id: paidById,
        amount: amount,
        item_name: itemName,
        involved_member_ids: involvedMemberIds
      });
      
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
      setIsSavingEdit(false);
    }
  };

  const deleteTransaction = async (id) => {
    if (window.confirm('Yakin ingin menghapus pengeluaran ini?')) {
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

  const copyAccount = (account) => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    toast("Nomor rekening disalin!", "success");
  };

  if (isLoading) {
    return <div className="text-center py-4 text-secondary" style={{ marginTop: '2rem' }}>Memuat data kegiatan...</div>;
  }

  if (!activityId) {
    return (
      <div className="card text-center" style={{ marginTop: '2rem', padding: '3rem 1.5rem' }}>
        <h2 className="card-title">Selamat Datang di SplitBill</h2>
        <p className="text-secondary mb-4" style={{ maxWidth: '400px', margin: '0 auto 2rem' }}>
          Minta link kegiatan dari temanmu untuk melihat tagihan, atau masuk ke area admin untuk membuat kegiatan baru.
        </p>
        <Link to="/admin" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          Masuk ke Area Admin
        </Link>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="card text-center text-danger" style={{ marginTop: '2rem' }}>
        <h2 className="card-title text-danger">Oops!</h2>
        <p>{errorMsg}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-4 text-center">
        <h2 className="card-title mb-2" style={{ fontSize: '1.75rem' }}>{activity?.name}</h2>
        <p className="text-secondary mb-0">Status: <span className={`badge ${activity?.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{activity?.status === 'active' ? 'Aktif' : 'Selesai'}</span></p>
        <p className="text-secondary mt-1" style={{ fontSize: '0.875rem' }}>Dibuat pada: {formatDate(activity?.created_at)}</p>
      </div>

      <div className="grid grid-cols-2">
        <div>
          <div className="card h-full" style={{ border: editingTransactionId ? '2px solid var(--primary)' : '' }}>
            <h2 className="card-title">
              {editingTransactionId ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
            </h2>
            
            <div className="form-group">
              <label className="form-label">Nama Barang / Pengeluaran (Opsional)</label>
              <input 
                type="text" 
                value={itemName} 
                onChange={(e) => setItemName(e.target.value)}
                className="form-control" 
                placeholder="Contoh: Tiket Masuk, Makan Siang" 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Siapa yang bayar?</label>
              <select value={paidById} onChange={(e) => setPaidById(e.target.value)} className="form-control">
                <option value="" disabled>Pilih anggota...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Berapa totalnya? (Rp)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="form-control" 
                placeholder="0" 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label mb-2">Siapa saja yang ikut patungan?</label>
              <div className="mb-2" style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={selectAllMembers} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Pilih Semua</button>
                <button onClick={clearMembers} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Bersihkan</button>
              </div>
              <div className="members-checkbox-grid">
                {members.map(m => (
                  <label key={m.id} className={`member-checkbox ${involvedMemberIds.includes(m.id) ? 'active' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={involvedMemberIds.includes(m.id)} 
                      onChange={() => toggleMemberInvolved(m.id)}
                    />
                    <span>{m.name}</span>
                    {involvedMemberIds.includes(m.id) && <CheckSquare size={16} className="text-primary" />}
                  </label>
                ))}
              </div>
            </div>
            
            {editingTransactionId ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button onClick={saveEditTransaction} className="btn btn-primary" style={{ flex: 1 }} disabled={isSavingEdit}>
                  <Save size={20} /> {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={cancelEditTransaction} className="btn btn-secondary">Batal</button>
              </div>
            ) : (
              <button onClick={submitTransaction} className="btn btn-primary btn-block mt-4" disabled={isSubmitting || activity?.status !== 'active'}>
                <Save size={20} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            )}
            
            {activity?.status !== 'active' && !editingTransactionId && (
              <p className="text-danger mt-2" style={{ fontSize: '0.875rem' }}>Kegiatan sudah selesai. Tidak bisa menambah pengeluaran baru.</p>
            )}
          </div>
        </div>

        <div>
          <div className="card h-full" style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
            <h2 className="card-title" style={{ color: 'white', background: 'none', WebkitTextFillColor: 'initial' }}>Tagihan & Pembayaran</h2>
            
            <div className="settlement-summary mb-4 p-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius)' }}>
              <p className="mb-1" style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Pengeluaran Kegiatan</p>
              <h3 style={{ fontSize: '1.75rem', margin: 0 }}>{formatRupiah(totalExpense)}</h3>
            </div>
            
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Siapa Bayar ke Siapa?</h3>
            
            {settlement.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Belum ada tagihan.</p>
            ) : (
              <div className="settlement-list">
                {settlement.map((s, index) => (
                  <div key={index} className="settlement-item">
                    <div className="settlement-route">
                      <strong>{s.from}</strong> <span style={{ opacity: 0.7 }}>bayar ke</span> <strong>{s.to}</strong>
                    </div>
                    <div className="settlement-amount">
                      {formatRupiah(s.amount)}
                    </div>
                    {s.bankAccount && (
                      <div className="settlement-action">
                        <div className="account-badge">
                          <span className="badge-orange">{s.bankName || 'Rekening/E-Wallet'}</span>
                          {s.bankAccount}
                        </div>
                        <button onClick={() => copyAccount(s.bankAccount)} className="btn-copy" title="Copy Nomor">
                          <Copy size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <h2 className="card-title">Daftar Pengeluaran</h2>
        {transactions.length === 0 ? (
          <p className="text-secondary">Belum ada pengeluaran dicatat.</p>
        ) : (
          <div className="transaction-history">
            {transactions.map(t => (
              <div key={t.id} className="transaction-item">
                <div className="transaction-info">
                  <strong>{getMemberName(t.paid_by_member_id)}</strong> 
                  <span className="text-secondary"> menalangi </span>
                  <strong className="text-primary">{formatRupiah(t.amount)}</strong>
                  <span className="text-secondary"> untuk </span>
                  <strong>{t.item_name !== '-' ? t.item_name : 'Pengeluaran'}</strong>
                  
                  <div className="transaction-date mt-1">
                    {formatDate(t.created_at)}
                  </div>
                  
                  <div className="transaction-involved mt-2">
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>Ditanggung oleh: </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {typeof t.involved_member_ids === 'string' 
                        ? t.involved_member_ids.split(',').map((id, idx) => (
                            <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                              {getMemberName(id.trim())}
                            </span>
                          ))
                        : (t.involved_member_ids || []).map((id, idx) => (
                            <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                              {getMemberName(id)}
                            </span>
                          ))
                      }
                    </div>
                  </div>
                </div>
                {activity?.status === 'active' && (
                  <div className="transaction-actions">
                    <button onClick={() => startEditTransaction(t)} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem', color: 'var(--primary)' }} title="Edit">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => deleteTransaction(t.id)} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem', color: 'var(--danger)' }} title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="app-footer">
        <Link to="/admin" className="admin-link">Area Admin</Link>
      </div>
    </div>
  );
}
