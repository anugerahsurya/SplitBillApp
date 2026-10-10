import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Download,
  Layers,
  LayoutList,
  Link2,
  LogIn,
  Pencil,
  PlusCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { buildLedger, recapFor } from '../lib/split.js';
import { formatDate, formatRupiah } from '../lib/money.js';
import { copyText } from '../lib/clipboard.js';
import {
  canvasToBlob,
  downloadCanvas,
  renderReceipt,
  safeFileName,
  stackCanvases,
  waitForFonts,
} from '../lib/receipt.js';
import { useToast } from '../components/Toaster';
import { useConfirm } from '../components/Confirm';
import { Sheet } from '../components/Sheet';
import { Empty, Segmented, Skeleton } from '../components/ui';

const ADMIN_PASSWORD = import.meta.env?.VITE_ADMIN_PASSWORD || 'anugerahsurya';
const SESSION_KEY = 'splitbill-admin';

const TABS = [
  { value: 'dashboard', label: 'Kegiatan', icon: <LayoutList size={14} /> },
  { value: 'create', label: 'Buat Baru', icon: <PlusCircle size={14} /> },
];

const emptyMember = () => ({ name: '', bank_name: '', bank_account: '' });

export default function AdminView() {
  const toast = useToast();
  const confirm = useConfirm();

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [tab, setTab] = useState('dashboard');
  const [activities, setActivities] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [openMembersFor, setOpenMembersFor] = useState(null);
  const [memberCache, setMemberCache] = useState({});
  const [draftMember, setDraftMember] = useState(emptyMember());
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState([emptyMember()]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState('');

  const [exportState, setExportState] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportUrls = useRef([]);

  const fetchActivities = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await api.getAllActivities();
      setActivities(res.data ?? []);
    } catch (err) {
      toast(`Gagal memuat kegiatan: ${err.message}`, 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isLoggedIn) fetchActivities();
  }, [isLoggedIn, fetchActivities]);

  useEffect(
    () => () => {
      exportUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const login = () => {
    if (password !== ADMIN_PASSWORD) {
      setLoginError(true);
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* mode privat: login berlaku sampai halaman ditutup */
    }
    setIsLoggedIn(true);
    setLoginError(false);
    setPassword('');
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* abaikan */
    }
    setIsLoggedIn(false);
  };

  // ── Kegiatan ──
  const saveRename = async () => {
    const name = renameValue.trim();
    if (!name) return toast('Nama kegiatan tidak boleh kosong.', 'error');

    setBusyId(renamingId);
    try {
      await api.editActivity(renamingId, name);
      setActivities((prev) => prev.map((a) => (a.id === renamingId ? { ...a, name } : a)));
      setRenamingId(null);
      toast('Nama kegiatan diperbarui.');
    } catch (err) {
      toast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const finishActivity = async (act) => {
    const ok = await confirm({
      title: 'Tandai selesai?',
      message: `Peserta tidak bisa lagi menambah pengeluaran di "${act.name}". Tagihan yang sudah ada tetap bisa dilihat.`,
      confirmText: 'Tandai selesai',
      tone: 'warn',
    });
    if (!ok) return;

    setBusyId(act.id);
    try {
      await api.finishActivity(act.id);
      setActivities((prev) => prev.map((a) => (a.id === act.id ? { ...a, status: 'finished' } : a)));
      toast('Kegiatan ditandai selesai.');
    } catch (err) {
      toast(`Gagal menandai: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeActivity = async (act) => {
    const ok = await confirm({
      title: 'Hapus kegiatan?',
      message: `"${act.name}" beserta seluruh anggota dan pengeluarannya akan hilang permanen.`,
      confirmText: 'Hapus permanen',
    });
    if (!ok) return;

    setBusyId(act.id);
    try {
      await api.deleteActivity(act.id);
      setActivities((prev) => prev.filter((a) => a.id !== act.id));
      toast('Kegiatan dihapus.');
    } catch (err) {
      toast(`Gagal menghapus: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const shareLink = (id) => `${window.location.origin}/?id=${id}`;

  const copyShareLink = async (id) => {
    const ok = await copyText(shareLink(id));
    toast(ok ? 'Link disalin.' : 'Tidak bisa menyalin otomatis.', ok ? 'success' : 'error');
  };

  // ── Anggota ──
  const toggleMembers = async (activityId) => {
    if (openMembersFor === activityId) {
      setOpenMembersFor(null);
      return;
    }
    setOpenMembersFor(activityId);
    setDraftMember(emptyMember());

    // Sudah pernah dibuka? Pakai yang tersimpan, jangan panggil server lagi.
    if (memberCache[activityId]) return;

    setIsLoadingMembers(true);
    try {
      const res = await api.getActivity(activityId);
      setMemberCache((prev) => ({ ...prev, [activityId]: res.data.members ?? [] }));
    } catch (err) {
      toast(`Gagal memuat anggota: ${err.message}`, 'error');
      setOpenMembersFor(null);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const patchMember = (activityId, index, field, value) =>
    setMemberCache((prev) => ({
      ...prev,
      [activityId]: prev[activityId].map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    }));

  const saveMember = async (member) => {
    if (!member.name?.trim()) return toast('Nama anggota tidak boleh kosong.', 'error');
    setBusyId(member.id);
    try {
      await api.editMember({
        member_id: member.id,
        name: member.name,
        bank_name: member.bank_name,
        bank_account: member.bank_account,
      });
      toast(`Data ${member.name} disimpan.`);
    } catch (err) {
      toast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (activityId, member) => {
    const ok = await confirm({
      title: `Hapus ${member.name}?`,
      message:
        'Pengeluaran yang sudah mencantumkan orang ini akan dibagi ulang ke peserta yang tersisa, jadi tagihan tetap seimbang.',
      confirmText: 'Hapus anggota',
    });
    if (!ok) return;

    setBusyId(member.id);
    try {
      await api.deleteMember(member.id);
      setMemberCache((prev) => ({
        ...prev,
        [activityId]: prev[activityId].filter((m) => m.id !== member.id),
      }));
      toast('Anggota dihapus.');
    } catch (err) {
      toast(`Gagal menghapus: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const addMember = async (activityId) => {
    if (!draftMember.name.trim()) return;
    setBusyId(`add-${activityId}`);
    try {
      const res = await api.addMember({ activity_id: activityId, ...draftMember });
      setMemberCache((prev) => ({
        ...prev,
        [activityId]: [...(prev[activityId] ?? []), { id: res.id, activity_id: activityId, ...draftMember }],
      }));
      setDraftMember(emptyMember());
      toast('Anggota ditambahkan.');
    } catch (err) {
      toast(`Gagal menambah: ${err.message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ── Buat kegiatan ──
  const filledMembers = useMemo(() => newMembers.filter((m) => m.name.trim()), [newMembers]);

  const createActivity = async () => {
    if (!newName.trim()) return toast('Nama kegiatan belum diisi.', 'error');
    if (filledMembers.length < 2) return toast('Minimal dua anggota supaya ada yang dibagi.', 'error');

    setIsCreating(true);
    try {
      const res = await api.createActivity({ name: newName.trim(), members: filledMembers });
      setCreatedLink(shareLink(res.id));
      setNewName('');
      setNewMembers([emptyMember()]);
      await fetchActivities();
      toast('Kegiatan dibuat.');
    } catch (err) {
      toast(`Gagal membuat kegiatan: ${err.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Export ──
  const openExport = async (act) => {
    setIsExporting(true);
    setBusyId(act.id);
    try {
      const res = await api.getActivity(act.id);
      const members = res.data.members ?? [];
      if (members.length === 0) {
        toast('Kegiatan ini belum punya anggota.', 'error');
        return;
      }

      await waitForFonts();
      const ledger = buildLedger(members, res.data.transactions ?? []);

      exportUrls.current.forEach((url) => URL.revokeObjectURL(url));
      exportUrls.current = [];

      const sheets = [];
      for (const member of members) {
        const recap = recapFor(ledger, member.id);
        if (!recap) continue;

        const canvas = renderReceipt({
          activityName: act.name,
          memberName: member.name,
          items: recap.items,
          total: recap.total,
          paid: recap.paid,
          net: recap.net,
          transfersOut: recap.outgoing,
          transfersIn: recap.incoming,
        });

        const blob = await canvasToBlob(canvas);
        const url = blob ? URL.createObjectURL(blob) : '';
        if (url) exportUrls.current.push(url);
        sheets.push({ name: member.name, total: recap.total, canvas, url });
      }

      setExportState({ activity: act, sheets, total: ledger.total });
    } catch (err) {
      toast(`Gagal menyiapkan export: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
      setBusyId(null);
    }
  };

  const closeExport = () => {
    exportUrls.current.forEach((url) => URL.revokeObjectURL(url));
    exportUrls.current = [];
    setExportState(null);
  };

  const downloadOne = (sheet) =>
    downloadCanvas(sheet.canvas, `${safeFileName('rincian', sheet.name, exportState.activity.name)}.png`);

  /** Satu gambar panjang berisi semua orang. Mengunduh belasan file sekaligus
   *  akan diblokir browser setelah file kedua, jadi ini jalan yang aman. */
  const downloadCombined = async () => {
    if (!exportState) return;
    setIsExporting(true);
    try {
      const combined = stackCanvases(exportState.sheets.map((s) => s.canvas));
      if (combined) {
        await downloadCanvas(combined, `${safeFileName('rincian_semua', exportState.activity.name)}.png`);
        toast('Gambar gabungan tersimpan.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const downloadEach = async () => {
    if (!exportState) return;
    setIsExporting(true);
    try {
      for (const sheet of exportState.sheets) {
        await downloadOne(sheet);
        await new Promise((r) => setTimeout(r, 450));
      }
      toast(`${exportState.sheets.length} gambar diunduh.`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Login ──
  if (!isLoggedIn) {
    return (
      <>
        <div className="card pop" style={{ maxWidth: 400, margin: '2rem auto 0' }}>
          <div className="center" style={{ marginBottom: '1.25rem' }}>
            <div className="empty__icon" style={{ color: 'var(--brand-600)' }}>
              <ShieldCheck size={22} />
            </div>
            <h1 className="title">Area Admin</h1>
            <p className="subtitle">Masuk untuk mengelola kegiatan.</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="pwd">
              Password
            </label>
            <input
              id="pwd"
              type="password"
              className="input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLoginError(false);
              }}
              onKeyUp={(e) => e.key === 'Enter' && login()}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {loginError && <p className="hint" style={{ color: 'var(--bad-text)' }}>Password salah.</p>}
          </div>

          <button type="button" className="btn btn--primary btn--block btn--lg" style={{ marginTop: '1rem' }} onClick={login}>
            <LogIn size={17} /> Masuk
          </button>
        </div>
        <div className="footer">
          <Link to="/" className="admin-link">
            ← Kembali
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="card rise" style={{ '--i': 0 }}>
        <div className="cluster">
          <div className="grow">
            <p className="eyebrow">Admin</p>
            <h1 className="title">Kelola kegiatan</h1>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
            Keluar
          </button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Segmented options={TABS} value={tab} onChange={setTab} brand label="Bagian admin" />
        </div>
      </div>

      {tab === 'dashboard' && (
        <div className="card rise" style={{ '--i': 1 }}>
          <div className="card__head">
            <div>
              <h2 className="title">Daftar kegiatan</h2>
              <p className="subtitle">{activities.length} kegiatan tersimpan</p>
            </div>
            <button type="button" className="btn btn--soft btn--sm" onClick={fetchActivities} disabled={isLoadingList}>
              <RefreshCw size={14} className={isLoadingList ? 'spin' : undefined} /> Segarkan
            </button>
          </div>

          {isLoadingList ? (
            <div className="stack">
              <Skeleton h={96} r={12} />
              <Skeleton h={96} r={12} />
            </div>
          ) : activities.length === 0 ? (
            <Empty icon={<LayoutList size={20} />} title="Belum ada kegiatan">
              Buat kegiatan pertama di tab “Buat Baru”.
            </Empty>
          ) : (
            <div className="rows">
              {activities.map((act, i) => {
                const isOpen = openMembersFor === act.id;
                const members = memberCache[act.id] ?? [];
                const busy = busyId === act.id;

                return (
                  <div key={act.id} className="tx rise" style={{ '--i': Math.min(i, 6) }}>
                    <div className="cluster" style={{ alignItems: 'flex-start' }}>
                      <div className="grow" style={{ minWidth: 0 }}>
                        {renamingId === act.id ? (
                          <div className="cluster">
                            <input
                              className="input grow"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyUp={(e) => e.key === 'Enter' && saveRename()}
                              autoFocus
                            />
                            <button type="button" className="btn btn--primary btn--sm" onClick={saveRename} disabled={busy}>
                              <Save size={14} /> Simpan
                            </button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRenamingId(null)}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <p className="tx__label">{act.name}</p>
                        )}
                        <p className="tx__sub">{formatDate(act.created_at)}</p>
                        <div className="chips" style={{ marginTop: '0.4rem' }}>
                          <span className={`badge badge--dot ${act.status === 'active' ? 'badge--ok' : ''}`}>
                            {act.status === 'active' ? 'Aktif' : 'Selesai'}
                          </span>
                          {isOpen && members.length > 0 && (
                            <span className="badge">
                              <Users size={11} /> {members.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="tx__foot">
                      <button type="button" className="btn btn--soft btn--sm" onClick={() => copyShareLink(act.id)}>
                        <Link2 size={14} /> Link
                      </button>
                      <button
                        type="button"
                        className="btn btn--soft btn--sm"
                        onClick={() => openExport(act)}
                        disabled={busy && isExporting}
                      >
                        {busy && isExporting ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
                        Export
                      </button>
                      <button type="button" className="btn btn--soft btn--sm" onClick={() => toggleMembers(act.id)}>
                        <Users size={14} /> Anggota
                      </button>
                      {renamingId !== act.id && (
                        <button
                          type="button"
                          className="btn btn--soft btn--sm"
                          onClick={() => {
                            setRenamingId(act.id);
                            setRenameValue(act.name);
                          }}
                        >
                          <Pencil size={14} /> Nama
                        </button>
                      )}
                      {act.status === 'active' && (
                        <button type="button" className="btn btn--soft btn--sm" onClick={() => finishActivity(act)} disabled={busy}>
                          <CheckCircle2 size={14} /> Selesai
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => removeActivity(act)}
                        disabled={busy}
                        aria-label={`Hapus ${act.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Panel anggota: tingginya di-animasi lewat grid-template-rows */}
                    <div className="collapse" data-open={isOpen}>
                      <div className="collapse__inner">
                        <div
                          style={{
                            marginTop: '0.85rem',
                            paddingTop: '0.85rem',
                            borderTop: '1px dashed var(--line-strong)',
                          }}
                        >
                          {isLoadingMembers && isOpen ? (
                            <Skeleton h={44} r={10} />
                          ) : (
                            <div className="stack stack--sm">
                              {members.map((member, index) => (
                                <div key={member.id} className="inline-rows">
                                  <input
                                    className="input grow"
                                    value={member.name ?? ''}
                                    onChange={(e) => patchMember(act.id, index, 'name', e.target.value)}
                                    placeholder="Nama"
                                    aria-label="Nama anggota"
                                  />
                                  <input
                                    className="input grow"
                                    value={member.bank_name ?? ''}
                                    onChange={(e) => patchMember(act.id, index, 'bank_name', e.target.value)}
                                    placeholder="Bank / e-wallet"
                                    aria-label="Bank"
                                  />
                                  <input
                                    className="input grow"
                                    value={member.bank_account ?? ''}
                                    onChange={(e) => patchMember(act.id, index, 'bank_account', e.target.value)}
                                    placeholder="No. rekening"
                                    inputMode="numeric"
                                    aria-label="Nomor rekening"
                                  />
                                  <div className="cluster">
                                    <button
                                      type="button"
                                      className="btn btn--primary btn--sm"
                                      onClick={() => saveMember(member)}
                                      disabled={busyId === member.id}
                                      aria-label={`Simpan ${member.name}`}
                                    >
                                      <Save size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--danger btn--sm"
                                      onClick={() => removeMember(act.id, member)}
                                      disabled={busyId === member.id}
                                      aria-label={`Hapus ${member.name}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              <div className="inline-rows" style={{ borderStyle: 'dashed' }}>
                                <input
                                  className="input grow"
                                  value={draftMember.name}
                                  onChange={(e) => setDraftMember({ ...draftMember, name: e.target.value })}
                                  placeholder="Nama baru"
                                  aria-label="Nama anggota baru"
                                />
                                <input
                                  className="input grow"
                                  value={draftMember.bank_name}
                                  onChange={(e) => setDraftMember({ ...draftMember, bank_name: e.target.value })}
                                  placeholder="Bank / e-wallet"
                                  aria-label="Bank anggota baru"
                                />
                                <input
                                  className="input grow"
                                  value={draftMember.bank_account}
                                  onChange={(e) => setDraftMember({ ...draftMember, bank_account: e.target.value })}
                                  placeholder="No. rekening"
                                  inputMode="numeric"
                                  aria-label="Rekening anggota baru"
                                />
                                <button
                                  type="button"
                                  className="btn btn--primary btn--sm"
                                  onClick={() => addMember(act.id)}
                                  disabled={!draftMember.name.trim() || busyId === `add-${act.id}`}
                                >
                                  <UserPlus size={14} /> Tambah
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="card rise" style={{ '--i': 1 }}>
          <div className="card__head">
            <div>
              <h2 className="title">Kegiatan baru</h2>
              <p className="subtitle">Nomor rekening boleh diisi nanti lewat menu Anggota.</p>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="act-name">
              Nama kegiatan
            </label>
            <input
              id="act-name"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Trip Bromo, Makan Siang Tim…"
            />
          </div>

          <div className="field" style={{ marginTop: '1.15rem' }}>
            <div className="cluster">
              <label className="label grow">Anggota</label>
              <span className="badge">{filledMembers.length} terisi</span>
            </div>

            <div className="stack stack--sm">
              {newMembers.map((member, index) => (
                <div key={index} className="inline-rows">
                  <input
                    className="input grow"
                    value={member.name}
                    onChange={(e) =>
                      setNewMembers((prev) => prev.map((m, i) => (i === index ? { ...m, name: e.target.value } : m)))
                    }
                    placeholder={`Nama anggota ${index + 1}`}
                    aria-label={`Nama anggota ${index + 1}`}
                  />
                  <input
                    className="input grow"
                    value={member.bank_name}
                    onChange={(e) =>
                      setNewMembers((prev) =>
                        prev.map((m, i) => (i === index ? { ...m, bank_name: e.target.value } : m)),
                      )
                    }
                    placeholder="Bank / e-wallet"
                    aria-label="Bank"
                  />
                  <input
                    className="input grow"
                    value={member.bank_account}
                    onChange={(e) =>
                      setNewMembers((prev) =>
                        prev.map((m, i) => (i === index ? { ...m, bank_account: e.target.value } : m)),
                      )
                    }
                    placeholder="No. rekening"
                    inputMode="numeric"
                    aria-label="Nomor rekening"
                  />
                  {newMembers.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setNewMembers((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Hapus baris ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn--soft btn--sm"
              style={{ marginTop: '0.6rem', alignSelf: 'flex-start' }}
              onClick={() => setNewMembers((prev) => [...prev, emptyMember()])}
            >
              <UserPlus size={14} /> Tambah baris
            </button>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            style={{ marginTop: '1.25rem' }}
            onClick={createActivity}
            disabled={isCreating}
          >
            {isCreating ? <RefreshCw size={17} className="spin" /> : <PlusCircle size={17} />}
            {isCreating ? 'Membuat…' : 'Buat & ambil link'}
          </button>

          {createdLink && (
            <div className="notice notice--ok pop" style={{ marginTop: '1rem', flexDirection: 'column' }}>
              <strong>Siap dibagikan</strong>
              <div className="cluster" style={{ width: '100%', marginTop: '0.4rem' }}>
                <input className="input grow mono" readOnly value={createdLink} onFocus={(e) => e.target.select()} />
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    const ok = await copyText(createdLink);
                    toast(ok ? 'Link disalin.' : 'Tidak bisa menyalin otomatis.', ok ? 'success' : 'error');
                  }}
                >
                  <Copy size={14} /> Salin
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="footer">
        <Link to="/" className="admin-link">
          ← Lihat sebagai peserta
        </Link>
      </div>

      {/* ── Pratinjau export ── */}
      <Sheet
        open={Boolean(exportState)}
        onClose={closeExport}
        wide
        title="Rincian per anggota"
        description={
          exportState
            ? `${exportState.sheets.length} gambar dari "${exportState.activity.name}" · total ${formatRupiah(
                exportState.total,
              )}`
            : ''
        }
        actions={
          <>
            <button type="button" className="btn btn--soft" onClick={downloadCombined} disabled={isExporting}>
              <Layers size={16} /> Jadi 1 gambar
            </button>
            <button type="button" className="btn btn--primary" onClick={downloadEach} disabled={isExporting}>
              {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
              Unduh semua
            </button>
          </>
        }
      >
        {exportState && (
          <>
            <div className="preview-grid">
              {exportState.sheets.map((sheet, i) => (
                <div key={sheet.name + i} className="preview-card pop" style={{ animationDelay: `${i * 35}ms` }}>
                  {sheet.url && <img src={sheet.url} alt={`Rincian ${sheet.name}`} loading="lazy" />}
                  <div className="preview-card__foot">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <p className="truncate" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                        {sheet.name}
                      </p>
                      <p className="hint num">{formatRupiah(sheet.total)}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn--soft btn--sm"
                      onClick={() => downloadOne(sheet)}
                      aria-label={`Unduh rincian ${sheet.name}`}
                    >
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: '0.85rem' }}>
              Browser memblokir unduhan beruntun setelah file kedua, jadi “Jadi 1 gambar” lebih aman kalau anggotanya
              banyak.
            </p>
          </>
        )}
      </Sheet>
    </>
  );
}
