"""Servicio del módulo 3: recibe y devuelve diccionarios simples (sin FastAPI).

El router de FastAPI (router.py) y las pruebas llaman a estas mismas funciones.
"""
from __future__ import annotations

from ..conversion.converter import nfa_accepts, nfa_view, normalize_nfa, sample_words, subset_construction, validate_nfa
from ..diseno.designer import run_word
from . import generator
from .minimizer import (
    MAX_MIN_STATES,
    accepts,
    as_nfa,
    dfa_from_automaton,
    dfa_from_deterministic,
    minimize,
    reachable_part,
    to_views,
)


def prepare(nfa, kind):
    """Deja el autómata como AFD: si es AFND lo convierte. Devuelve (AFD interno, información)."""
    automaton, table = nfa_view(nfa, kind)
    removed = []
    if kind == "AFND":
        conv = subset_construction(nfa)
        d = dfa_from_automaton(conv["dfa"])
        dfa = {"automaton": conv["dfa"], "table": conv["table"], "mapping": conv["mapping"]}
    else:
        d, removed = reachable_part(dfa_from_deterministic(nfa))
        a2, t2 = to_views(d)
        dfa = {"automaton": a2, "table": t2, "mapping": None}
    info = {
        "automaton": automaton,
        "table": table,
        "dfa": dfa,
        "converted": kind == "AFND",
        "removed": removed,
        "dfa_states": len(d["names"]),
    }
    return d, info


def _checked(raw):
    """Valida y prepara. Devuelve (nfa, resultado de validación, AFD interno | None, información | None)."""
    nfa = normalize_nfa(raw)
    res = validate_nfa(nfa)
    if not res["ok"]:
        return nfa, res, None, None
    d, info = prepare(nfa, res["kind"])
    if len(d["names"]) > MAX_MIN_STATES:
        res = {
            **res,
            "ok": False,
            "errors": [
                f"El AFD que se va a minimizar tiene {len(d['names'])} estados y la tabla de pares admite hasta "
                f"{MAX_MIN_STATES}. Usa menos estados o menos transiciones múltiples."
            ],
        }
        return nfa, res, None, None
    return nfa, res, d, info


def validate(raw):
    nfa, res, d, info = _checked(raw)
    if d is None:
        return {**res, "automaton": None, "table": [], "dfa": None, "converted": False, "removed": []}
    return {**res, **info}


def run(raw):
    nfa, res, d, info = _checked(raw)
    if d is None:
        return {**res, "automaton": None, "table": [], "dfa": None, "steps": [], "minimal": None}
    out = minimize(d)
    return {
        **res,
        **info,
        "steps": out["steps"],
        "marks": out["marks"],
        "classes": out["classes"],
        "minimal": out["minimal"],
        "stats": {"before": len(d["names"]), "after": len(out["classes"])},
        "examples": sample_words(as_nfa(out["small"])),
    }


def check_word(raw, word):
    """Recorre la palabra en el AFD minimizado y la compara con el AFD (y con el AFND original)."""
    nfa, res, d, info = _checked(raw)
    if d is None:
        return {"ok": False, "errors": res["errors"]}
    alphabet = nfa["alphabet"]
    bad = [i for i, ch in enumerate(word) if ch not in alphabet]
    if bad:
        i = bad[0]
        return {
            "ok": True,
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
    out = minimize(d)
    small, mapping = out["small"], out["minimal"]["mapping"]
    automaton = out["minimal"]["automaton"]
    members = {m["name"]: m["members"] for m in mapping}
    r = run_word(automaton, word)
    # el minimizado debe aceptar lo mismo que el AFD (y, si se convirtió, que el AFND original)
    agree = accepts(d, word) == r["accepted"]
    if info["converted"]:
        agree = agree and nfa_accepts(nfa, word) == r["accepted"]
    dead_at = next((p["index"] for p in r["path"] if not p["ok"]), None)
    fail_index = dead_at
    if fail_index is None and not r["accepted"]:
        fail_index = len(word) - 1 if word else 0
    last = r["final_state"]
    label = f"{last} = {{{', '.join(members[last])}}}" if len(members[last]) > 1 else last
    if r["accepted"]:
        reason = f"El AFD minimizado termina en {label}, que es un estado final."
    elif dead_at is not None:
        step = r["path"][dead_at]
        reason = (
            f"En la posición {dead_at + 1} (símbolo {step['symbol']}) el autómata pasa a error: "
            f"desde {step['from']} no hay camino con {step['symbol']}."
        )
    elif not word:
        reason = "La palabra vacía no se acepta: el estado inicial no es final."
    else:
        reason = f"El AFD minimizado termina en {label}, que no es final."
    return {
        "ok": True,
        "word": word,
        "kind": "AFD",
        "valid": r["accepted"],
        "path": r["path"],
        "initial": r["initial"],
        "reason": reason,
        "fail_index": None if r["accepted"] else fail_index,
        "invalid_symbol": False,
        "consistent": agree,
    }


def generate(level, alphabet_kind):
    return {"level": level, "nfa": generator.generate(level, alphabet_kind)}