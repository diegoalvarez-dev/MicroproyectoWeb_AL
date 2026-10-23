"""Semántica de las indicaciones.

Una especificación (spec) es un dict:

    {
      "alphabet": ["0", "1", "2"],
      "start": "0",              # toda palabra inicia en este símbolo
      "end": "0",                # toda palabra finaliza en este símbolo
      "length": {"min": 3, "max": 8},     # longitud de la palabra (o None)
      "rules": [
        {"symbol": "1", "mode": "allow", "min_run": None, "max_run": 3,
         "before": None, "after": None},
        {"symbol": "2", "mode": "allow", "before": "1", "after": "0"},
        {"symbol": "0", "mode": "forbid"}
      ]
    }

Interpretación:
  * Sin regla para un símbolo, puede aparecer solo o en subcadenas consecutivas.
  * "forbid": no pueden existir dos o más de ese símbolo seguidos (uno solo sí).
  * min_run / max_run: longitud mínima / máxima de CADA subcadena consecutiva
    de ese símbolo (cuántos símbolos iguales van seguidos).
  * "allow" con before/after: TODO bloque consecutivo de ese símbolo debe ir
    precedido por `before` y seguido por `after` (los que estén definidos).
    Un bloque al inicio de la palabra no tiene predecesor, y uno al final no
    tiene sucesor, por lo que incumplen la condición correspondiente.
  * length.min / length.max: cantidad total de símbolos de la palabra.
  * La palabra vacía nunca es válida.

Hay dos implementaciones independientes para poder verificarse mutuamente:
  * `monitor_next`: un autómata "monitor" cuyo estado es (último símbolo,
    largo de la subcadena actual, largo de la palabra), con topes.
  * `check_word_direct`: revisión directa por bloques de símbolos iguales.
"""
from __future__ import annotations

START = "^"  # monitor: aún no se ha leído nada
DEAD = "#"  # monitor: se incumplió alguna regla


def rules_by_symbol(spec):
    return {r["symbol"]: r for r in spec.get("rules", [])}


def run_bounds(rule):
    """(mínimo, máximo) de la longitud de una subcadena; máximo None = sin tope."""
    lo = rule.get("min_run") or 1
    hi = rule.get("max_run")
    if rule.get("mode") == "forbid":
        hi = 1 if hi is None else min(hi, 1)
    return lo, hi


def run_cap(rule):
    """Hasta cuánto hay que contar la subcadena actual."""
    lo, hi = run_bounds(rule)
    return hi if hi is not None else lo


def length_bounds(spec):
    length = spec.get("length") or {}
    return length.get("min"), length.get("max")


def pos_cap(spec):
    """Hasta cuánto hay que contar la longitud de la palabra (0 = no se cuenta)."""
    mn, mx = length_bounds(spec)
    if mx is not None:
        return mx
    return mn or 0


def monitor_next(spec, rules, m, c):
    """Transición del monitor. Devuelve (estado_siguiente, explicación)."""
    if m == DEAD:
        return DEAD, "Una vez en error la palabra ya no puede ser válida: rizo con todo el alfabeto."
    start = spec["start"]
    _, mx = length_bounds(spec)
    cap = pos_cap(spec)
    rc = rules.get(c, {})
    if m == START:
        if c != start:
            return DEAD, f"La palabra debe iniciar en {start}, no en {c}."
        if rc.get("before"):
            return DEAD, f"{c} debe ir precedido de {rc['before']}, no puede ser el primer símbolo."
        return (c, 1, min(1, cap)), f"La palabra inicia en {c}."
    p, r, pos = m
    rp = rules.get(p, {})
    if mx is not None and pos >= mx:
        return DEAD, f"La palabra no puede tener más de {mx} símbolos."
    npos = min(pos + 1, cap)
    lo_p, hi_p = run_bounds(rp)
    if c == p:
        nr = r + 1
        if hi_p is not None and nr > hi_p:
            if hi_p == 1:
                return DEAD, f"No pueden existir subcadenas consecutivas de {c}."
            return DEAD, f"Las subcadenas de {c} no pueden tener más de {hi_p} símbolos."
        return (p, min(nr, run_cap(rp)), npos), f"Rizo: se permiten subcadenas consecutivas de {c}."
    if r < lo_p:
        return DEAD, f"Las subcadenas de {p} deben tener al menos {lo_p} símbolos antes de leer {c}."
    if rp.get("after") and c != rp["after"]:
        return DEAD, f"Las subcadenas de {p} deben ir seguidas de {rp['after']}, no de {c}."
    if rc.get("before") and p != rc["before"]:
        return DEAD, f"Las subcadenas de {c} deben ir precedidas de {rc['before']}, no de {p}."
    return (c, 1, npos), f"Se lee {c} después de {p}."


def monitor_accepting(spec, rules, m):
    """La palabra puede terminar aquí si el último símbolo es `end`, su
    subcadena cumple el mínimo, no exige nada después y la longitud alcanza."""
    if m in (START, DEAD):
        return False
    p, r, pos = m
    if p != spec["end"]:
        return False
    rp = rules.get(p, {})
    if rp.get("after"):
        return False
    lo, _ = run_bounds(rp)
    if r < lo:
        return False
    mn, _ = length_bounds(spec)
    if mn is not None and pos < mn:
        return False
    return True


def language_is_empty(spec):
    rules = rules_by_symbol(spec)
    seen = {START}
    stack = [START]
    while stack:
        m = stack.pop()
        if monitor_accepting(spec, rules, m):
            return False
        for c in spec["alphabet"]:
            t, _ = monitor_next(spec, rules, m, c)
            if t not in seen:
                seen.add(t)
                stack.append(t)
    return True


def check_word_direct(spec, word):
    """Verificación directa (sin autómata).

    Devuelve {"valid", "reason", "index"}; `index` es la posición donde se
    detecta la primera violación (len(word) si se detecta al terminar).
    """
    rules = rules_by_symbol(spec)
    start, end = spec["start"], spec["end"]
    mn, mx = length_bounds(spec)
    n = len(word)
    if n == 0:
        return {
            "valid": False,
            "reason": f"La palabra vacía no es válida: toda palabra inicia en {start} y finaliza en {end}.",
            "index": 0,
        }
    violations = []  # (índice, mensaje)
    if word[0] != start:
        violations.append((0, f"La palabra debe iniciar en {start}, pero inicia en {word[0]}."))
    if mx is not None and n > mx:
        violations.append((mx, f"La palabra no puede tener más de {mx} símbolos (tiene {n})."))
    if mn is not None and n < mn:
        violations.append((n, f"La palabra debe tener al menos {mn} símbolos (tiene {n})."))
    i = 0
    while i < n:
        s = word[i]
        j = i
        while j + 1 < n and word[j + 1] == s:
            j += 1
        length = j - i + 1
        r = rules.get(s, {})
        lo, hi = run_bounds(r)
        if hi is not None and length > hi:
            if hi == 1:
                msg = f"No pueden existir subcadenas consecutivas de {s} (aquí hay {length} seguidos)."
            else:
                msg = f"Las subcadenas de {s} no pueden tener más de {hi} símbolos (aquí hay {length})."
            violations.append((i + hi, msg))
        if length < lo:
            violations.append(
                (j + 1, f"Las subcadenas de {s} deben tener al menos {lo} símbolos (aquí hay {length}).")
            )
        b = r.get("before")
        if b:
            prev = word[i - 1] if i > 0 else None
            if prev != b:
                if prev is None:
                    violations.append((i, f"Las subcadenas de {s} deben ir precedidas de {b}, pero están al inicio."))
                else:
                    violations.append((i, f"Las subcadenas de {s} deben ir precedidas de {b}, no de {prev}."))
        a = r.get("after")
        if a:
            nxt = word[j + 1] if j + 1 < n else None
            if nxt != a:
                if nxt is None:
                    violations.append((n, f"Las subcadenas de {s} deben ir seguidas de {a}, pero la palabra termina ahí."))
                else:
                    violations.append((j + 1, f"Las subcadenas de {s} deben ir seguidas de {a}, no de {nxt}."))
        i = j + 1
    if word[-1] != end:
        violations.append((n, f"La palabra debe finalizar en {end}, pero finaliza en {word[-1]}."))
    if not violations:
        return {"valid": True, "reason": "La palabra cumple todas las indicaciones.", "index": None}
    idx, msg = min(violations, key=lambda v: v[0])
    return {"valid": False, "reason": msg, "index": idx}


def _length_sentence(mn, mx):
    if mn is not None and mx is not None:
        if mn == mx:
            return f"La longitud de la palabra debe ser exactamente {mn}."
        return f"La longitud de la palabra debe estar entre {mn} y {mx} símbolos."
    if mn is not None:
        return f"La palabra debe tener al menos {mn} símbolos."
    if mx == 1:
        return "La palabra debe tener exactamente 1 símbolo."
    return f"La palabra debe tener como máximo {mx} símbolos."


def _run_phrase(lo, hi):
    if lo and hi:
        return f"de exactamente {lo} símbolos" if lo == hi else f"de entre {lo} y {hi} símbolos"
    if hi:
        return "de un solo símbolo" if hi == 1 else f"de máximo {hi} símbolos"
    if lo:
        return f"de mínimo {lo} símbolos"
    return ""


def spec_sentences(spec):
    """Las indicaciones en lenguaje natural (una frase por regla)."""
    out = [
        f"Σ = {{{', '.join(spec['alphabet'])}}}.",
        f"Toda palabra inicia en {spec['start']} y finaliza en {spec['end']}.",
    ]
    mn, mx = length_bounds(spec)
    if mn is not None or mx is not None:
        out.append(_length_sentence(mn, mx))
    for r in spec.get("rules", []):
        s = r["symbol"]
        if r.get("mode") == "forbid":
            out.append(f"No pueden existir subcadenas consecutivas de {s}.")
            continue
        text = f"Pueden existir subcadenas consecutivas de {s}"
        run = _run_phrase(r.get("min_run"), r.get("max_run"))
        if run:
            text += ", " + run
        conds = []
        if r.get("before"):
            conds.append(f"precedidas de al menos un {r['before']}")
        if r.get("after"):
            conds.append(f"seguidas de un {r['after']}")
        if conds:
            text += ", siempre y cuando vayan " + " y ".join(conds)
        out.append(text + ".")
    return out