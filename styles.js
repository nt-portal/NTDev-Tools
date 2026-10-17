/**
 * NTDev Tools v3 - Modul gaya (Styles)
 *
 * Tujuan modul: menghasilkan SELURUH CSS antarmuka DevTools sebagai satu
 * string, agar berkas contentScript.js tetap ringkas dan gaya dapat dibaca
 * serta dirawat secara terpisah. Gaya ini mencakup root panel, bilah tab,
 * toolbar, panel Console/Network/Elements/Sources/Performance/Application/
 * Device/Guide, tombol melayang (FAB), serta lapisan inspeksi.
 *
 * Ekspor ke window:
 *   window.MDT_STYLES(IS_MOBILE, IS_FF_MOBILE) -> string CSS
 *     - IS_MOBILE    : true bila perangkat seluler; mengubah ukuran target
 *                      sentuh, tinggi tab/toolbar, dan tinggi minimal panel.
 *     - IS_FF_MOBILE : true bila Firefox di seluler; menyesuaikan tinggi panel,
 *                      safe-area bawah, dan tata letak khusus Firefox Mobile.
 *
 * Catatan pemakaian: panggil sekali saat bootstrap lalu suntikkan hasilnya ke
 * sebuah elemen <style>. Modul ini idempoten - bila window.MDT_STYLES sudah
 * terpasang, fungsi tidak didefinisikan ulang.
 */
"use strict";

(function () {
  if (window.MDT_STYLES) return;
  window.MDT_STYLES = function (IS_MOBILE, IS_FF_MOBILE) {
    return `
  /* ==================================================================
     TOKEN DESAIN
     Variabel di-scope ke elemen akar antarmuka (BUKAN :root) agar tidak
     merembes ke halaman inang. Beberapa elemen berada DI LUAR #mdt-root
     (#mdt-fab, #mdt-iov, #mdt-ihl, #mdt-itip, #mdt-pick-cursor) serta menu
     konteks (#mdt-ctx-menu) yang dipasang di documentElement; semuanya
     disertakan pada selector gabungan di bawah agar variabel tetap tersedia.
     ================================================================== */
  #mdt-root,
  #mdt-fab,
  #mdt-iov,
  #mdt-ihl,
  #mdt-itip,
  #mdt-pick-cursor,
  #mdt-ctx-menu {
    /* Latar berlapis: makin besar angkanya makin terang */
    --bg:       #1d1d20;
    --bg1:      #242428;
    --bg2:      #2c2c32;
    --bg3:      #36363d;
    /* Garis pemisah */
    --bdr:      rgba(255,255,255,.09);
    --bdr-soft: rgba(255,255,255,.055);
    --bdr-strong: rgba(255,255,255,.16);
    /* Warna aksen dan status */
    --acc:      #569cd6;
    --acc-soft: rgba(86,156,214,.14);
    --grn:      #4ec9b0;
    --yel:      #ce9178;
    --red:      #f44747;
    --pur:      #c586c0;
    --org:      #d7ba7d;
    --info:     #9cdcfe;
    --warn-bg:  rgba(206,145,120,.09);
    --err-bg:   rgba(244,71,71,.09);
    /* Teks */
    --wht:      #e6e6e8;
    --dim:      #9a9aa3;
    --dim2:     #6f6f78;
    /* Tipografi */
    --mono:     'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace;
    --ui:       system-ui,-apple-system,sans-serif;
    /* Metrik tetap */
    --tab-h:    30px;
    --tb-h:     28px;
    /* Target sentuh untuk perangkat seluler */
    --touch:    ${IS_MOBILE ? "40px" : "28px"};
    --touch-sm: ${IS_MOBILE ? "36px" : "22px"};
    /* Tinggi seragam untuk kontrol (tombol, input, select) */
    --ctl:      ${IS_MOBILE ? "30px" : "22px"};
    /* Sudut, durasi, dan bayangan */
    --r-sm:     3px;
    --r:        4px;
    --r-lg:     6px;
    --dur:      .14s;
    --ease:     cubic-bezier(.4,0,.2,1);
    --shadow-1: 0 1px 2px rgba(0,0,0,.35);
    --shadow-2: 0 10px 30px rgba(0,0,0,.55);
  }

  /* Tema terang: kelas .mdt-light ditambahkan ke #mdt-root oleh panel
     Pengaturan. Hanya token yang di-override agar seluruh antarmuka ikut
     berubah tanpa menyentuh tata letak. */
  #mdt-root.mdt-light {
    --bg:       #f4f4f7;
    --bg1:      #ffffff;
    --bg2:      #ececf1;
    --bg3:      #e0e0e8;
    --bdr:      rgba(0,0,0,.12);
    --bdr-soft: rgba(0,0,0,.07);
    --bdr-strong: rgba(0,0,0,.20);
    --acc:      #2f6fb5;
    --acc-soft: rgba(47,111,181,.14);
    --grn:      #2f8f6f;
    --yel:      #b06a1f;
    --red:      #c0392b;
    --pur:      #8e44ad;
    --org:      #b07a2a;
    --info:     #2f6fb5;
    --warn-bg:  rgba(176,106,31,.10);
    --err-bg:   rgba(192,57,43,.10);
    --wht:      #1d1d22;
    --dim:      #61616e;
    --dim2:     #8b8b98;
    --shadow-1: 0 1px 2px rgba(0,0,0,.12);
    --shadow-2: 0 10px 30px rgba(0,0,0,.22);
  }
  /* Penyesuaian khusus tema terang untuk elemen dengan warna tetap. */
  #mdt-root.mdt-light .mdt-tab.on { color:var(--acc); }
  #mdt-root.mdt-light .mdt-guide-hero {
    background:linear-gradient(135deg,#e3edfb 0%,#f4f4f7 100%);
  }
  #mdt-root.mdt-light .mdt-guide-step-num { color:#fff; }
  #mdt-root.mdt-light .mdt-ac-item:hover,
  #mdt-root.mdt-light .mdt-ac-item.sel { color:#fff; }

  /* ==================================================================
     DASAR
     ================================================================== */
  #mdt-root,
  #mdt-root *,
  #mdt-fab,
  #mdt-fab *,
  #mdt-pick-cursor,
  #mdt-pick-cursor *,
  #mdt-ctx-menu,
  #mdt-ctx-menu * { box-sizing:border-box; }

  /* Bilah gulir seragam di dalam panel (tidak menyentuh halaman inang) */
  #mdt-root,
  #mdt-root * { scrollbar-width:thin; scrollbar-color:var(--bg3) transparent; }
  #mdt-root ::-webkit-scrollbar { width:8px; height:8px; }
  #mdt-root ::-webkit-scrollbar-thumb {
    background:var(--bg3); border-radius:8px;
    border:2px solid transparent; background-clip:padding-box;
  }
  #mdt-root ::-webkit-scrollbar-thumb:hover { background:var(--dim2); background-clip:padding-box; }
  #mdt-root ::-webkit-scrollbar-track { background:transparent; }
  #mdt-root ::-webkit-scrollbar-corner { background:transparent; }

  #mdt-root {
    position:fixed; bottom:0; left:0; right:0;
    height:${IS_FF_MOBILE ? "60vh" : "55vh"}; min-height:${IS_FF_MOBILE ? "260px" : "220px"}; max-height:94vh;
    background:var(--bg); border-top:1px solid var(--bdr);
    box-shadow:0 -1px 0 rgba(86,156,214,.25), 0 -18px 60px rgba(0,0,0,.85);
    font-family:var(--mono); font-size:${IS_MOBILE ? "13px" : "12px"}; color:var(--wht);
    display:flex; flex-direction:column; z-index:2147483646;
    overflow:hidden; transform:translateY(100%);
    transition:transform .22s var(--ease);
    line-height:1.45;
    /* Firefox Seluler: hindari tumpang tindih dengan bilah alat */
    padding-bottom:${IS_FF_MOBILE ? "env(safe-area-inset-bottom, 0px)" : "0"};
  }
  #mdt-root.open { transform:translateY(0); }

  /* Fokus papan ketik yang jelas untuk kontrol interaktif */
  #mdt-root button:focus-visible,
  #mdt-root [role="button"]:focus-visible { outline:2px solid var(--acc); outline-offset:-2px; }

  /* -- Gagang pengubah ukuran -- */
  #mdt-handle {
    height:${IS_MOBILE ? "10px" : "6px"}; background:var(--bg1); cursor:ns-resize; flex-shrink:0;
    touch-action:none; border-bottom:1px solid var(--bdr);
    display:flex; align-items:center; justify-content:center;
    transition:background var(--dur) var(--ease);
  }
  #mdt-handle:hover { background:var(--bg2); }
  #mdt-handle::before {
    content:''; display:block; width:${IS_MOBILE ? "48px" : "36px"}; height:${IS_MOBILE ? "4px" : "3px"};
    background:var(--dim2); border-radius:999px; transition:background var(--dur) var(--ease);
  }
  #mdt-handle:hover::before { background:var(--dim); }

  /* -- Bilah tab atas -- */
  #mdt-topbar {
    display:flex; align-items:stretch; flex-shrink:0;
    background:var(--bg1); border-bottom:1px solid var(--bdr);
    overflow-x:auto; scrollbar-width:none; height:${IS_MOBILE ? "40px" : "var(--tab-h)"};
    -webkit-overflow-scrolling:touch;
    box-shadow:0 1px 0 var(--bdr-soft);
  }
  #mdt-topbar::-webkit-scrollbar { display:none; }
  .mdt-tab {
    display:flex; align-items:center; gap:6px; padding:0 ${IS_MOBILE ? "16px" : "14px"};
    cursor:pointer; border:none; background:transparent;
    color:var(--dim); font-family:var(--ui); font-size:${IS_MOBILE ? "13px" : "12px"};
    font-weight:500; white-space:nowrap; border-bottom:2px solid transparent;
    transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
    flex-shrink:0; height:${IS_MOBILE ? "40px" : "var(--tab-h)"};
    -webkit-tap-highlight-color:transparent; position:relative;
  }
  .mdt-tab:hover { color:var(--wht); background:rgba(255,255,255,.04); }
  .mdt-tab.on { color:#fff; border-bottom-color:var(--acc); background:var(--acc-soft); }
  .mdt-tab svg { width:14px; height:14px; flex-shrink:0; }
  .mdt-tab.on svg { color:var(--acc); }
  .mdt-badge {
    background:var(--red); color:#fff; border-radius:999px; padding:0 6px;
    font-size:10px; font-weight:700; line-height:1.6; font-family:var(--ui);
    min-width:16px; text-align:center;
  }
  #mdt-closebtn {
    margin-left:auto; padding:0 ${IS_MOBILE ? "16px" : "14px"}; border:none;
    cursor:pointer; color:var(--dim); font-size:12px; font-weight:500;
    font-family:var(--ui); letter-spacing:.02em; line-height:${IS_MOBILE ? "40px" : "var(--tab-h)"};
    flex-shrink:0; transition:color var(--dur) var(--ease), background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent; background:var(--bg1);
    position:sticky; right:0;
  }
  #mdt-closebtn:hover { color:#fff; background:rgba(244,71,71,.18); }

  /* -- Wadah panel -- */
  #mdt-panels { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
  .mdt-panel { display:none; flex:1; flex-direction:column; overflow:hidden; min-height:0; }
  .mdt-panel.on { display:flex; }

  /* -- Bilah alat umum -- */
  .mdt-toolbar {
    display:flex; align-items:center; gap:6px; padding:4px 8px; row-gap:4px;
    background:var(--bg1); border-bottom:1px solid var(--bdr);
    flex-shrink:0; flex-wrap:wrap; min-height:var(--tb-h);
  }
  .mdt-tbinput {
    flex:1; min-width:80px; background:var(--bg2); border:1px solid var(--bdr);
    border-radius:var(--r); color:var(--wht); padding:0 9px; font-size:12px;
    font-family:var(--ui); outline:none; height:var(--ctl);
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    -webkit-appearance:none;
  }
  .mdt-tbinput:focus { border-color:var(--acc); background:var(--bg); box-shadow:0 0 0 2px var(--acc-soft); }
  .mdt-tbinput::placeholder { color:var(--dim2); }
  .mdt-tbtn {
    background:transparent; border:1px solid transparent; border-radius:var(--r);
    color:var(--dim); cursor:pointer; padding:0 8px; display:flex;
    align-items:center; justify-content:center; gap:5px;
    height:var(--ctl); min-width:var(--ctl);
    font-family:var(--ui); font-size:12px;
    transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-tbtn:hover { color:var(--wht); border-color:var(--bdr); background:var(--bg3); }
  .mdt-tbtn:active { background:var(--bg2); }
  .mdt-tbtn.on { color:var(--acc); border-color:var(--acc); background:var(--acc-soft); }
  .mdt-tbtn svg { width:14px; height:14px; }
  .mdt-sep { width:1px; height:18px; background:var(--bdr); flex-shrink:0; margin:0 2px; }

  /* -- Chip filter -- */
  .mdt-chip {
    padding:0 9px; border-radius:999px; cursor:pointer; border:1px solid transparent;
    background:transparent; color:var(--dim); font-size:11px; font-family:var(--ui);
    transition:color var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
    height:${IS_MOBILE ? "26px" : "20px"}; display:flex; align-items:center;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-chip:hover { color:var(--wht); background:rgba(255,255,255,.05); }
  .mdt-chip.on { color:var(--wht); border-color:var(--bdr); background:var(--bg3); }
  .mdt-chip.error { color:var(--red) !important; }
  .mdt-chip.warn  { color:var(--yel) !important; }
  .mdt-chip.info  { color:var(--info) !important; }

  /* ==================================================================
     PANEL KONSOL
     ================================================================== */
  #mdt-con-outer { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }

  /* Bilah pengaturan (dapat dilipat, tersembunyi secara bawaan) */
  #mdt-con-settings {
    display:none; flex-wrap:wrap; gap:0; padding:6px 12px;
    background:var(--bg1); border-bottom:1px solid var(--bdr); flex-shrink:0;
  }
  #mdt-con-settings.open { display:flex; }
  .mdt-con-ck {
    display:flex; align-items:center; gap:6px; padding:4px 10px 4px 0;
    font-size:11px; font-family:var(--ui); color:var(--wht); cursor:pointer;
    white-space:nowrap; min-width:${IS_MOBILE ? "100%" : "200px"};
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-con-ck input[type=checkbox] { accent-color:var(--acc); width:13px; height:13px; flex-shrink:0; cursor:pointer; }

  /* Bilah alat utama */
  #mdt-con-toolbar {
    display:flex; align-items:center; gap:5px; padding:4px 8px;
    background:var(--bg1); border-bottom:1px solid var(--bdr);
    flex-shrink:0; flex-wrap:nowrap; min-height:${IS_MOBILE ? "38px" : "var(--tb-h)"}; overflow:hidden;
  }
  .mdt-con-tbtn {
    background:transparent; border:1px solid transparent; cursor:pointer; padding:0 8px;
    color:var(--dim); border-radius:var(--r); display:flex; align-items:center;
    justify-content:center; gap:5px; height:var(--ctl); min-width:var(--ctl); flex-shrink:0;
    font-family:var(--ui); font-size:12px;
    transition:color var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-con-tbtn:hover { color:var(--wht); background:var(--bg3); }
  .mdt-con-tbtn.on  { color:var(--acc); border-color:var(--acc); background:var(--acc-soft); }
  .mdt-con-tbtn svg { width:14px; height:14px; }
  .mdt-con-sep { width:1px; height:18px; background:var(--bdr); flex-shrink:0; margin:0 2px; }
  /* Kolom input filter */
  #mdt-con-filter {
    flex:1; min-width:60px; background:var(--bg2); border:1px solid var(--bdr);
    border-radius:var(--r); color:var(--wht); padding:0 9px;
    font-size:12px; font-family:var(--ui); outline:none; height:var(--ctl);
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    -webkit-appearance:none;
  }
  #mdt-con-filter:focus { border-color:var(--acc); background:var(--bg); box-shadow:0 0 0 2px var(--acc-soft); }
  #mdt-con-filter::placeholder { color:var(--dim2); }
  /* Menu turun tingkat */
  #mdt-con-levels {
    background:var(--bg2); border:1px solid var(--bdr); border-radius:var(--r);
    color:var(--wht); font-size:12px; font-family:var(--ui); padding:0 6px;
    height:var(--ctl); outline:none; cursor:pointer; flex-shrink:0;
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  #mdt-con-levels:hover { border-color:var(--bdr-strong); }
  #mdt-con-levels:focus { border-color:var(--acc); box-shadow:0 0 0 2px var(--acc-soft); }
  #mdt-con-levels option { background:var(--bg2); color:var(--wht); }

  /* Area log */
  #mdt-logwrap {
    flex:1; overflow-y:auto; overflow-x:hidden; scroll-behavior:smooth;
    -webkit-overflow-scrolling:touch; background:var(--bg); padding:2px 0;
  }

  /* Baris log - ikon | pesan | sumber */
  .mdt-logentry {
    display:flex; align-items:baseline; gap:8px;
    padding:${IS_MOBILE ? "5px 10px" : "3px 10px"};
    border-bottom:1px solid var(--bdr-soft);
    line-height:1.6; word-break:break-word; cursor:default;
    position:relative; min-height:${IS_MOBILE ? "30px" : "20px"};
    transition:background var(--dur) var(--ease);
  }
  .mdt-logentry:hover { background:rgba(255,255,255,.045); }
  /* Aksen kiri memakai inset shadow agar lebar teks tidak bergeser */
  .mdt-logentry.warn   { background:var(--warn-bg); box-shadow:inset 2px 0 0 var(--yel); }
  .mdt-logentry.error  { background:var(--err-bg);  box-shadow:inset 2px 0 0 var(--red); }
  .mdt-logentry.result { box-shadow:inset 2px 0 0 var(--grn); }
  .mdt-logentry.info   { box-shadow:inset 2px 0 0 var(--info); }
  /* Kolom ikon level */
  .mdt-le-ic {
    font-size:10px; flex-shrink:0; width:16px; height:16px;
    text-align:center; user-select:none; align-self:flex-start;
    display:flex; align-items:center; justify-content:center;
    border-radius:var(--r-sm); font-weight:700; line-height:1;
    color:var(--dim); background:rgba(255,255,255,.05); margin-top:2px;
  }
  .mdt-logentry.error  .mdt-le-ic { color:#fff; background:var(--red); }
  .mdt-logentry.warn   .mdt-le-ic { color:#1d1d20; background:var(--yel); }
  .mdt-logentry.info   .mdt-le-ic { color:#1d1d20; background:var(--info); }
  .mdt-logentry.result .mdt-le-ic { color:#1d1d20; background:var(--grn); }
  /* Kolom pesan */
  .mdt-le-msg {
    flex:1; white-space:pre-wrap; font-size:${IS_MOBILE ? "12px" : "11.5px"};
    font-family:var(--mono); min-width:0; word-break:break-word;
  }
  .mdt-logentry.log    .mdt-le-msg { color:var(--wht); }
  .mdt-logentry.info   .mdt-le-msg { color:var(--info); }
  .mdt-logentry.warn   .mdt-le-msg { color:var(--yel); }
  .mdt-logentry.error  .mdt-le-msg { color:var(--red); }
  .mdt-logentry.result .mdt-le-msg { color:var(--grn); }
  /* Tautan sumber (sisi kanan) */
  .mdt-le-src {
    font-size:10px; color:var(--acc); font-family:var(--ui);
    white-space:nowrap; flex-shrink:0; align-self:flex-start;
    padding-top:3px; cursor:pointer; opacity:.75;
    text-decoration:none; text-underline-offset:2px;
    max-width:${IS_MOBILE ? "80px" : "180px"}; overflow:hidden; text-overflow:ellipsis;
    transition:opacity var(--dur) var(--ease);
  }
  .mdt-le-src:hover { opacity:1; text-decoration:underline; }
  /* Jejak tumpukan (stack trace) */
  .mdt-le-stk {
    font-size:10px; color:var(--dim); white-space:pre-wrap;
    border-left:2px solid rgba(255,255,255,.12); padding-left:8px;
    margin-top:2px; font-family:var(--mono); width:100%;
  }
  /* Lencana jumlah */
  .mdt-cnt {
    background:var(--bg3); color:var(--wht); border-radius:999px;
    padding:0 6px; font-size:10px; font-family:var(--ui); font-weight:600;
    margin-left:4px; flex-shrink:0; align-self:center; min-width:18px; text-align:center;
  }
  .mdt-logentry.error .mdt-cnt { background:var(--red); color:#fff; }
  .mdt-logentry.warn  .mdt-cnt { background:var(--yel); color:#1d1d20; }

  /* REPL - input sebaris bergaya Chrome di bagian bawah log */
  #mdt-replwrap {
    display:flex; align-items:stretch; flex-shrink:0;
    border-top:1px solid var(--bdr); background:var(--bg1);
    position:relative; min-height:${IS_MOBILE ? "44px" : "24px"};
  }
  /* Ikon prompt > */
  #mdt-replpfx {
    padding:0 6px; color:var(--acc); font-weight:700;
    font-size:12px; flex-shrink:0; user-select:none;
    font-family:var(--mono); align-self:stretch;
    display:flex; align-items:center;
  }
  /* Input textarea - sebaris, tanpa kotak */
  #mdt-repl {
    flex:1; background:transparent; border:none; color:var(--wht);
    font-family:var(--mono); font-size:${IS_MOBILE ? "13px" : "12px"};
    padding:${IS_MOBILE ? "11px 6px" : "4px 6px"};
    caret-color:var(--acc); resize:none;
    min-height:${IS_MOBILE ? "44px" : "24px"}; max-height:120px;
    line-height:1.6; scrollbar-width:thin; outline:none; -webkit-appearance:none;
  }
  #mdt-repl::placeholder { color:var(--dim2); }
  /* Tombol jalankan - hanya tampil di seluler */
  #mdt-replrun {
    display:${IS_MOBILE ? "flex" : "none"};
    padding:0 16px; background:transparent; border:none;
    border-left:1px solid var(--bdr); color:var(--acc);
    cursor:pointer; font-weight:700; font-size:12px;
    min-height:${IS_MOBILE ? "44px" : "24px"};
    flex-shrink:0; font-family:var(--ui); align-self:stretch;
    align-items:center; justify-content:center; gap:5px;
    transition:background var(--dur) var(--ease); -webkit-tap-highlight-color:transparent;
  }
  #mdt-replrun:hover { background:var(--acc-soft); }

  /* Popup pelengkapan otomatis */
  #mdt-ac {
    position:absolute; bottom:100%; left:0; right:0;
    background:var(--bg1); border:1px solid var(--acc);
    border-radius:var(--r); display:none; flex-direction:column;
    max-height:${IS_MOBILE ? "220px" : "180px"}; overflow:hidden auto; z-index:2147483647;
    scrollbar-width:thin; box-shadow:var(--shadow-2);
    -webkit-overflow-scrolling:touch;
  }
  .mdt-ac-group { padding:4px 10px; font-size:10px; color:var(--dim); font-family:var(--ui); border-top:1px solid var(--bdr); margin-top:2px; user-select:none; text-transform:uppercase; letter-spacing:.05em; }
  .mdt-ac-item {
    padding:${IS_MOBILE ? "7px 12px" : "4px 12px"}; cursor:pointer; font-size:12px; color:var(--wht);
    display:flex; align-items:center; gap:8px; white-space:nowrap;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-ac-item:hover, .mdt-ac-item.sel { background:var(--acc); color:#1d1d20; }
  .mdt-ac-item:hover .mdt-ac-type, .mdt-ac-item.sel .mdt-ac-type { color:#1d1d20; }
  .mdt-ac-name { flex:1; overflow:hidden; text-overflow:ellipsis; }
  .mdt-ac-type { color:var(--dim); font-size:10px; font-family:var(--ui); flex-shrink:0; }

  /* ==================================================================
     PANEL JARINGAN
     ================================================================== */
  #mdt-net-list { flex:1; overflow-y:auto; scrollbar-width:thin; -webkit-overflow-scrolling:touch; }
  .mdt-net-hdr {
    display:grid; grid-template-columns:26px 54px 58px 1fr 54px 56px 62px;
    gap:0; padding:5px 10px; background:var(--bg2);
    border-bottom:1px solid var(--bdr); font-size:10px;
    color:var(--dim); font-family:var(--ui); flex-shrink:0;
    text-transform:uppercase; letter-spacing:.05em; position:sticky; top:0; z-index:1;
  }
  .mdt-net-row {
    display:grid; grid-template-columns:26px 54px 58px 1fr 54px 56px 62px;
    gap:0; padding:${IS_MOBILE ? "6px 10px" : "4px 10px"}; border-bottom:1px solid var(--bdr-soft);
    cursor:pointer; align-items:center; font-size:12px; transition:background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-net-row:hover { background:var(--bg2); }
  .mdt-net-row.sel { background:rgba(86,156,214,.18); box-shadow:inset 2px 0 0 var(--acc); }
  .mdt-net-row.pend { opacity:.55; }
  .mdt-net-row.err { background:var(--err-bg); }
  .mdt-net-row > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mdt-net-row .nc-ico { font-size:12px; text-align:center; color:var(--dim); }
  .mdt-method { font-weight:700; font-size:11px; }
  .mdt-m-GET { color:var(--grn); } .mdt-m-POST { color:var(--acc); }
  .mdt-m-PUT { color:var(--org); } .mdt-m-DELETE { color:var(--red); }
  .mdt-m-PATCH { color:var(--pur); } .mdt-m-X { color:var(--dim); }
  .mdt-st-2 { color:var(--grn); } .mdt-st-3 { color:var(--acc); }
  .mdt-st-4 { color:var(--yel); } .mdt-st-5 { color:var(--red); }
  .mdt-st-x { color:var(--dim); }
  .mdt-net-waterfall { background:var(--bg3); border-radius:3px; height:10px; position:relative; overflow:hidden; }
  .mdt-net-bar { height:100%; border-radius:3px; background:var(--acc); position:absolute; opacity:.8; }
  #mdt-net-detail {
    display:none; flex-direction:column; border-top:1px solid var(--acc);
    background:var(--bg); max-height:45%; overflow:hidden; flex-shrink:0;
    box-shadow:0 -6px 18px rgba(0,0,0,.35);
  }
  #mdt-net-detail.on { display:flex; }
  #mdt-net-detail-tabs {
    display:flex; background:var(--bg1); border-bottom:1px solid var(--bdr); flex-shrink:0; padding:0 4px;
  }
  .mdt-ndt {
    padding:6px 12px; cursor:pointer; border:none; background:transparent;
    color:var(--dim); font-size:11px; font-family:var(--ui); font-weight:500;
    border-bottom:2px solid transparent; transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-ndt:hover { color:var(--wht); }
  .mdt-ndt.on { color:#fff; border-bottom-color:var(--acc); }
  #mdt-net-detail-body { flex:1; overflow-y:auto; padding:10px 14px; font-size:12px; scrollbar-width:thin; -webkit-overflow-scrolling:touch; }
  .mdt-drow { display:flex; gap:10px; padding:4px 0; border-bottom:1px solid var(--bdr-soft); }
  .mdt-drow:last-child { border-bottom:none; }
  .mdt-dk { color:var(--dim); min-width:130px; flex-shrink:0; font-size:11px; font-family:var(--ui); }
  .mdt-dv { color:var(--wht); word-break:break-all; }
  .mdt-dsec { color:var(--acc); font-weight:700; padding:10px 0 4px; font-size:11px; font-family:var(--ui); text-transform:uppercase; letter-spacing:.06em; }
  .mdt-hdr-name { color:var(--org); } .mdt-hdr-val { color:var(--wht); }
  /* FASE 4: filter tipe/status, bilah alat detail, dan body */
  .mdt-netsel {
    background:var(--bg2); border:1px solid var(--bdr); border-radius:var(--r);
    color:var(--wht); padding:0 6px; font-size:11px; font-family:var(--ui);
    outline:none; height:var(--ctl); max-width:120px; flex-shrink:0;
    -webkit-appearance:none;
  }
  .mdt-netsel:focus { border-color:var(--acc); }
  #mdt-net-detail-tools {
    display:flex; gap:8px; padding:6px 10px; background:var(--bg1);
    border-bottom:1px solid var(--bdr-soft); flex-shrink:0; flex-wrap:wrap;
  }
  .mdt-nettool {
    background:var(--bg2); border:1px solid var(--bdr); border-radius:var(--r);
    color:var(--dim); cursor:pointer; padding:3px 10px; font-size:11px;
    font-family:var(--ui); transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-nettool:hover { color:var(--wht); border-color:var(--acc); }
  .mdt-netbody-toggle { margin:2px 0 6px; }
  .mdt-netbody {
    margin:0; padding:8px 10px; background:var(--bg2); border:1px solid var(--bdr-soft);
    border-radius:var(--r); color:var(--wht); font-size:11px; font-family:var(--mono,monospace);
    white-space:pre-wrap; word-break:break-word; overflow-x:auto; max-height:260px; overflow-y:auto;
  }
  .mdt-cookie-val { font-family:var(--mono,monospace); }

  /* ==================================================================
     PANEL ELEMEN / DOM
     ================================================================== */
  #mdt-dom-outer { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
  /* Desktop: pohon | bilah samping berdampingan. Seluler: pohon di atas, bilah samping di bawah */
  #mdt-dom-split {
    flex:1; display:flex; overflow:hidden; min-height:0;
    flex-direction:${IS_MOBILE ? "column" : "row"};
  }

  /* -- Pohon DOM -- */
  #mdt-dom-tree {
    flex:1; overflow:auto; padding:4px 0; font-size:11.5px;
    scrollbar-width:thin; -webkit-overflow-scrolling:touch;
    background:var(--bg); line-height:1;
    min-height:120px; /* pastikan pohon selalu terlihat di seluler */
  }

  /* Tiap baris DOM - satu baris, ringkas */
  .mdt-drow2 {
    display:flex; align-items:center; height:${IS_MOBILE ? "20px" : "18px"};
    padding-right:8px; cursor:pointer; white-space:pre;
    font-size:11.5px; position:relative; flex-shrink:0;
    transition:background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-drow2:hover { background:rgba(255,255,255,.06); }
  .mdt-drow2.sel  { background:rgba(86,156,214,.18); }
  /* Tombol aksi mini tampil saat hover / selalu tampil pada layar sentuh */
  .mdt-drow2 .mdt-dom-menubtn {
    display:none; align-items:center; justify-content:center;
    margin-left:auto; flex-shrink:0;
    width:18px; height:${IS_MOBILE ? "20px" : "18px"}; border-radius:var(--r-sm);
    background:transparent; border:none; cursor:pointer;
    color:var(--dim); font-size:14px; line-height:1;
    padding:0; transition:color .1s, background .1s;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-drow2:hover .mdt-dom-menubtn { display:flex; }
  .mdt-drow2.sel  .mdt-dom-menubtn { display:flex; color:rgba(255,255,255,.55); }
  .mdt-dom-menubtn:hover { color:var(--wht) !important; background:rgba(255,255,255,.12); }
  /* Selalu tampil pada layar sentuh */
  @media (pointer:coarse) { .mdt-drow2 .mdt-dom-menubtn { display:flex; } }
  /* Batang kiri biru pada item terpilih */
  .mdt-drow2.sel::before {
    content:''; position:absolute; left:0; top:0; bottom:0;
    width:2px; background:var(--acc); pointer-events:none;
  }
  /* Baris tag penutup - tinggi sama */
  .mdt-dclose {
    display:flex; align-items:center; height:18px;
    padding-right:8px; white-space:pre; font-size:11.5px;
  }
  /* Baris teks sebaris */
  .mdt-dtextrow {
    display:flex; align-items:center; height:18px;
    padding-right:8px; white-space:nowrap; font-size:11.5px;
    cursor:pointer; -webkit-tap-highlight-color:transparent;
  }
  .mdt-dtextrow:hover { background:rgba(255,255,255,.04); }

  /* Tombol buka/tutup - HARUS berlebar tetap agar tag mulai pada posisi x yang sama */
  .mdt-dtog {
    display:inline-flex; align-items:center; justify-content:center;
    width:10px; height:18px; flex-shrink:0; cursor:pointer;
    color:var(--dim); font-size:8px; user-select:none;
    margin-right:2px;
  }
  .mdt-dtog:hover { color:var(--wht); }
  /* Penyeimbang untuk node tanpa anak - lebar sama */
  .mdt-dnotog { display:inline-block; width:10px; flex-shrink:0; margin-right:2px; }

  /* Warna - palet DevTools */
  .mdt-tag  { color:#569cd6; }            /* biru untuk <tag> */
  .mdt-an   { color:#9cdcfe; }            /* biru muda untuk nama atribut */
  .mdt-av   { color:#ce9178; }            /* oranye untuk nilai atribut */
  .mdt-txt  { color:var(--dim); font-style:italic; }  /* node teks */
  .mdt-cmt  { color:#6a9955; font-style:italic; }     /* komentar */
  .mdt-eq   { color:var(--wht); }                     /* tanda = */

  /* -- Bilah Samping Styles: KANAN di desktop, BAWAH di seluler -- */
  #mdt-dom-side {
    overflow:hidden; flex-shrink:0;
    display:flex; flex-direction:column; background:var(--bg1);
    transition:all .18s var(--ease);
    ${IS_MOBILE
      ? "height:0;border-top:1px solid var(--bdr);width:100%;"
      : "width:0;border-left:1px solid var(--bdr);"
    }
  }
  ${IS_MOBILE
    ? "#mdt-dom-side.on { height:52vh; overflow:hidden; }"
    : "#mdt-dom-side.on { width:280px; overflow:hidden; }"
  }

  /* Bilah tab samping - Styles / Computed / Layout / Event Listeners */
  #mdt-styles-tabs {
    display:flex; flex-shrink:0; background:var(--bg1);
    border-bottom:1px solid var(--bdr); overflow-x:auto; scrollbar-width:none;
    height:28px; padding:0 4px;
  }
  #mdt-styles-tabs::-webkit-scrollbar { display:none; }
  .mdt-stab {
    padding:0 10px; font-size:11px; font-family:var(--ui); color:var(--dim);
    cursor:pointer; border:none; background:transparent;
    border-bottom:2px solid transparent; height:28px;
    display:flex; align-items:center; white-space:nowrap;
    transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease); flex-shrink:0;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-stab:hover { color:var(--wht); }
  .mdt-stab.on { color:var(--wht); border-bottom-color:var(--acc); }

  /* Baris filter */
  #mdt-styles-filter {
    display:flex; align-items:center; gap:4px; padding:4px 6px;
    border-bottom:1px solid var(--bdr); flex-shrink:0; background:var(--bg1);
  }
  #mdt-styles-filter input {
    flex:1; background:var(--bg2); border:1px solid var(--bdr); border-radius:var(--r);
    color:var(--wht); padding:0 8px; font-size:11px; font-family:var(--ui);
    outline:none; height:${IS_MOBILE ? "28px" : "22px"};
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    -webkit-appearance:none;
  }
  #mdt-styles-filter input:focus { border-color:var(--acc); background:var(--bg); box-shadow:0 0 0 2px var(--acc-soft); }
  .mdt-sf-btn {
    background:transparent; border:1px solid var(--bdr); border-radius:var(--r-sm);
    color:var(--dim); font-size:10px; padding:0 6px; cursor:pointer;
    font-family:var(--ui); transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
    height:${IS_MOBILE ? "28px" : "22px"};
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-sf-btn:hover { color:var(--wht); }
  .mdt-sf-btn.on { color:var(--acc); border-color:var(--acc); background:var(--acc-soft); }

  /* Badan gulir Styles */
  #mdt-styles-body {
    flex:1; overflow-y:auto; scrollbar-width:thin;
    -webkit-overflow-scrolling:touch; display:block;
  }
  #mdt-computed-body {
    flex:1; overflow-y:auto; scrollbar-width:thin;
    -webkit-overflow-scrolling:touch; display:none; padding:4px 0;
  }

  /* Blok gaya: "element.style { ... }" */
  .mdt-style-block { border-bottom:1px solid var(--bdr); padding-bottom:4px; }
  .mdt-style-selector {
    padding:5px 8px 3px; font-size:11px; font-family:var(--mono);
    color:var(--wht); cursor:default; user-select:text;
  }
  .mdt-style-selector-name { color:#dcdcaa; } /* selektor berwarna kuning */
  .mdt-style-brace { color:var(--wht); }
  .mdt-style-source {
    float:right; color:var(--dim); font-size:10px; font-family:var(--ui);
    font-style:normal; cursor:pointer;
  }
  .mdt-style-source:hover { color:var(--acc); text-decoration:underline; }
  .mdt-style-closebrace { padding:2px 8px 4px 8px; font-size:11px; color:var(--wht); }

  /* Baris aturan individual */
  .mdt-style-rule {
    display:flex; align-items:center; padding:0 4px 0 20px;
    font-size:11px; min-height:16px; line-height:1.5;
    font-family:var(--mono); gap:0;
  }
  .mdt-style-rule:hover { background:rgba(255,255,255,.04); }
  .mdt-style-prop { color:#9cdcfe; flex-shrink:0; }  /* biru muda untuk properti */
  .mdt-style-colon { color:var(--wht); padding:0 1px 0 0; flex-shrink:0; }
  .mdt-style-val { color:var(--wht); flex:1; word-break:break-word; }
  .mdt-style-val.color-val { color:#ce9178; }
  .mdt-style-semi { color:var(--wht); flex-shrink:0; }
  .mdt-style-disabled { opacity:.4; text-decoration:line-through; }
  /* Contoh warna */
  .mdt-cb {
    display:inline-block; width:10px; height:10px;
    border:1px solid rgba(255,255,255,.25); border-radius:2px;
    margin-right:3px; vertical-align:middle; flex-shrink:0;
  }

  /* Baris panel Computed */
  .mdt-comp-row {
    display:flex; align-items:baseline; gap:0; padding:2px 8px;
    font-size:11px; min-height:16px; font-family:var(--mono);
  }
  .mdt-comp-row:hover { background:rgba(255,255,255,.04); }
  .mdt-comp-prop { color:#9cdcfe; width:150px; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; }
  .mdt-comp-val { color:var(--wht); flex:1; word-break:break-word; }

  /* -- BAWAH: Remah navigasi -- */
  #mdt-dom-breadcrumb {
    display:flex; align-items:center; flex-shrink:0;
    overflow-x:auto; scrollbar-width:none;
    background:var(--bg1); border-top:1px solid var(--bdr);
    padding:0 8px; height:22px; gap:0;
    font-family:var(--mono); font-size:11px;
    -webkit-overflow-scrolling:touch;
  }
  #mdt-dom-breadcrumb::-webkit-scrollbar { display:none; }
  .mdt-bc-item {
    display:inline-flex; align-items:center; gap:0;
    white-space:nowrap; cursor:pointer; padding:0 4px;
    height:22px; border-radius:var(--r-sm); color:var(--dim);
    transition:background .1s, color .1s; -webkit-tap-highlight-color:transparent;
  }
  .mdt-bc-item:hover { background:rgba(255,255,255,.08); color:var(--wht); }
  .mdt-bc-item.active .mdt-bc-tag { color:var(--wht); }
  .mdt-bc-tag { color:#569cd6; }
  .mdt-bc-id  { color:var(--wht); }
  .mdt-bc-cls { color:#9cdcfe; font-size:10px; }
  .mdt-bc-sep { color:var(--dim2); padding:0 1px; user-select:none; font-size:10px; }

  /* -- Panel panduan -- */
  #mdt-guide-scroll {
    flex:1; overflow-y:auto; padding:0; scrollbar-width:thin;
    -webkit-overflow-scrolling:touch; background:var(--bg);
  }
  /* Bagian utama panduan */
  .mdt-guide-hero {
    background:linear-gradient(135deg,#1b2b48 0%,#0d1117 100%);
    padding:22px 20px 18px; border-bottom:1px solid var(--bdr);
  }
  .mdt-guide-hero-title {
    font-size:18px; font-weight:700; color:var(--wht);
    font-family:var(--ui); margin-bottom:5px;
    display:flex; align-items:center; gap:8px; letter-spacing:-.01em;
  }
  .mdt-guide-hero-sub { font-size:12px; color:var(--dim); font-family:var(--ui); line-height:1.6; }
  /* Kartu langkah */
  .mdt-guide-steps { padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
  .mdt-guide-step {
    background:var(--bg1); border:1px solid var(--bdr); border-radius:var(--r-lg);
    overflow:hidden; cursor:pointer; transition:border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  }
  .mdt-guide-step:hover { border-color:rgba(86,156,214,.4); }
  .mdt-guide-step.open { border-color:var(--acc); box-shadow:0 0 0 1px var(--acc-soft); }
  .mdt-guide-step-hdr {
    display:flex; align-items:center; gap:10px; padding:11px 14px;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-guide-step-num {
    width:26px; height:26px; border-radius:50%; background:var(--acc);
    color:#0d1117; font-size:11px; font-weight:700; font-family:var(--ui);
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .mdt-guide-step.done .mdt-guide-step-num { background:var(--grn); }
  .mdt-guide-step-title { font-size:12px; font-weight:600; color:var(--wht); font-family:var(--ui); flex:1; }
  .mdt-guide-step-tag {
    font-size:10px; color:var(--dim); font-family:var(--ui); flex-shrink:0;
    background:var(--bg3); border-radius:999px; padding:2px 8px;
  }
  .mdt-guide-step-tag.mobile { color:var(--org); background:rgba(215,186,125,.12); }
  .mdt-guide-step-arrow { color:var(--dim); font-size:13px; flex-shrink:0; transition:transform var(--dur) var(--ease); }
  .mdt-guide-step.open .mdt-guide-step-arrow { transform:rotate(90deg); }
  /* Badan langkah */
  .mdt-guide-step-body {
    display:none; padding:0 14px 14px; border-top:1px solid var(--bdr);
    background:var(--bg);
  }
  .mdt-guide-step.open .mdt-guide-step-body { display:block; }
  .mdt-guide-desc { font-size:11px; color:var(--dim); font-family:var(--ui); line-height:1.75; padding:10px 0 6px; }
  /* Demo visual langkah */
  .mdt-guide-demo {
    background:var(--bg2); border-radius:var(--r); padding:10px 12px; margin:6px 0;
    font-size:11px; font-family:var(--mono); color:var(--wht);
    border-left:3px solid var(--acc); line-height:1.8;
  }
  .mdt-guide-demo.warn { border-color:var(--org); }
  .mdt-guide-demo.green { border-color:var(--grn); }
  /* Tombol coba */
  .mdt-guide-try {
    background:var(--acc); color:#0d1117; border:none; border-radius:var(--r);
    padding:7px 15px; font-size:11px; font-weight:700; font-family:var(--ui);
    cursor:pointer; margin-top:10px; -webkit-tap-highlight-color:transparent;
    transition:opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
    display:inline-flex; align-items:center; gap:6px;
  }
  .mdt-guide-try:hover { opacity:.9; }
  .mdt-guide-try:active { transform:translateY(1px); }
  .mdt-guide-tip {
    display:flex; align-items:flex-start; gap:8px; padding:9px 12px;
    background:var(--acc-soft); border-radius:var(--r); margin:6px 0;
    font-size:11px; font-family:var(--ui); color:var(--wht); line-height:1.6;
  }
  .mdt-guide-tip-icon { font-size:12px; flex-shrink:0; font-weight:700; color:var(--acc); }
  /* Banner tips untuk seluler */
  .mdt-guide-mobile-banner {
    background:rgba(215,186,125,.08); border:1px solid rgba(215,186,125,.22);
    border-radius:var(--r); padding:10px 12px; margin:6px 0;
    display:flex; align-items:flex-start; gap:8px;
    font-size:11px; font-family:var(--ui); color:var(--org); line-height:1.6;
  }
  /* Bilah kemajuan */
  .mdt-guide-progress { padding:0 14px 16px; }
  .mdt-guide-prog-label { font-size:11px; color:var(--dim); font-family:var(--ui); margin-bottom:5px; }
  .mdt-guide-prog-bar { height:5px; background:var(--bg3); border-radius:999px; overflow:hidden; }
  .mdt-guide-prog-fill { height:100%; background:var(--acc); border-radius:999px; transition:width .4s var(--ease); }
  /* Efek cahaya tombol pilih saat aktif */
  .mdt-pick-btn.on { color:var(--acc) !important; box-shadow:0 0 0 2px var(--acc-soft); }

  /* -- Lapisan kursor inspeksi -- */
  #mdt-iov.on { cursor:crosshair; }
  #mdt-pick-cursor {
    position:fixed; pointer-events:none; z-index:2147483646; display:none;
    width:24px; height:24px; transform:translate(-50%,-50%);
  }
  #mdt-pick-cursor.on { display:block; }
  .mdt-pick-ring {
    position:absolute; inset:0; border:2px solid #569cd6;
    border-radius:50%; animation:mdt-pulse 1.2s ease-in-out infinite;
  }
  .mdt-pick-dot {
    position:absolute; top:50%; left:50%;
    width:4px; height:4px; background:#569cd6; border-radius:50%;
    transform:translate(-50%,-50%);
  }
  @keyframes mdt-pulse {
    0%,100% { transform:scale(1); opacity:1; }
    50% { transform:scale(1.4); opacity:.5; }
  }

  /* -- Tombol aksi Styles (salin/hapus) - muncul saat hover -- */
  .mdt-style-actions {
    display:none; align-items:center; gap:2px;
    margin-left:auto; flex-shrink:0; padding-left:6px;
  }
  .mdt-style-rule:hover .mdt-style-actions { display:flex; }
  /* Selalu tampil pada perangkat sentuh */
  @media (pointer:coarse) { .mdt-style-actions { display:flex; } }
  .mdt-style-action-btn {
    background:transparent; border:none; cursor:pointer; padding:1px 4px;
    font-size:11px; color:var(--dim); border-radius:var(--r-sm); line-height:1;
    transition:color .1s, background .1s; -webkit-tap-highlight-color:transparent;
    height:16px; display:flex; align-items:center;
  }
  .mdt-style-action-btn:hover { color:var(--wht); background:rgba(255,255,255,.08); }
  /* Tombol salin di kepala selektor */
  .mdt-style-copy-btn {
    background:transparent; border:none; cursor:pointer; padding:1px 4px;
    font-size:11px; color:var(--dim); border-radius:var(--r-sm);
    -webkit-tap-highlight-color:transparent;
    opacity:0; transition:opacity var(--dur) var(--ease), color .1s;
  }
  .mdt-style-block:hover .mdt-style-copy-btn,
  .mdt-style-selector:hover .mdt-style-copy-btn { opacity:1; }
  @media (pointer:coarse) { .mdt-style-copy-btn { opacity:1; } }
  .mdt-style-copy-btn:hover { color:var(--acc); }
  /* Coretan untuk aturan yang dinonaktifkan */
  .mdt-style-rule.disabled .mdt-style-prop,
  .mdt-style-rule.disabled .mdt-style-val { text-decoration:line-through; opacity:.45; }
  /* Baris tambah properti aktif */
  .mdt-style-addrow-active { background:rgba(86,156,214,.05); box-shadow:inset 2px 0 0 var(--acc); }
  /* -- Input edit sebaris (di dalam aturan gaya) -- */
  .mdt-style-editinput {
    background:var(--bg); border:1px solid var(--acc); border-radius:var(--r-sm);
    color:var(--wht); font-size:11px; font-family:var(--mono);
    padding:0 5px; outline:none; min-width:40px; height:16px;
    vertical-align:baseline; line-height:1; -webkit-appearance:none;
  }
  .mdt-style-editinput:focus { box-shadow:0 0 0 1px var(--acc); }
  /* Baris tambah properti */
  .mdt-style-addprop {
    padding:2px 8px 2px 20px; font-size:11px; color:var(--dim);
    font-family:var(--mono); cursor:pointer; font-style:italic;
  }
  .mdt-style-addprop:hover { color:var(--acc); }
  /* Kotak centang untuk menonaktifkan aturan */
  .mdt-style-cb {
    width:12px; height:12px; margin:0 3px 0 0; flex-shrink:0;
    cursor:pointer; accent-color:var(--acc); vertical-align:middle;
  }
  /* Span spasi - menjaga pemisahan tag dan atribut */
  .mdt-sp { white-space:pre; } /* mempertahankan spasi */
  /* Menu konteks - dipakai bersama pohon DOM dan editor Sumber */
  .mdt-ctx-menu { -webkit-user-select:none; user-select:none; font-family:var(--ui); }
  .mdt-ctx-item { -webkit-tap-highlight-color:transparent; border-radius:var(--r-sm); transition:background .1s, color .1s; }
  .mdt-ctx-item:hover { background:rgba(255,255,255,.08); color:#fff; }
  /* Kekhususan menu konteks editor Sumber */
  .mdt-src-ctx-sep { height:1px; background:var(--bdr); margin:3px 0; }
  /* Kompatibilitas lama */
  .mdt-propsec,.mdt-proprow,.mdt-propkey,.mdt-propval { display:none; }

  /* ==================================================================
     PANEL SUMBER (SOURCES)
     KIRI: penjelajah berkas | TENGAH: editor | KANAN: bilah samping debugger
     ================================================================== */
  #mdt-src-outer { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }

  /* Baris sub-tab: Page / Workspace / ... */
  #mdt-src-subtabs {
    display:flex; align-items:center; background:var(--bg1);
    border-bottom:1px solid var(--bdr); flex-shrink:0; padding:0 6px;
    height:30px; gap:0;
  }
  .mdt-src-stab {
    padding:0 10px; font-size:11px; font-family:var(--ui); color:var(--dim);
    cursor:pointer; border:none; background:transparent;
    border-bottom:2px solid transparent; height:30px;
    display:flex; align-items:center; transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-src-stab:hover { color:var(--wht); }
  .mdt-src-stab.on { color:var(--wht); border-bottom-color:var(--acc); }
  #mdt-src-stab-more {
    margin-left:auto; padding:0 6px; color:var(--dim); cursor:pointer;
    border:none; background:transparent; height:30px; display:flex; align-items:center;
    font-size:14px; -webkit-tap-highlight-color:transparent;
  }
  #mdt-src-stab-more:hover { color:var(--wht); }
  /* Panel cuplikan (Snippets) */
  #mdt-snippets-nav { display:flex; flex-direction:column; height:100%; }
  #mdt-snippets-nav-hdr { display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-bottom:1px solid var(--bdr); flex-shrink:0; background:var(--bg2); min-height:28px; }
  #mdt-snippets-nav-hdr span { font-size:10px; font-weight:600; color:var(--dim); font-family:var(--ui); text-transform:uppercase; letter-spacing:.06em; }
  #mdt-snippets-new-btn { background:transparent; border:none; color:var(--acc); cursor:pointer; font-size:18px; line-height:1; padding:0 4px; -webkit-tap-highlight-color:transparent; border-radius:var(--r-sm); transition:background var(--dur) var(--ease), color var(--dur) var(--ease); }
  #mdt-snippets-new-btn:hover { color:var(--wht); background:var(--bg3); }
  #mdt-snippets-list { flex:1; overflow-y:auto; scrollbar-width:thin; }
  .mdt-snippet-item {
    display:flex; align-items:center; gap:6px; padding:3px 8px;
    cursor:pointer; font-size:12px; font-family:var(--ui); color:var(--wht);
    min-height:${IS_MOBILE?"30px":"22px"}; -webkit-tap-highlight-color:transparent;
    position:relative; border-radius:var(--r-sm);
  }
  .mdt-snippet-item:hover { background:rgba(255,255,255,.06); }
  .mdt-snippet-item.active { background:#094771; }
  .mdt-snippet-item .snip-icon { font-size:11px; flex-shrink:0; color:var(--dim); }
  /* Nama - klik untuk mengganti nama secara sebaris */
  .mdt-snippet-item .snip-name {
    flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    cursor:text;
  }
  /* Input ganti nama sebaris */
  .mdt-snippet-item .snip-rename-inp {
    flex:1; background:var(--bg); border:1px solid var(--acc); border-radius:var(--r-sm);
    color:var(--wht); font-size:12px; font-family:var(--ui); padding:1px 6px;
    outline:none; min-width:0; -webkit-appearance:none;
  }
  /* Grup tombol aksi - tersembunyi sampai hover, selalu tampil pada layar sentuh */
  .mdt-snip-actions {
    display:none; align-items:center; gap:2px; flex-shrink:0;
  }
  .mdt-snippet-item:hover .mdt-snip-actions { display:flex; }
  .mdt-snippet-item.active .mdt-snip-actions { display:flex; }
  @media (pointer:coarse) { .mdt-snip-actions { display:flex; } }
  /* Tiap tombol aksi */
  .mdt-snip-act {
    background:transparent; border:none; cursor:pointer; padding:2px 5px;
    font-size:11px; border-radius:var(--r-sm); color:var(--dim); line-height:1;
    transition:color .1s, background .1s; -webkit-tap-highlight-color:transparent;
    height:18px; display:flex; align-items:center; justify-content:center;
  }
  .mdt-snip-act:hover { color:var(--wht); background:rgba(255,255,255,.12); }
  .mdt-snip-act.run  { color:var(--acc); }
  .mdt-snip-act.del  { color:var(--red); }
  .mdt-snip-act.rename { color:var(--org); }
  .mdt-snip-run-btn { background:var(--grn); border:none; color:#0d1117; border-radius:var(--r); padding:5px 12px; font-size:11px; font-weight:700; font-family:var(--ui); cursor:pointer; display:flex; align-items:center; gap:5px; -webkit-tap-highlight-color:transparent; transition:opacity var(--dur) var(--ease); }
  .mdt-snip-run-btn:hover { opacity:.88; }

  /* Editor cuplikan */
  .mdt-snip-editor-wrap {
    display:flex; flex:1; overflow:hidden; background:var(--bg);
    min-height:0; position:relative;
  }
  /* Rel nomor baris */
  .mdt-snip-gutter {
    width:${IS_MOBILE ? "44px" : "40px"}; flex-shrink:0; background:var(--bg1);
    border-right:1px solid var(--bdr);
    font-family:var(--mono); font-size:${IS_MOBILE ? "13px" : "11px"};
    line-height:${IS_MOBILE ? "1.8" : "1.6"};
    color:var(--dim2); text-align:right;
    padding:${IS_MOBILE ? "10px 6px 10px 0" : "8px 6px 8px 0"};
    overflow:hidden; box-sizing:border-box; user-select:none;
    white-space:pre; pointer-events:none;
  }
  /* Lapisan pratinjau tersorot - disembunyikan, tidak dipakai */
  .mdt-snip-hl { display:none; }
  /* Textarea - terlihat, berwarna penuh, satu-satunya area input */
  .mdt-snip-ta {
    flex:1; background:var(--bg); border:none; outline:none; resize:none;
    font-family:var(--mono); font-size:${IS_MOBILE ? "14px" : "12px"};
    line-height:${IS_MOBILE ? "1.8" : "1.6"};
    color:var(--wht); caret-color:var(--wht);
    padding:${IS_MOBILE ? "10px 10px 10px 50px" : "8px 8px 8px 50px"};
    tab-size:2; box-sizing:border-box;
    -webkit-appearance:none; scrollbar-width:thin; overflow:auto;
    white-space:pre; min-height:0; width:100%;
    /* Firefox Seluler: cegah zoom saat fokus */
    font-size:max(${IS_MOBILE ? "14px" : "12px"}, 16px);
  }

  /* Pemisahan tiga kolom */
  #mdt-src-split {
    flex:1; display:flex; overflow:hidden; min-height:0;
    flex-direction:${IS_MOBILE ? "column" : "row"};
  }

  /* Penjelajah berkas */
  #mdt-src-nav {
    overflow:auto; font-size:12px; scrollbar-width:thin;
    background:var(--bg1); transition:all .18s var(--ease);
    -webkit-overflow-scrolling:touch;
    ${IS_MOBILE
      ? "width:100%;flex-shrink:0;border-bottom:1px solid var(--bdr);height:180px;"
      : "width:200px;flex-shrink:0;border-right:1px solid var(--bdr);"
    }
  }
  ${IS_MOBILE
    ? "#mdt-src-nav.collapsed { height:0; overflow:hidden; border-bottom:none; }"
    : "#mdt-src-nav.collapsed { width:0; overflow:hidden; border-right:none; }"
  }
  /* Wadah pohon berkas harus mengisi area navigasi */
  #mdt-src-treewrap { display:flex; flex-direction:column; min-height:0; flex:1; }

  /* Node pohon */
  .mdt-tree-node {
    display:flex; align-items:center; gap:5px;
    padding:2px 4px; cursor:pointer; white-space:nowrap;
    font-family:var(--ui); font-size:12px; color:var(--wht);
    user-select:none; border-radius:var(--r-sm); transition:background .1s;
    min-height:${IS_MOBILE ? "28px" : "22px"};
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-tree-node:hover { background:rgba(255,255,255,.05); }
  .mdt-tree-node.selected { background:#094771; color:#fff; }
  .mdt-tree-indent { flex-shrink:0; }
  .mdt-tree-arrow {
    width:14px; flex-shrink:0; color:var(--dim); font-size:10px;
    display:flex; align-items:center; justify-content:center;
    transition:transform var(--dur) var(--ease);
  }
  .mdt-tree-arrow.open { transform:rotate(90deg); }
  .mdt-tree-icon { font-size:12px; flex-shrink:0; color:var(--dim); }
  .mdt-tree-label { overflow:hidden; text-overflow:ellipsis; flex:1; }
  .mdt-tree-children { display:none; }
  .mdt-tree-children.open { display:block; }

  /* TENGAH - Editor */
  #mdt-src-editor-wrap {
    flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0;
    background:var(--bg);
  }

  /* Bilah tab berkas - berkas terbuka ditampilkan sebagai tab */
  #mdt-src-filetabs {
    display:flex; align-items:stretch; flex-shrink:0; overflow-x:auto;
    background:var(--bg1); border-bottom:1px solid var(--bdr); min-height:28px;
    scrollbar-width:none; -webkit-overflow-scrolling:touch;
  }
  #mdt-src-filetabs::-webkit-scrollbar { display:none; }
  .mdt-filetab {
    display:flex; align-items:center; gap:6px; padding:0 12px;
    border-right:1px solid var(--bdr); cursor:pointer; font-size:12px;
    font-family:var(--ui); color:var(--dim); white-space:nowrap;
    background:transparent; border-bottom:1px solid transparent;
    transition:color var(--dur) var(--ease), background var(--dur) var(--ease); min-height:28px; flex-shrink:0;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-filetab:hover { background:var(--bg2); color:var(--wht); }
  .mdt-filetab.active { background:var(--bg); color:var(--wht); border-bottom-color:transparent; }
  .mdt-filetab-icon { font-size:11px; color:var(--dim); }
  .mdt-filetab-name { font-size:12px; }
  .mdt-filetab-close {
    width:16px; height:16px; border-radius:var(--r-sm); display:flex; align-items:center;
    justify-content:center; color:var(--dim); font-size:10px;
    transition:color var(--dur) var(--ease), background var(--dur) var(--ease); cursor:pointer;
  }
  .mdt-filetab-close:hover { color:#fff; background:rgba(244,71,71,.3); }

  /* Tampilan editor dengan nomor baris */
  #mdt-src-editor { flex:1; overflow:auto; position:relative; -webkit-overflow-scrolling:touch; }
  #mdt-src-code {
    font-size:${IS_MOBILE ? "12px" : "12px"}; line-height:1.6; white-space:pre;
    overflow-x:auto; tab-size:2; min-height:100%;
    display:flex; flex-direction:column;
  }
  #mdt-src-code-empty {
    display:flex; align-items:center; justify-content:center;
    height:100%; color:var(--dim); font-size:13px; font-family:var(--ui);
    text-align:center; padding:24px; line-height:1.8;
  }
  .mdt-src-line {
    display:flex; align-items:flex-start; min-height:${IS_MOBILE ? "22px" : "19px"};
    cursor:pointer; transition:background .1s;
  }
  .mdt-src-line:hover { background:rgba(255,255,255,.03); }
  .mdt-src-line.bp { background:rgba(244,71,71,.12); }
  .mdt-src-line.bp .mdt-src-ln { color:var(--red); }
  .mdt-src-ln {
    width:44px; color:var(--dim2); text-align:right; padding:0 8px 0 0;
    flex-shrink:0; user-select:none; font-size:11px; line-height:${IS_MOBILE ? "22px" : "19px"};
    border-right:1px solid var(--bdr); position:relative;
  }
  .mdt-src-ln .bp-dot {
    position:absolute; left:5px; top:50%; transform:translateY(-50%);
    width:8px; height:8px; border-radius:50%; background:var(--red); display:none;
  }
  .mdt-src-line.bp .bp-dot { display:block; }
  .mdt-src-code-txt { flex:1; padding:0 12px; color:var(--wht); line-height:${IS_MOBILE ? "22px" : "19px"}; }

  /* Bilah bawah editor */
  #mdt-src-statusbar {
    display:flex; align-items:center; justify-content:space-between;
    background:#0067b8; padding:0 12px; font-size:11px; font-family:var(--ui);
    color:#fff; flex-shrink:0; height:22px; gap:12px;
  }
  #mdt-src-statusbar .sb-left { display:flex; align-items:center; gap:12px; }
  #mdt-src-statusbar .sb-right { display:flex; align-items:center; gap:12px; color:rgba(255,255,255,.85); }
  #mdt-src-prettybtn {
    background:transparent; border:none; color:#fff; cursor:pointer;
    font-family:var(--mono); font-size:12px; padding:0; display:flex; align-items:center; gap:4px;
    -webkit-tap-highlight-color:transparent;
  }
  #mdt-src-prettybtn:hover { text-decoration:underline; }

  /* KANAN - Bilah Samping Debugger */
  #mdt-src-dbg {
    width:${IS_FF_MOBILE ? "0" : "220px"}; flex-shrink:0; overflow-y:auto; overflow-x:hidden;
    border-left:1px solid var(--bdr); font-size:12px; scrollbar-width:thin;
    background:var(--bg1); transition:width .2s var(--ease);
    -webkit-overflow-scrolling:touch;
  }
  #mdt-src-dbg.collapsed { width:0; border-left:none; }

  /* === PERBAIKAN Firefox Seluler: tata letak Sources === */
  ${IS_MOBILE ? `
  /* Di seluler srcSplit memakai column: debugger menjadi panel bersumbu tinggi */
  #mdt-src-dbg {
    width: 100% !important;
    height: 0;
    border-left: none !important;
    border-top: 1px solid var(--bdr);
    transition: height .2s ease;
    flex-shrink: 0;
  }
  #mdt-src-dbg.collapsed {
    height: 0 !important;
    border-top: none;
  }
  #mdt-src-dbg:not(.collapsed) {
    height: 40vh;
  }
  /* Editor tidak boleh pernah menciut hingga nol */
  #mdt-src-editor-wrap {
    min-height: 200px;
    flex: 1 1 auto;
  }
  /* Navigasi berkas: logikanya sama seperti debugger */
  #mdt-src-nav.collapsed {
    height: 0 !important;
    border-bottom: none !important;
    overflow: hidden !important;
  }
  #mdt-src-nav:not(.collapsed) {
    height: 35vh;
    flex-shrink: 0;
  }
  /* srcSplit harus dapat menghitung tinggi anak-anaknya dengan baik */
  #mdt-src-split {
    min-height: 0;
  }
  ` : ""}

  /* === PERBAIKAN Firefox Seluler: Snippets === */
  ${IS_MOBILE ? `
  /* Pembungkus editor harus punya min-height agar anak flex tidak menciut */
  #mdt-src-editor-wrap {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* Div editor di dalam harus bisa membesar */
  #mdt-src-editor {
    flex: 1 1 auto;
    min-height: 250px;
    display: flex;
    flex-direction: column;
  }
  /* srcCode (wadah pembungkus cuplikan) harus mengisi editor */
  #mdt-src-code {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* Pembungkus editor cuplikan */
  .mdt-snip-editor-wrap {
    flex: 1 1 auto;
    min-height: 250px;
    display: flex;
  }
  /* Textarea cuplikan */
  .mdt-snip-ta {
    flex: 1 1 auto;
    min-height: 250px;
    font-size: 16px;
    -webkit-text-size-adjust: 100%;
  }
  /* Rel nomor baris terlihat */
  .mdt-snip-gutter {
    flex-shrink: 0;
  }
  /* Daftar cuplikan saat navigasi berperan sebagai panel cuplikan */
  #mdt-src-nav:not(.collapsed) #mdt-snippets-nav {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  #mdt-snippets-list {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  /* Tombol + lebih besar dan ramah sentuh */
  #mdt-snippets-new-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    -webkit-tap-highlight-color: rgba(86,156,214,.2);
  }
  ` : ""}

  /* Seksi debugger */
  .mdt-dbg-sec {
    border-bottom:1px solid var(--bdr);
  }
  .mdt-dbg-sec-hdr {
    display:flex; align-items:center; gap:6px; padding:5px 10px;
    cursor:pointer; font-size:11px; font-family:var(--ui); color:var(--wht);
    user-select:none; background:var(--bg1); -webkit-tap-highlight-color:transparent;
    min-height:${IS_MOBILE ? "32px" : "26px"};
    transition:background var(--dur) var(--ease);
  }
  .mdt-dbg-sec-hdr:hover { background:var(--bg2); }
  .mdt-dbg-arrow {
    color:var(--dim); font-size:9px; width:12px; flex-shrink:0;
    transition:transform var(--dur) var(--ease); display:flex; align-items:center;
  }
  .mdt-dbg-arrow.open { transform:rotate(90deg); }
  .mdt-dbg-sec-title { font-weight:600; font-size:11px; color:var(--wht); flex:1; }
  .mdt-dbg-sec-body { padding:6px 0; display:none; }
  .mdt-dbg-sec-body.open { display:block; }

  /* Kontrol jeda */
  #mdt-dbg-controls {
    display:flex; align-items:center; gap:3px; padding:6px 8px;
    border-bottom:1px solid var(--bdr); background:var(--bg2); flex-shrink:0;
  }
  .mdt-dbg-ctrl {
    background:transparent; border:none; color:var(--dim); cursor:pointer;
    padding:4px; border-radius:var(--r); display:flex; align-items:center; justify-content:center;
    transition:color var(--dur) var(--ease), background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
    width:${IS_MOBILE ? "36px" : "28px"}; height:${IS_MOBILE ? "36px" : "28px"};
  }
  .mdt-dbg-ctrl:hover { color:var(--wht); background:var(--bg3); }
  .mdt-dbg-ctrl.active { color:var(--acc); }
  .mdt-dbg-ctrl svg { width:14px; height:14px; }
  #mdt-dbg-status { font-size:11px; font-family:var(--ui); color:var(--dim); padding:6px 10px; font-style:italic; }

  /* Item titik henti (breakpoint) */
  .mdt-dbg-bp-item {
    display:flex; align-items:center; gap:6px; padding:4px 10px;
    font-size:11px; font-family:var(--ui); cursor:pointer;
    -webkit-tap-highlight-color:transparent;
    min-height:${IS_MOBILE ? "28px" : "22px"};
  }
  .mdt-dbg-bp-item:hover { background:rgba(255,255,255,.04); }
  .mdt-dbg-bp-cb {
    width:13px; height:13px; border:1px solid var(--dim2); border-radius:var(--r-sm);
    flex-shrink:0; display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:background var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .mdt-dbg-bp-cb.checked { background:var(--acc); border-color:var(--acc); }
  /* Tanda centang digambar murni dengan CSS (dua sisi kotak diputar 45 derajat),
     bukan karakter unicode/emoji, agar tampilan tetap 100% bebas emoji. */
  .mdt-dbg-bp-cb.checked::after {
    content:""; width:3px; height:6px; margin-top:-2px;
    border:solid #fff; border-width:0 1.5px 1.5px 0;
    transform:rotate(45deg);
  }
  .mdt-dbg-bp-label { color:var(--wht); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mdt-dbg-bp-loc { color:var(--dim); font-size:10px; margin-left:auto; flex-shrink:0; }

  /* Keadaan kosong untuk seksi debugger */
  .mdt-dbg-empty { padding:4px 16px 8px; color:var(--dim); font-size:11px; font-style:italic; font-family:var(--ui); }

  /* Ekspresi pantau (watch) */
  .mdt-dbg-watch-add {
    display:flex; align-items:center; gap:4px; padding:4px 10px;
    cursor:pointer; color:var(--dim); font-size:11px; font-family:var(--ui);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-dbg-watch-add:hover { color:var(--acc); }

  /* Variabel lingkup (scope) */
  .mdt-dbg-scope-var {
    display:flex; align-items:baseline; gap:6px; padding:2px 16px;
    font-size:11px; min-height:${IS_MOBILE ? "24px" : "18px"};
  }
  .mdt-dbg-scope-key { color:var(--org); min-width:70px; flex-shrink:0; }
  .mdt-dbg-scope-val { color:var(--wht); word-break:break-all; }

  /* Seluler: tombol sakelar untuk panel nav/dbg */
  #mdt-src-mobile-bar {
    display:${IS_MOBILE ? "flex" : "none"};
    align-items:center; gap:6px; padding:5px 10px;
    background:var(--bg2); border-bottom:1px solid var(--bdr); flex-shrink:0;
    overflow-x:auto; scrollbar-width:none;
  }
  #mdt-src-mobile-bar::-webkit-scrollbar { display:none; }
  .mdt-src-mob-btn {
    background:var(--bg3); border:1px solid var(--bdr); color:var(--dim);
    border-radius:var(--r); padding:6px 12px; font-size:12px; font-family:var(--ui);
    cursor:pointer; transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
    white-space:nowrap; flex-shrink:0; display:flex; align-items:center; gap:4px;
    min-height:32px;
  }
  .mdt-src-mob-btn:hover { color:var(--wht); }
  .mdt-src-mob-btn.on { color:var(--acc); border-color:var(--acc); background:var(--acc-soft); }

  /* Bilah gulir horizontal untuk editor src */
  #mdt-src-editor::-webkit-scrollbar { width:8px; height:8px; }
  #mdt-src-editor::-webkit-scrollbar-corner { background:var(--bg); }

  /* sintaksis */
  .tok-kw { color:#569cd6; } .tok-str { color:#ce9178; } .tok-num { color:#b5cea8; }
  .tok-cmt { color:#6a9955; font-style:italic; } .tok-fn { color:#dcdcaa; }
  .tok-cls { color:#4ec9b0; } .tok-rx { color:#d16969; } .tok-op { color:#d4d4d4; }
  .tok-prop { color:#9cdcfe; }

  /* ==================================================================
     PANEL PERFORMA
     ================================================================== */
  #mdt-perf-scroll { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:12px; scrollbar-width:thin; -webkit-overflow-scrolling:touch; }
  .mdt-pcard { background:var(--bg1); border:1px solid var(--bdr); border-radius:var(--r-lg); padding:12px 14px; box-shadow:var(--shadow-1); }
  .mdt-pcard h4 { margin:0 0 8px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); font-family:var(--ui); }
  .mdt-pmrow { display:flex; justify-content:space-between; align-items:baseline; padding:4px 0; border-bottom:1px solid var(--bdr-soft); }
  .mdt-pmrow:last-child { border-bottom:none; }
  .mdt-pmk { color:var(--dim); font-size:11px; font-family:var(--ui); }
  .mdt-pmv { font-size:12px; font-weight:600; }
  .mdt-bar-track { height:6px; background:var(--bg3); border-radius:999px; overflow:hidden; margin-top:6px; }
  .mdt-bar-fill { height:100%; border-radius:999px; background:var(--acc); transition:width .4s var(--ease); }
  .mdt-bar-fill.y { background:var(--yel); } .mdt-bar-fill.r { background:var(--red); }
  .mdt-fps-big { font-size:42px; font-weight:900; color:var(--grn); line-height:1; letter-spacing:-2px; font-family:var(--mono); }
  .mdt-vital { display:flex; align-items:center; gap:8px; padding:4px 0; }
  .mdt-vital-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .mdt-vital-g { background:var(--grn); } .mdt-vital-y { background:var(--yel); } .mdt-vital-r { background:var(--red); }

  /* ==================================================================
     PANEL APLIKASI
     ================================================================== */
  #mdt-app-outer { flex:1; display:flex; flex-direction:row; overflow:hidden; min-height:0; }

  /* KIRI - Penjelajah pohon */
  #mdt-app-nav {
    width:${IS_MOBILE ? "0" : "180px"}; flex-shrink:0; overflow-y:auto; overflow-x:hidden;
    border-right:1px solid var(--bdr); background:var(--bg1);
    scrollbar-width:thin; -webkit-overflow-scrolling:touch;
    transition:width .2s var(--ease);
  }
  #mdt-app-nav.mobile-open { width:180px; }

  /* Kepala seksi navigasi (Storage, Background services...) */
  .mdt-app-section-hdr {
    padding:8px 10px 3px; font-size:10px; font-weight:600;
    color:var(--dim); font-family:var(--ui); text-transform:uppercase;
    letter-spacing:.06em; user-select:none; margin-top:4px;
  }
  /* Item pohon navigasi */
  .mdt-app-nav-item {
    display:flex; align-items:center; gap:7px; padding:3px 8px 3px 16px;
    cursor:pointer; font-size:11px; font-family:var(--ui); color:var(--wht);
    border-radius:0; transition:background .1s; min-height:${IS_MOBILE?"28px":"22px"};
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-app-nav-item:hover { background:rgba(255,255,255,.05); }
  .mdt-app-nav-item.sel { background:#094771; color:#fff; }
  .mdt-app-nav-item .nav-icon { font-size:12px; flex-shrink:0; color:var(--dim); }
  /* Sub-item (seperti domain cookie) */
  .mdt-app-nav-item.sub { padding-left:28px; color:var(--dim); }
  .mdt-app-nav-item.sub.sel { color:#fff; }

  /* KANAN - Panel detail */
  #mdt-app-detail {
    flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0;
  }
  /* Bilah alat detail */
  #mdt-app-toolbar {
    display:flex; align-items:center; gap:5px; padding:4px 8px;
    background:var(--bg1); border-bottom:1px solid var(--bdr); flex-shrink:0;
    min-height:var(--tb-h);
  }
  #mdt-app-filter {
    flex:1; background:var(--bg2); border:1px solid var(--bdr); border-radius:var(--r);
    color:var(--wht); padding:0 9px; font-size:12px; font-family:var(--ui);
    outline:none; height:var(--ctl);
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    -webkit-appearance:none;
  }
  #mdt-app-filter:focus { border-color:var(--acc); background:var(--bg); box-shadow:0 0 0 2px var(--acc-soft); }
  #mdt-app-filter::placeholder { color:var(--dim2); }
  .mdt-app-tbtn {
    background:transparent; border:1px solid transparent; border-radius:var(--r);
    color:var(--dim); cursor:pointer; padding:0 9px; height:var(--ctl);
    display:flex; align-items:center; gap:5px;
    transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
    font-size:12px; font-family:var(--ui);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-app-tbtn:hover { color:var(--wht); border-color:var(--bdr); background:var(--bg3); }
  .mdt-app-tbtn.danger { color:var(--red); }
  .mdt-app-tbtn.danger:hover { border-color:rgba(244,71,71,.4); background:rgba(244,71,71,.12); }
  .mdt-app-tbtn svg { width:14px; height:14px; }

  /* Area tabel */
  #mdt-app-table-wrap {
    flex:1; overflow:auto; scrollbar-width:thin; -webkit-overflow-scrolling:touch;
  }
  .mdt-app-table {
    width:100%; border-collapse:collapse; font-size:11px;
    font-family:var(--mono); table-layout:auto;
  }
  .mdt-app-table th {
    position:sticky; top:0; background:var(--bg2); text-align:left;
    padding:6px 10px; color:var(--dim); font-size:10px; font-weight:600;
    font-family:var(--ui); border-bottom:1px solid var(--bdr);
    white-space:nowrap; user-select:none; z-index:1;
    text-transform:uppercase; letter-spacing:.05em;
  }
  .mdt-app-table td {
    padding:5px 10px; border-bottom:1px solid var(--bdr-soft);
    max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    cursor:default; color:var(--wht);
  }
  .mdt-app-table tbody tr:nth-child(even) td { background:rgba(255,255,255,.015); }
  .mdt-app-table tr:hover td { background:rgba(255,255,255,.05); }
  .mdt-app-table tr.sel td { background:#094771; }
  /* Panel detail/pratinjau di bagian bawah */
  #mdt-app-preview {
    flex-shrink:0; border-top:1px solid var(--bdr); background:var(--bg1);
    min-height:60px; max-height:30%; overflow:auto; padding:10px 12px;
    font-size:11px; font-family:var(--mono); color:var(--wht);
    scrollbar-width:thin;
  }
  #mdt-app-preview.hidden { display:none; }
  .mdt-app-empty {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    height:100%; color:var(--dim); font-family:var(--ui); text-align:center; gap:8px;
    padding:24px;
  }
  .mdt-app-empty-icon { font-size:28px; opacity:.35; }
  .mdt-app-empty-title { font-size:13px; font-weight:600; color:var(--wht); opacity:.75; }
  .mdt-app-empty-sub { font-size:11px; color:var(--dim2); }

  /* Sakelar seluler untuk navigasi */
  #mdt-app-mob-toggle {
    display:${IS_MOBILE ? "flex" : "none"};
    align-items:center; gap:6px; padding:6px 10px;
    background:var(--bg2); border-bottom:1px solid var(--bdr);
    font-size:11px; font-family:var(--ui); color:var(--dim);
    cursor:pointer; -webkit-tap-highlight-color:transparent; flex-shrink:0;
  }
  #mdt-app-mob-toggle:hover { color:var(--wht); }

  /* Kompatibilitas lama */
  .mdt-scard,.mdt-scard-hdr,.mdt-sdel,.mdt-stable,.mdt-empty { display:none!important; }
  #mdt-stor-scroll { display:none!important; }

  /* ==================================================================
     PANEL UA
     ================================================================== */
  #mdt-ua-scroll { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; scrollbar-width:thin; -webkit-overflow-scrolling:touch; }
  .mdt-uarow { display:flex; align-items:flex-start; gap:12px; background:var(--bg1); border:1px solid var(--bdr); border-radius:var(--r-lg); padding:10px 14px; box-shadow:var(--shadow-1); }
  .mdt-uaicon { font-size:12px; flex-shrink:0; width:22px; height:22px; display:flex; align-items:center; justify-content:center; text-align:center; color:var(--acc); background:var(--acc-soft); border-radius:50%; font-weight:700; }
  .mdt-ualbl { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); font-family:var(--ui); }
  .mdt-uaval { font-size:12px; color:var(--wht); word-break:break-word; margin-top:2px; }

  /* ==================================================================
     TOMBOL MELAYANG
     ================================================================== */
  #mdt-fab {
    position:fixed; z-index:2147483647; bottom:${IS_FF_MOBILE ? "calc(14px + env(safe-area-inset-bottom, 0px))" : "14px"}; right:14px;
    width:${IS_MOBILE ? "46px" : "38px"}; height:${IS_MOBILE ? "46px" : "38px"}; border-radius:50%; cursor:pointer;
    background:var(--bg); border:1px solid rgba(86,156,214,.45);
    color:var(--acc); display:none; align-items:center; justify-content:center;
    box-shadow:0 4px 18px rgba(0,0,0,.65); touch-action:manipulation;
    transition:background var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  #mdt-fab:hover { background:var(--bg2); transform:scale(1.08); box-shadow:0 6px 22px rgba(0,0,0,.75); }
  #mdt-fab:active { transform:scale(.98); }
  #mdt-fab svg { width:${IS_MOBILE ? "22px" : "18px"}; height:${IS_MOBILE ? "22px" : "18px"}; }
  /* Ikon tombol mengambang: memakai berkas ikon ekstensi (icons/icon.png). */
  #mdt-fab img.mdt-fab-img {
    width:${IS_MOBILE ? "34px" : "28px"}; height:${IS_MOBILE ? "34px" : "28px"};
    object-fit:contain; display:block; border-radius:50%; pointer-events:none;
  }

  /* ==================================================================
     INSPEKSI
     ================================================================== */
  #mdt-iov { position:fixed; inset:0; z-index:2147483643; display:none; cursor:crosshair; }
  #mdt-iov.on { display:block; }
  #mdt-ihl { position:fixed; pointer-events:none; z-index:2147483644; border:1px dashed var(--acc); background:var(--acc-soft); display:none; }
  #mdt-itip {
    position:fixed; pointer-events:none; z-index:2147483645;
    background:var(--bg1); border:1px solid rgba(86,156,214,.5); border-radius:var(--r);
    padding:5px 9px; font-size:11px; color:var(--wht); display:none;
    font-family:var(--mono); max-width:280px; box-shadow:var(--shadow-2);
  }

  /* Firefox Seluler: pastikan papan ketik tidak menutupi */
  @supports (-moz-appearance:none) {
    #mdt-root { bottom:0; }
    #mdt-repl { font-size:16px; } /* Cegah zoom iOS/FF saat input difokuskan */
  }

  /* ==================================================================
     PERFORMA: containment & reduced motion
     Membatasi radius dampak reflow/repaint pada panel-panel utama.
     Untuk perangkat lambat, ini menurunkan biaya gulir di log dan
     daftar jaringan secara drastis.
     ================================================================== */
  #mdt-root { contain: layout style; }
  .mdt-panel { contain: layout style; }
  #mdt-logwrap, #mdt-net-list, #mdt-src-code {
    contain: strict; content-visibility: auto;
  }
  .mdt-log, .mdt-net-row, .mdt-src-line {
    contain: layout style;
    content-visibility: auto;
    contain-intrinsic-size: auto 22px;
  }

  /* Menghormati prefers-reduced-motion: tanpa animasi bila pengguna
     mengaktifkan "reduce motion" pada tingkat sistem. */
  @media (prefers-reduced-motion: reduce) {
    #mdt-root, #mdt-fab, .mdt-tab, .mdt-tbtn, .mdt-chip,
    #mdt-assistant, #mdt-assistant.idle, #mdt-assistant-bubble {
      animation: none !important;
      transition: none !important;
    }
  }

  /* ==================================================================
     PANEL TENTANG (kartu informasi + tautan)
     ================================================================== */
  .mdt-about-card { margin:12px 14px 0; }
  .mdt-about-card .mdt-pmv { text-align:right; max-width:62%; word-break:break-word; }
  .mdt-about-section-title {
    font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.08em;
    color:var(--dim); font-family:var(--ui);
    padding:16px 16px 4px;
  }
  .mdt-pma {
    color:var(--acc); font-size:12px; font-weight:600; font-family:var(--ui);
    text-decoration:none; text-align:right; max-width:62%; word-break:break-all;
    border-bottom:1px dashed rgba(86,156,214,.5);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-pma:hover { color:var(--info); }
  .mdt-pma:active { opacity:.7; }

  /* ==================================================================
     PANEL PENGATURAN
     ================================================================== */
  #mdt-settings-scroll {
    flex:1; overflow-y:auto; padding:12px 12px 20px;
    display:flex; flex-direction:column; gap:12px;
    scrollbar-width:thin; -webkit-overflow-scrolling:touch;
  }
  .mdt-set-group { display:flex; flex-direction:column; gap:10px; }
  .mdt-set-group-title {
    margin:0; font-size:10px; font-weight:600; text-transform:uppercase;
    letter-spacing:.08em; color:var(--dim); font-family:var(--ui);
  }
  .mdt-set-hint {
    font-size:11px; color:var(--dim2); font-family:var(--ui); line-height:1.6;
  }
  .mdt-set-row {
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    flex-wrap:wrap; padding:3px 0; border-bottom:1px solid var(--bdr-soft);
  }
  .mdt-set-row:last-child { border-bottom:none; }
  .mdt-set-lbl { color:var(--wht); font-size:12px; font-family:var(--ui); flex:1 1 auto; }
  .mdt-set-val {
    color:var(--acc); font-size:11px; font-weight:700; font-family:var(--mono);
    min-width:42px; text-align:right; flex-shrink:0;
  }
  .mdt-set-range {
    -webkit-appearance:none; appearance:none; width:100%;
    height:4px; border-radius:999px; background:var(--bg3);
    outline:none; margin:2px 0 4px; flex-basis:100%;
  }
  .mdt-set-range::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; width:16px; height:16px;
    border-radius:50%; background:var(--acc); cursor:pointer;
    box-shadow:var(--shadow-1);
  }
  .mdt-set-range::-moz-range-thumb {
    width:16px; height:16px; border:none; border-radius:50%;
    background:var(--acc); cursor:pointer; box-shadow:var(--shadow-1);
  }
  .mdt-set-range::-moz-range-track { height:4px; border-radius:999px; background:var(--bg3); }

  .mdt-seg {
    display:inline-flex; border:1px solid var(--bdr); border-radius:var(--r);
    overflow:hidden; flex-shrink:0;
  }
  .mdt-seg-btn {
    background:var(--bg2); color:var(--dim); border:none; cursor:pointer;
    padding:0 12px; height:var(--ctl); font-size:11px; font-family:var(--ui);
    -webkit-tap-highlight-color:transparent;
    transition:background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .mdt-seg-btn + .mdt-seg-btn { border-left:1px solid var(--bdr); }
  .mdt-seg-btn.on { background:var(--acc); color:#fff; }

  .mdt-set-ck {
    display:flex; align-items:center; gap:9px;
    padding:7px 0; font-size:12px; font-family:var(--ui); color:var(--wht);
    cursor:pointer; -webkit-tap-highlight-color:transparent;
    border-bottom:1px solid var(--bdr-soft);
  }
  .mdt-set-ck:last-of-type { border-bottom:none; }
  .mdt-set-ck input[type=checkbox] {
    accent-color:var(--acc); width:15px; height:15px; flex-shrink:0; cursor:pointer;
  }
  .mdt-set-num {
    width:92px; height:var(--ctl); background:var(--bg2); color:var(--wht);
    border:1px solid var(--bdr); border-radius:var(--r); padding:0 8px;
    font-size:12px; font-family:var(--mono); flex-shrink:0;
  }
  .mdt-set-num:focus { border-color:var(--acc); box-shadow:0 0 0 2px var(--acc-soft); }
  .mdt-set-footer { display:flex; justify-content:stretch; }
  .mdt-set-reset {
    width:100%; height:var(--touch); border-radius:var(--r);
    background:var(--bg2); color:var(--wht); border:1px solid var(--bdr);
    font-size:12px; font-family:var(--ui); font-weight:600; cursor:pointer;
    -webkit-tap-highlight-color:transparent;
    transition:border-color var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  .mdt-set-reset:hover { border-color:var(--acc); background:var(--acc-soft); }
  .mdt-set-reset:active { transform:translateY(1px); }

  /* Cap waktu pada entri Konsol. */
  .mdt-le-time {
    color:var(--dim2); font-size:10px; font-family:var(--mono);
    flex-shrink:0; opacity:.85;
  }
  /* Penanda jumlah pada log yang digabung (grup serupa). */
  .mdt-le-count {
    color:var(--acc); background:var(--acc-soft); border-radius:999px;
    font-size:10px; font-weight:700; font-family:var(--ui);
    padding:1px 6px; flex-shrink:0; margin-left:4px;
  }

  /* ------------------------------------------------------------------
     Fase 2 - Konsol lanjutan: salin log, jejak tumpukan, pohon objek.
     ------------------------------------------------------------------ */
  /* Entri log boleh membungkus agar jejak tumpukan turun ke baris baru. */
  .mdt-logentry { flex-wrap:wrap; }
  /* Tombol salin per entri (tampil saat disorot; selalu di seluler). */
  .mdt-le-copy {
    position:absolute; top:2px; right:6px; z-index:2;
    background:var(--bg2); color:var(--acc); border:1px solid var(--bdr);
    border-radius:var(--r-sm); font-size:10px; font-family:var(--ui);
    padding:1px 6px; cursor:pointer;
    opacity:${IS_MOBILE ? "0.9" : "0"};
    pointer-events:${IS_MOBILE ? "auto" : "none"};
    transition:opacity var(--dur) var(--ease), border-color var(--dur) var(--ease);
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-logentry:hover .mdt-le-copy,
  .mdt-logentry:focus-within .mdt-le-copy { opacity:1; pointer-events:auto; }
  .mdt-le-copy:hover { border-color:var(--acc); background:var(--acc-soft); }
  /* Jejak tumpukan yang bisa dibuka/tutup. */
  .mdt-le-stk { width:100%; }
  .mdt-stk-head {
    display:flex; align-items:center; gap:5px; cursor:pointer;
    color:var(--dim); font-family:var(--ui); font-size:10px;
    user-select:none; padding:1px 0;
  }
  .mdt-stk-head:hover { color:var(--wht); }
  .mdt-stk-caret { color:var(--acc); font-size:9px; }
  .mdt-stk-body { display:none; white-space:pre-wrap; }
  .mdt-le-stk.open .mdt-stk-body { display:block; }
  /* Pohon objek/array bertingkat. */
  .mdt-obj { display:block; }
  .mdt-obj-head { display:flex; align-items:baseline; gap:3px; }
  .mdt-obj-toggle {
    cursor:pointer; color:var(--dim); font-size:9px; width:11px;
    flex-shrink:0; text-align:center; user-select:none;
  }
  .mdt-obj-toggle:hover { color:var(--acc); }
  .mdt-obj-key { color:var(--acc); }
  .mdt-obj-brace { color:var(--dim); }
  .mdt-obj-val { color:var(--wht); }
  .mdt-obj-children {
    display:none; margin-left:11px; padding-left:7px;
    border-left:1px solid var(--bdr-soft);
  }
  .mdt-obj.open > .mdt-obj-children { display:block; }
  .mdt-obj-leaf .mdt-obj-val { color:var(--grn); }

  /* ==================================================================
     FASE 3 - ELEMEN (area 2): sunting atribut/teks, edit CSS langsung,
     box model, event listener, dan pembaruan DOM otomatis.
     ================================================================== */

  /* -- Sunting atribut sebaris pada baris pohon -- */
  .mdt-an[title], .mdt-av[title] { cursor:text; }
  .mdt-attr-addbtn {
    display:none; align-items:center; justify-content:center;
    margin-left:2px; width:14px; height:14px; flex-shrink:0;
    border:1px solid var(--bdr); border-radius:var(--r-sm);
    background:transparent; color:var(--dim); cursor:pointer;
    font-size:11px; line-height:1; padding:0;
    -webkit-tap-highlight-color:transparent;
  }
  .mdt-drow2:hover .mdt-attr-addbtn { display:inline-flex; }
  @media (pointer:coarse) { .mdt-attr-addbtn { display:inline-flex; } }
  .mdt-attr-addbtn:hover { color:var(--acc); border-color:var(--acc); }
  .mdt-attr-new { display:inline-flex; align-items:center; }
  /* Input edit sebaris di pohon DOM */
  .mdt-inline-edit {
    height:16px; min-width:48px; max-width:180px;
    background:var(--bg); border:1px solid var(--acc); border-radius:var(--r-sm);
    color:var(--wht); font-family:var(--mono); font-size:11px;
    padding:0 4px; outline:none; vertical-align:baseline;
    -webkit-appearance:none;
  }
  .mdt-inline-edit:focus { box-shadow:0 0 0 1px var(--acc); }

  /* -- Baris tambah properti pada blok gaya -- */
  .mdt-add-prop { cursor:pointer; }
  .mdt-add-prop:hover { color:var(--acc); }
  .mdt-addprop-input input { min-width:120px; }

  /* -- Diagram box model -- */
  #mdt-box-body {
    flex:1; overflow-y:auto; scrollbar-width:thin;
    -webkit-overflow-scrolling:touch; padding:8px;
  }
  .mdt-boxmodel { display:flex; justify-content:center; padding:6px 0 10px; }
  .mdt-box-layer {
    position:relative; border:1px dashed;
    display:flex; align-items:center; justify-content:center;
    min-width:60px; min-height:44px;
  }
  .mdt-box-margin  { border-color:rgba(215,186,125,.55); background:rgba(215,186,125,.06); padding:22px; }
  .mdt-box-border  { border-style:solid; border-color:rgba(220,220,170,.7); background:rgba(220,220,170,.05); padding:18px; }
  .mdt-box-padding { border-color:rgba(78,201,176,.55); background:rgba(78,201,176,.06); padding:16px; }
  .mdt-box-content {
    border:1px solid rgba(86,156,214,.6); background:rgba(86,156,214,.12);
    padding:12px 16px; display:flex; align-items:center; justify-content:center;
    min-width:52px; min-height:30px;
  }
  .mdt-box-size { font-family:var(--mono); font-size:10px; color:var(--wht); white-space:nowrap; }
  .mdt-box-layer-name {
    position:absolute; font-family:var(--ui); font-size:9px; color:var(--dim);
    text-transform:uppercase; letter-spacing:.05em;
  }
  .mdt-box-margin  > .mdt-box-layer-name { top:2px; left:4px; }
  .mdt-box-border  > .mdt-box-layer-name { top:2px; left:4px; }
  .mdt-box-padding > .mdt-box-layer-name { top:2px; left:4px; }
  .mdt-box-side {
    position:absolute; font-family:var(--mono); font-size:9px; color:var(--dim);
    background:var(--bg); padding:0 2px; border-radius:2px; pointer-events:none;
  }
  .mdt-box-side.top    { top:-7px;  left:50%; transform:translateX(-50%); }
  .mdt-box-side.right  { right:-4px; top:50%; transform:translateY(-50%) rotate(90deg); }
  .mdt-box-side.bottom { bottom:-7px; left:50%; transform:translateX(-50%); }
  .mdt-box-side.left   { left:-4px;  top:50%; transform:translateY(-50%) rotate(-90deg); }
  .mdt-box-inner { display:flex; }
  .mdt-box-summary { border-top:1px solid var(--bdr); padding-top:6px; }
  .mdt-box-sumrow { display:flex; gap:8px; padding:2px 6px; font-size:11px; }
  .mdt-box-sumkey { width:64px; flex-shrink:0; color:var(--dim); font-family:var(--ui); }
  .mdt-box-sumval { color:var(--wht); font-family:var(--mono); word-break:break-all; }

  /* -- Daftar event listener -- */
  #mdt-events-body {
    flex:1; overflow-y:auto; scrollbar-width:thin;
    -webkit-overflow-scrolling:touch; padding:2px 0;
  }
  .mdt-event-row {
    display:flex; align-items:baseline; gap:6px; padding:4px 8px;
    font-size:11px; font-family:var(--mono); border-bottom:1px solid var(--bdr-soft);
  }
  .mdt-event-row:hover { background:rgba(255,255,255,.04); }
  .mdt-event-type { color:var(--acc); flex-shrink:0; }
  .mdt-event-detail { color:var(--wht); flex:1; word-break:break-all; }
  .mdt-event-meta { color:var(--dim); font-size:10px; font-family:var(--ui); flex-shrink:0; }
  .mdt-event-note {
    padding:8px 10px; font-size:10px; color:var(--dim2); font-family:var(--ui);
    line-height:1.6; border-top:1px solid var(--bdr-soft);
  }

  /* -- Tombol toggle pembaruan otomatis DOM -- */
  .mdt-dom-auto.on { color:var(--acc) !important; box-shadow:0 0 0 2px var(--acc-soft); }
  `;
  };
})();
