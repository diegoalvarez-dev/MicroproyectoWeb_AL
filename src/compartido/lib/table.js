// Tabla de transición de un autómata del backend (para TransitionTable).
//   { states: [{ id, final, error }], alphabet, initial, transitions: [{ from, symbol, to: [..] }] }
export function tableOf(automaton) {
  const cell = {}
  automaton.transitions.forEach((t) => {
    cell[`${t.from}|${t.symbol}`] = t.to
  })
  return automaton.states.map((s) => ({
    state: s.id,
    initial: s.id === automaton.initial,
    final: !!s.final,
    error: !!s.error,
    cells: Object.fromEntries(automaton.alphabet.map((a) => [a, cell[`${s.id}|${a}`] ?? []])),
  }))
}