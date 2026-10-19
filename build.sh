#!/usr/bin/env bash
set -e
echo "==> Memvalidasi sintaks JavaScript..."
# Penting: `node -c file1 file2 ...` hanya memeriksa BERKAS PERTAMA.
# Jadi setiap berkas diperiksa satu per satu di dalam gelung.
for js in bootstrap.js background.js contentScript.js styles.js beautify.js icons-data.js injected.js; do
  if node --check "$js"; then
    echo "    OK: $js"
  else
    echo "    GAGAL: $js" >&2
    exit 1
  fi
done
mkdir -p test
echo "==> Mengemas ekstensi menjadi test/ntdev-tools.zip..."
rm -f test/ntdev-tools.zip
zip -r test/ntdev-tools.zip manifest.json bootstrap.js background.js contentScript.js styles.js beautify.js icons-data.js injected.js icons/ > /dev/null
echo "==> Selesai! Berkas siap di: test/ntdev-tools.zip"
