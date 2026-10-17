# Dokumentasi Arsitektur

Dokumentasi teknis menyeluruh mengenai arsitektur, struktur berkas, urutan injeksi, kontrak rendering, protokol perpesanan, serta alur pengemasan ekstensi **NT DevTools**—konsol debugging seluler untuk Firefox (Manifest V2).

---

## 1. Struktur Berkas & Tanggung Jawab Modul

Proyek ini dirancang tanpa pustaka pihak ketiga (*zero dependencies*) untuk menjamin kinerja ringan dan keandalan tinggi di peramban seluler.

- `manifest.json`  
  Konfigurasi ekstensi utama. Mendeklarasikan `browser_action` (ikon toolbar pada resolusi 16, 32, 48, dan 128 piksel) serta perizinan (*permissions*): `activeTab`, `tabs`, `storage`, `webNavigation`, `webRequest`, `webRequestBlocking`, dan `<all_urls>`.
  - Menggunakan `browser_specific_settings.gecko` (`strict_min_version`: `140.0` karena dukungan fitur keamanan `data_collection_permissions`) serta `gecko_android` (`strict_min_version`: `142.0`).
  - Mendeklarasikan `data_collection_permissions.required = ["none"]` untuk menegaskan komitmen nir-pengumpulan data (*zero data collection*).
  - Mengekspos `icons/icon.png` melalui `web_accessible_resources` untuk tombol melayang (*Floating Action Button* / FAB).
  - **Catatan Penting**: Tidak menggunakan blok `content_scripts` statis; proses injeksi dikendalikan secara dinamis oleh `background.js` saat ikon bilah alat diklik guna menghindari benturan jalur injeksi.

- `background.js`  
  Skrip latar belakang ekstensi. Bertanggung jawab menangani klik ikon bilah alat, menginjeksikan modul secara berurutan, memantau perubahan navigasi (`webNavigation`), memantau lalu lintas jaringan (`webRequest`), serta meneruskan pesan ke *content script*. Seluruh panggilan API `browser.*` dilindungi penanganan galat (*guard*) agar aman saat dimuat.

- `styles.js`  
  Pusat lembar gaya CSS antarmuka. Mengekspor fungsi global `window.MDT_STYLES(IS_MOBILE, IS_FF_MOBILE) -> string`. Seluruh komponen merender ke dalam *light DOM* berakar pada elemen `#mdt-root`.

- `icons-data.js`  
  Repositori definisi ikon SVG internal. Mengekspor objek global `window.MDT_ICONS = { TABS, FAB }` untuk merender ikon tanpa emoji atau simbol Unicode.

- `beautify.js`  
  Modul penyorot sintaks dan pemformat kode (*pretty-printer*) untuk JavaScript, CSS, dan HTML. Mengekspor `window.MDT_BEAUTIFY`.

- `contentScript.js`  
  Skrip orkestrator utama (*orchestrator*). Membangun kontainer `#mdt-root`, seluruh panel tab, REPL konsol interaktif, serta jembatan perpesanan runtime. Mengonsumsi ketiga global `MDT_*` di atas.

- `icons/`  
  Direktori aset visual:
  - `icon.png` — Logo ekstensi untuk tombol melayang.
  - `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` — Ikon ekstensi peramban.

- `test/`  
  Berisi perangkat pengujian runtime berbasis JSDOM (`runtime-harness.js` dan skrip pendukung).

---

## 2. Urutan Injeksi Skrip (Wajib)

Untuk menjamin ketersediaan dependensi global sebelum orkestrator dijalankan, `background.js` wajib menginjeksikan berkas dengan urutan sebagai berikut:

1. `styles.js` — Menyediakan fungsi injeksi gaya `window.MDT_STYLES`.
2. `icons-data.js` — Menyediakan kamus ikon SVG `window.MDT_ICONS`.
3. `beautify.js` — Menyediakan utilitas pemformat kode `window.MDT_BEAUTIFY`.
4. `contentScript.js` — **Paling akhir**, bertindak sebagai orkestrator yang mengonsumsi ketiga global di atas.

Setiap modul dilengkapi penjaga eksistensi (`if (window.MDT_XXX) return;`) untuk menjamin keamanan injeksi ganda.

---

## 3. Kontrak Rendering Ikon SVG

Helper `svgIcon` di dalam `contentScript.js` menerjemahkan string deskriptif dari `MDT_ICONS` menjadi elemen DOM SVG dengan aturan:
- Awalan `"C<cx>,<cy>,<r>"` merender elemen `<circle>`.
- Awalan `"R<x>,<y>,<w>,<h>[,<rx>]"` merender elemen `<rect>`.
- Format lainnya dirender sebagai elemen `<path d="…">`.

Pendekatan ini memastikan antarmuka bebas dari emoji atau glyph Unicode. Sebagai contoh, tanda centang pada penanda titik henti (*breakpoint*) digambar murni menggunakan transformasi CSS (rotasi dua sisi kotak 45 derajat).

---

## 4. Protokol Perpesanan Runtime

### A. Background → Content Script
- `{ action: "toggle" }` — Membuka atau menutup panel konsol.
- `{ action: "setVisibility", visible: boolean }` — Mengatur status visibilitas panel secara eksplisit.
- `{ action: "navigate", url }` — Menandai perpindahan halaman SPA (*Single Page Application*).
- `{ action: "net", phase: "start" | "done" | "error", … }` — Transmisi data lalu lintas jaringan.

*Content script* memberikan respons berupa `{ action: "panelStateChanged", visible }` agar `background.js` dapat merekam status panel per tab peramban.

### B. Content Script → Background
- `{ action: "openUrl", url }` — Membuka tautan eksternal (misalnya tautan repositori pada tab Tentang) melalui API `browser.tabs.create`.

---

## 5. Alur Kerja Build & Pengemasan

Perintah build dijalankan melalui terminal:

```sh
bash build.sh
```

Langkah operasional skrip `build.sh`:
1. Melakukan validasi sintaks JavaScript pada **setiap berkas individual** secara berurutan (menggunakan pemeriksaan iteratif per berkas, bukan pemeriksaan global tunggal yang hanya memvalidasi berkas pertama).
2. Mengemas seluruh berkas sumber yang diperlukan menjadi arsip siap rilis di `test/ntdev-tools.zip`.
3. Menyalin arsip zip ke direktori `/storage/emulated/0/Download/ntdev-tools.zip` sebagai direktori cadangan otomatis (khusus lingkungan Termux).
