"""Verificación del módulo 2 (AFND -> AFD).

Funciona con pytest (`pytest -q`) y también sin él:
    python tests/test_converter.py
"""
import random
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.conversion.converter import (  # noqa: E402
    LEVELS,
    MAX_DFA_STATES,
    MAX_NFA_STATES,
    dfa_size,
    check_word,
    generate_nfa,
    nfa_accepts,
    nfa_view,
    normalize_nfa,
    sample_words,
    subset_construction,
    validate_nfa,
)
from backend.diseno.designer import run_word  # noqa: E402

# El ejemplo del enunciado del equipo
EXAMPLE = normalize_nfa(
    {
        "alphabet": ["0", "1"],
        "states": ["A", "B", "C", "D"],
        "initial": "A",
        "finals": ["D"],
        "delta": {
            "A": {"0": ["B", "C"], "1": ["C"]},
            "B": {"0": ["C"], "1": ["B"]},
            "C": {"0": ["D"], "1": ["A"]},
            "D": {"0": ["A", "D"], "1": ["B"]},
        },
    }
)


def words_up_to(alphabet, top):
    for length in range(0, top + 1):
        for t in product(alphabet, repeat=length):
            yield "".join(t)


def test_user_example_conversion():
    res = validate_nfa(EXAMPLE)
    assert res["ok"] and res["kind"] == "AFND"
    assert {(c["state"], c["symbol"]) for c in res["nondeterministic"]} == {("A", "0"), ("D", "0")}
    conv = subset_construction(EXAMPLE)
    names = [s["id"] for s in conv["dfa"]["states"]]
    # orden de aparición: A, luego lo que sale de A con 0 y 1, etc.
    assert names == ["A", "BC", "C", "CD", "AB", "D", "AD", "B", "ABCD", "ABC", "BCD", "ACD"]
    rows = {r["state"]: r["cells"] for r in conv["table"]}
    assert rows["A"] == {"0": "BC", "1": "C"}
    assert rows["BC"] == {"0": "CD", "1": "AB"}
    assert rows["CD"] == {"0": "AD", "1": "AB"}
    assert rows["ABCD"] == {"0": "ABCD", "1": "ABC"}
    assert set(conv["dfa"]["finals"]) == {"CD", "D", "AD", "ABCD", "BCD", "ACD"}
    assert conv["dfa"]["error"] is None  # ninguna celda queda vacía en el ejemplo
    # B y C también aparecen solos (B lo alcanza D con 1; C lo alcanza A con 1)
    assert "B" in names and "C" in names


def test_steps_are_consistent():
    conv = subset_construction(EXAMPLE)
    steps = conv["steps"]
    assert steps[0]["kind"] == "init" and steps[-1]["kind"] == "done"
    created = {steps[0]["state"]}
    analyzed = []
    for s in steps:
        if s["kind"] == "row":
            assert s["state"] in created, "se analiza un estado que aún no apareció"
            analyzed.append(s["state"])
        elif s["kind"] == "cell":
            assert s["state"] == analyzed[-1]
            if s["is_new"]:
                assert s["result"] not in created
                created.add(s["result"])
            else:
                assert s["result"] in created
    assert created == {m["name"] for m in conv["mapping"]} == set(analyzed)
    # cada estado se analiza una sola vez y en orden de aparición
    assert analyzed == [s["id"] for s in conv["dfa"]["states"]]
    cell_steps = [s for s in steps if s["kind"] == "cell"]
    assert len(cell_steps) == len(analyzed) * len(EXAMPLE["alphabet"])
    first = cell_steps[0]
    assert first["state"] == "A" and first["symbol"] == "0" and first["result"] == "BC" and first["is_new"]
    assert "δ(A, 0) = {B, C}" in first["text"]
    third = next(s for s in cell_steps if s["state"] == "BC" and s["symbol"] == "0")
    assert "δ(B, 0) ∪ δ(C, 0)" in third["text"] and "{C} ∪ {D}" in third["text"]


def test_error_state_for_empty_cells():
    nfa = normalize_nfa(
        {
            "alphabet": ["0", "1"],
            "states": ["A", "B"],
            "initial": "A",
            "finals": ["B"],
            "delta": {"A": {"0": ["A", "B"]}, "B": {"1": ["B"]}},
        }
    )
    res = validate_nfa(nfa)
    assert res["ok"] and res["kind"] == "AFND"
    conv = subset_construction(nfa)
    dfa = conv["dfa"]
    assert dfa["error"] == "error"
    err_rows = [t for t in dfa["transitions"] if t["from"] == "error"]
    assert {t["symbol"] for t in err_rows} == {"0", "1"} and all(t["to"] == ["error"] for t in err_rows)
    assert "error" not in dfa["finals"]
    # el AFND que se dibuja también se completa con error
    automaton, table = nfa_view(nfa, "AFND")
    assert automaton["error"] == "error"
    a1 = next(t for t in automaton["transitions"] if t["from"] == "A" and t["symbol"] == "1")
    assert a1["to"] == ["error"]
    assert table[0]["cells"]["1"] == []  # celda vacía: la interfaz la muestra como ∅


def test_detects_dfa():
    dfa_like = normalize_nfa(
        {
            "alphabet": ["0", "1"],
            "states": ["A", "B"],
            "initial": "A",
            "finals": ["B"],
            "delta": {"A": {"0": ["B"], "1": ["A"]}, "B": {"0": ["B"], "1": ["A"]}},
        }
    )
    res = validate_nfa(dfa_like)
    assert res["ok"] and res["kind"] == "AFD" and res["nondeterministic"] == []
    # una celda vacía no vuelve no determinista al autómata (va a error)
    partial = normalize_nfa({**dfa_like, "delta": {"A": {"0": ["B"]}, "B": {"1": ["A"]}}})
    assert validate_nfa(partial)["kind"] == "AFD"


def test_validation_errors():
    def bad(**kw):
        base = {**EXAMPLE}
        base.update(kw)
        return validate_nfa(normalize_nfa(base))

    assert not bad(alphabet=["0"])["ok"]
    assert not bad(alphabet=["0", "a"])["ok"]
    assert not bad(alphabet=["0", "0"])["ok"]
    assert not bad(states=["A"], initial="A", finals=["A"], delta={})["ok"]
    assert not bad(initial="")["ok"]
    assert not bad(initial="Z")["ok"]
    assert not bad(finals=[])["ok"]
    assert not bad(finals=["Z"])["ok"]
    assert not bad(states=["A", "B", "c", "D"])["ok"]
    assert not bad(delta={"A": {"2": ["B"]}})["ok"]  # símbolo fuera del alfabeto
    assert not bad(delta={"A": {"0": ["Z"]}})["ok"]  # destino inexistente
    # el estado inicial no llega a ningún final
    assert not bad(delta={"A": {"0": ["A"], "1": ["A"]}}, finals=["D"])["ok"]
    # inaccesibles: es aviso, no error
    res = bad(states=["A", "B", "C", "D"], delta={"A": {"0": ["A", "B"], "1": ["A"]}, "B": {"1": ["B"]}}, finals=["B"])
    assert res["ok"] and res["unreachable"] == ["C", "D"] and res["warnings"]


def test_size_limit():
    # 8 estados donde casi todo el que se alcanza se mezcla produce muchos subconjuntos
    states = list("ABCDEFGH")
    delta = {s: {"0": [states[(i + 1) % 8]], "1": [s, states[(i + 1) % 8]]} for i, s in enumerate(states)}
    nfa = normalize_nfa(
        {"alphabet": ["0", "1"], "states": states, "initial": "A", "finals": ["H"], "delta": delta}
    )
    res = validate_nfa(nfa)
    size = len(subset_construction(nfa)["dfa"]["states"])
    assert res["ok"] == (size <= MAX_DFA_STATES)


def random_nfa(rng):
    n = rng.randint(2, 6)
    k = rng.randint(2, 3)
    states = list("ABCDEFGH"[:n])
    alphabet = list(rng.choice(["0123", "abcd"])[:k])
    delta = {
        s: {a: rng.sample(states, rng.choice([0, 0, 1, 1, 2, 3][: n + 3] if n > 2 else [0, 1, 2])) for a in alphabet}
        for s in states
    }
    return normalize_nfa(
        {
            "alphabet": alphabet,
            "states": states,
            "initial": "A",
            "finals": rng.sample(states, rng.randint(1, n)),
            "delta": delta,
        }
    )


def check_equivalence(nfa, rng):
    conv = subset_construction(nfa)
    dfa = conv["dfa"]
    trans = {(t["from"], t["symbol"]): t["to"] for t in dfa["transitions"]}
    ids = {s["id"] for s in dfa["states"]}
    for s in ids:  # completo y determinista
        for a in nfa["alphabet"]:
            assert len(trans[(s, a)]) == 1 and trans[(s, a)][0] in ids
    if dfa["error"]:
        assert dfa["error"] not in dfa["finals"]
        assert all(trans[(dfa["error"], a)] == [dfa["error"]] for a in nfa["alphabet"])
    words = list(words_up_to(nfa["alphabet"], 6 if len(nfa["alphabet"]) == 2 else 5))
    words += ["".join(rng.choice(nfa["alphabet"]) for _ in range(rng.randint(7, 12))) for _ in range(120)]
    for w in words:
        assert run_word(dfa, w)["accepted"] == nfa_accepts(nfa, w), (nfa, w)
        if rng.random() < 0.03:
            assert check_word(nfa, w)["consistent"]


def test_random_nfas_equivalent():
    rng = random.Random(11)
    checked = 0
    while checked < 120:
        nfa = random_nfa(rng)
        if not validate_nfa(nfa)["ok"]:
            continue
        check_equivalence(nfa, rng)
        checked += 1


def test_check_word_and_samples():
    assert check_word(EXAMPLE, "0")["valid"] is False  # A -0-> BC: ningún final
    ok = check_word(EXAMPLE, "00")  # A -0-> BC -0-> CD (contiene D)
    assert ok["valid"] and ok["consistent"] and ok["path"][-1]["to"] == "CD"
    assert "CD = {C, D}" in ok["reason"]
    bad_symbol = check_word(EXAMPLE, "012")
    assert bad_symbol["invalid_symbol"] and bad_symbol["fail_index"] == 2
    s = sample_words(EXAMPLE)
    assert s["valid"] and s["invalid"]
    assert all(nfa_accepts(EXAMPLE, w) for w in s["valid"])
    assert not any(nfa_accepts(EXAMPLE, w) for w in s["invalid"])
    # una palabra que cae a error
    nfa = normalize_nfa(
        {
            "alphabet": ["0", "1"],
            "states": ["A", "B"],
            "initial": "A",
            "finals": ["B"],
            "delta": {"A": {"0": ["A", "B"]}, "B": {"1": ["B"]}},
        }
    )
    assert check_word(nfa, "01")["valid"]  # {A,B} -1-> {B}
    dead = check_word(nfa, "10")  # A no lee 1: se cae a error de inmediato
    assert not dead["valid"] and "pasa a error" in dead["reason"] and dead["fail_index"] == 0


def test_generator_levels():
    rng = random.Random(5)
    for level in LEVELS:
        for kind in ("random", "digits", "letters"):
            for _ in range(15):
                nfa = generate_nfa(level, kind, rng)
                res = validate_nfa(nfa)
                assert res["ok"], (level, nfa, res)
                assert res["kind"] == "AFND", (level, nfa)
                assert not res["unreachable"]
                check_equivalence(nfa, rng)
    # los niveles crecen en tamaño
    sizes = {}
    for level in LEVELS:
        sizes[level] = sum(len(generate_nfa(level, "digits", rng)["states"]) for _ in range(10)) / 10
    assert sizes["facil"] < sizes["medio"] < sizes["dificil"]
def test_custom_state_names():
    # el usuario puede poner la letra que quiera a cada estado (A–Z)
    nfa = normalize_nfa(
        {
            "alphabet": ["a", "b"],
            "states": ["X", "M", "Q"],
            "initial": "X",
            "finals": ["Q"],
            "delta": {"X": {"a": ["M", "Q"], "b": ["X"]}, "M": {"a": ["Q"], "b": ["M"]}, "Q": {"b": ["X"]}},
        }
    )
    res = validate_nfa(nfa)
    assert res["ok"] and res["kind"] == "AFND", res
    conv = subset_construction(nfa)
    names = [s["id"] for s in conv["dfa"]["states"]]
    assert names[0] == "X" and "MQ" in names  # las letras de cada subconjunto van en orden alfabético
    assert res["dfa_size"] == len(names) == dfa_size(nfa)
    check_equivalence(nfa, random.Random(3))
    # nombres que no son una sola letra mayúscula
    for bad_name in ("a", "AB", "1", "é", ""):
        bad = normalize_nfa({**nfa, "states": ["X", "M", bad_name], "delta": {}})
        assert not validate_nfa(bad)["ok"], bad_name


def test_many_states_and_early_cut():
    assert MAX_NFA_STATES >= 12
    # 12 estados en cadena: el AFD sigue siendo pequeño y es válido
    states = list("ABCDEFGHIJKL")
    delta = {s: {"0": [states[i + 1]] if i < 11 else [], "1": [s]} for i, s in enumerate(states)}
    delta["A"]["0"] = ["A", "B"]  # un solo no determinismo: el AFD crece como una cadena
    nfa = normalize_nfa({"alphabet": ["0", "1"], "states": states, "initial": "A", "finals": ["L"], "delta": delta})
    res = validate_nfa(nfa)
    assert res["ok"], res
    assert res["dfa_size"] == len(subset_construction(nfa)["dfa"]["states"]) == dfa_size(nfa)
    # dfa_size con tope se detiene al pasarse (no construye todos los subconjuntos)
    assert dfa_size(nfa, 5) == 6
    # un autómata que explota en subconjuntos se rechaza con un mensaje claro
    big = {s: {"0": [states[(i + 1) % 12]], "1": [s, states[(i + 1) % 12], states[(i + 5) % 12]]} for i, s in enumerate(states)}
    nfa = normalize_nfa({"alphabet": ["0", "1"], "states": states, "initial": "A", "finals": ["L"], "delta": big})
    res = validate_nfa(nfa)
    if dfa_size(nfa) > MAX_DFA_STATES:
        assert not res["ok"] and "más de" in res["errors"][0]

if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok  ", t.__name__)
    print(f"\n{len(tests)} pruebas pasaron")