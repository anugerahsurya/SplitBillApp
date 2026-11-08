import { splitEvenly } from './money.js';

/** Kolom involved_member_ids bisa datang sebagai "a, b, c" atau ["a","b"]. */
export function parseInvolved(raw) {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  if (raw === null || raw === undefined || raw === '') return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Satu lintasan atas semua transaksi menghasilkan seluruh angka yang dipakai app:
 * total, siapa nalangi berapa, porsi tiap orang, rincian per orang, peringkat,
 * dan daftar transfer penyelesaian.
 *
 * Dua jaminan yang dipegang fungsi ini:
 *  1. Porsi tiap transaksi adalah bilangan bulat yang menjumlah TEPAT ke nominalnya.
 *  2. Jumlah seluruh saldo selalu nol — jadi total utang = total piutang, dan
 *     tidak ada rupiah yang menguap. Peserta yang sudah dihapus dari kegiatan
 *     tidak lagi menelan porsinya: porsi itu dibagi ulang ke peserta yang tersisa
 *     (atau jatuh ke penalang kalau tidak ada yang tersisa).
 */
export function buildLedger(members = [], transactions = []) {
  const byId = new Map(members.map((m) => [String(m.id), m]));

  const stats = new Map(
    members.map((m) => [
      String(m.id),
      {
        id: String(m.id),
        name: m.name,
        member: m,
        paid: 0,
        paidCount: 0,
        paidItems: [],
        share: 0,
        items: [],
      },
    ]),
  );

  let total = 0;
  let removedMemberRefs = 0; // transaksi yang menyebut anggota yang sudah dihapus
  let orphanTransactions = 0; // transaksi yang penalang & pesertanya hilang semua
  const rows = [];

  for (const t of transactions) {
    const amount = Math.round(Number(t.amount) || 0);
    const payerId = String(t.paid_by_member_id ?? '').trim();
    const payer = stats.get(payerId);

    const requested = parseInvolved(t.involved_member_ids);
    let participantIds = requested.filter((id) => byId.has(id));
    if (participantIds.length !== requested.length) removedMemberRefs += 1;

    // Tidak ada peserta valid? Beban jatuh ke penalang, bukan menguap.
    if (participantIds.length === 0 && payer) participantIds = [payerId];

    if (participantIds.length === 0 || !payer) {
      orphanTransactions += 1;
      continue;
    }

    const label = itemLabel(t);
    total += amount;
    payer.paid += amount;
    payer.paidCount += 1;
    payer.paidItems.push({
      id: t.id,
      label,
      amount,
      at: t.created_at,
    });

    const shares = splitEvenly(amount, participantIds.length);
    const participants = participantIds.map((id, i) => {
      const entry = stats.get(id);
      entry.share += shares[i];
      entry.items.push({
        label,
        amount: shares[i],
        at: t.created_at,
        transactionId: t.id,
      });
      return { id, name: entry.name, share: shares[i] };
    });

    rows.push({
      id: t.id,
      amount,
      label,
      createdAt: t.created_at,
      payerId,
      payerName: payer.name,
      participants,
      perHead: shares[0] ?? 0,
      hasRemovedMembers: participantIds.length !== requested.length,
      raw: t,
    });
  }

  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const people = [...stats.values()].map((s) => ({ ...s, net: s.paid - s.share }));
  const peopleById = new Map(people.map((p) => [p.id, p]));

  return {
    total,
    people,
    peopleById,
    rows,
    settlement: settle(people),
    ranking: people.filter((p) => p.share > 0).sort(byAmountThenName('share')),
    topPayer: people.reduce((best, p) => (p.paid > (best?.paid ?? 0) ? p : best), null),
    warnings: { removedMemberRefs, orphanTransactions },
  };
}

function itemLabel(t) {
  const name = typeof t.item_name === 'string' ? t.item_name.trim() : '';
  return name && name !== '-' ? name : 'Pengeluaran';
}

function byAmountThenName(key) {
  return (a, b) => b[key] - a[key] || a.name.localeCompare(b.name, 'id');
}

/**
 * Greedy "utang terbesar lunasi piutang terbesar" — menghasilkan jumlah transfer
 * yang mendekati minimum, dan urutannya deterministik (tie-break pakai nama)
 * supaya hasil di layar sama persis dengan hasil di gambar export.
 */
function settle(people) {
  const debtors = people
    .filter((p) => p.net < 0)
    .map((p) => ({ ...p, remaining: -p.net }))
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, 'id'));

  const creditors = people
    .filter((p) => p.net > 0)
    .map((p) => ({ ...p, remaining: p.net }))
    .sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name, 'id'));

  const transfers = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const from = debtors[i];
    const to = creditors[j];
    const amount = Math.min(from.remaining, to.remaining);

    if (amount > 0) {
      transfers.push({
        fromId: from.id,
        from: from.name,
        toId: to.id,
        to: to.name,
        amount,
        bankName: to.member?.bank_name || '',
        bankAccount: to.member?.bank_account || '',
      });
    }

    from.remaining -= amount;
    to.remaining -= amount;
    if (from.remaining === 0) i += 1;
    if (to.remaining === 0) j += 1;
  }

  return transfers;
}

/** Rincian satu orang: belanjaannya, total, dan transfer yang harus/akan diterima. */
export function recapFor(ledger, memberId) {
  const id = String(memberId ?? '');
  const person = ledger.peopleById.get(id);
  if (!person) return null;

  return {
    person,
    member: person.member,
    items: person.items,
    total: person.share,
    paid: person.paid,
    net: person.net,
    outgoing: ledger.settlement.filter((t) => t.fromId === id),
    incoming: ledger.settlement.filter((t) => t.toId === id),
  };
}

/**
 * Laporan tingkat kegiatan untuk melihat seluruh pengeluaran bersama,
 * siapa saja kontributor (penalang dana), perbandingan nalangi vs porsi tiap anggota,
 * serta ringkasan statistik kegiatan.
 */
export function activityReportFor(ledger, activity = null) {
  const memberCount = ledger.people.length;
  const transactionCount = ledger.rows.length;
  const avgPerMember = memberCount > 0 ? Math.round(ledger.total / memberCount) : 0;

  const biggestExpense = ledger.rows.reduce(
    (best, row) => (row.amount > (best?.amount ?? 0) ? row : best),
    null,
  );

  const enrichedPeople = ledger.people.map((p) => ({
    ...p,
    paidPct: ledger.total > 0 ? Math.round((p.paid / ledger.total) * 100) : 0,
    sharePct: ledger.total > 0 ? Math.round((p.share / ledger.total) * 100) : 0,
    itemsCount: p.items.length,
  }));

  const contributors = enrichedPeople
    .filter((p) => p.paid > 0)
    .sort((a, b) => b.paid - a.paid || b.paidCount - a.paidCount || a.name.localeCompare(b.name, 'id'));

  const memberBalances = [...enrichedPeople].sort(
    (a, b) => b.paid - a.paid || b.share - a.share || a.name.localeCompare(b.name, 'id'),
  );

  return {
    activityName: activity?.name || 'Kegiatan',
    createdAt: activity?.created_at || null,
    status: activity?.status || 'active',
    total: ledger.total,
    memberCount,
    transactionCount,
    avgPerMember,
    topPayer: ledger.topPayer?.paid > 0 ? ledger.topPayer : null,
    biggestExpense,
    contributors,
    rows: ledger.rows,
    memberBalances,
    settlement: ledger.settlement,
  };
}

/**
 * Susun teks laporan kegiatan yang rapi untuk ditempel ke grup WhatsApp / chat.
 */
export function formatActivityReportText(ledger, activity = null, formatRupiahFn = (n) => `Rp ${n}`) {
  const report = activityReportFor(ledger, activity);
  const lines = [
    `*LAPORAN PENGELUARAN KEGIATAN*`,
    `*${report.activityName}*`,
    `${report.memberCount} anggota · ${report.transactionCount} pengeluaran · ${report.contributors.length} kontributor dana`,
    ``,
    `*Ringkasan Bersama*`,
    `• Total pengeluaran: *${formatRupiahFn(report.total)}*`,
    `• Rata-rata per orang: ${formatRupiahFn(report.avgPerMember)}`,
  ];

  if (report.contributors.length > 0) {
    lines.push(``, `*Kontributor Dana (Yang Nalangi)*`);
    report.contributors.forEach((c, idx) => {
      const itemNames = c.paidItems.map((it) => it.label).join(', ');
      lines.push(
        `${idx + 1}. *${c.name}* — *${formatRupiahFn(c.paid)}* (${c.paidCount}x bayar · ${c.paidPct}%)`,
        `   Menalangi: ${itemNames}`,
      );
    });
  }

  lines.push(``, `*Daftar Pengeluaran Bersama*`);
  if (report.rows.length === 0) {
    lines.push(`Belum ada pengeluaran tercatat.`);
  } else {
    report.rows.forEach((row, idx) => {
      const who =
        row.participants.length === report.memberCount && report.memberCount > 0
          ? `Semua (${row.participants.length} org)`
          : `${row.participants.length} org: ${row.participants.map((p) => p.name).join(', ')}`;
      lines.push(
        `${idx + 1}. *${row.label}* — ${formatRupiahFn(row.amount)}`,
        `   Dibayar ${row.payerName} · Ikut: ${who}`,
      );
    });
  }

  lines.push(``, `*Rekap Semua Anggota (Porsi & Saldo)*`);
  report.memberBalances.forEach((p) => {
    const netLabel =
      p.net === 0
        ? 'Impas'
        : p.net > 0
          ? `Lebih bayar +${formatRupiahFn(p.net)}`
          : `Kurang bayar -${formatRupiahFn(-p.net)}`;
    lines.push(
      `• *${p.name}* (ikut ${p.itemsCount} item): Porsi ${formatRupiahFn(p.share)} | Nalangi ${formatRupiahFn(p.paid)} (${netLabel})`,
    );
  });

  lines.push(``, `*Penyelesaian Transfer*`);
  if (report.settlement.length === 0) {
    lines.push(`Semua sudah seimbang.`);
  } else {
    report.settlement.forEach((t) => {
      const bank = [t.bankName, t.bankAccount].filter(Boolean).join(' ');
      lines.push(`• *${t.from}* → *${t.to}*: *${formatRupiahFn(t.amount)}*${bank ? ` (${bank})` : ''}`);
    });
  }

  return lines.join('\n');
}
