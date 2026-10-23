"""Verificación del módulo 1.

Funciona con pytest (`pytest -q`) y también sin él:
    python tests/test_designer.py
"""
import random
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.designer import build, check_word, run_word  # noqa: E402
from backend.generator import LEVELS, generate_spec  # noqa: E402
from backend.rules import check_word_direct, spec_sentences  # noqa: E402
from backend.validators import MAX_STATES, normalize_spec, sample_words, validate_spec  # noqa: E402

EXAMPLE = {
    "alphabet": ["0", "1"],
    "start": "0",
    "end": "0",
    "rules": [{"symbol": "1", "mode": "allow", "before": None, "after": None}],
}
EXAMPLE_3 = {
    "alphabet": ["0", "1", "2"],
    "start": "0",
    "end": "0",
    "rules": [{"symbol": "2", "mode": "allow", "before": "1", "after": "0"}],
}


def mk(**kw):
    base = {"alphabet": ["0", "1"], "start": "0", "end": "0", "rules": [], "length": None}
    base.update(kw)
    return normalize_spec(base)


def words_up_to(alphabet, budget=3000):
    total = 0
    for length in range(1, 12):
        total += len(alphabet) ** length
        if total > budget:
            break
        for tup in product(alphabet, repeat=length):
            yield "".join(tup)


def assert_well_formed(automaton, spec):
    alphabet = spec["alphabet"]
    ids = {s["id"] for s in automaton["states"]}
    by_state = {}
    for t in automaton["transitions"]:
        assert t["from"] in ids and all(x in ids for x in t["to"])
        assert t["to"], "transición vacía: el autómata no está equilibrado"
        by_state.setdefault(t["from"], set()).add(t["symbol"])
    for sid in ids:
        assert by_state.get(sid) == set(alphabet), f"{sid} no tiene todo el alfabeto"
    err = automaton["error"]
    if err:
        assert err not in automaton["finals"]
        for t in automaton["transitions"]:
            if t["from"] == err:
                assert t["to"] == [err], "el error debe tener rizo con todo el alfabeto"
    if automaton["type"] == "AFD":
        assert all(len(t["to"]) == 1 for t in automaton["transitions"])


# ---------------------------------------------------------------------------
# casos concretos
# ---------------------------------------------------------------------------
def test_user_example_dfa():
    a, steps = build(EXAMPLE, "AFD")
    assert_well_formed(a, EXAMPLE)
    assert len(a["states"]) == 4 and a["error"] == "error"
    q0 = {t["symbol"]: t["to"] for t in a["transitions"] if t["from"] == "q0"}
    assert q0 == {"0": ["q1"], "1": ["error"]}
    assert not check_word(EXAMPLE, "AFD", "10")["valid"]
    assert check_word(EXAMPLE, "AFD", "00011110010")["valid"]
    assert check_word(EXAMPLE, "AFD", "0")["valid"]
    assert steps[0]["kind"] == "state"


def test_user_example_with_context():
    # "pueden existir subcadenas de 2 siempre que vayan precedidas de 1 y seguidas de 0"
    for kind in ("AFD", "AFND"):
        assert check_word(EXAMPLE_3, kind, "01200")["valid"]
        assert check_word(EXAMPLE_3, kind, "0122220")["valid"]
        assert not check_word(EXAMPLE_3, kind, "020")["valid"]  # 2 precedido de 0
        assert not check_word(EXAMPLE_3, kind, "0121")["valid"]  # 2 seguido de 1
        assert not check_word(EXAMPLE_3, kind, "012")["valid"]  # 2 al final


def test_nfa_is_really_nondeterministic():
    a, _ = build(EXAMPLE, "AFND")
    assert_well_formed(a, EXAMPLE)
    assert not a["deterministic"]


def test_word_length():
    exact = mk(length={"min": 5, "max": 5})
    assert validate_spec(exact)["ok"]
    for kind in ("AFD", "AFND"):
        assert check_word(exact, kind, "00000")["valid"]
        assert check_word(exact, kind, "01010")["valid"]
        assert not check_word(exact, kind, "0000")["valid"]
        assert not check_word(exact, kind, "000000")["valid"]
    assert "exactamente 5" in " ".join(spec_sentences(exact))
    rng = mk(length={"min": 3, "max": 6})
    assert check_word(rng, "AFD", "000")["valid"] and check_word(rng, "AFD", "010010")["valid"]
    assert not check_word(rng, "AFD", "00")["valid"] and not check_word(rng, "AFD", "0100010")["valid"]
    only_min = mk(length={"min": 4, "max": None})
    assert check_word(only_min, "AFND", "0000000000")["valid"]
    assert not check_word(only_min, "AFND", "000")["valid"]
    only_max = mk(length={"min": None, "max": 3})
    assert check_word(only_max, "AFD", "0")["valid"] and not check_word(only_max, "AFD", "0000")["valid"]


def test_run_length():
    spec = mk(rules=[{"symbol": "1", "mode": "allow", "min_run": 2, "max_run": 3}])
    assert validate_spec(spec)["ok"]
    for kind in ("AFD", "AFND"):
        assert check_word(spec, kind, "0110")["valid"]
        assert check_word(spec, kind, "01110")["valid"]
        assert check_word(spec, kind, "0")["valid"]  # sin 1 no hay subcadena que limitar
        assert not check_word(spec, kind, "010")["valid"]  # subcadena demasiado corta
        assert not check_word(spec, kind, "011110")["valid"]  # demasiado larga
    # varias subcadenas, cada una con su propia longitud
    assert check_word(spec, "AFD", "011001110")["valid"]
    assert not check_word(spec, "AFD", "0110010")["valid"]
    text = " ".join(spec_sentences(spec))
    assert "de entre 2 y 3 símbolos" in text
    only_max = mk(rules=[{"symbol": "1", "mode": "allow", "max_run": 2}])
    assert check_word(only_max, "AFD", "0110")["valid"] and not check_word(only_max, "AFD", "01110")["valid"]
    # los 0 del medio no tienen límite aunque el 1 sí lo tenga
    assert check_word(only_max, "AFD", "0000110000")["valid"]


def test_length_and_runs_together():
    spec = mk(
        alphabet=["0", "1", "2"],
        rules=[{"symbol": "2", "mode": "allow", "before": "1", "after": "0", "max_run": 2}],
        length={"min": 5, "max": 7},
    )
    assert validate_spec(spec)["ok"]
    for kind in ("AFD", "AFND"):
        assert check_word(spec, kind, "01200")["valid"]
        assert check_word(spec, kind, "012200")["valid"]
        assert not check_word(spec, kind, "0122200")["valid"]  # 3 dos seguidos
        assert not check_word(spec, kind, "0120")["valid"]  # muy corta
        assert not check_word(spec, kind, "01200000")["valid"]  # muy larga


def test_validation_rules():
    assert not validate_spec(mk(alphabet=["0", "a"]))["ok"]  # mezcla
    assert not validate_spec(mk(alphabet=["0"]))["ok"]
    assert not validate_spec(mk(start="9"))["ok"]
    bad_start = {**EXAMPLE_3, "rules": [{"symbol": "0", "mode": "allow", "before": "1", "after": None}]}
    assert not validate_spec(normalize_spec(bad_start))["ok"]
    assert not validate_spec(mk(rules=EXAMPLE["rules"] * 2))["ok"]
    ok = mk(
        rules=[
            {"symbol": "1", "mode": "allow", "before": "0", "after": "0"},
            {"symbol": "0", "mode": "forbid"},
        ]
    )
    assert validate_spec(ok)["ok"]  # 010 es válida
    contradiction = mk(end="1", rules=[{"symbol": "1", "mode": "allow", "after": "0"}])
    assert not validate_spec(contradiction)["ok"]
    # longitudes
    assert not validate_spec(mk(length={"min": 6, "max": 4}))["ok"]
    assert not validate_spec(mk(length={"min": None, "max": 0}))["ok"]
    assert not validate_spec(mk(length={"min": None, "max": 99}))["ok"]
    assert not validate_spec(mk(rules=[{"symbol": "1", "mode": "allow", "min_run": 5, "max_run": 3}]))["ok"]
    assert not validate_spec(mk(rules=[{"symbol": "1", "mode": "forbid", "max_run": 3}]))["ok"]
    # imposible: longitud 2 pero la subcadena de 1 exige 3 símbolos y toda palabra debe terminar en 1
    impossible = mk(end="1", length={"min": None, "max": 2}, rules=[{"symbol": "1", "mode": "allow", "min_run": 3}])
    assert not validate_spec(impossible)["ok"]
    # 1 como longitud mínima no restringe: se descarta
    assert mk(length={"min": 1, "max": None})["length"] is None


def test_size_limit():
    big = mk(alphabet=list("abcde"), start="a", end="e", length={"min": 12, "max": 12},
             rules=[{"symbol": s, "mode": "allow", "max_run": 4} for s in "bcd"])
    res = validate_spec(big)
    assert (not res["ok"]) == any("estados" in e for e in res["errors"])


def test_samples():
    for spec in (mk(length={"min": 9, "max": 9}), mk(), normalize_spec(EXAMPLE_3)):
        s = sample_words(spec)
        assert s["valid"] and s["invalid"]
        assert all(check_word_direct(spec, w)["valid"] for w in s["valid"])
        assert not any(check_word_direct(spec, w)["valid"] for w in s["invalid"])


# ---------------------------------------------------------------------------
# verificación masiva: autómata vs revisión directa
# ---------------------------------------------------------------------------
def random_spec(rng):
    kind = rng.choice(["0123", "abcd"])
    n = rng.randint(2, 4)
    alphabet = list(kind[:n])
    rules = []
    for s in rng.sample(alphabet, rng.randint(0, n)):
        others = [a for a in alphabet if a != s]
        mode = rng.choice(["allow", "allow", "forbid"])
        allow = mode == "allow"
        rules.append(
            {
                "symbol": s,
                "mode": mode,
                "before": rng.choice(others + [None]) if allow else None,
                "after": rng.choice(others + [None]) if allow else None,
                "min_run": rng.choice([None, None, 2, 3]) if allow else None,
                "max_run": rng.choice([None, None, 2, 3, 4]) if allow else None,
            }
        )
    length = None
    if rng.random() < 0.6:
        lo = rng.choice([None, 2, 3, 4])
        hi = rng.choice([None, 3, 5, 7])
        if lo is not None and hi is not None and lo > hi:
            lo, hi = hi, lo
        length = {"min": lo, "max": hi}
    return normalize_spec(
        {"alphabet": alphabet, "start": rng.choice(alphabet), "end": rng.choice(alphabet), "rules": rules, "length": length}
    )


def test_words(spec, rng):
    """Todas las palabras cortas + palabras largas al azar + variaciones de válidas."""
    words = list(words_up_to(spec["alphabet"]))
    top = ((spec.get("length") or {}).get("max") or 8) + 2
    for _ in range(300):
        words.append("".join(rng.choice(spec["alphabet"]) for _ in range(rng.randint(1, top))))
    for w in sample_words(spec, want=4)["valid"]:
        words.append(w)
        words.append(w + spec["alphabet"][0])
        words.append(w[:-1] or w)
    return words


def check_spec_exhaustively(spec, rng):
    words = test_words(spec, rng)
    for kind in ("AFD", "AFND"):
        a, steps = build(spec, kind)
        assert_well_formed(a, spec)
        assert steps and steps[0]["kind"] == "state"
        created = set()
        for s in steps:
            if s["kind"] == "state":
                created.add(s["state"])
            else:
                assert s["from"] in created and s["to"] in created
        assert created == {s["id"] for s in a["states"]}
        trans = {(t["from"], t["symbol"]): t["to"] for t in a["transitions"]}
        for n, w in enumerate(words):
            direct = check_word_direct(spec, w)
            res = run_word(a, w)
            assert res["accepted"] == direct["valid"], (kind, spec, w)
            full = check_word(spec, kind, w) if n % 40 == 0 else None
            if full:
                assert full["consistent"]
            cur = a["initial"]
            for p in res["path"]:
                assert p["from"] == cur and p["to"] in trans[(p["from"], p["symbol"])]
                cur = p["to"]
            if res["accepted"]:
                assert cur in a["finals"]
            elif full and direct["index"] is not None and direct["index"] < len(w):
                # la flecha roja nunca llega después de la violación; puede llegar antes
                # si desde ese punto la palabra ya no tiene salida
                assert full["fail_index"] is not None and full["fail_index"] <= direct["index"], (spec, w, full, direct)


def test_random_specs_exhaustive():
    rng = random.Random(7)
    checked = 0
    while checked < 100:
        spec = random_spec(rng)
        if not validate_spec(spec)["ok"]:
            continue
        check_spec_exhaustively(spec, rng)
        checked += 1


def test_generator_levels():
    rng = random.Random(3)
    for level in LEVELS:
        for kind in ("random", "digits", "letters"):
            for _ in range(12):
                spec = generate_spec(level, kind, rng)
                res = validate_spec(spec)
                assert res["ok"], (level, spec, res)
                assert max(len(build(spec, k)[0]["states"]) for k in ("AFD", "AFND")) <= MAX_STATES
                check_spec_exhaustively(spec, rng)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and k != "test_words"]
    for t in tests:
        t()
        print("ok  ", t.__name__)
    print(f"\n{len(tests)} pruebas pasaron")