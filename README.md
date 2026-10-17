# NT DevTools (v1.0.0)

[![Versi AMO](https://img.shields.io/amo/v/nt-devtools?label=versi&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Pengguna](https://img.shields.io/amo/users/nt-devtools?label=pengguna&logo=firefoxbrowser&logoColor=white&color=ff7139)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Firefox Android & Desktop](https://img.shields.io/badge/firefox-android%20%7C%20desktop-ff7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Manifest V2](https://img.shields.io/badge/manifest-v2-orange.svg)](manifest.json)
[![Lisensi MIT](https://img.shields.io/badge/lisensi-MIT-blue.svg)](LICENSE)
[![Tanpa dependensi](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Tanpa pengumpulan data](https://img.shields.io/badge/data%20collection-none-brightgreen.svg)](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
[![Uji lulus](https://img.shields.io/badge/tes-188%20lulus-success.svg)](test/runtime-harness.js)
[![Bahasa Indonesia](https://img.shields.io/badge/bahasa-Indonesia-red.svg)]()

**Pasang di Firefox (AMO):** https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/

**NT DevTools** adalah konsol pengembang web yang dirancang khusus untuk **debugging di perangkat
seluler (mobile web debugging)**. Terinspirasi dari kemudahan sistem konsol seluler kelas Eruda,
tetapi dengan identitas, kode, dan penamaan sendiri (**NT Dev**), tanpa menyalin aset atau merek
pihak lain.

Seluruh antarmuka bebas emoji: setiap ikon tab adalah **SVG murni** (lihat `icons-data.js`). Tombol
melayang (FAB) memakai berkas ikon ekstensi (`icons/icon.png`).

## Cara Memakai

1. Pasang ekstensi dari
   [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/)
   (Firefox Android/desktop). Untuk pengembangan, bisa juga dimuat sementara lewat `about:debugging`.
2. Buka halaman web biasa (`http://` atau `https://`).
3. Ketuk/klik ikon **NT DevTools** di toolbar. Panel konsol muncul di bagian bawah layar.
4. Ketuk ikon lagi untuk membuka/menutup panel. Panel juga bisa ditutup lewat tombol silang,
   dan dibuka kembali lewat tombol melayang (FAB).

Injeksi hanya terjadi saat ikon toolbar diklik — `manifest.json` sengaja **tidak** memakai blok
`content_scripts`, sehingga tidak ada dua jalur injeksi yang bertabrakan.

## Tab & Kemampuan

| Tab | Id | Isi |
|-----|----|-----|
| Elemen | `elements` | Pohon DOM berjelajah + auto-refresh saat DOM berubah, breadcrumb, pencari tag/#id/.kelas, pemilih elemen (*pick*) dengan sorotan, edit atribut & teks inline, hapus node, salin HTML/selektor, tab *Styles* (edit CSS langsung) / *Computed* / *Box Model* / *Event Listeners*, dan jadikan `$0` |
| Konsol | `console` | Penangkapan `console.*` (termasuk `table`, `dir`, `time`, `assert`, `count`, `trace`, `group`), error tak tertangkap & `unhandledrejection` dengan jejak tumpukan, filter tingkat/kata kunci/regex, REPL dengan autocomplete serta helper `$`/`$$`/`$0`/`$_`, objek bertingkat yang bisa dibuka, salin log, tombol bersihkan |
| Sumber | `sources` | Daftar `<script>`/`<style>`/`<link>` halaman, editor dengan nomor baris, penyorotan sintaks (`beautify.js`), tombol "Perindah", sidebar debugger (penanda titik henti — lihat *Catatan*), dan sub-tab **Cuplikan** |
| Jaringan | `network` | Baris permintaan dari `webRequest` (metode, status, durasi, waterfall) dengan filter **tipe** (XHR/Fetch/Document/Script/Stylesheet/Image/Media/Font/Lainnya) dan **status** (2xx–5xx/gagal) digabung filter URL; detail Headers/Payload/Response ditambah tab **Body** (request & respons, mentah/terformat, JSON pretty-print) dan **Cookies**; tombol **Salin sebagai cURL** & **Salin respons**; plus data *Resource Timing* |
| Kinerja | `perf` | FPS meter (requestAnimationFrame), metrik navigasi (TTFB/DOMContentLoaded/load), memori, jumlah node |
| Aplikasi | `storage` | localStorage, sessionStorage, cookies, IndexedDB, Cache Storage — tampilan tabel, pencarian, hapus item |
| Perangkat | `ua` | User agent, platform, bahasa, resolusi layar & viewport, DPR, orientasi, koneksi, jumlah CPU, memori perangkat |
| Tentang | `about` | Deskripsi, penulis (**NT Dev**), lisensi (MIT), tautan sumber, kredit Eruda, serta panduan singkat tiap modul |
| Pengaturan | `settings` | Tema terang, transparansi, tinggi panel, ukuran font, aktif/nonaktif tab, opsi Konsol (batas log, tampilkan waktu, properti non-enumerable, getter, render asinkron), dan reset |

**Cuplikan** (sub-tab di Sumber) menyediakan snippet siap pakai (mis. hapus semua cookie, ambil
semua gambar, ukur performa) serta menyimpan snippet buatan sendiri di `localStorage`.

## Keunggulan

- **Mobile-first** — target sentuh besar, tata letak tahan layar sempit, `env(safe-area-inset-bottom)`.
- **100% SVG Icons** — tanpa emoji/unicode-simbol (FAB memakai ikon ekstensi).
- **Zero dependencies** — tanpa pustaka eksternal.
- **Backup otomatis** — setiap `./build.sh` menyalin hasil zip ke
  `/storage/emulated/0/Download/ntdev-tools.zip`.

## Privasi & Rilis (AMO)

- Ekstensi **sudah terbit di AMO**:
  https://addons.mozilla.org/en-US/firefox/addon/nt-devtools/
- Ekstensi **tidak mengumpulkan dan tidak mengirim data apa pun**; semua pemrosesan terjadi lokal di
  perangkat. Karena itu `manifest.json` memakai
  `browser_specific_settings.gecko.data_collection_permissions = { "required": ["none"] }`.
- Penangkapan body respons (tab **Body**) berjalan **lokal**, dibatasi ~256 KB, tidak mengubah byte
  respons (passthrough), dan dapat dimatikan lewat Pengaturan → "Tangkap body respons".
- Ikon disediakan pada ukuran 16/32/48/128 px (`icons/icon-16.png` … `icons/icon-128.png`).
- Linter Mozilla (`web-ext lint`) melaporkan **0 error**. Peringatan yang tersisa hanya
  `DANGEROUS_EVAL` dari REPL Konsol — wajar dan memang diperlukan oleh konsol (sama seperti Eruda).

## Catatan (belum diimplementasikan)

Agar tidak menyesatkan, hal berikut **belum** ada pada versi ini:

- **Application**: inspeksi *web manifest* dan *service worker* — belum ada (tab Aplikasi fokus pada
  penyimpanan).
- **Debugger** di tab Sumber baru bersifat visual (penanda titik henti); belum ada *stepping* JS nyata.
- Tombol melayang (FAB) belum bisa digeser/diatur posisinya.

## Build (Untuk anda tester ke firefox night)

```sh
chmod +x build.sh
./build.sh
```

Memuat modul di dalam JSDOM dengan tiruan API `browser.*`, lalu memverifikasi `#mdt-root`, 9 tab,
ikon SVG, pembukaan/penutupan lewat pesan runtime, hook konsol (termasuk `table`/`group`/`time`/
`assert`/`count`/`clear`), jejak tumpukan, autocomplete REPL, helper `$`/`$$`, filter regex,
penyimpanan setelan, pesan jaringan, dan isi panel. Harus mencetak **0 gagal**.
