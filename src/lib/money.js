// Semua uang di app ini diperlakukan sebagai bilangan bulat rupiah.
// Rupiah tidak punya pecahan yang dipakai sehari-hari, jadi menyimpan float
// hanya bikin "Rp 3.333 + Rp 3.333 + Rp 3.333 = Rp 9.999" padahal totalnya 10.000.

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatRupiah(value) {
  const n = Number(value);
  return rupiah.format(Number.isFinite(n) ? Math.round(n) : 0);
}

/** Angka saja tanpa "Rp" — untuk input yang sudah punya prefix sendiri. */
export function formatNumber(value) {
  const n = Number(value);
  return plain.format(Number.isFinite(n) ? Math.round(n) : 0);
}

/** Ambil angka dari teks apa pun ("Rp 12.500" / "12.500" / "12500"). */
export function parseRupiah(input) {
  if (typeof input === 'number') return Math.round(input);
  const digits = String(input ?? '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Bagi `total` ke `count` orang dengan metode sisa terbesar.
 * Hasilnya bilangan bulat dan dijamin menjumlah tepat ke `total` —
 * tidak ada rupiah yang hilang atau muncul dari pembulatan.
 */
export function splitEvenly(total, count) {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return [];
  const sign = total < 0 ? -1 : 1;
  const amount = Math.abs(Math.round(Number(total) || 0));
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  return Array.from({ length: n }, (_, i) => sign * (base + (i < remainder ? 1 : 0)));
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDateShort(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date);
}
