import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  Copy,
  Download,
  Eraser,
  FileSpreadsheet,
  Image as ImageIcon,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import {
  activityReportFor,
  buildLedger,
  formatActivityReportText,
  parseInvolved,
  recapFor,
} from '../lib/split.js';
import { formatDate, formatRupiah, splitEvenly } from '../lib/money.js';
import { copyText } from '../lib/clipboard.js';
import {
  downloadCanvas,
  renderActivityReport,
  renderReceipt,
  safeFileName,
  waitForFonts,
} from '../lib/receipt.js';
import { useToast } from '../components/Toaster';
import { useConfirm } from '../components/Confirm';
import { Sheet } from '../components/Sheet';
import { AnimatedRupiah, Empty, MoneyInput, Segmented, Skeleton } from '../components/ui';

const VISIBLE_STEP = 8;

const MODES = [
  { value: 'simple', label: 'Bagi Rata', icon: <Users size={14} /> },
  { value: 'advanced', label: 'Per Orang', icon: <PieChart size={14} /> },
];

export default function UserView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get('id');

  const [activity, setActivity] = useState(null);
  const [rawMembers, setRawMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [mode, setMode] = useState('simple');
  const [itemName, setItemName] = useState('');
  const [paidById, setPaidById] = useState('');
  const [amount, setAmount] = useState(0);
  const [involved, setInvolved] = useState([]);
  const [perPerson, setPerPerson] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState('');
  const [recapId, setRecapId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const formRef = useRef(null);

  // Id dari spreadsheet bisa datang sebagai angka atau teks; disamakan sekali
  // di sini supaya seluruh perbandingan di bawah tidak perlu berhati-hati lagi.
  const members = useMemo(
    () => rawMembers.map((m) => ({ ...m, id: String(m.id) })),
    [rawMembers],
  );

  const load = useCallback(
    async (signal, { silent = false } = {}) => {
      if (!activityId) {
        setStatus('ready');
        return;
      }
      if (silent) setIsRefreshing(true);

      try {
        const res = await api.getActivity(activityId, signal);
        setActivity(res.data.activity);
        setRawMembers(res.data.members ?? []);
        setTransactions(res.data.transactions ?? []);
        setStatus('ready');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setErrorMsg(
          err.message === 'Activity not found'
            ? 'Kegiatan tidak ditemukan. Coba minta ulang link-nya.'
            : 'Gagal memuat data. Periksa koneksi, lalu coba lagi.',
        );
        setStatus('error');
      } finally {
        setIsRefreshing(false);
      }
    },
    [activityId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const ledger = useMemo(() => buildLedger(members, transactions), [members, transactions]);
  const recap = useMemo(() => (recapId ? recapFor(ledger, recapId) : null), [ledger, recapId]);
  const activityReport = useMemo(() => activityReportFor(ledger, activity), [ledger, activity]);

  const isActive = activity?.status === 'active';
  const locked = !isActive && !editingId;

  const advancedTotal = useMemo(
    () => Object.values(perPerson).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [perPerson],
  );
  const advancedCount = useMemo(
    () => Object.values(perPerson).filter((v) => Number(v) > 0).length,
    [perPerson],
  );

  const preview = useMemo(() => {
    if (mode === 'advanced' || !amount || involved.length === 0) return null;
    const shares = splitEvenly(amount, involved.length);
    const min = Math.min(...shares);
    const max = Math.max(...shares);
    return min === max ? formatRupiah(min) : `${formatRupiah(min)}–${formatRupiah(max)}`;
  }, [mode, amount, involved.length]);

  // ── Form ──
  const resetForm = useCallback(() => {
    setEditingId(null);
    setItemName('');
    setPaidById('');
    setAmount(0);
    setInvolved([]);
    setPerPerson({});
  }, []);

  const toggleInvolved = (id) =>
    setInvolved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startEdit = (row) => {
    setEditingId(row.id);
    setMode('simple');
    setItemName(row.label === 'Pengeluaran' ? '' : row.label);
    setPaidById(row.payerId);
    setAmount(row.amount);
    // parseInvolved sekaligus membersihkan spasi — tanpa itu id seperti " ab12"
    // tidak cocok dengan daftar anggota dan centangnya gagal muncul.
    setInvolved(parseInvolved(row.raw.involved_member_ids).filter((id) => members.some((m) => m.id === id)));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async () => {
    if (mode === 'advanced' && !editingId) return submitPerPerson();

    if (!paidById) return toast('Pilih dulu siapa yang bayar.', 'error');
    if (!amount) return toast('Nominalnya belum diisi.', 'error');
    if (involved.length === 0) return toast('Pilih minimal satu orang yang ikut patungan.', 'error');

    setIsSaving(true);
    const payload = {
      paid_by_member_id: paidById,
      amount,
      item_name: itemName.trim(),
      involved_member_ids: involved,
    };

    try {
      if (editingId) {
        await api.editTransaction({ transaction_id: editingId, ...payload });
        // Tempel hasilnya langsung ke state alih-alih memuat ulang semuanya:
        // satu panggilan Apps Script lebih sedikit, dan angka di layar
        // ikut berubah seketika.
        setTransactions((prev) =>
          prev.map((t) =>
            String(t.id) === String(editingId)
              ? {
                  ...t,
                  paid_by_member_id: paidById,
                  amount,
                  item_name: payload.item_name || '-',
                  involved_member_ids: involved.join(','),
                }
              : t,
          ),
        );
        toast('Pengeluaran diperbarui.');
      } else {
        const res = await api.addTransaction({ activity_id: activityId, ...payload });
        setTransactions((prev) => [
          {
            id: res.id,
            activity_id: activityId,
            paid_by_member_id: paidById,
            amount,
            item_name: payload.item_name || '-',
            involved_member_ids: involved.join(','),
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast('Pengeluaran tercatat.');
      }
      resetForm();
    } catch (err) {
      toast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const submitPerPerson = async () => {
    if (!paidById) return toast('Pilih dulu siapa yang bayar.', 'error');

    const items = Object.entries(perPerson)
      .filter(([, v]) => Number(v) > 0)
      .map(([memberId, value]) => {
        const name = members.find((m) => m.id === memberId)?.name ?? '';
        const label = itemName.trim() ? `${itemName.trim()} — ${name}` : name || 'Pengeluaran';
        return {
          paid_by_member_id: paidById,
          amount: Number(value),
          item_name: label,
          involved_member_ids: [memberId],
        };
      });

    if (items.length === 0) return toast('Isi nominal untuk minimal satu orang.', 'error');

    setIsSaving(true);
    try {
      const res = await api.addTransactions(activityId, items);
      const createdAt = new Date().toISOString();
      setTransactions((prev) => [
        ...items.map((item, i) => ({
          id: res.ids[i],
          activity_id: activityId,
          paid_by_member_id: item.paid_by_member_id,
          amount: item.amount,
          item_name: item.item_name,
          involved_member_ids: item.involved_member_ids.join(','),
          created_at: createdAt,
        })),
        ...prev,
      ]);
      resetForm();
      toast(`${items.length} pengeluaran tercatat.`);
    } catch (err) {
      toast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Hapus pengeluaran?',
      message: `"${row.label}" sebesar ${formatRupiah(row.amount)} akan dihapus dan tagihan dihitung ulang.`,
      confirmText: 'Hapus',
    });
    if (!ok) return;

    try {
      await api.deleteTransaction(row.id);
      setTransactions((prev) => prev.filter((t) => String(t.id) !== String(row.id)));
      if (editingId === row.id) resetForm();
      toast('Pengeluaran dihapus.');
    } catch (err) {
      toast(`Gagal menghapus: ${err.message}`, 'error');
    }
  };

  const copyAccount = async (account) => {
    const ok = await copyText(account);
    toast(ok ? 'Nomor rekening disalin.' : 'Tidak bisa menyalin otomatis, salin manual ya.', ok ? 'success' : 'error');
  };

  const downloadRecap = async () => {
    if (!recap) return;
    setIsExporting(true);
    try {
      await waitForFonts();
      const canvas = renderReceipt({
        activityName: activity?.name,
        memberName: recap.member.name,
        items: recap.items,
        total: recap.total,
        paid: recap.paid,
        net: recap.net,
        transfersOut: recap.outgoing,
        transfersIn: recap.incoming,
      });
      await downloadCanvas(canvas, `${safeFileName('rincian', recap.member.name, activity?.name)}.png`);
      toast('Gambar rincian tersimpan.');
    } catch {
      toast('Gagal membuat gambar.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadActivityReport = async () => {
    setIsExporting(true);
    try {
      await waitForFonts();
      const canvas = renderActivityReport({
        activityName: activity?.name,
        ledger,
      });
      await downloadCanvas(canvas, `${safeFileName('laporan_kegiatan', activity?.name)}.png`);
      toast('Gambar laporan kegiatan tersimpan.');
    } catch {
      toast('Gagal membuat gambar laporan.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const copyActivityReport = async () => {
    const text = formatActivityReportText(ledger, activity, formatRupiah);
    const ok = await copyText(text);
    toast(
      ok ? 'Teks laporan kegiatan disalin.' : 'Tidak bisa menyalin otomatis.',
      ok ? 'success' : 'error',
    );
  };

  // ── Tampilan khusus ──
  if (!activityId && status !== 'loading') {
    return (
      <>
        <div className="card center pop" style={{ padding: '2.5rem 1.5rem' }}>
          <div className="empty__icon" style={{ width: 56, height: 56, marginBottom: '1rem' }}>
            <Receipt size={26} />
          </div>
          <h1 className="title--xl">Bagi tagihan tanpa drama</h1>
          <p className="subtitle" style={{ maxWidth: 420, margin: '0.6rem auto 1.5rem' }}>
            Minta link kegiatan dari temanmu untuk melihat dan mencatat tagihan, atau buat kegiatan baru dari area
            admin.
          </p>
          <Link to="/admin" className="btn btn--primary btn--lg">
            Buka Area Admin <ArrowRight size={17} />
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  if (status === 'loading') {
    return (
      <>
        <div className="card stack">
          <Skeleton h={26} w="55%" />
          <Skeleton h={14} w="35%" />
        </div>
        <div className="stats">
          <Skeleton h={96} r={16} />
          <Skeleton h={96} r={16} />
        </div>
        <div className="split">
          <Skeleton h={320} r={16} />
          <Skeleton h={320} r={16} />
        </div>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <div className="card center pop">
          <div className="empty__icon" style={{ color: 'var(--bad-text)' }}>
            <AlertTriangle size={22} />
          </div>
          <h1 className="title">Tidak bisa dibuka</h1>
          <p className="subtitle" style={{ margin: '0.4rem 0 1.25rem' }}>
            {errorMsg}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => load(undefined)}>
            <RefreshCw size={16} /> Coba lagi
          </button>
        </div>
        <Footer />
      </>
    );
  }

  const rows = ledger.rows;
  const shownRows = rows.slice(0, visibleCount);
  const maxShare = ledger.ranking[0]?.share || 1;

  return (
    <>
      {/* ── Kepala kegiatan ── */}
      <div className="card rise" style={{ '--i': 0 }}>
        <div className="cluster">
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="eyebrow">Kegiatan</p>
            <h1 className="title--xl" style={{ marginTop: '0.1rem' }}>
              {activity?.name}
            </h1>
            <p className="subtitle" style={{ marginTop: '0.3rem' }}>
              {members.length} anggota · dibuat {formatDate(activity?.created_at)}
            </p>
          </div>
          <div className="stack stack--sm" style={{ alignItems: 'flex-end' }}>
            <span className={`badge badge--dot ${isActive ? 'badge--ok' : 'badge'}`}>
              {isActive ? 'Aktif' : 'Selesai'}
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => load(undefined, { silent: true })}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : undefined} />
              Segarkan
            </button>
          </div>
        </div>
      </div>

      {/* ── Ringkasan ── */}
      <div className="stats rise" style={{ '--i': 1 }}>
        <div className="stat stat--brand">
          <p className="stat__label">Total pengeluaran</p>
          <AnimatedRupiah value={ledger.total} className="stat__value" />
          <p className="stat__meta">{rows.length} catatan</p>
        </div>
        <div className="stat stat--ok">
          <p className="stat__label">Paling banyak nalangi</p>
          {ledger.topPayer?.paid > 0 ? (
            <>
              <p className="stat__value stat__value--sm">{ledger.topPayer.name}</p>
              <p className="stat__meta">{formatRupiah(ledger.topPayer.paid)}</p>
            </>
          ) : (
            <p className="stat__value stat__value--sm">Belum ada</p>
          )}
        </div>
      </div>

      {ledger.warnings.removedMemberRefs > 0 && (
        <div className="notice notice--warn rise" style={{ '--i': 2 }}>
          <AlertTriangle size={16} />
          <span>
            Ada {ledger.warnings.removedMemberRefs} pengeluaran yang menyebut anggota yang sudah dihapus. Porsinya
            dibagi ulang ke peserta yang masih ada supaya tagihan tetap seimbang.
          </span>
        </div>
      )}

      {/* ── Form + tagihan ── */}
      <div className="split">
        <div
          ref={formRef}
          className={`card${editingId ? ' card--accent' : ''} rise`}
          style={{ '--i': 2 }}
        >
          <div className="card__head">
            <div>
              <h2 className="title">{editingId ? 'Edit pengeluaran' : 'Catat pengeluaran'}</h2>
              <p className="subtitle">
                {editingId ? 'Perubahan langsung memengaruhi tagihan.' : 'Satu catatan untuk satu kali bayar.'}
              </p>
            </div>
            {editingId && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={resetForm}>
                <X size={15} /> Batal
              </button>
            )}
          </div>

          {!editingId && (
            <div style={{ marginBottom: '1rem' }}>
              <Segmented options={MODES} value={mode} onChange={setMode} brand label="Cara membagi" />
            </div>
          )}

          <div className="stack">
            <div className="field">
              <label className="label" htmlFor="item">
                Untuk apa? <span className="muted">(opsional)</span>
              </label>
              <input
                id="item"
                className="input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Tiket masuk, makan siang, bensin…"
                disabled={locked}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="payer">
                Siapa yang bayar?
              </label>
              <select
                id="payer"
                className="select"
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                disabled={locked}
              >
                <option value="">Pilih anggota…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {(mode === 'simple' || editingId) && (
              <>
                <div className="field">
                  <label className="label" htmlFor="amount">
                    Totalnya berapa?
                  </label>
                  <MoneyInput id="amount" value={amount} onChange={setAmount} disabled={locked} />
                </div>

                <div className="field">
                  <div className="cluster">
                    <label className="label grow">Siapa saja yang ikut?</label>
                    <span className="badge">
                      {involved.length}/{members.length}
                    </span>
                  </div>
                  <div className="cluster">
                    <button
                      type="button"
                      className="btn btn--soft btn--sm"
                      onClick={() => setInvolved(members.map((m) => m.id))}
                      disabled={locked}
                    >
                      <CheckCheck size={14} /> Semua
                    </button>
                    <button
                      type="button"
                      className="btn btn--soft btn--sm"
                      onClick={() => setInvolved([])}
                      disabled={locked}
                    >
                      <Eraser size={14} /> Bersihkan
                    </button>
                  </div>
                  <div className="people-grid">
                    {members.map((m) => (
                      <label key={m.id} className="switch">
                        <input
                          type="checkbox"
                          checked={involved.includes(m.id)}
                          onChange={() => toggleInvolved(m.id)}
                          disabled={locked}
                        />
                        <span className="switch__track" />
                        <span className="switch__label">{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {preview && (
                  <div className="summary-line pop">
                    <span>Per orang</span>
                    <span className="num">{preview}</span>
                  </div>
                )}
              </>
            )}

            {mode === 'advanced' && !editingId && (
              <div className="field">
                <label className="label">Nominal masing-masing</label>
                <p className="hint" style={{ marginBottom: '0.25rem' }}>
                  Kosongkan kalau orangnya tidak ikut. Tiap nominal dicatat atas nama orang tersebut.
                </p>
                <div className="stack stack--sm">
                  {members.map((m) => (
                    <div key={m.id} className="amount-row">
                      <span className="amount-row__name">{m.name}</span>
                      <MoneyInput
                        value={perPerson[m.id] ?? 0}
                        onChange={(v) => setPerPerson((prev) => ({ ...prev, [m.id]: v }))}
                        disabled={locked}
                        aria-label={`Nominal untuk ${m.name}`}
                      />
                    </div>
                  ))}
                </div>
                {advancedTotal > 0 && (
                  <div className="summary-line pop" style={{ marginTop: '0.75rem' }}>
                    <span>{advancedCount} orang</span>
                    <span className="num">{formatRupiah(advancedTotal)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {locked ? (
            <div className="notice notice--warn" style={{ marginTop: '1.15rem' }}>
              <AlertTriangle size={16} />
              <span>Kegiatan sudah selesai, pengeluaran baru tidak bisa ditambahkan.</span>
            </div>
          ) : (
            <div className="cluster" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn--primary btn--lg grow"
                onClick={submit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RefreshCw size={17} className="spin" />
                ) : editingId ? (
                  <Save size={17} />
                ) : (
                  <Plus size={17} />
                )}
                {isSaving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Catat pengeluaran'}
              </button>
            </div>
          )}
        </div>

        {/* ── Tagihan ── */}
        <div className="split__sticky">
          <div className="card panel--bill rise" style={{ '--i': 3 }}>
            <div className="card__head">
              <div>
                <h2 className="title" style={{ color: '#fff' }}>
                  Siapa bayar ke siapa
                </h2>
                <p style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                  {ledger.settlement.length === 0
                    ? 'Belum ada yang perlu ditransfer'
                    : `${ledger.settlement.length} transfer menuntaskan semuanya`}
                </p>
              </div>
              <Wallet size={20} style={{ opacity: 0.7 }} />
            </div>

            <div className="bill-total">
              <p style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 700, letterSpacing: '0.06em' }}>
                TOTAL KEGIATAN
              </p>
              <AnimatedRupiah value={ledger.total} className="stat__value" />
            </div>

            {ledger.settlement.length === 0 ? (
              <div className="settle-row center" style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                {rows.length === 0 ? 'Catat pengeluaran pertama dulu.' : 'Semua sudah seimbang. 🎉'}
              </div>
            ) : (
              <div className="settle">
                {ledger.settlement.map((t, i) => (
                  <div key={`${t.fromId}-${t.toId}-${i}`} className="settle-row rise" style={{ '--i': i }}>
                    <div className="settle-row__head">
                      <span className="settle-row__who">{t.from}</span>
                      <ArrowRight size={14} style={{ opacity: 0.75 }} />
                      <span className="settle-row__who">{t.to}</span>
                      <span className="settle-row__amount">{formatRupiah(t.amount)}</span>
                    </div>
                    {t.bankAccount ? (
                      <div className="settle-row__bank">
                        <span className="settle-row__account mono">
                          {t.bankName ? `${t.bankName} · ` : ''}
                          {t.bankAccount}
                        </span>
                        <button
                          type="button"
                          className="btn-copy"
                          onClick={() => copyAccount(t.bankAccount)}
                          aria-label={`Salin rekening ${t.to}`}
                          title="Salin nomor rekening"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '0.4rem' }}>
                        {t.to} belum mengisi nomor rekening.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="stack stack--sm" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn--onbrand btn--block"
                onClick={() => setReportOpen(true)}
                disabled={members.length === 0}
              >
                <FileSpreadsheet size={16} /> Laporan per kegiatan
              </button>
              <button
                type="button"
                className="btn btn--onbrand btn--block"
                onClick={() => {
                  setPickerValue(recapId || '');
                  setPickerOpen(true);
                }}
                disabled={members.length === 0}
              >
                <Receipt size={16} /> Lihat rincian per orang
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Riwayat ── */}
      <div className="card rise" style={{ '--i': 4 }}>
        <div className="card__head">
          <div>
            <h2 className="title">Daftar pengeluaran</h2>
            <p className="subtitle">{rows.length} catatan, terbaru di atas</p>
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              className="btn btn--soft btn--sm"
              onClick={() => setReportOpen(true)}
            >
              <FileSpreadsheet size={14} /> Laporan bersama
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <Empty icon={<Receipt size={20} />} title="Belum ada pengeluaran">
            Catatan pertama akan muncul di sini.
          </Empty>
        ) : (
          <>
            <div className="rows">
              {shownRows.map((row, i) => (
                <div
                  key={row.id}
                  className={`tx rise${editingId === row.id ? ' tx--editing' : ''}`}
                  style={{ '--i': Math.min(i, 6) }}
                >
                  <div className="tx__top">
                    <div className="grow">
                      <p className="tx__label">{row.label}</p>
                      <p className="tx__sub">
                        Ditalangi <strong>{row.payerName}</strong> · {formatDate(row.createdAt)}
                      </p>
                    </div>
                    <span className="tx__amount">{formatRupiah(row.amount)}</span>
                  </div>

                  <div className="tx__foot">
                    <div className="chips">
                      {row.participants.map((p) => (
                        <span key={p.id} className="chip">
                          {p.name} · {formatRupiah(p.share)}
                        </span>
                      ))}
                      {row.hasRemovedMembers && (
                        <span className="chip chip--muted">anggota terhapus diabaikan</span>
                      )}
                    </div>

                    {isActive && (
                      <div className="tx__actions">
                        <button
                          type="button"
                          className="btn btn--soft btn--sm"
                          onClick={() => startEdit(row)}
                          aria-label={`Edit ${row.label}`}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => remove(row)}
                          aria-label={`Hapus ${row.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {rows.length > visibleCount && (
              <button
                type="button"
                className="btn btn--soft btn--block"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setVisibleCount((c) => c + VISIBLE_STEP * 2)}
              >
                Tampilkan {Math.min(VISIBLE_STEP * 2, rows.length - visibleCount)} lagi
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Kontributor Kegiatan ── */}
      {activityReport.contributors.length > 0 && (
        <div className="card rise" style={{ '--i': 5 }}>
          <div className="card__head">
            <div>
              <h2 className="title">Kontributor kegiatan</h2>
              <p className="subtitle">Siapa saja yang sudah menalangi pengeluaran bersama</p>
            </div>
            <Wallet size={20} className="muted" />
          </div>
          <div className="rows">
            {activityReport.contributors.map((c, i) => {
              const maxPaid = activityReport.contributors[0]?.paid || 1;
              return (
                <div
                  key={c.id}
                  className="rank-row rise"
                  style={{ '--i': Math.min(i, 6), '--pct': c.paid / maxPaid, flexWrap: 'wrap' }}
                >
                  <span className="rank-row__bar" aria-hidden="true" />
                  <span className={`rank-row__medal${i < 3 ? ' rank-row__medal--top' : ''}`}>
                    {['🥇', '🥈', '🥉'][i] ?? i + 1}
                  </span>
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div className="cluster" style={{ gap: '0.4rem' }}>
                      <span style={{ fontWeight: 700 }}>{c.name}</span>
                      <span className="badge badge--ok">
                        {c.paidCount}x nalangi · {c.paidPct}%
                      </span>
                    </div>
                    <p className="tx__sub" style={{ marginTop: '0.15rem' }}>
                      {c.paidItems.map((it) => it.label).join(', ')}
                    </p>
                  </div>
                  <span className="num" style={{ fontWeight: 800 }}>
                    {formatRupiah(c.paid)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Peringkat ── */}
      {ledger.ranking.length > 0 && (
        <div className="card rise" style={{ '--i': 6 }}>
          <div className="card__head">
            <div>
              <h2 className="title">Porsi terbesar</h2>
              <p className="subtitle">Berdasarkan total tagihan yang ditanggung</p>
            </div>
            <Trophy size={20} className="muted" />
          </div>
          <div className="rows">
            {ledger.ranking.map((p, i) => (
              <div
                key={p.id}
                className="rank-row rise"
                style={{ '--i': Math.min(i, 6), '--pct': p.share / maxShare }}
              >
                <span className="rank-row__bar" aria-hidden="true" />
                <span className={`rank-row__medal${i < 3 ? ' rank-row__medal--top' : ''}`}>
                  {['🥇', '🥈', '🥉'][i] ?? i + 1}
                </span>
                <span className="grow" style={{ fontWeight: 700 }}>
                  {p.name}
                </span>
                <span className="num" style={{ fontWeight: 800 }}>
                  {formatRupiah(p.share)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Footer />

      {/* ── Pemilih anggota & Laporan kegiatan ── */}
      <Sheets
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        pickerValue={pickerValue}
        setPickerValue={setPickerValue}
        members={members}
        onConfirm={() => {
          setRecapId(pickerValue);
          setPickerOpen(false);
        }}
        recap={recap}
        onCloseRecap={() => setRecapId('')}
        onDownload={downloadRecap}
        reportOpen={reportOpen}
        setReportOpen={setReportOpen}
        activityReport={activityReport}
        onDownloadReport={downloadActivityReport}
        onCopyReport={copyActivityReport}
        isExporting={isExporting}
      />
    </>
  );
}

function Footer() {
  return (
    <div className="footer">
      <Link to="/admin" className="admin-link">
        Area Admin
      </Link>
    </div>
  );
}

function Sheets({
  pickerOpen,
  setPickerOpen,
  pickerValue,
  setPickerValue,
  members,
  onConfirm,
  recap,
  onCloseRecap,
  onDownload,
  reportOpen,
  setReportOpen,
  activityReport,
  onDownloadReport,
  onCopyReport,
  isExporting,
}) {
  return (
    <>
      <Sheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Rincian siapa?"
        description="Lihat belanjaan dan transfer satu orang."
        actions={
          <>
            <button type="button" className="btn btn--soft" onClick={() => setPickerOpen(false)}>
              Batal
            </button>
            <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={!pickerValue}>
              Lihat
            </button>
          </>
        }
      >
        <div className="field">
          <label className="label" htmlFor="recap-member">
            Anggota
          </label>
          <select
            id="recap-member"
            className="select"
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
          >
            <option value="">Pilih anggota…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(recap)}
        onClose={onCloseRecap}
        wide
        title={recap ? `Rincian ${recap.member.name}` : ''}
        description={
          recap
            ? recap.net === 0
              ? 'Sudah seimbang.'
              : recap.net < 0
                ? `Masih kurang bayar ${formatRupiah(-recap.net)}.`
                : `Kelebihan bayar ${formatRupiah(recap.net)}, akan dikembalikan.`
            : ''
        }
        actions={
          <>
            <button type="button" className="btn btn--soft" onClick={onCloseRecap}>
              Tutup
            </button>
            <button type="button" className="btn btn--primary" onClick={onDownload} disabled={isExporting}>
              {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
              {isExporting ? 'Membuat…' : 'Simpan gambar'}
            </button>
          </>
        }
      >
        {recap && (
          <div className="stack">
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pengeluaran</th>
                    <th className="right">Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.items.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="center muted">
                        Tidak ikut pengeluaran apa pun.
                      </td>
                    </tr>
                  ) : (
                    recap.items.map((item, i) => (
                      <tr key={`${item.transactionId}-${i}`}>
                        <td>{item.label}</td>
                        <td className="right num">{formatRupiah(item.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total porsi</td>
                    <td className="right num">{formatRupiah(recap.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {recap.outgoing.length > 0 && (
              <div className="stack stack--sm">
                <p className="eyebrow">Transfer ke</p>
                {recap.outgoing.map((t, i) => (
                  <div key={i} className="tx">
                    <div className="tx__top">
                      <div className="grow">
                        <p className="tx__label">{t.to}</p>
                        <p className="tx__sub mono">
                          {[t.bankName, t.bankAccount].filter(Boolean).join(' · ') || 'Rekening belum diisi'}
                        </p>
                      </div>
                      <span className="tx__amount">{formatRupiah(t.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recap.incoming.length > 0 && (
              <div className="stack stack--sm">
                <p className="eyebrow">Akan menerima dari</p>
                {recap.incoming.map((t, i) => (
                  <div key={i} className="tx">
                    <div className="tx__top">
                      <p className="tx__label grow">{t.from}</p>
                      <span className="tx__amount" style={{ color: 'var(--ok-text)' }}>
                        {formatRupiah(t.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="hint">
              <ImageIcon size={12} style={{ verticalAlign: '-2px' }} /> Gambar yang disimpan sudah memuat nomor
              rekening tujuan, jadi bisa langsung dipakai transfer.
            </p>
          </div>
        )}
      </Sheet>

      <Sheet
        open={Boolean(reportOpen)}
        onClose={() => setReportOpen(false)}
        wide
        title={`Laporan ${activityReport?.activityName || 'Kegiatan'}`}
        description={
          activityReport
            ? `Pengeluaran bersama · ${activityReport.memberCount} anggota · ${activityReport.transactionCount} catatan`
            : ''
        }
        actions={
          <>
            <button type="button" className="btn btn--soft" onClick={onCopyReport}>
              <Copy size={16} /> Salin teks
            </button>
            <button type="button" className="btn btn--primary" onClick={onDownloadReport} disabled={isExporting}>
              {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
              {isExporting ? 'Membuat…' : 'Simpan PNG'}
            </button>
          </>
        }
      >
        {activityReport && (
          <div className="stack stack--lg">
            {/* Ringkasan Metrik Kegiatan */}
            <div className="stats">
              <div className="stat stat--brand">
                <p className="stat__label">Total pengeluaran bersama</p>
                <p className="stat__value num">{formatRupiah(activityReport.total)}</p>
                <p className="stat__meta">
                  Rata-rata {formatRupiah(activityReport.avgPerMember)} / orang
                </p>
              </div>
              <div className="stat stat--ok">
                <p className="stat__label">Kontributor dana</p>
                <p className="stat__value stat__value--sm">
                  {activityReport.contributors.length} dari {activityReport.memberCount} anggota
                </p>
                <p className="stat__meta">
                  {activityReport.topPayer
                    ? `Terbanyak: ${activityReport.topPayer.name} (${formatRupiah(activityReport.topPayer.paid)})`
                    : 'Belum ada yang menalangi'}
                </p>
              </div>
            </div>

            {/* Kontributor Dana (Siapa yang Nalangi) */}
            <div className="stack stack--sm">
              <div className="cluster">
                <p className="eyebrow grow">Kontributor dana (siapa saja yang nalangi)</p>
                <span className="badge badge--ok">{activityReport.contributors.length} orang</span>
              </div>
              {activityReport.contributors.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Belum ada anggota yang menalangi pengeluaran.
                </p>
              ) : (
                <div className="rows">
                  {activityReport.contributors.map((c, i) => {
                    const maxPaid = activityReport.contributors[0]?.paid || 1;
                    return (
                      <div
                        key={c.id}
                        className="rank-row"
                        style={{ '--i': i, '--pct': c.paid / maxPaid, flexWrap: 'wrap' }}
                      >
                        <span className="rank-row__bar" aria-hidden="true" />
                        <span className={`rank-row__medal${i < 3 ? ' rank-row__medal--top' : ''}`}>
                          {['🥇', '🥈', '🥉'][i] ?? i + 1}
                        </span>
                        <div className="grow" style={{ minWidth: 150 }}>
                          <div className="cluster" style={{ gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700 }}>{c.name}</span>
                            <span className="badge badge--ok">
                              {c.paidCount}x bayar · {c.paidPct}%
                            </span>
                          </div>
                          <p className="tx__sub" style={{ marginTop: '0.15rem' }}>
                            Menalangi: {c.paidItems.map((it) => it.label).join(', ')}
                          </p>
                        </div>
                        <span className="num" style={{ fontWeight: 800 }}>
                          {formatRupiah(c.paid)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daftar Pengeluaran Bersama */}
            <div className="stack stack--sm">
              <div className="cluster">
                <p className="eyebrow grow">Daftar pengeluaran bersama</p>
                <span className="badge">{activityReport.rows.length} catatan</span>
              </div>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pengeluaran</th>
                      <th>Dibayar oleh</th>
                      <th>Peserta ikut</th>
                      <th className="right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityReport.rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="center muted">
                          Belum ada pengeluaran tercatat.
                        </td>
                      </tr>
                    ) : (
                      activityReport.rows.map((row) => {
                        const isAll =
                          row.participants.length === activityReport.memberCount &&
                          activityReport.memberCount > 0;
                        return (
                          <tr key={row.id}>
                            <td>
                              <strong style={{ display: 'block' }}>{row.label}</strong>
                              <span className="hint">{formatDate(row.createdAt)}</span>
                            </td>
                            <td>
                              <span className="badge badge--brand">{row.payerName}</span>
                            </td>
                            <td>
                              {isAll ? (
                                <span className="badge badge--ok">
                                  Semua ({row.participants.length} org)
                                </span>
                              ) : (
                                <span className="hint" style={{ color: 'var(--text-soft)' }}>
                                  {row.participants.length} org ({row.participants.map((p) => p.name).join(', ')})
                                </span>
                              )}
                            </td>
                            <td className="right num" style={{ fontWeight: 700 }}>
                              {formatRupiah(row.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Total pengeluaran bersama</td>
                      <td className="right num">{formatRupiah(activityReport.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Rekap Semua Anggota */}
            <div className="stack stack--sm">
              <p className="eyebrow">Rekap semua anggota (porsi vs nalangi)</p>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Anggota</th>
                      <th className="right">Sudah nalangi</th>
                      <th className="right">Porsi beban</th>
                      <th className="right">Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityReport.memberBalances.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ display: 'block' }}>{p.name}</strong>
                          <span className="hint">
                            {p.paid > 0 ? `Kontributor (${p.paidCount}x bayar)` : 'Peserta'} · ikut {p.itemsCount} item
                          </span>
                        </td>
                        <td className="right num">{formatRupiah(p.paid)}</td>
                        <td className="right num">{formatRupiah(p.share)}</td>
                        <td
                          className="right num"
                          style={{
                            fontWeight: 700,
                            color:
                              p.net === 0
                                ? 'var(--text-muted)'
                                : p.net > 0
                                  ? 'var(--ok-text)'
                                  : 'var(--bad-text)',
                          }}
                        >
                          {p.net === 0
                            ? 'Impas'
                            : p.net > 0
                              ? `+${formatRupiah(p.net)}`
                              : `-${formatRupiah(-p.net)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="hint">
              <ImageIcon size={12} style={{ verticalAlign: '-2px' }} /> Klik <strong>Simpan PNG</strong> untuk
              mengunduh gambar laporan kegiatan lengkap (berisi daftar kontributor, pengeluaran bersama, rekap anggota,
              dan transfer).
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}
