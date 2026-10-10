// Uji logika uang tanpa butuh browser: node --test src/lib/split.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLedger, parseInvolved, recapFor } from './split.js';
import { parseRupiah, splitEvenly } from './money.js';

const netSum = (l) => l.people.reduce((s, p) => s + p.net, 0);
const shareSum = (l) => l.people.reduce((s, p) => s + p.share, 0);
const debtSum = (l) => l.people.filter((p) => p.net < 0).reduce((s, p) => s - p.net, 0);
const transferSum = (l) => l.settlement.reduce((s, t) => s + t.amount, 0);

const people = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    name: `Orang ${i}`,
    bank_name: 'BCA',
    bank_account: `99${i}`,
  }));

test('pembagian selalu bulat dan menjumlah tepat ke nominalnya', () => {
  for (const [total, count] of [
    [10000, 3],
    [7, 3],
    [1, 5],
    [0, 4],
    [99999, 7],
    [100, 1],
  ]) {
    const shares = splitEvenly(total, count);
    assert.equal(shares.length, count);
    assert.equal(
      shares.reduce((a, b) => a + b, 0),
      total,
      `${total}/${count} tidak menjumlah tepat`,
    );
    assert.ok(shares.every(Number.isInteger));
  }
  assert.deepEqual(splitEvenly(100, 0), []);
});

test('nominal dibaca dari teks apa pun', () => {
  assert.equal(parseRupiah('Rp 1.250.000'), 1250000);
  assert.equal(parseRupiah('12500'), 12500);
  assert.equal(parseRupiah(''), 0);
  assert.equal(parseRupiah('abc'), 0);
});

test('daftar peserta dibersihkan dari spasi', () => {
  assert.deepEqual(parseInvolved('a, b ,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseInvolved(['a', ' b']), ['a', 'b']);
  assert.deepEqual(parseInvolved(''), []);
  assert.deepEqual(parseInvolved(null), []);
});

test('data cacat tetap menghasilkan buku yang seimbang', () => {
  const cases = {
    'tanpa anggota': [[], [{ id: 't', amount: 5000, paid_by_member_id: 'x', involved_member_ids: 'x' }]],
    'tanpa transaksi': [people(4), []],
    'satu anggota': [people(1), [{ id: 't', amount: 5000, paid_by_member_id: 'm0', involved_member_ids: 'm0' }]],
    'penalang bukan peserta': [
      people(3),
      [{ id: 't', amount: 9000, paid_by_member_id: 'm0', involved_member_ids: 'm1,m2' }],
    ],
    'nominal raksasa': [
      people(7),
      [{ id: 't', amount: 999999999, paid_by_member_id: 'm0', involved_member_ids: 'm0,m1,m2,m3,m4,m5,m6' }],
    ],
    'nominal satu rupiah': [
      people(5),
      [{ id: 't', amount: 1, paid_by_member_id: 'm0', involved_member_ids: 'm0,m1,m2,m3,m4' }],
    ],
    'nominal kosong': [people(3), [{ id: 't', amount: '', paid_by_member_id: 'm0', involved_member_ids: 'm0,m1' }]],
    'peserta kosong': [people(3), [{ id: 't', amount: 6000, paid_by_member_id: 'm0', involved_member_ids: '' }]],
    'semua pihak sudah dihapus': [
      people(3),
      [{ id: 't', amount: 6000, paid_by_member_id: 'zz', involved_member_ids: 'yy' }],
    ],
  };

  for (const [name, [members, transactions]] of Object.entries(cases)) {
    const ledger = buildLedger(members, transactions);
    assert.equal(netSum(ledger), 0, `${name}: saldo tidak nol`);
    assert.equal(transferSum(ledger), debtSum(ledger), `${name}: transfer tidak menutup utang`);
  }
});

test('porsi anggota yang dihapus dibagi ulang, bukan menguap', () => {
  const transactions = [
    { id: 't1', amount: 10000, paid_by_member_id: 'm1', involved_member_ids: 'm0, m1, m2' },
  ];

  const before = buildLedger(people(3), transactions);
  assert.equal(before.total, 10000);
  assert.equal(shareSum(before), 10000);

  // m2 dihapus dari kegiatan, transaksinya masih menyebut dia.
  const after = buildLedger(people(3).slice(0, 2), transactions);
  assert.equal(netSum(after), 0);
  assert.equal(shareSum(after), 10000, 'total porsi harus tetap sama dengan nominalnya');
  assert.equal(after.warnings.removedMemberRefs, 1);
  assert.equal(transferSum(after), debtSum(after));
});

test('kegiatan dengan banyak transaksi tetap konsisten', () => {
  const members = people(6);
  const transactions = [];
  let seed = 7;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };

  for (let i = 0; i < 40; i += 1) {
    const chosen = members.filter(() => rnd(10) > 3).map((m) => m.id);
    transactions.push({
      id: `t${i}`,
      amount: rnd(500000) + 1,
      paid_by_member_id: members[rnd(6)].id,
      involved_member_ids: (chosen.length ? chosen : [members[rnd(6)].id]).join(', '),
      item_name: `Item ${i}`,
      created_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    });
  }

  const ledger = buildLedger(members, transactions);
  const expected = transactions.reduce((s, t) => s + Number(t.amount), 0);

  assert.equal(ledger.total, expected);
  assert.equal(shareSum(ledger), expected, 'jumlah porsi harus sama dengan total pengeluaran');
  assert.equal(netSum(ledger), 0);
  assert.equal(transferSum(ledger), debtSum(ledger));
  assert.ok(ledger.settlement.every((t) => t.amount > 0 && Number.isInteger(t.amount)));
  // Tiap orang paling banyak muncul sekali sebagai pengutang dan sekali sebagai penerima
  // pada greedy ini hanya jika saldonya habis dalam satu transfer; yang pasti:
  // tidak ada transfer ke diri sendiri.
  assert.ok(ledger.settlement.every((t) => t.fromId !== t.toId));
});

test('rekap per orang konsisten dengan buku besar', () => {
  const members = people(4);
  const transactions = [
    { id: 't1', amount: 100000, paid_by_member_id: 'm0', involved_member_ids: 'm0,m1,m2,m3', item_name: 'Hotel' },
    { id: 't2', amount: 45000, paid_by_member_id: 'm1', involved_member_ids: 'm1,m2', item_name: 'Taksi' },
  ];
  const ledger = buildLedger(members, transactions);
  const recap = recapFor(ledger, 'm2');

  assert.equal(
    recap.items.reduce((s, i) => s + i.amount, 0),
    recap.total,
  );
  assert.equal(recap.total, 25000 + 22500);
  assert.equal(recap.paid, 0);
  assert.equal(recap.net, -recap.total);
  assert.equal(recapFor(ledger, 'tidak-ada'), null);
});
