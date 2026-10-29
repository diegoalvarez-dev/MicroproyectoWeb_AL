"""Práctica: el estudiante dibuja (o llena en tabla) su propio autómata y se comprueba
si cumple las indicaciones.

La comprobación es exacta, no por ejemplos: se recorren a la vez el "monitor" de las
indicaciones (rules.py) y los conjuntos de estados del autómata del estudiante hasta
encontrar una palabra que uno acepte y el otro no. Como se avanza por longitud, las
palabras que se devuelven son las más cortas posibles.
"""
from __future__ import annotations

from collections import deque

from ..conversion import converter
from .rules import START, check_word_direct, monitor_accepting, monitor_next, rules_by_symbol

MAX_PAIRS = 400_000  # tope de combinaciones (monitor, conjunto de estados) que se recorren


def _equivalence(spec, nfa):
    """Palabras más cortas en que el estudiante se equivoca. Devuelve (faltante, sobrante, completo)."""
    rules = rules_by_symbol(spec)
    finals = set(nfa["finals"])
    alphabet = spec["alphabet"]
    start = (START, frozenset([nfa["initial"]]))
    queue = deque([(start, "")])
    seen = {start}
    missing = extra = None  # missing: debería aceptarla y la rechaza · extra: la acepta y no debería
    complete = True
    while queue:
        (m, subset), word = queue.popleft()
        expected = monitor_accepting(spec, rules, m)
        got = bool(subset & finals)
        if expected and not got and missing is None:
            missing = word
        if got and not expected and extra is None:
            extra = word
        if missing is not None and extra is not None:
            break
        for c in alphabet:
            nm, _ = monitor_next(spec, rules, m, c)
            nsub = frozenset(t for s in subset for t in converter.cell(nfa, s, c))
            key = (nm, nsub)
            if key in seen or (nsub == frozenset() and nm == "#"):
                continue
            if len(seen) >= MAX_PAIRS:
                complete = False
                continue
            seen.add(key)
            queue.append((key, word + c))
    return missing, extra, complete


def _alphabet_problem(spec, nfa):
    if nfa["alphabet"] != spec["alphabet"]:
        return (
            f"El alfabeto de tu autómata ({{{', '.join(nfa['alphabet'])}}}) no coincide con el de las indicaciones "
            f"({{{', '.join(spec['alphabet'])}}})."
        )
    return None


def check_student(spec, kind, raw_nfa):
    """Veredicto sobre el autómata del estudiante."""
    nfa = converter.normalize_nfa(raw_nfa)
    problem = _alphabet_problem(spec, nfa)
    if problem:
        return {"ok": False, "errors": [problem]}
    res = converter.validate_nfa(nfa)
    if not res["ok"]:
        return {"ok": False, "errors": res["errors"], "warnings": res.get("warnings", [])}
    automaton, table = converter.nfa_view(nfa, res["kind"])
    missing, extra, complete = _equivalence(spec, nfa)

    def detail(word, spec_accepts):
        direct = check_word_direct(spec, word)
        return {"word": word, "spec_accepts": spec_accepts, "reason": direct["reason"]}

    counter = {
        "missing": detail(missing, True) if missing is not None else None,
        "extra": detail(extra, False) if extra is not None else None,
    }
    kind_ok = not (kind == "AFD" and res["kind"] == "AFND")
    kind_note = None
    if not kind_ok:
        cells = res.get("nondeterministic") or []
        why = "; ".join(f"{c['state']} con {c['symbol']} va a {', '.join(c['targets'])}" for c in cells[:3])
        kind_note = f"Las indicaciones piden un AFD y el tuyo es un AFND (no determinista): {why}."
    elif kind == "AFND" and res["kind"] == "AFD":
        kind_note = "Pediste un AFND y el tuyo es determinista: un AFD también es un AFND, así que es válido."
    language_ok = missing is None and extra is None and complete
    return {
        "ok": True,
        "kind": kind,
        "student_kind": res["kind"],
        "kind_ok": kind_ok,
        "kind_note": kind_note,
        "language_ok": language_ok,
        "complete": complete,
        "correct": language_ok and kind_ok,
        "counterexamples": counter,
        "automaton": automaton,
        "table": table,
        "warnings": res.get("warnings", []),
    }


def student_word(spec, kind, raw_nfa, word):
    """Recorre una palabra en el autómata del estudiante y la compara con lo que piden las indicaciones."""
    nfa = converter.normalize_nfa(raw_nfa)
    problem = _alphabet_problem(spec, nfa)
    if problem:
        return {"ok": False, "errors": [problem]}
    res = converter.validate_nfa(nfa)
    if not res["ok"]:
        return {"ok": False, "errors": res["errors"]}
    out = converter.check_word(nfa, word)
    if out.get("invalid_symbol"):
        return {"ok": True, **out, "expected": False, "agrees": True}
    direct = check_word_direct(spec, word)
    student_accepts = out["valid"]
    if student_accepts == direct["valid"]:
        verdict = (
            "Tu autómata la acepta y cumple las indicaciones."
            if student_accepts
            else f"Tu autómata la rechaza, y es correcto: {direct['reason']}"
        )
    elif student_accepts:
        verdict = f"Tu autómata la ACEPTA, pero no debería: {direct['reason']}"
    else:
        verdict = "Tu autómata la RECHAZA, pero esta palabra cumple todas las indicaciones."
    return {
        "ok": True,
        **out,
        "reason": verdict,
        "expected": direct["valid"],
        "agrees": student_accepts == direct["valid"],
        "consistent": True,
    }