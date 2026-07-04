# Panduan Setup Google Apps Script (Database)

Karena aplikasi kita menggunakan Google Spreadsheet sebagai database, Anda perlu melakukan *deploy* script ini agar bisa diakses oleh aplikasi Vue kita.

### Langkah-langkah:
1. Buka [Google Spreadsheet Anda](https://docs.google.com/spreadsheets/d/1PaOjQkh2bCJrOGl9hOD2sFPKz48yxuuljOODppx0mNI/edit).
2. Di menu atas, klik **Extensions** (Ekstensi) > **Apps Script**.
3. Hapus semua kode yang ada di `Code.gs`, lalu *copy-paste* seluruh isi file `backend/Code.gs` dari folder proyek ini ke sana.
4. Simpan dengan menekan ikon Disket (Save) atau `Ctrl+S`.
5. Di bagian atas, pilih fungsi `setup` di *dropdown* sebelah tombol Run (Jalankan), lalu klik **Run**. 
   *(Ini akan membuat sheet "Activities", "Members", dan "Transactions" secara otomatis di Spreadsheet Anda).*
   - *Catatan: Jika diminta izin (Authorization), klik Review Permissions, pilih akun Google Anda, klik Advanced, lalu Go to project (unsafe), dan klik Allow.*
6. Di pojok kanan atas, klik tombol biru **Deploy** > **New deployment**.
7. Klik ikon gir (Select type) di sebelah "Select type", lalu pilih **Web app**.
8. Isi kolom:
   - Description: (Isi bebas, misal: "API Split Bill")
   - Execute as: **Me** (Penting!)
   - Who has access: **Anyone** (Sangat Penting, agar web kita bisa mengaksesnya tanpa harus login Google).
9. Klik **Deploy**.
10. Salin **Web app URL** yang dihasilkan.
11. Nanti URL tersebut akan kita masukkan ke dalam kode Vue kita (di file `src/services/api.js`).

Setelah selesai, biarkan saya tahu URL Web App-nya jika Anda ingin saya langsung memasukkannya, atau Anda bisa memasukkannya sendiri nanti!
