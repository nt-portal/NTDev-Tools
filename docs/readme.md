# Dokumentasi Arsitektur

Dokumentasi teknis menyeluruh mengenai arsitektur, struktur berkas, urutan injeksi, kontrak rendering, protokol perpesanan, serta alur pengemasan ekstensi **NT DevTools** (versi 1.1.0), konsol debugging seluler untuk Firefox (Manifest V2). ID ekstensi: `ntdevtools@ntdev.org`.

---

## 1. Struktur Berkas & Tanggung Jawab Modul

Proyek ini dirancang tanpa pustaka pihak ketiga (*zero dependencies*) untuk menjamin kinerja ringan dan keandalan tinggi di peramban seluler.

- `manifest.json`  
  Konfigurasi ekstensi utama. Mendeklarasikan `browser_action` (ikon bilah alat pada resolusi 16, 32, 48, dan 128 piksel) serta perizinan (*permissions*): `activeTab`, `tabs`, `storage`, `webNavigation`, `webRequest`, dan `<all_urls>`.
  - Menggunakan `browser_specific_settings.gecko` (`strict_min_version`: `140.0` karena dukungan fitur keamanan `data_collection_permissions`) serta `gecko_android` (`strict_min_version`: `142.0`).
  - Mendeklarasikan `data_collection_permissions.required = ["none"]` untuk menegaskan komitmen nir-pengumpulan data (*zero data collection*).
  - Mengekspos `icons/icon.png` dan `injected.js` melalui `web_accessible_resources`. `icons/icon.png` dipakai untuk tombol melayang (*Floating Action Button* / FAB), sedangkan `injected.js` perlu dapat dimuat sebagai skrip halaman di dunia utama.
  - Mendeklarasikan blok `content_scripts` statis dengan dua entri (lihat bagian 2): `bootstrap.js` pada dunia terisolasi dan `injected.js` pada dunia utama (`world: "MAIN"`), keduanya `run_at: document_start` dan `all_frames: false`.

- `background.js`  
  Skrip latar belakang ekstensi. Bertanggung jawab menangani klik ikon bilah alat dan menginjeksikan modul secara berurutan, memantau perubahan navigasi (`webNavigation`), serta memantau lalu lintas jaringan (`webRequest`). Setelah panel diinjeksi, `background.js` mengirim status visibilitas dengan mekanisme coba ulang `sendVisibilityWithRetry` (hingga 10 kali dengan jeda 200 ms) untuk mengatasi panel yang belum siap menerima pesan. Indikator galat ditampilkan melalui helper `setBadge` (dengan penjaga agar aman pada `browserAction` maupun `action`). Seluruh panggilan API `browser.*` dilindungi penanganan galat (*guard*) agar aman saat dimuat.

- `bootstrap.js`  
  *Content script* dunia terisolasi yang berjalan pada `document_start` di setiap halaman. Membuat buffer `window.__mdtEarlyLogs` (maksimal 1000 entri), menyuntikkan `injected.js` sedini mungkin melalui elemen `<script src>`, menandai `window.__mdtBridgeInjected`, dan menyimpan pesan `mdt-console` yang datang lebih awal ke dalam buffer. Setelah `contentScript.js` termuat, buffer dikuras (*drain*) lalu diatur ke `null` (`window.__mdtEarlyLogs = null`).

- `injected.js`  
  Jembatan dunia utama (*main world*). Men-hook seluruh metode `console.*` serta menangkap peristiwa `error` dan `unhandledrejection`, menerima perintah evaluasi REPL dari *content script*, dan menjalankannya di konteks halaman. Bersifat idempoten melalui penanda `window.__mdtConsoleHooked`. Komunikasi dengan *content script* memakai `window.postMessage`.

- `styles.js`  
  Pusat lembar gaya CSS antarmuka. Mengekspor fungsi global `window.MDT_STYLES(IS_MOBILE, IS_FF_MOBILE) -> string`. Seluruh komponen merender ke dalam *light DOM* berakar pada elemen `#mdt-root`.

- `icons-data.js`  
  Repositori definisi ikon SVG internal. Mengekspor objek global `window.MDT_ICONS = { TABS, FAB }` untuk merender ikon tanpa emoji atau simbol Unicode.

- `beautify.js`  
  Modul penyorot sintaks dan pemformat kode (*pretty-printer*) untuk JavaScript, CSS, dan HTML. Mengekspor `window.MDT_BEAUTIFY`.

- `contentScript.js`  
  Skrip orkestrator utama (*orchestrator*). Membangun kontainer `#mdt-root`, seluruh panel tab, REPL konsol interaktif, serta jembatan perpesanan runtime. Mengonsumsi ketiga global `MDT_*` di atas. Menyediakan 11 id tab: `elements`, `console`, `sources`, `network`, `perf`, `storage`, `map`, `timing`, `ua`, `about`, dan `settings`. Konstanta `CONFIG_PANELS` mencakup 10 panel (tanpa `settings`), dan panel `map` serta `timing` nonaktif secara baku.

- `icons/`  
  Direktori aset visual:
  - `icon.png`: Logo ekstensi untuk tombol melayang.
  - `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`: Ikon ekstensi peramban.

- `test/`  
  Berisi perangkat pengujian runtime berbasis JSDOM (`runtime-harness.js` dan skrip pendukung, termasuk `run-runtime-test.sh`).

- Berkas pendukung lain (non-kode):  
  - `readme.md`: dokumentasi tingkat proyek.
  - `LICENSE`: lisensi MIT.
  - `CONTRIBUTING.md`: panduan kontribusi.
  - `SECURITY.md`: kebijakan pelaporan kerentanan.
  - `docs/`: dokumentasi arsitektur (berkas ini).

---

## 2. Urutan Injeksi Skrip (Wajib)

Terdapat **dua jalur injeksi** yang berjalan terpisah: jalur statis melalui blok `content_scripts` (selalu jalan pada setiap halaman) dan jalur dinamis melalui `background.js` saat ikon bilah alat diklik.

### A. Jalur statis via `content_scripts` (document_start)

Dijalankan peramban pada setiap halaman, sebelum *content script* dinamis termuat. Urutan penting karena `bootstrap.js` bertugas menyuntikkan jembatan dunia utama lebih dulu:

1. `bootstrap.js`: Berjalan di dunia terisolasi (`document_start`, `all_frames: false`). Membuat buffer `window.__mdtEarlyLogs`, menyuntikkan `injected.js` via elemen `<script src>`, menandai `window.__mdtBridgeInjected`, dan merekam pesan `mdt-console` awal.
2. `injected.js`: Berjalan di dunia utama (`world: "MAIN"`, `document_start`, `all_frames: false`). Men-hook `console.*`, menangkap `error`/`unhandledrejection`, dan menangani eval REPL di konteks halaman.

Panel antarmuka tidak dibuat oleh kedua berkas ini; `contentScript.js` tetap diinjeksi dinamis oleh `background.js` saat ikon bilah alat diklik.

### B. Jalur dinamis via `background.js` saat ikon bilah alat diklik (`tabs.executeScript`)

Untuk menjamin ketersediaan dependensi global sebelum orkestrator dijalankan, `background.js` wajib menginjeksikan berkas dengan urutan sebagai berikut:

1. `styles.js`: Menyediakan fungsi injeksi gaya `window.MDT_STYLES`.
2. `icons-data.js`: Menyediakan kamus ikon SVG `window.MDT_ICONS`.
3. `beautify.js`: Menyediakan utilitas pemformat kode `window.MDT_BEAUTIFY`.
4. `contentScript.js`: **Paling akhir**, bertindak sebagai orkestrator yang mengonsumsi ketiga global di atas.

Setiap modul pada kedua jalur dilengkapi penjaga idempoten (`if (window.MDT_XXX) return;` atau penanda sejenis) untuk menjamin keamanan injeksi ganda.

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
- `{ action: "toggle" }`: Membuka atau menutup panel konsol.
- `{ action: "setVisibility", visible: boolean }`: Mengatur status visibilitas panel secara eksplisit.
- `{ action: "navigate", url }`: Menandai perpindahan halaman SPA (*Single Page Application*).
- `{ action: "net", phase: "start" | "done" | "error", … }`: Transmisi data lalu lintas jaringan.

*Content script* memberikan respons berupa `{ action: "panelStateChanged", visible }` agar `background.js` dapat merekam status panel per tab peramban.

### B. Content Script → Background
- `{ action: "openUrl", url }`: Membuka tautan eksternal (misalnya tautan repositori pada tab Tentang) melalui API `browser.tabs.create`.

### C. Jembatan Dunia Utama via `window.postMessage`

Menghubungkan `injected.js` (dunia utama) dengan `contentScript.js` (dunia terisolasi) melalui `window.postMessage`, dibedakan dengan penanda field `source`:

- `mdt-console`: Entri log atau galat yang berasal dari halaman.
- `mdt-console-ready`: Menandakan jembatan dunia utama siap. Setelah diterima, *content script* melepas hook lokal (fallback) agar pencatatan tidak ganda.
- `mdt-eval`: Perintah evaluasi dari *content script* (berisi `id` dan kode) yang akan dijalankan `injected.js` di konteks halaman.
- `mdt-eval-result`: Hasil evaluasi yang dikembalikan `injected.js` ke *content script*.

Protokol pada bagian A dan B (toggle, setVisibility, navigate, net; content ke background: openUrl, panelStateChanged) tetap berlaku.

---

## 5. Alur Kerja Build & Pengemasan

Perintah build dijalankan melalui terminal:

```sh
bash build.sh
```

Langkah operasional skrip `build.sh`:
1. Memvalidasi sintaks JavaScript **setiap berkas satu per satu** dalam sebuah gelung memakai `node --check`: `bootstrap.js`, `background.js`, `contentScript.js`, `styles.js`, `beautify.js`, `icons-data.js`, dan `injected.js`.
2. Mengemas berkas sumber (`manifest.json` + 7 berkas JS + direktori `icons/`) menjadi arsip siap rilis di `test/ntdev-tools.zip`.

Skrip build tidak menyalin arsip ke lokasi eksternal mana pun.

### Pengujian Runtime

Perintah:

```sh
bash test/run-runtime-test.sh
```

Skrip ini memasang jsdom secara otomatis di direktori sementara, lalu menjalankan `test/runtime-harness.js`. Hasil saat ini: 189 lulus, 0 gagal.
