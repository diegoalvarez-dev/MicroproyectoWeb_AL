"""Verificación del módulo 3 (minimización por pares distinguibles).

Funciona con pytest (`pytest -q`) y también sin él:
    python tests/test_minimizacion.py
"""
import random
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.compartido.automata import moore_partition  # noqa: E402
from backend.conversion.converter import dfa_size, normalize_nfa  # noqa: E402
from backend.minimizacion import generator, service  # noqa: E402
from backend.minimizacion.minimizer import MAX_MIN_STATES, accepts, minimize  # noqa: E402


def dfa(names, initial, finals, table, alphabet=("0", "1")):
    """AFD interno a partir de una tabla {estado: (destino con 0, destino con 1, …)}."""
    trans = {(s, a): t for s, row in table.items() for a, t in zip(alphabet, row)}
    return {"alphabet": list(alphabet), "names": list(names), "initial": initial, "finals": set(finals), "trans": trans}


def decisions(out):
    return {tuple(s["pair"]): s for s in out["steps"] if s["kind"] == "decide"}


def words_up_to(alphabet, top):
    for n in range(top + 1):
        for t in product(alphabet, repeat=n):
            yield "".join(t)


# ---------------------------------------------------------------------------
# los tres ejemplos del enunciado (M, F y P)
# ---------------------------------------------------------------------------
def test_example_marcar():
    # A,0->A  B,0->D  → par (A,D) ya marcado por el estado final;  A,1->C  B,1->E → (C,E)
    d = dfa("ABCDE", "A", "D", {"A": "AC", "B": "DE", "C": "CC", "D": "DD", "E": "EE"})
    out = minimize(d)
    first = out["steps"][1]
    assert first["kind"] == "terminals"
    assert {tuple(p) for p in first["pairs"]} == {("A", "D"), ("B", "D"), ("C", "D"), ("D", "E")}
    syms = [s for s in out["steps"] if s["kind"] == "sym" and s["pair"] == ["A", "B"]]
    assert [s["symbol"] for s in syms] == ["0", "1"]
    assert syms[0]["succ"] == ["A", "D"] and syms[0]["status"] == "marked"
    assert syms[1]["succ"] == ["C", "E"] and syms[1]["status"] == "empty"
    dec = decisions(out)[("A", "B")]
    assert dec["result"] == "M" and dec["notation"] == "M(A,B)" and dec["because"]["symbol"] == "0"
    assert out["marks"]["A,B"] == "X"


def test_example_fusion():
    # A,0->D  B,0->D  → (D,D) diagonal;  A,1->B  B,1->B → (B,B) diagonal  ⇒ F(A,B)
    d = dfa("ABD", "A", "D", {"A": "DB", "B": "DB", "D": "DD"})
    out = minimize(d)
    syms = [s for s in out["steps"] if s["kind"] == "sym" and s["pair"] == ["A", "B"]]
    assert [s["status"] for s in syms] == ["diagonal", "diagonal"]
    dec = decisions(out)[("A", "B")]
    assert dec["result"] == "F" and dec["notation"] == "F(A,B)"
    assert out["marks"]["A,B"] == "F"
    assert out["classes"] == [["A", "B"], ["D"]]
    assert out["minimal"]["automaton"]["initial"] == "AB"
    assert [m["name"] for m in out["minimal"]["mapping"]] == ["AB", "D"]


def test_example_pendiente():
    # A,0->A  B,0->B → (A,B) el mismo par;  A,1->C  B,1->A → (C,A) sin marcar  ⇒ P(A,B)
    d = dfa("ABCD", "A", "D", {"A": "AC", "B": "BA", "C": "DC", "D": "DD"})
    out = minimize(d)
    dec = decisions(out)[("A", "B")]
    assert dec["result"] == "P" and dec["notation"] == "P(A,B)"
    syms = [s for s in out["steps"] if s["kind"] == "sym" and s["pair"] == ["A", "B"]]
    assert syms[0]["same_pair"] and syms[0]["status"] == "empty"
    # al revisar los pendientes: (A,C) se marcó por (A,D) y arrastra a (A,B)
    assert decisions(out)[("A", "C")]["result"] == "M"
    reviews = [s for s in out["steps"] if s["kind"] == "review"]
    assert reviews and reviews[0]["pair"] == ["A", "B"] and reviews[0]["result"] == "M"
    assert out["marks"]["A,B"] == "X"


def test_pendientes_sin_marcas_se_fusionan():
    # (A,B) depende de sí mismo: nada lo marca ⇒ pendiente ⇒ al final se fusiona
    d = dfa("ABC", "A", "C", {"A": "AB", "B": "BA", "C": "CC"})
    out = minimize(d)
    assert decisions(out)[("A", "B")]["result"] == "P"
    assert out["steps"][-2]["kind"] == "review_final" and out["steps"][-2]["pairs"] == [["A", "B"]]
    assert out["classes"] == [["A", "B"], ["C"]]


def test_afd_ya_minimo_y_casos_borde():
    d = dfa("AB", "A", "B", {"A": "AB", "B": "BA"})
    out = minimize(d)
    assert out["classes"] == [["A"], ["B"]] and "ya es mínimo" in out["steps"][-1]["text"]
    # todos finales: nada que marcar al inicio y todo se fusiona
    d = dfa("ABC", "A", "ABC", {"A": "BC", "B": "CA", "C": "AB"})
    out = minimize(d)
    assert out["steps"][1]["pairs"] == [] and out["classes"] == [["A", "B", "C"]]
    assert out["minimal"]["automaton"]["states"][0]["id"] == "ABC"
    # un solo estado: no hay pares
    d = dfa("A", "A", "A", {"A": "AA"})
    out = minimize(d)
    assert out["classes"] == [["A"]] and [s["kind"] for s in out["steps"]] == ["init", "terminals", "done"]


# ---------------------------------------------------------------------------
# propiedades
# ---------------------------------------------------------------------------
def random_dfa(rng):
    n = rng.randint(2, 9)
    k = rng.randint(2, 3)
    alphabet = list("0123"[:k])
    names = list("ABCDEFGHI"[:n])
    trans = {(s, a): rng.choice(names) for s in names for a in alphabet}
    finals = {s for s in names if rng.random() < 0.4}
    return {"alphabet": alphabet, "names": names, "initial": "A", "finals": finals, "trans": trans}


def test_agrees_with_moore_and_keeps_language():
    rng = random.Random(7)
    for _ in range(250):
        d = random_dfa(rng)
        out = minimize(d)
        blocks = moore_partition(d["names"], d["alphabet"], d["trans"], d["finals"])
        expected = {}
        for s, b in blocks.items():
            expected.setdefault(b, []).append(s)
        assert sorted(map(tuple, out["classes"])) == sorted(tuple(v) for v in expected.values()), d
        small = out["small"]
        # el minimizado es mínimo: ya no hay estados equivalentes
        again = moore_partition(small["names"], small["alphabet"], small["trans"], small["finals"])
        assert len(set(again.values())) == len(small["names"])
        for w in words_up_to(d["alphabet"], 6 if len(d["alphabet"]) == 2 else 4):
            assert accepts(d, w) == accepts(small, w), (d, w)


def test_steps_are_consistent():
    rng = random.Random(21)
    for _ in range(120):
        d = random_dfa(rng)
        out = minimize(d)
        steps, names, alphabet = out["steps"], d["names"], d["alphabet"]
        assert steps[0]["kind"] == "init" and steps[-1]["kind"] == "done"
        order = [(names[i], names[j]) for i in range(len(names)) for j in range(i + 1, len(names))]
        marks = {}
        for s in steps:  # se reconstruye la tabla solo con los pasos
            if s["kind"] == "terminals":
                for p in s["pairs"]:
                    marks[tuple(p)] = "X"
            elif s["kind"] == "decide":
                assert tuple(s["pair"]) not in marks, "un par se analiza dos veces"
                marks[tuple(s["pair"])] = {"M": "X", "F": "F", "P": "P"}[s["result"]]
            elif s["kind"] == "review":
                assert marks[tuple(s["pair"])] == "P"
                if s["result"] != "P":
                    marks[tuple(s["pair"])] = {"M": "X", "F": "F"}[s["result"]]
            elif s["kind"] == "review_final":
                for p in s["pairs"]:
                    assert marks[tuple(p)] == "P"
                    marks[tuple(p)] = "F"
        assert {tuple(k.split(",")): v for k, v in out["marks"].items()} == marks
        assert set(marks) == set(order) and "P" not in marks.values()
        analyzed = [tuple(s["pair"]) for s in steps if s["kind"] == "decide"]
        assert analyzed == [pq for pq in order if marks[pq] != "X" or pq in analyzed]  # en orden
        # cada decisión viene precedida por un paso por símbolo
        for i, s in enumerate(steps):
            if s["kind"] == "decide":
                back = steps[i - len(alphabet) : i]
                assert [b["symbol"] for b in back] == alphabet and all(b["pair"] == s["pair"] for b in back)


# ---------------------------------------------------------------------------
# servicio: AFND → AFD automático, AFD incompleto, inaccesibles, límites
# ---------------------------------------------------------------------------
EXAMPLE_NFA = {
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


def test_service_converts_afnd_first():
    v = service.validate(EXAMPLE_NFA)
    assert v["ok"] and v["kind"] == "AFND" and v["converted"]
    assert len(v["dfa"]["automaton"]["states"]) == 12 == v["dfa_states"]
    assert v["dfa"]["mapping"] and v["table"][0]["cells"]["0"] == ["B", "C"]
    out = service.run(EXAMPLE_NFA)
    assert out["ok"] and out["stats"]["before"] == 12 and out["stats"]["after"] <= 12
    assert out["steps"][0]["kind"] == "init" and out["steps"][-1]["kind"] == "done"
    # el minimizado acepta lo mismo que el AFND original
    for w in words_up_to(["0", "1"], 7):
        r = service.check_word(EXAMPLE_NFA, w)
        assert r["ok"] and r["consistent"], w


def test_service_afd_completes_with_error_and_drops_unreachable():
    nfa = {
        "alphabet": ["0", "1"],
        "states": ["A", "B", "C", "D"],
        "initial": "A",
        "finals": ["B"],
        "delta": {"A": {"0": ["B"]}, "B": {"0": ["B"], "1": ["A"]}, "C": {"0": ["D"], "1": ["D"]}, "D": {"0": ["D"], "1": ["D"]}},
    }
    v = service.validate(nfa)
    assert v["ok"] and v["kind"] == "AFD" and not v["converted"]
    assert v["removed"] == ["C", "D"]  # inaccesibles
    names = [s["id"] for s in v["dfa"]["automaton"]["states"]]
    assert names == ["A", "B", "error"]
    out = service.run(nfa)
    assert out["stats"] == {"before": 3, "after": 3}
    assert out["minimal"]["automaton"]["error"] == "error"


def test_service_errors_and_limit():
    assert not service.validate({**EXAMPLE_NFA, "finals": []})["ok"]
    assert not service.run({**EXAMPLE_NFA, "alphabet": ["0"]})["ok"]
    # un AFND cuyo AFD tiene entre 21 y 40 estados se rechaza con un mensaje claro
    rng = random.Random(3)
    found = None
    for _ in range(4000):
        n = rng.randint(6, 9)
        states = list("ABCDEFGHI"[:n])
        delta = {s: {a: rng.sample(states, rng.choice([1, 1, 2, 3])) for a in "01"} for s in states}
        nfa = normalize_nfa({"alphabet": ["0", "1"], "states": states, "initial": "A", "finals": [states[-1]], "delta": delta})
        if MAX_MIN_STATES < dfa_size(nfa, 60) <= 40:
            found = nfa
            break
    if found:
        res = service.validate(found)
        assert not res["ok"] and str(MAX_MIN_STATES) in res["errors"][0]


def test_check_word_details():
    r = service.check_word(EXAMPLE_NFA, "0x1")
    assert r["ok"] and r["invalid_symbol"] and r["fail_index"] == 1
    nfa = {
        "alphabet": ["0", "1"],
        "states": ["A", "B", "C"],
        "initial": "A",
        "finals": ["C"],
        "delta": {"A": {"0": ["B"], "1": ["B"]}, "B": {"0": ["C"], "1": ["C"]}, "C": {"0": ["C"], "1": ["C"]}},
    }
    r = service.check_word(nfa, "00")
    assert r["valid"] and r["consistent"] and "C" in r["reason"]
    r = service.check_word(nfa, "0")
    assert not r["valid"] and "no es final" in r["reason"] or "no" in r["reason"]


# ---------------------------------------------------------------------------
# ejercicios
# ---------------------------------------------------------------------------
def test_generator_levels():
    rng = random.Random(5)
    for level in generator.LEVELS:
        for kind in ("random", "digits", "letters"):
            for _ in range(12):
                nfa = generator.generate(level, kind, rng)
                v = service.validate(nfa)
                assert v["ok"], (level, nfa, v)
                if level == "dificil":
                    assert v["kind"] == "AFND" and v["converted"]
                else:
                    assert v["kind"] == "AFD" and not v["removed"]
                    out = service.run(nfa)
                    assert out["stats"]["after"] < out["stats"]["before"], (level, nfa)
                    n = len(nfa["states"])
                    assert n == (4 if level == "facil" else n) and (n in (5, 6) if level == "medio" else True)
    assert service.generate("facil", "digits")["nfa"]["alphabet"] == ["0", "1"]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok  ", t.__name__)
    print(f"\n{len(tests)} pruebas pasaron")