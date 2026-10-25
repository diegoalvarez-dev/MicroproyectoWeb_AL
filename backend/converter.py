"""Módulo 2: conversión de un AFND a un AFD (construcción de subconjuntos).

Formato de un AFND (nfa):

    {
      "alphabet": ["0", "1"],
      "states":   ["A", "B", "C", "D"],       # una letra mayúscula (A–Z) por estado, la elige el usuario
      "initial":  "A",
      "finals":   ["D"],
      "delta": {"A": {"0": ["B", "C"], "1": ["C"]}, "B": {...}}
    }

Una celda vacía (el estado no tiene flecha con ese símbolo) equivale a ∅: en el
AFD esa celda va al estado `error`, que tiene un rizo con todo el alfabeto y no
es final (la misma regla del módulo 1).

Algoritmo (construcción de subconjuntos):
  1. El estado inicial del AFD es {inicial}.
  2. Para cada estado S del AFD, por cada símbolo a:  T = ⋃ δ(q, a) con q ∈ S.
  3. Si T no ha aparecido antes, es un estado nuevo: se agrega a Q.
  4. Un subconjunto es final si contiene algún estado final del AFND.
Los nombres de los estados nuevos juntan las letras de sus miembros en orden
alfabético (BC = {B, C}), así la correspondencia con el AFND es directa.
"""
from __future__ import annotations

import json
import random
import string
from itertools import product

from .automata import ERROR_ID
from .designer import run_word
from .validators import DIGITS, LETTERS

MIN_SYMBOLS, MAX_SYMBOLS = 2, 4
MIN_STATES, MAX_NFA_STATES = 2, 12
MAX_DFA_STATES = 40  # más estados que esto ya no se dibuja con claridad
STATE_LETTERS = string.ascii_uppercase  # nombres posibles de los estados: A–Z


# ---------------------------------------------------------------------------
# entrada
# ---------------------------------------------------------------------------
def normalize_nfa(raw):
    """Limpia espacios y deja `delta` completo en forma de listas ordenadas."""
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    alphabet = [str(a).strip() for a in (raw.get("alphabet") or [])]
    states = [str(s).strip() for s in (raw.get("states") or [])]
    delta = {}
    for s, row in (raw.get("delta") or {}).items():
        delta[str(s).strip()] = {
            str(a).strip(): sorted({str(t).strip() for t in (targets or [])})
            for a, targets in (row or {}).items()
        }
    return {
        "alphabet": alphabet,
        "states": states,
        "initial": str(raw.get("initial") or "").strip(),
        "finals": sorted({str(f).strip() for f in (raw.get("finals") or [])}),
        "delta": delta,
    }


def cell(nfa, state, symbol):
    return nfa["delta"].get(state, {}).get(symbol, [])


def nondeterministic_cells(nfa):
    out = []
    for s in nfa["states"]:
        for a in nfa["alphabet"]:
            t = cell(nfa, s, a)
            if len(t) > 1:
                out.append({"state": s, "symbol": a, "targets": list(t)})
    return out


def reachable_states(nfa):
    seen = {nfa["initial"]}
    stack = [nfa["initial"]]
    while stack:
        s = stack.pop()
        for a in nfa["alphabet"]:
            for t in cell(nfa, s, a):
                if t not in seen:
                    seen.add(t)
                    stack.append(t)
    return seen


def _useful_states(nfa):
    """Estados desde los que se puede llegar a un final."""
    pred = {s: set() for s in nfa["states"]}
    for s in nfa["states"]:
        for a in nfa["alphabet"]:
            for t in cell(nfa, s, a):
                if t in pred:
                    pred[t].add(s)
    seen = set(nfa["finals"])
    stack = list(seen)
    while stack:
        x = stack.pop()
        for p in pred.get(x, ()):
            if p not in seen:
                seen.add(p)
                stack.append(p)
    return seen


def dfa_size(nfa, cap=None):
    """Cantidad de estados del AFD sin armar los pasos; se detiene en cuanto pasa de `cap`."""
    start = frozenset({nfa["initial"]})
    seen = {start}
    stack = [start]
    while stack:
        cur = stack.pop()
        for a in nfa["alphabet"]:
            nxt = frozenset(t for q in cur for t in cell(nfa, q, a))
            if nxt not in seen:
                seen.add(nxt)
                if cap is not None and len(seen) > cap:
                    return len(seen)
                stack.append(nxt)
    return len(seen)


def validate_nfa(nfa, check_size=True):
    errors: list[str] = []
    warnings: list[str] = []
    alphabet, states = nfa["alphabet"], nfa["states"]

    # --- alfabeto -------------------------------------------------------
    if not (MIN_SYMBOLS <= len(alphabet) <= MAX_SYMBOLS):
        errors.append(f"El alfabeto debe tener entre {MIN_SYMBOLS} y {MAX_SYMBOLS} símbolos.")
    if any(len(a) != 1 for a in alphabet):
        errors.append("Cada símbolo del alfabeto debe ser un solo carácter.")
    if len(set(alphabet)) != len(alphabet):
        errors.append("El alfabeto tiene símbolos repetidos.")
    only_digits = all(a in DIGITS for a in alphabet)
    only_letters = all(a in LETTERS for a in alphabet)
    if alphabet and not (only_digits or only_letters):
        if any(a in DIGITS for a in alphabet) and any(a in LETTERS for a in alphabet):
            errors.append("El alfabeto no puede mezclar números y letras: usa solo números o solo letras minúsculas.")
        else:
            errors.append("Los símbolos deben ser números (0-9) o letras minúsculas (a-z).")

    # --- estados --------------------------------------------------------
    if not (MIN_STATES <= len(states) <= MAX_NFA_STATES):
        errors.append(f"El autómata debe tener entre {MIN_STATES} y {MAX_NFA_STATES} estados.")
    if len(set(states)) != len(states):
        errors.append("Hay estados repetidos.")
    if any(len(s) != 1 or s not in STATE_LETTERS for s in states):
        errors.append("Los estados se nombran con una sola letra mayúscula (A–Z).")
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    if not nfa["initial"]:
        errors.append("Falta marcar el estado inicial.")
    elif nfa["initial"] not in states:
        errors.append("El estado inicial no pertenece al autómata.")
    if any(f not in states for f in nfa["finals"]):
        errors.append("Hay un estado final que no pertenece al autómata.")
    elif not nfa["finals"]:
        errors.append("Marca al menos un estado final.")
    for s, row in nfa["delta"].items():
        if s not in states:
            errors.append(f"Hay transiciones que salen de «{s}», que no es un estado del autómata.")
            continue
        for a, targets in row.items():
            if a not in alphabet:
                errors.append(f"El estado {s} usa el símbolo «{a}», que no está en el alfabeto.")
            for t in targets:
                if t not in states:
                    errors.append(f"La transición de {s} con {a} llega a «{t}», que no es un estado del autómata.")
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- avisos ---------------------------------------------------------
    reach = reachable_states(nfa)
    unreachable = [s for s in states if s not in reach]
    if unreachable:
        warnings.append(
            f"No se llega a {', '.join(unreachable)} desde el estado inicial: son inaccesibles y no aparecerán en el AFD."
        )
    useful = _useful_states(nfa)
    useless = [s for s in states if s in reach and s not in useful]
    if useless:
        warnings.append(
            f"Desde {', '.join(useless)} no se puede llegar a ningún estado final: son estados inútiles."
        )
    if nfa["initial"] not in useful:
        errors.append("Desde el estado inicial no se puede llegar a ningún estado final: el autómata no acepta ninguna palabra.")
        return {"ok": False, "errors": errors, "warnings": warnings}

    nd = nondeterministic_cells(nfa)
    result = {
        "ok": True,
        "errors": [],
        "warnings": warnings,
        "kind": "AFND" if nd else "AFD",
        "nondeterministic": nd,
        "unreachable": unreachable,
    }
    if check_size:
        n = dfa_size(nfa, MAX_DFA_STATES)
        result["dfa_size"] = n
        if n > MAX_DFA_STATES:
            return {
                "ok": False,
                "errors": [
                    f"El AFD equivalente tendría más de {MAX_DFA_STATES} estados y ese es el máximo para dibujarlo. "
                    "Usa menos estados o menos transiciones múltiples."
                ],
                "warnings": warnings,
            }
    return result


# ---------------------------------------------------------------------------
# el AFND como autómata dibujable + tabla
# ---------------------------------------------------------------------------
def nfa_view(nfa, kind):
    """Autómata (completado con `error`) y tabla de transición del AFND."""
    alphabet = nfa["alphabet"]
    finals = set(nfa["finals"])
    missing = any(not cell(nfa, s, a) for s in nfa["states"] for a in alphabet)
    states = [
        {"id": s, "initial": s == nfa["initial"], "final": s in finals, "error": False} for s in nfa["states"]
    ]
    transitions = [
        {"from": s, "symbol": a, "to": list(cell(nfa, s, a)) or [ERROR_ID]}
        for s in nfa["states"]
        for a in alphabet
    ]
    if missing:
        states.append({"id": ERROR_ID, "initial": False, "final": False, "error": True})
        transitions += [{"from": ERROR_ID, "symbol": a, "to": [ERROR_ID]} for a in alphabet]
    automaton = {
        "type": kind,
        "alphabet": list(alphabet),
        "states": states,
        "transitions": transitions,
        "initial": nfa["initial"],
        "finals": [s for s in nfa["states"] if s in finals],
        "error": ERROR_ID if missing else None,
        "deterministic": kind == "AFD",
    }
    table = [
        {
            "state": s,
            "initial": s == nfa["initial"],
            "final": s in finals,
            "error": False,
            "cells": {a: list(cell(nfa, s, a)) for a in alphabet},
        }
        for s in nfa["states"]
    ]
    return automaton, table


# ---------------------------------------------------------------------------
# construcción de subconjuntos
# ---------------------------------------------------------------------------
def name_of(subset):
    return "".join(sorted(subset)) if subset else ERROR_ID


def _braces(items):
    items = sorted(items)
    return "{" + ", ".join(items) + "}" if items else "∅"


def subset_construction(nfa):
    alphabet = nfa["alphabet"]
    finals = set(nfa["finals"])
    start = frozenset({nfa["initial"]})

    order = [start]
    seen = {start}
    steps = []
    trans = {}  # (nombre, símbolo) -> nombre
    steps.append(
        {
            "kind": "init",
            "state": name_of(start),
            "members": sorted(start),
            "text": (
                f"Empezamos por el estado inicial del AFND: {nfa['initial']}. "
                f"Será el primer estado del AFD y el primero de la columna Q."
            ),
        }
    )
    i = 0
    while i < len(order):
        current = order[i]
        i += 1
        cname = name_of(current)
        if current:
            steps.append(
                {
                    "kind": "row",
                    "state": cname,
                    "members": sorted(current),
                    "text": (
                        f"Analizamos {cname} = {_braces(current)}: calculamos a qué estados llega con cada símbolo."
                        if len(current) > 1
                        else f"Analizamos {cname}: calculamos a qué estados llega con cada símbolo."
                    ),
                }
            )
        else:
            steps.append(
                {
                    "kind": "row",
                    "state": cname,
                    "members": [],
                    "text": "Analizamos error (∅): es el estado trampa, con cualquier símbolo se queda en error.",
                }
            )
        for a in alphabet:
            parts = [{"state": q, "targets": list(cell(nfa, q, a))} for q in sorted(current)]
            target = frozenset(t for p in parts for t in p["targets"])
            tname = name_of(target)
            is_new = target not in seen
            if is_new:
                seen.add(target)
                order.append(target)
            trans[(cname, a)] = tname

            if not current:
                calc = "∅ con cualquier símbolo sigue en ∅"
            elif len(current) == 1:
                calc = f"δ({cname}, {a}) = {_braces(target)}"
            else:
                union = " ∪ ".join(_braces(p["targets"]) for p in parts)
                calc = f"δ({cname}, {a}) = " + " ∪ ".join(f"δ({p['state']}, {a})" for p in parts)
                calc += f" = {union} = {_braces(target)}"
            if not target:
                outcome = "como no hay a dónde ir, la celda es error"
            elif len(target) == 1:
                outcome = f"la celda es {tname}"
            else:
                outcome = f"se junta en el estado {tname}"
            tail = (
                "es un estado nuevo: se agrega a la columna Q"
                if is_new
                else "ya está en la columna Q, no se crea nada nuevo"
            )
            steps.append(
                {
                    "kind": "cell",
                    "state": cname,
                    "symbol": a,
                    "parts": parts,
                    "result": tname,
                    "result_members": sorted(target),
                    "is_new": is_new,
                    "text": f"{calc}; {outcome} ({tail}).",
                }
            )

    names = [name_of(s) for s in order]
    final_names = [name_of(s) for s in order if s & finals]
    steps.append(
        {
            "kind": "done",
            "text": (
                f"Ya no aparecen estados nuevos: el AFD tiene {len(order)} estados. "
                + (
                    f"Son finales los que contienen un final del AFND ({', '.join(sorted(finals))}): "
                    f"{', '.join(final_names)}."
                    if final_names
                    else "Ningún estado resultó final."
                )
            ),
        }
    )

    has_error = any(not s for s in order)
    states = [
        {"id": name_of(s), "initial": k == 0, "final": bool(s & finals), "error": not s}
        for k, s in enumerate(order)
    ]
    transitions = [{"from": n, "symbol": a, "to": [trans[(n, a)]]} for n in names for a in alphabet]
    dfa = {
        "type": "AFD",
        "alphabet": list(alphabet),
        "states": states,
        "transitions": transitions,
        "initial": names[0],
        "finals": final_names,
        "error": ERROR_ID if has_error else None,
        "deterministic": True,
    }
    table = [
        {
            "state": n,
            "initial": k == 0,
            "final": n in final_names,
            "error": n == ERROR_ID,
            "cells": {a: trans[(n, a)] for a in alphabet},
        }
        for k, n in enumerate(names)
    ]
    mapping = [
        {"name": name_of(s), "members": sorted(s), "final": bool(s & finals)} for s in order
    ]
    return {"dfa": dfa, "table": table, "mapping": mapping, "steps": steps}


# ---------------------------------------------------------------------------
# palabras
# ---------------------------------------------------------------------------
def nfa_accepts(nfa, word):
    """Aceptación directa en el AFND (sin construir el AFD)."""
    current = {nfa["initial"]}
    for ch in word:
        nxt = set()
        for s in current:
            nxt.update(cell(nfa, s, ch))
        current = nxt
    return bool(current & set(nfa["finals"]))


def check_word(nfa, word):
    """Recorre la palabra en el AFD resultante y la compara con el AFND."""
    alphabet = nfa["alphabet"]
    bad = [i for i, ch in enumerate(word) if ch not in alphabet]
    if bad:
        i = bad[0]
        return {
            "word": word,
            "kind": "AFD",
            "valid": False,
            "path": [],
            "initial": None,
            "reason": f"El símbolo «{word[i]}» no pertenece al alfabeto Σ = {{{', '.join(alphabet)}}}.",
            "fail_index": i,
            "invalid_symbol": True,
            "consistent": True,
        }
    conv = subset_construction(nfa)
    dfa = conv["dfa"]
    members = {m["name"]: m["members"] for m in conv["mapping"]}
    res = run_word(dfa, word)
    direct = nfa_accepts(nfa, word)
    dead_at = next((p["index"] for p in res["path"] if not p["ok"]), None)
    fail_index = dead_at
    if fail_index is None and not res["accepted"]:
        fail_index = len(word) - 1 if word else 0
    last = res["final_state"]
    label = f"{last} = {_braces(members[last])}" if len(members[last]) > 1 else last
    if res["accepted"]:
        reason = f"El AFD termina en {label}, que es final porque contiene un estado final del AFND."
    elif dead_at is not None:
        step = res["path"][dead_at]
        src = step["from"]
        reason = (
            f"En la posición {dead_at + 1} (símbolo {step['symbol']}) el AFD pasa a error: "
            f"desde {_braces(members[src])} ningún estado del AFND lee {step['symbol']}."
        )
    elif not word:
        reason = "La palabra vacía no se acepta: el estado inicial no es final."
    else:
        reason = f"El AFD termina en {label}, que no es final: ningún estado de ese conjunto es final en el AFND."
    return {
        "word": word,
        "kind": "AFD",
        "valid": res["accepted"],
        "path": res["path"],
        "initial": res["initial"],
        "reason": reason,
        "fail_index": None if res["accepted"] else fail_index,
        "invalid_symbol": False,
        "consistent": res["accepted"] == direct,
    }


def sample_words(nfa, want=4):
    """Palabras de ejemplo aceptadas y rechazadas (prueba rápida)."""
    alphabet = nfa["alphabet"]
    rng = random.Random(json.dumps(nfa, sort_keys=True))
    words, total = [], 0
    for length in range(1, 9):
        total += len(alphabet) ** length
        if total > 4000:
            break
        words += ["".join(t) for t in product(alphabet, repeat=length)]
    while len(words) < 400:
        words.append("".join(rng.choice(alphabet) for _ in range(rng.randint(2, 8))))
    valid = sorted({w for w in words if nfa_accepts(nfa, w)}, key=lambda w: (len(w), w))
    invalid = sorted({w for w in words if not nfa_accepts(nfa, w)}, key=lambda w: (len(w), w))

    def pick(items, k):
        # las más cortas primero y el resto repartidas por tamaño
        if len(items) <= k:
            return items
        head = items[:1]
        rest = items[1:]
        step = len(rest) / (k - 1)
        return head + [rest[int(i * step)] for i in range(k - 1)]

    return {"valid": pick(valid, want), "invalid": pick(invalid, want)}


# ---------------------------------------------------------------------------
# ejercicios aleatorios
# ---------------------------------------------------------------------------
# n: cantidad de estados · k: tamaño del alfabeto · dfa: rango de estados del AFD
# w: probabilidad de que una celda tenga 0, 1, 2 o 3 destinos
CONFIG = {
    "facil": {"n": [3], "k": [2], "dfa": (3, 7), "w": [0.04, 0.58, 0.38, 0.0], "finals": [1]},
    "medio": {"n": [4], "k": [2, 3], "dfa": (5, 12), "w": [0.06, 0.5, 0.36, 0.08], "finals": [1, 2]},
    "dificil": {"n": [5, 6], "k": [2, 3], "dfa": (9, 22), "w": [0.06, 0.42, 0.38, 0.14], "finals": [1, 2]},
}
LEVELS = tuple(CONFIG)


def generate_nfa(level="facil", alphabet_kind="random", rng=None):
    if level not in CONFIG:
        raise ValueError(f"Nivel desconocido: {level}")
    rng = rng or random.Random()
    cfg = CONFIG[level]
    fallback = None
    for _ in range(600):
        kind = rng.choice(["digits", "letters"]) if alphabet_kind == "random" else alphabet_kind
        pool = DIGITS if kind == "digits" else LETTERS
        k = rng.choice(cfg["k"])
        n = rng.choice(cfg["n"])
        alphabet = list(pool[:k])
        states = list(STATE_LETTERS[:n])
        delta = {}
        for s in states:
            row = {}
            for a in alphabet:
                size = rng.choices([0, 1, 2, 3], weights=cfg["w"])[0]
                row[a] = sorted(rng.sample(states, min(size, n)))
            delta[s] = row
        nfa = normalize_nfa(
            {
                "alphabet": alphabet,
                "states": states,
                "initial": "A",
                "finals": rng.sample(states, rng.choice(cfg["finals"])),
                "delta": delta,
            }
        )
        res = validate_nfa(nfa, check_size=False)
        if not res["ok"] or res["kind"] != "AFND" or res["unreachable"]:
            continue
        size = len(subset_construction(nfa)["dfa"]["states"])
        if size > MAX_DFA_STATES:
            continue
        fallback = nfa
        if cfg["dfa"][0] <= size <= cfg["dfa"][1]:
            return nfa
    if fallback is not None:
        return fallback
    return normalize_nfa(
        {
            "alphabet": ["0", "1"],
            "states": ["A", "B", "C"],
            "initial": "A",
            "finals": ["C"],
            "delta": {"A": {"0": ["A", "B"], "1": ["A"]}, "B": {"1": ["C"]}, "C": {}},
        }
    )