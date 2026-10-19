/**
 * Harness uji runtime NT DevTools.
 * Menjalankan styles.js -> icons-data.js -> beautify.js -> contentScript.js
 * di dalam JSDOM dengan tiruan API ekstensi Firefox, lalu menguji perilaku inti.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = "/data/data/com.termux/files/home/devtools";
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const dom = new JSDOM(
  `<!doctype html><html><head><title>Uji</title><style>.a{color:red}</style>
   <script>var inlineVar=1;</script></head>
   <body><div id="app" class="wrap"><h1>Halo</h1><p>teks</p></div></body></html>`,
  { url: "https://contoh.test/halaman", pretendToBeVisual: true, runScripts: "dangerously" }
);
const win = dom.window;

// ---- Tiruan API ekstensi Firefox ----
const listeners = {};
const sent = [];
win.browser = {
  runtime: {
    onMessage: { addListener: (fn) => { listeners.message = fn; } },
    sendMessage: (m) => { sent.push(m); return Promise.resolve(); },
  },
  tabs: { executeScript: () => Promise.resolve(), sendMessage: () => Promise.resolve(), onRemoved: { addListener() {} } },
  webRequest: {
    onBeforeRequest: { addListener() {} }, onSendHeaders: { addListener() {} },
    onHeadersReceived: { addListener() {} }, onCompleted: { addListener() {} },
    onErrorOccurred: { addListener() {} },
  },
  webNavigation: { onCommitted: { addListener() {} }, onHistoryStateUpdated: { addListener() {} } },
  browserAction: { onClicked: { addListener() {} } },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    },
  },
};
if (!win.matchMedia) {
  win.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
}
if (!win.requestAnimationFrame) {
  win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  win.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (!win.document.elementsFromPoint) win.document.elementsFromPoint = () => [];

const errors = [];
win.addEventListener("error", (e) => errors.push("window.error: " + (e.message || e.error)));
win.onerror = (m, s, l, c, e) => errors.push("onerror: " + (e && e.stack || m));

// Tangkap keluaran konsol JSDOM (default-nya dibuang).
["log", "warn", "error", "info", "debug"].forEach(function (m) {
  const orig = win.console[m] ? win.console[m].bind(win.console) : function () {};
  win.console[m] = function () {
    const args = Array.prototype.slice.call(arguments);
    console.log("  [konsol." + m + "] " + args.map((a) => (a && a.stack) || String(a)).join(" "));
    try { orig.apply(null, args); } catch (e) {}
  };
});

// ---- Muat modul berurutan seperti background.js ----
const ORDER = ["styles.js", "icons-data.js", "beautify.js", "contentScript.js"];
const results = [];
for (const f of ORDER) {
  try {
    win.eval(read(f));
    results.push("MUAT OK: " + f);
  } catch (e) {
    results.push("MUAT GAGAL: " + f + " -> " + (e && e.stack || e));
  }
}

const $ = (sel) => win.document.querySelector(sel);
const $$ = (sel) => Array.from(win.document.querySelectorAll(sel));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else fail++; console.log("  [" + (cond ? "LULUS" : "GAGAL") + "] " + name + (extra ? "  " + extra : "")); };

async function runTests() {
  console.log("\n=== Pemuatan modul ===");
  results.forEach((r) => console.log("  " + r));

  console.log("\n=== Global terpasang ===");
  console.log("  MDT_STYLES  :", typeof win.MDT_STYLES);
  console.log("  MDT_ICONS   :", typeof win.MDT_ICONS, win.MDT_ICONS ? "(" + win.MDT_ICONS.TABS.length + " tab)" : "");
  console.log("  MDT_BEAUTIFY:", typeof win.MDT_BEAUTIFY);
  console.log("  listener onMessage terdaftar:", !!listeners.message);
  console.log("  readyState saat uji:", win.document.readyState);
  /* Bridge: jembatan main world tidak wajib dalam harness JSDOM (csp dll),
     tapi pastikan mekanisme bridge tidak menyebabkan galat. */
  console.log("  window.__mdtBridgeInjected:", !!win.__mdtBridgeInjected);
  console.log("  window.__mdtConsoleHooked:", !!win.__mdtConsoleHooked);

  console.log("\n=== Struktur DOM hasil injeksi ===");
  const root = $("#mdt-root");
  ok("akar #mdt-root ada", !!root);
  if (!root) { console.log("  -> #mdt-root tidak ada, uji lanjutan dilewati"); report(); return; }
  const st = $("style[data-mdt-fallback]");
  ok("lembar gaya <style> disuntikkan", !!st, st ? "fallback=" + st.getAttribute("data-mdt-fallback") : "");
  ok("topbar ada", !!$("#mdt-topbar"));
  ok("panels ada", !!$("#mdt-panels"));
  const tabCount = $$("#mdt-topbar [data-tab]").length;
  ok("jumlah tombol tab == TABS", tabCount === win.MDT_ICONS.TABS.length, "(" + tabCount + ")");
  ok("tombol tutup ada", !!$("#mdt-closebtn"));
  ok("gagang resize ada", !!$("#mdt-handle"));
  ok("FAB ada", !!$("#mdt-fab"));
  ok("ikon SVG terpasang (bukan emoji)", $$("#mdt-topbar svg").length > 0, "(svg=" + $$("#mdt-topbar svg").length + ")");
  ok("panel tertutup secara default", !root.classList.contains("open"));

  console.log("\n=== Pesan runtime ===");
  try {
    listeners.message({ action: "setVisibility", visible: true });
    ok("setVisibility:true membuka panel", root.classList.contains("open"));
    ok("melaporkan panelStateChanged", sent.some((m) => m.action === "panelStateChanged" && m.visible === true), JSON.stringify(sent[sent.length - 1]));
    listeners.message({ action: "toggle" });
    ok("toggle menutup panel", !root.classList.contains("open"));
    listeners.message({ action: "setVisibility", visible: true });
  } catch (e) { fail++; console.log("  [GAGAL] pesan runtime melempar:", e && e.stack || e); }

  console.log("\n=== Panel tiap tab dapat dibangun tanpa error ===");
  for (const t of win.MDT_ICONS.TABS) {
    const btn = $$("#mdt-topbar button").find((b) => (b.getAttribute("data-tab") || "") === t.id);
    if (!btn) { fail++; console.log("  [GAGAL] tombol tab tidak ditemukan: " + t.id); continue; }
    try {
      btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      const active = $$("#mdt-panels > .mdt-panel").filter((p) => p.classList.contains("on"));
      ok("tab " + t.id + " aktif & panel tampil", active.length === 1, "(aktif=" + active.length + ")");
    } catch (e) { fail++; console.log("  [GAGAL] tab " + t.id + " melempar: " + (e && e.stack || e)); }
  }

  console.log("\n=== Hook console & REPL ===");
  try {
    win.console.log("pesan-uji-ntdev");
    ok("console.log ditangkap", $$(".mdt-logentry").length > 0, "entri=" + $$(".mdt-logentry").length);
  } catch (e) { fail++; console.log("  [GAGAL] hook console melempar:", e && e.stack || e); }

  try {
    const repl = $("#mdt-repl");
    if (repl) {
      repl.value = "1 + 2";
      repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      ok("REPL mengeksekusi tanpa melempar", true);
    } else { fail++; console.log("  [GAGAL] #mdt-repl tidak ditemukan"); }
  } catch (e) { fail++; console.log("  [GAGAL] REPL melempar:", e && e.stack || e); }

  console.log("\n=== Pesan jaringan (net) ===");
  try {
    listeners.message({ action: "net", phase: "start", id: "r1", method: "GET", url: "https://contoh.test/api", type: "fetch", t0: 0 });
    listeners.message({ action: "net", phase: "done", id: "r1", method: "GET", url: "https://contoh.test/api", type: "fetch", status: 200, statusText: "OK", dur: 42, resHeaders: [], reqHeaders: [], fromCache: false, size: 1234 });
    ok("baris jaringan dibuat", $$(".mdt-net-row").length > 0, "rows=" + $$(".mdt-net-row").length);
  } catch (e) { fail++; console.log("  [GAGAL] net melempar:", e && e.stack || e); }

  console.log("\n=== Pesan navigate (SPA) ===");
  try { listeners.message({ action: "navigate", url: "https://contoh.test/lain" }); ok("navigate tidak melempar", true); }
  catch (e) { fail++; console.log("  [GAGAL] navigate melempar:", e && e.stack || e); }

  console.log("\n=== Panel Aplikasi / Perangkat / Tentang / Pengaturan (isi) ===");
  try {
    for (const id of ["storage", "ua", "about", "settings"]) {
      const btn = $$("#mdt-topbar button").find((b) => b.getAttribute("data-tab") === id);
      if (btn) btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    }
    ok("panel Aplikasi punya tabel/kartu", $$("#mdt-app-outer *").length > 3, "anak=" + $$("#mdt-app-outer *").length);
    ok("panel Perangkat terisi", $$("#mdt-ua-scroll *").length > 3, "anak=" + $$("#mdt-ua-scroll *").length);
    ok("panel Tentang terisi", $$("#mdt-guide-scroll *").length > 3, "anak=" + $$("#mdt-guide-scroll *").length);
    ok("panel Pengaturan terisi", $$("#mdt-settings-scroll *").length > 3, "anak=" + $$("#mdt-settings-scroll *").length);
  } catch (e) { fail++; console.log("  [GAGAL] panel isi melempar:", e && e.stack || e); }

  console.log("\n=== Pengaturan: tema, panel, persistensi ===");
  try {
    const root2 = $("#mdt-root");
    /* Tema terang menambah kelas mdt-light pada #mdt-root. */
    const lightBtn = $$("#mdt-settings-scroll .mdt-seg-btn").find((b) => /Terang/.test(b.textContent));
    if (lightBtn) { lightBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }
    ok("tema terang menambah .mdt-light", !!(root2 && root2.classList.contains("mdt-light")));

    /* Slider transparansi mengubah opacity #mdt-root. */
    const opRange = $("#mdt-settings-scroll .mdt-set-range");
    if (opRange) { opRange.value = "0.6"; opRange.dispatchEvent(new win.Event("input", { bubbles: true })); }
    ok("slider transparansi mengubah opacity", root2 && parseFloat(root2.style.opacity) <= 0.61);

    /* Mematikan panel "network" menghilangkannya dari topbar. */
    const netCk = $("#mdt-settings-scroll [data-setpanel='network']");
    if (netCk) { netCk.checked = false; netCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    const netTabGone = !$$("#mdt-topbar [data-tab]").some((b) => b.getAttribute("data-tab") === "network");
    ok("panel nonaktif hilang dari topbar", netTabGone);

    /* Panel terakhir tidak boleh dimatikan: matikan semua kecuali about. */
    for (const id of ["elements", "console", "sources", "network", "perf", "storage", "ua"]) {
      const ck = $("#mdt-settings-scroll [data-setpanel='" + id + "']");
      if (ck && ck.checked) { ck.checked = false; ck.dispatchEvent(new win.Event("change", { bubbles: true })); }
    }
    const aboutCk = $("#mdt-settings-scroll [data-setpanel='about']");
    if (aboutCk) { aboutCk.checked = false; aboutCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    const mapCk = $("#mdt-settings-scroll [data-setpanel='map']");
    if (mapCk && mapCk.checked) { mapCk.checked = false; mapCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    const timingCk = $("#mdt-settings-scroll [data-setpanel='timing']");
    if (timingCk && timingCk.checked) { timingCk.checked = false; timingCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    ok("minimal satu panel tetap aktif", $$("#mdt-topbar [data-tab]").length >= 2, "(tab=" + $$("#mdt-topbar [data-tab]").length + ")");
    ok("tab Pengaturan tidak bisa dimatikan", !!$$("#mdt-topbar [data-tab]").find((b) => b.getAttribute("data-tab") === "settings"));

    /* Tombol reset memulihkan semua panel. */
    const resetBtn = $("#mdt-settings-scroll .mdt-set-reset");
    if (resetBtn) { resetBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }
    ok("reset memulihkan seluruh panel", win.MDT_ICONS.TABS.every((t) => $$("#mdt-topbar [data-tab]").some((b) => b.getAttribute("data-tab") === t.id)), "(tab=" + $$("#mdt-topbar [data-tab]").length + ")");

    /* Persistensi: kunci mdt-settings tersimpan di localStorage. */
    ok("pengaturan tersimpan di localStorage", !!win.localStorage.getItem("mdt-settings"));
  } catch (e) { fail++; console.log("  [GAGAL] pengaturan melempar:", e && e.stack || e); }

  /* ============ FASE 2: KONSOL (area 1) ============ */

  console.log("\n=== Fase 2: helper $ dan $$ ===");
  try {
    const repl = $("#mdt-repl");
    repl.value = "$('#app').tagName";
    repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok("helper $ bekerja (querySelector)", $$(".mdt-logentry.result").some((e) => /DIV/.test(e.textContent)));
    repl.value = "$$('p').length";
    repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok("helper $$ bekerja (querySelectorAll -> array)", $$(".mdt-logentry.result").some((e) => {
      const m = e.querySelector(".mdt-le-msg");
      return m && m.textContent.trim() === "1";
    }));
  } catch (e) { fail++; console.log("  [GAGAL] helper $/$$ melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: hook konsol lanjutan ===");
  try {
    win.console.clear();
    ok("console.clear mengosongkan area log", $$(".mdt-logentry").length === 0, "(entri=" + $$(".mdt-logentry").length + ")");

    win.console.table({ a: 1, b: 2 });
    ok("console.table membuat entri", $$(".mdt-le-msg").some((m) => /Tabel/.test(m.textContent)));

    win.console.dir({ d: 1 });
    ok("console.dir membuat pohon objek", $$(".mdt-obj").length > 0);

    win.console.group("Grup A");
    win.console.log("di dalam grup");
    win.console.groupEnd();
    ok("console.group meng-indentasi entri berikutnya",
      $$(".mdt-logentry").some((e) => e.getAttribute("data-mdt-indent") === "1"));

    win.console.time("t1");
    win.console.timeLog("t1");
    win.console.timeEnd("t1");
    ok("console.time/timeEnd menampilkan durasi", $$(".mdt-le-msg").some((m) => /t1:.*ms/.test(m.textContent)));

    win.console.count("c1");
    win.console.count("c1");
    ok("console.count menampilkan penghitung", $$(".mdt-le-msg").some((m) => /c1: 2/.test(m.textContent)));
    win.console.countReset("c1");
    win.console.count("c1");
    ok("console.countReset mengatur ulang penghitung", $$(".mdt-le-msg").some((m) => /c1: 1/.test(m.textContent)));

    win.console.assert(false, "gagal-uji");
    ok("console.assert(false) mencatat galat", $$(".mdt-logentry.error").length > 0);

    win.console.trace("jejak");
    ok("console.trace menampilkan jejak tumpukan", $$(".mdt-le-stk").length > 0);

    win.console.groupCollapsed("Grup B");
    win.console.groupEnd();
    ok("console.groupCollapsed menjalankan tanpa melempar", true);
  } catch (e) { fail++; console.log("  [GAGAL] hook lanjutan melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: jejak tumpukan & galat global ===");
  try {
    win.console.error("galat-uji");
    const errEntries = $$(".mdt-logentry.error");
    const errEntry = errEntries[errEntries.length - 1];
    ok("entri galat punya .mdt-le-stk", !!(errEntry && errEntry.querySelector(".mdt-le-stk")));
    const body = errEntry && errEntry.querySelector(".mdt-stk-body");
    ok("jejak tumpukan multi-baris", !!(body && body.textContent.split("\n").length >= 2),
      body ? "(baris=" + body.textContent.split("\n").length + ")" : "");

    const stkHead = errEntry && errEntry.querySelector(".mdt-stk-head");
    if (stkHead) stkHead.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("jejak tumpukan dapat dibuka/tutup", !!(errEntry && errEntry.querySelector(".mdt-le-stk.open")));

    let evt;
    try { evt = new win.ErrorEvent("error", { message: "boom", error: new win.Error("boom") }); }
    catch (e) { evt = new win.Event("error"); }
    const errCountBefore = errors.length;
    win.dispatchEvent(evt);
    ok("window error ditangkap sebagai entri berjejak", $$(".mdt-le-stk").length > 0);
    /* Buang galat yang sengaja dipicu dari daftar galat harness. */
    errors.splice(errCountBefore);

    const errBefore = $$(".mdt-logentry.error").length;
    const rejEvt = new win.Event("unhandledrejection");
    try { rejEvt.reason = new win.Error("tolak-uji"); } catch (e) {}
    win.dispatchEvent(rejEvt);
    ok("unhandledrejection ditangkap sebagai entri galat", $$(".mdt-logentry.error").length > errBefore);
  } catch (e) { fail++; console.log("  [GAGAL] jejak/galat melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: pohon objek bertingkat ===");
  try {
    win.console.clear();
    win.console.log({ a: 1, nested: { b: 2 }, arr: [1, 2, 3] });
    ok("pohon .mdt-obj dibuat", $$(".mdt-obj").length > 0, "(obj=" + $$(".mdt-obj").length + ")");
    ok("level atas terbuka secara bawaan", $$('.mdt-obj[data-depth="0"]').some((o) => o.classList.contains("open")));
    const nested = $$('.mdt-obj[data-depth="1"]');
    ok("nested tertutup secara bawaan", nested.length > 0 && nested.every((o) => !o.classList.contains("open")), "(nested=" + nested.length + ")");
    ok("kelas obj-key/obj-val/obj-brace/obj-toggle ada",
      $$(".mdt-obj-key").length > 0 && $$(".mdt-obj-val").length > 0 &&
      $$(".mdt-obj-brace").length > 0 && $$(".mdt-obj-toggle").length > 0);
    ok("wadah .mdt-obj-children ada", $$(".mdt-obj-children").length > 0);
    const topObj = $('.mdt-obj[data-depth="0"]');
    const wasOpen = topObj.classList.contains("open");
    topObj.querySelector(".mdt-obj-toggle").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("toggle mengubah status buka objek", topObj.classList.contains("open") !== wasOpen);
  } catch (e) { fail++; console.log("  [GAGAL] pohon objek melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: autocomplete REPL ===");
  try {
    const repl = $("#mdt-repl");
    const ac = $("#mdt-ac");
    ok("#mdt-ac ada di DOM", !!ac);
    repl.value = "docu";
    repl.setSelectionRange(4, 4);
    repl.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok("autocomplete tampil saat mengetik", !!(ac && ac.style.display !== "none" && ac.querySelector(".mdt-ac-item")));
    ok("saran memuat document", $$(".mdt-ac-item").some((i) => /document/.test(i.textContent)));
    repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    ok("ArrowDown menggeser pilihan", $$(".mdt-ac-item.sel").length === 1);
    repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok("Escape menutup autocomplete", ac.style.display === "none");

    repl.value = "document.ti";
    repl.setSelectionRange(11, 11);
    repl.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok("saran properti setelah titik", $$(".mdt-ac-item").some((i) => /title/.test(i.textContent)));
    repl.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok("Enter memilih saran", /document\.title$/.test(repl.value), "(" + repl.value + ")");
  } catch (e) { fail++; console.log("  [GAGAL] autocomplete melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: filter regex ===");
  try {
    win.console.clear();
    win.console.log("apel");
    win.console.log("jeruk");
    win.console.log("anggur");
    const rb = $("#mdt-con-regex");
    ok("tombol regex ada di toolbar", !!rb);
    rb.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("tombol regex aktif", rb.classList.contains("on"));
    const filt = $("#mdt-con-filter");
    filt.value = "^(apel|jeruk)$";
    filt.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok("regex menyaring log dengan tepat", $$(".mdt-logentry").filter((e) => e.style.display !== "none").length === 2,
      "(tampak=" + $$(".mdt-logentry").filter((e) => e.style.display !== "none").length + ")");
    filt.value = "([";
    filt.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok("regex tidak valid ditangani tanpa melempar", true);
    const levels = $("#mdt-con-levels");
    levels.value = "error";
    levels.dispatchEvent(new win.Event("change", { bubbles: true }));
    ok("saringan level tetap digabung", $$(".mdt-logentry").every((e) => e.style.display === "none"));
    levels.value = "all";
    levels.dispatchEvent(new win.Event("change", { bubbles: true }));
    rb.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    filt.value = "";
    filt.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok("mode regex dapat dimatikan", !rb.classList.contains("on"));
  } catch (e) { fail++; console.log("  [GAGAL] filter regex melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: salin isi log ===");
  try {
    win.console.clear();
    win.console.log("salin-aku");
    const copyBtn = $(".mdt-le-copy");
    ok("tombol salin per entri ada", !!copyBtn);
    let clicked = false;
    copyBtn.addEventListener("click", () => { clicked = true; });
    copyBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("klik salin berjalan tanpa melempar", clicked);
  } catch (e) { fail++; console.log("  [GAGAL] salin log melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: opsi properti non-enumerable & getter dipakai ===");
  try {
    const getterCk = $("#mdt-settings-scroll [data-setcon='getters']");
    const nonEnumCk = $("#mdt-settings-scroll [data-setcon='nonEnum']");
    ok("opsi getter & nonEnum ada di Pengaturan", !!getterCk && !!nonEnumCk);
    if (getterCk && getterCk.checked) { getterCk.checked = false; getterCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    if (nonEnumCk && nonEnumCk.checked) { nonEnumCk.checked = false; nonEnumCk.dispatchEvent(new win.Event("change", { bubbles: true })); }

    const objGetter = {};
    Object.defineProperty(objGetter, "nilaiGet", { get: function () { return 42; }, enumerable: true, configurable: true });
    Object.defineProperty(objGetter, "tersembunyi", { value: 7, enumerable: false, configurable: true });

    win.console.clear();
    win.console.log(objGetter);
    let txt = $(".mdt-le-msg").textContent;
    ok("getter tampil sebagai (getter) saat opsi mati", /\(getter\)/.test(txt), "(" + txt.slice(0, 50) + ")");
    ok("properti non-enumerable disembunyikan saat opsi mati", !/tersembunyi/.test(txt));

    if (getterCk) { getterCk.checked = true; getterCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    if (nonEnumCk) { nonEnumCk.checked = true; nonEnumCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    win.console.clear();
    win.console.log(objGetter);
    txt = $(".mdt-le-msg").textContent;
    ok("getter dievaluasi saat opsi hidup", /42/.test(txt), "(" + txt.slice(0, 50) + ")");
    ok("properti non-enumerable tampil saat opsi hidup", /tersembunyi/.test(txt));

    if (getterCk) { getterCk.checked = false; getterCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    if (nonEnumCk) { nonEnumCk.checked = false; nonEnumCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
  } catch (e) { fail++; console.log("  [GAGAL] opsi properti/getter melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: batas jumlah log (logMax) ===");
  try {
    const numInput = $("#mdt-settings-scroll .mdt-set-num");
    ok("kontrol batas jumlah log ada", !!numInput);
    if (numInput) { numInput.value = "50"; numInput.dispatchEvent(new win.Event("change", { bubbles: true })); }
    win.console.clear();
    for (let i = 0; i < 60; i++) win.console.log("pangkas-" + i);
    ok("logMax membatasi jumlah entri", $$(".mdt-logentry").length <= 50, "(entri=" + $$(".mdt-logentry").length + ")");
  } catch (e) { fail++; console.log("  [GAGAL] logMax melempar:", e && e.stack || e); }

  console.log("\n=== Fase 2: render asinkron ===");
  try {
    const asyncCk = $("#mdt-settings-scroll [data-setcon='async']");
    ok("opsi Render asinkron ada", !!asyncCk);
    if (asyncCk) { asyncCk.checked = true; asyncCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
    win.console.clear();
    win.console.log("async-uji");
    ok("commit ditunda saat render asinkron", $$(".mdt-logentry").length === 0, "(entri=" + $$(".mdt-logentry").length + ")");
    await new Promise((res) => setTimeout(res, 150));
    ok("batch asinkron akhirnya dirender", $$(".mdt-logentry").length >= 1, "(entri=" + $$(".mdt-logentry").length + ")");
    if (asyncCk) { asyncCk.checked = false; asyncCk.dispatchEvent(new win.Event("change", { bubbles: true })); }
  } catch (e) { fail++; console.log("  [GAGAL] render asinkron melempar:", e && e.stack || e); }

  /* ============ FASE 3: ELEMEN (area 2) ============ */

  /* --- Pembantu navigasi pohon DOM --- */
  const treeRows = () => $$("#mdt-dom-tree .mdt-drow2");
  function findRow(sub) {
    return treeRows().find((r) => r.textContent.indexOf(sub) >= 0);
  }
  function expandIfCollapsed(row) {
    const wrap = row && row.nextElementSibling;
    if (wrap && wrap.style.display === "none") {
      const t = row.querySelector(".mdt-dtog");
      if (t) t.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    }
  }
  function ensureElementsTab() {
    const btn = $$("#mdt-topbar button").find((b) => b.getAttribute("data-tab") === "elements");
    if (btn) btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  }
  function selectById(id) {
    ensureElementsTab();
    const bodyRow = findRow("<body");
    if (bodyRow) expandIfCollapsed(bodyRow);
    const row = findRow('id="' + id + '"');
    if (row) row.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    return row;
  }
  function sideTab(label) {
    const b = $$("#mdt-styles-tabs .mdt-stab").find((x) => x.textContent === label);
    if (b) b.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    return b;
  }
  function dbl(el) { el.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true })); }
  function pressEnter(el) { el.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }

  /* Stub clipboard agar isi yang disalin dapat diverifikasi. */
  let lastCopied = "";
  try {
    Object.defineProperty(win.navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t) => { lastCopied = String(t); return Promise.resolve(); } },
    });
  } catch (e) { /* diabaikan */ }

  console.log("\n=== Fase 3: seleksi elemen & tab bilah samping ===");
  try {
    const appEl = win.document.getElementById("app");
    /* Suntikkan aturan lembar gaya agar ada matched rule untuk #app. */
    const stEl = win.document.createElement("style");
    stEl.textContent = "#app{color:green;font-size:10px}";
    win.document.head.appendChild(stEl);

    const row = selectById("app");
    ok("baris #app dapat dipilih", !!row && row.classList.contains("sel"));
    ok("tiga tab bilah samping tambahan ada",
      !!sideTab("Box Model") && !!sideTab("Event Listeners") && !!$("#mdt-box-body") && !!$("#mdt-events-body"));
    /* Kembali ke tab Styles. */
    sideTab("Styles");
    ok("tab Styles menampilkan wadah gaya", $("#mdt-styles-body").style.display !== "none");
  } catch (e) { fail++; console.log("  [GAGAL] seleksi elemen melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: edit CSS langsung (matched + inline) ===");
  try {
    const appEl = win.document.getElementById("app");
    sideTab("Styles");

    /* 1. Tambah properti baru ke blok element.style. */
    const addProp = $("#mdt-styles-body .mdt-add-prop");
    ok("baris tambah properti ada", !!addProp);
    if (addProp) addProp.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    const apInput = $("#mdt-styles-body .mdt-addprop-input input");
    ok("input tambah properti muncul", !!apInput);
    if (apInput) { apInput.value = "color: rgb(1, 2, 3)"; pressEnter(apInput); }
    ok("properti baru diterapkan ke elemen (inline style)", appEl.style.getPropertyValue("color") === "rgb(1, 2, 3)");

    /* 2. Ubah nilai properti inline via klik dua kali. */
    let inlineBlock = $$("#mdt-styles-body .mdt-style-block").find((b) => {
      const n = b.querySelector(".mdt-style-selector-name");
      return n && n.textContent === "element.style";
    });
    let cRow = inlineBlock && inlineBlock.querySelector('.mdt-style-rule[data-mdt-prop="color"]');
    ok("baris properti color pada element.style ada", !!cRow);
    if (cRow) {
      dbl(cRow.querySelector(".mdt-style-val"));
      const inp = cRow.querySelector(".mdt-inline-edit");
      ok("input edit nilai properti muncul", !!inp);
      if (inp) { inp.value = "blue"; pressEnter(inp); }
      ok("nilai properti diperbarui ke elemen", appEl.style.color === "blue");
    }

    /* 3. Aktif/nonaktifkan properti via kotak centang. */
    if (cRow) {
      const cb = cRow.querySelector(".mdt-style-cb");
      ok("kotak aktif/nonaktif properti ada", !!cb);
      if (cb) {
        cb.checked = false;
        cb.dispatchEvent(new win.Event("change", { bubbles: true }));
        ok("menonaktifkan properti menghapusnya dari elemen", appEl.style.getPropertyValue("color") === "");
        ok("baris properti ditandai nonaktif", cRow.classList.contains("disabled"));
        cb.checked = true;
        cb.dispatchEvent(new win.Event("change", { bubbles: true }));
        ok("mengaktifkan kembali memulihkan properti", appEl.style.color === "blue");
      }
    }

    /* 4. Ubah nilai pada matched rule (#app). */
    let matched = $$("#mdt-styles-body .mdt-style-block").find((b) => {
      const n = b.querySelector(".mdt-style-selector-name");
      return n && n.textContent === "#app";
    });
    ok("blok matched rule #app tampil", !!matched);
    if (matched) {
      const mRow = matched.querySelector('.mdt-style-rule[data-mdt-prop="font-size"]');
      ok("properti font-size pada matched rule ada", !!mRow);
      if (mRow) {
        dbl(mRow.querySelector(".mdt-style-val"));
        const inp = mRow.querySelector(".mdt-inline-edit");
        if (inp) { inp.value = "22px"; pressEnter(inp); }
        ok("matched rule diterapkan & terlihat pada elemen", appEl.style.getPropertyValue("font-size") === "22px");
      }
    }
  } catch (e) { fail++; console.log("  [GAGAL] edit CSS melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: edit CSS pada Computed ===");
  try {
    const appEl = win.document.getElementById("app");
    sideTab("Computed");
    const rows = $$("#mdt-computed-body .mdt-comp-row");
    ok("computed style menampilkan baris", rows.length > 0, "(baris=" + rows.length + ")");
    const cRow = $("#mdt-computed-body .mdt-comp-row[data-mdt-prop='color']");
    if (cRow) {
      dbl(cRow.querySelector(".mdt-comp-val"));
      const inp = cRow.querySelector(".mdt-inline-edit");
      ok("input edit computed muncul", !!inp);
      if (inp) { inp.value = "rgb(9, 9, 9)"; pressEnter(inp); }
      ok("edit computed diterapkan ke elemen", appEl.style.getPropertyValue("color") === "rgb(9, 9, 9)");
    } else { fail++; console.log("  [GAGAL] baris computed color tidak ditemukan"); }
    sideTab("Styles");
  } catch (e) { fail++; console.log("  [GAGAL] edit computed melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: diagram box model ===");
  try {
    sideTab("Box Model");
    ok("wadah box model tampil", $("#mdt-box-body").style.display !== "none");
    ok("diagram box model dibuat", !!$("#mdt-box-body .mdt-boxmodel"));
    ok("lapisan margin/border/padding ada",
      !!$("#mdt-box-body .mdt-box-margin") && !!$("#mdt-box-body .mdt-box-border") && !!$("#mdt-box-body .mdt-box-padding"));
    ok("blok konten dengan ukuran ada", !!$("#mdt-box-body .mdt-box-content .mdt-box-size"));
    ok("ringkasan box model punya 4 baris", $$("#mdt-box-body .mdt-box-sumrow").length === 4,
      "(baris=" + $$("#mdt-box-body .mdt-box-sumrow").length + ")");
    sideTab("Styles");
  } catch (e) { fail++; console.log("  [GAGAL] box model melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: daftar event listener ===");
  try {
    const appEl = win.document.getElementById("app");
    /* Daftarkan listener SETELAH patch agar terlacak. */
    appEl.addEventListener("click", function mdtUjiKlik() {});
    appEl.setAttribute("onmouseover", "void 0");

    sideTab("Event Listeners");
    ok("wadah event listener tampil", $("#mdt-events-body").style.display !== "none");
    const clickRow = $("#mdt-events-body .mdt-event-row[data-mdt-event='click']");
    ok("listener terlacak (click) terdaftar", !!clickRow);
    ok("nama fungsi listener tampil", !!clickRow && /mdtUjiKlik/.test(clickRow.textContent));
    ok("atribut inline onmouseover terdaftar", !!$("#mdt-events-body .mdt-event-row[data-mdt-event='onmouseover']"));
    ok("catatan keterbatasan Firefox tampil", !!$("#mdt-events-body .mdt-event-note"));
    sideTab("Styles");
  } catch (e) { fail++; console.log("  [GAGAL] event listener melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: edit atribut ===");
  try {
    const appEl = win.document.getElementById("app");
    let row = selectById("app");
    ok("#app terpilih ulang untuk edit atribut", !!row);

    /* 1. Ubah nilai atribut class. */
    let clsName = row && Array.from(row.querySelectorAll(".mdt-an")).find((n) => n.textContent === "class");
    ok("nama atribut class tampil", !!clsName);
    if (clsName) {
      const valEl = clsName.nextElementSibling && clsName.nextElementSibling.nextElementSibling;
      ok("nilai atribut class dapat diklik", !!valEl);
      if (valEl) {
        dbl(valEl);
        const inp = row.querySelector(".mdt-inline-edit");
        ok("input edit nilai atribut muncul", !!inp);
        if (inp) { inp.value = "wrap2"; pressEnter(inp); }
        ok("nilai atribut diterapkan ke elemen nyata", appEl.getAttribute("class") === "wrap2");
      }
    }

    /* 2. Ubah nama atribut. */
    row = selectById("app");
    let idName = row && Array.from(row.querySelectorAll(".mdt-an")).find((n) => n.textContent === "id");
    if (idName) {
      dbl(idName);
      const inp = row.querySelector(".mdt-inline-edit");
      if (inp) { inp.value = "appIdBaru"; pressEnter(inp); }
      ok("nama atribut diubah menjadi appIdBaru", appEl.hasAttribute("appIdBaru"));
      ok("atribut id lama dihapus", !appEl.hasAttribute("id"));
      /* kembalikan */
      appEl.setAttribute("id", "app");
      appEl.removeAttribute("appIdBaru");
    } else { fail++; console.log("  [GAGAL] nama atribut id tidak ditemukan"); }

    /* 3. Tambah atribut baru. */
    row = selectById("app");
    const addBtn = row && row.querySelector(".mdt-attr-addbtn");
    ok("tombol tambah atribut ada pada baris", !!addBtn);
    if (addBtn) {
      addBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      const inp = row.querySelector(".mdt-attr-new input");
      ok("input tambah atribut muncul", !!inp);
      if (inp) { inp.value = 'data-uji="ya"'; pressEnter(inp); }
      ok("atribut baru diterapkan ke elemen", appEl.getAttribute("data-uji") === "ya");
    }

    /* 4. Ubah nama atribut yang baru ditambah. */
    row = selectById("app");
    const dName = row && Array.from(row.querySelectorAll(".mdt-an")).find((n) => n.textContent === "data-uji");
    if (dName) {
      dbl(dName);
      const inp = row.querySelector(".mdt-inline-edit");
      if (inp) { inp.value = "data-uji2"; pressEnter(inp); }
      ok("atribut baru diubah namanya", appEl.hasAttribute("data-uji2") && !appEl.hasAttribute("data-uji"));
    } else { fail++; console.log("  [GAGAL] atribut data-uji tidak ditemukan"); }
  } catch (e) { fail++; console.log("  [GAGAL] edit atribut melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: edit teks node ===");
  try {
    selectById("app");
    /* Perluas #app lalu h1 untuk melihat baris teks. */
    let appRow = findRow('id="app"');
    expandIfCollapsed(appRow);
    let h1Row = findRow("<h1");
    ok("baris <h1> dapat ditemukan", !!h1Row);
    expandIfCollapsed(h1Row);
    const txtRow = $("#mdt-dom-tree .mdt-dtextrow .mdt-txt");
    ok("baris teks node tampil", !!txtRow);
    if (txtRow) {
      dbl(txtRow);
      const inp = $("#mdt-dom-tree .mdt-inline-edit");
      ok("input edit teks muncul", !!inp);
      if (inp) { inp.value = "Halo Baru"; pressEnter(inp); }
      ok("teks node diterapkan ke elemen nyata", win.document.querySelector("h1").textContent === "Halo Baru");
    }
  } catch (e) { fail++; console.log("  [GAGAL] edit teks melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: tanda pohon VSCode, salin HTML & selector ===");
  try {
    const row = selectById("app");
    /* Panah chevron buka/tutup bergaya VSCode (bukan tombol menu titik tiga). */
    const chev = row && row.querySelector(".mdt-dtog svg");
    ok("panah chevron buka/tutup ada pada baris elemen", !!chev);
    /* Baris penutup </tag> bergaya VSCode. */
    const closeRows = $$("#mdt-dom-tree .mdt-dclose");
    ok("baris penutup </tag> bergaya VSCode ada",
      closeRows.length > 0 && closeRows.some((r) => /^<\/[a-z0-9]+>$/i.test(r.textContent.trim())),
      "(baris penutup=" + closeRows.length + ")");
    /* Menu konteks dibuka lewat klik kanan / tekan lama (contextmenu). */
    if (row) row.dispatchEvent(new win.MouseEvent("contextmenu", { bubbles: true, clientX: 12, clientY: 12 }));
    const menu = $("#mdt-ctx-menu");
    ok("menu konteks terbuka lewat contextmenu", !!menu);
    const htmlItem = menu && Array.from(menu.querySelectorAll(".mdt-ctx-item")).find((i) => /Salin HTML/.test(i.textContent));
    const selItem = menu && Array.from(menu.querySelectorAll(".mdt-ctx-item")).find((i) => i.textContent === "Salin selector");
    ok("menu punya aksi Salin HTML (outerHTML)", !!htmlItem);
    ok("menu tetap punya aksi Salin selector", !!selItem);
    if (htmlItem) {
      htmlItem.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      ok("outerHTML elemen tersalin", lastCopied.indexOf("id=\"app\"") >= 0, "(" + lastCopied.slice(0, 40) + ")");
    }
    if (selItem) {
      lastCopied = "";
      selItem.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      ok("selector elemen tersalin", lastCopied === "div#app", "(" + lastCopied + ")");
    }
    const m = $("#mdt-ctx-menu");
    if (m) m.remove();
  } catch (e) { fail++; console.log("  [GAGAL] salin HTML melempar:", e && e.stack || e); }

  console.log("\n=== Fase 3: pembaruan DOM otomatis (MutationObserver) ===");
  try {
    const autoBtn = $("#mdt-dom-auto");
    ok("tombol Auto ada di toolbar", !!autoBtn);
    ok("Auto aktif secara bawaan", !!autoBtn && autoBtn.classList.contains("on"));

    const appEl = win.document.getElementById("app");
    const nu = win.document.createElement("span");
    nu.id = "mdt-new-el";
    nu.textContent = "baru";
    appEl.appendChild(nu);

    await new Promise((res) => setTimeout(res, 140));

    selectById("app");
    let appRow = findRow('id="app"');
    expandIfCollapsed(appRow);
    const newRow = treeRows().find((r) => r.textContent.indexOf("mdt-new-el") >= 0);
    ok("MutationObserver menyegarkan pohon dengan elemen baru", !!newRow);

    /* Elemen terpilih tetap dipertahankan pasca penyegaran. */
    const selRow = treeRows().find((r) => r.classList.contains("sel"));
    ok("pilihan tidak hilang setelah penyegaran otomatis", !!selRow && selRow.textContent.indexOf('id="app"') >= 0);

    /* Toggle mematikan pembaruan otomatis. */
    if (autoBtn) autoBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("toggle Auto dapat dimatikan", !!autoBtn && !autoBtn.classList.contains("on"));
    if (autoBtn) autoBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("toggle Auto dapat dinyalakan kembali", !!autoBtn && autoBtn.classList.contains("on"));
  } catch (e) { fail++; console.log("  [GAGAL] MutationObserver melempar:", e && e.stack || e); }

  /* ============ FASE 4: JARINGAN (area 3) ============ */

  /* ---- Latar belakang: muat background.js di JSDOM terpisah lalu jalankan
          pipeline webRequest tiruan (requestBody, filterResponseData, header). ---- */
  console.log("\n=== Fase 4: background — requestBody, filterResponseData, header ===");
  let BG = null;
  try {
    const bgDom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "https://contoh.test/", runScripts: "outside-only",
    });
    const bg = bgDom.window;
    if (!bg.TextDecoder) bg.TextDecoder = TextDecoder;
    if (!bg.TextEncoder) bg.TextEncoder = TextEncoder;

    const bgSent = [];
    const bgFilters = {};
    const bgFired = {};
    const bgStorageListeners = [];
    const we = {};
    ["onBeforeRequest", "onSendHeaders", "onHeadersReceived", "onCompleted", "onErrorOccurred"].forEach(function (ev) {
      we[ev] = { addListener: function (cb, opts, extra) { bgFired[ev] = { cb: cb, opts: opts, extra: extra }; } };
    });
    we.filterResponseData = function (requestId) {
      const f = {
        ondata: null, onstop: null, onerror: null, writes: [], closed: 0,
        write: function (d) { this.writes.push(d); },
        close: function () { this.closed++; },
      };
      bgFilters[requestId] = f;
      return f;
    };
    bg.browser = {
      runtime: { onMessage: { addListener() {} }, sendMessage: function () { return Promise.resolve(); } },
      tabs: {
        executeScript: function () { return Promise.resolve(); },
        sendMessage: function (tabId, msg) { bgSent.push({ tabId: tabId, msg: msg }); return Promise.resolve(); },
        onRemoved: { addListener() {} },
      },
      webRequest: we,
      webNavigation: { onCommitted: { addListener() {} }, onHistoryStateUpdated: { addListener() {} } },
      browserAction: { onClicked: { addListener() {} } },
      storage: {
        local: { get: function () { return Promise.resolve({}); }, set: function () { return Promise.resolve(); } },
        onChanged: { addListener: function (cb) { bgStorageListeners.push(cb); } },
      },
    };
    bg.eval(read("background.js"));
    BG = { sent: bgSent, filters: bgFilters, fired: bgFired, storage: bgStorageListeners };
    ok("background.js dimuat tanpa melempar", true);

    const onBefore = BG.fired.onBeforeRequest;
    const onHdr = BG.fired.onHeadersReceived;
    ok("onBeforeRequest meminta extraInfoSpec requestBody",
      !!(onBefore && onBefore.extra && onBefore.extra.indexOf("requestBody") >= 0),
      onBefore && onBefore.extra ? "(" + onBefore.extra.join(",") + ")" : "");
    ok("onHeadersReceived didaftarkan sebagai blocking",
      !!(onHdr && onHdr.extra && onHdr.extra.indexOf("blocking") >= 0),
      onHdr && onHdr.extra ? "(" + onHdr.extra.join(",") + ")" : "");

    const T0 = 1000;
    onBefore.cb({ requestId: "bg1", tabId: 5, url: "https://contoh.test/api", method: "POST",
      type: "xmlhttprequest", timeStamp: T0, requestBody: { formData: { foo: "bar", baz: ["1", "2"] } } });
    BG.fired.onSendHeaders.cb({ requestId: "bg1", tabId: 5,
      requestHeaders: [{ name: "Cookie", value: "a=1; b=2" }, { name: "Accept", value: "application/json" }] });
    BG.fired.onHeadersReceived.cb({ requestId: "bg1", tabId: 5, url: "https://contoh.test/api",
      responseHeaders: [{ name: "Set-Cookie", value: "sid=abc; Path=/" }] });

    const f1 = BG.filters["bg1"];
    ok("filterResponseData dipasang untuk http", !!f1);
    const bytes = new TextEncoder().encode('{"ok":true,"n":1}');
    if (f1 && f1.ondata) f1.ondata({ data: bytes });
    ok("byte respons diteruskan apa adanya (write)", !!(f1 && f1.writes.length === 1 && f1.writes[0] === bytes),
      "(write=" + (f1 ? f1.writes.length : "-") + ")");
    if (f1 && f1.onstop) f1.onstop();
    ok("filter selalu ditutup (close)", !!(f1 && f1.closed >= 1), "(close=" + (f1 ? f1.closed : "-") + ")");

    BG.fired.onCompleted.cb({ requestId: "bg1", tabId: 5, statusCode: 200, statusLine: "HTTP/1.1 200 OK",
      timeStamp: T0 + 42, fromCache: false, responseSize: 42 });
    const done1 = BG.sent.map(function (x) { return x.msg; }).find(function (m) { return m.phase === "done" && m.id === "bg1"; });
    ok("pesan done terkirim", !!done1);
    ok("reqBody (formData) diteruskan sebagai field opsional",
      !!(done1 && /foo=bar/.test(done1.reqBody) && /baz=1/.test(done1.reqBody)), done1 ? "(" + JSON.stringify(done1.reqBody) + ")" : "");
    ok("resBody diteruskan sebagai field opsional", !!(done1 && done1.resBody === '{"ok":true,"n":1}'));
    ok("reqHeaders & resHeaders disertakan pada done",
      !!(done1 && done1.reqHeaders.length === 2 && done1.resHeaders.length === 1));
    ok("done memuat status, durasi, metode, tipe",
      !!(done1 && done1.status === 200 && done1.dur === 42 && done1.method === "POST" && done1.type === "xhr"));

    /* Ketahanan urutan: onCompleted tiba SEBELUM onstop. Body tidak boleh hilang. */
    onBefore.cb({ requestId: "bg6", tabId: 5, url: "https://contoh.test/race", method: "GET", type: "fetch", timeStamp: T0 });
    BG.fired.onHeadersReceived.cb({ requestId: "bg6", tabId: 5, url: "https://contoh.test/race", responseHeaders: [] });
    const f6 = BG.filters["bg6"];
    BG.fired.onCompleted.cb({ requestId: "bg6", tabId: 5, statusCode: 200, statusLine: "OK",
      timeStamp: T0 + 2, fromCache: false, responseSize: 3 });
    let done6 = BG.sent.map(function (x) { return x.msg; }).find(function (m) { return m.phase === "done" && m.id === "bg6"; });
    ok("done ditunda selama onstop belum terjadi", !done6);
    if (f6 && f6.ondata) f6.ondata({ data: new TextEncoder().encode("abc") });
    if (f6 && f6.onstop) f6.onstop();
    await new Promise(function (r) { setTimeout(r, 20); });
    done6 = BG.sent.map(function (x) { return x.msg; }).find(function (m) { return m.phase === "done" && m.id === "bg6"; });
    ok("done terkirim setelah onstop (urutan tak terjamin ditangani)", !!(done6 && done6.resBody === "abc"),
      done6 ? "(" + done6.resBody + ")" : "");

    /* Skema moz-extension:// harus dilewati. */
    onBefore.cb({ requestId: "bg2", tabId: 5, url: "moz-extension://abc/page.html", method: "GET", type: "main_frame", timeStamp: T0 });
    BG.fired.onHeadersReceived.cb({ requestId: "bg2", tabId: 5, url: "moz-extension://abc/page.html", responseHeaders: [] });
    ok("moz-extension:// dilewati (tanpa filter)", !BG.filters["bg2"]);

    /* Opsi "Tangkap body respons" = nonaktif lewat storage.onChanged. */
    if (BG.storage[0]) {
      BG.storage[0]({ "mdt-settings": { newValue: { network: { captureBody: false } } } }, "local");
    }
    onBefore.cb({ requestId: "bg3", tabId: 5, url: "https://contoh.test/off", method: "GET", type: "fetch", timeStamp: T0 });
    BG.fired.onHeadersReceived.cb({ requestId: "bg3", tabId: 5, url: "https://contoh.test/off", responseHeaders: [] });
    ok("captureBody nonaktif -> tanpa filter", !BG.filters["bg3"]);
    if (BG.storage[0]) {
      BG.storage[0]({ "mdt-settings": { newValue: { network: { captureBody: true } } } }, "local");
    }

    /* Batas ukuran buffer ~256 KB + penanda terpotong. */
    onBefore.cb({ requestId: "bg4", tabId: 5, url: "https://contoh.test/big", method: "GET", type: "fetch", timeStamp: T0 });
    BG.fired.onHeadersReceived.cb({ requestId: "bg4", tabId: 5, url: "https://contoh.test/big", responseHeaders: [] });
    const f4 = BG.filters["bg4"];
    const big = new Uint8Array(300 * 1024); big.fill(97); /* 300 KB huruf "a" */
    if (f4 && f4.ondata) f4.ondata({ data: big });
    if (f4 && f4.onstop) f4.onstop();
    BG.fired.onCompleted.cb({ requestId: "bg4", tabId: 5, statusCode: 200, statusLine: "OK",
      timeStamp: T0 + 1, fromCache: false, responseSize: 307200 });
    const done4 = BG.sent.map(function (x) { return x.msg; }).find(function (m) { return m.phase === "done" && m.id === "bg4"; });
    ok("body > 256 KB ditandai terpotong (resBodyTrunc)", !!(done4 && done4.resBodyTrunc === true));
    ok("resBody dibatasi ~256 KB", !!(done4 && done4.resBody.length <= 256 * 1024 && done4.resBody.length === 256 * 1024),
      done4 ? "(len=" + done4.resBody.length + ")" : "");

    /* Fase error. */
    onBefore.cb({ requestId: "bg5", tabId: 5, url: "https://contoh.test/err", method: "GET", type: "fetch", timeStamp: T0 });
    BG.fired.onErrorOccurred.cb({ requestId: "bg5", tabId: 5, url: "https://contoh.test/err",
      error: "NS_ERROR_FAILURE", timeStamp: T0 + 5 });
    const errMsg = BG.sent.map(function (x) { return x.msg; }).find(function (m) { return m.phase === "error" && m.id === "bg5"; });
    ok("onErrorOccurred mengirim fase error", !!(errMsg && errMsg.error === "NS_ERROR_FAILURE"));
  } catch (e) { fail++; console.log("  [GAGAL] pipeline background melempar:", e && e.stack || e); }

  /* ---- Sisi content script: tab Body/Cookie, salin cURL/respons, filter tipe/status. ---- */
  console.log("\n=== Fase 4: UI Jaringan — Body, Cookie, cURL, salin respons ===");
  try {
    const netRowById = function (id) { return $('#mdt-net-list .mdt-net-row[data-netid="' + id + '"]'); };
    const clickDetailTab = function (name) {
      const b = $('#mdt-net-detail-tabs [data-ndt="' + name + '"]');
      if (b) b.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      return b;
    };
    const RESP_BODY = '{"pesan":"halo","n":3}';
    listeners.message({ action: "net", phase: "start", id: "u1", method: "POST",
      url: "https://contoh.test/form", type: "fetch", t0: 0 });
    listeners.message({ action: "net", phase: "done", id: "u1", method: "POST",
      url: "https://contoh.test/form", type: "fetch", status: 200, statusText: "OK", dur: 12,
      reqHeaders: [{ name: "Cookie", value: "sesi=xyz; tema=gelap" }, { name: "Content-Type", value: "text/plain" }],
      resHeaders: [{ name: "Set-Cookie", value: "sid=abc123; Path=/; HttpOnly" }],
      reqBody: "foo=bar", resBody: RESP_BODY, fromCache: false, size: RESP_BODY.length });

    const row = netRowById("u1");
    ok("baris jaringan u1 dibuat", !!row);
    if (row) row.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("panel detail jaringan terbuka", !!$("#mdt-net-detail.on"));
    ok("tab body & cookies ada pada bilah detail",
      !!clickDetailTab("headers") && !!$('#mdt-net-detail-tabs [data-ndt="body"]') && !!$('#mdt-net-detail-tabs [data-ndt="cookies"]'));

    /* Tab Body. */
    clickDetailTab("body");
    let bodyPres = $$("#mdt-net-detail-body .mdt-netbody");
    ok("blok body request & respons tampil", bodyPres.length === 2, "(blok=" + bodyPres.length + ")");
    const resPre = bodyPres[bodyPres.length - 1];
    ok("body JSON respons ter-pretty-print",
      !!(resPre && resPre.textContent.indexOf('"pesan": "halo"') >= 0),
      resPre ? "(" + resPre.textContent.slice(0, 24) + ")" : "");
    ok("body request mentah tampil", $("#mdt-net-detail-body").textContent.indexOf("foo=bar") >= 0);
    const tog = $("#mdt-net-detail-body .mdt-netbody-toggle");
    ok("tombol Mentah/Terformat ada untuk JSON", !!tog);
    if (tog) {
      tog.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      const rawPre = $$("#mdt-net-detail-body .mdt-netbody").pop();
      ok("toggle menampilkan body mentah (satu baris)", !!(rawPre && rawPre.textContent === RESP_BODY),
        rawPre ? "(" + rawPre.textContent.slice(0, 16) + ")" : "");
      tog.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    }

    /* Tab Cookie: parsing dari header Cookie & Set-Cookie. */
    clickDetailTab("cookies");
    const cookieVals = $$("#mdt-net-detail-body .mdt-cookie-val").map(function (e) { return e.textContent; });
    ok("cookie permintaan diparse menjadi baris name=value (sesi=xyz)", cookieVals.indexOf("sesi=xyz") >= 0,
      "(" + cookieVals.join("; ") + ")");
    ok("cookie permintaan kedua tampil (tema=gelap)", cookieVals.indexOf("tema=gelap") >= 0);
    ok("Set-Cookie diambil pasangan pertama saja (sid=abc123)", cookieVals.indexOf("sid=abc123") >= 0);

    /* Salin sebagai cURL. */
    lastCopied = "";
    const curlBtn = $("#mdt-net-curl");
    ok("tombol 'Salin sebagai cURL' ada", !!curlBtn);
    if (curlBtn) curlBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("perintah dimulai dengan curl", /^curl /.test(lastCopied), "(" + lastCopied.slice(0, 12) + ")");
    ok("metode dikutip dengan benar (-X 'POST')", lastCopied.indexOf("-X 'POST'") >= 0);
    ok("URL dikutip dengan benar", lastCopied.indexOf("'https://contoh.test/form'") >= 0);
    ok("header dikutip dengan benar", lastCopied.indexOf("-H 'Cookie: sesi=xyz; tema=gelap'") >= 0);
    ok("body permintaan memakai --data-raw yang dikutip", lastCopied.indexOf("--data-raw 'foo=bar'") >= 0);

    /* Salin respons. */
    lastCopied = "";
    const copyResBtn = $("#mdt-net-copyres");
    ok("tombol 'Salin respons' ada", !!copyResBtn);
    if (copyResBtn) copyResBtn.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    ok("isi respons tersalin persis", lastCopied === RESP_BODY, "(" + lastCopied.slice(0, 16) + ")");
  } catch (e) { fail++; console.log("  [GAGAL] UI jaringan melempar:", e && e.stack || e); }

  console.log("\n=== Fase 4: filter tipe & status (digabung filter URL) ===");
  try {
    listeners.message({ action: "net", phase: "start", id: "t-xhr", method: "GET", url: "https://contoh.test/a", type: "xhr", t0: 0 });
    listeners.message({ action: "net", phase: "done", id: "t-xhr", method: "GET", url: "https://contoh.test/a", type: "xhr",
      status: 200, statusText: "OK", dur: 5, resHeaders: [], reqHeaders: [], fromCache: false, size: 10 });
    listeners.message({ action: "net", phase: "start", id: "t-img", method: "GET", url: "https://contoh.test/b.png", type: "img", t0: 0 });
    listeners.message({ action: "net", phase: "done", id: "t-img", method: "GET", url: "https://contoh.test/b.png", type: "img",
      status: 404, statusText: "Not Found", dur: 5, resHeaders: [], reqHeaders: [], fromCache: false, size: 10 });
    listeners.message({ action: "net", phase: "start", id: "t-err", method: "GET", url: "https://contoh.test/c", type: "fetch", t0: 0 });
    listeners.message({ action: "net", phase: "error", id: "t-err", method: "GET", url: "https://contoh.test/c", type: "fetch",
      error: "NS_ERROR_FAILURE", dur: 3 });

    const typeSel = $("#mdt-net-type");
    const statusSel = $("#mdt-net-status");
    ok("kontrol filter tipe ada di toolbar jaringan", !!typeSel);
    ok("kontrol filter status ada di toolbar jaringan", !!statusSel);
    ok("opsi tipe memuat Document/Script/Stylesheet/Image/Media/Font/Lainnya",
      !!(typeSel && Array.from(typeSel.options).map(function (o) { return o.textContent; }).join("|").match(
        /Document.*Script.*Stylesheet.*Image.*Media.*Font.*Lainnya/)));

    const visibleRows = function () {
      return $$("#mdt-net-list .mdt-net-row").filter(function (r) { return r.style.display !== "none"; });
    };

    typeSel.value = "xhr"; typeSel.dispatchEvent(new win.Event("change", { bubbles: true }));
    let vis = visibleRows();
    ok("filter tipe XHR menyisakan baris xhr saja",
      vis.length >= 1 && vis.every(function (r) { return r.getAttribute("data-nettipe") === "xhr"; }), "(tampak=" + vis.length + ")");
    typeSel.value = ""; typeSel.dispatchEvent(new win.Event("change", { bubbles: true }));

    statusSel.value = "4"; statusSel.dispatchEvent(new win.Event("change", { bubbles: true }));
    vis = visibleRows();
    ok("filter status 4xx menyisakan status 4 saja",
      vis.length >= 1 && vis.every(function (r) { return (r.getAttribute("data-netstatus") || "").charAt(0) === "4"; }), "(tampak=" + vis.length + ")");
    statusSel.value = ""; statusSel.dispatchEvent(new win.Event("change", { bubbles: true }));

    statusSel.value = "gagal"; statusSel.dispatchEvent(new win.Event("change", { bubbles: true }));
    vis = visibleRows();
    ok("filter status Gagal menyisakan baris galat",
      vis.length >= 1 && vis.every(function (r) { return r.classList.contains("err"); }), "(tampak=" + vis.length + ")");
    statusSel.value = ""; statusSel.dispatchEvent(new win.Event("change", { bubbles: true }));

    const urlFilter = $("#mdt-net-type").parentElement.querySelector(".mdt-tbinput");
    ok("filter URL berada di toolbar yang sama", !!urlFilter);
    urlFilter.value = "b.png"; urlFilter.dispatchEvent(new win.Event("input", { bubbles: true }));
    vis = visibleRows();
    ok("filter URL menyaring baris (digabung dengan tipe/status)",
      vis.length >= 1 && vis.every(function (r) { return /b\.png/.test(r.textContent); }), "(tampak=" + vis.length + ")");
    urlFilter.value = ""; urlFilter.dispatchEvent(new win.Event("input", { bubbles: true }));

    const capCk = $("#mdt-settings-scroll [data-setnet='captureBody']");
    ok("opsi Pengaturan 'Tangkap body respons' ada", !!capCk);
    ok("opsi 'Tangkap body respons' aktif secara bawaan (default aktif)", !!(capCk && capCk.checked));
  } catch (e) { fail++; console.log("  [GAGAL] filter tipe/status melempar:", e && e.stack || e); }

  report();
}

function report() {
  console.log("\n=== Error runtime yang tertangkap ===");
  console.log(errors.length ? errors.join("\n") : "  tidak ada");
  console.log("\n  elemen total halaman:", win.document.getElementsByTagName("*").length);
  console.log("  di dalam #mdt-root:", $("#mdt-root") ? $("#mdt-root").getElementsByTagName("*").length : 0);
  console.log("\n=== RINGKASAN: " + pass + " lulus, " + fail + " gagal ===");
  process.exit(fail ? 1 : 0);
}

// Tunggu DOMContentLoaded/Load agar init() benar-benar berjalan.
setTimeout(function () {
  runTests().catch(function (e) {
    console.error("Harness gagal:", e && e.stack || e);
    process.exit(1);
  });
}, 200);
