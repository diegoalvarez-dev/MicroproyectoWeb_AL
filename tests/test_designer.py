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
from backend.rules import check_word_direct  # noqa: E402
from backend.validators import validate_spec  # noqa: E402

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


def test_validation_rules():
    assert not validate_spec({**EXAMPLE, "alphabet": ["0", "a"]})["ok"]  # mezcla
    assert not validate_spec({**EXAMPLE, "alphabet": ["0"]})["ok"]
    assert not validate_spec({**EXAMPLE, "start": "9"})["ok"]
    bad_start = {**EXAMPLE_3, "rules": [{"symbol": "0", "mode": "allow", "before": "1", "after": None}]}
    assert not validate_spec(bad_start)["ok"]
    dup = {**EXAMPLE, "rules": EXAMPLE["rules"] * 2}
    assert not validate_spec(dup)["ok"]
    empty = {
        "alphabet": ["0", "1"],
        "start": "0",
        "end": "0",
        "rules": [{"symbol": "1", "mode": "allow", "before": "0", "after": "0"},
                  {"symbol": "0", "mode": "forbid", "before": None, "after": None}],
    }
    # 0 1+ 0 con 0 simple: es válido (010), así que no está vacío
    assert validate_spec(empty)["ok"]
    contradiction = {
        "alphabet": ["0", "1"],
        "start": "0",
        "end": "1",
        "rules": [{"symbol": "1", "mode": "allow", "before": None, "after": "0"}],
    }
    assert not validate_spec(contradiction)["ok"]


def random_spec(rng):
    kind = rng.choice([("0123", 4), ("abcd", 4)])[0]
    n = rng.randint(2, 4)
    alphabet = list(kind[:n])
    rules = []
    for s in rng.sample(alphabet, rng.randint(0, n)):
        others = [a for a in alphabet if a != s]
        mode = rng.choice(["allow", "allow", "forbid"])
        rules.append(
            {
                "symbol": s,
                "mode": mode,
                "before": rng.choice(others + [None]) if mode == "allow" else None,
                "after": rng.choice(others + [None]) if mode == "allow" else None,
            }
        )
    return {"alphabet": alphabet, "start": rng.choice(alphabet), "end": rng.choice(alphabet), "rules": rules}


def check_spec_exhaustively(spec):
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
        for n, w in enumerate(words_up_to(spec["alphabet"])):
            direct = check_word_direct(spec, w)
            res = run_word(a, w)
            assert res["accepted"] == direct["valid"], (kind, spec, w)
            full = check_word(spec, kind, w) if n % 25 == 0 else None
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
    while checked < 120:
        spec = random_spec(rng)
        if not validate_spec(spec)["ok"]:
            continue
        check_spec_exhaustively(spec)
        checked += 1


def test_generator_levels():
    rng = random.Random(3)
    for level in LEVELS:
        for kind in ("random", "digits", "letters"):
            for _ in range(15):
                spec = generate_spec(level, kind, rng)
                assert validate_spec(spec)["ok"], (level, spec)
                check_spec_exhaustively(spec)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok  ", t.__name__)
    print(f"\n{len(tests)} pruebas pasaron")
