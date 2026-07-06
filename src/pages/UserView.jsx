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

  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [selectedRecapMemberId, setSelectedRecapMemberId] = useState('');
  const [tempRecapMemberId, setTempRecapMemberId] = useState('');

  const confirmRecapMember = () => {
    if (tempRecapMemberId) {
      setSelectedRecapMemberId(tempRecapMemberId);
      setIsRecapModalOpen(false);
    }
  };

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

  const topContributor = useMemo(() => {
    if (transactions.length === 0 || members.length === 0) return null;
    const contributions = {};
    transactions.forEach(t => {
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
    
    const member = members.find(m => String(m.id) === String(topId));
    return member ? { name: member.name, amount: maxAmount } : null;
  }, [transactions, members]);

  const spendersRanking = useMemo(() => {
    if (transactions.length === 0 || members.length === 0) return [];
    
    const expenses = {};
    members.forEach(m => expenses[m.id] = 0);
    
    transactions.forEach(t => {
      const amt = Number(t.amount);
      const involvedStr = t.involved_member_ids;
      let involved = [];
      if (typeof involvedStr === 'string' && involvedStr.trim() !== '') {
        involved = involvedStr.split(',').map(s => s.trim()).filter(s => s);
      } else if (Array.isArray(involvedStr)) {
        involved = involvedStr;
      }
      if (involved.length === 0) return;
      const splitAmt = amt / involved.length;
      
      involved.forEach(id => {
        if (expenses[id] !== undefined) {
          expenses[id] += splitAmt;
        }
      });
    });
    
    return members
      .map(m => ({ id: m.id, name: m.name, amount: expenses[m.id] }))
      .filter(m => m.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, members]);

  const recapData = useMemo(() => {
    if (!selectedRecapMemberId || transactions.length === 0 || members.length === 0) return null;
    
    const member = members.find(m => String(m.id) === String(selectedRecapMemberId));
    if (!member) return null;
    
    const items = [];
    let total = 0;
    
    transactions.forEach(t => {
      const involvedStr = t.involved_member_ids;
      let involved = [];
      if (typeof involvedStr === 'string' && involvedStr.trim() !== '') {
        involved = involvedStr.split(',').map(s => s.trim()).filter(s => s);
      } else if (Array.isArray(involvedStr)) {
        involved = involvedStr;
      }
      
      if (involved.includes(String(member.id))) {
        const splitAmt = Number(t.amount) / involved.length;
        items.push({
          name: t.item_name && t.item_name !== '-' ? t.item_name : 'Pengeluaran',
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
  }, [selectedRecapMemberId, transactions, members]);

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

      <div className="summary-cards-container mb-4 mt-4">
        <div className="card summary-card" style={{ background: 'linear-gradient(135deg, #f79039, #e65c00)', color: 'white', border: 'none', padding: '1.5rem' }}>
          <h4 style={{ color: 'white', opacity: 0.9 }}>Total Pengeluaran</h4>
          <div className="amount" style={{ color: 'white' }}>{formatRupiah(totalExpense)}</div>
        </div>
        <div className="card summary-card" style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', border: 'none', padding: '1.5rem' }}>
          <h4 style={{ color: 'white', opacity: 0.9 }}>Kontributor Terbanyak</h4>
          {topContributor ? (
            <div>
              <div className="amount" style={{ fontSize: '1.25rem', color: 'white' }}>{topContributor.name}</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, color: 'white' }}>{formatRupiah(topContributor.amount)}</div>
            </div>
          ) : (
            <div style={{ opacity: 0.8, color: 'white' }}>Belum ada</div>
          )}
        </div>
      </div>

      <div className="card mb-4 text-center">
        <p className="mb-3 font-semibold text-secondary" style={{ fontWeight: 600 }}>Ingin melihat rincian belanjamu?</p>
        <button className="btn btn-secondary" onClick={() => setIsRecapModalOpen(true)}>Klik Disini</button>
      </div>

      {recapData && (
        <div className="card mb-4">
          <div className="recap-header">
            <h3 className="card-title mb-0">Rekap Belanjaan: {recapData.member.name}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRecapMemberId('')}>Tutup</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '300px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Nama Aktivitas</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600, textAlign: 'right' }}>Biaya</th>
                </tr>
              </thead>
              <tbody>
                {recapData.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatRupiah(item.amount)}</td>
                  </tr>
                ))}
                {recapData.items.length === 0 && (
                  <tr>
                    <td colSpan="2" style={{ padding: '1rem', textAlign: 'center', color: 'var(--secondary)' }}>Tidak ada pengeluaran.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatRupiah(recapData.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, border: editingTransactionId ? '2px solid var(--primary)' : '' }}>
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
              <div className="checkbox-grid">
                {members.map(m => (
                  <label key={m.id} className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={involvedMemberIds.includes(m.id)} 
                      onChange={() => toggleMemberInvolved(m.id)}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">{m.name}</span>
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

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
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
              <div key={t.id} className="transaction-item" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)' }}>
                <div className="transaction-header">
                  <div className="transaction-info">
                    <strong>{getMemberName(t.paid_by_member_id)}</strong> 
                    <span className="text-secondary"> menalangi </span>
                    <strong className="text-primary">{formatRupiah(t.amount)}</strong>
                    <span className="text-secondary"> untuk </span>
                    <strong>{t.item_name !== '-' ? t.item_name : 'Pengeluaran'}</strong>
                    
                    <div className="transaction-date mt-1" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
                    <div className="transaction-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button onClick={() => startEditTransaction(t)} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.75rem', color: 'var(--primary)' }} title="Edit">
                        <Edit size={16} /> Edit
                      </button>
                      <button onClick={() => deleteTransaction(t.id)} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.75rem', color: 'var(--danger)' }} title="Hapus">
                        <Trash2 size={16} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {spendersRanking.length > 0 && (
        <div className="card mb-4">
          <h3 className="card-title">Ranking Pengeluaran Terbanyak</h3>
          <p className="text-secondary mb-4" style={{ fontSize: '0.875rem' }}>Urutan anggota berdasarkan total tagihan (pengeluaran).</p>
          
          <div className="ranking-list">
            {spendersRanking.map((spender, index) => (
              <div key={spender.id} className="ranking-item">
                <div className="ranking-rank">
                  {index === 0 ? <span style={{ fontSize: '1.5rem' }} title="Peringkat 1">🥇</span> :
                   index === 1 ? <span style={{ fontSize: '1.5rem' }} title="Peringkat 2">🥈</span> :
                   index === 2 ? <span style={{ fontSize: '1.5rem' }} title="Peringkat 3">🥉</span> :
                   <span className="rank-number">{index + 1}</span>}
                </div>
                <div className="ranking-name" style={{ flex: 1, fontWeight: 600 }}>{spender.name}</div>
                <div className="ranking-amount" style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatRupiah(spender.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="app-footer">
        <Link to="/admin" className="admin-link">Area Admin</Link>
      </div>

      {isRecapModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsRecapModalOpen(false); }}>
          <div className="modal-content card" style={{ padding: '2rem' }}>
            <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>Pilih Anggota</h3>
            <p className="text-secondary mb-4">Siapa yang ingin dilihat rekap belanjanya?</p>
            <div className="form-group">
              <select value={tempRecapMemberId} onChange={(e) => setTempRecapMemberId(e.target.value)} className="form-control">
                <option value="" disabled>Pilih Anggota</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsRecapModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={confirmRecapMember}>Lihat Rekap</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
