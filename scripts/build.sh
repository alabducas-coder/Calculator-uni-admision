#!/usr/bin/env bash
# ============================================================================
# Construye la Calculadora CASIO HL-4A: pruebas + .exe de Windows + ZIP.
# Requiere: zig (compilador cruzado) en $PATH o en $ZIG, gcc, python3, node (opcional).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ZIG="${ZIG:-zig}"
export ZIG_LOCAL_CACHE_DIR="${ZIG_LOCAL_CACHE_DIR:-/tmp/zc}"
export ZIG_GLOBAL_CACHE_DIR="${ZIG_GLOBAL_CACHE_DIR:-/tmp/zgc}"

echo "== 1) Pruebas de logica (C, nativo) =="
gcc -std=c11 -Isrc -o /tmp/hl4a_test src/test_core.c -lm
/tmp/hl4a_test

echo "== 2) Icono y recursos =="
python3 tools/make_icon.py
"$ZIG" rc src/app.rc src/app.res

echo "== 3) Compilacion cruzada Windows (x64 y x86) =="
"$ZIG" cc -target x86_64-windows-gnu -O2 -municode -o dist/hl4a-x64.exe src/hl4a_win.c src/app.res -luser32 -lgdi32
"$ZIG" cc -target x86-windows-gnu    -O2 -municode -o dist/hl4a-x86.exe src/hl4a_win.c src/app.res -luser32 -lgdi32
rm -f dist/*.pdb
echo "   -> dist/hl4a-x64.exe y dist/hl4a-x86.exe"

echo "== 4) Pruebas de logica (Web/JS) si hay node =="
if command -v node >/dev/null 2>&1; then
  python3 - <<'EOF'
import re
html=open('web/index.html').read()
js=re.search(r'<script>\n(.*?)</script>', html, re.S).group(1)
core=js[js.index('/* ================= logica'):js.index('/* ================= display')]
open('/tmp/hl4a_core.js','w').write(core)
EOF
  cat > /tmp/hl4a_drv.js <<'EOF'
function D(){
  if(!S.power) return "";
  if(S.err) return "E";
  if(S.entering) return (S.negEntry?"-":"")+S.entry;
  return fmtNumber(S.cur) ?? "E";
}
function type(s){
  for(const c of s){
    if(c>='0'&&c<='9') keyDigit(+c);
    else if(c==='.') keyDot();
    else if(c==='+') keyOp('+');
    else if(c==='-') keyOp('-');
    else if(c==='*') keyOp('*');
    else if(c==='/') keyOp('/');
    else if(c==='=') keyEq();
    else if(c==='%') keyPct();
    else if(c==='q') keySqrt();
    else if(c==='s') keySign();
    else if(c==='M') keyMplus(1);
    else if(c==='m') keyMplus(-1);
    else if(c==='r') keyMrc();
    else if(c==='c') keyC();
    else if(c==='a') keyAC();
    else if(c==='o') keyOff();
  }
}
let fails=0;
function expect(e,w){ const g=D(); if(g!==w){console.log("FAIL",e,"got",g,"want",w);fails++;} }
keyAC();
expect("inicio","0");
type("12+7="); expect("12+7=","19");
type("a0.1+0.2="); expect("0.1+0.2=","0.3");
type("a200+10%="); expect("200+10%=","220");
type("a5/0="); expect("5/0=","E");
type("a5M3Mr"); expect("mem","8");
type("o"); expect("off","");
type("a"); expect("on","0");
if(fails){ console.log(fails+" FALLOS JS"); process.exit(1); }
console.log("JS OK");
EOF
  cat /tmp/hl4a_core.js /tmp/hl4a_drv.js > /tmp/hl4a_webtest.js
  node /tmp/hl4a_webtest.js
fi

echo "== 5) Empaquetado ZIP =="
STAGE=/tmp/hl4a_stage
rm -rf "$STAGE"; mkdir -p "$STAGE/Calculadora-Casio-HL-4A/Linux-macOS"
cp "dist/hl4a-x64.exe" "$STAGE/Calculadora-Casio-HL-4A/Calculadora HL-4A (Windows 64 bits).exe"
cp "dist/hl4a-x86.exe" "$STAGE/Calculadora-Casio-HL-4A/Calculadora HL-4A (Windows 32 bits).exe"
cp web/index.html      "$STAGE/Calculadora-Casio-HL-4A/Calculadora HL-4A (Web, sin instalacion).html"
cp LEEME.txt           "$STAGE/Calculadora-Casio-HL-4A/LEEME.txt"
cp extras/hl4a_tk.py   "$STAGE/Calculadora-Casio-HL-4A/Linux-macOS/hl4a_tk.py"
mkdir -p dist
rm -f dist/Calculadora-Casio-HL-4A.zip
python3 -c "
import shutil, os
p = shutil.make_archive('/tmp/hl4a_zip', 'zip', '$STAGE')
import shutil as s2; s2.copy(p, 'dist/Calculadora-Casio-HL-4A.zip')
"
ls -la dist/
echo "== Listo =="
