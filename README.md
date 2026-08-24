# Numa — Calculadora

Calculadora web responsiva con una interfaz inspirada en una calculadora física y un historial persistente de resultados.

## Funcionalidades

- Diseño inspirado en las calculadoras electrónicas clásicas.
- Operaciones de suma, resta, multiplicación y división.
- Memoria independiente (`MRC`, `M+`, `M−`), raíz cuadrada, porcentajes y cambio de signo.
- Controles `AC`, borrado de entrada y apagado simulados.
- Historial integrado en la página, con controles para mostrarlo u ocultarlo.
- Conversión individual de cada resultado entre decimal y fracción mediante `F↔D` dentro del historial.
- Resultados guardados localmente en el navegador (`localStorage`).
- Recuperación o eliminación individual de cualquier resultado anterior.
- Soporte de teclado (`0–9`, operadores, `Enter`, `Backspace`, `Esc`).
- Diseño adaptable a escritorio, tableta y móvil.

## Aplicación para Windows

El programa portable se genera como `release/Numa-Calculadora-Windows-1.0.0.exe`. No necesita instalación: basta con abrir el archivo en Windows de 64 bits.

Para reconstruir el ejecutable:

```bash
npm install
npm run build:windows
```

## Ejecutar como página web

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Luego abre `http://localhost:4173`.
