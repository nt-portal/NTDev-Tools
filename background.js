/**
 * NT DevTools — Skrip Latar Belakang (Background Script, Manifest V2 Firefox)
 *
 * Berjalan di latar belakang browser untuk:
 *  1. Menangani klik ikon toolbar (browser_action) sebagai SATU-SATUNYA jalur injeksi.
 *  2. Menyuntik modul NT DevTools secara berurutan ke tab aktif.
 *  3. Memantau navigasi halaman dan lalu lintas jaringan, lalu meneruskannya ke content script.
 *
 * Catatan arsitektur: manifest.json sengaja TIDAK memakai blok "content_scripts" untuk
 * auto-inject. Injeksi hanya boleh terjadi saat pengguna mengklik ikon toolbar, yang diatur
 * di berkas ini. Dengan demikian tidak ada dua jalur injeksi (auto-inject + klik ikon) yang
 * saling bertabrakan dan menggandakan panel konsol.
 *
 * Aturan penting: tidak boleh ada satu pun pemanggilan API browser.* yang bisa melempar
 * (throw) saat skrip dimuat. Setiap API yang mungkin tidak tersedia selalu dijaga (guard).
 */
"use strict";

// Set untuk melacak ID tab mana saja yang sudah berhasil diinjeksi modul NT DevTools.
const injectedTabs = new Set();

// Peta (Map) untuk menyimpan status visibilitas panel konsol di setiap tab.
const tabPanelState = new Map();

// Menyimpan permintaan jaringan yang masih berjalan, dikunci dengan requestId.
// Dipakai untuk menggabungkan informasi sebelum/selama/sesudah respons menjadi satu entri.
const pending = new Map();

// Menyimpan body respons yang tertangkap (FASE 4), dikunci dengan requestId.
// Isi diambil lewat filterResponseData() pada onHeadersReceived, lalu disertakan
// sebagai field OPSIONAL resBody pada pesan fase "done".
const resBodies = new Map();

// Kunci requestId yang sudah dipasangi filter respons (agar onCompleted tahu
// apakah perlu menunggu body) dan yang filternya sudah selesai (onstop/onerror).
// Bila onCompleted tiba SEBELUM onstop, fase "done" ditunda di resWaiters
// supaya body respons tidak hilang karena urutan kejadian yang tak dijamin.
const capturedIds = new Set();
const resStopped = new Set();
const resWaiters = new Map();

// Batas ukuran body yang disimpan (256 KB). Melebihi batas ini ditandai terpotong.
const BODY_MAX = 256 * 1024;

// Flag pengaturan "Tangkap body respons" (default aktif). Nilai sebenarnya dibaca
// dari browser.storage.local kunci "mdt-settings" dan dapat berubah saat berjalan.
let captureBody = true;

/* =========================================================================
   Utilitas aman (penjaga API)
   Beberapa API browser.* dapat bernilai undefined tergantung versi/permission.
   Helper berikut memastikan pemanggilannya tidak pernah melempar saat skrip dimuat.
   ========================================================================= */

/**
 * Mengirim pesan ke content script di tab tertentu dengan aman.
 * Bila API tabs.sendMessage tidak tersedia, fungsi ini hanya mengembalikan Promise
 * yang sudah selesai (tidak melakukan apa pun) alih-alih melempar galat.
 * @param {number} tabId - ID tab tujuan
 * @param {object} message - Objek pesan runtime yang akan dikirim
 * @returns {Promise<void>}
 */
function sendToTab(tabId, message) {
  if (!browser.tabs || typeof browser.tabs.sendMessage !== "function") return Promise.resolve();
  try {
    const result = browser.tabs.sendMessage(tabId, message);
    // Beberapa varian API mengembalikan Promise, sebagian lagi nilai langsung.
    return result && typeof result.catch === "function" ? result.catch(() => {}) : Promise.resolve(result);
  } catch (e) {
    return Promise.resolve();
  }
}

/**
 * Mengirim pesan ke content script dan MEMPERTAHANKAN galat (tidak ditelan).
 * Dipakai khusus oleh mekanisme retry: sendToTab menelan galat sehingga
 * retry tidak akan pernah berjalan, sementara fungsi ini membiarkan Promise
 * ditolak ketika listener content script belum siap (race condition pasca-injeksi).
 * @param {number} tabId - ID tab tujuan
 * @param {object} message - Objek pesan runtime yang akan dikirim
 * @returns {Promise<*>}
 */
function sendToTabStrict(tabId, message) {
  if (!browser.tabs || typeof browser.tabs.sendMessage !== "function") {
    return Promise.reject(new Error("API browser.tabs.sendMessage tidak tersedia."));
  }
  try {
    return Promise.resolve(browser.tabs.sendMessage(tabId, message));
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * Menampilkan umpan balik error pada badge ikon toolbar dengan aman.
 * Tidak pernah melempar bila API badge tidak tersedia (mis. varian browser lain).
 * @param {number} tabId - ID tab yang badgenya diubah
 * @param {string} text - Teks badge ("" untuk membersihkan)
 * @param {string} [color] - Warna latar badge (opsional)
 */
function setBadge(tabId, text, color) {
  try {
    const api = browser.browserAction || browser.action;
    if (!api) return;
    if (typeof api.setBadgeText === "function") api.setBadgeText({ text: text, tabId: tabId });
    if (color && typeof api.setBadgeBackgroundColor === "function") {
      api.setBadgeBackgroundColor({ color: color, tabId: tabId });
    }
  } catch (e) {}
}

/* =========================================================================
   1. Sinkronisasi status panel yang dikirim oleh content script
   ========================================================================= */

if (browser.runtime && typeof browser.runtime.onMessage !== "undefined") {
  browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.action === "panelStateChanged" && sender && sender.tab && sender.tab.id) {
      tabPanelState.set(sender.tab.id, !!msg.visible);
    }
    /* Buka tautan (mis. tautan repo di panel Tentang) melalui API tabs. */
    if (msg && msg.action === "openUrl" && typeof msg.url === "string" && /^https?:\/\//i.test(msg.url)) {
      try {
        if (browser.tabs && browser.tabs.create) {
          browser.tabs.create({ url: msg.url });
        }
      } catch (e) {
        console.warn("NT DevTools: gagal membuka tautan:", e && e.message);
      }
    }
  });
} else {
  console.warn("NT DevTools: API browser.runtime.onMessage tidak tersedia; status panel tidak akan tersinkron.");
}

/* =========================================================================
   2. Urutan injeksi modul — TIDAK BOLEH DIUBAH
   Setiap modul menaruh global window.MDT_* yang dibaca modul berikutnya.
   contentScript.js WAJIB paling akhir karena mengonsumsi seluruh modul sebelumnya
   (styles.js -> icons-data.js -> beautify.js -> contentScript.js).
   ========================================================================= */

const MDT_MODULES = [
  "styles.js",       // Lembar gaya CSS dan ikon SVG antarmuka (window.MDT_STYLES)
  "icons-data.js",   // Repositori data grafik vektor SVG (window.MDT_ICONS)
  "beautify.js",     // Pustaka pemformatan/pembersihan kode sumber (window.MDT_BEAUTIFY)
  "contentScript.js" // Skrip utama konsol; DIINJEKSI PALING AKHIR karena mengonsumsi semua di atas
];

/**
 * Menyuntik daftar berkas skrip secara berurutan ke dalam tab target.
 * Urutan dijamin karena setiap skrip di-chain dengan .then() sebelum skrip berikutnya.
 * @param {number} tabId - ID tab browser target
 * @param {string[]} files - Daftar berkas skrip yang akan diinjeksi (berurutan)
 * @returns {Promise<void>}
 */
function injectModulesSequentially(tabId, files) {
  if (!browser.tabs || typeof browser.tabs.executeScript !== "function") {
    return Promise.reject(new Error("API browser.tabs.executeScript tidak tersedia."));
  }
  return files.reduce(
    (chain, file) => chain.then(() => browser.tabs.executeScript(tabId, {
      file,
      runAt: "document_idle",
      allFrames: false
    })),
    Promise.resolve()
  );
}

/**
 * Mengirim pesan dengan retry logic untuk menghindari race condition saat injeksi.
 * Memakai sendToTabStrict agar penolakan Promise benar-benar terdeteksi: setelah
 * modul diinjeksi, listener content script bisa belum terdaftar sesaat, sehingga
 * pesan pertama gagal. Percobaan diulang dengan jeda 200 ms hingga retries habis.
 * @param {number} tabId - ID tab tujuan
 * @param {boolean} visible - Status visibilitas
 * @param {number} retries - Sisa percobaan
 */
function sendVisibilityWithRetry(tabId, visible, retries = 10) {
  sendToTabStrict(tabId, { action: "setVisibility", visible: visible })
    .catch(() => {
      if (retries > 0) {
        setTimeout(() => sendVisibilityWithRetry(tabId, visible, retries - 1), 200);
      } else {
        // Retry habis: tampilkan umpan balik error berupa badge.
        setBadge(tabId, "!", "#e74c3c");
      }
    });
}

/**
 * Melakukan proses injeksi lengkap ke tab dan mengatur visibilitas panel konsol.
 * @param {number} tabId - ID tab target
 * @param {boolean} panelVisible - Status visibilitas awal panel
 */
function doInject(tabId, panelVisible) {
  injectModulesSequentially(tabId, MDT_MODULES)
    .then(() => {
      injectedTabs.add(tabId);
      // Injeksi sukses: bersihkan umpan balik error sebelumnya pada badge.
      setBadge(tabId, "", null);
      sendVisibilityWithRetry(tabId, panelVisible !== false);
    })
    .catch(e => {
      console.warn("Injeksi NT DevTools gagal:", e);
      // Umpan balik error berupa badge (aman bila API badge tidak tersedia).
      setBadge(tabId, "!", "#e74c3c");
    });
}

/* =========================================================================
   3. Penanganan klik ikon toolbar (satu-satunya jalur injeksi)
   Gunakan browser.browserAction (Firefox MV2) dengan cadangan browser.action
   agar kompatibel lintas varian API. Pendaftaran dijaga dengan if agar tidak
   melempar TypeError yang bisa mematikan seluruh skrip background.
   ========================================================================= */

/**
 * Menangani klik ikon ekstensi di toolbar.
 * Jika tab sudah pernah diinjeksi, cukup kirim toggle. Jika belum, lakukan injeksi penuh.
 * @param {object} tab - Objek tab yang aktif saat ikon diklik
 */
function onToolbarClicked(tab) {
  if (!tab || !tab.id || tab.id < 0) return;
  const url = tab.url || "";

  /* Abaikan hanya skema internal browser yang memang tidak dapat disuntik skrip:
     about:, moz-extension:, chrome:, edge:, dan firefox:.
     PENTING: file:// dan http(s):// sengaja TIDAK di-return di sini, supaya halaman
     lokal maupun web tetap dapat diinjeksi ketika ikon diklik. */
  if (url.startsWith("about:") ||
      url.startsWith("moz-extension:") ||
      url.startsWith("chrome:") ||
      url.startsWith("edge:") ||
      url.startsWith("firefox:")) {
    return;
  }

  if (injectedTabs.has(tab.id)) {
    // Tab sudah punya panel; minta content script men-toggle tampil/sembunyi.
    sendToTab(tab.id, { action: "toggle" }).then(() => {
      tabPanelState.set(tab.id, !tabPanelState.get(tab.id));
    }).catch(() => {
      // Konteks bisa terputus bila tab dimuat ulang; bersihkan lalu injeksi ulang.
      injectedTabs.delete(tab.id);
      tabPanelState.set(tab.id, true);
      doInject(tab.id, true);
    });
  } else {
    // Belum pernah diinjeksi: lakukan injeksi penuh seluruh modul.
    tabPanelState.set(tab.id, true);
    doInject(tab.id, true);
  }
}

const action = browser.browserAction || browser.action;
if (action && action.onClicked && typeof action.onClicked.addListener === "function") {
  action.onClicked.addListener(onToolbarClicked);
} else {
  console.warn("NT DevTools: API browserAction/action tidak tersedia; klik ikon toolbar tidak dapat diaktifkan.");
}

/* =========================================================================
   4. Pemantauan navigasi halaman (browser.webNavigation)
   ========================================================================= */

if (browser.webNavigation) {
  // onCommitted: dipicu saat dokumen utama mulai dikomit. Dipakai untuk injeksi ulang
  // otomatis setelah pengguna berpindah halaman, dengan mempertahankan status visibilitas.
  if (browser.webNavigation.onCommitted && typeof browser.webNavigation.onCommitted.addListener === "function") {
    browser.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId !== 0) return; // Hanya tangani kerangka utama (main frame)

      if (injectedTabs.has(details.tabId)) {
        injectedTabs.delete(details.tabId);
        const url = details.url || "";
        if (!url.startsWith("about:") &&
            !url.startsWith("moz-extension:") &&
            !url.startsWith("chrome:") &&
            !url.startsWith("edge:") &&
            !url.startsWith("firefox:")) {
          const wasVisible = tabPanelState.get(details.tabId);
          const visibility = wasVisible !== undefined ? wasVisible : true;
          // Jeda singkat agar dokumen baru siap menerima injeksi.
          setTimeout(() => {
            doInject(details.tabId, visibility);
          }, 300);
        }
      }
    });
  }

  // onHistoryStateUpdated: dipicu saat aplikasi SPA mengubah riwayat tanpa reload penuh.
  // Kita hanya memberi tahu content script agar memperbarui tampilan URL-nya.
  if (browser.webNavigation.onHistoryStateUpdated && typeof browser.webNavigation.onHistoryStateUpdated.addListener === "function") {
    browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
      if (details.frameId !== 0) return;
      sendToTab(details.tabId, { action: "navigate", url: details.url });
    });
  }
} else {
  console.warn("NT DevTools: API browser.webNavigation tidak tersedia; injeksi ulang setelah navigasi dinonaktifkan.");
}

/* =========================================================================
   5. Pemantauan jaringan (browser.webRequest)
   Menangkap permintaan HTTP/HTTPS, header permintaan/balasan, serta hasil
   (selesai/gagal) secara real-time, lalu meneruskannya ke content script.
   Bentuk pesan "net" dipertahankan persis sesuai kontrak MDT.
   FASE 4 menambahkan (semuanya OPSIONAL, kontrak lama tetap utuh):
     - resBody : body respons teks (http/https) via filterResponseData()
     - reqBody : body permintaan teks (formData/raw) dari d.requestBody
     - Cookie  : diturunkan content script dari header Cookie / Set-Cookie
   ========================================================================= */

/**
 * Menentukan apakah URL boleh ditangkap body-nya (hanya http/https).
 * Skema internal seperti moz-extension:, about:, dan data: selalu dilewati.
 * @param {string} u
 * @returns {boolean}
 */
function isHttpUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}

/**
 * Membaca ulang preferensi "Tangkap body respons" dari browser.storage.local.
 * Aman dipanggil kapan saja; tidak pernah melempar.
 */
function readCaptureSetting() {
  try {
    if (!browser.storage || !browser.storage.local || typeof browser.storage.local.get !== "function") return;
    const p = browser.storage.local.get("mdt-settings");
    if (p && typeof p.then === "function") {
      p.then((res) => {
        try {
          const s = res && res["mdt-settings"];
          if (s && s.network && typeof s.network.captureBody === "boolean") {
            captureBody = s.network.captureBody;
          }
        } catch (e) {}
      }).catch(() => {});
    }
  } catch (e) {}
}

readCaptureSetting();

// Pantau perubahan pengaturan agar flag tetap sinkron tanpa memuat ulang ekstensi.
if (browser.storage && browser.storage.onChanged && typeof browser.storage.onChanged.addListener === "function") {
  browser.storage.onChanged.addListener((changes, area) => {
    try {
      if (area !== "local" || !changes) return;
      const ch = changes["mdt-settings"];
      if (!ch || !ch.newValue) return;
      const s = ch.newValue;
      if (s.network && typeof s.network.captureBody === "boolean") captureBody = s.network.captureBody;
    } catch (e) {}
  });
}

/**
 * Mengubah data biner apa pun menjadi Uint8Array dengan aman.
 * @param {*} data
 * @returns {Uint8Array}
 */
function toU8(data) {
  try {
    if (!data) return new Uint8Array(0);
    if (typeof Uint8Array !== "undefined" && data instanceof Uint8Array) return data;
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data.buffer) return new Uint8Array(data.buffer, data.byteOffset || 0, typeof data.byteLength === "number" ? data.byteLength : data.buffer.byteLength);
    if (Array.isArray(data)) return new Uint8Array(data);
  } catch (e) {}
  return new Uint8Array(0);
}

/**
 * Men-dekode byte UTF-8 menjadi teks. Bila TextDecoder tidak tersedia dipakai
 * cadangan decodeURIComponent(escape(...)).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToText(bytes) {
  try {
    const arr = toU8(bytes);
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(arr);
    let s = "";
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  } catch (e) {
    return "";
  }
}

/**
 * Apakah teks hasil dekode layak ditampilkan (bukan data biner acak).
 * @param {string} s
 * @returns {boolean}
 */
function isMostlyText(s) {
  if (!s) return false;
  let bad = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0xFFFD || c < 9 || (c > 13 && c < 32)) bad++;
  }
  return bad / s.length < 0.1;
}

/**
 * Mengubah byte menjadi teks; bila tampak biner dikembalikan sebagai hex.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBody(bytes) {
  const arr = toU8(bytes);
  const text = bytesToText(arr);
  if (isMostlyText(text)) return text;
  let hex = "";
  for (let i = 0; i < arr.length; i++) hex += (arr[i] < 16 ? "0" : "") + arr[i].toString(16);
  return hex;
}

/**
 * Men-dekode body permintaan dari d.requestBody (formData / raw).
 * formData dikembalikan sebagai baris "key=value"; raw didekode UTF-8 (atau hex).
 * @param {object} rb - Nilai d.requestBody dari browser
 * @returns {string|null}
 */
function decodeRequestBody(rb) {
  if (!rb) return null;
  try {
    const lines = [];
    if (rb.formData && typeof rb.formData === "object") {
      for (const k in rb.formData) {
        if (!Object.prototype.hasOwnProperty.call(rb.formData, k)) continue;
        let vals = rb.formData[k];
        if (!Array.isArray(vals)) vals = [vals];
        for (let vi = 0; vi < vals.length; vi++) {
          lines.push(encodeURIComponent(k) + "=" + encodeURIComponent(vals[vi]));
        }
      }
    }
    if (lines.length) return lines.join("\n");
    if (rb.raw && rb.raw.length) {
      const parts = [];
      let total = 0;
      for (let i = 0; i < rb.raw.length; i++) {
        const r = rb.raw[i] || {};
        let chunk = "";
        if (typeof r.value === "string") chunk = r.value;
        else if (typeof r.bytes !== "undefined") chunk = bytesToBody(r.bytes);
        if (chunk) { parts.push(chunk); total += chunk.length; }
        if (total > BODY_MAX) break;
      }
      let joined = parts.join("");
      if (joined.length > BODY_MAX) joined = joined.slice(0, BODY_MAX);
      if (joined) return joined;
    }
  } catch (e) {}
  return null;
}

/**
 * Menggabungkan daftar potongan Uint8Array menjadi satu Uint8Array.
 * @param {Uint8Array[]} chunks
 * @returns {Uint8Array}
 */
function concatChunks(chunks) {
  let len = 0;
  for (let i = 0; i < chunks.length; i++) len += chunks[i].length;
  const out = new Uint8Array(len);
  let off = 0;
  for (let i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
  return out;
}

/**
 * Memberi tahu semua penunggu bahwa filter respons sudah berhenti.
 * @param {string} requestId
 */
function notifyResStop(requestId) {
  const waiters = resWaiters.get(requestId);
  if (!waiters) return;
  resWaiters.delete(requestId);
  for (let i = 0; i < waiters.length; i++) {
    try { waiters[i](); } catch (e) {}
  }
}

/**
 * Menunggu filter respons berhenti (onstop/onerror). Bila batas waktu terlampaui,
 * Promise tetap selesai agar fase "done" tidak pernah tertahan selamanya.
 * @param {string} requestId
 * @param {number} ms - Batas waktu tunggu (milidetik)
 * @returns {Promise<void>}
 */
function waitResStop(requestId, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const waiters = resWaiters.get(requestId);
      if (waiters) {
        const i = waiters.indexOf(finish);
        if (i >= 0) waiters.splice(i, 1);
        if (!waiters.length) resWaiters.delete(requestId);
      }
      resolve();
    };
    let waiters = resWaiters.get(requestId);
    if (!waiters) { waiters = []; resWaiters.set(requestId, waiters); }
    waiters.push(finish);
    try { setTimeout(finish, ms); } catch (e) { finish(); }
  });
}

/**
 * Memasang filter body respons pada satu permintaan.
 * Setiap potongan diteruskan apa adanya (write), body disimpan sementara
 * (dibatasi BODY_MAX, ditandai terpotong), dan filter SELALU ditutup.
 * Seluruh jalur dibungkus try/catch agar tidak pernah menghentikan permintaan.
 * @param {string} requestId
 */
function attachResponseFilter(requestId, tabId) {
  let filter = null;
  try {
    filter = browser.webRequest.filterResponseData(requestId);
  } catch (e) {
    filter = null;
  }
  if (!filter) return;

  capturedIds.add(requestId);

  const chunks = [];
  let total = 0;
  let truncated = false;
  let closed = false;

  filter.ondata = (event) => {
    const data = event && event.data;
    try {
      if (!truncated && data) {
        const u8 = toU8(data);
        if (total + u8.length > BODY_MAX) {
          const keep = BODY_MAX - total;
          if (keep > 0) chunks.push(u8.subarray(0, keep));
          truncated = true;
        } else {
          chunks.push(u8);
        }
        total += u8.length;
      }
    } catch (e) {}
    // Selalu teruskan data asli (passthrough), tak ada byte yang diubah.
    // Jangan menulis setelah filter ditutup.
    if (!closed) { try { filter.write(data); } catch (e) {} }
  };

  filter.onstop = () => {
    try {
      resBodies.set(requestId, { text: bytesToText(concatChunks(chunks)), truncated: truncated, tabId: tabId });
    } catch (e) {}
    try { filter.close(); } catch (e) {}
    closed = true;
    resStopped.add(requestId);
    notifyResStop(requestId);
  };

  filter.onerror = () => {
    // Passthrough sudah terjadi pada ondata; cukup tutup filter lalu beri tahu.
    try { filter.close(); } catch (e) {}
    closed = true;
    resStopped.add(requestId);
    notifyResStop(requestId);
  };
}

if (browser.webRequest) {
  // onBeforeRequest: titik awal permintaan; catat metadata dasar ke peta pending.
  if (browser.webRequest.onBeforeRequest && typeof browser.webRequest.onBeforeRequest.addListener === "function") {
    browser.webRequest.onBeforeRequest.addListener((d) => {
      if (d.tabId < 0) return;
      let reqBody = null;
      try { reqBody = decodeRequestBody(d.requestBody); } catch (e) { reqBody = null; }
      pending.set(d.requestId, { tabId: d.tabId, url: d.url, method: d.method, type: d.type, t0: d.timeStamp, reqBody: reqBody });
      sendToTab(d.tabId, {
        action: "net", phase: "start", id: d.requestId, method: d.method, url: d.url, type: mapType(d.type), t0: d.timeStamp
      });
    }, { urls: ["<all_urls>"] }, ["requestBody"]);
  }

  // onSendHeaders: menyimpan header permintaan yang akan dikirim.
  if (browser.webRequest.onSendHeaders && typeof browser.webRequest.onSendHeaders.addListener === "function") {
    browser.webRequest.onSendHeaders.addListener((d) => {
      if (d.tabId < 0) return;
      const p = pending.get(d.requestId);
      if (p) p.reqHeaders = d.requestHeaders;
    }, { urls: ["<all_urls>"] }, ["requestHeaders"]);
  }

  // onHeadersReceived: menyimpan header balasan lalu memasang filter body (FASE 4).
  if (browser.webRequest.onHeadersReceived && typeof browser.webRequest.onHeadersReceived.addListener === "function") {
    try {
      browser.webRequest.onHeadersReceived.addListener((d) => {
        if (d.tabId < 0) return;
        const p = pending.get(d.requestId);
        if (p) p.resHeaders = d.responseHeaders;
        /* Hanya http/https, hanya bila opsi "Tangkap body respons" aktif. */
        if (captureBody && isHttpUrl(d.url) && typeof browser.webRequest.filterResponseData === "function") {
          try { attachResponseFilter(d.requestId, d.tabId); } catch (e) {}
        }
      }, { urls: ["<all_urls>"] }, ["responseHeaders", "blocking"]);
    } catch (e) {
      try {
        browser.webRequest.onHeadersReceived.addListener((d) => {
          if (d.tabId < 0) return;
          const p = pending.get(d.requestId);
          if (p) p.resHeaders = d.responseHeaders;
          if (captureBody && isHttpUrl(d.url) && typeof browser.webRequest.filterResponseData === "function") {
            try { attachResponseFilter(d.requestId, d.tabId); } catch (e) {}
          }
        }, { urls: ["<all_urls>"] }, ["responseHeaders"]);
      } catch (e2) {}
    }
  }

  // onCompleted: permintaan selesai; gabungkan seluruh data lalu kirim fase "done".
  if (browser.webRequest.onCompleted && typeof browser.webRequest.onCompleted.addListener === "function") {
    browser.webRequest.onCompleted.addListener((d) => {
      if (d.tabId < 0) return;
      const p = pending.get(d.requestId);
      if (!p) return;
      pending.delete(d.requestId);

      const finishDone = () => {
        const body = resBodies.get(d.requestId);
        resBodies.delete(d.requestId);
        capturedIds.delete(d.requestId);
        resStopped.delete(d.requestId);
        const msg = {
          action: "net",
          phase: "done",
          id: d.requestId,
          method: p.method,
          url: p.url,
          type: mapType(p.type),
          status: d.statusCode,
          statusText: d.statusLine || "",
          dur: Math.round(d.timeStamp - p.t0),
          resHeaders: p.resHeaders || [],
          reqHeaders: p.reqHeaders || [],
          fromCache: d.fromCache,
          size: d.responseSize || -1,
        };
        /* Field OPSIONAL agar kontrak lama tetap utuh bila tidak ada body. */
        if (p.reqBody) msg.reqBody = p.reqBody;
        if (body) {
          msg.resBody = body.text;
          if (body.truncated) msg.resBodyTrunc = true;
        }
        sendToTab(p.tabId, msg);
      };

      /* Bila body respons sedang ditangkap tetapi filter belum berhenti
         (onCompleted mendahului onstop), tunggu sebentar agar body tidak hilang. */
      if (capturedIds.has(d.requestId) && !resStopped.has(d.requestId)) {
        waitResStop(d.requestId, 800).then(finishDone);
      } else {
        finishDone();
      }
    }, { urls: ["<all_urls>"] });
  }

  // onErrorOccurred: permintaan gagal/terputus; kirim fase "error".
  if (browser.webRequest.onErrorOccurred && typeof browser.webRequest.onErrorOccurred.addListener === "function") {
    browser.webRequest.onErrorOccurred.addListener((d) => {
      if (d.tabId < 0) return;
      const p = pending.get(d.requestId);
      if (!p) return;
      pending.delete(d.requestId);
      resBodies.delete(d.requestId);
      capturedIds.delete(d.requestId);
      resStopped.delete(d.requestId);
      notifyResStop(d.requestId);
      sendToTab(p.tabId, {
        action: "net",
        phase: "error",
        id: d.requestId,
        method: p.method,
        url: p.url,
        type: mapType(p.type),
        error: d.error,
        dur: Math.round(d.timeStamp - p.t0),
      });
    }, { urls: ["<all_urls>"] });
  }
} else {
  console.warn("NT DevTools: API browser.webRequest tidak tersedia; pemantauan jaringan dinonaktifkan.");
}

/* =========================================================================
   6. Pembersihan memori saat tab ditutup
   ========================================================================= */

if (browser.tabs && browser.tabs.onRemoved && typeof browser.tabs.onRemoved.addListener === "function") {
  browser.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
    tabPanelState.delete(tabId);
    for (const [id, p] of pending) { if (p.tabId === tabId) pending.delete(id); }
    for (const [id, b] of resBodies) { if (b && b.tabId === tabId) { resBodies.delete(id); capturedIds.delete(id); resStopped.delete(id); notifyResStop(id); } }
  });
}

/* =========================================================================
   Utilitas pemetaan tipe sumber daya
   ========================================================================= */

/**
 * Memetakan tipe sumber daya jaringan dari browser ke kategori ringkas NT DevTools.
 * @param {string} t - Tipe asli dari browser (mis. "xmlhttprequest")
 * @returns {string} Kategori yang disederhanakan (mis. "xhr")
 */
function mapType(t) {
  return { xmlhttprequest:"xhr", fetch:"fetch", script:"script", stylesheet:"css",
           image:"img", font:"font", media:"media", websocket:"ws",
           main_frame:"doc", sub_frame:"iframe", other:"other" }[t] || "other";
}
