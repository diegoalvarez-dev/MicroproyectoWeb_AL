"""Validaciones de las indicaciones (spec) y ejemplos de palabras."""
from __future__ import annotations

from itertools import product

from .rules import check_word_direct, language_is_empty, rules_by_symbol

DIGITS = "0123456789"
LETTERS = "abcdefghijklmnopqrstuvwxyz"
MIN_SYMBOLS, MAX_SYMBOLS = 2, 5


def normalize_spec(raw):
    """Limpia espacios y convierte '' en None. Acepta dicts o modelos pydantic."""
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    rules = []
    for r in raw.get("rules") or []:
        rules.append(
            {
                "symbol": (r.get("symbol") or "").strip(),
                "mode": r.get("mode") or "allow",
                "before": (r.get("before") or "").strip() or None,
                "after": (r.get("after") or "").strip() or None,
            }
        )
    return {
        "alphabet": [str(a).strip() for a in (raw.get("alphabet") or [])],
        "start": (raw.get("start") or "").strip(),
        "end": (raw.get("end") or "").strip(),
        "rules": rules,
    }


def validate_spec(spec):
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
    if spec["start"] not in alphabet:
        errors.append("El símbolo con el que inicia la palabra debe pertenecer al alfabeto.")
    if spec["end"] not in alphabet:
        errors.append("El símbolo con el que finaliza la palabra debe pertenecer al alfabeto.")

    # --- reglas ---------------------------------------------------------
    seen = set()
    for r in spec["rules"]:
        s = r["symbol"]
        if s not in alphabet:
            errors.append(f"La regla sobre «{s or '?'}» usa un símbolo que no está en el alfabeto.")
            continue
        if r["mode"] not in ("allow", "forbid"):
            errors.append(f"La regla sobre {s} tiene un tipo desconocido.")
            continue
        if s in seen:
            errors.append(f"Hay más de una regla para el símbolo {s}: deja solo una.")
        seen.add(s)
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
        if r["mode"] == "forbid" and (r.get("before") or r.get("after")):
            errors.append(f"La regla «no pueden existir subcadenas de {s}» no admite condiciones de precedencia.")
        if r["mode"] == "allow" and not r.get("before") and not r.get("after"):
            warnings.append(
                f"La regla de subcadenas de {s} no restringe nada: sin una regla en contra ya se permiten. Puedes dejarla como indicación."
            )
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}

    # --- contradicciones ------------------------------------------------
    rules = rules_by_symbol(spec)
    rs = rules.get(spec["start"], {})
    if rs.get("before"):
        errors.append(
            f"La palabra inicia en {spec['start']}, pero las subcadenas de {spec['start']} deben ir precedidas de {rs['before']}: "
            f"la primera no tiene nada antes. Quita esa condición o cambia el símbolo inicial."
        )
    re_ = rules.get(spec["end"], {})
    if re_.get("after"):
        errors.append(
            f"La palabra finaliza en {spec['end']}, pero las subcadenas de {spec['end']} deben ir seguidas de {re_['after']}: "
            f"la última no tiene nada después. Quita esa condición o cambia el símbolo final."
        )
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings}
    if language_is_empty(spec):
        errors.append("Las indicaciones se contradicen: ninguna palabra puede cumplirlas todas. Revisa las reglas.")
        return {"ok": False, "errors": errors, "warnings": warnings}
    return {"ok": True, "errors": [], "warnings": warnings}


def sample_words(spec, want=4):
    """Palabras de ejemplo válidas e inválidas (para la prueba rápida)."""
    alphabet = spec["alphabet"]
    valid: list[str] = []
    invalid: list[str] = []
    total = 0
    for length in range(1, 9):
        total += len(alphabet) ** length
        if total > 4000:
            break
        for tup in product(alphabet, repeat=length):
            w = "".join(tup)
            if check_word_direct(spec, w)["valid"]:
                valid.append(w)
            elif length >= 2:
                invalid.append(w)

    def pick(items, k, keep_first=0):
        if len(items) <= k:
            return items
        head = items[:keep_first]
        rest = items[keep_first:]
        need = k - len(head)
        step = max(1, len(rest) // need)
        return head + rest[::step][:need]

    return {"valid": pick(valid, want, keep_first=2), "invalid": pick(invalid, want, keep_first=1)}
