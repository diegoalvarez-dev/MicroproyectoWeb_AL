"""Generador de ejercicios aleatorios (indicaciones) por nivel de dificultad."""
from __future__ import annotations

import random

from .designer import build_dfa
from .validators import DIGITS, LETTERS, validate_spec

LEVELS = ("facil", "medio", "dificil")

# n: tamaños de alfabeto posibles · rules: cuántas reglas · states: rango de estados del AFD
CONFIG = {
    "facil": {"n": [2], "rules": (0, 1), "states": (3, 5)},
    "medio": {"n": [3], "rules": (1, 2), "states": (4, 9)},
    "dificil": {"n": [3, 4], "rules": (2, 3), "states": (6, 14)},
}


def _make_rule(rng, level, symbol, alphabet, force_both=False):
    others = [a for a in alphabet if a != symbol]
    if level == "facil":
        return {"symbol": symbol, "mode": rng.choice(["forbid", "allow"]), "before": None, "after": None}
    kinds = ["forbid", "before", "after"] if level == "medio" else ["forbid", "both", "before", "after", "both"]
    kind = "both" if force_both else rng.choice(kinds)
    if kind == "forbid":
        return {"symbol": symbol, "mode": "forbid", "before": None, "after": None}
    before = rng.choice(others) if kind in ("before", "both") else None
    after = rng.choice(others) if kind in ("after", "both") else None
    return {"symbol": symbol, "mode": "allow", "before": before, "after": after}


def generate_spec(level="facil", alphabet_kind="random", rng=None):
    if level not in LEVELS:
        raise ValueError(f"Nivel desconocido: {level}")
    rng = rng or random.Random()
    cfg = CONFIG[level]
    fallback = None
    for _ in range(500):
        kind = rng.choice(["digits", "letters"]) if alphabet_kind == "random" else alphabet_kind
        pool = DIGITS if kind == "digits" else LETTERS
        n = rng.choice(cfg["n"])
        alphabet = list(pool[:n])
        lo, hi = cfg["rules"]
        count = rng.randint(lo, min(hi, n))
        symbols = rng.sample(alphabet, count)
        rules = [
            _make_rule(rng, level, s, alphabet, force_both=(level == "dificil" and i == 0))
            for i, s in enumerate(symbols)
        ]
        spec = {
            "alphabet": alphabet,
            "start": rng.choice(alphabet),
            "end": rng.choice(alphabet),
            "rules": rules,
        }
        if not validate_spec(spec)["ok"]:
            continue
        # el ejercicio debe tener al menos una regla que realmente restrinja
        if level != "facil" and not any(r["mode"] == "forbid" or r["before"] or r["after"] for r in rules):
            continue
        fallback = spec
        automaton, _ = build_dfa(spec)
        n_states = len(automaton["states"])
        if cfg["states"][0] <= n_states <= cfg["states"][1]:
            return spec
    return fallback
