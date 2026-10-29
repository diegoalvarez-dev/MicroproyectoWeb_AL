"""Validaciones de las indicaciones (spec) y ejemplos de palabras."""
from __future__ import annotations

import json
import random
from collections import deque

from .rules import check_word_direct, language_is_empty, rules_by_symbol

DIGITS = "0123456789"
LETTERS = "abcdefghijklmnopqrstuvwxyz"
MIN_SYMBOLS, MAX_SYMBOLS = 2, 5
MAX_LEN = 12  # longitud máxima que se puede pedir para la palabra
MAX_RUN = 8  # longitud máxima que se puede pedir para una subcadena
MAX_COUNT = 12  # total máximo que se puede pedir de un símbolo (la palabra mide a lo sumo MAX_LEN)
MAX_STATES = 40  # más estados que esto ya no se dibuja con claridad


def _to_int(v):
    if v is None or v == "" or isinstance(v, bool):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _merge_rules(raw_rules):
    """Une las reglas que hablan del mismo símbolo (cada fila de la interfaz es una sola condición).

    Devuelve (reglas, conflictos): `conflictos` son frases cuando dos filas se contradicen.
    """
    merged: dict = {}
    conflicts: list = []
    for r in raw_rules:
        sym = (r.get("symbol") or "").strip()
        mode = r.get("mode") or "allow"
        m = merged.setdefault(
            sym, {"symbol": sym, "mode": "allow", "before": None, "after": None, "min_run": None, "max_run": None, "_modes": set()}
        )
        m["_modes"].add(mode)
        lo, hi = _to_int(r.get("min_run")), _to_int(r.get("max_run"))
        if lo is not None and lo <= 1:
            lo = None  # una subcadena siempre tiene al menos 1 símbolo
        for side, label in (("before", "precedidas"), ("after", "seguidas")):
            v = (r.get(side) or "").strip() or None
            if v is None:
                continue
            if m[side] is not None and m[side] != v:
                conflicts.append(
                    f"Las subcadenas de {sym} no pueden ir {label} de {m[side]} y de {v} a la vez: deja una sola condición."
                )
            else:
                m[side] = v
        if lo is not None:
            m["min_run"] = lo if m["min_run"] is None else max(m["min_run"], lo)
        if hi is not None:
            m["max_run"] = hi if m["max_run"] is None else min(m["max_run"], hi)
    rules = []
    for sym, m in merged.items():
        modes = m.pop("_modes")
        if "forbid" in modes:
            m["mode"] = "forbid"
            if "allow" in modes:
                conflicts.append(
                    f"Una indicación dice que pueden existir subcadenas de {sym} y otra que no pueden existir: se contradicen."
                )
        rules.append(m)
    return rules, conflicts


def normalize_spec(raw):
    """Limpia espacios y convierte '' en None. Acepta dicts o modelos pydantic."""
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    rules, conflicts = _merge_rules(raw.get("rules") or [])
    raw_len = raw.get("length") or {}
    lmin, lmax = _to_int(raw_len.get("min")), _to_int(raw_len.get("max"))
    if lmin is not None and lmin <= 1:
        lmin = None  # la palabra vacía ya no es válida, así que 1 no restringe
    length = {"min": lmin, "max": lmax} if (lmin is not None or lmax is not None) else None
    counts = []
    for c in raw.get("counts") or []:
        cmin, cmax = _to_int(c.get("min")), _to_int(c.get("max"))
        if cmin == 0:
            cmin = None  # pedir «al menos 0» no restringe
        if cmin is None and cmax is None:
            continue
        counts.append({"symbol": (c.get("symbol") or "").strip(), "min": cmin, "max": cmax})
    return {
        "alphabet": [str(a).strip() for a in (raw.get("alphabet") or [])],
        "start": (raw.get("start") or "").strip(),
        "end": (raw.get("end") or "").strip(),
        "rules": rules,
        "length": length,
        "counts": counts,
        "conflicts": conflicts,
    }


def automaton_size(spec):
    """Estados del AFD y del AFND que salen de estas indicaciones."""
    from .designer import build_dfa, build_nfa

    return len(build_dfa(spec)[0]["states"]), len(build_nfa(spec)[0]["states"])


def validate_spec(spec, check_size=True):
    errors: list[str] = []
    warnings: list[str] = []
    alphabet = spec["alphabet"]

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
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- inicio y fin ---------------------------------------------------
    if spec.get("start") and spec["start"] not in alphabet:
        errors.append("El símbolo con el que inicia la palabra debe pertenecer al alfabeto.")
    if spec.get("end") and spec["end"] not in alphabet:
        errors.append("El símbolo con el que finaliza la palabra debe pertenecer al alfabeto.")

    # --- longitud de la palabra ------------------------------------------
    length = spec.get("length") or {}
    lmin, lmax = length.get("min"), length.get("max")
    if lmax is not None and not (1 <= lmax <= MAX_LEN):
        errors.append(f"La longitud máxima de la palabra debe estar entre 1 y {MAX_LEN} símbolos.")
    if lmin is not None and not (2 <= lmin <= MAX_LEN):
        errors.append(f"La longitud mínima de la palabra debe estar entre 2 y {MAX_LEN} símbolos.")
    if lmin is not None and lmax is not None and lmin > lmax:
        errors.append(f"La longitud mínima ({lmin}) no puede ser mayor que la máxima ({lmax}).")

    # --- reglas ---------------------------------------------------------
    errors.extend(spec.get("conflicts") or [])
    for r in spec["rules"]:
        s = r["symbol"]
        if s not in alphabet:
            errors.append(f"La regla sobre «{s or '?'}» usa un símbolo que no está en el alfabeto.")
            continue
        if r["mode"] not in ("allow", "forbid"):
            errors.append(f"La regla sobre {s} tiene un tipo desconocido.")
            continue
        for side, label in (("before", "precedidas"), ("after", "seguidas")):
            v = r.get(side)
            if v is None:
                continue
            if v not in alphabet:
                errors.append(f"La condición «{label} de {v}» de la regla de {s} usa un símbolo fuera del alfabeto.")
            elif v == s:
                errors.append(
                    f"Las subcadenas de {s} no pueden ir {label} de {s}: una subcadena consecutiva ya agrupa todos los {s} seguidos."
                )
        lo, hi = r.get("min_run"), r.get("max_run")
        if hi is not None and not (1 <= hi <= MAX_RUN):
            errors.append(f"La longitud máxima de las subcadenas de {s} debe estar entre 1 y {MAX_RUN}.")
        if lo is not None and not (2 <= lo <= MAX_RUN):
            errors.append(f"La longitud mínima de las subcadenas de {s} debe estar entre 2 y {MAX_RUN}.")
        if lo is not None and hi is not None and lo > hi:
            errors.append(
                f"En las subcadenas de {s}, la longitud mínima ({lo}) no puede ser mayor que la máxima ({hi})."
            )
        if r["mode"] == "forbid" and (r.get("before") or r.get("after") or lo or hi):
            errors.append(
                f"La regla «no pueden existir subcadenas de {s}» no admite condiciones de precedencia ni de longitud."
            )
        if r["mode"] == "allow" and not (r.get("before") or r.get("after") or lo or hi):
            warnings.append(
                f"La regla de subcadenas de {s} no restringe nada: sin una regla en contra ya se permiten. Puedes dejarla como indicación."
            )
    # --- suma total de un símbolo ---------------------------------------
    counted = set()
    for c in spec.get("counts") or []:
        s, lo, hi = c["symbol"], c.get("min"), c.get("max")
        if s not in alphabet:
            errors.append(f"La suma total de «{s or '?'}» usa un símbolo que no está en el alfabeto.")
            continue
        if s in counted:
            errors.append(f"Hay más de una indicación de suma total para el símbolo {s}: deja solo una.")
        counted.add(s)
        for v, label in ((lo, "mínimo"), (hi, "máximo")):
            if v is not None and not (0 <= v <= MAX_COUNT):
                errors.append(f"El total {label} de {s} debe estar entre 0 y {MAX_COUNT}.")
        if lo is not None and hi is not None and lo > hi:
            errors.append(f"La suma total de {s}: el mínimo ({lo}) no puede ser mayor que el máximo ({hi}).")
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- coherencia entre las indicaciones --------------------------------
    counts = spec.get("counts") or []
    if lmax is not None:
        for c in counts:
            need = c.get("min") or 0
            if need > lmax:
                errors.append(
                    f"No es coherente: pides {need} símbolos {c['symbol']} en total, pero la palabra mide como máximo {lmax}."
                )
        total_min = sum(c.get("min") or 0 for c in counts)
        if total_min > lmax and not errors:
            errors.append(
                f"No es coherente: la suma de los totales mínimos ({total_min}) es mayor que la longitud máxima de la palabra ({lmax})."
            )
    if lmin is not None and len(counts) == len(alphabet) and all(c.get("max") is not None for c in counts):
        total_max = sum(c["max"] for c in counts)
        if total_max < lmin:
            errors.append(
                f"No es coherente: entre todos los símbolos la palabra tendría como máximo {total_max} símbolos, pero pides al menos {lmin}."
            )
    for c in counts:
        if c.get("max") == 0:
            for field, label in (("start", "inicia"), ("end", "finaliza")):
                if spec.get(field) == c["symbol"]:
                    errors.append(
                        f"No es coherente: la palabra {label} en {c['symbol']}, pero el total de {c['symbol']} es 0."
                    )
        r_ = rules_by_symbol(spec).get(c["symbol"], {})
        if (c.get("min") or 0) > 0 and c.get("max") is not None and r_.get("min_run") and c["max"] < r_["min_run"]:
            errors.append(
                f"No es coherente: las subcadenas de {c['symbol']} necesitan al menos {r_['min_run']} símbolos seguidos, "
                f"pero el total de {c['symbol']} es como máximo {c['max']}."
            )
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- contradicciones ------------------------------------------------
    rules = rules_by_symbol(spec)
    rs = rules.get(spec.get("start"), {})
    if rs.get("before"):
        errors.append(
            f"La palabra inicia en {spec['start']}, pero las subcadenas de {spec['start']} deben ir precedidas de {rs['before']}: "
            f"la primera no tiene nada antes. Quita esa condición o cambia el símbolo inicial."
        )
    re_ = rules.get(spec.get("end"), {})
    if re_.get("after"):
        errors.append(
            f"La palabra finaliza en {spec['end']}, pero las subcadenas de {spec['end']} deben ir seguidas de {re_['after']}: "
            f"la última no tiene nada después. Quita esa condición o cambia el símbolo final."
        )
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}
    if language_is_empty(spec):
        errors.append(
            "Las indicaciones se contradicen: ninguna palabra puede cumplirlas todas. "
            "Revisa el inicio, el fin, la longitud y las reglas."
        )
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- tamaño del autómata --------------------------------------------
    if check_size:
        n = max(automaton_size(spec))
        if n > MAX_STATES:
            errors.append(
                f"Con estas indicaciones el autómata tendría {n} estados y el máximo para dibujarlo es {MAX_STATES}. "
                "Reduce la longitud, el alfabeto o los límites de las subcadenas."
            )
            return {"ok": False, "errors": errors, "warnings": warnings}
    return {"ok": True, "errors": [], "warnings": warnings}


def _dist_to_final(trans, finals, states, alphabet):
    """Pasos mínimos desde cada estado hasta un final (búsqueda hacia atrás)."""
    pred: dict = {s: set() for s in states}
    for s in states:
        for a in alphabet:
            pred[trans[(s, a)]].add(s)
    dist = {f: 0 for f in finals}
    queue = deque(finals)
    while queue:
        x = queue.popleft()
        for p in pred.get(x, ()):
            if p not in dist:
                dist[p] = dist[x] + 1
                queue.append(p)
    return dist


def sample_words(spec, want=4):
    """Palabras de ejemplo válidas e inválidas (para la prueba rápida).

    Las válidas se obtienen recorriendo el AFD (así funcionan aunque la palabra
    tenga que medir 10 símbolos) y las inválidas son variaciones de una válida.
    """
    from .designer import build_dfa

    automaton, _ = build_dfa(spec)
    alphabet = spec["alphabet"]
    trans = {(t["from"], t["symbol"]): t["to"][0] for t in automaton["transitions"]}
    states = [s["id"] for s in automaton["states"]]
    finals = set(automaton["finals"])
    err = automaton["error"]
    dist = _dist_to_final(trans, finals, states, alphabet)
    init = automaton["initial"]
    rng = random.Random(json.dumps(spec, sort_keys=True))
    max_len = MAX_LEN

    # palabra válida más corta
    shortest, queue, seen = None, deque([(init, "")]), {init}
    while queue:
        s, w = queue.popleft()
        if s in finals and w:
            shortest = w
            break
        for a in alphabet:
            t = trans[(s, a)]
            if t != err and t not in seen:
                seen.add(t)
                queue.append((t, w + a))

    valid: list[str] = [shortest] if shortest else []
    for _ in range(60):
        s, w = init, ""
        while len(w) < max_len:
            if s in finals and w and (rng.random() < 0.45 or len(w) + 1 >= max_len):
                break
            room = max_len - len(w)
            options = [
                a for a in alphabet
                if trans[(s, a)] != err and trans[(s, a)] in dist and dist[trans[(s, a)]] + 1 <= room
            ]
            if not options:
                break
            if dist.get(s, 0) + len(w) + 1 >= max_len:  # hay que cerrar ya
                closing = [a for a in options if dist[trans[(s, a)]] == dist[s] - 1]
                options = closing or options
            a = rng.choice(options)
            s, w = trans[(s, a)], w + a
        if s in finals and w and w not in valid:
            valid.append(w)
        if len(valid) >= 25:
            break
    valid = [w for w in valid if check_word_direct(spec, w)["valid"]]

    # inválidas: pequeñas variaciones de las válidas, una por cada tipo de error
    invalid: list[str] = []
    reasons: set[str] = set()
    pool: list[str] = []
    for w in valid[:8]:
        for i in range(len(w)):
            for a in alphabet:
                if a != w[i]:
                    pool.append(w[:i] + a + w[i + 1:])
            pool.append(w[:i] + w[i + 1:])
        for a in alphabet:
            pool.append(w + a)
            pool.append(a + w)
    for _ in range(40):
        pool.append("".join(rng.choice(alphabet) for _ in range(rng.randint(2, 6))))
    seen_words: set[str] = set()
    for w in pool:
        if not w or w in seen_words:
            continue
        seen_words.add(w)
        res = check_word_direct(spec, w)
        if res["valid"]:
            continue
        key = res["reason"][:24]
        if key in reasons:
            continue
        reasons.add(key)
        invalid.append(w)
    invalid.sort(key=lambda w: (len(w), w))

    def pick(items, k):
        if len(items) <= k:
            return items
        step = len(items) / k
        return [items[int(i * step)] for i in range(k)]

    valid.sort(key=lambda w: (len(w), w))
    return {"valid": pick(valid, want), "invalid": pick(invalid, want)}