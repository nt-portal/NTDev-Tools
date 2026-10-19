/**
 * NT DevTools — Jembatan Dunia Utama (injected.js)
 *
 * Berkas ini SENGAJA dijalankan di dalam konteks halaman (main world), bukan
 * di dunia terisolasi content script. Sebabnya: console.log milik halaman
 * hanya dapat dicegat dari realm yang sama dengan halaman. Hook lama yang
 * berjalan di dunia terisolasi tidak pernah melihat log skrip halaman,
 * sehingga panel konsol tampak kosong.
 *
 * Tugas berkas ini:
 *   1. Mencegat seluruh metode console.* (log, info, warn, error, debug,
 *      table, dir, time, timeLog, timeEnd, assert, count, countReset,
 *      trace, group, groupCollapsed, groupEnd, clear). Fungsi asli tetap
 *      dipanggil agar keluaran normal halaman tidak hilang.
 *   2. Menangkap galat global (window error & unhandledrejection).
 *   3. Menerima perintah evaluasi REPL dari content script dan
 *      menjalankannya di konteks halaman, lalu mengembalikan hasilnya.
 *
 * Komunikasi lewat window.postMessage dengan penanda field "source":
 *   mdt-console       -> entri log/galat dari halaman
 *   mdt-console-ready -> konfirmasi jembatan siap; content script lalu
 *                        melepas hook lokal (fallback) agar tidak ganda
 *   mdt-eval          -> perintah evaluasi dari content script
 *   mdt-eval-result   -> hasil evaluasi dikembalikan ke content script
 *
 * Idempoten: dijaga oleh window.__mdtConsoleHooked.
 */
(function () {
  "use strict";

  if (window.__mdtConsoleHooked) return;
  window.__mdtConsoleHooked = true;

  var READY = "mdt-console-ready";

  /** Waktu sekarang dalam milidetik (performance bila tersedia). */
  function now() {
    try {
      return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    } catch (e) {
      return Date.now();
    }
  }

  /** Normalisasi label pewaktu/penghitung console.*. */
  function label(x) {
    return x === undefined || x === null ? "default" : String(x);
  }

  /**
   * Serialisasi aman sebuah argumen agar lolos structured clone
   * (postMessage tidak dapat mengkloning fungsi/DOM/circular).
   */
  function serialize(v, seen, depth) {
    if (v === null) return null;
    var t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "undefined") return "undefined";
    if (t === "function") return "function " + (v.name || "anonim") + "()";
    if (t === "symbol") return v.toString();
    if (t === "bigint") return v.toString() + "n";
    if (v instanceof Error) return v.stack || (v.name + ": " + v.message);
    if (typeof Node !== "undefined" && v instanceof Node) {
      if (v.nodeType === 1) {
        var tag = v.tagName.toLowerCase();
        if (v.id) tag += "#" + v.id;
        return "<" + tag + ">";
      }
      return v.nodeName;
    }
    if (v instanceof Date) {
      try { return v.toISOString(); } catch (e1) { return String(v); }
    }
    if (v instanceof RegExp) return v.toString();
    if (depth > 4) return "[...]";
    if (seen.indexOf(v) >= 0) return "[Circular]";
    seen = seen.concat([v]);
    if (Array.isArray(v)) {
      var arr = [];
      for (var i = 0; i < v.length && i < 100; i++) {
        try { arr.push(serialize(v[i], seen, depth + 1)); } catch (e2) { arr.push("[tidak dapat diakses]"); }
      }
      if (v.length > 100) arr.push("…+" + (v.length - 100));
      return arr;
    }
    try {
      var out = {};
      var keys = Object.keys(v);
      for (var j = 0; j < keys.length && j < 100; j++) {
        try { out[keys[j]] = serialize(v[keys[j]], seen, depth + 1); } catch (e3) { out[keys[j]] = "[tidak dapat diakses]"; }
      }
      return out;
    } catch (e4) {
      try { return String(v); } catch (e5) { return "[objek]"; }
    }
  }

  /** Serialisasi daftar argumen menjadi bentuk yang aman dikirim. */
  function serializeArgs(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      try { out.push(serialize(args[i], [], 0)); } catch (e) { out.push("[argumen tidak dapat diserialisasi]"); }
    }
    return out;
  }

  /** Jejak tumpukan tanpa bingkai internal jembatan ini. */
  function stack() {
    try {
      var s = (new Error()).stack || "";
      var lines = s.split("\n");
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln || ln === "Error" || ln.indexOf("Error:") === 0) continue;
        if (ln.indexOf("injected.js") >= 0) continue;
        out.push(ln);
        if (out.length >= 12) break;
      }
      return out.join("\n");
    } catch (e) {
      return "";
    }
  }

  /** Mengirim satu entri ke content script di dunia terisolasi. */
  function emit(method, args, stk) {
    try {
      window.postMessage({
        source: "mdt-console",
        method: method,
        args: serializeArgs(args || []),
        stack: stk || ""
      }, "*");
    } catch (e) {}
  }

  var timers = {};
  var counts = {};

  /** Menangani satu pemanggilan console.* (setelah output asli diteruskan). */
  function handle(method, args) {
    switch (method) {
      case "table":
        emit("log", ["Tabel:"].concat(args), stack());
        return;
      case "dir":
        emit("log", args, stack());
        return;
      case "time":
        timers[label(args[0])] = now();
        return;
      case "timeLog": {
        var k1 = label(args[0]);
        var e1 = timers[k1] === undefined ? 0 : Math.round((now() - timers[k1]) * 1000) / 1000;
        emit("log", [k1 + ": " + e1 + " ms"].concat(args.slice(1)), stack());
        return;
      }
      case "timeEnd": {
        var k2 = label(args[0]);
        var e2 = timers[k2] === undefined ? 0 : Math.round((now() - timers[k2]) * 1000) / 1000;
        delete timers[k2];
        emit("log", [k2 + ": " + e2 + " ms"], stack());
        return;
      }
      case "count": {
        var k3 = label(args[0]);
        counts[k3] = (counts[k3] || 0) + 1;
        emit("log", [k3 + ": " + counts[k3]], stack());
        return;
      }
      case "countReset":
        counts[label(args[0])] = 0;
        return;
      case "assert": {
        var truthy = true;
        try { truthy = !!args[0]; } catch (e) { truthy = false; }
        if (!truthy) emit("error", ["Assertion gagal:"].concat(args.slice(1)), stack());
        return;
      }
      case "trace":
        emit("trace", args, stack());
        return;
      case "group":
      case "groupCollapsed":
        emit(method, args.length ? args : ["Grup"], stack());
        return;
      case "groupEnd":
        emit("groupEnd", [], "");
        return;
      case "clear":
        emit("clear", [], "");
        return;
      default:
        emit(method, args, method === "error" || method === "warn" ? stack() : "");
    }
  }

  /* Pasang pencegat pada seluruh metode console yang relevan. */
  var METHODS = [
    "log", "info", "warn", "error", "debug", "table", "dir",
    "time", "timeLog", "timeEnd", "assert", "count", "countReset",
    "trace", "group", "groupCollapsed", "groupEnd", "clear"
  ];
  for (var i = 0; i < METHODS.length; i++) {
    (function (method) {
      var native = typeof console[method] === "function" ? console[method].bind(console) : function () {};
      console[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        /* Teruskan ke console asli agar keluaran normal halaman tetap tampil. */
        try { native.apply(null, args); } catch (e) {}
        try { handle(method, args); } catch (e2) {}
      };
    })(METHODS[i]);
  }

  /* Tangkap galat global dan promise yang ditolak. */
  window.addEventListener("error", function (event) {
    try {
      var msg = event && event.message ? event.message : String(event);
      var loc = event && event.filename ? (event.filename + ":" + event.lineno) : "";
      var stk = event && event.error && event.error.stack ? event.error.stack : stack();
      window.postMessage({
        source: "mdt-console",
        method: "error",
        args: serializeArgs(["Uncaught Error: " + msg, loc]),
        stack: stk
      }, "*");
    } catch (e) {}
  });
  window.addEventListener("unhandledrejection", function (event) {
    try {
      var r = event && event.reason;
      var stk = r && r.stack ? r.stack : stack();
      window.postMessage({
        source: "mdt-console",
        method: "error",
        args: serializeArgs(["Unhandled promise rejection:", r]),
        stack: stk
      }, "*");
    } catch (e) {}
  });

  /* Terima perintah evaluasi REPL dari content script. */
  window.addEventListener("message", function (event) {
    var data = event && event.data;
    if (!data) return;

    // Handler baru sesuai spesifikasi: type === 'mdt-eval'
    if (data.type === "mdt-eval") {
      if (data.id != null && typeof data.code === "string") {
        try {
          var res = (0, eval)(data.code);
          try {
            window.postMessage({ type: "mdt-eval-result", id: data.id, result: res }, "*");
          } catch (e) {
            try {
              window.postMessage({ type: "mdt-eval-result", id: data.id, error: e && e.message ? e.message : String(e) }, "*");
            } catch (e2) {}
          }
        } catch (err) {
          try {
            window.postMessage({ type: "mdt-eval-result", id: data.id, error: err && err.message ? err.message : String(err) }, "*");
          } catch (e3) {}
        }
      }
      return;
    }

    if (data.source !== "mdt-eval") return;
    runEval(data.id, String(data.code == null ? "" : data.code), data.sel);
  });

  /** Menjalankan kode REPL di konteks halaman lalu mengembalikan hasilnya. */
  function runEval(id, code, sel) {
    var ok = true;
    var value;
    var errText = "";
    var sel0 = null;
    try { if (sel) sel0 = document.querySelector(sel); } catch (e) {}

    var helpers = {
      $0: sel0,
      $_: window.__mdtLastResult,
      $: function (s) { try { return document.querySelector(s); } catch (e) { return null; } },
      $$: function (s) { try { return Array.prototype.slice.call(document.querySelectorAll(s)); } catch (e) { return []; } }
    };

    try {
      var fnExpr = new Function("$0", "$_", "$", "$$", "return (" + code + "\n);");
      value = fnExpr(helpers.$0, helpers.$_, helpers.$, helpers.$$);
    } catch (e) {
      try {
        var fnBlock = new Function("$0", "$_", "$", "$$", code + "\n; return undefined;");
        value = fnBlock(helpers.$0, helpers.$_, helpers.$, helpers.$$);
      } catch (e2) {
        ok = false;
        errText = String(e2 && e2.stack ? e2.stack : e2);
      }
    }
    if (ok) {
      try { window.__mdtLastResult = value; } catch (e) {}
    }

    var result;
    try { result = serialize(value, [], 0); } catch (e) { result = "[hasil tidak dapat diserialisasi]"; }
    try {
      window.postMessage({ source: "mdt-eval-result", id: id, ok: ok, result: result, error: errText }, "*");
    } catch (e3) {
      try {
        window.postMessage({ source: "mdt-eval-result", id: id, ok: false, result: null, error: String(e3) }, "*");
      } catch (e4) {}
    }
  }

  /* Beri tahu content script bahwa jembatan siap; hook lokal lalu dilepas. */
  try { window.postMessage({ source: READY }, "*"); } catch (e) {}
})();
