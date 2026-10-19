/**
 * NT DevTools - Perekam Log Awal (bootstrap.js)
 *
 * Berkas ini adalah content script dunia terisolasi yang dijalankan pada
 * document_start, SEBELUM skrip halaman sempat menulis log apa pun. Tujuannya
 * menangkap log konsol yang terjadi sangat awal (sebelum ikon toolbar diklik)
 * agar tidak hilang.
 *
 * Cara kerja:
 *   1. Membuat buffer window.__mdtEarlyLogs (maksimum 1000 entri; entri
 *      terlama dibuang bila melewati batas).
 *   2. Menyuntikkan injected.js ke dunia utama halaman sedini mungkin lewat
 *      elemen <script src>, lalu menandai window.__mdtBridgeInjected agar
 *      content script utama tidak menyuntik ulang.
 *   3. Mendengarkan pesan "mdt-console" dari jembatan dunia utama dan
 *      menyimpannya ke buffer selama buffer masih berupa array.
 *
 * Setelah contentScript.js utama termuat, ia mengosongkan (drain) buffer ini
 * lalu menetapkan window.__mdtEarlyLogs = null sehingga bootstrap berhenti
 * menyimpan. Seluruh berkas dibungkus try/catch agar tidak pernah melempar
 * ke halaman.
 *
 * Idempoten: dijaga oleh window.__mdtEarlyLogs.
 */
(function () {
  "use strict";

  try {
    /* Guard idempoten: jangan pasang ulang bila sudah berjalan. */
    if (window.__mdtEarlyLogs) return;

    var MAX_ENTRIES = 1000;
    window.__mdtEarlyLogs = [];

    /* Suntikkan jembatan dunia utama (injected.js) sedini mungkin. */
    try {
      var rt = null;
      try {
        if (typeof chrome !== "undefined" && chrome && chrome.runtime) rt = chrome.runtime;
      } catch (e0) {}
      if (!rt) {
        try {
          if (typeof browser !== "undefined" && browser && browser.runtime) rt = browser.runtime;
        } catch (e1) {}
      }
      if (rt && typeof rt.getURL === "function") {
        var s = document.createElement("script");
        s.src = rt.getURL("injected.js");
        s.async = false;
        (document.head || document.documentElement).appendChild(s);
        s.remove();
        window.__mdtBridgeInjected = true;
      }
    } catch (e2) {
      /* Bila halaman memiliki CSP ketat, content script utama akan memakai
         hook lokal sebagai cadangan. */
    }

    /* Simpan entri log awal selagi buffer belum diambil content script utama.
       Setelah diambil, window.__mdtEarlyLogs menjadi null dan penyimpanan
       otomatis berhenti. */
    window.addEventListener("message", function (event) {
      try {
        if (event.source !== window) return;
        var data = event && event.data;
        if (!data || data.source !== "mdt-console") return;
        if (!Array.isArray(window.__mdtEarlyLogs)) return;
        window.__mdtEarlyLogs.push({
          source: "mdt-console",
          method: data.method,
          args: data.args,
          stack: data.stack
        });
        /* Batasi jumlah entri: buang yang terlama bila melewati batas. */
        if (window.__mdtEarlyLogs.length > MAX_ENTRIES) {
          window.__mdtEarlyLogs.splice(0, window.__mdtEarlyLogs.length - MAX_ENTRIES);
        }
      } catch (e3) {}
    });
  } catch (e) {
    /* Jangan pernah melempar ke halaman. */
  }
})();
