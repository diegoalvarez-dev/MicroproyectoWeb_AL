// Estado de la minimización en un paso dado.
//
// `steps` viene del backend (init / terminals / sym / decide / review_start / review /
// review_final / done). Con los primeros `idx` pasos se reconstruye:
//   * la tabla de pares (X = distinguibles, F = fusión, P = pendiente),
//   * el par que se analiza y las casillas a las que llegan sus transiciones,
//   * qué resaltar en la tabla de transición y en el diagrama del AFD,
//   * el registro de notaciones M(…) F(…) P(…) que se van decidiendo.

const MARK = { M: 'X', F: 'F', P: 'P' }

export const pairKey = (a, b) => `${a},${b}`

export function minimizationProgress(steps, idx, names) {
  const order = Object.fromEntries(names.map((n, i) => [n, i]))
  const keyOf = (a, b) => (order[a] <= order[b] ? pairKey(a, b) : pairKey(b, a))
  const shown = steps.slice(0, idx)
  const last = idx > 0 ? steps[idx - 1] : null

  const marks = {}
  const log = []
  shown.forEach((st) => {
    if (st.kind === 'terminals') st.pairs.forEach(([a, b]) => (marks[pairKey(a, b)] = 'X'))
    if (st.kind === 'decide') {
      marks[pairKey(...st.pair)] = MARK[st.result]
      log.push({ notation: st.notation, result: st.result, pair: st.pair, review: false })
    }
    if (st.kind === 'review') {
      if (st.result !== 'P') marks[pairKey(...st.pair)] = MARK[st.result]
      log.push({ notation: st.notation, result: st.result, pair: st.pair, review: true })
    }
    if (st.kind === 'review_final') st.pairs.forEach(([a, b]) => (marks[pairKey(a, b)] = 'F'))
  })

  // ---- par que se analiza ahora y sus transiciones ----
  let pair = null
  let lines = []
  let decision = null
  if (last) {
    if (last.kind === 'sym') {
      pair = last.pair
      for (let i = idx - 1; i >= 0 && steps[i].kind === 'sym' && pairKey(...steps[i].pair) === pairKey(...pair); i--) {
        lines.unshift(steps[i])
      }
    } else if (last.kind === 'decide') {
      pair = last.pair
      for (let i = idx - 2; i >= 0 && steps[i].kind === 'sym' && pairKey(...steps[i].pair) === pairKey(...pair); i--) {
        lines.unshift(steps[i])
      }
      decision = last
    } else if (last.kind === 'review') {
      pair = last.pair
      lines = last.lines
      decision = last
    }
  }

  const refKeys = new Set(lines.map((l) => keyOf(l.succ[0], l.succ[1])))
  const curKey = pair ? pairKey(...pair) : null

  // ---- resaltado en la tabla de transición y en el diagrama del AFD ----
  const rowTone = {}
  const cellTone = {}
  const highlight = { nodes: {}, edges: {} }
  if (pair) {
    lines.forEach((l) => {
      l.moves.forEach((m) => {
        cellTone[`${m.from}|${l.symbol}`] = 'ref'
        highlight.edges[`${m.from}->${m.to}`] = 'ok'
        highlight.nodes[m.to] = 'ok'
      })
    })
    pair.forEach((s) => {
      rowTone[s] = 'cur'
      highlight.nodes[s] = 'cur'
    })
  }

  const pending = Object.entries(marks)
    .filter(([, v]) => v === 'P')
    .map(([k]) => k)

  return {
    marks,
    pair,
    curKey,
    refKeys,
    lines,
    decision,
    log,
    rowTone,
    cellTone,
    highlight,
    pending,
    phase: last ? last.kind : null,
    done: !!last && last.kind === 'done',
  }
}