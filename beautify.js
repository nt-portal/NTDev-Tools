/**
 * NT DevTools — Modul perapi (Beautify)
 *
 * Tujuan modul: menyediakan pewarna sintaksis (syntax highlighter) dan perapi
 * (pretty printer) untuk tiga bahasa yang ditampilkan di panel Sumber
 * (Sources): JavaScript, CSS, dan HTML.
 *
 * Ekspor ke window (window.MDT_BEAUTIFY):
 *
 *   highlightJS  (container, line)  — menambahkan span berwarna (.tok-*) ke container
 *   highlightCSS (container, line)
 *   highlightHTML(container, line)
 *
 *   prettifyJS  (src) -> string   — memformat ulang indentasi dasar
 *   prettifyCSS (src) -> string
 *   prettifyHTML(src) -> string   — tahan masukan cacat, mempertahankan isi
 *                                   tag pre, script, style, dan textarea
 *
 * Kelas token yang dihasilkan (.tok-cmt, .tok-str, .tok-num, .tok-kw,
 * .tok-cls, .tok-fn, .tok-prop, .tok-op, .tok-rx) diberi gaya oleh styles.js.
 *
 * Modul ini tidak mengasumsikan struktur pohon DOM, tidak menyimpan status
 * global ekstensi, dan tidak melakukan panggilan jaringan.
 */
"use strict";

(function () {
  if (window.MDT_BEAUTIFY) return;

  /* Helper DOM mikro — mandiri agar modul tidak bergantung pada berkas lain. */

  /* sp(cls, text) — membuat elemen <span>.
     Bila argumen cls diisi, kelas itu dipasang; bila argumen text diisi,
     teksnya menjadi isi span. Dipakai untuk membungkus sebuah token dengan
     kelas warna .tok-* agar diwarnai oleh aturan di styles.js.
     Mengembalikan elemen span yang belum disisipkan ke DOM. */
  function sp(cls, text) {
    var s = document.createElement("span");
    if (cls) s.className = cls;
    if (text !== undefined) s.textContent = text;
    return s;
  }
  /* tx(text) — membuat node teks (document.createTextNode) dari nilai apa pun
     yang dikonversi menjadi string. Dipakai untuk potongan kode yang tidak
     perlu diwarnai, misalnya spasi, tanda baca, atau teks biasa. */
  function tx(text) {
    return document.createTextNode(String(text));
  }

  /* ── JavaScript ──────────────────────────────────────────────── */

  /* tokenizeJS(line) — tokenizer satu lintasan untuk satu baris JavaScript.
     Mengembalikan larik pasangan [kelas, teks]. Kelas token yang mungkin:
       cmt   -> komentar                 (kelas CSS .tok-cmt)
       str   -> literal string           (.tok-str)
       rx    -> literal regex            (.tok-rx)
       num   -> angka                    (.tok-num)
       kw    -> kata kunci               (.tok-kw)
       cls   -> nama kelas (huruf besar) (.tok-cls)
       op    -> operator dan tanda baca  (.tok-op)
       ident -> pengenal biasa; berubah menjadi prop bila tepat mengikuti
                tanda titik (akses properti), menjadi fn bila diikuti tanda
                kurung buka, atau tanpa kelas (tanpa warna) untuk sisanya.
     Status lastWasDot menyimpan apakah token sebelumnya berakhir dengan titik. */
  function tokenizeJS(line) {
    /* Tokenizer satu lintasan. Melacak apakah token "op" sebelumnya diakhiri
       dengan "." sehingga pengenal tanpa kelas yang tepat berada setelah titik
       diklasifikasikan sebagai "prop" (akses properti). */
    var tokens = [], pos = 0, lastWasDot = false;
    var patterns = [
      ["cmt",   /^\/\/.*/],
      ["str",   /^(['"`])(?:\\.|(?!\1)[^\\])*\1/],
      ["rx",    /^\/(?:[^\/\\\n]|\\.)+\/[gimsuy]*/],
      ["num",   /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/],
      ["kw",    /^\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|typeof|instanceof|null|undefined|true|false|this|super|async|await|import|export|from|default|extends|static|of|in|yield|delete|void)\b/],
      ["cls",   /^\b([A-Z][A-Za-z0-9_]*)\b/],
      ["ident", /^\b([a-z_$][a-zA-Z0-9_$]*)\b/],
      ["op",    /^[=!<>+\-*/%&|^~?:,;.[\]{}()]+/],
    ];
    while (pos < line.length) {
      var matched = false;
      for (var p = 0; p < patterns.length; p++) {
        var cls = patterns[p][0], rx = patterns[p][1];
        var m = line.slice(pos).match(rx);
        if (!m) continue;
        var realCls = cls;
        if (cls === "ident") {
          if (lastWasDot) realCls = "prop";
          else if (/\s*\(/.test(line.slice(pos + m[0].length))) realCls = "fn";
          else realCls = "";
        }
        if (cls === "op") lastWasDot = m[0].endsWith(".");
        else if (cls !== "") lastWasDot = false;
        tokens.push([realCls, m[0]]);
        pos += m[0].length;
        matched = true;
        break;
      }
      if (!matched) {
        lastWasDot = false;
        tokens.push(["", line[pos]]);
        pos++;
      }
    }
    return tokens;
  }

  /* highlightJS(container, line) — memanggil tokenizeJS lalu menambahkan tiap
     token ke dalam container: token berkelas menjadi elemen
     <span class="tok-...">, sedangkan token tanpa kelas menjadi node teks.
     Tidak mengembalikan nilai; efeknya menambah anak pada container. */
  function highlightJS(container, line) {
    var tokens = tokenizeJS(line);
    for (var i = 0; i < tokens.length; i++) {
      var cls = tokens[i][0], text = tokens[i][1];
      container.appendChild(cls ? sp("tok-" + cls, text) : tx(text));
    }
  }

  /* prettifyJS(src) — perapi satu lintasan yang sadar string dan komentar.
     Menyisipkan baris baru dan indentasi setelah kurung/kurawal buka serta
     tanda titik koma, dan sebelum kurung/kurawal tutup.
     Mengembalikan string hasil yang sudah dirapikan. */
  function prettifyJS(src) {
    /* Perapi satu lintasan yang sadar string dan komentar.
       Menyisipkan baris baru dan indentasi setelah tanda buka { [ ; serta
       sebelum tanda tutup } ]. */
    var out = "", indent = 0, i = 0, inStr = false, strChar = "", inCmt = false;
    var ind = function () { return "  ".repeat(indent); };
    while (i < src.length) {
      var c = src[i];
      if (inCmt) {
        out += c;
        if (c === "*" && src[i + 1] === "/") { out += src[++i]; inCmt = false; }
      } else if (inStr) {
        out += c;
        if (c === "\\") out += src[++i];
        else if (c === strChar) inStr = false;
      } else if (c === "/" && src[i + 1] === "*") {
        inCmt = true; out += c;
      } else if (c === "/" && src[i + 1] === "/") {
        while (i < src.length && src[i] !== "\n") out += src[i++];
        continue;
      } else if (c === '"' || c === "'" || c === "`") {
        inStr = true; strChar = c; out += c;
      } else if (c === "{" || c === "[") {
        out += c + "\n" + ind() + "  "; indent++;
      } else if (c === "}" || c === "]") {
        indent--; out += "\n" + ind() + c;
      } else if (c === ";") {
        out += c + "\n" + ind();
      } else {
        out += c;
      }
      i++;
    }
    return out;
  }

  /* ── CSS ─────────────────────────────────────────────────────── */

  /* highlightCSS(container, line) — pewarnaan sederhana per baris CSS:
       - baris komentar        -> satu span .tok-cmt
       - baris "prop: value;"  -> nama properti .tok-prop dan nilai .tok-str,
                                  sedangkan titik dua dan titik koma tetap teks
       - baris lain (selektor) -> satu span .tok-fn
     Tidak mengembalikan nilai. */
  function highlightCSS(container, line) {
    var propRx = /^(\s*)([\w-]+)\s*:\s*(.*?)(;?)$/;
    if (/\/\*.*/.test(line.trim())) {
      container.appendChild(sp("tok-cmt", line));
      return;
    }
    var m = line.match(propRx);
    if (m) {
      container.appendChild(tx(m[1]));
      container.appendChild(sp("tok-prop", m[2]));
      container.appendChild(tx(": "));
      container.appendChild(sp("tok-str", m[3]));
      container.appendChild(tx(m[4]));
      return;
    }
    container.appendChild(sp("tok-fn", line));
  }

  /* prettifyCSS(src) — merapikan CSS: merapatkan spasi dan baris kosong yang
     ada lebih dulu, lalu menulis ulang dengan indentasi konsisten (2 spasi)
     setelah tanda pembuka, tanda penutup, dan titik koma.
     Mengembalikan string CSS yang sudah rapi. */
  function prettifyCSS(src) {
    /* Rapatkan spasi yang ada, lalu tulis ulang dengan indentasi yang konsisten. */
    var out = "", indent = 0;
    var ind = function () { return "  ".repeat(indent); };
    var s = src.replace(/\s*\n\s*/g, "\n").replace(/\n+/g, "\n");
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === "{") {
        out += " {\n"; indent++; out += ind();
      } else if (c === "}") {
        indent = Math.max(0, indent - 1);
        out = out.replace(/\s+$/, "") + "\n" + ind() + "}\n" + ind();
      } else if (c === ";") {
        out += ";\n" + ind();
      } else if (c !== "\n") {
        out += c;
      }
    }
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  }

  /* ── HTML ────────────────────────────────────────────────────── */

  /* highlightHTML(container, line) — tokenisasi HTML per baris. Pola yang
     dicocokkan secara berurutan:
       1) komentar HTML             -> span .tok-cmt
       2) tag pembuka atau penutup  -> tanda <, >, dan / menjadi .tok-op;
                                       nama tag menjadi .tok-fn;
                                       nama atribut menjadi .tok-prop;
                                       nilai atribut menjadi .tok-str
       3) teks biasa di antara tag  -> node teks tanpa warna
     Tidak mengembalikan nilai. */
  function highlightHTML(container, line) {
    /* Tokenisasi per baris. Pencocokan dilakukan berurutan:
         1) komentar HTML
         2) <tag attr="v">  atau  </tag>
         3) teks biasa di antara tag */
    var tagRx = /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?>)|([^<]+)/g;
    var m;
    while ((m = tagRx.exec(line)) !== null) {
      if (m[1]) {
        container.appendChild(sp("tok-cmt", m[1]));
      } else if (m[2]) {
        container.appendChild(sp("tok-op", m[2]));
        container.appendChild(sp("tok-fn", m[3]));
        if (m[4]) {
          var attrRx = /(\s+)([\w:-]+)(?:(=)("[^"]*"|'[^']*'|[^\s>]+))?/g;
          var am;
          while ((am = attrRx.exec(m[4])) !== null) {
            container.appendChild(tx(am[1]));
            container.appendChild(sp("tok-prop", am[2]));
            if (am[3]) {
              container.appendChild(sp("tok-op", am[3]));
              container.appendChild(sp("tok-str", am[4]));
            }
          }
        }
        container.appendChild(sp("tok-op", m[5]));
      } else if (m[6]) {
        container.appendChild(tx(m[6]));
      }
    }
  }

  /* Daftar tag "void" HTML: tidak punya tag penutup sehingga tidak menambah
     tingkat indentasi. Daftar tag "preserve": isinya dipertahankan mentah
     tanpa pemformatan ulang. */
  var VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  var PRESERVE_TAGS = new Set(["pre", "script", "style", "textarea"]);

  /* prettifyHTML(src) — perapi HTML berbasis tag. Tahan terhadap masukan
     yang cacat dan tidak pernah melempar galat. Isi tag pre, script, style,
     dan textarea dipertahankan apa adanya (tidak diformat ulang).
     Mengembalikan string HTML yang sudah rapi. */
  function prettifyHTML(src) {
    /* Perapi berbasis tag. Tahan terhadap masukan yang cacat dan tidak pernah
       melempar galat. Isi tag pre, script, style, dan textarea dipertahankan
       apa adanya, tanpa diubah sama sekali. */
    var out = "", indent = 0, i = 0, n = src.length;
    var ind = function () { return "  ".repeat(indent); };

    while (i < n) {
      if (src[i] !== "<") {
        var next = src.indexOf("<", i);
        var text = (next === -1 ? src.slice(i) : src.slice(i, next)).trim();
        if (text) out += "\n" + ind() + text;
        i = next === -1 ? n : next;
        continue;
      }

      /* Komentar */
      if (src.substr(i, 4) === "<!--") {
        var endC = src.indexOf("-->", i);
        if (endC === -1) { out += src.slice(i); break; }
        out += "\n" + ind() + src.slice(i, endC + 3);
        i = endC + 3;
        continue;
      }

      /* DOCTYPE / instruksi pemrosesan — ditulis apa adanya */
      if (src[i + 1] === "!" || src[i + 1] === "?") {
        var endP = src.indexOf(">", i);
        if (endP === -1) { out += src.slice(i); break; }
        out += (out ? "\n" : "") + ind() + src.slice(i, endP + 1);
        i = endP + 1;
        continue;
      }

      /* Tag */
      var endT = src.indexOf(">", i);
      if (endT === -1) { out += src.slice(i); break; }
      var tag = src.slice(i, endT + 1);
      var closing = tag[1] === "/";
      var nameMatch = tag.match(/^<\/?([a-zA-Z][\w-]*)/);
      var tagName = nameMatch ? nameMatch[1].toLowerCase() : "";
      var selfClose = tag.endsWith("/>") || VOID_TAGS.has(tagName);

      if (closing) {
        indent = Math.max(0, indent - 1);
        out += "\n" + ind() + tag;
      } else {
        out += (out ? "\n" : "") + ind() + tag;
        if (!selfClose) indent++;
      }
      i = endT + 1;

      /* Pertahankan isi mentah untuk tag khusus */
      if (!closing && !selfClose && PRESERVE_TAGS.has(tagName)) {
        var closeRx = new RegExp("</" + tagName + "\\s*>", "i");
        var rest = src.slice(i);
        var cm = rest.match(closeRx);
        if (cm) {
          out += rest.slice(0, cm.index);
          indent = Math.max(0, indent - 1);
          out += "\n" + ind() + cm[0];
          i += cm.index + cm[0].length;
        }
      }
    }
    return out.replace(/^\n/, "").replace(/\n{3,}/g, "\n\n");
  }

  /* ── Ekspor ──────────────────────────────────────────────────── */

  window.MDT_BEAUTIFY = {
    highlightJS: highlightJS,
    highlightCSS: highlightCSS,
    highlightHTML: highlightHTML,
    prettifyJS: prettifyJS,
    prettifyCSS: prettifyCSS,
    prettifyHTML: prettifyHTML
  };
})();
