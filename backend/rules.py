"""Semántica de las indicaciones.

Una especificación (spec) es un dict:

    {
      "alphabet": ["0", "1"],
      "start": "0",              # toda palabra inicia en este símbolo
      "end": "0",                # toda palabra finaliza en este símbolo
      "rules": [
        {"symbol": "1", "mode": "allow",  "before": None, "after": None},
        {"symbol": "2", "mode": "allow",  "before": "1",  "after": "0"},
        {"symbol": "0", "mode": "forbid"}
      ]
    }

Interpretación:
  * Sin regla para un símbolo, puede aparecer solo o en subcadenas consecutivas.
  * "forbid": no pueden existir dos o más de ese símbolo seguidos (uno solo sí).
  * "allow" con before/after: TODO bloque consecutivo de ese símbolo debe ir
    precedido por `before` y seguido por `after` (los que estén definidos).
    Un bloque al inicio de la palabra no tiene predecesor, y uno al final no
    tiene sucesor, por lo que incumplen la condición correspondiente.
  * La palabra vacía nunca es válida.

Hay dos implementaciones independientes para poder verificarse mutuamente:
  * `monitor_next`: un autómata "monitor" cuyo estado es el último símbolo leído.
  * `check_word_direct`: revisión directa por bloques de símbolos iguales.
"""
from __future__ import annotations

START = "^"  # monitor: aún no se ha leído nada
DEAD = "#"  # monitor: se incumplió alguna regla


def rules_by_symbol(spec):
    return {r["symbol"]: r for r in spec.get("rules", [])}


def monitor_next(spec, rules, m, c):
    """Transición del monitor. Devuelve (estado_siguiente, explicación)."""
    start = spec["start"]
    if m == DEAD:
        return DEAD, "Una vez en error la palabra ya no puede ser válida: rizo con todo el alfabeto."
    rc = rules.get(c, {})
    if m == START:
        if c != start:
            return DEAD, f"La palabra debe iniciar en {start}, no en {c}."
        if rc.get("before"):
            return DEAD, f"{c} debe ir precedido de {rc['before']}, no puede ser el primer símbolo."
        return c, f"La palabra inicia en {c}."
    p = m
    rp = rules.get(p, {})
    if c == p:
        if rp.get("mode") == "forbid":
            return DEAD, f"No pueden existir subcadenas consecutivas de {c}."
        return p, f"Rizo: se permiten subcadenas consecutivas de {c}."
    if rp.get("after") and c != rp["after"]:
        return DEAD, f"Las subcadenas de {p} deben ir seguidas de {rp['after']}, no de {c}."
    if rc.get("before") and p != rc["before"]:
        return DEAD, f"Las subcadenas de {c} deben ir precedidas de {rc['before']}, no de {p}."
    return c, f"Se lee {c} después de {p}."


def monitor_accepting(spec, rules, m):
    """La palabra puede terminar aquí si el último símbolo es `end`
    y ese símbolo no exige que algo lo siga."""
    if m in (START, DEAD):
        return False
    return m == spec["end"] and not rules.get(m, {}).get("after")


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
    i = 0
    while i < n:
        s = word[i]
        j = i
        while j + 1 < n and word[j + 1] == s:
            j += 1
        length = j - i + 1
        r = rules.get(s, {})
        if r.get("mode") == "forbid" and length >= 2:
            violations.append(
                (i + 1, f"No pueden existir subcadenas consecutivas de {s} (aquí hay {length} seguidos).")
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


def spec_sentences(spec):
    """Las indicaciones en lenguaje natural (una frase por regla)."""
    out = [
        f"Σ = {{{', '.join(spec['alphabet'])}}}.",
        f"Toda palabra inicia en {spec['start']} y finaliza en {spec['end']}.",
    ]
    for r in spec.get("rules", []):
        s = r["symbol"]
        if r.get("mode") == "forbid":
            out.append(f"No pueden existir subcadenas consecutivas de {s}.")
            continue
        text = f"Pueden existir subcadenas consecutivas de {s}"
        conds = []
        if r.get("before"):
            conds.append(f"precedidas de al menos un {r['before']}")
        if r.get("after"):
            conds.append(f"seguidas de un {r['after']}")
        if conds:
            text += ", siempre y cuando vayan " + " y ".join(conds)
        out.append(text + ".")
    return out
