// Qué estados y flechas se colorean mientras se recorre una palabra.
// Prioridad cuando un mismo elemento se visita varias veces: bad > cur > ok.

const RANK = { ok: 1, cur: 2, bad: 3 }

function put(map, key, tone) {
  if (!map[key] || RANK[tone] > RANK[map[key]]) map[key] = tone
}

export function runHighlight(run) {
  const nodes = {}
  const edges = {}
  if (!run) return { nodes, edges }
  const { result, k, finished } = run
  const path = result.path
  if (result.initial == null) return { nodes, edges } // símbolo fuera del alfabeto

  const done = path.slice(0, k)
  put(nodes, result.initial, k === 0 && !finished ? 'cur' : 'ok')

  done.forEach((step, i) => {
    const latest = i === k - 1 && !finished
    const tone = !step.ok ? 'bad' : latest ? 'cur' : 'ok'
    put(edges, `${step.from}->${step.to}`, tone)
    put(nodes, step.to, tone)
  })

  if (finished) {
    const end = path.length ? path[path.length - 1].to : result.initial
    // Si el recorrido terminó sin pasar por error pero la palabra no es válida,
    // el estado donde se detuvo (no final) se marca en rojo.
    put(nodes, end, result.valid ? 'ok' : 'bad')
  }
  return { nodes, edges }
}
