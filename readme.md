# NT DevTools

[![Versi AMO](https://img.shields.io/amo/v/nt-devtools?label=versi&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Pengguna](https://img.shields.io/amo/users/nt-devtools?label=pengguna&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Firefox Android & Desktop](https://img.shields.io/badge/firefox-android%20%7C%20desktop-ff7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Manifest V2](https://img.shields.io/badge/manifest-v2-orange.svg)](manifest.json)
[![Lisensi MIT](https://img.shields.io/badge/lisensi-MIT-blue.svg)](LICENSE)
[![Tanpa Dependensi](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Privasi Data](https://img.shields.io/badge/data%20collection-none-brightgreen.svg)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Uji Lulus](https://img.shields.io/badge/tes-188%20lulus-success.svg)](test/runtime-harness.js)
[![Bahasa Indonesia](https://img.shields.io/badge/bahasa-Indonesia-red.svg)]()

> **Pasang di Firefox (AMO):** [addons.mozilla.org/en-US/firefox/addon/nt-devtools/](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)

**NT DevTools** adalah konsol pengembang web ringkas yang dioptimalkan khusus untuk **debugging perangkat seluler (*mobile web debugging*)**. Terinspirasi dari efisiensi konsol seluler kelas Eruda, tetapi dikembangkan dengan arsitektur mandiri, kode sumber murni, dan identitas unik (**NT Dev**)—tanpa menyalin aset atau merek pihak lain.

Antarmuka bersih tanpa emoji: setiap ikon tab menggunakan **SVG murni** (`icons-data.js`), sementara tombol melayang (FAB) menggunakan aset ikon ekstensi resmi (`icons/icon.png`).

---

## Panduan Penggunaan

1. Pasang ekstensi dari [AMO](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/) untuk Firefox Android atau Desktop. Untuk pengujian lokal, muat direktori melalui `about:debugging`.
2. Buka halaman web target (`http://` atau `https://`).
3. Ketuk atau klik ikon **NT DevTools** di bilah alat peramban untuk memunculkan konsol di bagian bawah layar.
4. Gunakan tombol tutup di panel atau ketuk ikon kembali untuk menyembunyikan konsol.

Injeksi skrip hanya terjadi saat ikon bilah alat diklik (`manifest.json` tidak menggunakan blok `content_scripts` permanen, mencegah benturan jalur injeksi).

---

## Daftar Tab & Kapasitas Fungsional

| Tab | ID | Fitur Utama |
| :--- | :--- | :--- |
| **Elemen** | `elements` | Inspeksi pohon DOM interaktif, auto-refresh saat DOM berubah, breadcrumb, pencari tag/ID/kelas, pemilih elemen langsung (*element picker*) dengan sorotan visual, sunting atribut & teks inline, hapus node, salin HTML/selektor, sub-tab *Styles* (sunting CSS langsung), *Computed*, *Box Model*, *Event Listeners*, serta tautan global `$0`. |
| **Konsol** | `console` | Penangkapan `console.*` komprehensif (`table`, `dir`, `time`, `assert`, `count`, `trace`, `group`), penanganan galat tak tertangkap & `unhandledrejection` dengan jejak tumpukan, filter tingkat/kata kunci/regex, REPL dengan pelengkapan otomatis (*autocomplete*), helper `$`, `$$`, `$0`, `$_`, objek bertingkat yang dapat dilipat, serta tombol salin dan bersihkan log. |
| **Sumber** | `sources` | Daftar `<script>`, `<style>`, dan `<link>` halaman, editor dengan nomor baris, penyorotan sintaks berbasis `beautify.js`, tombol "Perindah", panel penanda titik henti (*breakpoint*), serta sub-tab **Cuplikan**. |
| **Jaringan** | `network` | Pemantauan permintaan `webRequest` (metode, status, durasi, *waterfall*) dengan filter tipe (XHR/Fetch/Document/Script/Stylesheet/Image/Media/Font/Lainnya) dan status (2xx–5xx/gagal) digabung pencarian URL; rincian Headers/Payload/Response ditambah tab **Body** (permintaan & respons, mentah/terformat, JSON pretty-print) dan **Cookies**; tombol salin sebagai cURL & salin respons; serta data metrik *Resource Timing*. |
| **Kinerja** | `perf` | Pemantau bingkai per detik (*FPS meter* via `requestAnimationFrame`), metrik navigasi (TTFB, DOMContentLoaded, load), penggunaan memori, dan jumlah total node DOM. |
| **Aplikasi** | `storage` | Manajemen `localStorage`, `sessionStorage`, `Cookies`, `IndexedDB`, dan `Cache Storage`—tampilan tabel terstruktur, pencarian instan, serta penghapusan data. |
| **Perangkat** | `ua` | Informasi lengkap peramban: User Agent, platform, bahasa, resolusi layar & viewport, *Device Pixel Ratio* (DPR), orientasi, status koneksi, jumlah inti CPU, dan estimasi memori perangkat. |
| **Tentang** | `about` | Informasi versi, identitas pembuat (**NT Dev**), lisensi MIT, tautan repositori, catatan kredit, serta panduan singkat operasional modul. |
| **Pengaturan** | `settings` | Kustomisasi tema terang/gelap, transparansi panel, tinggi penampang, ukuran huruf, aktif/nonaktif tab individual, opsi lanjutan Konsol (batas log, pencatatan waktu, properti non-enumerable, getter, render asinkron), dan pengaturan ulang konfigurasi. |

**Cuplikan** (sub-tab di Sumber) menyediakan skrip siap pakai (seperti menghapus seluruh kuki, mengekstrak tautan gambar, atau mengukur waktu muat) serta tempat penyimpanan cuplikan kustom di `localStorage`.

---

## Keunggulan Arsitektur

- **Desain Mobile-First**: Target sentuh ergonomis, tata letak adaptif untuk layar sempit, serta dukungan penuh pengaman area seluler (`env(safe-area-inset-bottom)`).
- **100% Ikon SVG**: Bebas dari simbol emoji Unicode; elemen antarmuka tajam di segala resolusi.
- **Tanpa Dependensi Eksternal**: Berjalan ringan tanpa pustaka pihak ketiga yang membebani kinerja.

---

## Privasi & Keamanan (AMO)

- **Status Rilis**: Telah terbit di [Mozilla Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/).
- **Kebijakan Privasi**: 100% nir-pengumpulan data (*zero data collection*). Seluruh proses berjalan lokal di perangkat pengguna, dideklarasikan secara eksplisit dalam `manifest.json` melalui `browser_specific_settings.gecko.data_collection_permissions = { "required": ["none"] }`.
- **Inspeksi Body Jaringan**: Penangkapan isi respons (tab **Body**) beroperasi secara lokal, dibatasi ~256 KB, bersifat *passthrough* tanpa mengubah data asli, dan dapat dimatikan melalui menu Pengaturan.
- **Aset Ikon**: Disediakan lengkap dalam ukuran 16, 32, 48, dan 128 piksel (`icons/icon-16.png` hingga `icons/icon-128.png`).
- **Validasi Linter**: Lulus uji `web-ext lint` dengan **0 error**. Peringatan `DANGEROUS_EVAL` terkait REPL Konsol adalah wajar dan esensial bagi fungsi konsol pengembang (standar setara Eruda).

---

## Batasan Saat Ini

Untuk transparansi pengembangan, fitur berikut belum diimplementasikan pada versi ini:
- **Application**: Inspeksi *Web Manifest* dan *Service Worker* (fokus saat ini pada penyimpanan data lokal).
- **Debugger Sumber**: Penanda titik henti bersifat visual; eksekusi *stepping* JS tingkat lanjut belum didukung.
- **Tombol Melayang (FAB)**: Posisi tombol melayang saat ini bersifat tetap.

---

## Petunjuk Penggunaan untuk Pengembang

```sh
chmod +x build.sh
./build.sh
```

Perintah di atas menjalankan pengujian di dalam lingkungan JSDOM dengan tiruan API `browser.*`, memverifikasi keberadaan `#mdt-root`, 9 tab utama, integritas ikon SVG, komunikasi pesan runtime, hook konsol, jejak tumpukan, pelengkapan otomatis REPL, helper `$`/`$$`, filter regex, persistensi setelan, penanganan jaringan, serta keutuhan isi panel. Seluruh pengujian wajib mencetak status **0 gagal**.
