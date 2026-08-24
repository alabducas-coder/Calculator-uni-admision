#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Calculadora CASIO HL-4A (8 digitos) - version de escritorio Linux/macOS.
   Sin dependencias externas: solo Python 3 + Tkinter (incluido en Python).
   Uso:  python3 hl4a_tk.py
"""
import math
import tkinter as tk

class Calc:
    def __init__(self):
        self.mem = 0.0
        self.reset()
    def reset(self):
        m = self.mem
        self.power, self.err = True, False
        self.acc, self.op, self.cur = 0.0, None, 0.0
        self.entering, self.entry, self.neg = False, "", False
        self.justEq, self.lastB, self.lastOp = False, 0.0, None
        self.mrcAA = False
        self.mem = m
    def off(self): self.power = False
    # -- utilidades
    def _edigits(self): return sum(1 for c in self.entry if c not in ".-")
    def _evalue(self):
        if not self.entering: return self.cur
        s = self.entry if self.entry not in (".", "") else "0."
        v = float(s)
        return -v if self.neg else v
    def shown(self): return self._evalue() if self.entering else self.cur
    def fmt(self, v):
        if not math.isfinite(v) or abs(v) >= 99999999.5: return None
        a = abs(v)
        if a >= 1:
            dec = max(0, 8 - (int(math.floor(math.log10(a))) + 1))
        else:
            dec = 8
        t = f"{a:.{dec}f}"
        if "." in t: t = t.rstrip("0").rstrip(".")
        if sum(c.isdigit() for c in t) > 8: return None
        if t in ("0", ""): return "0"
        return ("-" if v < -1e-9 and float(t) != 0 else "") + t
    def _seterr(self): self.err, self.entering, self.op = True, False, None
    def _apply(self, a, op, b):
        return {"+": a+b, "-": a-b, "*": a*b, "/": a/b if b else math.inf}[op]
    def _store(self, r):
        f = self.fmt(r)
        if f is None: self._seterr(); return False
        self.cur = float(f); return True
    # -- teclas
    def digit(self, d):
        if not self.power or self.err: return
        self.mrcAA = False
        if self.entering:
            if self._edigits() >= 8: return
            self.entry += d
        else:
            self.entering, self.neg, self.entry = True, False, d
            if self.justEq: self.op, self.lastOp, self.justEq = None, None, False
    def dot(self):
        if not self.power or self.err: return
        self.mrcAA = False
        if self.entering:
            if "." in self.entry or self._edigits() >= 8: return
            self.entry += "."
        else:
            self.entering, self.neg, self.entry = True, False, "0."
            if self.justEq: self.op, self.lastOp, self.justEq = None, None, False
    def sign(self):
        if not self.power or self.err: return
        if self.entering:
            if self.entry != "0": self.neg = not self.neg
        else: self.cur = -self.cur
    def opk(self, o):
        if not self.power or self.err: return
        self.mrcA, self.justEq = False, False
        if self.entering:
            v = self._evalue()
            if self.op:
                if not self._store(self._apply(self.acc, self.op, v)): return
                self.acc = self.cur
            else: self.acc = v
            self.entering = False
        elif self.op is None: self.acc = self.cur
        self.op = o
    def eq(self):
        if not self.power or self.err: return
        self.mrcAA = False
        if self.op:
            b = self._evalue() if self.entering else self.cur
            r = self._apply(self.acc, self.op, b)
            self.lastB, self.lastOp, self.op, self.entering = b, self.op, None, False
            if not self._store(r): return
            self.justEq = True
        elif self.justEq and self.lastOp:
            self._store(self._apply(self.cur, self.lastOp, self.lastB))
    def pct(self):
        if not self.power or self.err: return
        v = self.shown(); self.entering, self.justEq = False, False
        if self.op in ("+", "-"): self._store(abs(self.acc * v / 100))
        elif self.op == "*": r = self.acc * v / 100; self.op = None; self._store(r)
        elif self.op == "/":
            d2 = v / 100
            if d2 == 0: self._seterr(); return
            r = self.acc / d2; self.op = None; self._store(r)
        else: self._store(v / 100)
    def sqrt(self):
        if not self.power or self.err: return
        v = self.shown()
        if v < 0: self._seterr(); return
        self.entering, self.justEq = False, False
        self._store(math.sqrt(v))
    def mplus(self, s):
        if not self.power or self.err: return
        self.mem += s * self.shown()
        if abs(self.mem) >= 99999999.5: self.mem = s * 99999999.0
        self.entering, self.justEq, self.mrcAA = False, False, False
    def mrck(self):
        if not self.power or self.err: return
        if self.mrcAA: self.mem, self.cur, self.mrcAA = 0.0, 0.0, False
        else: self.entering, self.cur, self.justEq, self.mrcAA = False, self.mem, False, True
    def c(self):
        if not self.power: return
        self.err, self.entering, self.entry, self.neg = False, False, "", False
        self.justEq, self.mrcAA = False, False
    def display(self):
        if not self.power: return ""
        if self.err: return "E"
        if self.entering: return ("-" if self.neg else "") + self.entry
        return self.fmt(self.cur) or "E"

BODY, LCD, KEY, RED = "#474b53", "#d8e2d6", "#2e2b28", "#a05b6e"

class App:
    def __init__(self, root):
        self.c = Calc()
        root.title("Calculadora CASIO HL-4A")
        root.configure(bg=BODY)
        root.resizable(False, False)
        self.lcd = tk.Label(root, text="0", bg=LCD, fg="#141414", anchor="e",
                            font=("DejaVu Sans Mono", 34, "bold"), padx=12, pady=10)
        self.ind = tk.Label(root, text="", bg=LCD, fg="#141414", anchor="w",
                            font=("DejaVu Sans", 9, "bold"))
        tk.Label(root, text="CASIO", bg=BODY, fg="#ededf2",
                 font=("DejaVu Sans", 16, "bold")).pack(pady=(10, 0))
        tk.Label(root, text="ELECTRONIC CALCULATOR  ·  HL-4A", bg=BODY, fg="#b9b3bf",
                 font=("DejaVu Sans", 8)).pack()
        bez = tk.Frame(root, bg="#3b3542", padx=10, pady=10); bez.pack(padx=18, pady=12)
        self.ind.pack(in_=bez, fill="x")
        self.lcd.pack(in_=bez, fill="x")
        rows = [["MRC", "M-", "M+", "SQ", "OFF"],
                ["AC", "C", "SIGN", "PCT"],
                ["7", "8", "9", "DIV"], ["4", "5", "6", "MUL"],
                ["1", "2", "3", "SUB"], ["0", "DOT", "EQ", "ADD"]]
        labels = {"MRC": "MRC", "M-": "M−", "M+": "M+", "SQ": "√", "OFF": "OFF",
                  "AC": "AC", "C": "C", "SIGN": "+/−", "PCT": "%",
                  "DIV": "÷", "MUL": "×", "SUB": "−", "ADD": "+",
                  "DOT": "•", "EQ": "="}
        for r, row in enumerate(rows):
            fr = tk.Frame(root, bg=BODY); fr.pack(padx=20, pady=(0, 8) if r else (0, 4))
            for k in row:
                b = tk.Button(fr, text=labels.get(k, k), bg=RED if k in ("AC", "C") else KEY,
                              fg="#f0f0f0", activebackground="#4a4540", bd=0,
                              font=("DejaVu Sans", 12, "bold"),
                              width=6 if r else 5, height=1 if r else 0,
                              command=lambda k=k: self.press(k))
                b.pack(side="left", padx=4, pady=2, expand=True, fill="x")
        root.bind("<Key>", self.on_key)
        self.render()
    def press(self, k):
        c = self.c
        {"MRC": c.mrck, "M-": lambda: c.mplus(-1), "M+": lambda: c.mplus(1),
         "SQ": c.sqrt, "OFF": c.off, "AC": c.reset, "C": c.c, "SIGN": c.sign,
         "PCT": c.pct, "DIV": lambda: c.opk("/"), "MUL": lambda: c.opk("*"),
         "SUB": lambda: c.opk("-"), "ADD": lambda: c.opk("+"), "DOT": c.dot,
         "EQ": c.eq}.get(k, lambda: c.digit(k))()
        self.render()
    def on_key(self, e):
        m = {".": "DOT", "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV",
             "\r": "EQ", "=": "EQ", "\x1b": "AC", "\x7f": "C", "\b": "C",
             "%": "PCT", "r": "SQ", "R": "SQ"}
        k = e.char if e.char.isdigit() else m.get(e.char)
        if k: self.press(k)
    def render(self):
        c = self.c
        self.lcd.configure(text=c.display() or " ")
        inds = []
        if c.power and c.shown() < 0: inds.append("- MINUS")
        if c.power and c.mem != 0: inds.append("MEMORY")
        self.ind.configure(text="   ".join(inds))

if __name__ == "__main__":
    r = tk.Tk()
    App(r)
    r.mainloop()
