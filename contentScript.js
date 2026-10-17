/**
 * NT DevTools - Skrip Konten (Orchestrator Antarmuka)
 *
 * Berkas ini adalah "otak" antarmuka NT DevTools yang berjalan di dalam
 * setiap halaman web. Tugasnya:
 *   1. Memasukkan lembar gaya dari window.MDT_STYLES ke light DOM.
 *   2. Membangun seluruh kerangka antarmuka (topbar 8 tab, panel, FAB,
 *      overlay inspeksi) memakai id/kelas yang sudah didefinisikan styles.js.
 *   3. Menghubungkan setiap panel (Elemen, Konsol, Sumber, Jaringan,
 *      Kinerja, Aplikasi, Perangkat, Panduan, Cuplikan).
 *   4. Menangani pesan runtime dari background.js
 *      (toggle / setVisibility / navigate / net).
 *
 * Catatan penting:
 *   - Berkas ini TIDAK memakai Shadow DOM. Seluruh antarmuka berada pada
 *     light DOM dengan akar id "mdt-root" (sesuai kontrak).
 *   - Berkas ini bisa diinjeksi lebih dari sekali (manifest content_scripts
 *     dan background.tabs.executeScript). Karena itu dipasang guard
 *     window.NTDevToolsInjected.
 *   - Semua ikon diambil dari window.MDT_ICONS (tanpa emoji, tanpa glyph
 *     unicode). Ikon lain pada tombol direpresentasikan sebagai teks ASCII.
 *   - Semua komentar dan label antarmuka berbahasa Indonesia.
 */
(function () {
  "use strict";

  /* Guard: skrip bisa diinjeksi berulang (manifest content_scripts maupun
     background.tabs.executeScript). Bila sudah berjalan, cukup coba
     tingkatkan modul yang mungkin baru tersedia, lalu hentikan. */
  if (window.NTDevToolsInjected) {
    try {
      upgradeModules();
    } catch (e) {}
    return;
  }
  window.NTDevToolsInjected = true;

  /* ==================================================================
     BAGIAN 1 - Deteksi perangkat dan lingkungan
     ================================================================== */

  var UA = navigator.userAgent || "";

  /* Perkiraan apakah perangkat bersifat seluler / layar sentuh. */
  var IS_MOBILE =
    /Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(UA) ||
    (typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 0 &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer:coarse)").matches);

  /* Firefox versi Android memiliki kuirkus tata letak (safe-area, dsb). */
  var IS_FF_MOBILE = IS_MOBILE && /Firefox|Fennec|FxiOS/i.test(UA);

  /* Akses API ekstensi secara aman; sebagian konteks bisa tidak punya. */
  var EXT =
    typeof browser !== "undefined" && browser && browser.runtime
      ? browser
      : typeof chrome !== "undefined" && chrome && chrome.runtime
      ? chrome
      : null;

  /* Namespace SVG. */
  var SVG_NS = "http://www.w3.org/2000/svg";

  /* Label tab berbahasa Indonesia, dipetakan dari id resmi MDT_ICONS.TABS. */
  var TAB_LABELS = {
    elements: "Elemen",
    console: "Konsol",
    sources: "Sumber",
    network: "Jaringan",
    perf: "Kinerja",
    storage: "Aplikasi",
    ua: "Perangkat",
    about: "Tentang",
    settings: "Pengaturan"
  };

  /* Data ikon. Bila modul belum termuat, dipakai fallback kosong (aman). */
  var ICONS = window.MDT_ICONS || { TABS: [], FAB: ["M16 18l6-6-6-6", "M8 6l-6 6 6 6"] };
  var TABS = Array.isArray(ICONS.TABS) ? ICONS.TABS.slice() : [];

  /* Bila MDT_ICONS tidak tersedia, bangun daftar tab minimal agar UI tetap jadi. */
  if (!TABS.length) {
    var IDS = ["elements", "console", "sources", "network", "perf", "storage", "ua", "about", "settings"];
    for (var ti = 0; ti < IDS.length; ti++) {
      TABS.push({ id: IDS[ti], label: TAB_LABELS[IDS[ti]] || IDS[ti], icon: [] });
    }
  }

  /* ==================================================================
     BAGIAN 2 - Utilitas umum (pembuat elemen dan ikon SVG)
     ================================================================== */

  /**
   * Membuat elemen HTML sederhana.
   * @param {string} tag - Nama tag.
   * @param {string} [cls] - Kelas CSS.
   * @param {string} [text] - Isi teks.
   * @returns {HTMLElement}
   */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  /**
   * Membangun ikon SVG dari array string terenkode (kontrak MDT_ICONS):
   *   "C<cx>,<cy>,<r>"          -> <circle>
   *   "R<x>,<y>,<w>,<h>[,<rx>]" -> <rect>
   *   selain itu                -> <path d="...">
   * @param {string[]} paths - Daftar entri path/shape.
   * @param {number} [size] - Lebar/tinggi ikon dalam px.
   * @returns {SVGElement}
   */
  function svgIcon(paths, size) {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size || 14);
    s.setAttribute("height", size || 14);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    if (!paths || !paths.length) return s;
    for (var i = 0; i < paths.length; i++) {
      var d = String(paths[i] || "");
      if (!d) continue;
      if (d.charAt(0) === "C") {
        /* Lingkaran */
        var cp = d.slice(1).split(",");
        if (cp.length >= 3) {
          var circle = document.createElementNS(SVG_NS, "circle");
          circle.setAttribute("cx", cp[0]);
          circle.setAttribute("cy", cp[1]);
          circle.setAttribute("r", cp[2]);
          s.appendChild(circle);
        }
      } else if (d.charAt(0) === "R") {
        /* Persegi panjang */
        var rp = d.slice(1).split(",");
        if (rp.length >= 4) {
          var rect = document.createElementNS(SVG_NS, "rect");
          rect.setAttribute("x", rp[0]);
          rect.setAttribute("y", rp[1]);
          rect.setAttribute("width", rp[2]);
          rect.setAttribute("height", rp[3]);
          if (rp.length >= 5) rect.setAttribute("rx", rp[4]);
          s.appendChild(rect);
        }
      } else {
        /* Jalur bebas */
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        s.appendChild(path);
      }
    }
    return s;
  }

  /** Mengembalikan null dengan aman. */
  function noop() {}

  /* ==================================================================
     BAGIAN 3 - Injeksi lembar gaya
     ================================================================== */

  /** CSS darurat bila window.MDT_STYLES tidak tersedia. */
  function fallbackCss() {
    return (
      "#mdt-root{position:fixed;left:0;right:0;bottom:0;height:55vh;background:#1e1e1e;" +
      "color:#d4d4d4;font:12px monospace;z-index:2147483646;display:flex;" +
      "flex-direction:column;transform:translateY(100%);transition:transform .2s;}" +
      "#mdt-root.open{transform:translateY(0);}" +
      "#mdt-topbar{display:flex;background:#252526;overflow-x:auto;}" +
      ".mdt-tab{background:none;border:none;color:#6a6a6a;padding:8px;cursor:pointer;}" +
      ".mdt-tab.on{color:#569cd6;}" +
      "#mdt-panels{flex:1;overflow:hidden;}" +
      ".mdt-panel{display:none;height:100%;overflow:auto;}" +
      ".mdt-panel.on{display:block;}" +
      "#mdt-fab{position:fixed;right:14px;bottom:14px;width:44px;height:44px;" +
      "border-radius:50%;background:#1e1e1e;color:#569cd6;border:1px solid #569cd6;" +
      "z-index:2147483647;display:none;align-items:center;justify-content:center;}"
    );
  }

  /** Mengembalikan teks CSS dari modul gaya utama. */
  function stylesText() {
    if (typeof window.MDT_STYLES === "function") {
      try {
        return window.MDT_STYLES(IS_MOBILE, IS_FF_MOBILE);
      } catch (e) {
        /* jatuh ke fallback */
      }
    }
    return fallbackCss();
  }

  /** Memasukkan satu tag <style id="mdt-style-tag"> ke light DOM. */
  function injectStyles() {
    if (document.getElementById("mdt-style-tag")) return;
    var style = document.createElement("style");
    style.id = "mdt-style-tag";
    /* Tandai bila memakai CSS darurat agar injeksi berikutnya bisa
       menggantikannya dengan lembar gaya utama window.MDT_STYLES. */
    style.setAttribute("data-mdt-fallback", typeof window.MDT_STYLES === "function" ? "0" : "1");
    style.textContent = stylesText();
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Peningkatan modul pada injeksi ulang (double injection).
   * Seluruhnya berbasis kueri DOM agar tidak bergantung pada variabel lokal
   * dari pemanggilan IIFE sebelumnya.
   *  - mengganti CSS darurat dengan lembar gaya utama bila kini tersedia,
   *  - menyisipkan ikon SVG ke tab/FAB yang semula dibangun tanpa ikon.
   */
  function upgradeModules() {
    /* 1. Tingkatkan lembar gaya. */
    var st = document.getElementById("mdt-style-tag");
    if (st && st.getAttribute("data-mdt-fallback") === "1" && typeof window.MDT_STYLES === "function") {
      st.textContent = stylesText();
      st.removeAttribute("data-mdt-fallback");
    }

    /* 2. Sisipkan ikon SVG ke tombol tab yang belum punya. */
    if (window.MDT_ICONS && Array.isArray(window.MDT_ICONS.TABS)) {
      var tabs = window.MDT_ICONS.TABS;
      var btns = document.querySelectorAll("#mdt-topbar .mdt-tab");
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].querySelector("svg")) continue;
        var id = btns[i].getAttribute("data-tab");
        for (var j = 0; j < tabs.length; j++) {
          if (tabs[j].id === id && tabs[j].icon && tabs[j].icon.length) {
            btns[i].insertBefore(svgIcon(tabs[j].icon, 13), btns[i].firstChild);
            break;
          }
        }
      }
      /* 3. Sisipkan ikon FAB (ikon ekstensi, atau SVG cadangan) bila belum ada. */
      var fab = document.getElementById("mdt-fab");
      if (fab && !fab.querySelector("img") && !fab.querySelector("svg")) {
        fab.appendChild(makeFabIcon());
      }
    }
  }

  /* ==================================================================
     BAGIAN 4 - State global modul
     ================================================================== */

  var rootEl = null;          /* #mdt-root */
  var fabEl = null;           /* #mdt-fab */
  var panelsEl = null;        /* #mdt-panels */
  var topbarEl = null;        /* #mdt-topbar */

  var currentTab = "elements";
  var built = {};             /* Penanda panel yang sudah dibangun */

  var selectedEl = null;      /* Elemen DOM yang sedang dipilih ($0) */

  /* Referensi elemen antarmuka yang dipakai lintas fungsi. */
  var domTreeEl, domBreadcrumbEl, domSideEl, domSearchEl, pickBtnEl;
  var stylesBodyEl, computedBodyEl, stylesTabBarEl;
  var pickCursorEl, iovEl, ihlEl, itipEl;

  var logwrapEl, conFilterEl, conLevelsEl, conSettingsEl, regexBtnEl;
  var replEl, replRunEl, logs = [], logMax = 500, autoscroll = true;
  /* Flag perilaku Konsol yang dikendalikan panel Pengaturan. */
  var showTime = false, groupLogs = false, showNonEnum = false, showGetters = false, renderAsync = false;
  var filterRegex = false;                     /* Mode saring regex di toolbar konsol */
  var groupDepth = 0;                          /* Kedalaman console.group saat ini */
  var consoleTimers = {}, consoleCounts = {};  /* Peta pewaktu & penghitung console */
  /* Status pelengkapan otomatis REPL (#mdt-ac). */
  var acEl = null, acItems = [], acIndex = -1, acOpen = false;

  var srcNavEl, srcFileTabsEl, srcCodeEl, srcStatusRightEl, srcSubTabsEl, srcPrettyBtnEl;
  var srcTreeWrapEl, snippetsNavEl, snippetEditorWrapEl, snipTaEl, snipGutterEl, snipBarEl;

  var netListEl, netDetailEl, netDetailBodyEl, netDetailTabsEl, netFilterEl;
  var netRows = {}, netOrder = [], netMaxDur = 1, netInited = false, netSelected = null;
  var netQueue = []; /* Pesan jaringan yang menunggu panel dibangun */
  /* FASE 4: filter tipe/status, bilah alat detail, dan status format body. */
  var netTypeFilterEl = null, netStatusFilterEl = null, netDetailToolsEl = null;
  var netBodyFormatted = true;

  var perfScrollEl, fpsBigEl, fpsBarEl, fpsRaf = null, fpsFrames = 0, fpsLast = 0;

  var appNavEl, appTableWrapEl, appPreviewEl, appFilterEl, appNavOpen = false;
  var appCurrentStore = "localStorage", appData = [];

  var uaScrollEl, aboutScrollEl;
  var guideDone = {};

  /* --- Status pengaturan (FASE 1: panel Pengaturan) --- */
  var settingsScrollEl, settingsEls = {};

  var pickActive = false, hoverEl = null;

  /* ==================================================================
     BAGIAN 4b - Pengaturan (model, persistensi, penerapan)
     Panel Pengaturan menyimpan preferensi tampilan, panel aktif, dan
     perilaku panel Konsol. Nilai disimpan di browser.storage.local
     (kunci "mdt-settings") dengan cadangan localStorage. Segala akses
     dibungkus try/catch dan tidak pernah melempar bila API tidak ada,
     sehingga harness jsdom tetap lulus.
     ================================================================== */

  var SETTINGS_KEY = "mdt-settings";

  /* Daftar id panel yang bisa dinyalakan/dimatikan dari Pengaturan.
     Tab "settings" sendiri tidak disertakan (selalu aktif). */
  var CONFIG_PANELS = ["elements", "console", "sources", "network", "perf", "storage", "ua", "about"];

  function defaultSettings() {
    return {
      theme: "dark",          /* "dark" | "light" */
      opacity: 0.92,          /* transparansi panel #mdt-root (0.5 - 1) */
      heightVh: 55,           /* tinggi panel dalam vh (30 - 95) */
      fontSize: 12,           /* ukuran font panel (10 - 16 px) */
      panels: {
        elements: true, console: true, sources: true, network: true,
        perf: true, storage: true, ua: true, about: true
      },
      console: {
        autoscroll: true,
        timestamps: false,
        groups: false,
        logMax: 500,
        nonEnum: false,
        getters: false,
        async: false,
        regex: false
      },
      network: {
        captureBody: true   /* FASE 4: tangkap body respons (filterResponseData) */
      }
    };
  }

  var settings = defaultSettings();

  /** Salin dalam (deep clone) sederhana melalui JSON. */
  function cloneSettings(o) {
    try {
      return JSON.parse(JSON.stringify(o));
    } catch (e) {
      return defaultSettings();
    }
  }

  function clampNum(v, lo, hi, fallback) {
    v = Number(v);
    if (!isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }

  /** Menggabungkan data tersimpan ke model, hanya kunci yang dikenal. */
  function mergeSettings(src) {
    if (!src || typeof src !== "object") return;
    if (src.theme === "light" || src.theme === "dark") settings.theme = src.theme;
    settings.opacity = clampNum(src.opacity, 0.5, 1, settings.opacity);
    settings.heightVh = clampNum(src.heightVh, 30, 95, settings.heightVh);
    settings.fontSize = clampNum(src.fontSize, 10, 16, settings.fontSize);

    if (src.panels && typeof src.panels === "object") {
      for (var i = 0; i < CONFIG_PANELS.length; i++) {
        var id = CONFIG_PANELS[i];
        if (Object.prototype.hasOwnProperty.call(src.panels, id)) {
          settings.panels[id] = !!src.panels[id];
        }
      }
    }

    if (src.console && typeof src.console === "object") {
      var c = src.console;
      if (typeof c.autoscroll === "boolean") settings.console.autoscroll = c.autoscroll;
      if (typeof c.timestamps === "boolean") settings.console.timestamps = c.timestamps;
      if (typeof c.groups === "boolean") settings.console.groups = c.groups;
      if (typeof c.nonEnum === "boolean") settings.console.nonEnum = c.nonEnum;
      if (typeof c.getters === "boolean") settings.console.getters = c.getters;
      if (typeof c.async === "boolean") settings.console.async = c.async;
      if (typeof c.regex === "boolean") settings.console.regex = c.regex;
      settings.console.logMax = Math.round(clampNum(c.logMax, 50, 5000, settings.console.logMax));
    }

    if (src.network && typeof src.network === "object") {
      if (typeof src.network.captureBody === "boolean") settings.network.captureBody = src.network.captureBody;
    }

    /* Jamin minimal satu panel penyusun tetap aktif. */
    var any = false;
    for (var k = 0; k < CONFIG_PANELS.length; k++) {
      if (settings.panels[CONFIG_PANELS[k]]) any = true;
    }
    if (!any) settings.panels.elements = true;
  }

  /** Apakah sebuah panel tampil di topbar. Tab settings selalu tampil. */
  function isPanelEnabled(id) {
    if (id === "settings") return true;
    if (!settings.panels) return true;
    return settings.panels[id] !== false;
  }

  /** Mengembalikan id tab pertama yang aktif (urutan TABS). */
  function firstEnabledTab() {
    for (var i = 0; i < TABS.length; i++) {
      if (isPanelEnabled(TABS[i].id)) return TABS[i].id;
    }
    return "settings";
  }

  /** Membaca pengaturan secara sinkron dari localStorage (cepat, tanpa kedip). */
  function loadSettingsSync() {
    try {
      if (!window.localStorage) return;
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) mergeSettings(JSON.parse(raw));
    } catch (e) {
      /* abaikan isi rusak / akses ditolak */
    }
  }

  /** Membaca ulang dari browser.storage.local (asinkron) bila tersedia. */
  function loadSettingsAsync() {
    try {
      if (!EXT || !EXT.storage || !EXT.storage.local || !EXT.storage.local.get) return;
      var p = EXT.storage.local.get(SETTINGS_KEY);
      if (p && typeof p.then === "function") {
        p.then(function (res) {
          if (res && res[SETTINGS_KEY]) {
            mergeSettings(res[SETTINGS_KEY]);
            applySettings();
            syncSettingsUI();
          }
        }).catch(noop);
      }
    } catch (e) {
      /* abaikan bila API tidak tersedia */
    }
  }

  /** Menyimpan pengaturan ke localStorage dan browser.storage.local. */
  function saveSettings() {
    var data = cloneSettings(settings);
    try {
      if (window.localStorage) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (e) {}
    try {
      if (EXT && EXT.storage && EXT.storage.local && EXT.storage.local.set) {
        var p = EXT.storage.local.set({ "mdt-settings": data });
        if (p && typeof p.catch === "function") p.catch(noop);
      }
    } catch (e) {}
  }

  /** Menyalin nilai pengaturan ke variabel modul yang dipakai panel lain. */
  function applyConsoleSettings() {
    autoscroll = !!settings.console.autoscroll;
    logMax = settings.console.logMax;
    showTime = !!settings.console.timestamps;
    groupLogs = !!settings.console.groups;
    showNonEnum = !!settings.console.nonEnum;
    showGetters = !!settings.console.getters;
    renderAsync = !!settings.console.async;
    filterRegex = !!settings.console.regex;
    if (regexBtnEl) regexBtnEl.classList.toggle("on", filterRegex);
    if (conFilterEl) conFilterEl.setAttribute("placeholder", filterRegex ? "Saring log (regex)" : "Saring log");
  }

  /**
   * Menerapkan pengaturan ke antarmuka: tema, transparansi, tinggi, font,
   * perilaku Konsol, dan daftar tab di topbar.
   */
  function applySettings() {
    applyConsoleSettings();
    if (!rootEl) return;
    rootEl.classList.toggle("mdt-light", settings.theme === "light");
    rootEl.style.opacity = String(settings.opacity);
    rootEl.style.height = settings.heightVh + "vh";
    rootEl.style.minHeight = "0";
    rootEl.style.fontSize = settings.fontSize + "px";

    if (topbarEl) populateTopbar();
    if (!isPanelEnabled(currentTab)) activateTab(firstEnabledTab());
  }

  /* ==================================================================
     BAGIAN 5 - Pembangunan kerangka antarmuka
     ================================================================== */

  /** Membangun kontainer topbar. */
  function buildTopbar() {
    topbarEl = el("div");
    topbarEl.id = "mdt-topbar";
    populateTopbar();
  }

  /** Mengisi topbar dengan tab yang aktif serta tombol tutup. */
  function populateTopbar() {
    if (!topbarEl) return;
    topbarEl.textContent = "";

    for (var i = 0; i < TABS.length; i++) {
      (function (tab) {
        /* Panel yang dimatikan lewat Pengaturan tidak tampil di topbar. */
        if (!isPanelEnabled(tab.id)) return;
        var btn = el("button", "mdt-tab");
        btn.type = "button";
        btn.setAttribute("data-tab", tab.id);
        if (tab.id === currentTab) btn.classList.add("on");
        if (tab.icon && tab.icon.length) btn.appendChild(svgIcon(tab.icon, 13));
        btn.appendChild(el("span", null, TAB_LABELS[tab.id] || tab.label || tab.id));
        btn.addEventListener("click", function () {
          activateTab(tab.id);
        });
        topbarEl.appendChild(btn);
      })(TABS[i]);
    }

    var closeBtn = el("button", null, "Tutup");
    closeBtn.id = "mdt-closebtn";
    closeBtn.type = "button";
    closeBtn.setAttribute("title", "Tutup NT DevTools");
    closeBtn.addEventListener("click", function () {
      setVisible(false);
    });
    topbarEl.appendChild(closeBtn);
  }

  /** Membangun panel kosong per tab (diisi secara malas saat diaktifkan). */
  function buildPanels() {
    panelsEl = el("div");
    panelsEl.id = "mdt-panels";
    for (var i = 0; i < TABS.length; i++) {
      var p = el("div", "mdt-panel");
      p.setAttribute("data-panel", TABS[i].id);
      panelsEl.appendChild(p);
    }
  }

  /** URL berkas ikon ekstensi (icons/icon.png) untuk tombol mengambang. */
  function fabIconUrl() {
    try {
      if (EXT && EXT.runtime && typeof EXT.runtime.getURL === "function") {
        return EXT.runtime.getURL("icons/icon.png");
      }
    } catch (e) {
      /* abaikan: konteks tanpa API ekstensi */
    }
    return "";
  }

  /**
   * Membuat elemen ikon FAB.
   * Memakai berkas ikon ekstensi (icons/icon.png) bila API tersedia; jika
   * tidak, jatuh ke ikon SVG cadangan dari MDT_ICONS.FAB agar tombol tetap
   * terlihat di semua konteks.
   */
  function makeFabIcon() {
    var url = fabIconUrl();
    if (url) {
      var img = document.createElement("img");
      img.className = "mdt-fab-img";
      img.src = url;
      img.alt = "";
      img.setAttribute("draggable", "false");
      return img;
    }
    return svgIcon(ICONS.FAB, IS_MOBILE ? 22 : 18);
  }

  /** Membangun FAB (tombol mengambang pembuka panel). */
  function buildFab() {
    fabEl = el("button");
    fabEl.id = "mdt-fab";
    fabEl.type = "button";
    fabEl.setAttribute("title", "Buka NT DevTools");
    fabEl.appendChild(makeFabIcon());
    fabEl.style.display = "flex"; /* default: panel tertutup -> FAB tampil */
    fabEl.addEventListener("click", function () {
      setVisible(true);
    });
  }

  /** Membangun overlay inspeksi (bidang tangkap, sorotan, tooltip, kursor). */
  function buildInspectOverlay() {
    iovEl = el("div");
    iovEl.id = "mdt-iov";
    /* Overlay tidak boleh menelan klik; penangkapan dilakukan via listener
       capture pada document. Karena itu pointer-events dimatikan. */
    iovEl.style.pointerEvents = "none";

    ihlEl = el("div");
    ihlEl.id = "mdt-ihl";

    itipEl = el("div");
    itipEl.id = "mdt-itip";

    pickCursorEl = el("div");
    pickCursorEl.id = "mdt-pick-cursor";
    pickCursorEl.appendChild(el("span", "mdt-pick-ring"));
    pickCursorEl.appendChild(el("span", "mdt-pick-dot"));
  }

  /** Menyusun seluruh akar antarmuka ke documentElement. */
  function buildShell() {
    rootEl = el("div");
    rootEl.id = "mdt-root";

    var handle = el("div");
    handle.id = "mdt-handle";
    handle.setAttribute("title", "Geser untuk ubah tinggi");

    buildTopbar();
    buildPanels();

    rootEl.appendChild(handle);
    rootEl.appendChild(topbarEl);
    rootEl.appendChild(panelsEl);

    document.documentElement.appendChild(rootEl);

    buildFab();
    document.documentElement.appendChild(fabEl);

    buildInspectOverlay();
    document.documentElement.appendChild(iovEl);
    document.documentElement.appendChild(ihlEl);
    document.documentElement.appendChild(itipEl);
    document.documentElement.appendChild(pickCursorEl);

    initResizeHandle(handle);
    initPickListeners();
  }

  /* ==================================================================
     BAGIAN 6 - Buka / tutup panel dan pesan status
     ================================================================== */

  /** Apakah panel sedang terbuka. */
  function isOpen() {
    return !!rootEl && rootEl.classList.contains("open");
  }

  /**
   * Mengatur visibilitas panel.
   * @param {boolean} visible
   */
  function setVisible(visible) {
    if (!rootEl) return;
    visible = !!visible;
    if (visible) {
      rootEl.classList.add("open");
      fabEl.style.display = "none";
      if (!built[currentTab]) activateTab(currentTab);
      else refreshPanel(currentTab);
    } else {
      rootEl.classList.remove("open");
      fabEl.style.display = "flex";
      stopFps();
      exitPick();
    }
    reportState(visible);
  }

  /** Mengirim status panel kembali ke background. */
  function reportState(visible) {
    if (!EXT || !EXT.runtime || !EXT.runtime.sendMessage) return;
    try {
      EXT.runtime.sendMessage({ action: "panelStateChanged", visible: !!visible });
    } catch (e) {
      /* abaikan bila background tidak siap */
    }
  }

  /* ==================================================================
     BAGIAN 7 - Aktivasi tab dan pembangun panel
     ================================================================== */

  /**
   * Mengaktifkan tab berdasarkan id.
   * @param {string} id
   */
  function activateTab(id) {
    if (!panelsEl) return;
    if (!isPanelEnabled(id)) id = firstEnabledTab();
    currentTab = id;

    var tabs = topbarEl.querySelectorAll(".mdt-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("on", tabs[i].getAttribute("data-tab") === id);
    }

    var panels = panelsEl.querySelectorAll(".mdt-panel");
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle("on", panels[j].getAttribute("data-panel") === id);
    }

    var panel = panelsEl.querySelector('.mdt-panel[data-panel="' + id + '"]');
    if (panel && !built[id]) {
      var builder = BUILDERS[id];
      if (builder) {
        try {
          builder(panel);
        } catch (e) {
          panel.appendChild(el("div", "mdt-app-empty", "Gagal membangun panel: " + e.message));
        }
      }
      built[id] = true;
    }

    if (id === "perf") startFps();
    else stopFps();

    refreshPanel(id);
  }

  /** Memuat ulang data panel tertentu sesuai kebutuhannya. */
  function refreshPanel(id) {
    if (id === "elements" && built.elements) renderDomTree();
    else if (id === "network" && built.network) ensureNetInit();
    else if (id === "storage" && built.storage) renderAppTable();
    else if (id === "ua" && built.ua) renderDevice();
  }

  /* Peta fungsi pembangun tiap panel. */
  var BUILDERS = {
    elements: buildElements,
    console: buildConsole,
    sources: buildSources,
    network: buildNetwork,
    perf: buildPerformance,
    storage: buildStorage,
    ua: buildDevice,
    about: buildAbout,
    settings: buildSettings
  };

  /* ==================================================================
     BAGIAN 8 - Resize handle (geser tinggi panel)
     ================================================================== */

  function initResizeHandle(handle) {
    var dragging = false;
    var startY = 0;
    var startH = 0;

    function onDown(e) {
      dragging = true;
      startY = e.clientY;
      startH = rootEl.getBoundingClientRect().height;
      if (handle.setPointerCapture && e.pointerId !== undefined) {
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var delta = startY - e.clientY;
      var nh = Math.max(160, Math.min(window.innerHeight * 0.95, startH + delta));
      rootEl.style.height = nh + "px";
    }
    function onUp() {
      dragging = false;
    }

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  /* ==================================================================
     BAGIAN 9 - Panel ELEMEN (DOM tree, breadcrumb, styles, pick)
     ================================================================== */

  var domRowMap = new Map();  /* node -> { row, wrap, built, expanded, tog } */
  var domNodeLimit = 400;

  /* --- FASE 3: status fitur area Elemen lanjutan --- */
  var sideTab = "styles";          /* tab aktif bilah samping: styles|computed|box|events */
  var boxBodyEl = null;            /* badan diagram box model */
  var eventsBodyEl = null;         /* badan daftar event listener */
  var stylesFilterEl = null;       /* baris filter properti */
  var domAutoUpdate = true;        /* toggle pembaruan pohon DOM otomatis */
  var domObserver = null;          /* MutationObserver pada document */
  var domRafPending = false;       /* penjaga agar penjadwalan rAF tidak bertumpuk */
  /* Registry event listener yang dilacak melalui patch EventTarget.prototype. */
  var listenerRegistry = new WeakMap();
  var evTrackerInstalled = false;

  function buildElements(panel) {
    var outer = el("div");
    outer.id = "mdt-dom-outer";

    /* --- Toolbar atas --- */
    var tb = el("div", "mdt-toolbar");

    pickBtnEl = el("button", "mdt-tbtn mdt-pick-btn", "Pilih");
    pickBtnEl.type = "button";
    pickBtnEl.setAttribute("title", "Pilih elemen di halaman");
    pickBtnEl.addEventListener("click", togglePick);
    tb.appendChild(pickBtnEl);

    domSearchEl = el("input", "mdt-tbinput");
    domSearchEl.id = "mdt-dom-search";
    domSearchEl.setAttribute("placeholder", "Cari tag atau #id .kelas");
    domSearchEl.addEventListener("input", function () {
      filterDomTree(domSearchEl.value);
    });
    tb.appendChild(domSearchEl);

    var tbSep = el("div", "mdt-sep");
    tb.appendChild(tbSep);

    var refreshBtn = el("button", "mdt-tbtn", "Muat ulang");
    refreshBtn.type = "button";
    refreshBtn.setAttribute("title", "Bangun ulang pohon DOM");
    refreshBtn.addEventListener("click", renderDomTree);
    tb.appendChild(refreshBtn);

    /* FASE 3: tombol aktif/nonaktifkan pembaruan otomatis DOM. */
    var autoBtn = el("button", "mdt-tbtn mdt-dom-auto" + (domAutoUpdate ? " on" : ""), "Auto");
    autoBtn.id = "mdt-dom-auto";
    autoBtn.type = "button";
    autoBtn.setAttribute("title", "Perbarui pohon DOM otomatis saat halaman berubah");
    autoBtn.addEventListener("click", function () {
      setDomAutoUpdate(!domAutoUpdate);
      autoBtn.classList.toggle("on", domAutoUpdate);
    });
    tb.appendChild(autoBtn);

    var sideBtn = el("button", "mdt-tbtn", "Gaya");
    sideBtn.type = "button";
    sideBtn.setAttribute("title", "Tampilkan/sembunyikan panel gaya");
    sideBtn.addEventListener("click", function () {
      if (domSideEl) domSideEl.classList.toggle("on");
    });
    tb.appendChild(sideBtn);

    outer.appendChild(tb);

    /* --- Pemecah: pohon DOM + sidebar gaya --- */
    var split = el("div");
    split.id = "mdt-dom-split";

    domTreeEl = el("div");
    domTreeEl.id = "mdt-dom-tree";
    split.appendChild(domTreeEl);

    domSideEl = el("div");
    domSideEl.id = "mdt-dom-side";

    stylesTabBarEl = el("div");
    stylesTabBarEl.id = "mdt-styles-tabs";
    /* FASE 3: tambah tab Box Model dan Event Listeners di bilah samping. */
    var sideTabs = [
      ["styles", "Styles", function () { return stylesBodyEl; }, function () { if (selectedEl) renderStyles(selectedEl); }],
      ["computed", "Computed", function () { return computedBodyEl; }, renderComputed],
      ["box", "Box Model", function () { return boxBodyEl; }, renderBoxModel],
      ["events", "Event Listeners", function () { return eventsBodyEl; }, renderEventListeners]
    ];
    var stabEls = {};
    for (var ti = 0; ti < sideTabs.length; ti++) {
      (function (key, label, bodyFn, refreshFn) {
        var b = el("button", "mdt-stab" + (key === "styles" ? " on" : ""), label);
        b.type = "button";
        b.setAttribute("data-mdt-side", key);
        b.addEventListener("click", function () {
          selectSideTab(key);
          if (refreshFn) refreshFn();
        });
        stylesTabBarEl.appendChild(b);
        stabEls[key] = b;
      })(sideTabs[ti][0], sideTabs[ti][1], sideTabs[ti][2], sideTabs[ti][3]);
    }
    /* Simpan referensi tab untuk sinkronisasi status aktif. */
    stylesTabBarEl.__tabs = stabEls;
    domSideEl.appendChild(stylesTabBarEl);

    var sFilter = el("div");
    sFilter.id = "mdt-styles-filter";
    stylesFilterEl = sFilter;
    var sfInput = el("input");
    sfInput.setAttribute("placeholder", "Filter properti");
    sfInput.addEventListener("input", function () {
      filterStyles(sfInput.value);
    });
    sFilter.appendChild(sfInput);
    domSideEl.appendChild(sFilter);

    stylesBodyEl = el("div");
    stylesBodyEl.id = "mdt-styles-body";
    computedBodyEl = el("div");
    computedBodyEl.id = "mdt-computed-body";
    /* FASE 3: wadah Box Model dan Event Listeners. */
    boxBodyEl = el("div");
    boxBodyEl.id = "mdt-box-body";
    boxBodyEl.style.display = "none";
    eventsBodyEl = el("div");
    eventsBodyEl.id = "mdt-events-body";
    eventsBodyEl.style.display = "none";
    domSideEl.appendChild(stylesBodyEl);
    domSideEl.appendChild(computedBodyEl);
    domSideEl.appendChild(boxBodyEl);
    domSideEl.appendChild(eventsBodyEl);

    split.appendChild(domSideEl);
    outer.appendChild(split);

    /* --- Breadcrumb bawah --- */
    domBreadcrumbEl = el("div");
    domBreadcrumbEl.id = "mdt-dom-breadcrumb";
    outer.appendChild(domBreadcrumbEl);

    panel.appendChild(outer);
    renderDomTree();
  }

  /** Mengosongkan pohon DOM lalu membangun ulang dari documentElement. */
  function renderDomTree() {
    if (!domTreeEl) return;
    domTreeEl.textContent = "";
    domRowMap.clear();
    var root = document.documentElement;
    if (!root) return;
    domTreeEl.appendChild(makeDomNode(root, 0, true));
    if (selectedEl && domRowMap.has(selectedEl)) markSelectedRow(selectedEl);
  }

  /** Membuat fragmen baris untuk satu node elemen beserta wadah anaknya. */
  function makeDomNode(node, depth, expand) {
    var frag = document.createDocumentFragment();
    var row = createElementRow(node, depth);

    var wrap = el("div");
    wrap.style.display = expand ? "block" : "none";

    var entry = { row: row, wrap: wrap, built: false, expanded: !!expand, tog: row.__tog };
    domRowMap.set(node, entry);

    frag.appendChild(row);
    frag.appendChild(wrap);

    if (expand) buildDomChildren(node, wrap, depth);
    return frag;
  }

  /** Membuat baris <tag attr="nilai"> untuk satu elemen. */
  function createElementRow(node, depth) {
    var row = el("div", "mdt-drow2");
    row.style.paddingLeft = depth * 12 + 4 + "px";

    var kids = node.childNodes ? node.childNodes.length : 0;
    var tog = el("span", kids ? "mdt-dtog" : "mdt-dnotog", kids ? "-" : "");
    row.appendChild(tog);
    row.__tog = tog;

    if (kids) {
      tog.addEventListener("click", function (ev) {
        ev.stopPropagation();
        toggleDomNode(node);
      });
    }

    row.appendChild(el("span", "mdt-tag", "<" + node.tagName.toLowerCase()));

    /* FASE 3: tiap pasangan atribut dibuat oleh addAttrSpans agar nama maupun
       nilainya dapat disunting sebaris (klik dua kali) dan diterapkan ke
       elemen nyata melalui setAttribute/removeAttribute. */
    var attrs = node.attributes || [];
    var shown = Math.min(attrs.length, 8);
    for (var i = 0; i < shown; i++) {
      row.appendChild(el("span", "mdt-sp", " "));
      addAttrSpans(row, node, attrs[i]);
    }
    if (attrs.length > shown) {
      row.appendChild(el("span", "mdt-sp", " "));
      row.appendChild(el("span", "mdt-txt", "…+" + (attrs.length - shown)));
    }
    row.appendChild(el("span", "mdt-tag", ">"));

    /* FASE 3: tombol tambah atribut baru pada baris. */
    var addAttrBtn = el("button", "mdt-attr-addbtn", "+");
    addAttrBtn.type = "button";
    addAttrBtn.setAttribute("title", "Tambah atribut baru");
    addAttrBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      addAttributeInline(node, row);
    });
    row.appendChild(addAttrBtn);

    /* Tombol menu kecil di sisi kanan. */
    var menu = el("button", "mdt-dom-menubtn", "...");
    menu.type = "button";
    menu.setAttribute("title", "Menu elemen");
    menu.addEventListener("click", function (ev) {
      ev.stopPropagation();
      openCtxMenu(ev, node);
    });
    row.appendChild(menu);

    row.addEventListener("click", function () {
      selectElement(node);
    });

    return row;
  }

  /* ==================================================================
     FASE 3 - Penyuntingan atribut & teks sebaris
     Perubahan langsung diterapkan ke elemen nyata halaman melalui
     setAttribute/removeAttribute (atribut) dan nodeValue (teks).
     ================================================================== */

  /** Membuat input sebaris untuk mengubah sebuah span, lalu menerapkannya. */
  function inlineEdit(span, initial, commit) {
    var input = el("input", "mdt-style-editinput mdt-inline-edit");
    input.value = initial == null ? "" : String(initial);
    input.setAttribute("spellcheck", "false");
    span.parentNode.insertBefore(input, span.nextSibling);
    span.style.display = "none";
    try { input.focus(); input.select(); } catch (e) {}

    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var val = input.value;
      input.remove();
      if (save) { try { commit(val); } catch (e) {} }
    }
    input.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); input.value = input.defaultValue; finish(false); }
    });
    input.addEventListener("blur", function () { finish(true); });
    return input;
  }

  /** Membangun pasangan nama=nilai atribut yang dapat disunting. */
  function addAttrSpans(row, node, attr) {
    var nameEl = el("span", "mdt-an", attr.name);
    nameEl.setAttribute("title", "Klik dua kali untuk ubah nama atribut");
    nameEl.setAttribute("data-mdt-attr", attr.name);
    nameEl.addEventListener("dblclick", function (ev) {
      ev.stopPropagation();
      inlineEdit(nameEl, attr.name, function (v) {
        var nm = String(v || "").trim();
        if (!nm || nm === attr.name) { nameEl.textContent = attr.name; return; }
        try {
          var val = node.getAttribute(attr.name);
          node.removeAttribute(attr.name);
          node.setAttribute(nm, val == null ? "" : val);
          attr.name = nm;
          nameEl.textContent = nm;
          if (selectedEl === node) renderStyles(node);
        } catch (e) { nameEl.textContent = attr.name; }
      });
    });
    row.appendChild(nameEl);

    if (attr.value !== "") {
      row.appendChild(el("span", "mdt-eq", "="));
      var valEl = el("span", "mdt-av", '"' + attr.value + '"');
      valEl.setAttribute("title", "Klik dua kali untuk ubah nilai atribut");
      valEl.setAttribute("data-mdt-attrval", attr.name);
      valEl.addEventListener("dblclick", function (ev) {
        ev.stopPropagation();
        inlineEdit(valEl, attr.value, function (v) {
          try {
            node.setAttribute(attr.name, v);
            attr.value = v;
            valEl.textContent = '"' + v + '"';
            if (selectedEl === node) renderStyles(node);
          } catch (e) {}
        });
      });
      row.appendChild(valEl);
    } else {
      row.appendChild(el("span", "mdt-eq", "="));
      var emptyVal = el("span", "mdt-av", '""');
      emptyVal.setAttribute("title", "Klik dua kali untuk ubah nilai atribut");
      emptyVal.addEventListener("dblclick", function (ev) {
        ev.stopPropagation();
        inlineEdit(emptyVal, "", function (v) {
          try {
            node.setAttribute(attr.name, v);
            attr.value = v;
            emptyVal.textContent = '"' + v + '"';
            if (selectedEl === node) renderStyles(node);
          } catch (e) {}
        });
      });
      row.appendChild(emptyVal);
    }
  }

  /** Menambahkan atribut baru secara sebaris pada baris pohon. */
  function addAttributeInline(node, row) {
    if (row.querySelector(".mdt-attr-new")) return;
    var holder = el("span", "mdt-attr-new");
    var eq = el("span", "mdt-eq", "=");
    var input = el("input", "mdt-style-editinput mdt-inline-edit");
    input.setAttribute("placeholder", 'nama="nilai"');
    input.setAttribute("spellcheck", "false");
    holder.appendChild(input);
    holder.appendChild(eq);
    var closing = row.querySelector(".mdt-tag:last-of-type");
    row.insertBefore(holder, closing);
    try { input.focus(); } catch (e) {}

    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var raw = input.value;
      holder.remove();
      if (!save) return;
      var nm = String(raw || "").trim();
      if (!nm) return;
      var val = "";
      var m = nm.match(/^([^\s=]+)\s*=\s*(.*)$/);
      if (m) { nm = m[1]; val = m[2].replace(/^["']|["']$/g, ""); }
      try {
        node.setAttribute(nm, val);
        renderDomTree();
      } catch (e) {}
    }
    input.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function () { finish(true); });
  }

  /** Membangun baris anak (elemen, teks, komentar) ke wadah. */
  function buildDomChildren(node, wrap, depth) {
    var entry = domRowMap.get(node);
    if (entry) entry.built = true;
    wrap.textContent = "";
    var child = node.firstChild;
    var count = 0;
    while (child) {
      if (count++ >= domNodeLimit) {
        wrap.appendChild(el("div", "mdt-dtextrow", "… batas tampilan tercapai"));
        break;
      }
      if (child.nodeType === 1) {
        wrap.appendChild(makeDomNode(child, depth + 1, false));
      } else if (child.nodeType === 3) {
        var txt = (child.nodeValue || "").trim();
        if (txt) {
          var tr = el("div", "mdt-dtextrow");
          tr.style.paddingLeft = (depth + 1) * 12 + 16 + "px";
          var txtSpan = el("span", "mdt-txt", txt.length > 120 ? txt.slice(0, 120) + "…" : txt);
          txtSpan.setAttribute("title", "Klik dua kali untuk ubah teks (textContent)");
          tr.appendChild(txtSpan);
          tr.addEventListener("click", function () {
            selectElement(node);
          });
          /* FASE 3: sunting teks node secara sebaris (child.nodeValue). */
          (function (textNode) {
            txtSpan.addEventListener("dblclick", function (ev) {
              ev.stopPropagation();
              inlineEdit(txtSpan, textNode.nodeValue, function (v) {
                try {
                  textNode.nodeValue = v;
                  var nv = (textNode.nodeValue || "").trim();
                  txtSpan.textContent = nv.length > 120 ? nv.slice(0, 120) + "…" : nv;
                  if (selectedEl === node) renderStyles(node);
                } catch (e) {}
              });
            });
          })(child);
          wrap.appendChild(tr);
        }
      } else if (child.nodeType === 8) {
        var cr = el("div", "mdt-dtextrow");
        cr.style.paddingLeft = (depth + 1) * 12 + 16 + "px";
        cr.appendChild(el("span", "mdt-cmt", "<!-- " + (child.nodeValue || "").trim() + " -->"));
        wrap.appendChild(cr);
      }
      child = child.nextSibling;
    }
  }

  /** Membuka / menutup cabang node pada pohon DOM. */
  function toggleDomNode(node) {
    var entry = domRowMap.get(node);
    if (!entry) return;
    if (!entry.built) {
      buildDomChildren(node, entry.wrap, depthOfNode(node));
      entry.built = true;
    }
    entry.expanded = !entry.expanded;
    entry.wrap.style.display = entry.expanded ? "block" : "none";
    if (entry.tog) entry.tog.textContent = entry.expanded ? "-" : "+";
  }

  /** Menghitung kedalaman node relatif terhadap documentElement. */
  function depthOfNode(node) {
    var d = 0;
    var n = node;
    while (n && n !== document.documentElement) {
      n = n.parentNode;
      d++;
    }
    return d;
  }

  /** Memperluas rantai leluhur hingga node terlihat di pohon. */
  function revealInTree(node) {
    var chain = [];
    var n = node;
    while (n && n !== document.documentElement) {
      chain.unshift(n);
      n = n.parentNode;
    }
    var cur = document.documentElement;
    ensureExpanded(cur);
    for (var i = 0; i < chain.length; i++) ensureExpanded(chain[i]);
  }

  /** Memastikan node tertentu dalam keadaan terbuka. */
  function ensureExpanded(node) {
    var entry = domRowMap.get(node);
    if (!entry) return;
    if (!entry.built) {
      buildDomChildren(node, entry.wrap, depthOfNode(node));
      entry.built = true;
    }
    if (!entry.expanded) {
      entry.expanded = true;
      entry.wrap.style.display = "block";
      if (entry.tog) entry.tog.textContent = "-";
    }
  }

  /** Menandai baris terpilih di pohon. */
  function markSelectedRow(node) {
    var rows = domTreeEl.querySelectorAll(".mdt-drow2.sel");
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove("sel");
    var entry = domRowMap.get(node);
    if (entry && entry.row) {
      entry.row.classList.add("sel");
      if (entry.row.scrollIntoView) {
        try {
          entry.row.scrollIntoView({ block: "nearest" });
        } catch (e) {
          entry.row.scrollIntoView();
        }
      }
    }
  }

  /** Menyaring baris pohon berdasarkan teks pencarian. */
  function filterDomTree(q) {
    q = (q || "").toLowerCase();
    var rows = domTreeEl.querySelectorAll(".mdt-drow2");
    for (var i = 0; i < rows.length; i++) {
      var match = !q || rows[i].textContent.toLowerCase().indexOf(q) >= 0;
      rows[i].style.display = match ? "" : "none";
    }
  }

  /** Memilih elemen: perbarui pohon, breadcrumb, gaya, dan $0. */
  function selectElement(node) {
    if (!node || node.nodeType !== 1) return;
    selectedEl = node;
    if (domRowMap.has(node)) {
      revealInTree(node);
      markSelectedRow(node);
    }
    renderBreadcrumb(node);
    renderStyles(node);
    /* FASE 3: segarkan tab bilah samping yang sedang aktif. */
    if (sideTab === "computed") renderComputed();
    else if (sideTab === "box") renderBoxModel();
    else if (sideTab === "events") renderEventListeners();
    if (domSideEl) domSideEl.classList.add("on");
  }

  /** Mengalihkan tab bilah samping (styles/computed/box/events). */
  function selectSideTab(key) {
    sideTab = key;
    var bodies = { styles: stylesBodyEl, computed: computedBodyEl, box: boxBodyEl, events: eventsBodyEl };
    var tabs = stylesTabBarEl && stylesTabBarEl.__tabs ? stylesTabBarEl.__tabs : {};
    Object.keys(bodies).forEach(function (k) {
      if (bodies[k]) bodies[k].style.display = k === key ? "block" : "none";
      if (tabs[k]) tabs[k].classList.toggle("on", k === key);
    });
    /* Baris filter hanya relevan untuk Styles/Computed. */
    if (stylesFilterEl) stylesFilterEl.style.display = (key === "styles" || key === "computed") ? "flex" : "none";
  }

  /** Menampilkan breadcrumb jalur elemen. */
  function renderBreadcrumb(node) {
    if (!domBreadcrumbEl) return;
    domBreadcrumbEl.textContent = "";
    var chain = [];
    var n = node;
    while (n && n.nodeType === 1) {
      chain.unshift(n);
      n = n.parentNode;
    }
    for (var i = 0; i < chain.length; i++) {
      if (i > 0) domBreadcrumbEl.appendChild(el("span", "mdt-bc-sep", ">"));
      var item = el("span", "mdt-bc-item" + (chain[i] === node ? " active" : ""));
      item.appendChild(el("span", "mdt-bc-tag", chain[i].tagName.toLowerCase()));
      if (chain[i].id) item.appendChild(el("span", "mdt-bc-id", "#" + chain[i].id));
      var cls = chain[i].className;
      if (typeof cls === "string" && cls.trim()) {
        item.appendChild(el("span", "mdt-bc-cls", "." + cls.trim().split(/\s+/).join(".")));
      }
      item.addEventListener("click", function (target) {
        return function () {
          selectElement(target);
        };
      }(chain[i]));
      domBreadcrumbEl.appendChild(item);
    }
    domBreadcrumbEl.scrollLeft = domBreadcrumbEl.scrollWidth;
  }

  /** Menampilkan blok gaya tertabulasi untuk elemen terpilih. */
  function renderStyles(node) {
    if (!stylesBodyEl) return;
    stylesBodyEl.textContent = "";
    if (!node) return;

    /* 1. Gaya inline (elemen.style). Selalu ditampilkan agar pengguna dapat
       menambah properti baru walau belum ada atribut style sama sekali. */
    stylesBodyEl.appendChild(makeStyleBlock("element.style", node.style, "inline", inlineCtx(node)));

    /* 2. Aturan CSS yang cocok dari lembar gaya yang bisa diakses. */
    var rules = matchingRules(node);
    for (var i = 0; i < rules.length; i++) {
      stylesBodyEl.appendChild(makeStyleBlock(rules[i].selector, rules[i].style, rules[i].href, ruleCtx(node, rules[i].rule)));
    }

    if (!rules.length) {
      stylesBodyEl.appendChild(el("div", "mdt-style-addprop", "Tidak ada aturan lembar gaya yang cocok (mungkin lintas asal)."));
    }
  }

  /**
   * Konteks penyuntingan untuk blok element.style (inline).
   * Semua perubahan langsung memakai node.style sehingga terlihat di halaman.
   */
  function inlineCtx(node) {
    return {
      set: function (prop, val) { node.style.setProperty(prop, val); },
      disable: function (prop) { node.style.removeProperty(prop); },
      enable: function (prop, val) { node.style.setProperty(prop, val); },
      del: function (prop) { node.style.removeProperty(prop); }
    };
  }

  /**
   * Konteks penyuntingan untuk blok aturan lembar gaya. Perubahan diterapkan
   * ke aturan CSS asli (rule.style) BILA lembar gaya berada di asal yang sama,
   * sekaligus ke gaya inline elemen agar efeknya selalu terlihat.
   */
  function ruleCtx(node, rule) {
    return {
      _apply: function (prop, val) {
        try { node.style.setProperty(prop, val); } catch (e) {}
        try { if (rule && rule.style) rule.style.setProperty(prop, val); } catch (e2) {}
      },
      set: function (prop, val) { this._apply(prop, val); },
      disable: function (prop) {
        try { if (rule && rule.style) rule.style.setProperty(prop, ""); } catch (e) {}
      },
      enable: function (prop, val) {
        try { if (rule && rule.style) rule.style.setProperty(prop, val); } catch (e) {}
      },
      del: function (prop) {
        try { if (rule && rule.style) rule.style.removeProperty(prop); } catch (e) {}
      }
    };
  }

  /** Membuat satu blok gaya "selector { ... }" dengan penyuntingan langsung. */
  function makeStyleBlock(selector, style, source, ctx) {
    var block = el("div", "mdt-style-block");
    if (style && style.cssText) block.setAttribute("data-mdt-css", style.cssText);
    var head = el("div", "mdt-style-selector");
    head.appendChild(el("span", "mdt-style-selector-name", selector));
    head.appendChild(el("span", "mdt-style-brace", " {"));
    if (source) head.appendChild(el("span", "mdt-style-source", source === "inline" ? "inline" : shortUrl(source)));
    block.appendChild(head);

    var props = [];
    for (var i = 0; i < style.length; i++) props.push(style[i]);
    for (var j = 0; j < props.length; j++) {
      var prop = props[j];
      var val = style.getPropertyValue(prop);
      block.appendChild(makeStyleRule(prop, val, ctx));
    }

    /* FASE 3: baris tambah properti baru. */
    var addRow = el("div", "mdt-style-addprop mdt-add-prop", "+ Tambah properti");
    addRow.setAttribute("title", "Tambah properti baru secara langsung");
    addRow.addEventListener("click", function () {
      beginAddProperty(block, ctx, addRow);
    });
    block.appendChild(addRow);

    block.appendChild(el("div", "mdt-style-closebrace", "}"));
    return block;
  }

  /** Membuat satu baris properti gaya yang dapat disunting/dinonaktifkan. */
  function makeStyleRule(prop, val, ctx) {
    var row = el("div", "mdt-style-rule");
    row.setAttribute("data-mdt-prop", prop);

    /* FASE 3: kotak centang aktif/nonaktifkan properti. */
    var cb = el("input", "mdt-style-cb");
    cb.type = "checkbox";
    cb.checked = true;
    cb.setAttribute("title", "Aktifkan/nonaktifkan properti");
    cb.addEventListener("click", function (ev) { ev.stopPropagation(); });
    cb.addEventListener("change", function () {
      var off = !cb.checked;
      row.classList.toggle("disabled", off);
      if (!ctx) return;
      try {
        if (off) ctx.disable(prop);
        else ctx.enable(prop, valEl.textContent || val);
      } catch (e) {}
    });
    row.appendChild(cb);

    row.appendChild(el("span", "mdt-style-prop", prop));
    row.appendChild(el("span", "mdt-style-colon", ":"));
    if (isColor(val)) {
      var sw = el("span", "mdt-cb");
      sw.style.background = val;
      row.appendChild(sw);
    }
    var valEl = el("span", "mdt-style-val" + (isColor(val) ? " color-val" : ""), val);
    valEl.setAttribute("title", "Klik dua kali untuk ubah nilai properti");
    valEl.addEventListener("dblclick", function (ev) {
      ev.stopPropagation();
      inlineEdit(valEl, valEl.textContent, function (v) {
        valEl.textContent = v;
        if (ctx) { try { ctx.set(prop, v); } catch (e) {} }
      });
    });
    row.appendChild(valEl);
    row.appendChild(el("span", "mdt-style-semi", ";"));

    /* FASE 3: tombol aksi (hapus properti). */
    var actions = el("div", "mdt-style-actions");
    var delBtn = el("button", "mdt-style-action-btn", "×");
    delBtn.type = "button";
    delBtn.setAttribute("title", "Hapus properti");
    delBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (ctx) { try { ctx.del(prop); } catch (e) {} }
      row.remove();
    });
    actions.appendChild(delBtn);
    row.appendChild(actions);

    return row;
  }

  /** Menambahkan properti baru secara sebaris ke sebuah blok gaya. */
  function beginAddProperty(block, ctx, addRow) {
    if (block.querySelector(".mdt-addprop-input")) return;
    var holder = el("div", "mdt-style-rule mdt-addprop-input");
    holder.style.paddingLeft = "20px";
    var input = el("input", "mdt-style-editinput");
    input.setAttribute("placeholder", "nama: nilai");
    input.setAttribute("spellcheck", "false");
    holder.appendChild(input);
    block.insertBefore(holder, addRow);
    try { input.focus(); } catch (e) {}

    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      holder.remove();
      if (!save) return;
      var raw = String(input.value || "");
      var m = raw.match(/^\s*([^:]+?)\s*:\s*(.+?)\s*;?\s*$/);
      if (!m) return;
      var p = m[1].trim(), v = m[2].trim();
      if (!p) return;
      if (ctx) { try { ctx.set(p, v); } catch (e) {} }
      if (selectedEl) renderStyles(selectedEl);
    }
    input.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function () { finish(true); });
  }

  /** Menampilkan daftar properti computed untuk elemen terpilih. */
  function renderComputed() {
    if (!computedBodyEl) return;
    computedBodyEl.textContent = "";
    if (!selectedEl) {
      computedBodyEl.appendChild(el("div", "mdt-style-addprop", "Pilih elemen terlebih dahulu."));
      return;
    }
    var cs;
    try {
      cs = window.getComputedStyle(selectedEl);
    } catch (e) {
      return;
    }
    for (var i = 0; i < cs.length; i++) {
      var prop = cs[i];
      var val = cs.getPropertyValue(prop);
      var row = el("div", "mdt-comp-row");
      row.setAttribute("data-mdt-prop", prop);
      row.appendChild(el("span", "mdt-comp-prop", prop));
      if (isColor(val)) {
        var sw = el("span", "mdt-cb");
        sw.style.background = val;
        row.appendChild(sw);
      }
      var cval = el("span", "mdt-comp-val", val);
      cval.setAttribute("title", "Klik dua kali untuk terapkan nilai inline");
      cval.addEventListener("dblclick", function (p, el0) {
        return function (ev) {
          ev.stopPropagation();
          inlineEdit(el0, el0.textContent, function (v) {
            el0.textContent = v;
            try { selectedEl.style.setProperty(p, v); } catch (e) {}
          });
        };
      }(prop, cval));
      row.appendChild(cval);
      computedBodyEl.appendChild(row);
    }
  }

  /** Menyaring baris gaya berdasarkan teks (termasuk computed). */
  function filterStyles(q) {
    q = (q || "").toLowerCase();
    if (!stylesBodyEl) return;
    var rows = stylesBodyEl.querySelectorAll(".mdt-style-rule");
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.display = !q || rows[i].textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
    }
    if (computedBodyEl) {
      var crows = computedBodyEl.querySelectorAll(".mdt-comp-row");
      for (var j = 0; j < crows.length; j++) {
        crows[j].style.display = !q || crows[j].textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
      }
    }
  }

  /** Mendeteksi nilai berwarna agar bisa ditampilkan swatch. */
  function isColor(v) {
    if (!v) return false;
    return /^#([0-9a-f]{3,8})$/i.test(v) || /^rgba?\(/i.test(v) || /^hsla?\(/i.test(v);
  }

  /** Mengambil aturan CSS yang cocok untuk elemen (aman terhadap CORS). */
  function matchingRules(node) {
    var out = [];
    var sheets = document.styleSheets || [];
    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try {
        rules = sheets[i].cssRules;
      } catch (e) {
        continue; /* lembar gaya lintas asal */
      }
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r || !r.selectorText || !r.style) continue;
        try {
          if (node.matches && node.matches(r.selectorText)) {
            out.push({ selector: r.selectorText, style: r.style, href: sheets[i].href || "", rule: r });
          }
        } catch (e2) {}
      }
    }
    return out;
  }

  /** Memendekkan URL agar muat di label sumber. */
  function shortUrl(u) {
    try {
      var parts = String(u).split("/");
      return parts[parts.length - 1] || u;
    } catch (e) {
      return u;
    }
  }

  /* ==================================================================
     FASE 3 - Diagram box model
     Menampilkan lapisan margin, border, padding, dan ukuran konten
     untuk elemen terpilih berdasarkan gaya computed dan rect.
     ================================================================== */

  /** Mengambil nilai px numerik dari sebuah properti computed. */
  function pxOf(cs, prop) {
    var v = "";
    try { v = cs.getPropertyValue(prop); } catch (e) { v = ""; }
    return (v == null ? "" : String(v)).trim() || "0";
  }

  /** Membuat satu lapisan diagram box model. */
  function boxLayer(label, cls, sides) {
    var layer = el("div", "mdt-box-layer " + cls);
    layer.appendChild(el("div", "mdt-box-layer-name", label));
    layer.appendChild(el("span", "mdt-box-side top", sides.top));
    layer.appendChild(el("span", "mdt-box-side right", sides.right));
    layer.appendChild(el("span", "mdt-box-side bottom", sides.bottom));
    layer.appendChild(el("span", "mdt-box-side left", sides.left));
    var inner = el("div", "mdt-box-inner");
    layer.appendChild(inner);
    layer.__inner = inner;
    return layer;
  }

  /** Menampilkan diagram margin/border/padding/konten elemen terpilih. */
  function renderBoxModel() {
    if (!boxBodyEl) return;
    boxBodyEl.textContent = "";
    if (!selectedEl) {
      boxBodyEl.appendChild(el("div", "mdt-style-addprop", "Pilih elemen terlebih dahulu."));
      return;
    }
    var cs;
    try { cs = window.getComputedStyle(selectedEl); } catch (e) { cs = null; }
    if (!cs) {
      boxBodyEl.appendChild(el("div", "mdt-style-addprop", "Gaya computed tidak tersedia."));
      return;
    }
    var rect = null;
    try { rect = selectedEl.getBoundingClientRect(); } catch (e2) { rect = null; }

    var contentW = rect ? Math.round(rect.width) : Math.round(parseFloat(pxOf(cs, "width")) || 0);
    var contentH = rect ? Math.round(rect.height) : Math.round(parseFloat(pxOf(cs, "height")) || 0);

    var wrap = el("div", "mdt-boxmodel");
    var margin = boxLayer("margin", "mdt-box-margin", {
      top: pxOf(cs, "margin-top"), right: pxOf(cs, "margin-right"),
      bottom: pxOf(cs, "margin-bottom"), left: pxOf(cs, "margin-left")
    });
    var border = boxLayer("border", "mdt-box-border", {
      top: pxOf(cs, "border-top-width"), right: pxOf(cs, "border-right-width"),
      bottom: pxOf(cs, "border-bottom-width"), left: pxOf(cs, "border-left-width")
    });
    var padding = boxLayer("padding", "mdt-box-padding", {
      top: pxOf(cs, "padding-top"), right: pxOf(cs, "padding-right"),
      bottom: pxOf(cs, "padding-bottom"), left: pxOf(cs, "padding-left")
    });
    var content = el("div", "mdt-box-content");
    content.appendChild(el("span", "mdt-box-size", contentW + " x " + contentH));

    padding.__inner.appendChild(content);
    border.__inner.appendChild(padding);
    margin.__inner.appendChild(border);
    wrap.appendChild(margin);
    boxBodyEl.appendChild(wrap);

    /* Ringkasan tertulis untuk memudahkan pembacaan. */
    var summary = el("div", "mdt-box-summary");
    var rows = [
      ["Konten", contentW + " x " + contentH + " px"],
      ["Padding", pxOf(cs, "padding-top") + " " + pxOf(cs, "padding-right") + " " + pxOf(cs, "padding-bottom") + " " + pxOf(cs, "padding-left")],
      ["Border", pxOf(cs, "border-top-width") + " " + pxOf(cs, "border-right-width") + " " + pxOf(cs, "border-bottom-width") + " " + pxOf(cs, "border-left-width")],
      ["Margin", pxOf(cs, "margin-top") + " " + pxOf(cs, "margin-right") + " " + pxOf(cs, "margin-bottom") + " " + pxOf(cs, "margin-left")]
    ];
    for (var i = 0; i < rows.length; i++) {
      var r = el("div", "mdt-box-sumrow");
      r.appendChild(el("span", "mdt-box-sumkey", rows[i][0]));
      r.appendChild(el("span", "mdt-box-sumval", rows[i][1]));
      summary.appendChild(r);
    }
    boxBodyEl.appendChild(summary);
  }

  /* ==================================================================
     FASE 3 - Daftar event listener
     Firefox content script TIDAK memiliki getEventListeners() (hanya
     Chrome). Karena itu listener dikumpulkan dengan tiga cara:
       (a) atribut inline on* milik elemen;
       (b) pelacakan melalui patch EventTarget.prototype.addEventListener /
           removeEventListener (dipasang hati-hati: fungsi asli selalu
           dipanggil sehingga perilaku halaman tidak berubah);
       (c) window.getEventListeners() bila tersedia (mis. Chrome/polyfill).
     Keterbatasan: listener yang terpasang SEBELUM patch tidak terlacak.
     ================================================================== */

  /** Memasang pelacak listener dengan patch yang aman. */
  function installListenerTracker() {
    if (evTrackerInstalled) return;
    try {
      if (typeof EventTarget === "undefined" || !EventTarget.prototype) return;
      var proto = EventTarget.prototype;
      if (proto.__mdtPatched) { evTrackerInstalled = true; return; }
      var origAdd = proto.addEventListener;
      var origRemove = proto.removeEventListener;

      proto.addEventListener = function (type, fn, opts) {
        try { recordListener(this, type, fn, opts, true); } catch (e) {}
        return origAdd.call(this, type, fn, opts);
      };
      proto.removeEventListener = function (type, fn, opts) {
        try { recordListener(this, type, fn, opts, false); } catch (e) {}
        return origRemove.call(this, type, fn, opts);
      };
      proto.__mdtPatched = true;
      evTrackerInstalled = true;
    } catch (e) {
      evTrackerInstalled = false;
    }
  }

  /** Mencatat / menghapus listener pada peta lemah. */
  function recordListener(target, type, fn, opts, adding) {
    if (!target || typeof target !== "object") return;
    var list = listenerRegistry.get(target);
    if (!list) { list = []; listenerRegistry.set(target, list); }
    var capture = !!(opts === true || (opts && typeof opts === "object" && opts.capture));
    if (adding) {
      list.push({ type: type, fn: fn, capture: capture });
    } else {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].type === type && list[i].fn === fn && list[i].capture === capture) {
          list.splice(i, 1);
          break;
        }
      }
    }
  }

  /** Mengambil nama fungsi listener untuk ditampilkan. */
  function fnName(fn) {
    try {
      if (fn && fn.name) return fn.name;
      if (fn && typeof fn.handleEvent === "function" && fn.handleEvent.name) return fn.handleEvent.name;
    } catch (e) {}
    return "(anonim)";
  }

  /** Menampilkan daftar event listener elemen terpilih. */
  function renderEventListeners() {
    if (!eventsBodyEl) return;
    eventsBodyEl.textContent = "";
    if (!selectedEl) {
      eventsBodyEl.appendChild(el("div", "mdt-style-addprop", "Pilih elemen terlebih dahulu."));
      return;
    }
    var found = 0;
    /* (a) Atribut inline on*. */
    var attrs = selectedEl.attributes || [];
    for (var i = 0; i < attrs.length; i++) {
      if (/^on/i.test(attrs[i].name)) {
        eventsBodyEl.appendChild(makeEventListenerRow("inline", attrs[i].name, attrs[i].value || "", ""));
        found++;
      }
    }
    /* (b) Listener terlacak via patch. */
    var tracked = listenerRegistry.get(selectedEl) || [];
    for (var j = 0; j < tracked.length; j++) {
      eventsBodyEl.appendChild(makeEventListenerRow("terlacak", tracked[j].type, fnName(tracked[j].fn), tracked[j].capture ? "capture" : "bubble"));
      found++;
    }
    /* (c) window.getEventListeners bila tersedia. */
    if (typeof window.getEventListeners === "function") {
      try {
        var map = window.getEventListeners(selectedEl) || {};
        Object.keys(map).forEach(function (type) {
          (map[type] || []).forEach(function (info) {
            eventsBodyEl.appendChild(makeEventListenerRow("getEventListeners", type, fnName(info.listener), info.useCapture ? "capture" : "bubble"));
            found++;
          });
        });
      } catch (e) {}
    }
    if (!found) {
      eventsBodyEl.appendChild(el("div", "mdt-style-addprop", "Tidak ada event listener yang terdeteksi pada elemen ini."));
    }
    eventsBodyEl.appendChild(el("div", "mdt-event-note",
      "Catatan: Firefox tidak menyediakan getEventListeners. Listener dilacak sejak panel Elemen dimuat."));
  }

  /** Membuat satu baris entri event listener. */
  function makeEventListenerRow(kind, type, detail, phase) {
    var row = el("div", "mdt-event-row");
    row.setAttribute("data-mdt-event", type);
    row.appendChild(el("span", "mdt-event-type", type));
    row.appendChild(el("span", "mdt-event-detail", detail));
    var meta = kind + (phase ? " · " + phase : "");
    row.appendChild(el("span", "mdt-event-meta", meta));
    return row;
  }

  /* ==================================================================
     FASE 3 - Pembaruan pohon DOM otomatis (MutationObserver)
     Mengamati perubahan document (anak, atribut, teks) lalu menjadwalkan
     pembangunan ulang pohon DOM sekali per frame (requestAnimationFrame)
     agar hemat. Elemen terpilih dipertahankan bila masih ada di dokumen.
     ================================================================== */

  /** Memulai pengamatan MutationObserver pada document. */
  function startDomObserver() {
    if (domObserver) return;
    try {
      if (typeof MutationObserver === "undefined") return;
      domObserver = new MutationObserver(function (records) {
        if (!domAutoUpdate) return;
        /* Abaikan mutasi yang berasal dari antarmuka NT DevTools sendiri
           (mis. pembangunan ulang pohon), agar tidak terjadi gelung
           penyegaran tanpa henti. */
        for (var i = 0; i < records.length; i++) {
          if (!isOwnNode(records[i].target)) {
            scheduleDomRefresh();
            return;
          }
        }
      });
      domObserver.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) {
      domObserver = null;
    }
  }

  /** Menjadwalkan penyegaran pohon DOM sekali per frame. */
  function scheduleDomRefresh() {
    if (domRafPending) return;
    domRafPending = true;
    var run = function () {
      domRafPending = false;
      refreshDomTree();
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(run);
    else setTimeout(run, 16);
  }

  /** Membangun ulang pohon DOM sambil mempertahankan elemen terpilih. */
  function refreshDomTree() {
    if (!domTreeEl) return;
    /* Jangan sentuh apa pun bila pengguna sedang menyunting sebaris. */
    if (domTreeEl.querySelector && domTreeEl.querySelector(".mdt-inline-edit")) return;
    var keep = selectedEl;
    renderDomTree();
    if (keep && (keep === document.documentElement || (keep.ownerDocument && keep.ownerDocument.contains(keep)))) {
      selectedEl = keep;
      if (domRowMap.has(keep)) {
        revealInTree(keep);
        markSelectedRow(keep);
      }
    } else if (keep && !(keep.ownerDocument && keep.ownerDocument.contains(keep))) {
      /* Elemen terpilih sudah tidak ada lagi di halaman. */
      selectedEl = null;
    }
  }

  /** Mengaktifkan / menonaktifkan pembaruan otomatis. */
  function setDomAutoUpdate(on) {
    domAutoUpdate = !!on;
    if (domAutoUpdate) startDomObserver();
  }

  /* ---------- Mode pilih elemen ---------- */

  function togglePick() {
    if (pickActive) exitPick();
    else enterPick();
  }

  function enterPick() {
    pickActive = true;
    if (iovEl) iovEl.classList.add("on");
    if (pickBtnEl) pickBtnEl.classList.add("on");
    if (pickCursorEl) pickCursorEl.classList.add("on");
    document.documentElement.style.cursor = "crosshair";
  }

  function exitPick() {
    pickActive = false;
    if (iovEl) iovEl.classList.remove("on");
    if (pickBtnEl) pickBtnEl.classList.remove("on");
    if (pickCursorEl) pickCursorEl.classList.remove("on");
    if (ihlEl) ihlEl.style.display = "none";
    if (itipEl) itipEl.style.display = "none";
    document.documentElement.style.cursor = "";
    hoverEl = null;
  }

  /** Apakah node termasuk bagian antarmuka NT DevTools sendiri. */
  function isOwnNode(node) {
    if (!node) return true;
    if (node === rootEl || node === fabEl || node === iovEl || node === ihlEl || node === itipEl || node === pickCursorEl) return true;
    if (rootEl && rootEl.contains(node)) return true;
    return false;
  }

  function initPickListeners() {
    document.addEventListener(
      "mousemove",
      function (e) {
        if (!pickActive) return;
        var list = document.elementsFromPoint(e.clientX, e.clientY) || [];
        var target = null;
        for (var i = 0; i < list.length; i++) {
          if (!isOwnNode(list[i])) {
            target = list[i];
            break;
          }
        }
        if (!target) return;
        hoverEl = target;
        if (pickCursorEl) {
          pickCursorEl.style.left = e.clientX + "px";
          pickCursorEl.style.top = e.clientY + "px";
        }
        positionHighlight(target);
      },
      true
    );

    document.addEventListener(
      "click",
      function (e) {
        if (!pickActive) return;
        var list = document.elementsFromPoint(e.clientX, e.clientY) || [];
        var target = null;
        for (var i = 0; i < list.length; i++) {
          if (!isOwnNode(list[i])) {
            target = list[i];
            break;
          }
        }
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          selectElement(target);
        }
        exitPick();
      },
      true
    );

    document.addEventListener(
      "keydown",
      function (e) {
        if (pickActive && e.key === "Escape") exitPick();
      },
      true
    );
  }

  /** Menempatkan kotak sorotan dan tooltip pada elemen target. */
  function positionHighlight(target) {
    var rect;
    try {
      rect = target.getBoundingClientRect();
    } catch (e) {
      return;
    }
    if (ihlEl) {
      ihlEl.style.display = "block";
      ihlEl.style.left = rect.left + "px";
      ihlEl.style.top = rect.top + "px";
      ihlEl.style.width = rect.width + "px";
      ihlEl.style.height = rect.height + "px";
    }
    if (itipEl) {
      itipEl.style.display = "block";
      itipEl.textContent =
        "<" + target.tagName.toLowerCase() + "> " + Math.round(rect.width) + " x " + Math.round(rect.height);
      var ty = rect.top - 24;
      if (ty < 0) ty = rect.bottom + 4;
      itipEl.style.left = Math.max(4, rect.left) + "px";
      itipEl.style.top = ty + "px";
    }
  }

  /* ---------- Menu konteks elemen ---------- */

  function openCtxMenu(ev, node) {
    var menu = document.getElementById("mdt-ctx-menu");
    if (menu) menu.remove();
    menu = el("div", "mdt-ctx-menu");
    menu.id = "mdt-ctx-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = "2147483647";
    menu.style.background = "#252526";
    menu.style.border = "1px solid rgba(255,255,255,.12)";
    menu.style.borderRadius = "4px";
    menu.style.padding = "3px 0";
    menu.style.minWidth = "150px";
    menu.style.boxShadow = "0 6px 24px rgba(0,0,0,.6)";

    var items = [
      ["Salin selector", function () {
        copyText(elementSelector(node));
      }],
      ["Salin HTML (outerHTML)", function () {
        copyElementHTML(node);
      }],
      ["Gulir ke tampilan", function () {
        if (node.scrollIntoView) node.scrollIntoView({ block: "center" });
      }],
      ["Sembunyikan / tampilkan", function () {
        node.style.display = node.style.display === "none" ? "" : "none";
      }],
      ["Hapus elemen", function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }],
      ["Gunakan sebagai $0", function () {
        selectElement(node);
      }]
    ];

    for (var i = 0; i < items.length; i++) {
      (function (label, fn) {
        var item = el("div", "mdt-ctx-item", label);
        item.style.padding = "6px 14px";
        item.style.cursor = "pointer";
        item.style.fontSize = "12px";
        item.addEventListener("click", function (e) {
          e.stopPropagation();
          menu.remove();
          try {
            fn();
          } catch (err) {}
        });
        menu.appendChild(item);
      })(items[i][0], items[i][1]);
    }

    document.documentElement.appendChild(menu);
    menu.style.left = Math.min(ev.clientX, window.innerWidth - 170) + "px";
    menu.style.top = Math.min(ev.clientY, window.innerHeight - 60) + "px";

    setTimeout(function () {
      document.addEventListener(
        "click",
        function close(e) {
          /* Abaikan klik di dalam menu agar aksi tetap berjalan. */
          if (menu.contains(e.target)) return;
          if (menu.parentNode) menu.remove();
          document.removeEventListener("click", close, true);
        },
        true
      );
    }, 0);
  }

  /** Menyalin teks ke clipboard dengan cara aman. */
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        var p = navigator.clipboard.writeText(text);
        if (p && typeof p.catch === "function") p.catch(function () {});
        return;
      }
    } catch (e) {}
    try {
      var ta = el("textarea");
      ta.value = text;
      document.documentElement.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch (e2) {}
  }

  /** Menyusun selector CSS ringkas untuk sebuah elemen (#id / .kelas). */
  function elementSelector(node) {
    if (!node || node.nodeType !== 1) return "";
    var sel = node.tagName.toLowerCase();
    if (node.id) sel += "#" + node.id;
    else if (typeof node.className === "string" && node.className.trim()) {
      sel += "." + node.className.trim().split(/\s+/).join(".");
    }
    return sel;
  }

  /** Menyalin outerHTML elemen ke clipboard (FASE 3). */
  function copyElementHTML(node) {
    if (!node || node.nodeType !== 1) return;
    var html = "";
    try { html = node.outerHTML || ""; } catch (e) { html = ""; }
    if (!html) { try { html = new window.XMLSerializer().serializeToString(node); } catch (e2) {} }
    copyText(html);
  }

  /* ==================================================================
     BAGIAN 10 - Panel KONSOL (penangkapan log + REPL)
     ================================================================== */

  /* Simpan fungsi console asli untuk diteruskan. */
  var origConsole = {};

  function buildConsole(panel) {
    var outer = el("div");
    outer.id = "mdt-con-outer";

    /* --- Baris pengaturan (collapsible) --- */
    conSettingsEl = el("div");
    conSettingsEl.id = "mdt-con-settings";
    var checks = [
      ["Autoscroll", autoscroll, function (v) {
        autoscroll = v;
        settings.console.autoscroll = v;
        saveSettings();
      }],
      ["Tampilkan waktu", showTime, function (v) {
        showTime = v;
        settings.console.timestamps = v;
        saveSettings();
      }],
      ["Grup serupa", groupLogs, function (v) {
        groupLogs = v;
        settings.console.groups = v;
        saveSettings();
      }]
    ];
    for (var i = 0; i < checks.length; i++) {
      (function (c) {
        var lk = el("label", "mdt-con-ck");
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!c[1];
        if (c[2]) cb.addEventListener("change", function () {
          c[2](cb.checked);
        });
        lk.appendChild(cb);
        lk.appendChild(el("span", null, c[0]));
        conSettingsEl.appendChild(lk);
      })(checks[i]);
    }
    outer.appendChild(conSettingsEl);

    /* --- Toolbar utama --- */
    var tb = el("div");
    tb.id = "mdt-con-toolbar";

    var clearBtn = el("button", "mdt-con-tbtn", "Bersihkan");
    clearBtn.type = "button";
    clearBtn.addEventListener("click", clearLogs);
    tb.appendChild(clearBtn);

    tb.appendChild(el("div", "mdt-con-sep"));

    conLevelsEl = el("select");
    conLevelsEl.id = "mdt-con-levels";
    var levels = [
      ["all", "Semua"],
      ["log", "Log"],
      ["info", "Info"],
      ["warn", "Peringatan"],
      ["error", "Galat"]
    ];
    for (var L = 0; L < levels.length; L++) {
      var opt = el("option", null, levels[L][1]);
      opt.value = levels[L][0];
      conLevelsEl.appendChild(opt);
    }
    conLevelsEl.addEventListener("change", applyLogFilter);
    tb.appendChild(conLevelsEl);

    conFilterEl = el("input");
    conFilterEl.id = "mdt-con-filter";
    conFilterEl.setAttribute("placeholder", filterRegex ? "Saring log (regex)" : "Saring log");
    conFilterEl.addEventListener("input", applyLogFilter);
    tb.appendChild(conFilterEl);

    /* Tombol pengaktif mode regex untuk kolom saring. */
    regexBtnEl = el("button", "mdt-con-tbtn" + (filterRegex ? " on" : ""), ".*");
    regexBtnEl.id = "mdt-con-regex";
    regexBtnEl.type = "button";
    regexBtnEl.setAttribute("title", "Saring memakai regex");
    regexBtnEl.addEventListener("click", function () {
      filterRegex = !filterRegex;
      regexBtnEl.classList.toggle("on", filterRegex);
      settings.console.regex = filterRegex;
      if (settingsEls.console && settingsEls.console.regex) {
        settingsEls.console.regex.input.checked = filterRegex;
      }
      if (conFilterEl) conFilterEl.setAttribute("placeholder", filterRegex ? "Saring log (regex)" : "Saring log");
      saveSettings();
      applyLogFilter();
    });
    tb.appendChild(regexBtnEl);

    tb.appendChild(el("div", "mdt-con-sep"));

    var setBtn = el("button", "mdt-con-tbtn", "Setelan");
    setBtn.type = "button";
    setBtn.addEventListener("click", function () {
      conSettingsEl.classList.toggle("open");
      setBtn.classList.toggle("on");
    });
    tb.appendChild(setBtn);

    outer.appendChild(tb);

    /* --- Area log --- */
    logwrapEl = el("div");
    logwrapEl.id = "mdt-logwrap";
    outer.appendChild(logwrapEl);

    /* --- REPL --- */
    var replwrap = el("div");
    replwrap.id = "mdt-replwrap";

    var pfx = el("span", null, ">");
    pfx.id = "mdt-replpfx";
    replwrap.appendChild(pfx);

    replEl = el("textarea");
    replEl.id = "mdt-repl";
    replEl.setAttribute("rows", "1");
    replEl.setAttribute("placeholder", "Evaluasi JavaScript (mis. document.title, $0.tagName, $('p'))");
    replEl.setAttribute("spellcheck", "false");
    replEl.addEventListener("keydown", function (e) {
      /* Navigasi pelengkapan otomatis lebih dulu (Arrow/Enter/Tab/Esc). */
      if (acKeydown(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runRepl();
      }
    });
    replEl.addEventListener("input", updateAutocomplete);
    replEl.addEventListener("click", updateAutocomplete);
    replEl.addEventListener("blur", function () {
      setTimeout(acClose, 150);
    });
    replwrap.appendChild(replEl);

    /* Popup pelengkapan otomatis (diposisikan oleh CSS di atas input). */
    acEl = el("div");
    acEl.id = "mdt-ac";
    replwrap.appendChild(acEl);

    replRunEl = el("button", null, "Jalankan");
    replRunEl.id = "mdt-replrun";
    replRunEl.type = "button";
    replRunEl.addEventListener("click", runRepl);
    replwrap.appendChild(replRunEl);

    outer.appendChild(replwrap);
    panel.appendChild(outer);

    installConsoleHooks();
  }

  /** Menyimpan fungsi console asli lalu mengembalikan penerus aman. */
  function hookNative(level) {
    origConsole[level] = typeof console[level] === "function" ? console[level].bind(console) : noop;
    return function () {
      var args = Array.prototype.slice.call(arguments);
      try {
        origConsole[level].apply(console, args);
      } catch (e) {}
      return args;
    };
  }

  /** Normalisasi label pewaktu/penghitung console.*. */
  function conLabel(label) {
    return label === undefined || label === null ? "default" : String(label);
  }

  /** Waktu sekarang dalam milidetik (performance bila tersedia). */
  function nowMs() {
    try {
      return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    } catch (e) {
      return Date.now();
    }
  }

  /** Selisih waktu sejak console.time berlabel (ms). */
  function conElapsed(label) {
    if (!Object.prototype.hasOwnProperty.call(consoleTimers, label)) return 0;
    var d = nowMs() - consoleTimers[label];
    return Math.round(d * 1000) / 1000;
  }

  /** Memasang pencegat pada console.* dan penangan galat global. */
  function installConsoleHooks() {
    if (origConsole.log) return; /* sudah terpasang */

    /* Tingkat dasar: log/info/warn/error/debug (perilaku lama dipertahankan). */
    var levels = ["log", "info", "warn", "error", "debug"];
    for (var i = 0; i < levels.length; i++) {
      (function (level) {
        var pass = hookNative(level);
        console[level] = function mdtConsoleHook() {
          var args = pass.apply(null, arguments);
          addLog(level, args, captureStack());
        };
      })(levels[i]);
    }

    /* console.table: tampilkan data sebagai pohon objek. */
    var passTable = hookNative("table");
    console.table = function mdtConsoleTable() {
      var args = passTable.apply(null, arguments);
      addLog("log", ["Tabel:"].concat(args), captureStack());
    };

    /* console.dir: tampilkan objek apa adanya sebagai pohon. */
    var passDir = hookNative("dir");
    console.dir = function mdtConsoleDir() {
      var args = passDir.apply(null, arguments);
      addLog("log", args, captureStack());
    };

    /* console.time / timeLog / timeEnd: ukur dan tampilkan durasi. */
    hookNative("time");
    console.time = function mdtConsoleTime(label) {
      consoleTimers[conLabel(label)] = nowMs();
    };
    hookNative("timeLog");
    console.timeLog = function mdtConsoleTimeLog(label) {
      var args = Array.prototype.slice.call(arguments);
      var key = conLabel(label);
      var extra = args.slice(1);
      addLog("log", [key + ": " + conElapsed(key) + " ms"].concat(extra), captureStack());
    };
    hookNative("timeEnd");
    console.timeEnd = function mdtConsoleTimeEnd(label) {
      var key = conLabel(label);
      var ms = conElapsed(key);
      delete consoleTimers[key];
      addLog("log", [key + ": " + ms + " ms"], captureStack());
    };

    /* console.assert: catat entri galat bila pernyataan bernilai salah. */
    var passAssert = hookNative("assert");
    console.assert = function mdtConsoleAssert(cond) {
      var args = Array.prototype.slice.call(arguments);
      try {
        passAssert.apply(null, args);
      } catch (e) {}
      var truthy = true;
      try {
        truthy = !!cond;
      } catch (e2) {
        truthy = false;
      }
      if (!truthy) {
        addLog("error", ["Assertion gagal:"].concat(args.slice(1)), captureStack(), { stack: true });
      }
    };

    /* console.count / countReset: penghitung berlabel. */
    hookNative("count");
    console.count = function mdtConsoleCount(label) {
      var key = conLabel(label);
      consoleCounts[key] = (consoleCounts[key] || 0) + 1;
      addLog("log", [key + ": " + consoleCounts[key]], captureStack());
    };
    hookNative("countReset");
    console.countReset = function mdtConsoleCountReset(label) {
      consoleCounts[conLabel(label)] = 0;
    };

    /* console.trace: selalu sertakan jejak tumpukan. */
    var passTrace = hookNative("trace");
    console.trace = function mdtConsoleTrace() {
      var args = passTrace.apply(null, arguments);
      addLog("log", ["Jejak tumpukan"].concat(args), captureStack(), { stack: true });
    };

    /* console.group / groupCollapsed / groupEnd: indentasi entri berikutnya. */
    hookNative("group");
    console.group = function mdtConsoleGroup() {
      var args = Array.prototype.slice.call(arguments);
      addLog("log", args.length ? args : ["Grup"], captureStack());
      groupDepth++;
    };
    hookNative("groupCollapsed");
    console.groupCollapsed = function mdtConsoleGroupCollapsed() {
      var args = Array.prototype.slice.call(arguments);
      addLog("log", args.length ? args : ["Grup"], captureStack());
      groupDepth++;
    };
    hookNative("groupEnd");
    console.groupEnd = function mdtConsoleGroupEnd() {
      if (groupDepth > 0) groupDepth--;
    };

    /* console.clear: bersihkan area log konsol. */
    hookNative("clear");
    console.clear = function mdtConsoleClear() {
      try {
        origConsole.clear();
      } catch (e) {}
      clearLogs();
    };

    window.addEventListener("error", function (e) {
      var msg = e.message + " (" + (e.filename || "") + ":" + (e.lineno || 0) + ")";
      var stk = e.error && e.error.stack ? e.error.stack : captureStack();
      addLog("error", [msg], stk, { stack: true });
    });
    window.addEventListener("unhandledrejection", function (e) {
      var r = e && e.reason;
      var stk = r && r.stack ? r.stack : captureStack();
      addLog("error", ["Unhandled promise rejection:", r], stk, { stack: true });
    });
  }

  /** Mengambil jejak tumpukan multi-baris, tanpa bingkai internal. */
  function captureStack() {
    try {
      var stack = new Error().stack || "";
      var lines = stack.split("\n");
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln) continue;
        if (ln === "Error" || ln.indexOf("Error:") === 0) continue;
        /* Sembunyikan bingkai milik pencegat internal ini sendiri. */
        if (ln.indexOf("captureStack") >= 0 || ln.indexOf("mdtConsole") >= 0) continue;
        out.push(ln);
        if (out.length >= 12) break;
      }
      return out.join("\n");
    } catch (e) {
      return "";
    }
  }

  /** Bingkai pertama yang berguna dari sebuah jejak tumpukan. */
  function firstStackFrame(stack) {
    if (!stack) return "";
    var lines = String(stack).split("\n");
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln || ln === "Error" || ln.indexOf("Error:") === 0) continue;
      return ln;
    }
    return "";
  }

  /** Lokasi singkat (berkas:baris:kolom) dari sebuah bingkai tumpukan. */
  function shortFrame(frame) {
    try {
      var m = String(frame).match(/([^\s()\/]+:\d+:\d+)\)?$/);
      if (m) return m[1];
      return shortUrl(frame);
    } catch (e) {
      return String(frame);
    }
  }

  /** Membuat elemen jejak tumpukan yang dapat dibuka/tutup. */
  function makeStackEl(stack) {
    var box = el("div", "mdt-le-stk");
    var head = el("div", "mdt-stk-head");
    var caret = el("span", "mdt-stk-caret", "\u25b8");
    head.appendChild(caret);
    var lines = String(stack).split("\n");
    head.appendChild(el("span", null, "Jejak tumpukan (" + lines.length + ")"));
    box.appendChild(head);
    var body = el("div", "mdt-stk-body");
    body.textContent = String(stack);
    box.appendChild(body);
    head.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = box.classList.toggle("open");
      caret.textContent = open ? "\u25be" : "\u25b8";
    });
    return box;
  }

  /** Apakah nilai sebaiknya digambar sebagai pohon objek/array. */
  function isTreeValue(v) {
    if (v === null || typeof v !== "object") return false;
    if (Array.isArray(v)) return true;
    if (v instanceof Error) return false;
    if (v instanceof Date) return false;
    if (v instanceof RegExp) return false;
    if (typeof Element !== "undefined" && v instanceof Element) return false;
    if (typeof Node !== "undefined" && v instanceof Node) return false;
    try {
      return Object.prototype.toString.call(v) === "[object Object]";
    } catch (e) {
      return false;
    }
  }

  /** Teks ringkas untuk sebuah nilai primitif/spesial. */
  function valueText(v) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    var t = typeof v;
    if (t === "string") return JSON.stringify(v);
    if (t === "number" || t === "boolean") return String(v);
    if (t === "function") return "function " + (v.name || "anonim") + "()";
    if (t === "symbol") return v.toString();
    if (t === "object") {
      if (v instanceof Error) return v.name + ": " + v.message;
      if (v instanceof Date) {
        try {
          return v.toISOString();
        } catch (e) {
          return "Date";
        }
      }
      if (v instanceof RegExp) return v.toString();
      if (typeof Element !== "undefined" && v instanceof Element) return "<" + v.tagName.toLowerCase() + ">";
      if (typeof Node !== "undefined" && v instanceof Node) return v.nodeName;
      try {
        return String(v);
      } catch (e2) {
        return "[objek]";
      }
    }
    return String(v);
  }

  /** Mengumpulkan pasangan kunci/nilai sesuai pengaturan properti/getter. */
  function collectEntries(v) {
    var out = [];
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        out.push({ key: String(i), value: v[i], isIndex: true });
      }
      return out;
    }
    var keys;
    try {
      keys = Object.getOwnPropertyNames(v);
    } catch (e) {
      return out;
    }
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var desc;
      try {
        desc = Object.getOwnPropertyDescriptor(v, key);
      } catch (e2) {
        continue;
      }
      if (!desc) continue;
      if (!showNonEnum && desc.enumerable === false) continue;
      if (desc.get) {
        if (showGetters) {
          var got;
          try {
            got = desc.get.call(v);
          } catch (e3) {
            got = "[getter error]";
          }
          out.push({ key: key, value: got, isIndex: false });
        } else {
          out.push({ key: key, value: "(getter)", isIndex: false });
        }
        continue;
      }
      var val;
      try {
        val = v[key];
      } catch (e4) {
        val = "[akses ditolak]";
      }
      out.push({ key: key, value: val, isIndex: false });
    }
    return out;
  }

  /** Membangun pohon interaktif untuk objek/array bertingkat. */
  function buildTree(value, keyLabel, depth) {
    var wrap = el("div", "mdt-obj" + (depth === 0 ? " open" : ""));
    wrap.setAttribute("data-depth", String(depth));
    var isArr = Array.isArray(value);
    var entries = collectEntries(value);

    var head = el("div", "mdt-obj-head");
    var toggle = el("span", "mdt-obj-toggle", depth === 0 ? "\u25be" : "\u25b8");
    head.appendChild(toggle);
    if (keyLabel !== undefined && keyLabel !== null) {
      head.appendChild(el("span", "mdt-obj-key", keyLabel + ": "));
    }
    head.appendChild(el("span", "mdt-obj-brace", isArr ? "[" : "{"));
    head.appendChild(el("span", "mdt-obj-val", entries.length ? "\u2026" : ""));
    head.appendChild(el("span", "mdt-obj-brace", isArr ? "]" : "}"));
    wrap.appendChild(head);

    var kids = el("div", "mdt-obj-children");
    for (var i = 0; i < entries.length; i++) {
      kids.appendChild(buildValueNode(entries[i].key, entries[i].value, entries[i].isIndex, depth + 1));
    }
    wrap.appendChild(kids);

    function toggleFn(e) {
      if (e) e.stopPropagation();
      var nowOpen = wrap.classList.toggle("open");
      toggle.textContent = nowOpen ? "\u25be" : "\u25b8";
    }
    toggle.addEventListener("click", toggleFn);
    head.addEventListener("click", toggleFn);
    return wrap;
  }

  /** Satu baris nilai (daun) atau cabang pohon objek. */
  function buildValueNode(key, value, isIndex, depth) {
    if (isTreeValue(value)) return buildTree(value, isIndex ? undefined : key, depth);
    var row = el("div", "mdt-obj mdt-obj-leaf");
    row.setAttribute("data-depth", String(depth));
    var head = el("div", "mdt-obj-head");
    if (!isIndex) head.appendChild(el("span", "mdt-obj-key", key + ": "));
    head.appendChild(el("span", "mdt-obj-val", valueText(value)));
    row.appendChild(head);
    return row;
  }

  /** Mengisi elemen pesan dengan simpul teks atau pohon objek. */
  function renderArgNodes(container, args) {
    for (var i = 0; i < args.length; i++) {
      if (i) container.appendChild(document.createTextNode(" "));
      var v = args[i];
      if (isTreeValue(v)) container.appendChild(buildTree(v, undefined, 0));
      else container.appendChild(document.createTextNode(typeof v === "string" ? v : safeStringify(v)));
    }
  }

  /** Menentukan kelas CSS entri log berdasarkan level. */
  function levelClass(level) {
    if (level === "error") return "error";
    if (level === "warn") return "warn";
    if (level === "info") return "info";
    if (level === "result") return "result";
    return "log";
  }

  /** Karakter ikon ASCII untuk kolom penanda level. */
  function levelIcon(level) {
    if (level === "error") return "x";
    if (level === "warn") return "!";
    if (level === "info") return "i";
    if (level === "result") return "<";
    if (level === "debug") return "d";
    return ">";
  }

  /** Menambahkan satu entri log ke area log. */
  function addLog(level, args, stack, opts) {
    if (!logwrapEl) return;
    opts = opts || {};
    var text = formatArgs(args);

    /* Grup log serupa: gabungkan bila identik dengan entri terakhir. */
    if (groupLogs && logs.length) {
      var last = logs[logs.length - 1];
      if (last.level === level && last.text === text) {
        last.count = (last.count || 1) + 1;
        var cnt = last.el.querySelector(".mdt-le-count");
        if (!cnt) {
          cnt = el("span", "mdt-le-count", "x" + last.count);
          last.el.appendChild(cnt);
        } else {
          cnt.textContent = "x" + last.count;
        }
        if (autoscroll) logwrapEl.scrollTop = logwrapEl.scrollHeight;
        return;
      }
    }

    var entry = el("div", "mdt-logentry " + levelClass(level));
    entry.appendChild(el("span", "mdt-le-ic", levelIcon(level)));

    /* Indentasi bertingkat dari console.group (dipakai entri berikutnya). */
    entry.setAttribute("data-mdt-indent", String(groupDepth));
    if (groupDepth > 0) entry.style.paddingLeft = (10 + groupDepth * 14) + "px";

    if (showTime) {
      var t = new Date();
      entry.appendChild(el("span", "mdt-le-time", pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + ":" + pad2(t.getSeconds())));
    }

    var msg = el("span", "mdt-le-msg");
    renderArgNodes(msg, args);
    entry.appendChild(msg);

    if (stack) {
      var frame = firstStackFrame(stack);
      if (frame) {
        var s = el("span", "mdt-le-src", shortFrame(frame));
        s.setAttribute("title", String(stack));
        entry.appendChild(s);
      }
      /* Jejak tumpukan penuh ditampilkan untuk galat/peringatan, atau bila
         diminta eksplisit (assert/trace/galat global). */
      if (level === "error" || level === "warn" || opts.stack) {
        entry.appendChild(makeStackEl(stack));
      }
    }

    /* Tombol salin isi entri (tampil saat disorot / selalu di seluler). */
    var cp = el("button", "mdt-le-copy", "Salin");
    cp.type = "button";
    cp.setAttribute("title", "Salin isi log");
    cp.addEventListener("click", function (e) {
      e.stopPropagation();
      copyText(text);
    });
    entry.appendChild(cp);

    logs.push({ el: entry, level: level, text: text, src: stack || "", count: 1 });

    function commit() {
      logwrapEl.appendChild(entry);
      /* Batasi jumlah log agar hemat memori. */
      if (logs.length > logMax) {
        var first = logs.shift();
        if (first.el.parentNode) first.el.parentNode.removeChild(first.el);
      }
      applyLogFilter();
      if (autoscroll) logwrapEl.scrollTop = logwrapEl.scrollHeight;
    }

    if (renderAsync) {
      pendingConsole.push(commit);
      scheduleConsoleFlush();
    } else {
      commit();
    }
  }

  /** Pad angka menjadi dua digit untuk cap waktu. */
  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* Antrean penerapan log saat "render asinkron" diaktifkan. */
  var pendingConsole = [], consoleFlushScheduled = false;
  function scheduleConsoleFlush() {
    if (consoleFlushScheduled) return;
    consoleFlushScheduled = true;
    function run() {
      consoleFlushScheduled = false;
      var q = pendingConsole;
      pendingConsole = [];
      for (var i = 0; i < q.length; i++) {
        try {
          q[i]();
        } catch (e) {}
      }
    }
    try {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else setTimeout(run, 0);
    } catch (e) {
      setTimeout(run, 0);
    }
  }

  /** Memformat argumen log menjadi satu baris teks. */
  function formatArgs(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var v = args[i];
      if (typeof v === "string") out.push(v);
      else out.push(safeStringify(v));
    }
    return out.join(" ");
  }

  /** Stringify aman (mendukung circular dan elemen DOM). */
  function safeStringify(v) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    var t = typeof v;
    if (t === "number" || t === "boolean") return String(v);
    if (t === "function") return "function " + (v.name || "anonim") + "()";
    if (t === "symbol") return v.toString();
    if (v instanceof Error) return v.stack || v.name + ": " + v.message;
    if (typeof Element !== "undefined" && v instanceof Element) return "<" + v.tagName.toLowerCase() + ">";
    if (typeof Node !== "undefined" && v instanceof Node) return v.nodeName;
    try {
      /* Bila pengaturan meminta, sertakan properti non-enumerable dan getter
         melalui penelusuran properti sendiri (bukan lewat JSON.stringify). */
      if (showNonEnum || showGetters) {
        return inspectValue(v, [], 0);
      }
      var seen = [];
      return JSON.stringify(v, function (k, val) {
        if (typeof val === "object" && val !== null) {
          if (seen.indexOf(val) >= 0) return "[Circular]";
          seen.push(val);
        }
        if (typeof Element !== "undefined" && val instanceof Element) return "<" + val.tagName.toLowerCase() + ">";
        return val;
      }, 0);
    } catch (e) {
      try {
        return String(v);
      } catch (e2) {
        return "[objek]";
      }
    }
  }

  /**
   * Penampil nilai khusus yang menghormati pengaturan non-enumerable dan
   * getter. Menelusuri properti sendiri secara terbatas kedalamannya.
   */
  function inspectValue(v, seen, depth) {
    if (v === null) return "null";
    var t = typeof v;
    if (t === "string") return JSON.stringify(v);
    if (t === "number" || t === "boolean") return String(v);
    if (t === "undefined") return "undefined";
    if (t === "function") return "function " + (v.name || "anonim") + "()";
    if (t === "symbol") return v.toString();
    if (v instanceof Error) return v.stack || v.name + ": " + v.message;
    if (typeof Element !== "undefined" && v instanceof Element) return "<" + v.tagName.toLowerCase() + ">";
    if (typeof Node !== "undefined" && v instanceof Node) return v.nodeName;
    if (seen.indexOf(v) >= 0) return "[Circular]";
    if (depth > 4) return "[...]";
    seen = seen.concat([v]);

    if (Array.isArray(v)) {
      var arr = [];
      for (var ai = 0; ai < v.length; ai++) arr.push(inspectValue(v[ai], seen, depth + 1));
      return "[" + arr.join(", ") + "]";
    }

    var parts = [];
    var names;
    try {
      names = Object.getOwnPropertyNames(v);
    } catch (e) {
      try {
        return String(v);
      } catch (e2) {
        return "[objek]";
      }
    }
    for (var i = 0; i < names.length; i++) {
      var key = names[i];
      var desc;
      try {
        desc = Object.getOwnPropertyDescriptor(v, key);
      } catch (e3) {
        continue;
      }
      if (!desc) continue;
      if (!showNonEnum && desc.enumerable === false) continue;
      var val;
      if (desc.get) {
        if (showGetters) {
          try {
            val = inspectValue(desc.get.call(v), seen, depth + 1);
          } catch (e4) {
            val = "[getter error]";
          }
        } else {
          val = "(getter)";
        }
      } else {
        try {
          val = inspectValue(v[key], seen, depth + 1);
        } catch (e5) {
          val = "[akses ditolak]";
        }
      }
      parts.push(key + ": " + val);
    }
    return "{ " + parts.join(", ") + " }";
  }

  /** Menerapkan saringan level + teks/regex pada daftar log. */
  function applyLogFilter() {
    if (!logwrapEl) return;
    var level = conLevelsEl ? conLevelsEl.value : "all";
    var raw = conFilterEl ? conFilterEl.value : "";
    var re = null;
    if (filterRegex && raw) {
      try {
        re = new RegExp(raw);
      } catch (e) {
        re = null; /* regex tidak valid: jatuh ke pencocokan teks biasa */
      }
    }
    var q = String(raw).toLowerCase();
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      var okLevel = level === "all" || l.level === level || (level === "log" && (l.level === "log" || l.level === "debug"));
      var okText;
      if (!raw) {
        okText = true;
      } else if (filterRegex && re) {
        try {
          okText = re.test(l.text);
        } catch (e2) {
          okText = false;
        }
      } else {
        okText = l.text.toLowerCase().indexOf(q) >= 0;
      }
      /* Saringan level tetap digabung dengan saringan teks/regex. */
      l.el.style.display = okLevel && okText ? "" : "none";
    }
  }

  /** Menghapus seluruh log dan mengatur ulang indentasi grup. */
  function clearLogs() {
    logs = [];
    groupDepth = 0;
    if (logwrapEl) logwrapEl.textContent = "";
  }

  /** Mengevaluasi isi REPL dan menampilkan hasilnya. */
  function runRepl() {
    if (!replEl) return;
    acClose();
    var code = replEl.value;
    if (!code || !code.trim()) return;
    addLog("log", ["> " + code], "");
    try {
      var result = evalExpression(code);
      addLog("result", [safeStringify(result)], "");
      lastResult = result;
    } catch (err) {
      addLog("error", [String(err && err.stack ? err.stack : err)], "");
    }
    replEl.value = "";
    if (logwrapEl) logwrapEl.scrollTop = logwrapEl.scrollHeight;
  }

  var lastResult;

  /* ---------- Pelengkapan otomatis REPL (#mdt-ac) ---------- */

  /* Pola ekspresi dasar yang aman dievaluasi sebelum tanda titik.
     Hanya jalur properti/index literal (tanpa pemanggilan fungsi) agar
     tidak menimbulkan efek samping. */
  var AC_BASE = "[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*|\\[\\s*(?:\\d+|'[^']*'|\"[^\"]*\")\\s*\\])*";

  /** Query selector tunggal untuk REPL ($). */
  function replDollar(sel) {
    try {
      return document.querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  /** Query selector jamak untuk REPL ($$) yang mengembalikan array. */
  function replDollarAll(sel) {
    try {
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  /** Menutup popup pelengkapan otomatis. */
  function acClose() {
    acOpen = false;
    acIndex = -1;
    acItems = [];
    if (acEl) {
      acEl.style.display = "none";
      acEl.textContent = "";
    }
  }

  /** Menentukan token yang sedang diketik sebelum kursor. */
  function acToken(before) {
    try {
      var sel = String(before).slice(-200);
      var dm = new RegExp("(" + AC_BASE + ")\\.([\\w$]*)$").exec(sel);
      if (dm) return { base: dm[1], prefix: dm[2], dot: true };
      var wm = /([\w$]+)$/.exec(sel);
      if (wm) return { base: "", prefix: wm[1], dot: false };
    } catch (e) {}
    return null;
  }

  /** Menyusun daftar saran untuk sebuah token. */
  function acSuggest(token) {
    var names, group, type;
    if (token.dot) {
      names = objectNames(safeEvalBase(token.base));
      group = "Properti dari " + token.base;
      type = token.base;
    } else {
      names = globalNames();
      group = "Lingkup global";
      type = "global";
    }
    var lp = token.prefix.toLowerCase();
    var filtered = [];
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (lp && n.toLowerCase().indexOf(lp) !== 0) continue;
      filtered.push(n);
    }
    filtered.sort();
    filtered = filtered.slice(0, 40);
    var items = [];
    for (var j = 0; j < filtered.length; j++) {
      items.push({ name: filtered[j], prefix: token.prefix, group: group, type: type });
    }
    return items;
  }

  /** Daftar nama pada lingkup global (window). */
  function globalNames() {
    var out = ["$0", "$_", "$", "$$"];
    try {
      var names = Object.getOwnPropertyNames(window);
      for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (n.indexOf("__") === 0) continue;
        if (n === "NTDevToolsInjected") continue;
        if (out.indexOf(n) < 0) out.push(n);
      }
    } catch (e) {}
    return out;
  }

  /** Nama properti objek (sendiri + prototipe) tanpa memanggil getter. */
  function objectNames(obj) {
    if (obj === null || obj === undefined) return [];
    var out = [];
    try {
      out = Object.getOwnPropertyNames(obj);
    } catch (e) {
      out = [];
    }
    try {
      var proto = Object.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype) {
        var pn = Object.getOwnPropertyNames(proto);
        for (var i = 0; i < pn.length; i++) {
          if (out.indexOf(pn[i]) < 0) out.push(pn[i]);
        }
      }
    } catch (e2) {}
    return out;
  }

  /** Evaluasi ekspresi dasar secara aman (tanpa panggilan fungsi). */
  function safeEvalBase(expr) {
    try {
      if (!new RegExp("^" + AC_BASE + "$").test(expr)) return undefined;
      return evalExpression(expr);
    } catch (e) {
      return undefined;
    }
  }

  /** Menggambar ulang daftar saran autocomplete. */
  function acRender() {
    if (!acEl) return;
    acEl.textContent = "";
    if (!acItems.length) {
      acClose();
      return;
    }
    acEl.appendChild(el("div", "mdt-ac-group", acItems[0].group || "Saran"));
    for (var i = 0; i < acItems.length; i++) {
      (function (idx, item) {
        var it = el("div", "mdt-ac-item" + (idx === acIndex ? " sel" : ""));
        it.appendChild(el("span", "mdt-ac-name", item.name));
        it.appendChild(el("span", "mdt-ac-type", item.type || ""));
        it.addEventListener("mousedown", function (e) {
          e.preventDefault();
          acIndex = idx;
          acAccept();
        });
        acEl.appendChild(it);
      })(i, acItems[i]);
    }
    acEl.style.display = "flex";
    acOpen = true;
  }

  /** Memperbarui saran dari isi REPL. */
  function updateAutocomplete() {
    if (!acEl || !replEl) return;
    var val = replEl.value || "";
    var pos = typeof replEl.selectionStart === "number" ? replEl.selectionStart : val.length;
    var token = acToken(val.slice(0, pos));
    if (!token) {
      acClose();
      return;
    }
    var list = acSuggest(token);
    if (!list.length) {
      acClose();
      return;
    }
    acItems = list;
    acIndex = 0;
    acRender();
  }

  /** Memindahkan pilihan saran (berputar). */
  function acMove(delta) {
    if (!acItems.length) return;
    acIndex = (acIndex + delta + acItems.length) % acItems.length;
    var nodes = acEl ? acEl.querySelectorAll(".mdt-ac-item") : [];
    for (var i = 0; i < nodes.length; i++) {
      if (i === acIndex) nodes[i].classList.add("sel");
      else nodes[i].classList.remove("sel");
    }
    var cur = nodes[acIndex];
    if (cur && cur.scrollIntoView) {
      try {
        cur.scrollIntoView({ block: "nearest" });
      } catch (e) {}
    }
  }

  /** Menerima saran terpilih dan menuliskannya ke REPL. */
  function acAccept() {
    if (!acOpen || acIndex < 0 || !acItems[acIndex] || !replEl) return;
    var item = acItems[acIndex];
    var val = replEl.value || "";
    var pos = typeof replEl.selectionStart === "number" ? replEl.selectionStart : val.length;
    var cut = pos - (item.prefix ? item.prefix.length : 0);
    if (cut < 0) cut = 0;
    replEl.value = val.slice(0, cut) + item.name + val.slice(pos);
    var np = cut + item.name.length;
    try {
      replEl.setSelectionRange(np, np);
    } catch (e) {}
    acClose();
  }

  /** Menangani tombol khusus saat popup autocomplete terbuka.
   *  Mengembalikan true bila tombol sudah ditangani. */
  function acKeydown(e) {
    if (!acOpen) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      acMove(1);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      acMove(-1);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      acClose();
      return true;
    }
    if (e.key === "Tab" || (e.key === "Enter" && acIndex >= 0)) {
      e.preventDefault();
      acAccept();
      return true;
    }
    return false;
  }

  /**
   * Mengevaluasi ekspresi JavaScript pada konteks halaman.
   * Mendukung $0 (elemen terpilih), $_ (hasil terakhir), serta helper
   * $ (querySelector) dan $$ (querySelectorAll -> array).
   */
  function evalExpression(code) {
    var sel = selectedEl;
    var prev = lastResult;
    /* Coba sebagai ekspresi lebih dulu agar hasil dikembalikan. */
    try {
      var fnExpr = new Function("$0", "$_", "$", "$$", "return (" + code + "\n);");
      return fnExpr(sel, prev, replDollar, replDollarAll);
    } catch (e) {
      /* Bila bukan ekspresi valid (mis. deklarasi), jalankan sebagai blok. */
      var fnBlock = new Function("$0", "$_", "$", "$$", code + "\n; return undefined;");
      return fnBlock(sel, prev, replDollar, replDollarAll);
    }
  }

  /* ==================================================================
     BAGIAN 11 - Panel SUMBER (file, editor, cuplikan)
     ================================================================== */

  var sourceFiles = [];
  var currentFile = null;
  var srcPretty = false;

  function buildSources(panel) {
    var outer = el("div");
    outer.id = "mdt-src-outer";

    /* --- Sub-tab: Halaman / Cuplikan --- */
    srcSubTabsEl = el("div");
    srcSubTabsEl.id = "mdt-src-subtabs";
    var stabPage = el("button", "mdt-src-stab on", "Halaman");
    stabPage.type = "button";
    var stabSnip = el("button", "mdt-src-stab", "Cuplikan");
    stabSnip.type = "button";
    stabPage.addEventListener("click", function () {
      switchSrcView("page");
      stabPage.classList.add("on");
      stabSnip.classList.remove("on");
    });
    stabSnip.addEventListener("click", function () {
      switchSrcView("snippets");
      stabSnip.classList.add("on");
      stabPage.classList.remove("on");
    });
    srcSubTabsEl.appendChild(stabPage);
    srcSubTabsEl.appendChild(stabSnip);
    outer.appendChild(srcSubTabsEl);

    /* --- Bar bantu seluler --- */
    var mobBar = el("div");
    mobBar.id = "mdt-src-mobile-bar";
    var btnNav = el("button", "mdt-src-mob-btn", "Berkas");
    btnNav.type = "button";
    btnNav.addEventListener("click", function () {
      if (srcNavEl) {
        srcNavEl.classList.toggle("collapsed");
        btnNav.classList.toggle("on");
      }
    });
    var btnDbg = el("button", "mdt-src-mob-btn", "Debugger");
    btnDbg.type = "button";
    btnDbg.addEventListener("click", function () {
      var dbg = document.getElementById("mdt-src-dbg");
      if (dbg) {
        dbg.classList.toggle("collapsed");
        btnDbg.classList.toggle("on");
      }
    });
    mobBar.appendChild(btnNav);
    mobBar.appendChild(btnDbg);
    outer.appendChild(mobBar);

    /* --- Pemecah tiga kolom --- */
    var split = el("div");
    split.id = "mdt-src-split";

    /* Navigasi berkas + panel cuplikan (saling bertukar). */
    srcNavEl = el("div");
    srcNavEl.id = "mdt-src-nav";
    srcTreeWrapEl = el("div");
    srcTreeWrapEl.id = "mdt-src-treewrap";
    srcNavEl.appendChild(srcTreeWrapEl);
    snippetsNavEl = buildSnippetsNav();
    snippetsNavEl.style.display = "none";
    srcNavEl.appendChild(snippetsNavEl);
    renderSnippets();
    split.appendChild(srcNavEl);

    /* Pusat: editor. */
    var editorWrap = el("div");
    editorWrap.id = "mdt-src-editor-wrap";

    srcFileTabsEl = el("div");
    srcFileTabsEl.id = "mdt-src-filetabs";
    editorWrap.appendChild(srcFileTabsEl);

    var editor = el("div");
    editor.id = "mdt-src-editor";
    srcCodeEl = el("div");
    srcCodeEl.id = "mdt-src-code";
    editor.appendChild(srcCodeEl);

    snippetEditorWrapEl = el("div", "mdt-snip-editor-wrap");
    snippetEditorWrapEl.id = "mdt-snip-editor";
    snippetEditorWrapEl.style.display = "none";

    /* Bar aksi cuplikan dengan tombol "Jalankan". */
    snipBarEl = el("div");
    snipBarEl.id = "mdt-snip-bar";
    snipBarEl.style.display = "none";
    snipBarEl.style.alignItems = "center";
    snipBarEl.style.gap = "8px";
    snipBarEl.style.padding = "4px 8px";
    snipBarEl.style.background = "#1e1e1e";
    snipBarEl.style.borderBottom = "1px solid rgba(255,255,255,.08)";
    var snipRunBtn = el("button", "mdt-snip-run-btn", "Jalankan");
    snipRunBtn.type = "button";
    snipRunBtn.addEventListener("click", function () {
      var id = snipTaEl.getAttribute("data-open");
      var snip = findSnippet(id);
      if (snip) {
        snip.code = snipTaEl.value;
        runSnippet(snip);
      }
    });
    snipBarEl.appendChild(snipRunBtn);
    editor.appendChild(snipBarEl);

    snipGutterEl = el("div", "mdt-snip-gutter", "1");
    snippetEditorWrapEl.appendChild(snipGutterEl);
    snipTaEl = el("textarea", "mdt-snip-ta");
    snipTaEl.setAttribute("spellcheck", "false");
    snipTaEl.addEventListener("input", updateSnipGutter);
    snipTaEl.addEventListener("blur", saveOpenSnippet);
    snippetEditorWrapEl.appendChild(snipTaEl);
    snippetEditorWrapEl.appendChild(el("div", "mdt-snip-hl"));
    editor.appendChild(snippetEditorWrapEl);

    editorWrap.appendChild(editor);

    /* Status bar bawah. */
    var status = el("div");
    status.id = "mdt-src-statusbar";
    var sbLeft = el("div", "sb-left");
    srcPrettyBtnEl = el("button", null, "Perindah");
    srcPrettyBtnEl.id = "mdt-src-prettybtn";
    srcPrettyBtnEl.type = "button";
    srcPrettyBtnEl.addEventListener("click", prettifyCurrentSource);
    sbLeft.appendChild(srcPrettyBtnEl);
    var sbRight = el("div", "sb-right");
    srcStatusRightEl = el("span", null, "");
    sbRight.appendChild(srcStatusRightEl);
    status.appendChild(sbLeft);
    status.appendChild(sbRight);
    editorWrap.appendChild(status);

    split.appendChild(editorWrap);

    /* Kanan: sidebar debugger sederhana. */
    var dbg = el("div");
    dbg.id = "mdt-src-dbg";

    /* Kontrol jeda (visual; eksekusi debugger penuh di luar cakupan). */
    var dbgControls = el("div");
    dbgControls.id = "mdt-dbg-controls";
    var ctrlDefs = [
      ["Lanjut", "Lanjutkan eksekusi"],
      ["Masuk", "Masuk ke fungsi"],
      ["Lewati", "Lewati baris"],
      ["Keluar", "Keluar dari fungsi"]
    ];
    for (var ci = 0; ci < ctrlDefs.length; ci++) {
      (function (def) {
        var cb = el("button", "mdt-dbg-ctrl", def[0]);
        cb.type = "button";
        cb.setAttribute("title", def[1]);
        cb.addEventListener("click", function () {
          setDbgStatus(def[1] + " (demo)");
        });
        dbgControls.appendChild(cb);
      })(ctrlDefs[ci]);
    }
    dbg.appendChild(dbgControls);

    var dbgStatus = el("div", null, "Belum ada sesi debugger aktif.");
    dbgStatus.id = "mdt-dbg-status";
    dbg.appendChild(dbgStatus);

    dbg.appendChild(makeDbgSection("Titik henti", "Belum ada titik henti."));
    dbg.appendChild(makeDbgSection("Ekspresi pantau", "Belum ada ekspresi."));
    dbg.appendChild(makeDbgSection("Lingkup variabel", "Belum ada variabel."));
    split.appendChild(dbg);

    outer.appendChild(split);
    panel.appendChild(outer);

    collectSources();
    renderSourceNav();
    if (sourceFiles.length) openSourceFile(0);
    else renderSourceEmpty();
  }

  /** Memperbarui teks status debugger di sidebar Sumber. */
  function setDbgStatus(text) {
    var s = document.getElementById("mdt-dbg-status");
    if (s) s.textContent = text;
  }

  /** Membuat satu seksi sidebar debugger. */
  function makeDbgSection(title, emptyText) {
    var sec = el("div", "mdt-dbg-sec");
    var hdr = el("div", "mdt-dbg-sec-hdr");
    hdr.appendChild(el("span", "mdt-dbg-arrow", "+"));
    hdr.appendChild(el("span", "mdt-dbg-sec-title", title));
    var body = el("div", "mdt-dbg-sec-body");
    body.appendChild(el("div", "mdt-dbg-empty", emptyText));
    hdr.addEventListener("click", function () {
      body.classList.toggle("open");
      var ar = hdr.firstChild;
      ar.classList.toggle("open");
      ar.textContent = body.classList.contains("open") ? "-" : "+";
    });
    sec.appendChild(hdr);
    sec.appendChild(body);
    return sec;
  }

  /** Mengumpulkan sumber daya skrip/gaya dari halaman. */
  function collectSources() {
    sourceFiles = [];
    var i;

    var scripts = document.querySelectorAll("script");
    for (i = 0; i < scripts.length; i++) {
      var sc = scripts[i];
      if (sc.src) {
        sourceFiles.push({
          name: shortUrl(sc.src),
          url: sc.src,
          type: /\.m?js(\?|#|$)/i.test(sc.src) ? "js" : "js",
          code: null
        });
      } else if (sc.textContent && sc.textContent.trim()) {
        sourceFiles.push({ name: "skrip-inline-" + (i + 1) + ".js", url: "", type: "js", code: sc.textContent });
      }
    }

    var styles = document.querySelectorAll("style");
    for (i = 0; i < styles.length; i++) {
      if (styles[i].textContent && styles[i].textContent.trim()) {
        sourceFiles.push({ name: "gaya-inline-" + (i + 1) + ".css", url: "", type: "css", code: styles[i].textContent });
      }
    }

    var links = document.querySelectorAll('link[rel~="stylesheet"]');
    for (i = 0; i < links.length; i++) {
      if (links[i].href) {
        sourceFiles.push({ name: shortUrl(links[i].href), url: links[i].href, type: "css", code: null });
      }
    }
  }

  /** Menampilkan daftar berkas pada navigasi sumber. */
  function renderSourceNav() {
    if (!srcTreeWrapEl) return;
    srcTreeWrapEl.textContent = "";
    var groups = { js: [], css: [] };
    for (var i = 0; i < sourceFiles.length; i++) {
      var f = sourceFiles[i];
      groups[f.type === "css" ? "css" : "js"].push({ file: f, index: i });
    }
    appendFileGroup("Skrip", groups.js);
    appendFileGroup("Gaya", groups.css);
    if (!sourceFiles.length) {
      srcTreeWrapEl.appendChild(el("div", "mdt-dbg-empty", "Tidak ada sumber yang dapat dibaca."));
    }
  }

  function appendFileGroup(title, list) {
    if (!list.length) return;
    srcTreeWrapEl.appendChild(el("div", "mdt-app-section-hdr", title));
    for (var i = 0; i < list.length; i++) {
      (function (item) {
        var node = el("div", "mdt-tree-node");
        node.appendChild(el("span", "mdt-tree-arrow", item.file.url ? "@" : ">"));
        node.appendChild(el("span", "mdt-tree-icon", item.file.type === "css" ? "css" : "js"));
        node.appendChild(el("span", "mdt-tree-label", item.file.name));
        node.addEventListener("click", function () {
          openSourceFile(item.index);
        });
        srcTreeWrapEl.appendChild(node);
      })(list[i]);
    }
  }

  /** Membuka berkas sumber berdasarkan indeks. */
  function openSourceFile(index) {
    var f = sourceFiles[index];
    if (!f) return;
    currentFile = { index: index, file: f, pretty: false };

    /* Perbarui tab berkas. */
    srcFileTabsEl.textContent = "";
    var ft = el("div", "mdt-filetab active");
    ft.appendChild(el("span", "mdt-filetab-icon", f.type === "css" ? "css" : "js"));
    ft.appendChild(el("span", "mdt-filetab-name", f.name));
    ft.addEventListener("click", function () {
      openSourceFile(index);
    });
    srcFileTabsEl.appendChild(ft);

    if (srcStatusRightEl) srcStatusRightEl.textContent = f.url || "inline";

    if (f.code !== null && f.code !== undefined) {
      renderSourceCode(f.code, f.type);
    } else if (f.url) {
      /* Berkas eksternal: ambil isi bila memungkinkan (satu asal). */
      var sameOrigin = false;
      try {
        sameOrigin = new URL(f.url, location.href).origin === location.origin;
      } catch (e) {}
      f.code = "// Memuat " + f.url + " ...";
      renderSourceCode(f.code, f.type);
      if (sameOrigin && typeof fetch === "function") {
        fetch(f.url)
          .then(function (r) {
            return r.text();
          })
          .then(function (txt) {
            f.code = txt;
            if (currentFile && currentFile.index === index) renderSourceCode(txt, f.type);
          })
          .catch(function () {
            f.code = "// Tidak dapat memuat berkas lintas asal:\n// " + f.url;
            if (currentFile && currentFile.index === index) renderSourceCode(f.code, f.type);
          });
      } else {
        f.code = "// Berkas eksternal (isi tidak tersedia di sini):\n// " + f.url;
        renderSourceCode(f.code, f.type);
      }
    }
  }

  /** Menampilkan pesan bila tidak ada sumber. */
  function renderSourceEmpty() {
    if (!srcCodeEl) return;
    srcCodeEl.textContent = "";
    var empty = el("div", null, "Tidak ada berkas sumber yang dapat ditampilkan.");
    empty.id = "mdt-src-code-empty";
    srcCodeEl.appendChild(empty);
  }

  /**
   * Menampilkan kode pada editor dengan nomor baris dan pewarnaan sintaks.
   * @param {string} code
   * @param {string} type - "js" | "css" | "html"
   */
  function renderSourceCode(code, type) {
    if (!srcCodeEl) return;
    srcCodeEl.textContent = "";
    if (!code) {
      renderSourceEmpty();
      return;
    }
    var lines = code.split("\n");
    var maxLines = 2000;
    var beautify = window.MDT_BEAUTIFY;

    for (var i = 0; i < lines.length && i < maxLines; i++) {
      var row = el("div", "mdt-src-line");
      var ln = el("span", "mdt-src-ln", String(i + 1));
      ln.appendChild(el("span", "bp-dot"));
      row.appendChild(ln);

      var txt = el("span", "mdt-src-code-txt");
      if (beautify) {
        try {
          if (type === "css" && beautify.highlightCSS) beautify.highlightCSS(txt, lines[i]);
          else if (type === "html" && beautify.highlightHTML) beautify.highlightHTML(txt, lines[i]);
          else if (beautify.highlightJS) beautify.highlightJS(txt, lines[i]);
          else txt.textContent = lines[i];
        } catch (e) {
          txt.textContent = lines[i];
        }
      } else {
        txt.textContent = lines[i];
      }
      row.appendChild(txt);

      /* Klik nomor baris -> titik henti visual. */
      (function (r) {
        r.addEventListener("click", function () {
          r.classList.toggle("bp");
        });
      })(row);

      srcCodeEl.appendChild(row);
    }
  }

  /** Merapikan (prettify) kode sumber berkas aktif. */
  function prettifyCurrentSource() {
    if (!currentFile || !currentFile.file) return;
    var f = currentFile.file;
    if (f.code === null || f.code === undefined) return;
    var beautify = window.MDT_BEAUTIFY;
    if (!beautify) return;
    try {
      if (f.type === "css" && beautify.prettifyCSS) f.code = beautify.prettifyCSS(f.code);
      else if (f.type === "html" && beautify.prettifyHTML) f.code = beautify.prettifyHTML(f.code);
      else if (beautify.prettifyJS) f.code = beautify.prettifyJS(f.code);
      renderSourceCode(f.code, f.type);
    } catch (e) {
      addLog("warn", ["Gagal merapikan berkas:", e.message], "");
    }
  }

  /** Bertukar antara tampilan Halaman dan Cuplikan. */
  function switchSrcView(view) {
    if (!srcTreeWrapEl) return;
    if (view === "snippets") {
      srcTreeWrapEl.style.display = "none";
      snippetsNavEl.style.display = "";
      srcCodeEl.style.display = "none";
      snippetEditorWrapEl.style.display = "flex";
      if (snipBarEl) snipBarEl.style.display = "flex";
    } else {
      srcTreeWrapEl.style.display = "";
      snippetsNavEl.style.display = "none";
      srcCodeEl.style.display = "";
      snippetEditorWrapEl.style.display = "none";
      if (snipBarEl) snipBarEl.style.display = "none";
    }
  }

  /* ---------- Cuplikan (snippets) ---------- */

  var SNIP_KEY = "mdt_snippets_v1";
  var snippets = [];

  var BUILTIN_SNIPPETS = [
    {
      id: "b1",
      name: "Hapus semua cookie",
      code: "document.cookie.split(';').forEach(function (c) {\n  var name = c.split('=')[0].trim();\n  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';\n});\nconsole.log('Cookie dibersihkan');"
    },
    {
      id: "b2",
      name: "Hitung performa navigasi",
      code: "var n = performance.getEntriesByType('navigation')[0];\nif (n) console.log({\n  dns: Math.round(n.domainLookupEnd - n.domainLookupStart),\n  ttfb: Math.round(n.responseStart - n.startTime),\n  domReady: Math.round(n.domContentLoadedEventEnd),\n  load: Math.round(n.loadEventEnd)\n});"
    },
    {
      id: "b3",
      name: "Sorot grid tata letak",
      code: "var d = document.createElement('div');\nd.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483640;background-image:linear-gradient(rgba(86,156,214,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(86,156,214,.25) 1px,transparent 1px);background-size:24px 24px;';\nd.id = 'mdt-grid-overlay';\ndocument.body.appendChild(d);\nconsole.log('Grid ditampilkan, klik lagi untuk mengganti');"
    },
    {
      id: "b4",
      name: "Ambil semua gambar",
      code: "var imgs = Array.prototype.map.call(document.images, function (i) { return i.currentSrc || i.src; });\nconsole.log(imgs.length + ' gambar');\nconsole.log(imgs);"
    },
    {
      id: "b5",
      name: "Kosongkan localStorage",
      code: "localStorage.clear();\nconsole.log('localStorage dikosongkan');"
    },
    {
      id: "b6",
      name: "Garis tepi semua elemen",
      code: "Array.prototype.forEach.call(document.querySelectorAll('*'), function (e) {\n  e.style.outline = '1px solid rgba(244,71,71,.6)';\n});\nconsole.log('Garis tepi dipasang');"
    }
  ];

  /** Membangun panel navigasi cuplikan. */
  function buildSnippetsNav() {
    loadSnippets();
    var nav = el("div");
    nav.id = "mdt-snippets-nav";

    var hdr = el("div");
    hdr.id = "mdt-snippets-nav-hdr";
    hdr.appendChild(el("span", null, "Cuplikan"));
    var newBtn = el("button", null, "+");
    newBtn.id = "mdt-snippets-new-btn";
    newBtn.type = "button";
    newBtn.setAttribute("title", "Cuplikan baru");
    newBtn.addEventListener("click", function () {
      createUserSnippet();
    });
    hdr.appendChild(newBtn);
    nav.appendChild(hdr);
    return nav;
  }

  /** Memuat cuplikan bawaan + simpanan pengguna. */
  function loadSnippets() {
    snippets = [];
    var i;
    for (i = 0; i < BUILTIN_SNIPPETS.length; i++) {
      snippets.push({ id: BUILTIN_SNIPPETS[i].id, name: BUILTIN_SNIPPETS[i].name, code: BUILTIN_SNIPPETS[i].code, builtin: true });
    }
    var saved = [];
    try {
      var raw = localStorage.getItem(SNIP_KEY);
      if (raw) saved = JSON.parse(raw) || [];
    } catch (e) {
      saved = [];
    }
    for (i = 0; i < saved.length; i++) {
      snippets.push({ id: saved[i].id, name: saved[i].name, code: saved[i].code, builtin: false });
    }
  }

  /** Menyimpan cuplikan buatan pengguna ke localStorage. */
  function persistSnippets() {
    var out = [];
    for (var i = 0; i < snippets.length; i++) {
      if (!snippets[i].builtin) out.push({ id: snippets[i].id, name: snippets[i].name, code: snippets[i].code });
    }
    try {
      localStorage.setItem(SNIP_KEY, JSON.stringify(out));
    } catch (e) {}
  }

  /** Membuat cuplikan baru. */
  function createUserSnippet() {
    var id = "u" + Date.now();
    snippets.push({ id: id, name: "Cuplikan baru", code: "console.log('Halo dari cuplikan');", builtin: false });
    persistSnippets();
    renderSnippets();
    openSnippet(id);
  }

  /** Menampilkan daftar cuplikan. */
  function renderSnippets() {
    if (!snippetsNavEl) return; /* panel Sumber belum dibangun */
    var list = document.getElementById("mdt-snippets-list");
    if (!list) {
      list = el("div");
      list.id = "mdt-snippets-list";
      snippetsNavEl.appendChild(list);
    }
    list.textContent = "";
    if (!snippets.length) {
      list.appendChild(el("div", "mdt-dbg-empty", "Belum ada cuplikan."));
      return;
    }
    for (var i = 0; i < snippets.length; i++) {
      (function (snip) {
        var item = el("div", "mdt-snippet-item");
        item.setAttribute("data-snip", snip.id);
        item.appendChild(el("span", "snip-icon", ">"));
        item.appendChild(el("span", "snip-name", snip.name));

        var actions = el("div", "mdt-snip-actions");
        var runBtn = el("button", "mdt-snip-act run", "jalan");
        runBtn.type = "button";
        runBtn.setAttribute("title", "Jalankan");
        runBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          runSnippet(snip);
        });
        var renBtn = el("button", "mdt-snip-act rename", "ubah");
        renBtn.type = "button";
        renBtn.setAttribute("title", "Ubah nama");
        renBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          renameSnippet(snip, item);
        });
        var delBtn = el("button", "mdt-snip-act del", "hapus");
        delBtn.type = "button";
        delBtn.setAttribute("title", "Hapus");
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteSnippet(snip);
        });
        actions.appendChild(runBtn);
        if (!snip.builtin) actions.appendChild(renBtn);
        if (!snip.builtin) actions.appendChild(delBtn);
        item.appendChild(actions);

        item.addEventListener("click", function () {
          openSnippet(snip.id);
        });
        list.appendChild(item);
      })(snippets[i]);
    }
  }

  /** Membuka cuplikan pada editor. */
  function openSnippet(id) {
    var snip = findSnippet(id);
    if (!snip || !snipTaEl) return;
    snipTaEl.value = snip.code;
    snipTaEl.setAttribute("data-open", id);
    updateSnipGutter();
    switchSrcView("snippets");
    var items = snippetsNavEl.querySelectorAll(".mdt-snippet-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", items[i].getAttribute("data-snip") === id);
    }
  }

  function findSnippet(id) {
    for (var i = 0; i < snippets.length; i++) if (snippets[i].id === id) return snippets[i];
    return null;
  }

  /** Memperbarui nomor baris gutter cuplikan. */
  function updateSnipGutter() {
    if (!snipGutterEl || !snipTaEl) return;
    var n = snipTaEl.value.split("\n").length;
    var out = [];
    for (var i = 1; i <= n; i++) out.push(i);
    snipGutterEl.textContent = out.join("\n");
  }

  /** Menyimpan perbaikan isi cuplikan saat editor kehilangan fokus. */
  function saveOpenSnippet() {
    var id = snipTaEl ? snipTaEl.getAttribute("data-open") : null;
    if (!id) return;
    var snip = findSnippet(id);
    if (!snip) return;
    snip.code = snipTaEl.value;
    if (!snip.builtin) persistSnippets();
  }

  /** Menjalankan isi cuplikan pada konteks halaman. */
  function runSnippet(snip) {
    try {
      var fn = new Function(snip.code);
      fn();
      addLog("info", ["Cuplikan dijalankan:", snip.name], "");
    } catch (e) {
      addLog("error", ["Cuplikan gagal:", String(e)], "");
    }
  }

  /** Mengubah nama cuplikan secara inline. */
  function renameSnippet(snip, item) {
    var nameEl = item.querySelector(".snip-name");
    if (!nameEl) return;
    var inp = el("input", "snip-rename-inp");
    inp.value = snip.name;
    nameEl.replaceWith(inp);
    inp.focus();
    function commit() {
      snip.name = inp.value.trim() || snip.name;
      persistSnippets();
      renderSnippets();
    }
    inp.addEventListener("blur", commit);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") commit();
    });
  }

  /** Menghapus cuplikan pengguna. */
  function deleteSnippet(snip) {
    if (snip.builtin) return;
    snippets = snippets.filter(function (s) {
      return s.id !== snip.id;
    });
    persistSnippets();
    renderSnippets();
  }

  /* ==================================================================
     BAGIAN 12 - Panel JARINGAN
     ================================================================== */

  function buildNetwork(panel) {
    var tb = el("div", "mdt-toolbar");
    var clearBtn = el("button", "mdt-tbtn", "Bersihkan");
    clearBtn.type = "button";
    clearBtn.addEventListener("click", clearNet);
    tb.appendChild(clearBtn);
    netFilterEl = el("input", "mdt-tbinput");
    netFilterEl.setAttribute("placeholder", "Saring URL");
    netFilterEl.addEventListener("input", applyNetFilter);
    tb.appendChild(netFilterEl);

    /* FASE 4: filter tipe dan status digabung dengan filter URL. */
    netTypeFilterEl = el("select", "mdt-netsel");
    netTypeFilterEl.id = "mdt-net-type";
    netTypeFilterEl.setAttribute("title", "Saring tipe");
    var typeOpts = [
      ["", "Semua tipe"], ["xhr", "XHR"], ["fetch", "Fetch"], ["doc", "Document"],
      ["script", "Script"], ["css", "Stylesheet"], ["img", "Image"],
      ["media", "Media"], ["font", "Font"], ["other", "Lainnya"]
    ];
    for (var to = 0; to < typeOpts.length; to++) {
      var topt = el("option", null, typeOpts[to][1]);
      topt.value = typeOpts[to][0];
      netTypeFilterEl.appendChild(topt);
    }
    netTypeFilterEl.addEventListener("change", applyNetFilter);
    tb.appendChild(netTypeFilterEl);

    netStatusFilterEl = el("select", "mdt-netsel");
    netStatusFilterEl.id = "mdt-net-status";
    netStatusFilterEl.setAttribute("title", "Saring status");
    var statusOpts = [
      ["", "Semua status"], ["2", "2xx"], ["3", "3xx"], ["4", "4xx"], ["5", "5xx"], ["gagal", "Gagal"]
    ];
    for (var so = 0; so < statusOpts.length; so++) {
      var sopt = el("option", null, statusOpts[so][1]);
      sopt.value = statusOpts[so][0];
      netStatusFilterEl.appendChild(sopt);
    }
    netStatusFilterEl.addEventListener("change", applyNetFilter);
    tb.appendChild(netStatusFilterEl);
    panel.appendChild(tb);

    var hdr = el("div", "mdt-net-hdr");
    hdr.appendChild(el("span", null, ""));
    hdr.appendChild(el("span", null, "Metode"));
    hdr.appendChild(el("span", null, "Status"));
    hdr.appendChild(el("span", null, "Nama"));
    hdr.appendChild(el("span", null, "Tipe"));
    hdr.appendChild(el("span", null, "Ukuran"));
    hdr.appendChild(el("span", null, "Waktu"));
    panel.appendChild(hdr);

    netListEl = el("div");
    netListEl.id = "mdt-net-list";
    panel.appendChild(netListEl);

    netDetailEl = el("div");
    netDetailEl.id = "mdt-net-detail";
    netDetailTabsEl = el("div");
    netDetailTabsEl.id = "mdt-net-detail-tabs";
    var tabs = [
      ["headers", "Header"],
      ["payload", "Payload"],
      ["body", "Body"],
      ["cookies", "Cookie"],
      ["response", "Respons"]
    ];
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        var b = el("button", "mdt-ndt" + (t[0] === "headers" ? " on" : ""), t[1]);
        b.type = "button";
        b.setAttribute("data-ndt", t[0]);
        b.addEventListener("click", function () {
          var all = netDetailTabsEl.querySelectorAll(".mdt-ndt");
          for (var k = 0; k < all.length; k++) all[k].classList.toggle("on", all[k] === b);
          renderNetDetail(t[0]);
        });
        netDetailTabsEl.appendChild(b);
      })(tabs[i]);
    }
    netDetailEl.appendChild(netDetailTabsEl);

    /* FASE 4: tombol salin cURL / respons. */
    netDetailToolsEl = el("div");
    netDetailToolsEl.id = "mdt-net-detail-tools";
    var curlBtn = el("button", "mdt-nettool", "Salin sebagai cURL");
    curlBtn.type = "button";
    curlBtn.id = "mdt-net-curl";
    curlBtn.addEventListener("click", function () {
      var rec = netRows[netSelected];
      if (rec) copyText(toCurl(rec.data));
    });
    var resCopyBtn = el("button", "mdt-nettool", "Salin respons");
    resCopyBtn.type = "button";
    resCopyBtn.id = "mdt-net-copyres";
    resCopyBtn.addEventListener("click", function () {
      var rec = netRows[netSelected];
      if (rec) copyText(typeof rec.data.resBody === "string" ? rec.data.resBody : "");
    });
    netDetailToolsEl.appendChild(curlBtn);
    netDetailToolsEl.appendChild(resCopyBtn);
    netDetailEl.appendChild(netDetailToolsEl);

    netDetailBodyEl = el("div");
    netDetailBodyEl.id = "mdt-net-detail-body";
    netDetailEl.appendChild(netDetailBodyEl);
    panel.appendChild(netDetailEl);

    /* Proses pesan jaringan yang masuk sebelum panel dibangun. */
    for (var qi = 0; qi < netQueue.length; qi++) applyNetMessage(netQueue[qi]);
    netQueue = [];
  }

  /** Mengisi data jaringan awal dari Resource Timing bila belum ada. */
  function ensureNetInit() {
    if (netInited) return;
    netInited = true;
    try {
      var entries = performance.getEntriesByType("resource") || [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        appendNetRow({
          id: "res-" + i,
          method: "GET",
          url: e.name,
          type: e.initiatorType || "lain",
          status: 200,
          dur: Math.round(e.duration),
          size: e.transferSize || -1,
          methodSpan: true
        });
      }
    } catch (err) {}
  }

  /**
   * Menangani pesan {action:"net"} dari background.
   * Bila panel belum dibangun, pesan disimpan antrean lalu diproses nanti.
   */
  function handleNetMessage(msg) {
    if (!built.network) {
      netQueue.push(msg);
      return;
    }
    applyNetMessage(msg);
  }

  /** Menerapkan satu pesan jaringan ke daftar. */
  function applyNetMessage(msg) {
    if (!msg) return;
    if (msg.phase === "start") appendNetRow(msg);
    else updateNetRow(msg);
  }

  /** Menambah baris permintaan jaringan. */
  function appendNetRow(m) {
    if (!netListEl) return;
    var id = m.id || "n" + Math.random();
    var row = el("div", "mdt-net-row" + (m.phase === "start" ? " pend" : ""));
    row.setAttribute("data-netid", id);
    row.setAttribute("data-nettipe", m.type || "other");

    row.appendChild(el("span", "nc-ico", icoForType(m.type)));

    var meth = el("span", "mdt-method mdt-m-" + methodClass(m.method), m.method || "-");
    row.appendChild(meth);

    var st = el("span", "mdt-st-x", "");
    row.appendChild(st);

    var name = el("span", null, nameFromUrl(m.url));
    name.setAttribute("title", m.url || "");
    row.appendChild(name);

    row.appendChild(el("span", null, m.type || ""));

    var size = el("span", null, "…");
    row.appendChild(size);

    var wfCell = el("span", null, "");
    var wf = el("span", "mdt-net-waterfall");
    var bar = el("span", "mdt-net-bar");
    wf.appendChild(bar);
    wfCell.appendChild(wf);
    row.appendChild(wfCell);

    netListEl.appendChild(row);

    netRows[id] = {
      el: row,
      status: st,
      size: size,
      bar: bar,
      data: {
        id: id,
        method: m.method || "",
        url: m.url || "",
        type: m.type || "",
        status: m.status || 0,
        dur: m.dur || 0,
        size: typeof m.size === "number" ? m.size : -1,
        resHeaders: m.resHeaders || [],
        reqHeaders: m.reqHeaders || [],
        error: m.error || "",
        fromCache: m.fromCache,
        reqBody: typeof m.reqBody === "string" ? m.reqBody : "",
        resBody: typeof m.resBody === "string" ? m.resBody : "",
        resBodyTrunc: !!m.resBodyTrunc
      }
    };
    netOrder.push(id);
    if ((m.dur || 0) > netMaxDur) netMaxDur = m.dur || 1;

    if (m.status) updateNetRow(m);
    else if (m.dur) {
      updateNetRow({ id: id, status: 200, dur: m.dur, size: m.size });
    }

    row.addEventListener("click", function () {
      showNetDetail(id);
    });
  }

  /** Memperbarui baris jaringan saat respons selesai / galat. */
  function updateNetRow(m) {
    var rec = netRows[m.id];
    if (!rec) return;
    rec.el.classList.remove("pend");

    if (m.error) {
      rec.el.classList.add("err");
      rec.status.textContent = "Gagal";
      rec.status.className = "mdt-st-x";
      rec.data.error = m.error;
    } else if (m.status) {
      var s = String(m.status);
      rec.status.textContent = s;
      rec.status.className = "mdt-st-" + s.charAt(0);
      rec.data.status = m.status;
      rec.el.setAttribute("data-netstatus", s);
    }

    if (typeof m.dur === "number") {
      rec.data.dur = m.dur;
      if (m.dur > netMaxDur) netMaxDur = m.dur;
    }
    if (typeof m.size === "number") {
      rec.data.size = m.size;
      rec.size.textContent = formatSize(m.size);
    }
    if (m.statusText) rec.data.statusText = m.statusText;
    if (m.resHeaders) rec.data.resHeaders = m.resHeaders;
    if (m.reqHeaders) rec.data.reqHeaders = m.reqHeaders;
    if (typeof m.fromCache !== "undefined") rec.data.fromCache = m.fromCache;
    if (typeof m.reqBody === "string") rec.data.reqBody = m.reqBody;
    if (typeof m.resBody === "string") rec.data.resBody = m.resBody;
    if (typeof m.resBodyTrunc !== "undefined") rec.data.resBodyTrunc = !!m.resBodyTrunc;

    updateWaterfalls();
    if (netSelected === m.id) renderNetDetail(currentNetDetailTab());
  }

  /** Menghitung ulang lebar bilah waterfall seluruh baris. */
  function updateWaterfalls() {
    for (var i = 0; i < netOrder.length; i++) {
      var rec = netRows[netOrder[i]];
      if (!rec) continue;
      var pct = Math.max(4, Math.min(100, (rec.data.dur / netMaxDur) * 100));
      rec.bar.style.width = pct + "%";
    }
  }

  /** Menyaring baris jaringan berdasarkan teks URL, tipe, dan status (FASE 4). */
  function applyNetFilter() {
    if (!netListEl) return;
    var q = netFilterEl ? netFilterEl.value.toLowerCase() : "";
    var tf = netTypeFilterEl ? netTypeFilterEl.value : "";
    var sf = netStatusFilterEl ? netStatusFilterEl.value : "";
    var rows = netListEl.querySelectorAll(".mdt-net-row");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var textOk = !q || row.textContent.toLowerCase().indexOf(q) >= 0;
      var typeOk = !tf || row.getAttribute("data-nettipe") === tf;
      var stat = row.getAttribute("data-netstatus") || "";
      var statusOk;
      if (!sf) statusOk = true;
      else if (sf === "gagal") statusOk = row.classList.contains("err");
      else statusOk = stat.charAt(0) === sf;
      row.style.display = textOk && typeOk && statusOk ? "" : "none";
    }
  }

  /** Membersihkan seluruh entri jaringan. */
  function clearNet() {
    netRows = {};
    netOrder = [];
    netMaxDur = 1;
    netSelected = null;
    if (netListEl) netListEl.textContent = "";
    if (netDetailEl) netDetailEl.classList.remove("on");
  }

  /** Menampilkan detail satu permintaan jaringan. */
  function showNetDetail(id) {
    netSelected = id;
    if (netDetailEl) netDetailEl.classList.add("on");
    var rows = netListEl.querySelectorAll(".mdt-net-row");
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle("sel", rows[i].getAttribute("data-netid") === id);
    }
    renderNetDetail("headers");
  }

  function currentNetDetailTab() {
    if (!netDetailTabsEl) return "headers";
    var on = netDetailTabsEl.querySelector(".mdt-ndt.on");
    return on ? on.getAttribute("data-ndt") : "headers";
  }

  /** Mengisi isi detail sesuai tab terpilih. */
  function renderNetDetail(tab) {
    if (!netDetailBodyEl || !netSelected) return;
    var rec = netRows[netSelected];
    if (!rec) return;
    var d = rec.data;
    netDetailBodyEl.textContent = "";

    if (tab === "headers") {
      netDetailBodyEl.appendChild(el("div", "mdt-dsec", "Umum"));
      netDetailBodyEl.appendChild(detailRow("URL", d.url));
      netDetailBodyEl.appendChild(detailRow("Metode", d.method));
      netDetailBodyEl.appendChild(detailRow("Status", d.status ? String(d.status) : (d.error || "-")));
      netDetailBodyEl.appendChild(detailRow("Durasi", d.dur + " ms"));
      netDetailBodyEl.appendChild(detailRow("Ukuran", formatSize(d.size)));
      if (typeof d.fromCache !== "undefined") netDetailBodyEl.appendChild(detailRow("Dari cache", d.fromCache ? "ya" : "tidak"));

      appendHeaders("Header permintaan", d.reqHeaders);
      appendHeaders("Header respons", d.resHeaders);
    } else if (tab === "payload") {
      netDetailBodyEl.appendChild(el("div", "mdt-dsec", "Payload permintaan"));
      appendHeaders("", d.reqHeaders);
      if (!d.reqHeaders || !d.reqHeaders.length) {
        netDetailBodyEl.appendChild(el("div", "mdt-style-addprop", "Tidak ada payload yang terdeteksi."));
      }
    } else if (tab === "body") {
      netDetailBodyEl.appendChild(el("div", "mdt-dsec", "Body permintaan"));
      appendBodyBlock(d.reqBody);
      netDetailBodyEl.appendChild(el("div", "mdt-dsec", "Body respons" + (d.resBodyTrunc ? " (terpotong)" : "")));
      appendBodyBlock(d.resBody);
    } else if (tab === "cookies") {
      appendCookies("Cookie permintaan", headerValues(d.reqHeaders, "cookie"), false);
      appendCookies("Cookie respons (Set-Cookie)", headerValues(d.resHeaders, "set-cookie"), true);
    } else {
      netDetailBodyEl.appendChild(el("div", "mdt-dsec", "Respons"));
      if (d.error) {
        netDetailBodyEl.appendChild(el("div", "mdt-style-addprop", "Galat: " + d.error));
      } else {
        netDetailBodyEl.appendChild(detailRow("Ukuran", formatSize(d.size)));
        appendHeaders("Header respons", d.resHeaders);
      }
    }
  }

  /** Mengumpulkan seluruh nilai header dengan nama tertentu (tanpa memperhatikan besar-kecil huruf). */
  function headerValues(headers, name) {
    var out = [];
    if (!headers) return out;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] && String(headers[i].name || "").toLowerCase() === name) {
        out.push(String(headers[i].value || ""));
      }
    }
    return out;
  }

  /** Menampilkan blok cookie; set-cookie hanya diambil pasangan name=value pertamanya. */
  function appendCookies(title, values, firstPairOnly) {
    netDetailBodyEl.appendChild(el("div", "mdt-dsec", title));
    if (!values || !values.length) {
      netDetailBodyEl.appendChild(el("div", "mdt-style-addprop", "Tidak ada cookie."));
      return;
    }
    for (var i = 0; i < values.length; i++) {
      var raw = values[i];
      var pairs = firstPairOnly ? [String(raw).split(";")[0]] : String(raw).split(";");
      for (var j = 0; j < pairs.length; j++) {
        var p = pairs[j].trim();
        if (!p) continue;
        var eq = p.indexOf("=");
        var nm = eq >= 0 ? p.slice(0, eq).trim() : p;
        var val = eq >= 0 ? p.slice(eq + 1) : "";
        var row = el("div", "mdt-drow");
        row.appendChild(el("span", "mdt-dk", nm));
        row.appendChild(el("span", "mdt-dv mdt-cookie-val", nm + "=" + val));
        netDetailBodyEl.appendChild(row);
      }
    }
  }

  /** Menampilkan body teks dengan tombol mentah/terformat dan JSON pretty-print. */
  function appendBodyBlock(text) {
    if (!text) {
      netDetailBodyEl.appendChild(el("div", "mdt-style-addprop", "Tidak ada body yang tertangkap."));
      return;
    }
    var pretty = text;
    var isJson = false;
    try {
      var obj = JSON.parse(text);
      pretty = JSON.stringify(obj, null, 2);
      isJson = true;
    } catch (e) { isJson = false; }
    var pre = el("pre", "mdt-netbody");
    function paint() {
      pre.textContent = (netBodyFormatted && isJson) ? pretty : text;
    }
    if (isJson) {
      var t = el("button", "mdt-nettool mdt-netbody-toggle", netBodyFormatted ? "Mentah" : "Terformat");
      t.type = "button";
      t.addEventListener("click", function () {
        netBodyFormatted = !netBodyFormatted;
        t.textContent = netBodyFormatted ? "Mentah" : "Terformat";
        paint();
      });
      netDetailBodyEl.appendChild(t);
    }
    paint();
    netDetailBodyEl.appendChild(pre);
  }

  /** Membungkus teks dalam kutip tunggal shell dengan escape yang benar. */
  function shellQuote(s) {
    var str = s === undefined || s === null ? "" : String(s);
    return "'" + str.replace(/'/g, "'\\''") + "'";
  }

  /** Menyusun perintah cURL dari data permintaan (FASE 4). */
  function toCurl(d) {
    if (!d) return "";
    var parts = ["curl"];
    var m = (d.method || "GET").toUpperCase();
    if (m && m !== "GET") parts.push("-X " + shellQuote(m));
    parts.push(shellQuote(d.url || ""));
    var headers = d.reqHeaders || [];
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (!h) continue;
      var nm = String(h.name || "");
      if (!nm || nm.charAt(0) === ":") continue;
      parts.push("-H " + shellQuote(nm + ": " + (h.value || "")));
    }
    var body = typeof d.reqBody === "string" ? d.reqBody : "";
    if (body) parts.push("--data-raw " + shellQuote(body));
    return parts.join(" \\\n  ");
  }

  function appendHeaders(title, headers) {
    if (title) netDetailBodyEl.appendChild(el("div", "mdt-dsec", title));
    if (!headers || !headers.length) return;
    for (var i = 0; i < headers.length; i++) {
      var row = el("div", "mdt-drow");
      row.appendChild(el("span", "mdt-dk", headers[i].name));
      var v = el("span", "mdt-dv");
      v.appendChild(el("span", "mdt-hdr-val", headers[i].value || ""));
      row.appendChild(v);
      netDetailBodyEl.appendChild(row);
    }
  }

  function detailRow(k, v) {
    var row = el("div", "mdt-drow");
    row.appendChild(el("span", "mdt-dk", k));
    row.appendChild(el("span", "mdt-dv", v === undefined || v === null ? "-" : String(v)));
    return row;
  }

  function icoForType(t) {
    return ({ js: "js", css: "css", xhr: "xhr", fetch: "api", img: "img", font: "fnt", media: "med", ws: "ws", doc: "doc", iframe: "frm" }[t]) || "req";
  }

  function methodClass(m) {
    var up = (m || "").toUpperCase();
    if (["GET", "POST", "PUT", "DELETE", "PATCH"].indexOf(up) >= 0) return up;
    return "X";
  }

  function nameFromUrl(u) {
    try {
      var noq = String(u).split("?")[0].split("#")[0];
      var parts = noq.split("/");
      return parts[parts.length - 1] || noq;
    } catch (e) {
      return String(u);
    }
  }

  function formatSize(n) {
    if (n === undefined || n === null || n < 0) return "-";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* ==================================================================
     BAGIAN 13 - Panel KINERJA
     ================================================================== */

  function buildPerformance(panel) {
    perfScrollEl = el("div");
    perfScrollEl.id = "mdt-perf-scroll";

    /* Kartu FPS */
    var fpsCard = el("div", "mdt-pcard");
    fpsCard.appendChild(el("h4", null, "FPS (bingkai per detik)"));
    fpsBigEl = el("div", "mdt-fps-big", "--");
    fpsCard.appendChild(fpsBigEl);
    var track = el("div", "mdt-bar-track");
    fpsBarEl = el("div", "mdt-bar-fill");
    fpsBarEl.style.width = "0%";
    track.appendChild(fpsBarEl);
    fpsCard.appendChild(track);
    perfScrollEl.appendChild(fpsCard);

    /* Kartu navigasi */
    var navCard = el("div", "mdt-pcard");
    navCard.appendChild(el("h4", null, "Metrik navigasi"));
    navCard.setAttribute("data-perf", "nav");
    perfScrollEl.appendChild(navCard);

    /* Kartu memori */
    var memCard = el("div", "mdt-pcard");
    memCard.appendChild(el("h4", null, "Memori"));
    memCard.setAttribute("data-perf", "mem");
    perfScrollEl.appendChild(memCard);

    /* Kartu halaman */
    var pageCard = el("div", "mdt-pcard");
    pageCard.appendChild(el("h4", null, "Halaman"));
    pageCard.setAttribute("data-perf", "page");
    perfScrollEl.appendChild(pageCard);

    panel.appendChild(perfScrollEl);
    renderPerfCards();
  }

  /** Mengisi kartu metrik navigasi, memori, dan halaman. */
  function renderPerfCards() {
    /* Navigasi */
    var navCard = perfScrollEl.querySelector('[data-perf="nav"]');
    if (navCard) {
      clearSpecial(navCard);
      var nav = null;
      try {
        nav = performance.getEntriesByType("navigation")[0];
      } catch (e) {}
      if (nav) {
        navCard.appendChild(pmRow("TTFB", Math.round(nav.responseStart - nav.startTime) + " ms"));
        navCard.appendChild(pmRow("DOMContentLoaded", Math.round(nav.domContentLoadedEventEnd) + " ms"));
        navCard.appendChild(pmRow("Load", Math.round(nav.loadEventEnd) + " ms"));
        navCard.appendChild(pmRow("Transfer", formatSize(nav.transferSize)));
      } else if (performance.timing) {
        var t = performance.timing;
        navCard.appendChild(pmRow("TTFB", t.responseStart - t.navigationStart + " ms"));
        navCard.appendChild(pmRow("DOMContentLoaded", t.domContentLoadedEventEnd - t.navigationStart + " ms"));
        navCard.appendChild(pmRow("Load", t.loadEventEnd - t.navigationStart + " ms"));
      } else {
        navCard.appendChild(pmRow("Info", "tidak tersedia"));
      }
    }

    /* Memori */
    var memCard = perfScrollEl.querySelector('[data-perf="mem"]');
    if (memCard) {
      clearSpecial(memCard);
      var mem = performance.memory;
      if (mem) {
        memCard.appendChild(pmRow("Dipakai", formatSize(mem.usedJSHeapSize)));
        memCard.appendChild(pmRow("Total", formatSize(mem.totalJSHeapSize)));
        memCard.appendChild(pmRow("Batas", formatSize(mem.jsHeapSizeLimit)));
      } else {
        memCard.appendChild(pmRow("Info", "tidak tersedia di peramban ini"));
      }
    }

    /* Halaman */
    var pageCard = perfScrollEl.querySelector('[data-perf="page"]');
    if (pageCard) {
      clearSpecial(pageCard);
      pageCard.appendChild(pmRow("Jumlah node DOM", String(document.getElementsByTagName("*").length)));
      pageCard.appendChild(pmRow("Gambar", String(document.images ? document.images.length : 0)));
      pageCard.appendChild(pmRow("Skrip", String(document.scripts ? document.scripts.length : 0)));
      pageCard.appendChild(pmRow("Lembar gaya", String(document.styleSheets ? document.styleSheets.length : 0)));
    }
  }

  /** Menghapus baris metrik lama, mempertahankan judul. */
  function clearSpecial(card) {
    while (card.childNodes.length > 1) card.removeChild(card.lastChild);
  }

  function pmRow(k, v) {
    var row = el("div", "mdt-pmrow");
    row.appendChild(el("span", "mdt-pmk", k));
    row.appendChild(el("span", "mdt-pmv", v));
    return row;
  }

  /**
   * Baris kartu berisi tautan yang dapat diklik.
   * Tautan memakai href + target + rel standar; sebagai jalur yang lebih
   * andal di ekstensi, klik juga mengirim pesan {action:"openUrl"} ke
   * background agar dibuka melalui browser.tabs.create.
   */
  function pmLink(k, href, text) {
    var row = el("div", "mdt-pmrow");
    row.appendChild(el("span", "mdt-pmk", k));
    var a = el("a", "mdt-pma", text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("title", href);
    a.addEventListener("click", function (e) {
      if (EXT && EXT.runtime && EXT.runtime.sendMessage) {
        e.preventDefault();
        try {
          EXT.runtime.sendMessage({ action: "openUrl", url: href });
        } catch (err) {
          try {
            window.open(href, "_blank", "noopener");
          } catch (e2) {}
        }
      }
    });
    row.appendChild(a);
    return row;
  }

  /** Memulai loop FPS. */
  function startFps() {
    if (fpsRaf !== null) return;
    fpsFrames = 0;
    fpsLast = performance.now();
    var loop = function (t) {
      fpsFrames++;
      if (t - fpsLast >= 500) {
        var fps = Math.round((fpsFrames * 1000) / (t - fpsLast));
        if (fpsBigEl) fpsBigEl.textContent = String(fps);
        if (fpsBarEl) fpsBarEl.style.width = Math.min(100, Math.round((fps / 60) * 100)) + "%";
        fpsFrames = 0;
        fpsLast = t;
      }
      fpsRaf = requestAnimationFrame(loop);
    };
    fpsRaf = requestAnimationFrame(loop);
  }

  /** Menghentikan loop FPS. */
  function stopFps() {
    if (fpsRaf !== null) {
      cancelAnimationFrame(fpsRaf);
      fpsRaf = null;
    }
  }

  /* ==================================================================
     BAGIAN 14 - Panel APLIKASI (penyimpanan)
     ================================================================== */

  var APP_ITEMS = [
    ["localStorage", "localStorage"],
    ["sessionStorage", "sessionStorage"],
    ["cookies", "Cookie"],
    ["indexedDB", "IndexedDB"],
    ["cache", "Cache Storage"]
  ];

  function buildStorage(panel) {
    var outer = el("div");
    outer.id = "mdt-app-outer";

    appNavEl = el("div");
    appNavEl.id = "mdt-app-nav";
    appNavEl.appendChild(el("div", "mdt-app-section-hdr", "Penyimpanan"));
    for (var i = 0; i < APP_ITEMS.length; i++) {
      (function (item) {
        var nav = el("div", "mdt-app-nav-item" + (item[0] === appCurrentStore ? " sel" : ""));
        nav.setAttribute("data-store", item[0]);
        nav.appendChild(el("span", "nav-icon", ">"));
        nav.appendChild(el("span", null, item[1]));
        nav.addEventListener("click", function () {
          appCurrentStore = item[0];
          var all = appNavEl.querySelectorAll(".mdt-app-nav-item");
          for (var k = 0; k < all.length; k++) all[k].classList.toggle("sel", all[k] === nav);
          renderAppTable();
        });
        appNavEl.appendChild(nav);
      })(APP_ITEMS[i]);
    }
    outer.appendChild(appNavEl);

    var detail = el("div");
    detail.id = "mdt-app-detail";

    var mobToggle = el("div");
    mobToggle.id = "mdt-app-mob-toggle";
    mobToggle.textContent = "Tampilkan/sembunyikan daftar penyimpanan";
    mobToggle.addEventListener("click", function () {
      appNavOpen = !appNavOpen;
      appNavEl.classList.toggle("mobile-open", appNavOpen);
    });
    detail.appendChild(mobToggle);

    var tb = el("div");
    tb.id = "mdt-app-toolbar";
    appFilterEl = el("input");
    appFilterEl.id = "mdt-app-filter";
    appFilterEl.setAttribute("placeholder", "Saring kunci");
    appFilterEl.addEventListener("input", applyAppFilter);
    tb.appendChild(appFilterEl);

    var refreshBtn = el("button", "mdt-app-tbtn", "Muat ulang");
    refreshBtn.type = "button";
    refreshBtn.addEventListener("click", renderAppTable);
    tb.appendChild(refreshBtn);

    var clearBtn = el("button", "mdt-app-tbtn danger", "Hapus semua");
    clearBtn.type = "button";
    clearBtn.addEventListener("click", clearCurrentStore);
    tb.appendChild(clearBtn);
    detail.appendChild(tb);

    appTableWrapEl = el("div");
    appTableWrapEl.id = "mdt-app-table-wrap";
    detail.appendChild(appTableWrapEl);

    appPreviewEl = el("div");
    appPreviewEl.id = "mdt-app-preview";
    appPreviewEl.classList.add("hidden");
    detail.appendChild(appPreviewEl);

    outer.appendChild(detail);
    panel.appendChild(outer);

    renderAppTable();
  }

  /** Memuat dan menampilkan data penyimpanan sesuai jenis terpilih. */
  function renderAppTable() {
    appData = [];
    appTableWrapEl.textContent = "";
    if (appPreviewEl) {
      appPreviewEl.textContent = "";
      appPreviewEl.classList.add("hidden");
    }

    if (appCurrentStore === "localStorage" || appCurrentStore === "sessionStorage") {
      readWebStorage(appCurrentStore);
    } else if (appCurrentStore === "cookies") {
      readCookies();
    } else if (appCurrentStore === "indexedDB") {
      readIndexedDB();
      return;
    } else if (appCurrentStore === "cache") {
      readCaches();
      return;
    }
    paintAppTable();
  }

  /** Membaca localStorage / sessionStorage. */
  function readWebStorage(store) {
    var s;
    try {
      s = store === "sessionStorage" ? window.sessionStorage : window.localStorage;
    } catch (e) {
      return;
    }
    if (!s) return;
    for (var i = 0; i < s.length; i++) {
      var key = s.key(i);
      appData.push({ key: key, value: s.getItem(key) });
    }
  }

  /** Membaca cookie dari document.cookie. */
  function readCookies() {
    var raw = document.cookie || "";
    if (!raw) return;
    var parts = raw.split(";");
    for (var i = 0; i < parts.length; i++) {
      var idx = parts[i].indexOf("=");
      var k = idx >= 0 ? parts[i].slice(0, idx).trim() : parts[i].trim();
      var v = idx >= 0 ? parts[i].slice(idx + 1).trim() : "";
      if (k) appData.push({ key: k, value: v });
    }
  }

  /** Membaca daftar database IndexedDB (bila API tersedia). */
  function readIndexedDB() {
    if (!window.indexedDB || !indexedDB.databases) {
      renderAppEmpty("IndexedDB", "API tidak tersedia atau tidak didukung.");
      return;
    }
    var p;
    try {
      p = indexedDB.databases();
    } catch (e) {
      renderAppEmpty("IndexedDB", "Tidak dapat mengakses daftar database.");
      return;
    }
    if (!p || !p.then) {
      renderAppEmpty("IndexedDB", "API tidak mengembalikan daftar.");
      return;
    }
    p.then(function (dbs) {
      for (var i = 0; i < dbs.length; i++) {
        appData.push({ key: dbs[i].name, value: "versi " + dbs[i].version });
      }
      paintAppTable();
    }).catch(function () {
      renderAppEmpty("IndexedDB", "Gagal membaca daftar database.");
    });
  }

  /** Membaca daftar Cache Storage (bila API tersedia). */
  function readCaches() {
    if (!window.caches || !window.caches.keys) {
      renderAppEmpty("Cache Storage", "API tidak tersedia.");
      return;
    }
    var p;
    try {
      p = caches.keys();
    } catch (e) {
      renderAppEmpty("Cache Storage", "Tidak dapat mengakses cache.");
      return;
    }
    if (!p || !p.then) {
      renderAppEmpty("Cache Storage", "API tidak mengembalikan daftar.");
      return;
    }
    p.then(function (keys) {
      for (var i = 0; i < keys.length; i++) appData.push({ key: keys[i], value: "cache" });
      paintAppTable();
    }).catch(function () {
      renderAppEmpty("Cache Storage", "Gagal membaca daftar cache.");
    });
  }

  /** Menampilkan pesan kosong pada area tabel. */
  function renderAppEmpty(title, sub) {
    appTableWrapEl.textContent = "";
    var box = el("div", "mdt-app-empty");
    box.appendChild(el("div", "mdt-app-empty-icon", "i"));
    box.appendChild(el("div", "mdt-app-empty-title", title));
    box.appendChild(el("div", "mdt-app-empty-sub", sub));
    appTableWrapEl.appendChild(box);
  }

  /** Menggambar tabel data penyimpanan. */
  function paintAppTable() {
    appTableWrapEl.textContent = "";
    if (!appData.length) {
      renderAppEmpty("Tidak ada data", "Penyimpanan " + labelForStore(appCurrentStore) + " kosong.");
      return;
    }
    var table = el("table", "mdt-app-table");
    var thead = el("thead");
    var hrow = el("tr");
    hrow.appendChild(el("th", null, "Kunci"));
    hrow.appendChild(el("th", null, "Nilai"));
    hrow.appendChild(el("th", null, "Aksi"));
    thead.appendChild(hrow);
    table.appendChild(thead);

    var tbody = el("tbody");
    for (var i = 0; i < appData.length; i++) {
      (function (item) {
        var tr = el("tr");
        tr.appendChild(el("td", null, item.key));
        var vtd = el("td", null, item.value === null || item.value === undefined ? "" : String(item.value));
        vtd.setAttribute("title", item.value || "");
        tr.appendChild(vtd);
        var atd = el("td");
        var del = el("button", "mdt-app-tbtn danger", "Hapus");
        del.type = "button";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteAppItem(item.key);
        });
        atd.appendChild(del);
        tr.appendChild(atd);

        tr.addEventListener("click", function () {
          showAppPreview(item);
          var all = tbody.querySelectorAll("tr");
          for (var k = 0; k < all.length; k++) all[k].classList.toggle("sel", all[k] === tr);
        });
        tbody.appendChild(tr);
      })(appData[i]);
    }
    table.appendChild(tbody);
    appTableWrapEl.appendChild(table);
  }

  function labelForStore(s) {
    for (var i = 0; i < APP_ITEMS.length; i++) if (APP_ITEMS[i][0] === s) return APP_ITEMS[i][1];
    return s;
  }

  /** Menampilkan pratinjau nilai pada panel bawah. */
  function showAppPreview(item) {
    if (!appPreviewEl) return;
    appPreviewEl.classList.remove("hidden");
    appPreviewEl.textContent = "";
    appPreviewEl.appendChild(el("div", "mdt-dsec", item.key));
    appPreviewEl.appendChild(el("div", "mdt-dv", String(item.value === null || item.value === undefined ? "" : item.value)));
  }

  /** Menghapus satu item penyimpanan. */
  function deleteAppItem(key) {
    try {
      if (appCurrentStore === "localStorage") localStorage.removeItem(key);
      else if (appCurrentStore === "sessionStorage") sessionStorage.removeItem(key);
      else if (appCurrentStore === "cookies") {
        document.cookie = key + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      } else if (appCurrentStore === "indexedDB" && window.indexedDB) {
        indexedDB.deleteDatabase(key);
      } else if (appCurrentStore === "cache" && window.caches) {
        caches.delete(key);
      }
    } catch (e) {}
    renderAppTable();
  }

  /** Mengosongkan penyimpanan yang sedang aktif. */
  function clearCurrentStore() {
    try {
      if (appCurrentStore === "localStorage") localStorage.clear();
      else if (appCurrentStore === "sessionStorage") sessionStorage.clear();
      else if (appCurrentStore === "cookies") {
        var raw = document.cookie.split(";");
        for (var i = 0; i < raw.length; i++) {
          var k = raw[i].split("=")[0].trim();
          if (k) document.cookie = k + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      }
    } catch (e) {}
    renderAppTable();
  }

  /** Menyaring baris tabel penyimpanan. */
  function applyAppFilter() {
    if (!appTableWrapEl || !appFilterEl) return;
    var q = appFilterEl.value.toLowerCase();
    var rows = appTableWrapEl.querySelectorAll("tbody tr");
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.display = !q || rows[i].textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
    }
  }

  /* ==================================================================
     BAGIAN 15 - Panel PERANGKAT (ua)
     ================================================================== */

  function buildDevice(panel) {
    uaScrollEl = el("div");
    uaScrollEl.id = "mdt-ua-scroll";
    panel.appendChild(uaScrollEl);
    renderDevice();
  }

  /** Menyusun daftar informasi perangkat. */
  function renderDevice() {
    if (!uaScrollEl) return;
    uaScrollEl.textContent = "";

    var scr = window.screen || {};
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    var rows = [
      ["Agen pengguna (UA)", navigator.userAgent || "-"],
      ["Platform", navigator.platform || "-"],
      ["Bahasa", (navigator.language || "-") + " (" + (navigator.languages ? navigator.languages.join(", ") : "-") + ")"],
      ["Resolusi layar", (scr.width || "?") + " x " + (scr.height || "?")],
      ["Viewport", window.innerWidth + " x " + window.innerHeight],
      ["Pixel rasio (DPR)", String(window.devicePixelRatio || 1)],
      ["Orientasi", (scr.orientation && scr.orientation.type) || (window.innerWidth > window.innerHeight ? "landscape" : "portrait")],
      ["Koneksi", conn ? (conn.effectiveType || "-") + " / " + (conn.downlink || "-") + " Mbps" : "tidak tersedia"],
      ["Jumlah CPU", navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : "tidak diketahui"],
      ["Memori perangkat", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "tidak diketahui"],
      ["Status daring", navigator.onLine ? "daring" : "luring"],
      ["Cookie aktif", navigator.cookieEnabled ? "ya" : "tidak"]
    ];

    for (var i = 0; i < rows.length; i++) {
      var row = el("div", "mdt-uarow");
      row.appendChild(el("span", "mdt-uaicon", "i"));
      var body = el("div");
      body.appendChild(el("div", "mdt-ualbl", rows[i][0]));
      body.appendChild(el("div", "mdt-uaval", rows[i][1]));
      row.appendChild(body);
      uaScrollEl.appendChild(row);
    }
  }

  /* ==================================================================
     BAGIAN 16 - Panel TENTANG (dahulu PANDUAN)
     ================================================================== */

  function buildAbout(panel) {
    aboutScrollEl = el("div");
    /* Id lama "mdt-guide-scroll" dipertahankan agar gaya #mdt-guide-* yang
       ada tetap berlaku pada panel Tentang ini. */
    aboutScrollEl.id = "mdt-guide-scroll";

    /* Bagian pembuka. */
    var hero = el("div", "mdt-guide-hero");
    hero.appendChild(el("div", "mdt-guide-hero-title", "NT DevTools"));
    hero.appendChild(el("div", "mdt-guide-hero-sub", "Konsol pengembang web untuk debugging dan inspeksi website di Android (Firefox)."));
    aboutScrollEl.appendChild(hero);

    /* Kartu informasi aplikasi. */
    var about = el("div", "mdt-pcard mdt-about-card");
    about.appendChild(el("h4", null, "Tentang"));
    about.appendChild(pmRow("Aplikasi", "NT DevTools"));
    about.appendChild(pmRow("Versi", "1.0.0"));
    about.appendChild(pmRow("Deskripsi", "Konsol pengembang web untuk debugging dan inspeksi website di Android (Firefox)."));
    about.appendChild(pmRow("Penulis", "NT Dev"));
    about.appendChild(pmLink("GitHub penulis", "https://github.com/nt-portal", "nt-portal"));
    about.appendChild(pmRow("Lisensi", "MIT"));
    about.appendChild(pmLink("Sumber", "https://github.com/nt-portal/NTDev-Tools.git", "nt-portal/NTDev-Tools"));
    about.appendChild(pmRow("Kredit", "Terinspirasi Eruda"));
    about.appendChild(pmLink("Eruda", "https://github.com/liriliri/eruda", "liriliri/eruda"));
    aboutScrollEl.appendChild(about);

    /* Panduan singkat - mempertahankan langkah pemakaian panel lama. */
    aboutScrollEl.appendChild(el("div", "mdt-about-section-title", "Panduan singkat"));
    var steps = el("div", "mdt-guide-steps");
    var defs = [
      ["Buka dan tutup panel", "Tab", "Gunakan ikon ekstensi di bilah alat, atau tombol mengambang (FAB) di kanan bawah bila panel tertutup. Tombol Tutup ada di paling kanan topbar."],
      ["Inspeksi elemen (Elemen)", "Tab", "Tekan tombol Pilih lalu sentuh elemen di halaman untuk memilihnya. Pohon DOM, breadcrumb, gaya Styles, dan Computed akan mengikuti elemen terpilih."],
      ["Menjalankan kode (Konsol)", "Tab", "Semua console.log/info/warn/error tampil di sini. Tulis ekspresi di baris REPL di bawah lalu Enter. Gunakan $0 untuk elemen terpilih."],
      ["Melihat sumber (Sumber)", "Tab", "Daftar skrip dan gaya halaman ada di kiri. Tombol Perindah merapikan kode. Sub-tab Cuplikan menyimpan skrip siap jalan."],
      ["Memantau jaringan (Jaringan)", "Tab", "Permintaan HTTP/HTTPS tampil sebagai baris. Klik satu baris untuk melihat Header, Payload, dan Respons."],
      ["Mengukur kinerja (Kinerja)", "Tab", "Meter FPS berjalan saat kartu dibuka, disertai metrik navigasi, memori, dan jumlah node DOM."],
      ["Menyimpan data (Aplikasi)", "Tab", "Telusuri localStorage, sessionStorage, cookie, IndexedDB, dan Cache Storage. Hapus kunci satu per satu atau seluruhnya."],
      ["Mengenali perangkat (Perangkat)", "Tab", "Ringkasan UA, platform, bahasa, resolusi, DPR, orientasi, koneksi, CPU, memori, dan status daring."]
    ];

    for (var i = 0; i < defs.length; i++) {
      steps.appendChild(makeGuideStep(i + 1, defs[i][0], defs[i][1], defs[i][2]));
    }
    aboutScrollEl.appendChild(steps);

    /* Progres langkah. */
    loadGuideProgress();
    var prog = el("div", "mdt-guide-progress");
    prog.appendChild(el("div", "mdt-guide-prog-label", "Progres eksplorasi modul"));
    var track = el("div", "mdt-guide-prog-bar");
    var fill = el("div", "mdt-guide-prog-fill");
    fill.id = "mdt-guide-prog-fill";
    track.appendChild(fill);
    prog.appendChild(track);
    aboutScrollEl.appendChild(prog);
    updateGuideProgress();

    panel.appendChild(aboutScrollEl);
  }

  /** Membuat satu langkah panduan yang bisa dibuka-tutup. */
  function makeGuideStep(num, title, tag, desc) {
    var step = el("div", "mdt-guide-step");
    step.setAttribute("data-guide", String(num));

    var hdr = el("div", "mdt-guide-step-hdr");
    hdr.appendChild(el("span", "mdt-guide-step-num", String(num)));
    hdr.appendChild(el("span", "mdt-guide-step-title", title));
    var tagEl = el("span", "mdt-guide-step-tag", tag);
    hdr.appendChild(tagEl);
    hdr.appendChild(el("span", "mdt-guide-step-arrow", "+"));
    step.appendChild(hdr);

    var body = el("div", "mdt-guide-step-body");
    body.appendChild(el("div", "mdt-guide-desc", desc));
    var hint = el("div", "mdt-guide-tip");
    hint.appendChild(el("span", "mdt-guide-tip-icon", "i"));
    hint.appendChild(el("span", null, "Tip: modul dapat diakses kapan pun dari topbar."));
    body.appendChild(hint);
    step.appendChild(body);

    hdr.addEventListener("click", function () {
      var open = step.classList.toggle("open");
      var arrow = hdr.querySelector(".mdt-guide-step-arrow");
      if (arrow) arrow.textContent = open ? "-" : "+";
      if (open) {
        guideDone[num] = true;
        persistGuideProgress();
        updateGuideProgress();
      }
    });

    return step;
  }

  function guideKey() {
    return "mdt_guide_progress_v1";
  }
  function loadGuideProgress() {
    try {
      var raw = localStorage.getItem(guideKey());
      if (raw) guideDone = JSON.parse(raw) || {};
    } catch (e) {
      guideDone = {};
    }
  }
  function persistGuideProgress() {
    try {
      localStorage.setItem(guideKey(), JSON.stringify(guideDone));
    } catch (e) {}
  }
  function updateGuideProgress() {
    var fill = document.getElementById("mdt-guide-prog-fill");
    if (!fill) return;
    var total = 8;
    var done = 0;
    for (var k in guideDone) if (Object.prototype.hasOwnProperty.call(guideDone, k) && guideDone[k]) done++;
    fill.style.width = Math.min(100, Math.round((done / total) * 100)) + "%";
  }

  /* ==================================================================
     BAGIAN 16b - Panel PENGATURAN
     Mengelola preferensi tampilan, daftar panel aktif, dan perilaku
     panel Konsol. Semua perubahan diterapkan seketika dan disimpan.
     ================================================================== */

  /** Membuat kartu kelompok pengaturan. */
  function settingsGroup(title) {
    var card = el("div", "mdt-pcard mdt-set-group");
    card.appendChild(el("div", "mdt-set-group-title", title));
    return card;
  }

  /** Baris pengaturan sederhana dengan label di kiri. */
  function settingsRow(label) {
    var row = el("div", "mdt-set-row");
    if (label) row.appendChild(el("span", "mdt-set-lbl", label));
    return row;
  }

  /** Baris dengan kontrol geser (slider) + tampilan nilai. */
  function settingsSlider(label, min, max, step, value, onInput, format) {
    var row = settingsRow(label);
    var val = el("span", "mdt-set-val", format(value));
    row.firstChild.appendChild(val);
    var range = el("input", "mdt-set-range");
    range.type = "range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.addEventListener("input", function () {
      var v = parseFloat(range.value);
      val.textContent = format(v);
      onInput(v);
    });
    row.appendChild(range);
    return { row: row, input: range, valueEl: val, format: format };
  }

  /** Baris dengan sakelar kotak centang. */
  function settingsCheck(label, checked, onChange) {
    var lk = el("label", "mdt-set-ck");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!checked;
    cb.addEventListener("change", function () {
      onChange(cb.checked);
    });
    lk.appendChild(cb);
    lk.appendChild(el("span", null, label));
    return { row: lk, input: cb };
  }

  /** Baris dengan masukan angka. */
  function settingsNumber(label, min, max, value, onChange) {
    var row = settingsRow(label);
    var num = el("input", "mdt-set-num");
    num.type = "number";
    num.min = String(min);
    num.max = String(max);
    num.value = String(value);
    num.addEventListener("change", function () {
      var v = clampNum(num.value, min, max, value);
      num.value = String(v);
      onChange(v);
    });
    row.appendChild(num);
    return { row: row, input: num };
  }

  function buildSettings(panel) {
    settingsScrollEl = el("div");
    settingsScrollEl.id = "mdt-settings-scroll";

    settingsEls = { panels: {}, console: {}, network: {} };

    /* --- 1. TAMPILAN --- */
    var gTampil = settingsGroup("Tampilan");

    /* Tema: kendali bersegmen Gelap / Terang. */
    var themeRow = settingsRow("Tema");
    var seg = el("div", "mdt-seg");
    var btnDark = el("button", "mdt-seg-btn", "Gelap");
    var btnLight = el("button", "mdt-seg-btn", "Terang");
    btnDark.type = "button";
    btnLight.type = "button";
    function markTheme() {
      btnDark.classList.toggle("on", settings.theme === "dark");
      btnLight.classList.toggle("on", settings.theme === "light");
    }
    btnDark.addEventListener("click", function () {
      settings.theme = "dark";
      markTheme();
      applySettings();
      saveSettings();
    });
    btnLight.addEventListener("click", function () {
      settings.theme = "light";
      markTheme();
      applySettings();
      saveSettings();
    });
    seg.appendChild(btnDark);
    seg.appendChild(btnLight);
    themeRow.appendChild(seg);
    settingsEls.themeMark = markTheme;
    gTampil.appendChild(themeRow);

    /* Transparansi panel. */
    var op = settingsSlider("Transparansi panel", 0.5, 1, 0.01, settings.opacity, function (v) {
      settings.opacity = v;
      applySettings();
      saveSettings();
    }, function (v) {
      return Math.round(v * 100) + "%";
    });
    settingsEls.opacity = op;
    gTampil.appendChild(op.row);

    /* Tinggi panel. */
    var hg = settingsSlider("Tinggi panel", 30, 95, 1, settings.heightVh, function (v) {
      settings.heightVh = v;
      applySettings();
      saveSettings();
    }, function (v) {
      return Math.round(v) + "vh";
    });
    settingsEls.height = hg;
    gTampil.appendChild(hg.row);

    /* Ukuran font panel. */
    var fs = settingsSlider("Ukuran font panel", 10, 16, 1, settings.fontSize, function (v) {
      settings.fontSize = v;
      applySettings();
      saveSettings();
    }, function (v) {
      return Math.round(v) + "px";
    });
    settingsEls.fontSize = fs;
    gTampil.appendChild(fs.row);

    settingsScrollEl.appendChild(gTampil);

    /* --- 2. PANEL --- */
    var gPanel = settingsGroup("Panel");
    gPanel.appendChild(el("div", "mdt-set-hint", "Matikan panel yang tidak dipakai. Tab Pengaturan selalu aktif dan minimal satu panel harus tetap aktif."));
    for (var pi = 0; pi < CONFIG_PANELS.length; pi++) {
      (function (id) {
        var ck = settingsCheck(TAB_LABELS[id] || id, settings.panels[id], function (v) {
          if (!v) {
            /* Cegah mematikan panel terakhir yang tersisa. */
            var remaining = 0;
            for (var q = 0; q < CONFIG_PANELS.length; q++) {
              if (CONFIG_PANELS[q] !== id && settings.panels[CONFIG_PANELS[q]]) remaining++;
            }
            if (remaining < 1) {
              ck.input.checked = true;
              return;
            }
          }
          settings.panels[id] = v;
          applySettings();
          saveSettings();
        });
        settingsEls.panels[id] = ck;
        ck.input.setAttribute("data-setpanel", id);
        gPanel.appendChild(ck.row);
      })(CONFIG_PANELS[pi]);
    }
    settingsScrollEl.appendChild(gPanel);

    /* --- 3. KONSOL --- */
    var gCon = settingsGroup("Konsol");
    var conItems = [
      ["autoscroll", "Gulir otomatis ke log terbaru"],
      ["timestamps", "Tampilkan waktu"],
      ["groups", "Grup log serupa"],
      ["nonEnum", "Tampilkan properti non-enumerable"],
      ["getters", "Evaluasi getter saat menampilkan objek"],
      ["async", "Render asinkron (batch)"],
      ["regex", "Saring log memakai regex"]
    ];
    for (var ci = 0; ci < conItems.length; ci++) {
      (function (key, label) {
        var ck = settingsCheck(label, settings.console[key], function (v) {
          settings.console[key] = v;
          applyConsoleSettings();
          saveSettings();
        });
        settingsEls.console[key] = ck;
        ck.input.setAttribute("data-setcon", key);
        gCon.appendChild(ck.row);
      })(conItems[ci][0], conItems[ci][1]);
    }
    var lm = settingsNumber("Batas jumlah log", 50, 5000, settings.console.logMax, function (v) {
      settings.console.logMax = v;
      applyConsoleSettings();
      saveSettings();
    });
    settingsEls.logMax = lm;
    gCon.appendChild(lm.row);
    settingsScrollEl.appendChild(gCon);

    /* --- 3b. JARINGAN (FASE 4) --- */
    var gNet = settingsGroup("Jaringan");
    gNet.appendChild(el("div", "mdt-set-hint", "Bila tangkap body respons dimatikan, body tidak diambil sama sekali (permintaan tetap berjalan normal)."));
    var cbBody = settingsCheck("Tangkap body respons", settings.network.captureBody, function (v) {
      settings.network.captureBody = v;
      saveSettings();
    });
    settingsEls.network.captureBody = cbBody;
    cbBody.input.setAttribute("data-setnet", "captureBody");
    gNet.appendChild(cbBody.row);
    settingsScrollEl.appendChild(gNet);

    /* --- 4. KEMBALIKAN PENGATURAN AWAL --- */
    var gReset = el("div", "mdt-set-footer");
    var resetBtn = el("button", "mdt-set-reset", "Kembalikan pengaturan awal");
    resetBtn.type = "button";
    resetBtn.addEventListener("click", function () {
      settings = defaultSettings();
      applySettings();
      saveSettings();
      syncSettingsUI();
    });
    gReset.appendChild(resetBtn);
    settingsScrollEl.appendChild(gReset);

    panel.appendChild(settingsScrollEl);
  }

  /** Menyelaraskan kontrol panel Pengaturan dengan nilai settings terkini. */
  function syncSettingsUI() {
    if (!settingsScrollEl) return;
    try {
      if (settingsEls.themeMark) settingsEls.themeMark();
      if (settingsEls.opacity) {
        settingsEls.opacity.input.value = String(settings.opacity);
        settingsEls.opacity.valueEl.textContent = settingsEls.opacity.format(settings.opacity);
      }
      if (settingsEls.height) {
        settingsEls.height.input.value = String(settings.heightVh);
        settingsEls.height.valueEl.textContent = settingsEls.height.format(settings.heightVh);
      }
      if (settingsEls.fontSize) {
        settingsEls.fontSize.input.value = String(settings.fontSize);
        settingsEls.fontSize.valueEl.textContent = settingsEls.fontSize.format(settings.fontSize);
      }
      for (var i = 0; i < CONFIG_PANELS.length; i++) {
        var id = CONFIG_PANELS[i];
        if (settingsEls.panels[id]) settingsEls.panels[id].input.checked = !!settings.panels[id];
      }
      for (var key in settingsEls.console) {
        if (Object.prototype.hasOwnProperty.call(settingsEls.console, key)) {
          settingsEls.console[key].input.checked = !!settings.console[key];
        }
      }
      if (settingsEls.logMax) settingsEls.logMax.input.value = String(settings.console.logMax);
      if (settingsEls.network && settingsEls.network.captureBody) {
        settingsEls.network.captureBody.input.checked = !!settings.network.captureBody;
      }
    } catch (e) {
      /* abaikan bila antarmuka belum siap */
    }
  }

  /* ==================================================================
     BAGIAN 17 - Pesan runtime dan navigasi halaman
     ================================================================== */

  /** Menangani pesan {action:"navigate"} dari background. */
  function onPageNavigate() {
    if (built.elements) renderDomTree();
    if (built.network) ensureNetInit();
  }

  /* Daftarkan listener pesan runtime dengan guard. */
  if (EXT && EXT.runtime && EXT.runtime.onMessage && EXT.runtime.onMessage.addListener) {
    EXT.runtime.onMessage.addListener(function (msg) {
      if (!msg || typeof msg !== "object") return;
      var action = msg.action;
      if (action === "toggle") setVisible(!isOpen());
      else if (action === "setVisibility") setVisible(!!msg.visible);
      else if (action === "navigate") onPageNavigate(msg.url);
      else if (action === "net") handleNetMessage(msg);
    });
  }

  /* ==================================================================
     BAGIAN 18 - Inisialisasi
     ================================================================== */

  function init() {
    try {
      /* Baca pengaturan lebih dulu (sinkron via localStorage) agar tab yang
         dimatikan tidak sempat tampil sebelum diterapkan. */
      loadSettingsSync();
      applyConsoleSettings();

      injectStyles();
      buildShell();
      applySettings();

      /* FASE 3: pasang pelacak event listener dan pengamat DOM otomatis. */
      installListenerTracker();
      if (domAutoUpdate) startDomObserver();

      /* Panel awal: Elemen (atau panel aktif pertama), tetap tertutup. */
      activateTab(firstEnabledTab());
      setVisible(false);

      /* Selaraskan dengan browser.storage.local bila isinya berbeda. */
      loadSettingsAsync();
      syncSettingsUI();
    } catch (e) {
      /* Jangan sampai kesalahan kecil merusak halaman. */
      if (window.console && console.warn) console.warn("NT DevTools gagal dimuat:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
