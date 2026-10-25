// Estado de la animación de la conversión AFND → AFD en un paso dado.
//
// `steps` viene del backend (init / row / cell / done). A partir de los primeros
// `idx` pasos se obtiene lo que debe verse:
//   * la tabla del AFD que se va llenando (filas de la columna Q y sus celdas),
//   * los estados y flechas del diagrama,
//   * qué colorear: amarillo = lo que acaba de aparecer, verde = ya estaba en Q,
//     cian = estado que se está analizando. Los colores solo duran un paso.

export function conversionProgress(steps, idx, dfa) {
  const info = Object.fromEntries(dfa.states.map((s) => [s.id, s]))
  const rows = []
  const rowOf = {}
  const states = new Set()
  const edges = new Map()

  const addRow = (name) => {
    const s = info[name]
    const row = { state: name, initial: !!s.initial, final: !!s.final, error: !!s.error, cells: {} }
    rows.push(row)
    rowOf[name] = row
    states.add(name)
  }

  steps.slice(0, idx).forEach((st) => {
    if (st.kind === 'init') addRow(st.state)
    if (st.kind === 'cell') {
      rowOf[st.state].cells[st.symbol] = st.result
      if (st.is_new) addRow(st.result)
      const key = `${st.state}->${st.result}`
      edges.set(key, [...(edges.get(key) || []), st.symbol])
    }
  })

  const last = idx > 0 ? steps[idx - 1] : null
  const rowTone = {} // nombre -> 'new' | 'cur'
  const cellTone = {} // `${estado}|${símbolo}` -> 'new' | 'ok'
  const refRows = {} // estados del AFND que intervienen en el cálculo
  const refCells = {} // `${estado}|${símbolo}` -> true
  const highlight = { nodes: {}, edges: {} }
  let canvasLast = null

  if (last) {
    if (last.kind === 'init') {
      rowTone[last.state] = 'new'
      canvasLast = { kind: 'state', state: last.state }
    } else if (last.kind === 'row') {
      rowTone[last.state] = 'cur'
      highlight.nodes[last.state] = 'cur'
      last.members.forEach((m) => {
        refRows[m] = true
      })
    } else if (last.kind === 'cell') {
      rowTone[last.state] = 'cur'
      highlight.nodes[last.state] = 'cur'
      cellTone[`${last.state}|${last.symbol}`] = last.is_new ? 'new' : 'ok'
      const key = `${last.state}->${last.result}`
      if (last.is_new) {
        rowTone[last.result] = 'new'
        canvasLast = { kind: 'edge', from: last.state, to: last.result, state: last.result }
      } else {
        highlight.edges[key] = 'ok'
        if (last.result !== last.state) highlight.nodes[last.result] = 'ok'
      }
      last.parts.forEach((p) => {
        refRows[p.state] = true
        refCells[`${p.state}|${last.symbol}`] = true
      })
    }
  }

  return {
    rows,
    visible: { states, edges, last: canvasLast },
    highlight,
    rowTone,
    cellTone,
    refRows,
    refCells,
    done: !!last && last.kind === 'done',
  }
}