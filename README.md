# SplitBill

Aplikasi bagi tagihan bareng. Admin membuat kegiatan dan daftar anggota, lalu
membagikan satu link; peserta mencatat pengeluaran lewat link itu dan langsung
melihat siapa harus transfer ke siapa.

React + Vite di depan, Google Apps Script + Google Sheets sebagai backend.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm test         # uji logika pembagian uang
```

Buat `.env.local` kalau perlu menimpa setelan bawaan:

```
VITE_GAS_URL=https://script.google.com/macros/s/.../exec
VITE_ADMIN_PASSWORD=ganti-ini
```

> Password admin diperiksa di browser, jadi ia hanya menyembunyikan menu — bukan
> pengamanan. Siapa pun yang membuka devtools bisa melewatinya. Kalau datanya
> perlu benar-benar terlindungi, pemeriksaan harus pindah ke Apps Script.

## Susunan berkas

| Berkas | Isi |
| --- | --- |
| `src/lib/money.js` | Format dan pembacaan rupiah, pembagian sisa-terbesar |
| `src/lib/split.js` | Buku besar: porsi, saldo, peringkat, daftar transfer |
| `src/lib/receipt.js` | Penggambar struk PNG lewat Canvas |
| `src/lib/split.test.mjs` | Uji logika uang (tanpa browser) |
| `src/components/` | Sheet, Confirm, Toaster, dan primitif UI |
| `src/pages/UserView.jsx` | Halaman peserta |
| `src/pages/AdminView.jsx` | Halaman admin (dimuat terpisah) |
| `src/styles/app.css` | Token desain dan seluruh komponen |
| `backend/Code.gs` | Apps Script: `doGet` / `doPost` |

## Dua aturan yang dipegang perhitungannya

1. **Porsi selalu bilangan bulat yang menjumlah tepat ke nominalnya.**
   `10.000 / 3` menjadi `3.334 + 3.333 + 3.333`, bukan tiga kali `3.333,33` yang
   dibulatkan terpisah lalu kurang satu rupiah.
2. **Jumlah seluruh saldo selalu nol.** Kalau seorang anggota dihapus padahal
   namanya masih tercatat di pengeluaran lama, porsinya dibagi ulang ke peserta
   yang masih ada (atau jatuh ke penalang bila tidak ada yang tersisa). Tanpa itu
   porsi tersebut hilang dari persamaan dan penalangnya rugi tanpa pemberitahuan.

`npm test` menjaga kedua aturan itu, termasuk untuk data cacat: anggota nol,
peserta kosong, penalang sudah terhapus, dan nominal satu rupiah.

## Backend

Isi `backend/Code.gs` ke proyek Apps Script yang terhubung ke spreadsheet,
jalankan `setup()` sekali, lalu deploy sebagai Web App (akses: siapa pun).

Aksi `addTransactions` dipakai mode "Per Orang" untuk menyimpan beberapa
pengeluaran dalam satu permintaan. Kalau deployment masih versi lama yang belum
punya aksi itu, frontend otomatis kembali mengirim satu per satu — jadi
redeploy bisa ditunda tanpa ada yang rusak.
