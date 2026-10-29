"""Semántica de las indicaciones.

Una especificación (spec) es un dict:

    {
      "alphabet": ["0", "1", "2"],
      "start": "0",              # toda palabra inicia en este símbolo ("" = sin indicar)
      "end": "0",                # toda palabra finaliza en este símbolo ("" = sin indicar)
      "length": {"min": 3, "max": 8},     # longitud de la palabra (o None)
      "counts": [{"symbol": "1", "min": 2, "max": 2}],   # suma total de un símbolo en la palabra
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
  * counts: la suma total de veces que aparece un símbolo en la palabra debe
    estar entre min y max (None = sin ese límite).
  * La palabra vacía nunca es válida.

Hay dos implementaciones independientes para poder verificarse mutuamente:
  * `monitor_next`: un autómata "monitor" cuyo estado es (último símbolo,
    largo de la subcadena actual, largo de la palabra, totales por símbolo), con topes.
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


def count_rules(spec):
    return spec.get("counts") or []


def count_cap(c):
    """Hasta cuánto hay que contar un símbolo (más allá ya da igual)."""
    return c["max"] if c.get("max") is not None else (c.get("min") or 0)


def init_counts(spec):
    return tuple(0 for _ in count_rules(spec))


def bump_counts(spec, cnts, sym):
    """Suma un `sym` a los totales. Devuelve (nuevos totales, regla que se pasó de su máximo | None)."""
    out = list(cnts)
    for i, c in enumerate(count_rules(spec)):
        if c["symbol"] != sym:
            continue
        n = out[i] + 1
        if c.get("max") is not None and n > c["max"]:
            return None, c
        out[i] = min(n, count_cap(c))
    return tuple(out), None


def _count_over_text(c):
    if c["max"] == 0:
        return f"El símbolo {c['symbol']} no puede aparecer en la palabra."
    return f"El total de {c['symbol']} en la palabra no puede pasar de {c['max']}."


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
    start = spec.get("start") or None
    _, mx = length_bounds(spec)
    cap = pos_cap(spec)
    rc = rules.get(c, {})
    if m == START:
        if start and c != start:
            return DEAD, f"La palabra debe iniciar en {start}, no en {c}."
        if rc.get("before"):
            return DEAD, f"{c} debe ir precedido de {rc['before']}, no puede ser el primer símbolo."
        cnts, over = bump_counts(spec, init_counts(spec), c)
        if over:
            return DEAD, _count_over_text(over)
        why = f"La palabra inicia en {c}." if start else f"Se lee {c}, el primer símbolo de la palabra."
        return (c, 1, min(1, cap), cnts), why
    p, r, pos, cnts = m
    rp = rules.get(p, {})
    if mx is not None and pos >= mx:
        return DEAD, f"La palabra no puede tener más de {mx} símbolos."
    npos = min(pos + 1, cap)
    ncnts, over = bump_counts(spec, cnts, c)
    if over:
        return DEAD, _count_over_text(over)
    lo_p, hi_p = run_bounds(rp)
    if c == p:
        nr = r + 1
        if hi_p is not None and nr > hi_p:
            if hi_p == 1:
                return DEAD, f"No pueden existir subcadenas consecutivas de {c}."
            return DEAD, f"Las subcadenas de {c} no pueden tener más de {hi_p} símbolos."
        return (p, min(nr, run_cap(rp)), npos, ncnts), f"Rizo: se permiten subcadenas consecutivas de {c}."
    if r < lo_p:
        return DEAD, f"Las subcadenas de {p} deben tener al menos {lo_p} símbolos antes de leer {c}."
    if rp.get("after") and c != rp["after"]:
        return DEAD, f"Las subcadenas de {p} deben ir seguidas de {rp['after']}, no de {c}."
    if rc.get("before") and p != rc["before"]:
        return DEAD, f"Las subcadenas de {c} deben ir precedidas de {rc['before']}, no de {p}."
    return (c, 1, npos, ncnts), f"Se lee {c} después de {p}."


def monitor_accepting(spec, rules, m):
    """La palabra puede terminar aquí si el último símbolo es `end` (si se pidió),
    su subcadena cumple el mínimo, no exige nada después, la longitud alcanza y
    los totales de símbolos llegaron a su mínimo."""
    if m in (START, DEAD):
        return False
    p, r, pos, cnts = m
    end = spec.get("end") or None
    if end and p != end:
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
    for c, n in zip(count_rules(spec), cnts):
        if n < (c.get("min") or 0):
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
    start, end = spec.get("start") or None, spec.get("end") or None
    mn, mx = length_bounds(spec)
    n = len(word)
    if n == 0:
        if start and end:
            why = f"toda palabra inicia en {start} y finaliza en {end}"
        else:
            why = "toda palabra tiene al menos un símbolo"
        return {"valid": False, "reason": f"La palabra vacía no es válida: {why}.", "index": 0}
    violations = []  # (índice, mensaje)
    if start and word[0] != start:
        violations.append((0, f"La palabra debe iniciar en {start}, pero inicia en {word[0]}."))
    if mx is not None and n > mx:
        violations.append((mx, f"La palabra no puede tener más de {mx} símbolos (tiene {n})."))
    if mn is not None and n < mn:
        violations.append((n, f"La palabra debe tener al menos {mn} símbolos (tiene {n})."))
    for c in count_rules(spec):
        s_, lo_c, hi_c = c["symbol"], c.get("min"), c.get("max")
        k = word.count(s_)
        exact = lo_c is not None and lo_c == hi_c
        if hi_c is not None and k > hi_c:
            where = [i for i, ch in enumerate(word) if ch == s_][hi_c]
            msg = (
                f"La palabra debe tener exactamente {hi_c} símbolos {s_} en total (tiene {k})."
                if exact
                else f"El total de {s_} no puede pasar de {hi_c} (la palabra tiene {k})."
            )
            violations.append((where, msg))
        if lo_c and k < lo_c:
            msg = (
                f"La palabra debe tener exactamente {lo_c} símbolos {s_} en total (tiene {k})."
                if exact
                else f"La palabra debe tener al menos {lo_c} símbolos {s_} en total (tiene {k})."
            )
            violations.append((n, msg))
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
    if end and word[-1] != end:
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


def _count_sentence(c):
    s, lo, hi = c["symbol"], c.get("min"), c.get("max")
    if lo is not None and lo == hi:
        return f"La suma total de {s} en la palabra es exactamente {lo}."
    if lo and hi is not None:
        return f"La suma total de {s} en la palabra está entre {lo} y {hi}."
    if lo:
        return f"La suma total de {s} en la palabra es de al menos {lo}."
    if hi == 0:
        return f"El símbolo {s} no puede aparecer en la palabra."
    return f"La suma total de {s} en la palabra es de como máximo {hi}."


def spec_sentences(spec):
    """Las indicaciones en lenguaje natural: una frase por cada condición (van separadas)."""
    out = [f"Σ = {{{', '.join(spec['alphabet'])}}}."]
    start, end = spec.get("start") or None, spec.get("end") or None
    if start and end:
        out.append(f"Toda palabra inicia en {start} y finaliza en {end}.")
    elif start:
        out.append(f"Toda palabra inicia en {start}.")
    elif end:
        out.append(f"Toda palabra finaliza en {end}.")
    mn, mx = length_bounds(spec)
    if mn is not None or mx is not None:
        out.append(_length_sentence(mn, mx))
    for c in count_rules(spec):
        out.append(_count_sentence(c))
    for r in spec.get("rules", []):
        s = r["symbol"]
        if r.get("mode") == "forbid":
            out.append(f"No pueden existir subcadenas consecutivas de {s}.")
            continue
        base = f"Pueden existir subcadenas consecutivas de {s}"
        lines = []
        if r.get("min_run"):
            lines.append(f"{base} con una longitud mínima de {r['min_run']} símbolos.")
        if r.get("max_run"):
            lines.append(f"{base} con una longitud máxima de {r['max_run']} símbolos.")
        if r.get("before"):
            lines.append(f"{base} precedidas de {r['before']}.")
        if r.get("after"):
            lines.append(f"{base} seguidas de {r['after']}.")
        out.extend(lines or [base + "."])
    return out