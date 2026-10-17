# Sumber & Arsitektur NT DevTools v1.0.0

Dokumentasi teknis berkas ekstensi **NT DevTools**, konsol debugging seluler untuk Firefox
(Manifest V2).

## Struktur Berkas

- `manifest.json` — konfigurasi ekstensi. Memuat `browser_action` (ikon toolbar: `icons/icon-16.png`,
  `icon-32.png`, `icon-48.png`, `icon-128.png`) dan permission `activeTab`, `tabs`, `storage`,
  `webNavigation`, `webRequest`, `webRequestBlocking`, `<all_urls>`. Menyatakan
  `browser_specific_settings.gecko` (`strict_min_version` 140.0, karena `data_collection_permissions`
  baru didukung sejak Firefox 140) dan `gecko_android` (`strict_min_version` 142.0), serta
  `data_collection_permissions.required = ["none"]` (ekstensi tidak mengumpulkan data apa pun).
  `web_accessible_resources` memuat `icons/icon.png` yang dipakai tombol melayang (FAB).
  **Tidak** memakai `content_scripts`; injeksi dikendalikan `background.js` saat ikon diklik.
- `background.js` — skrip latar belakang. Menangani klik ikon, menginjeksikan modul secara
  berurutan, memantau navigasi (`webNavigation`) dan lalu lintas jaringan (`webRequest`), lalu
  mengirim pesan ke content script. Semua pemakaian API `browser.*` dijaga agar tidak melempar saat
  dimuat.
- `styles.js` — seluruh lembar gaya CSS antarmuka. Mengekspor
  `window.MDT_STYLES(IS_MOBILE, IS_FF_MOBILE) -> string`. Menargetkan *light DOM* berakar `#mdt-root`.
- `icons-data.js` — data ikon SVG. Mengekspor `window.MDT_ICONS = { TABS, FAB }`.
- `beautify.js` — penyorot sintaks dan pemformat (pretty-printer) untuk JavaScript, CSS, dan HTML.
  Mengekspor `window.MDT_BEAUTIFY`.
- `contentScript.js` — **orchestrator**: membangun `#mdt-root`, seluruh panel, REPL, dan jembatan
  pesan runtime. Mengonsumsi ketiga global `MDT_*` di atas.
- `icons/icon.png` — logo ekstensi (dipakai tombol melayang via `web_accessible_resources`).
- `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png` — ikon terukur
  yang dideklarasikan di manifest.
- `test/runtime-harness.js`, `test/run-runtime-test.sh` — uji runtime berbasis JSDOM.

## Urutan Injeksi (wajib)

`background.js` menginjeksikan berkas dengan urutan:

1. `styles.js` — menyediakan `window.MDT_STYLES`.
2. `icons-data.js` — menyediakan `window.MDT_ICONS`.
3. `beautify.js` — menyediakan `window.MDT_BEAUTIFY`.
4. `contentScript.js` — **paling akhir**, karena mengonsumsi ketiga global di atas.

Setiap modul memakai guard `if (window.MDT_XXX) return;` agar aman diinjeksi lebih dari sekali.

## Kontrak Ikon SVG

Helper `svgIcon` di `contentScript.js` menafsirkan string ikon dari `MDT_ICONS`:

- `"C<cx>,<cy>,<r>"` → elemen `<circle>`.
- `"R<x>,<y>,<w>,<h>[,<rx>]"` → elemen `<rect>`.
- selain itu → elemen `<path d="…">`.

Karena itu tidak ada emoji/glyph unicode di antarmuka. Tanda centang pada kotak titik henti pun
digambar murni dengan CSS (dua sisi kotak diputar 45 derajat), bukan karakter `✓`.

## Pesan Runtime (background → content script)

- `{action:"toggle"}` — buka/tutup panel.
- `{action:"setVisibility", visible:boolean}` — tetapkan status panel.
- `{action:"navigate", url}` — halaman SPA berpindah.
- `{action:"net", phase:"start"|"done"|"error", …}` — lalu lintas jaringan.

Content script membalas `{action:"panelStateChanged", visible}` agar `background.js` menyimpan
status panel per tab.

Pesan dari content script → background:

- `{action:"openUrl", url}` — membuka tautan (mis. repo sumber di tab Tentang) lewat
  `browser.tabs.create`.

## Alur Kerja Build

```sh
./build.sh
```

1. Memvalidasi sintaks **setiap** berkas JavaScript satu per satu (gelung, bukan `node -c` sekali
   untuk semua berkas — perintah itu hanya memeriksa berkas pertama).
2. Mengemas ekstensi menjadi `test/ntdev-tools.zip`.
3. Menyalin zip ke `/storage/emulated/0/Download/ntdev-tools.zip` sebagai cadangan.
