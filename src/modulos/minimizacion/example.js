import { ensurePos } from '../../compartido/lib/nfa.js'

// AFD de ejemplo (5 estados, Σ = {0,1}): C y E son equivalentes, así que se fusionan.
// En su análisis aparecen las tres notaciones: M(B,C), F(C,E) y P(A,D).
export const exampleAfd = () =>
  ensurePos({
    alphabet: ['0', '1'],
    states: ['A', 'B', 'C', 'D', 'E'],
    initial: 'A',
    finals: ['B', 'C', 'E'],
    delta: {
      A: { 0: ['B'], 1: ['E'] },
      B: { 0: ['B'], 1: ['C'] },
      C: { 0: ['D'], 1: ['E'] },
      D: { 0: ['C'], 1: ['C'] },
      E: { 0: ['D'], 1: ['E'] },
    },
  })