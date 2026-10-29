"""Generador de ejercicios aleatorios (indicaciones) por nivel de dificultad."""
from __future__ import annotations

import random

from .designer import build_dfa
from .validators import DIGITS, LETTERS, MAX_STATES, automaton_size, validate_spec

LEVELS = ("facil", "medio", "dificil")

# n: tamaños de alfabeto · rules: cuántas reglas · states: rango de estados del AFD
# length_p / count_p: probabilidad de pedir la longitud de la palabra / la suma total de un símbolo
CONFIG = {
    "facil": {"n": [2], "rules": (0, 1), "states": (3, 9), "length_p": 0.4, "count_p": 0.0},
    "medio": {"n": [3], "rules": (1, 2), "states": (4, 16), "length_p": 0.5, "count_p": 0.2},
    "dificil": {"n": [3, 4], "rules": (2, 3), "states": (6, 26), "length_p": 0.7, "count_p": 0.4},
}


def _make_rule(rng, level, symbol, alphabet, force_both=False):
    others = [a for a in alphabet if a != symbol]
    rule = {"symbol": symbol, "mode": "allow", "before": None, "after": None, "min_run": None, "max_run": None}
    if level == "facil":
        kinds = ["forbid", "max"]
    elif level == "medio":
        kinds = ["forbid", "before", "after", "max", "min"]
    else:
        kinds = ["forbid", "both", "before", "after", "both", "max", "range"]
    kind = "both" if force_both else rng.choice(kinds)
    if kind == "forbid":
        rule["mode"] = "forbid"
        return rule
    if kind in ("before", "both"):
        rule["before"] = rng.choice(others)
    if kind in ("after", "both"):
        rule["after"] = rng.choice(others)
    if kind == "max":
        rule["max_run"] = rng.choice([2, 3])
    elif kind == "min":
        rule["min_run"] = 2
    elif kind == "range":
        rule["min_run"] = 2
        rule["max_run"] = rng.choice([3, 4])
    if level == "dificil" and kind in ("before", "after", "both") and rng.random() < 0.35:
        rule["max_run"] = rng.choice([2, 3, 4])
    return rule


def _make_length(rng, level):
    if level == "facil":
        kind = rng.choice(["exact", "max", "min"])
    elif level == "medio":
        kind = rng.choice(["exact", "max", "min", "range"])
    else:
        kind = rng.choice(["range", "range", "exact", "max"])
    if kind == "exact":
        n = rng.randint(3, 5) if level == "facil" else rng.randint(4, 6) if level == "medio" else rng.randint(5, 8)
        return {"min": n, "max": n}
    if kind == "max":
        return {"min": None, "max": rng.randint(4, 6) if level != "dificil" else rng.randint(6, 9)}
    if kind == "min":
        return {"min": rng.randint(3, 5), "max": None}
    lo = rng.randint(3, 4) if level == "medio" else rng.randint(3, 5)
    hi = lo + (rng.randint(1, 3) if level == "medio" else rng.randint(2, 4))
    return {"min": lo, "max": hi}


def _make_count(rng, level, alphabet):
    """Una indicación de «suma total de un símbolo»."""
    symbol = rng.choice(alphabet)
    kind = rng.choice(["exact", "max", "min"]) if level == "dificil" else rng.choice(["max", "min"])
    n = rng.randint(1, 3)
    if kind == "exact":
        return {"symbol": symbol, "min": n, "max": n}
    if kind == "max":
        return {"symbol": symbol, "min": None, "max": n + 1}
    return {"symbol": symbol, "min": n, "max": None}


def generate_spec(level="facil", alphabet_kind="random", rng=None):
    if level not in LEVELS:
        raise ValueError(f"Nivel desconocido: {level}")
    rng = rng or random.Random()
    cfg = CONFIG[level]
    fallback = None
    for _ in range(400):
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
        length = _make_length(rng, level) if rng.random() < cfg["length_p"] else None
        counts = [_make_count(rng, level, alphabet)] if rng.random() < cfg["count_p"] else []
        spec = {
            "alphabet": alphabet,
            "start": rng.choice(alphabet),
            "end": rng.choice(alphabet),
            "rules": rules,
            "length": length,
            "counts": counts,
        }
        if not validate_spec(spec, check_size=False)["ok"]:
            continue
        # el ejercicio debe tener al menos una restricción real
        restrictive = (
            length is not None
            or bool(counts)
            or any(r["mode"] == "forbid" or r["before"] or r["after"] or r["min_run"] or r["max_run"] for r in rules)
        )
        if level != "facil" and not restrictive:
            continue
        automaton, _ = build_dfa(spec)
        n_states = len(automaton["states"])
        if n_states > MAX_STATES or max(automaton_size(spec)) > MAX_STATES:
            continue
        fallback = spec
        if cfg["states"][0] <= n_states <= cfg["states"][1]:
            return spec
    if fallback is not None:
        return fallback
    a = list(DIGITS[:2])
    return {"alphabet": a, "start": a[0], "end": a[0], "rules": [], "length": None, "counts": []}