/**
 * NT DevTools — Data ikon
 *
 * Tujuan modul: murni data. Berisi string path SVG untuk bilah tab dan tombol
 * aksi melayang (floating action button). Tidak ada logika di sini.
 *
 * Konvensi pengodean yang dikenali oleh helper svg() di contentScript.js:
 *
 *   "C<cx>,<cy>,<r>"            -> <circle> (lingkaran berpusat cx,cy radius r)
 *   "R<x>,<y>,<w>,<h>[,<rx>]"   -> <rect>   (persegi di x,y berukuran w*h,
 *                                            sudut membulat rx bersifat opsional)
 *   selain kedua pola di atas   -> <path d="…"> (path SVG biasa)
 *
 * Ekspor ke window (window.MDT_ICONS):
 *   TABS — larik objek { id, label, icon[] } yang mendeskripsikan tiap tab
 *          pada bilah atas.
 *   FAB  — larik string path untuk tombol aksi melayang (membuka kembali panel).
 *
 * Catatan pemakaian: cukup dibaca oleh helper svg(); modul idempoten dan tidak
 * menyimpan status.
 */
"use strict";

(function () {
  if (window.MDT_ICONS) return;

  window.MDT_ICONS = {
    /* Daftar tab bilah atas: tiap entri punya id internal, label tampilan,
       dan larik path ikon. */
    TABS: [
      { id: "elements",  label: "Elements",    icon: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 0-2-2z", "M9 22V12h6v10"] },
      { id: "console",   label: "Console",     icon: ["M4 17L10 11 4 5", "M12 19H20"] },
      { id: "sources",   label: "Sources",     icon: ["M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z", "M14 3v5h5"] },
      { id: "network",   label: "Network",     icon: ["M5 12.55a11 11 0 0 1 14.08 0", "M1.42 9a16 16 0 0 1 21.16 0", "M8.53 16.11a6 6 0 0 1 6.95 0", "C12,21,1"] },
      { id: "perf",      label: "Performance", icon: ["M12 20V10", "M18 20V4", "M6 20v-4"] },
      { id: "storage",   label: "Application", icon: ["R2,2,20,8,2", "R2,14,20,8,2", "M6 6h.01M6 18h.01"] },
      { id: "ua",        label: "Device",      icon: ["R5,2,14,20,2", "M12 18h.01"] },
      /* Ikon info untuk tab Tentang (menggantikan ikon tab Guide lama). */
      { id: "about",     label: "About",       icon: ["C12,12,9", "M12 10.5v5", "M12 7.5h.01"] },
      /* Ikon roda gigi untuk tab Pengaturan. */
      { id: "settings",  label: "Settings",    icon: ["C12,12,3", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"] }
    ],
    /* Ikon kurung kode (menggantikan ikon perisai lama sejak versi < 3.6) */
    /* Ikon tombol aksi melayang (membuka kembali panel): larik path SVG. */
    FAB: ["M16 18l6-6-6-6", "M8 6l-6 6 6 6"]
  };
})();
