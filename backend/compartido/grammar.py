"""Gramática regular (lineal por la derecha) equivalente a un autómata finito.

Para cada estado A y cada símbolo a con A —a→ B se agrega la producción  A → aB.
Si A es un estado final se agrega  A → ε.  El estado inicial es S y el estado
error (si lo hay) se omite: de él no se llega a ningún final, así que no aporta
palabras al lenguaje.

    G = (V, Σ, P, S)   con   L(G) = L(autómata)
"""
from __future__ import annotations

import string

EPSILON = "ε"


def variable_names(order, initial):
    """S para el estado inicial y después A, B, C… (sin repetir la S)."""
    letters = [c for c in string.ascii_uppercase if c != "S"]
    names = {initial: "S"}
    n = 0
    for st in order:
        if st in names:
            continue
        names[st] = letters[n] if n < len(letters) else f"V{n - len(letters) + 1}"
        n += 1
    return names


def grammar_from_automaton(automaton):
    """Devuelve la gramática como datos y como líneas de texto listas para mostrar."""
    error = automaton.get("error")
    alphabet = automaton["alphabet"]
    kept = [s["id"] for s in automaton["states"] if s["id"] != error]
    finals = set(automaton["finals"])
    names = variable_names(kept, automaton["initial"])
    trans = {(t["from"], t["symbol"]): t["to"] for t in automaton["transitions"]}

    productions = []
    for st in kept:
        right = []
        for a in alphabet:
            for t in trans.get((st, a), []):
                if t != error:
                    right.append(f"{a}{names[t]}")
        if st in finals:
            right.append(EPSILON)
        if right:
            productions.append({"left": names[st], "state": st, "right": right})
    # variables que aparecen realmente (inicial primero)
    used = [p["left"] for p in productions]
    for p in productions:
        for r in p["right"]:
            if r != EPSILON and r[1:] not in used:
                used.append(r[1:])
    variables = sorted(set(used), key=lambda v: (v != "S", len(v), v))
    return {
        "variables": variables,
        "terminals": list(alphabet),
        "start": "S",
        "productions": productions,
        "mapping": [{"state": st, "variable": names[st]} for st in kept],
        "lines": [f"{p['left']} → {' | '.join(p['right'])}" for p in productions],
        "text": (
            f"G = (V, Σ, P, S) con V = {{{', '.join(variables)}}}, Σ = {{{', '.join(alphabet)}}} y símbolo inicial S."
        ),
    }