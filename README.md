# Calculator-uni-admision · Calculadora CASIO HL-4A

Emulador de escritorio y web de la calculadora de bolsillo **CASIO HL-4A**
(8 dígitos), con su distribución de teclas original:

```
MRC  M−  M+  √  OFF
AC   C   +/−  %
7    8   9   ÷
4    5   6   ×
1    2   3   −
0    •   =   +
```

## Qué hay en este repositorio

| Carpeta / archivo | Descripción |
|---|---|
| `src/hl4a_core.h` | Lógica de la calculadora (C, sin dependencias) compartida |
| `src/hl4a_win.c` | Emulador de escritorio Windows (Win32/GDI, 7 segmentos) |
| `src/test_core.c` | Pruebas de la lógica (compilan en Linux) |
| `web/index.html` | Versión web de un solo archivo (funciona offline) |
| `extras/hl4a_tk.py` | Versión de escritorio Linux/macOS (Python + Tkinter) |
| `tools/make_icon.py` | Genera el icono `assets/icon.ico` |
| `scripts/build.sh` | Pruebas + compilación cruzada + empaquetado ZIP |
| `dist/` | Ejecutables de Windows y el ZIP distribuible |

## Construir (desde Linux, sin Wine)

```bash
# zig se instala vía npm si no lo tienes:
#   npm i -D @ryoppippi/zig-linux-x64   (el binario queda en node_modules)
ZIG=node_modules/@ryoppippi/zig-linux-x64/zig bash scripts/build.sh
```

El script:

1. Ejecuta las pruebas de lógica en C (nativo).
2. Genera el icono y el recurso `.res`.
3. Compila cruzado `hl4a-x64.exe` y `hl4a-x86.exe` con `zig cc -target x86_64-windows-gnu`.
4. Ejecuta las pruebas de la lógica web con Node.
5. Empaqueta `dist/Calculadora-Casio-HL-4A.zip` listo para distribuir.

## Descargar / usar

Descomprime `dist/Calculadora-Casio-HL-4A.zip` y haz doble clic en el
`.exe` (Windows) — no requiere instalación. Detalles en `LEEME.txt`.

*Emulador no oficial, sin relación con CASIO Computer Co., Ltd.*
