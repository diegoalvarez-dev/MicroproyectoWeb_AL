"""Ejercicios aleatorios del módulo 3 (tres niveles).

  · Fácil:   AFD de 4 estados, 2 símbolos, con un par de estados equivalentes.
  · Medio:   AFD de 5 o 6 estados, 2 o 3 símbolos, con una o dos fusiones.
  · Difícil: AFND (4 estados) que primero se convierte a AFD y luego se minimiza.

Los AFD se construyen duplicando estados de un AFD base: la copia se comporta igual
que el original, así que siempre hay al menos una fusión que encontrar.
"""
from __future__ import annotations

import random

from ..conversion.converter import STATE_LETTERS, generate_nfa, normalize_nfa, validate_nfa
from ..diseno.validators import DIGITS, LETTERS
from .minimizer import MAX_MIN_STATES, dfa_from_deterministic, minimize

CONFIG = {
    "facil": {"base": [3], "copies": [1], "k": [2]},
    "medio": {"base": [4], "copies": [1, 2], "k": [2, 3]},
}
LEVELS = ("facil", "medio", "dificil")


def _duplicated_dfa(m, copies, k, kind, rng):
    """AFD de m + copies estados donde cada copia es equivalente a su original."""
    pool = DIGITS if kind == "digits" else LETTERS
    alphabet = list(pool[:k])
    for _ in range(400):
        base = {(s, a): rng.randrange(m) for s in range(m) for a in alphabet}
        finals = set(rng.sample(range(m), rng.randint(1, m - 1)))
        trans = dict(base)
        fin = set(finals)
        src_of = {}
        sources = rng.sample(range(m), copies)
        for c, src in enumerate(sources):
            new = m + c
            src_of[new] = src
            for a in alphabet:
                trans[(new, a)] = base[(src, a)]
            if src in finals:
                fin.add(new)
        # las flechas que llegan a un estado copiado se reparten al azar entre original y copia
        for new, src in src_of.items():
            incoming = [(u, a) for (u, a), t in trans.items() if t == src and u != new]
            if not incoming:
                break
            forced = rng.choice(incoming)
            for edge in incoming:
                if edge == forced or rng.random() < 0.5:
                    trans[edge] = new
        else:
            total = m + copies
            seen, stack = {0}, [0]
            while stack:
                u = stack.pop()
                for a in alphabet:
                    t = trans[(u, a)]
                    if t not in seen:
                        seen.add(t)
                        stack.append(t)
            if len(seen) != total:
                continue
            others = list(range(1, total))
            rng.shuffle(others)
            letter = {0: STATE_LETTERS[0], **{s: STATE_LETTERS[i + 1] for i, s in enumerate(others)}}
            states = sorted(letter.values())
            delta = {letter[u]: {a: [letter[trans[(u, a)]]] for a in alphabet} for u in range(total)}
            return normalize_nfa(
                {
                    "alphabet": alphabet,
                    "states": states,
                    "initial": letter[0],
                    "finals": [letter[f] for f in fin],
                    "delta": delta,
                }
            )
    return None


def generate(level="facil", alphabet_kind="random", rng=None):
    if level not in LEVELS:
        raise ValueError(f"Nivel desconocido: {level}")
    rng = rng or random.Random()
    kind = rng.choice(["digits", "letters"]) if alphabet_kind == "random" else alphabet_kind
    if level == "dificil":
        return generate_nfa("medio", kind, rng)
    cfg = CONFIG[level]
    for _ in range(50):
        m = rng.choice(cfg["base"])
        copies = rng.choice(cfg["copies"])
        nfa = _duplicated_dfa(m, copies, rng.choice(cfg["k"]), kind, rng)
        if nfa is None or not validate_nfa(nfa)["ok"]:
            continue
        d = dfa_from_deterministic(nfa)
        if len(d["names"]) <= MAX_MIN_STATES and len(minimize(d)["classes"]) < len(d["names"]):
            return nfa
    return normalize_nfa(
        {
            "alphabet": ["0", "1"],
            "states": ["A", "B", "C", "D"],
            "initial": "A",
            "finals": ["C", "D"],
            "delta": {
                "A": {"0": ["B"], "1": ["C"]},
                "B": {"0": ["A"], "1": ["D"]},
                "C": {"0": ["C"], "1": ["C"]},
                "D": {"0": ["D"], "1": ["D"]},
            },
        }
    )