import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LogIn, UserPlus, Trash2, PlusCircle, Copy, List, RefreshCw, Edit, Save, Users } from 'lucide-react';
import { useToast } from '../App';

export default function AdminView() {
  const toast = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [allActivities, setAllActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const [activityName, setActivityName] = useState('');
  const [members, setMembers] = useState([{ name: '', bank_name: '', bank_account: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const [manageMembersActivityId, setManageMembersActivityId] = useState(null);
  const [membersToManage, setMembersToManage] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', bank_name: '', bank_account: '' });

  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editActivityName, setEditActivityName] = useState('');

  const checkPassword = () => {
    if (password === 'adminsurya') {
      setIsLoggedIn(true);
      setLoginError(false);
      fetchActivities();
    } else {
      setLoginError(true);
    }
  };

  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const res = await api.getAllActivities();
      if (res.success) {
        setAllActivities(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const startEdit = (act) => {
    setEditingActivityId(act.id);
    setEditActivityName(act.name);
  };

  const cancelEdit = () => {
    setEditingActivityId(null);
    setEditActivityName('');
  };

  const saveEdit = async () => {
    if (!editActivityName.trim()) {
      toast('Nama kegiatan tidak boleh kosong', 'error');
      return;
    }
    
    try {
      const res = await api.editActivity(editingActivityId, editActivityName);
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
    if (window.confirm('Yakin ingin menghapus kegiatan ini? Semua data terkait (anggota, transaksi) akan ikut terhapus.')) {
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
    if (manageMembersActivityId === activityId) {
      setManageMembersActivityId(null);
      return;
    }
    setManageMembersActivityId(activityId);
    setIsLoadingMembers(true);
    try {
      const res = await api.getActivity(activityId);
      if (res.success) {
        setMembersToManage(res.data.members);
      }
    } catch (err) {
      console.error(err);
      toast('Gagal mengambil data anggota', 'error');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const closeManageMembers = () => {
    setManageMembersActivityId(null);
  };

  const handleManageMemberChange = (index, field, value) => {
    const newMembers = [...membersToManage];
    newMembers[index][field] = value;
    setMembersToManage(newMembers);
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
    if (!window.confirm(`Yakin ingin menghapus anggota ${member.name}?`)) return;
    
    try {
      const res = await api.deleteMember(member.id);
      if (res.success) {
        const newMembers = [...membersToManage];
        newMembers.splice(index, 1);
        setMembersToManage(newMembers);
        toast('Anggota berhasil dihapus', 'success');
      } else {
        toast('Gagal menghapus: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const addNewMember = async () => {
    if (!newMember.name.trim()) return;
    
    try {
      const res = await api.addMember({
        activity_id: manageMembersActivityId,
        name: newMember.name,
        bank_name: newMember.bank_name,
        bank_account: newMember.bank_account
      });
      
      if (res.success) {
        setMembersToManage([
          ...membersToManage,
          {
            id: res.id,
            activity_id: manageMembersActivityId,
            name: newMember.name,
            bank_name: newMember.bank_name,
            bank_account: newMember.bank_account
          }
        ]);
        setNewMember({ name: '', bank_name: '', bank_account: '' });
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
    setMembers([...members, { name: '', bank_name: '', bank_account: '' }]);
  };

  const removeMember = (index) => {
    if (members.length > 1) {
      const newMembers = [...members];
      newMembers.splice(index, 1);
      setMembers(newMembers);
    }
  };

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };

  const createActivity = async () => {
    if (!activityName || members.some((m) => !m.name)) {
      toast("Mohon lengkapi nama kegiatan dan semua nama anggota.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createActivity({
        name: activityName,
        members: members.filter((m) => m.name.trim() !== '')
      });
      
      if (res.success) {
        const baseUrl = window.location.origin;
        setGeneratedLink(`${baseUrl}/?id=${res.id}`);
        setActivityName('');
        setMembers([{ name: '', bank_name: '', bank_account: '' }]);
        toast("Kegiatan berhasil dibuat!", "success");
      } else {
        toast("Gagal membuat kegiatan: " + (res.error || "Unknown error"), "error");
      }
    } catch (err) {
      toast("Terjadi kesalahan koneksi. Pastikan URL Web App GAS sudah diatur di src/services/api.js", "error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast("Link disalin!", "success");
  };

  if (!isLoggedIn) {
    return (
      <div className="card" style={{ maxWidth: '400px', margin: '0 auto', marginTop: '2rem' }}>
        <h2 className="card-title text-center" style={{ display: 'block' }}>Admin Login</h2>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-control" 
            onKeyUp={(e) => e.key === 'Enter' && checkPassword()}
            placeholder="Masukkan password admin..."
          />
          {loginError && <p className="text-danger mb-2 mt-2" style={{ fontSize: '0.875rem' }}>Password salah.</p>}
        </div>
        <button onClick={checkPassword} className="btn btn-primary btn-block">
          <LogIn size={20} /> Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="tabs mb-4" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}>
          <List size={18} /> Dashboard
        </button>
        <button onClick={() => setActiveTab('create')} className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}>
          <PlusCircle size={18} /> Buat Kegiatan Baru
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="card-title mb-0">Daftar Kegiatan</h2>
            <button onClick={fetchActivities} className="btn btn-secondary btn-sm" disabled={isLoadingActivities}>
              <RefreshCw size={16} className={isLoadingActivities ? 'spin' : ''} /> Refresh
            </button>
          </div>
          
          {isLoadingActivities ? (
            <div className="text-center py-4 text-secondary">Memuat data...</div>
          ) : allActivities.length === 0 ? (
            <div className="text-center py-4 text-secondary">Belum ada kegiatan.</div>
          ) : (
            <div className="activities-list">
              {allActivities.map((act) => (
                <div key={act.id} className="activity-item" style={{ marginBottom: '1rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                  <div className="activity-header">
                    <div style={{ flex: 1 }}>
                      {editingActivityId === act.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input 
                            type="text" 
                            value={editActivityName}
                            onChange={(e) => setEditActivityName(e.target.value)}
                            className="form-control" 
                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '1rem' }} 
                          />
                          <button onClick={saveEdit} className="btn btn-primary btn-sm">Simpan</button>
                          <button onClick={cancelEdit} className="btn btn-secondary btn-sm">Batal</button>
                        </div>
                      ) : (
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--primary)' }}>{act.name}</h3>
                      )}
                      
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Tanggal: {formatDate(act.created_at)}
                      </div>
                      <div>
                        <span className={`badge ${act.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                          {act.status === 'active' ? 'Aktif' : 'Selesai'}
                        </span>
                      </div>
                    </div>
                    <div className="activity-actions">
                      <button onClick={() => copyActivityLink(act.id)} className="btn btn-secondary btn-sm" title="Copy Link">
                        <Copy size={16} /> Copy Link
                      </button>
                      <div className="activity-actions-row">
                        <button onClick={() => manageMembers(act.id)} className="btn btn-secondary btn-sm" style={{ color: 'var(--primary)' }} title="Kelola Anggota">
                          <Users size={16} /> Kelola Anggota
                        </button>
                        {editingActivityId !== act.id && (
                          <button onClick={() => startEdit(act)} className="btn btn-secondary btn-sm" style={{ color: 'var(--primary)' }} title="Edit Nama">
                            <Edit size={16} /> Edit
                          </button>
                        )}
                        <button onClick={() => deleteActivityItem(act.id)} className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} title="Hapus">
                          <Trash2 size={16} /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>

                  {manageMembersActivityId === act.id && (
                    <div className="mt-3 p-3" style={{ background: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Kelola Anggota</h4>
                        <button onClick={closeManageMembers} className="btn btn-secondary btn-sm">Tutup</button>
                      </div>
                      
                      {isLoadingMembers ? (
                        <div className="text-center py-2 text-secondary">Memuat anggota...</div>
                      ) : (
                        <div>
                          {membersToManage.map((member, index) => (
                            <div key={member.id || index} className="mb-3 manage-member-row">
                              <input 
                                type="text" 
                                value={member.name}
                                onChange={(e) => handleManageMemberChange(index, 'name', e.target.value)}
                                className="form-control" 
                                placeholder="Nama" 
                                style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                              />
                              <input 
                                type="text" 
                                value={member.bank_name}
                                onChange={(e) => handleManageMemberChange(index, 'bank_name', e.target.value)}
                                className="form-control" 
                                placeholder="Bank" 
                                style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                              />
                              <input 
                                type="text" 
                                value={member.bank_account}
                                onChange={(e) => handleManageMemberChange(index, 'bank_account', e.target.value)}
                                className="form-control" 
                                placeholder="No Rek" 
                                style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                              />
                              <button onClick={() => saveMember(member)} className="btn btn-primary btn-sm" title="Simpan">
                                <Save size={16} />
                              </button>
                              <button onClick={() => removeExistingMember(member, index)} className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} title="Hapus">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          
                          <div className="mt-4 add-member-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                            <input 
                              type="text" 
                              value={newMember.name}
                              onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                              className="form-control" 
                              placeholder="Nama Baru" 
                              style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                            />
                            <input 
                              type="text" 
                              value={newMember.bank_name}
                              onChange={(e) => setNewMember({...newMember, bank_name: e.target.value})}
                              className="form-control" 
                              placeholder="Bank" 
                              style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                            />
                            <input 
                              type="text" 
                              value={newMember.bank_account}
                              onChange={(e) => setNewMember({...newMember, bank_account: e.target.value})}
                              className="form-control" 
                              placeholder="No Rek" 
                              style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }} 
                            />
                            <button onClick={addNewMember} className="btn btn-primary btn-sm" disabled={!newMember.name}>
                              <PlusCircle size={16} /> Tambah
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="card">
          <h2 className="card-title">Buat Kegiatan Baru</h2>
          
          <div className="form-group">
            <label className="form-label">Nama Kegiatan</label>
            <input 
              type="text" 
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              className="form-control" 
              placeholder="Contoh: Makan Siang Bersama" 
            />
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Daftar Anggota</label>
            {members.map((member, index) => (
              <div key={index} className="member-row mb-3">
                <input 
                  type="text" 
                  value={member.name}
                  onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                  className="form-control" 
                  placeholder="Nama Anggota" 
                  style={{ flex: 1 }} 
                />
                <input 
                  type="text" 
                  value={member.bank_name}
                  onChange={(e) => handleMemberChange(index, 'bank_name', e.target.value)}
                  className="form-control" 
                  placeholder="Bank/E-Wallet" 
                  style={{ flex: 1 }} 
                />
                <input 
                  type="text" 
                  value={member.bank_account}
                  onChange={(e) => handleMemberChange(index, 'bank_account', e.target.value)}
                  className="form-control" 
                  placeholder="No Rekening (Opsional)" 
                  style={{ flex: 1 }} 
                />
                {members.length > 1 && (
                  <button onClick={() => removeMember(index)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    <Trash2 size={16} /> Hapus
                  </button>
                )}
              </div>
            ))}
            <button onClick={addMember} className="btn btn-secondary mt-2" style={{ fontSize: '0.875rem' }}>
              <UserPlus size={16} /> Tambah Anggota
            </button>
          </div>

          <button onClick={createActivity} className="btn btn-primary btn-block mt-4" disabled={isLoading}>
            {!isLoading && <PlusCircle size={20} />}
            {isLoading ? 'Membuat...' : 'Buat Kegiatan & Generate Link'}
          </button>

          {generatedLink && (
            <div className="link-result mt-4" style={{ backgroundColor: '#F0FDF4', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid #BBF7D0' }}>
              <label className="form-label" style={{ color: 'var(--secondary)' }}>Sukses! Bagikan link ini ke peserta:</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="form-control" 
                  style={{ background: 'var(--background)', color: 'var(--primary)', fontWeight: '600' }} 
                />
                <button onClick={copyLink} className="btn btn-primary">
                  <Copy size={20} /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
