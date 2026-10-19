# NT DevTools

[![Versi AMO](https://img.shields.io/amo/v/nt-devtools?label=versi&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Pengguna](https://img.shields.io/amo/users/nt-devtools?label=pengguna&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Firefox Android & Desktop](https://img.shields.io/badge/firefox-android%20%7C%20desktop-ff7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Manifest V2](https://img.shields.io/badge/manifest-v2-orange.svg)](manifest.json)
[![Lisensi MIT](https://img.shields.io/badge/lisensi-MIT-blue.svg)](LICENSE)
[![Tanpa Dependensi](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Privasi Data](https://img.shields.io/badge/data%20collection-none-brightgreen.svg)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Uji Lulus](https://img.shields.io/badge/tes-189%20lulus-success.svg)](test/runtime-harness.js)
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

Injeksi berjalan melalui dua jalur yang tidak saling bentrok. Jalur pertama adalah jembatan konsol sedini mungkin: `manifest.json` memakai blok `content_scripts` yang menjalankan `bootstrap.js` (dunia terisolasi) dan `injected.js` (dunia utama halaman) pada `document_start`, sehingga log konsol tertangkap sejak awal dan hook `console.*` serta REPL berjalan di konteks halaman. Jalur kedua adalah panel antarmuka (`styles.js`, `icons-data.js`, `beautify.js`, `contentScript.js`) yang baru diinjeksikan secara dinamis oleh `background.js` saat ikon bilah alat diklik.

---

## Daftar Tab & Kapasitas Fungsional

| Tab | ID | Fitur Utama |
| :--- | :--- | :--- |
| **Elemen** | `elements` | Inspeksi pohon DOM interaktif, auto-refresh saat DOM berubah, breadcrumb, pencari tag/ID/kelas, pemilih elemen langsung (*element picker*) dengan sorotan visual, sunting atribut & teks inline, hapus node, salin HTML/selektor, sub-tab *Styles* (sunting CSS langsung), *Computed*, *Box Model*, *Event Listeners*, serta tautan global `$0`. |
| **Konsol** | `console` | Penangkapan `console.*` komprehensif (`table`, `dir`, `time`, `assert`, `count`, `trace`, `group`), penanganan galat tak tertangkap & `unhandledrejection` dengan jejak tumpukan, filter tingkat/kata kunci/regex, REPL dengan pelengkapan otomatis (*autocomplete*), helper `$`, `$$`, `$0`, `$_`, objek bertingkat yang dapat dilipat, serta tombol salin dan bersihkan log. |
| **Sumber** | `sources` | Daftar `<script>`, `<style>`, dan `<link>` halaman, editor dengan nomor baris, penyorotan sintaks berbasis `beautify.js`, tombol "Perindah", panel penanda titik henti (*breakpoint*), serta sub-tab **Cuplikan**. Kategori sumber mencakup skrip, gaya, penyimpanan (`localStorage`, `sessionStorage`), kuki, iframe, gambar/video/audio, variabel global, WebAssembly, dan IndexedDB. |
| **Jaringan** | `network` | Pemantauan permintaan `webRequest` (metode, status, durasi, *waterfall*) dengan filter tipe (XHR/Fetch/Document/Script/Stylesheet/Image/Media/Font/Lainnya) dan status (2xx sampai 5xx/gagal) digabung pencarian URL; tab rincian **Header**, **Pratinjau**, **Muatan**, **Isi**, **Cookie**, dan **Respons**; pratinjau media (gambar/video/audio); tombol **Ekspor HAR** (*HTTP Archive 1.2*) serta salin cURL/respons; dan data metrik *Resource Timing*. |
| **Kinerja** | `perf` | Pemantau bingkai per detik (*FPS meter* via `requestAnimationFrame`), jumlah total node DOM, penggunaan memori, kartu **Waktu** (metrik navigasi), serta kartu **Informasi CPU**. |
| **Aplikasi** | `storage` | Manajemen `localStorage`, `sessionStorage`, `Cookie`, `IndexedDB`, `Cache Storage`, dan `WebAssembly` (Wasm). Tampilan tabel terstruktur, pencarian instan, serta penghapusan data. |
| **Peta** | `map` | Peta OpenStreetMap (embed) dengan pencarian IP publik. Nonaktif secara baku, dapat dinyalakan dari Pengaturan. |
| **Waktu** | `timing` | Tabel metrik waktu navigasi (TTFB, DOMContentLoaded, load, durasi). Nonaktif secara baku, dapat dinyalakan dari Pengaturan. |
| **Perangkat** | `ua` | Informasi lengkap peramban: User Agent, platform, bahasa, resolusi layar & viewport, *Device Pixel Ratio* (DPR), orientasi, status koneksi, jumlah inti CPU, dan estimasi memori perangkat. |
| **Tentang** | `about` | Informasi versi, identitas pembuat (**NT Dev**), lisensi MIT, serta tautan repositori. |
| **Pengaturan** | `settings` | Pilihan tema (Bawaan Sistem/Gelap/Terang), transparansi panel, tinggi penampang, ukuran huruf, aktif/nonaktif tab individual, opsi lanjutan Konsol (batas log, cap waktu, grup, properti non-enumerable, getter, render asinkron, filter regex), opsi Jaringan (tangkap body respons), dan tombol "Kembalikan pengaturan awal". |

**Cuplikan** (sub-tab di Sumber) menyediakan skrip siap pakai bawaan: "Semua Batas", "Muat ulang halaman", "Cari teks", "Edit halaman", dan "Sesuaikan layar", serta tempat penyimpanan cuplikan kustom di `localStorage`.

---

## Keunggulan Arsitektur

- **Desain Mobile-First**: Target sentuh ergonomis, tata letak adaptif untuk layar sempit, serta dukungan penuh pengaman area seluler (`env(safe-area-inset-bottom)`).
- **Dua Jalur Injeksi**: `bootstrap.js` (perekam log awal di dunia terisolasi) dan `injected.js` (jembatan dunia utama halaman) berjalan pada `document_start` untuk menangkap log konsol sedini mungkin; panel antarmuka diinjeksikan dinamis oleh `background.js` saat ikon bilah alat diklik.
- **100% Ikon SVG**: Bebas dari simbol emoji Unicode; elemen antarmuka tajam di segala resolusi.
- **Tanpa Dependensi Eksternal**: Berjalan ringan tanpa pustaka pihak ketiga yang membebani kinerja.

---

## Privasi & Keamanan (AMO)

- **Status Rilis**: Telah terbit di [Mozilla Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/).
- **Kebijakan Privasi**: 100% nir-pengumpulan data (*zero data collection*). Seluruh proses berjalan lokal di perangkat pengguna, dideklarasikan secara eksplisit dalam `manifest.json` melalui `browser_specific_settings.gecko.data_collection_permissions = { "required": ["none"] }`.
- **Inspeksi Body Jaringan**: Penangkapan isi respons (tab **Isi**) beroperasi secara lokal, dibatasi ~256 KB, bersifat *passthrough* tanpa mengubah data asli, dan dapat dimatikan melalui menu Pengaturan.
- **Aset Ikon**: Disediakan lengkap dalam ukuran 16, 32, 48, dan 128 piksel (`icons/icon-16.png` hingga `icons/icon-128.png`).
- **Sumber Daya Terbuka**: `web_accessible_resources` hanya mengekspos `icons/icon.png` dan `injected.js`, yaitu aset ikon tombol melayang dan jembatan dunia utama halaman.
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

Perintah di atas memvalidasi sintaks setiap berkas JavaScript satu per satu, lalu mengemas ekstensi ke `test/ntdev-tools.zip`.

Uji runtime dijalankan terpisah:

```sh
bash test/run-runtime-test.sh
```

Uji tersebut menjalankan `test/runtime-harness.js` di dalam lingkungan JSDOM dengan tiruan API `browser.*`, memverifikasi keberadaan `#mdt-root`, 11 tab utama, integritas ikon SVG, komunikasi pesan runtime, hook konsol, jejak tumpukan, pelengkapan otomatis REPL, helper `$`/`$$`, filter regex, persistensi setelan, penanganan jaringan, serta keutuhan isi panel. Harness wajib mencetak status **0 gagal** (saat ini 189 lulus).
