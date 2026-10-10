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
      { id: String(m.id), name: m.name, member: m, paid: 0, share: 0, items: [] },
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

    total += amount;
    payer.paid += amount;

    const shares = splitEvenly(amount, participantIds.length);
    const participants = participantIds.map((id, i) => {
      const entry = stats.get(id);
      entry.share += shares[i];
      entry.items.push({
        label: itemLabel(t),
        amount: shares[i],
        at: t.created_at,
        transactionId: t.id,
      });
      return { id, name: entry.name, share: shares[i] };
    });

    rows.push({
      id: t.id,
      amount,
      label: itemLabel(t),
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
