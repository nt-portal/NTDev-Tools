# Panduan Kontribusi (Contributing Guide)

Terima kasih atas ketertarikan Anda untuk berkontribusi pada proyek ini! Ikuti panduan di bawah ini untuk memastikan kontribusi Anda berjalan lancar.

## Kebijakan Kontribusi (Policy)
- Kontributor wajib menjaga kode etik, saling menghargai, dan memastikan kode bebas pelanggaran hak cipta.

## Cara Menambahkan Fitur Baru atau Perubahan

1. **Fork & Clone Repositori**
   Lakukan fork pada repositori ini ke akun GitHub Anda, lalu clone ke perangkat lokal Anda.

2. **Buat Branch Baru**
   Jangan pernah melakukan *commit* langsung ke branch utama (`main` atau `master`). Selalu buat branch baru untuk setiap fitur atau perbaikan bug:
   ```bash
   git checkout -b fitur/nama-fitur-baru
   ```
   Gunakan penamaan branch yang deskriptif:
   - `fitur/nama-fitur` untuk penambahan fitur baru.
   - `perbaikan/nama-bug` untuk perbaikan bug.
   - `dok/nama-dok` untuk pembaruan dokumentasi.

3. **Lakukan Perubahan & Pengujian**
   - Tulis kode yang bersih dan ikuti struktur proyek yang ada.
   - Uji perubahan Anda secara lokal sebelum mengirimkan kode.

4. **Kirim Pull Request (PR)**
   - Push branch Anda ke repositori fork Anda:
     ```bash
     git push origin fitur/nama-fitur-baru
     ```
   - Buka Pull Request dari branch Anda ke branch utama repositori ini.
   - Berikan deskripsi yang jelas mengenai perubahan atau fitur baru yang Anda tambahkan.
