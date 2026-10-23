"""Utilidades comunes para autómatas finitos.

Aquí viven las piezas que reutilizarán los tres módulos:
particiones (Moore / bisimulación), recorridos BFS y alcanzabilidad inversa.
"""
from __future__ import annotations

ERROR_ID = "error"


def moore_partition(states, alphabet, delta, accepting):
    """Partición de equivalencia de un AFD completo (refinamiento de Moore).

    delta: dict[(estado, símbolo)] -> estado
    Devuelve dict estado -> índice de bloque.
    """
    block = {s: (1 if s in accepting else 0) for s in states}
    count = len(set(block.values()))
    while True:
        ids: dict = {}
        new = {}
        for s in states:
            sig = (block[s], tuple(block[delta[(s, a)]] for a in alphabet))
            new[s] = ids.setdefault(sig, len(ids))
        if len(ids) == count:
            return new
        block, count = new, len(ids)


def bisimulation_partition(states, alphabet, delta, finals):
    """Cociente por bisimulación para un AFND.

    delta: dict[(estado, símbolo)] -> iterable de estados
    Dos estados se fusionan si tienen la misma finalidad y, por cada símbolo,
    llegan exactamente a los mismos bloques.
    """
    block = {s: (1 if s in finals else 0) for s in states}
    count = len(set(block.values()))
    while True:
        ids: dict = {}
        new = {}
        for s in states:
            sig = (
                block[s],
                tuple(tuple(sorted({block[t] for t in delta[(s, a)]})) for a in alphabet),
            )
            new[s] = ids.setdefault(sig, len(ids))
        if len(ids) == count:
            return new
        block, count = new, len(ids)


def bfs_order(start, alphabet, targets):
    """Orden de descubrimiento BFS. targets(nodo, símbolo) -> iterable de nodos."""
    order = [start]
    seen = {start}
    i = 0
    while i < len(order):
        node = order[i]
        i += 1
        for a in alphabet:
            for t in targets(node, a):
                if t not in seen:
                    seen.add(t)
                    order.append(t)
    return order


def can_reach(nodes, alphabet, targets, goal):
    """Nodos desde los que se puede llegar a algún nodo de `goal`."""
    pred: dict = {n: set() for n in nodes}
    for n in nodes:
        for a in alphabet:
            for t in targets(n, a):
                pred.setdefault(t, set()).add(n)
    seen = set(goal)
    stack = list(goal)
    while stack:
        x = stack.pop()
        for p in pred.get(x, ()):
            if p not in seen:
                seen.add(p)
                stack.append(p)
    return seen
