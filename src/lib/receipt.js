import { formatRupiah } from './money.js';

const FONT_STACK = '"Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif';
const font = (spec) => `${spec} ${FONT_STACK}`;

const W = 600;
const PAD = 26;
const DPR = 2;

const C = {
  ink: '#111827',
  soft: '#4b5563',
  muted: '#8a93a2',
  brand: '#e1731b',
  brandDark: '#a9510f',
  brandSoft: '#fff4e8',
  line: '#e9e3db',
  white: '#ffffff',
  zebra: '#fbf8f4',
  ok: '#047857',
  okSoft: '#ecfdf5',
  bad: '#b91c1c',
};

/** Bungkus teks jadi beberapa baris. Nama pengeluaran yang panjang dipotong
 *  barisnya, bukan dipangkas dengan elipsis seperti sebelumnya. */
function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }

  if (lines.length < maxLines) lines.push(line);

  // Baris terakhir yang masih kepanjangan baru dipangkas.
  const last = lines[lines.length - 1];
  if (ctx.measureText(last).width > maxWidth) {
    let cut = last;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    lines[lines.length - 1] = `${cut}…`;
  }

  return lines.slice(0, maxLines);
}

/** Pastikan font web sudah siap sebelum menggambar, kalau tidak canvas
 *  akan memakai font pengganti dan lebar teks yang sudah diukur jadi salah. */
export async function waitForFonts() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* tidak masalah, lanjut dengan font pengganti */
  }
}

/**
 * Gambar satu struk per orang.
 *
 * Perbaikan dari versi sebelumnya:
 *  - nomor rekening tujuan ikut tercetak (tanpa itu gambarnya tidak bisa dipakai transfer),
 *  - pengukuran teks memakai font yang sama dengan yang dipakai menggambar,
 *  - nama panjang dibungkus ke baris kedua,
 *  - tinggi kanvas dihitung dari isi, jadi tidak ada ruang kosong menggantung.
 */
export function renderReceipt({
  activityName,
  memberName,
  items = [],
  total = 0,
  paid = 0,
  net = 0,
  transfersOut = [],
  transfersIn = [],
  exportedAt = new Date(),
}) {
  // ── Pengukuran dulu, menggambar kemudian ──
  const measure = document.createElement('canvas').getContext('2d');
  const labelW = W - PAD * 2 - 150;

  // Diukur dengan bobot yang sama seperti saat digambar; '400' vs '500'
  // selisihnya cukup untuk membuat teks meluber beberapa piksel.
  measure.font = font('500 13px');
  const rows = items.map((item) => ({
    lines: wrapLines(measure, item.label, labelW),
    amount: item.amount,
  }));

  const HEAD_H = 86;
  const SUM_H = 76;
  const TH_H = 36;
  const ROW_PAD = 11;
  const LINE_H = 18;
  const rowHeights = rows.map((r) => r.lines.length * LINE_H + ROW_PAD * 2);
  const bodyH = rows.length ? rowHeights.reduce((a, b) => a + b, 0) : 46;
  const TOTAL_H = 46;
  const SEC_H = 34;
  const XROW_H = 46;
  const FOOT_H = 38;

  const outH = SEC_H + Math.max(transfersOut.length, 1) * XROW_H;
  const inH = transfersIn.length ? SEC_H + transfersIn.length * XROW_H : 0;
  const H = HEAD_H + SUM_H + TH_H + bodyH + TOTAL_H + outH + inH + FOOT_H;

  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.textBaseline = 'alphabetic';

  // ── Helper ──
  const box = (x, y, w, h, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };
  const rule = (y, color = C.line, x1 = 0, x2 = W, lw = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y + 0.5);
    ctx.lineTo(x2, y + 0.5);
    ctx.stroke();
  };
  const write = (text, x, y, spec, color, align = 'left') => {
    ctx.font = font(spec);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  box(0, 0, W, H, C.white);

  // ── 1. Kepala ──
  const header = ctx.createLinearGradient(0, 0, W, HEAD_H);
  header.addColorStop(0, C.brand);
  header.addColorStop(1, C.brandDark);
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, W, HEAD_H);

  write('SPLITBILL', PAD, 26, '700 10px', 'rgba(255,255,255,0.75)');
  write(activityName || 'Kegiatan', PAD, 50, '800 19px', C.white);
  write(`Rincian untuk ${memberName}`, PAD, 70, '600 13px', 'rgba(255,255,255,0.9)');

  const stamp = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(exportedAt);
  write(stamp, W - PAD, 26, '600 11px', 'rgba(255,255,255,0.8)', 'right');

  // ── 2. Ringkasan ──
  let y = HEAD_H;
  box(0, y, W, SUM_H, C.brandSoft);
  rule(y + SUM_H, C.line);

  const cell = W / 3;
  const summary = [
    { label: 'PORSI KAMU', value: formatRupiah(total), color: C.ink },
    { label: 'KAMU NALANGI', value: formatRupiah(paid), color: C.ink },
    net === 0
      ? { label: 'STATUS', value: 'Lunas', color: C.ok }
      : net < 0
        ? { label: 'KURANG BAYAR', value: formatRupiah(-net), color: C.bad }
        : { label: 'LEBIH BAYAR', value: formatRupiah(net), color: C.ok },
  ];

  summary.forEach((s, i) => {
    const cx = cell * i + cell / 2;
    write(s.label, cx, y + 28, '700 9px', C.muted, 'center');
    write(s.value, cx, y + 52, '800 16px', s.color, 'center');
    if (i > 0) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cell * i + 0.5, y + 16);
      ctx.lineTo(cell * i + 0.5, y + SUM_H - 16);
      ctx.stroke();
    }
  });

  // ── 3. Kepala tabel ──
  y += SUM_H;
  box(0, y, W, TH_H, C.white);
  write('RINCIAN PENGELUARAN', PAD, y + 23, '700 10px', C.muted);
  write('JUMLAH', W - PAD, y + 23, '700 10px', C.muted, 'right');
  rule(y + TH_H, C.line);

  // ── 4. Isi tabel ──
  y += TH_H;
  if (rows.length === 0) {
    box(0, y, W, 46, C.white);
    write('Tidak ada pengeluaran', W / 2, y + 28, '13px', C.muted, 'center');
    y += 46;
  } else {
    rows.forEach((row, i) => {
      const h = rowHeights[i];
      box(0, y, W, h, i % 2 ? C.zebra : C.white);
      row.lines.forEach((line, li) => {
        write(line, PAD, y + ROW_PAD + 13 + li * LINE_H, '500 13px', C.ink);
      });
      write(formatRupiah(row.amount), W - PAD, y + ROW_PAD + 13, '700 13px', C.soft, 'right');
      rule(y + h, C.line);
      y += h;
    });
  }

  // ── 5. Total ──
  box(0, y, W, TOTAL_H, C.brandSoft);
  rule(y, C.brand, 0, W, 2);
  write('TOTAL PORSI', PAD, y + 29, '800 13px', C.brandDark);
  write(formatRupiah(total), W - PAD, y + 29, '800 16px', C.brandDark, 'right');
  y += TOTAL_H;

  // ── 6. Transfer ──
  const section = (title, tone) => {
    box(0, y, W, SEC_H, tone === 'ok' ? C.okSoft : C.white);
    write(title, PAD, y + 22, '800 11px', tone === 'ok' ? C.ok : C.brandDark);
    rule(y + SEC_H, C.line);
    y += SEC_H;
  };

  const transferRow = (name, bankName, account, amount, i, tone) => {
    box(0, y, W, XROW_H, i % 2 ? C.zebra : C.white);
    write(name, PAD, y + 20, '700 13px', C.ink);

    const bank = [bankName, account].filter(Boolean).join(' · ') || 'Rekening belum diisi';
    ctx.font = font('11px');
    const bankText = wrapLines(ctx, bank, W - PAD * 2 - 140, 1)[0];
    write(bankText, PAD, y + 36, '11px', account ? C.soft : C.muted);

    write(formatRupiah(amount), W - PAD, y + 28, '800 14px', tone === 'ok' ? C.ok : C.brandDark, 'right');
    rule(y + XROW_H, C.line);
    y += XROW_H;
  };

  section('TRANSFER KE', 'brand');
  if (transfersOut.length === 0) {
    box(0, y, W, XROW_H, C.white);
    write('Tidak ada transfer — kamu sudah aman', W / 2, y + 28, '600 12px', C.ok, 'center');
    rule(y + XROW_H, C.line);
    y += XROW_H;
  } else {
    transfersOut.forEach((t, i) => transferRow(t.to, t.bankName, t.bankAccount, t.amount, i, 'brand'));
  }

  if (transfersIn.length) {
    section('AKAN MENERIMA DARI', 'ok');
    transfersIn.forEach((t, i) => transferRow(t.from, '', '', t.amount, i, 'ok'));
  }

  // ── 7. Kaki ──
  box(0, y, W, FOOT_H, C.white);
  write('Dibuat otomatis oleh SplitBill', W / 2, y + 23, '500 10px', C.muted, 'center');

  return canvas;
}

/** Tempel beberapa struk jadi satu gambar panjang — satu unduhan, bukan
 *  belasan yang bikin browser memblokir sisanya. */
export function stackCanvases(canvases, gap = 20) {
  if (canvases.length === 0) return null;
  if (canvases.length === 1) return canvases[0];

  const width = Math.max(...canvases.map((c) => c.width));
  const height = canvases.reduce((sum, c) => sum + c.height, 0) + gap * DPR * (canvases.length - 1);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#eef0f4';
  ctx.fillRect(0, 0, width, height);

  let y = 0;
  for (const c of canvases) {
    ctx.drawImage(c, Math.round((width - c.width) / 2), y);
    y += c.height + gap * DPR;
  }
  return out;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Unduh lewat blob URL, bukan data URL: data URL untuk kanvas besar
 *  menghasilkan string raksasa dan sebagian browser menolaknya. */
export async function downloadCanvas(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function safeFileName(...parts) {
  return (
    parts
      .filter(Boolean)
      .join('_')
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 110) || 'splitbill'
  );
}
