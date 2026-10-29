"""Módulo 1: diseño de autómatas finitos a partir de indicaciones.

Se construye siempre un autómata COMPLETO (equilibrado): cada estado tiene una
transición por cada símbolo del alfabeto y lo que incumple las reglas va al
estado `error`, que tiene un rizo con todo el alfabeto y no es final.

Ambos autómatas parten de un "monitor" determinista cuyo estado recuerda el
último símbolo leído, cuántos van seguidos y cuántos símbolos lleva la palabra
(solo lo necesario para las reglas pedidas):

  * AFD : monitor -> minimización de Moore.
  * AFND: el mismo monitor, pero en lugar de marcar finales los estados donde la
          palabra puede terminar, se "adivina" con no determinismo: al llegar a un
          estado donde puede terminar se puede ir a un estado final F ("esta es la
          última letra") o seguir leyendo. Luego se descartan los estados inútiles
          y se fusionan los equivalentes (bisimulación).

Cada construcción devuelve también la lista de `steps` que el frontend anima.
"""
from __future__ import annotations

from ..compartido.automata import (
    ERROR_ID,
    bfs_order,
    bisimulation_partition,
    can_reach,
    moore_partition,
)
from .rules import (
    DEAD,
    START,
    check_word_direct,
    count_rules,
    length_bounds,
    monitor_accepting,
    monitor_next,
    pos_cap,
    rules_by_symbol,
    run_bounds,
)

FIN = "F"  # estado final "adivinado" del AFND


def _qnum(name):
    return 10**6 if name == ERROR_ID else int(name[1:])


def _meaning(spec, rules, members):
    """Qué significa un estado, en palabras."""
    if START in members:
        return "estado inicial: todavía no se ha leído ningún símbolo"
    if FIN in members:
        return "estado final: la palabra termina aquí, con el último símbolo leído"
    monitors = [m for m in members if isinstance(m, tuple)]
    if len(monitors) != 1:
        syms = []
        for mon in monitors:
            if mon[0] not in syms:
                syms.append(mon[0])
        return "se llega aquí después de leer " + " o ".join(syms) + " (comportamiento idéntico)"
    p, r, pos, cnts = monitors[0]
    text = f"se llega aquí después de leer {p}"
    lo, hi = run_bounds(rules.get(p, {}))
    if hi is None and lo > 1:
        text += f" ({'al menos ' if r >= lo else ''}{r} {p} seguidos)"
    elif hi is not None and hi > 1:
        text += f" ({r} {p} seguidos)"
    if pos_cap(spec):
        mn, mx = length_bounds(spec)
        if mx is None and mn is not None and pos >= mn:
            text += f"; la palabra ya tiene al menos {pos} símbolos"
        else:
            text += f"; la palabra lleva {pos} símbolos"
    for c, n in zip(count_rules(spec), cnts):
        sym, lo, hi = c["symbol"], c.get("min") or 0, c.get("max")
        if hi is None and n >= lo:
            text += f"; ya hay al menos {n} {sym} en total"
        else:
            text += f"; lleva {n} {sym} en total"
    return text


def _assemble(kind, spec, order, error_b, delta, finals, reasons, meaning):
    """Convierte bloques abstractos en el autómata final + pasos de animación."""
    alphabet = spec["alphabet"]
    names = {}
    n = 0
    for b in order:
        if b == error_b:
            names[b] = ERROR_ID
        else:
            names[b] = f"q{n}"
            n += 1
    init_b = order[0]
    normal = [b for b in order if b != error_b]
    ordered = normal + ([error_b] if error_b is not None and error_b in names else [])

    def targets(b, a):
        return sorted(delta[(b, a)], key=lambda t: _qnum(names[t]))

    states = [
        {"id": names[b], "initial": b == init_b, "final": b in finals, "error": b == error_b}
        for b in ordered
    ]
    transitions = [
        {"from": names[b], "symbol": a, "to": [names[t] for t in targets(b, a)]}
        for b in ordered
        for a in alphabet
    ]
    nondeterministic = any(len(t["to"]) > 1 for t in transitions)

    # ---- pasos de creación -------------------------------------------------
    steps = []
    created = set()

    def add_state(b):
        created.add(b)
        flags = []
        if b == error_b:
            flags.append("de error")
        else:
            if b == init_b:
                flags.append("inicial")
            if b in finals:
                flags.append("final")
        tag = f" ({', '.join(flags)})" if flags else ""
        steps.append(
            {"kind": "state", "state": names[b], "text": f"Se crea el estado {names[b]}{tag}: {meaning[b]}."}
        )

    add_state(init_b)
    for b in normal:
        for a in alphabet:
            for t in targets(b, a):
                if t not in created:
                    add_state(t)
                steps.append(
                    {
                        "kind": "edge",
                        "from": names[b],
                        "symbol": a,
                        "to": names[t],
                        "text": f"{names[b]} —{a}→ {names[t]}: {reasons[(b, a, t)]}",
                    }
                )
    if error_b is not None and error_b in created:
        for a in alphabet:
            steps.append(
                {
                    "kind": "edge",
                    "from": ERROR_ID,
                    "symbol": a,
                    "to": ERROR_ID,
                    "text": f"error —{a}→ error: rizo, el estado error conserva todo el alfabeto para mantener el equilibrio.",
                }
            )

    automaton = {
        "type": kind,
        "alphabet": list(alphabet),
        "states": states,
        "transitions": transitions,
        "initial": names[init_b],
        "finals": [names[b] for b in ordered if b in finals],
        "error": ERROR_ID if (error_b is not None and error_b in created) else None,
        "deterministic": not nondeterministic,
    }
    return automaton, steps


def explore_monitor(spec, rules):
    """Todos los estados alcanzables del monitor, con sus transiciones."""
    alphabet = spec["alphabet"]
    delta, reason = {}, {}
    order = [START]
    seen = {START}
    i = 0
    while i < len(order):
        m = order[i]
        i += 1
        for c in alphabet:
            t, why = monitor_next(spec, rules, m, c)
            delta[(m, c)], reason[(m, c)] = t, why
            if t not in seen:
                seen.add(t)
                order.append(t)
    return order, delta, reason


# ---------------------------------------------------------------------------
# AFD
# ---------------------------------------------------------------------------
def build_dfa(spec):
    alphabet = spec["alphabet"]
    rules = rules_by_symbol(spec)
    order, delta, reason = explore_monitor(spec, rules)
    accepting = {m for m in order if monitor_accepting(spec, rules, m)}
    block = moore_partition(order, alphabet, delta, accepting)

    members: dict = {}
    for m in order:
        members.setdefault(block[m], []).append(m)
    rep = {b: ms[0] for b, ms in members.items()}
    bdelta = {(b, a): [block[delta[(rep[b], a)]]] for b in members for a in alphabet}
    acc_blocks = {block[m] for m in accepting}

    alive = can_reach(list(members), alphabet, lambda b, a: bdelta[(b, a)], acc_blocks)
    dead_blocks = [b for b in members if b not in alive]
    error_b = dead_blocks[0] if dead_blocks else None

    order_b = bfs_order(block[START], alphabet, lambda b, a: bdelta[(b, a)])
    reasons = {}
    for b in members:
        for a in alphabet:
            t = bdelta[(b, a)][0]
            if b == error_b:
                reasons[(b, a, t)] = "error es un estado trampa: no se puede salir de él."
            else:
                reasons[(b, a, t)] = reason[(rep[b], a)]
    meaning = {}
    for b, ms in members.items():
        if b == error_b:
            meaning[b] = "aquí se cae cuando se incumple alguna regla; no es final y no tiene salida útil"
        else:
            text = _meaning(spec, rules, ms)
            if b in acc_blocks:
                text += (
                    f"; puede terminar aquí porque el último símbolo es {spec['end']} y ya se cumple todo lo pedido"
                    if spec.get("end")
                    else "; puede terminar aquí porque ya se cumple todo lo pedido"
                )
            meaning[b] = text
    return _assemble("AFD", spec, order_b, error_b, bdelta, acc_blocks, reasons, meaning)


# ---------------------------------------------------------------------------
# AFND
# ---------------------------------------------------------------------------
def build_nfa(spec):
    alphabet = spec["alphabet"]
    rules = rules_by_symbol(spec)
    order_m, delta_m, reason_m = explore_monitor(spec, rules)
    accepting = {m for m in order_m if monitor_accepting(spec, rules, m)}

    delta, reason = {}, {}
    for m in order_m:
        for c in alphabet:
            t, why = delta_m[(m, c)], reason_m[(m, c)]
            tg = {t}
            reason[(m, c, t)] = why
            if t != DEAD and t in accepting:
                tg.add(FIN)
                reason[(m, c, FIN)] = (
                    f"No determinismo: este {c} puede ser el último símbolo de la palabra, por eso también puede ir al estado final."
                )
                reason[(m, c, t)] = why + " (la palabra continúa)"
            delta[(m, c)] = tg
    for c in alphabet:
        delta[(FIN, c)] = {DEAD}
        reason[(FIN, c, DEAD)] = "Después del último símbolo no puede venir nada más: cualquier símbolo lleva a error."
        delta[(DEAD, c)] = {DEAD}
        reason[(DEAD, c, DEAD)] = "error es un estado trampa: no se puede salir de él."

    reach = bfs_order(START, alphabet, lambda m, a: delta[(m, a)])
    alive = can_reach(reach, alphabet, lambda m, a: delta[(m, a)], {FIN})

    # los estados que no llevan a ningún final equivalen a error
    def fold(t):
        return t if t in alive else DEAD

    folded = {}
    for m in reach:
        if m not in alive:
            continue
        for c in alphabet:
            tg = {fold(t) for t in delta[(m, c)]}
            if len(tg) > 1:
                tg.discard(DEAD)  # error nunca aporta a un conjunto con otros destinos
            folded[(m, c)] = tg
    for c in alphabet:
        folded[(DEAD, c)] = {DEAD}
    kept = bfs_order(START, alphabet, lambda m, a: folded[(m, a)])

    block = bisimulation_partition(kept, alphabet, folded, {FIN})
    members: dict = {}
    for m in kept:
        members.setdefault(block[m], []).append(m)
    rep = {b: ms[0] for b, ms in members.items()}
    bdelta = {}
    for b in members:
        for a in alphabet:
            bdelta[(b, a)] = {block[t] for t in folded[(rep[b], a)]}
    error_b = block[DEAD] if DEAD in block else None

    order_b = bfs_order(block[START], alphabet, lambda b, a: sorted(bdelta[(b, a)]))
    reasons = {}
    for b in members:
        for a in alphabet:
            for t in bdelta[(b, a)]:
                # busca la explicación en cualquier miembro/destino equivalente
                text = None
                for m in members[b]:
                    for o in sorted(delta[(m, a)], key=str):
                        if block.get(fold(o)) == t:
                            text = reason.get((m, a, o))
                            break
                    if text:
                        break
                if b == error_b:
                    text = "error es un estado trampa: no se puede salir de él."
                reasons[(b, a, t)] = text or f"Se lee {a}."
    meaning = {}
    for b, ms in members.items():
        if b == error_b:
            meaning[b] = "aquí se cae cuando se incumple alguna regla; no es final y no tiene salida útil"
        else:
            meaning[b] = _meaning(spec, rules, ms)
    automaton, steps = _assemble("AFND", spec, order_b, error_b, bdelta, {block[FIN]}, reasons, meaning)
    if automaton["deterministic"]:
        automaton["note"] = (
            "Estas indicaciones no necesitan no determinismo: el AFND resultante coincide con un AFD."
        )
    return automaton, steps


def build(spec, kind):
    if kind == "AFND":
        return build_nfa(spec)
    return build_dfa(spec)


# ---------------------------------------------------------------------------
# Recorrido de una palabra
# ---------------------------------------------------------------------------
def _backtrack(sets, trans, word, k, target):
    states = [target]
    cur = target
    for i in range(k - 1, -1, -1):
        for s in sorted(sets[i]):
            if cur in trans[(s, word[i])]:
                cur = s
                break
        states.append(cur)
    states.reverse()
    return states


def run_word(automaton, word):
    trans = {(t["from"], t["symbol"]): t["to"] for t in automaton["transitions"]}
    finals = set(automaton["finals"])
    err = automaton["error"]
    init = automaton["initial"]
    n = len(word)

    sets = [{init}]
    for ch in word:
        nxt = set()
        for s in sets[-1]:
            nxt.update(trans[(s, ch)])
        sets.append(nxt)
    accepted = bool(sets[-1] & finals)

    if accepted:
        target = sorted(sets[-1] & finals)[0]
        states = _backtrack(sets, trans, word, n, target)
    else:
        k = max(i for i in range(n + 1) if (sets[i] - {err}))
        target = sorted(sets[k] - {err})[0]
        states = _backtrack(sets, trans, word, k, target)
        if k < n:
            options = trans[(states[-1], word[k])]
            nxt = err if err in options else options[0]
            states.append(nxt)
            while len(states) < n + 1:
                states.append(err)

    path = []
    failed = False
    for i in range(len(states) - 1):
        if err is not None and states[i + 1] == err:
            failed = True
        path.append(
            {"index": i, "symbol": word[i], "from": states[i], "to": states[i + 1], "ok": not failed}
        )
    return {"accepted": accepted, "path": path, "initial": init, "final_state": states[-1]}


def check_word(spec, kind, word):
    alphabet = spec["alphabet"]
    bad = [i for i, ch in enumerate(word) if ch not in alphabet]
    if bad:
        i = bad[0]
        return {
            "word": word,
            "kind": kind,
            "valid": False,
            "path": [],
            "initial": None,
            "reason": f"El símbolo «{word[i]}» no pertenece al alfabeto Σ = {{{', '.join(alphabet)}}}.",
            "fail_index": i,
            "invalid_symbol": True,
            "consistent": True,
        }
    automaton, _ = build(spec, kind)
    res = run_word(automaton, word)
    direct = check_word_direct(spec, word)
    dead_at = next((p["index"] for p in res["path"] if not p["ok"]), None)  # cae a error aquí
    fail_index = dead_at
    if fail_index is None and not res["accepted"]:
        fail_index = len(word) - 1 if word else 0  # no cayó a error: termina mal, se marca el último
    if res["accepted"]:
        reason = "La palabra cumple todas las indicaciones."
    elif (
        dead_at is not None
        and direct["index"] is not None
        and dead_at < direct["index"]
        and dead_at < len(word)
    ):
        # el autómata detecta antes que la palabra ya no tiene salida
        reason = (
            f"Con el símbolo {word[dead_at]} (posición {dead_at + 1}) la palabra ya no puede "
            f"cumplir las indicaciones. {direct['reason']}"
        )
    else:
        reason = direct["reason"]
    return {
        "word": word,
        "kind": kind,
        "valid": res["accepted"],
        "path": res["path"],
        "initial": res["initial"],
        "reason": reason,
        "fail_index": None if res["accepted"] else fail_index,
        "invalid_symbol": False,
        "consistent": res["accepted"] == direct["valid"],
    }