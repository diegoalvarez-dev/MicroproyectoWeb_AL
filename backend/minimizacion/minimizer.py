"""Módulo 3: minimización de un AFD con la tabla de pares distinguibles.

Método (el de clase):
  1. Se arma una tabla triangular con una casilla por cada par de estados; la
     diagonal (cada estado consigo mismo) ya viene pintada.
  2. Se marcan con X los pares formados por un estado final y uno que no lo es.
  3. Se analizan los demás pares en orden. Para cada símbolo se mira a qué par
     llegan los dos estados:
        · si algún símbolo lleva a un par ya marcado         → M (marcar con X)
        · si todos llevan a la diagonal o a una fusión        → F (fusión, círculo)
        · en otro caso (hay pares sin resolver)               → P (pendiente)
  4. Se revisan los pendientes hasta que ya nada cambie: los que sigan pendientes
     no dependen de ningún par marcado, así que se fusionan.
  5. Los estados unidos por fusiones son equivalentes: cada clase es un estado del
     AFD minimizado.

Solo se minimiza un AFD. Si llega un AFND, el servicio lo convierte antes con la
construcción de subconjuntos del módulo 2.
"""
from __future__ import annotations

from ..compartido.automata import ERROR_ID
from ..conversion.converter import cell

MAX_MIN_STATES = 20  # más estados que esto vuelve ilegible la tabla de pares

RES_TO_MARK = {"M": "X", "F": "F", "P": "P"}


# ---------------------------------------------------------------------------
# representación interna de un AFD completo
#   {"alphabet": [...], "names": [...], "initial": "A", "finals": {...},
#    "trans": {(estado, símbolo): estado}}
# ---------------------------------------------------------------------------
def to_views(d):
    """Autómata dibujable y tabla de transición de un AFD interno."""
    names, finals = d["names"], d["finals"]
    states = [
        {"id": n, "initial": n == d["initial"], "final": n in finals, "error": n == ERROR_ID} for n in names
    ]
    transitions = [{"from": n, "symbol": a, "to": [d["trans"][(n, a)]]} for n in names for a in d["alphabet"]]
    automaton = {
        "type": "AFD",
        "alphabet": list(d["alphabet"]),
        "states": states,
        "transitions": transitions,
        "initial": d["initial"],
        "finals": [n for n in names if n in finals],
        "error": ERROR_ID if ERROR_ID in names else None,
        "deterministic": True,
    }
    table = [
        {
            "state": n,
            "initial": n == d["initial"],
            "final": n in finals,
            "error": n == ERROR_ID,
            "cells": {a: d["trans"][(n, a)] for a in d["alphabet"]},
        }
        for n in names
    ]
    return automaton, table


def dfa_from_deterministic(nfa):
    """AFD que el usuario registró (ninguna celda con 2 o más destinos).

    Una celda vacía va al estado `error`, igual que en los otros módulos.
    """
    alphabet, finals = nfa["alphabet"], set(nfa["finals"])
    missing = any(not cell(nfa, s, a) for s in nfa["states"] for a in alphabet)
    names = list(nfa["states"]) + ([ERROR_ID] if missing else [])
    trans = {}
    for s in nfa["states"]:
        for a in alphabet:
            t = cell(nfa, s, a)
            trans[(s, a)] = t[0] if t else ERROR_ID
    if missing:
        for a in alphabet:
            trans[(ERROR_ID, a)] = ERROR_ID
    return {"alphabet": list(alphabet), "names": names, "initial": nfa["initial"], "finals": finals, "trans": trans}


def dfa_from_automaton(automaton):
    """AFD interno a partir del autómata que devuelve la construcción de subconjuntos."""
    trans = {(t["from"], t["symbol"]): t["to"][0] for t in automaton["transitions"]}
    return {
        "alphabet": list(automaton["alphabet"]),
        "names": [s["id"] for s in automaton["states"]],
        "initial": automaton["initial"],
        "finals": set(automaton["finals"]),
        "trans": trans,
    }


def reachable_part(d):
    """Quita los estados a los que no se llega desde el inicial. Devuelve (AFD, quitados)."""
    seen = {d["initial"]}
    stack = [d["initial"]]
    while stack:
        s = stack.pop()
        for a in d["alphabet"]:
            t = d["trans"][(s, a)]
            if t not in seen:
                seen.add(t)
                stack.append(t)
    removed = [n for n in d["names"] if n not in seen]
    if not removed:
        return d, []
    names = [n for n in d["names"] if n in seen]
    return (
        {
            "alphabet": d["alphabet"],
            "names": names,
            "initial": d["initial"],
            "finals": {f for f in d["finals"] if f in seen},
            "trans": {k: v for k, v in d["trans"].items() if k[0] in seen},
        },
        removed,
    )


def as_nfa(d):
    """El AFD con el formato de AFND (celdas con un solo destino): sirve para reutilizar utilidades."""
    return {
        "alphabet": list(d["alphabet"]),
        "states": list(d["names"]),
        "initial": d["initial"],
        "finals": sorted(d["finals"]),
        "delta": {s: {a: [d["trans"][(s, a)]] for a in d["alphabet"]} for s in d["names"]},
    }


def accepts(d, word):
    s = d["initial"]
    for ch in word:
        s = d["trans"][(s, ch)]
    return s in d["finals"]


# ---------------------------------------------------------------------------
# textos
# ---------------------------------------------------------------------------
def _braces(items):
    return "{" + ", ".join(items) + "}"


def _status_text(status, succ, same_pair):
    r, s = succ
    pair = f"{r},{s}"
    if status == "diagonal":
        return f"llega a {pair}: queda en la diagonal (es el mismo estado), no distingue a este par."
    if status == "marked":
        return f"llega a {pair}, que ya está marcado con X: este par se distingue."
    if status == "fusion":
        return f"llega a {pair}, que es una fusión (círculo): no distingue a este par."
    if status == "pending":
        extra = " (es el mismo par que se está revisando)" if same_pair else ""
        return f"llega a {pair}, que está pendiente (P){extra}: todavía no se sabe."
    extra = " (es el mismo par que se está analizando)" if same_pair else ""
    return f"llega a {pair}, que todavía no está marcado{extra}: de momento no distingue a este par."


def _class_name(members, taken):
    """Nombre de un estado fusionado: AB si todos son de una letra, A+BC en otro caso."""
    if len(members) == 1:
        return members[0]
    joined = "".join(members)
    if all(len(m) == 1 for m in members) and joined not in taken:
        return joined
    return "+".join(members)


# ---------------------------------------------------------------------------
# la tabla de pares
# ---------------------------------------------------------------------------
def minimize(d):
    names, alphabet, finals, trans = d["names"], d["alphabet"], d["finals"], d["trans"]
    n = len(names)
    idx = {s: i for i, s in enumerate(names)}
    order = [(names[i], names[j]) for i in range(n) for j in range(i + 1, n)]

    def key(a, b):
        return (a, b) if idx[a] < idx[b] else (b, a)

    marks: dict = {}  # (p, q) -> "X" (marcado) | "F" (fusión) | "P" (pendiente)
    steps: list = []

    def status(r, s):
        if r == s:
            return "diagonal"
        return {"X": "marked", "F": "fusion", "P": "pending"}.get(marks.get(key(r, s)), "empty")

    def look(p, q, a):
        r, s = trans[(p, a)], trans[(q, a)]
        succ = list(key(r, s))
        return {
            "symbol": a,
            "moves": [{"from": p, "to": r}, {"from": q, "to": s}],
            "succ": succ,
            "status": status(r, s),
            "same_pair": key(r, s) == (p, q),
        }

    def decide(lines):
        for line in lines:
            if line["status"] == "marked":
                return "M", line
        if all(line["status"] in ("diagonal", "fusion") for line in lines):
            return "F", None
        return "P", None

    def verdict_text(result, because, lines, p, q, review=False):
        pre = f"Revisamos {p},{q}: " if review else ""
        if result == "M":
            a, (r, s) = because["symbol"], because["succ"]
            return f"{pre}M({p},{q}): con {a} llega a {r},{s}, que está marcado → se marca con X."
        if result == "F":
            if all(line["status"] == "diagonal" for line in lines):
                why = "con todos los símbolos los pares quedan en la diagonal"
            else:
                why = "todos los pares a los que llega son diagonal o fusión"
            return f"{pre}F({p},{q}): {why} → fusión (círculo)."
        open_pairs = sorted({",".join(line["succ"]) for line in lines if line["status"] in ("empty", "pending")})
        if review:
            return f"{pre}sigue pendiente P({p},{q}): todavía depende de {', '.join(open_pairs)}."
        return (
            f"P({p},{q}): ningún símbolo lo marca ni lo fusiona (depende de {', '.join(open_pairs)}, "
            "que aún no están resueltos) → queda pendiente, se revisa al final."
        )

    # --- 0. tabla vacía con la diagonal pintada --------------------------------
    steps.append(
        {
            "kind": "init",
            "text": (
                f"Tenemos un AFD de {n} estados. Armamos la tabla de pares: una casilla por cada par de estados. "
                "La diagonal (cada estado con él mismo) ya viene pintada; el inicial lleva ✓ y los finales van en círculo."
            ),
        }
    )

    # --- 1. pares (final, no final) ----------------------------------------------
    first = [pq for pq in order if (pq[0] in finals) != (pq[1] in finals)]
    for pq in first:
        marks[pq] = "X"
    steps.append(
        {
            "kind": "terminals",
            "pairs": [list(pq) for pq in first],
            "text": (
                "Marcamos con X los pares formados por un estado final y uno que no lo es ("
                + ", ".join(f"{p},{q}" for p, q in first)
                + "): se distinguen sin leer ningún símbolo."
                if first
                else "Todos los estados son finales (o ninguno lo es), así que no hay pares que marcar de entrada."
            ),
        }
    )

    # --- 2. análisis de los demás pares ------------------------------------------
    for p, q in order:
        if (p, q) in marks:
            continue
        lines = []
        for a in alphabet:
            line = look(p, q, a)
            lines.append(line)
            m1, m2 = line["moves"]
            steps.append(
                {
                    "kind": "sym",
                    "pair": [p, q],
                    **line,
                    "text": f"{p},{a} → {m1['to']} y {q},{a} → {m2['to']}: "
                    + _status_text(line["status"], line["succ"], line["same_pair"]),
                }
            )
        result, because = decide(lines)
        marks[(p, q)] = RES_TO_MARK[result]
        steps.append(
            {
                "kind": "decide",
                "pair": [p, q],
                "result": result,
                "because": because,
                "notation": f"{result}({p},{q})",
                "text": verdict_text(result, because, lines, p, q),
            }
        )

    # --- 3. revisión de pendientes -------------------------------------------------
    pending = [pq for pq in order if marks.get(pq) == "P"]
    if pending:
        steps.append(
            {
                "kind": "review_start",
                "pairs": [list(pq) for pq in pending],
                "text": "Terminó el análisis. Revisamos en orden los pares pendientes ("
                + ", ".join(f"{p},{q}" for p, q in pending)
                + ") para ver si ya se marcaron o se fusionaron los pares de los que dependen.",
            }
        )
        passno = 0
        while True:
            passno += 1
            snapshot = dict(marks)
            pass_steps = []
            changed = False
            for pq in [x for x in order if marks.get(x) == "P"]:
                p, q = pq
                lines = [look(p, q, a) for a in alphabet]
                result, because = decide(lines)
                if result != "P":
                    marks[pq] = RES_TO_MARK[result]
                    changed = True
                pass_steps.append(
                    {
                        "kind": "review",
                        "pass": passno,
                        "pair": [p, q],
                        "lines": lines,
                        "result": result,
                        "because": because,
                        "notation": f"{result}({p},{q})",
                        "text": verdict_text(result, because, lines, p, q, review=True),
                    }
                )
            if not changed:
                marks.clear()
                marks.update(snapshot)
                break
            steps.extend(pass_steps)
        rest = [x for x in order if marks.get(x) == "P"]
        if rest:
            for pq in rest:
                marks[pq] = "F"
            steps.append(
                {
                    "kind": "review_final",
                    "pairs": [list(pq) for pq in rest],
                    "text": "Ya no cambia nada: los pendientes que quedan ("
                    + ", ".join(f"{p},{q}" for p, q in rest)
                    + ") no dependen de ningún par marcado, así que se fusionan (círculo).",
                }
            )

    # --- 4. clases de equivalencia ---------------------------------------------------
    parent = {s: s for s in names}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for pq, m in marks.items():
        if m == "F":
            ra, rb = find(pq[0]), find(pq[1])
            if ra != rb:
                parent[rb] = ra
    groups: dict = {}
    for s in names:
        groups.setdefault(find(s), []).append(s)
    classes = sorted(groups.values(), key=lambda g: idx[g[0]])

    if len(classes) == n:
        done = "Ningún par se fusiona: el AFD ya es mínimo."
    else:
        merged = [c for c in classes if len(c) > 1]
        done = (
            "Los pares con círculo son estados equivalentes y se fusionan: "
            + ", ".join(_braces(c) for c in merged)
            + f". El AFD pasa de {n} a {len(classes)} estados."
        )
    steps.append({"kind": "done", "classes": classes, "text": done})

    # --- AFD minimizado --------------------------------------------------------------------
    taken = set(names)
    cname = {}
    for c in classes:
        name = _class_name(c, taken)
        for s in c:
            cname[s] = name
    new_names = [cname[c[0]] for c in classes]
    new_trans = {}
    for c in classes:
        rep = c[0]
        for a in alphabet:
            new_trans[(cname[rep], a)] = cname[trans[(rep, a)]]
    small = {
        "alphabet": list(alphabet),
        "names": new_names,
        "initial": cname[d["initial"]],
        "finals": {cname[c[0]] for c in classes if c[0] in finals},
        "trans": new_trans,
    }
    automaton, table = to_views(small)
    mapping = [{"name": cname[c[0]], "members": list(c), "final": c[0] in finals} for c in classes]
    return {
        "steps": steps,
        "marks": {f"{p},{q}": m for (p, q), m in marks.items()},
        "classes": classes,
        "small": small,
        "minimal": {"automaton": automaton, "table": table, "mapping": mapping},
    }