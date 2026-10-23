// Geometría del diagrama: posiciones de los estados y curvas de las flechas.
// Es JavaScript puro (sin React) para poder probarlo fuera del navegador.

export const R = 30 // radio de un estado
const GAP_X = 185
const GAP_Y = 135
const M_LEFT = 120
const M_RIGHT = 70
const M_TOP = 95
const ARROW_L = 11
const ARROW_W = 5.5

const num = (id) => (id === 'error' ? 1e9 : parseInt(id.slice(1), 10))
const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1
  return [x / d, y / d]
}
const f = (n) => Math.round(n * 10) / 10
const pt = (p) => `${f(p[0])},${f(p[1])}`

// Punta de flecha: `tip` es la punta y `dir` el vector unitario de avance.
function arrowAt(tip, dir) {
  const bx = tip[0] - dir[0] * ARROW_L
  const by = tip[1] - dir[1] * ARROW_L
  const px = -dir[1] * ARROW_W
  const py = dir[0] * ARROW_W
  return {
    points: `${pt(tip)} ${pt([bx + px, by + py])} ${pt([bx - px, by - py])}`,
    base: [bx + dir[0], by + dir[1]],
  }
}

function loopEdge(g, p, down) {
  const s = down ? 1 : -1
  const a = 0.6
  const sx = Math.sin(a) * R
  const sy = s * Math.cos(a) * R
  const p0 = [p.x - sx, p.y + sy]
  const tip = [p.x + sx, p.y + sy]
  const c1 = [p.x - 50, p.y + s * (R + 68)]
  const c2 = [p.x + 50, p.y + s * (R + 68)]
  const ar = arrowAt(tip, unit(tip[0] - c2[0], tip[1] - c2[1]))
  const path = `M${pt(p0)} C${pt(c1)} ${pt(c2)} ${pt(ar.base)}`
  const mx = (p0[0] + 3 * c1[0] + 3 * c2[0] + tip[0]) / 8
  const my = (p0[1] + 3 * c1[1] + 3 * c2[1] + tip[1]) / 8
  return { ...g, loop: true, path, arrow: ar.points, label: { x: f(mx), y: f(my + s * 14) } }
}

function linkEdge(g, a, b, k) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const n = [-dy / d, dx / d]
  const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2]
  const c = [mid[0] + n[0] * k * d, mid[1] + n[1] * k * d]
  const u0 = unit(c[0] - a.x, c[1] - a.y)
  const start = [a.x + u0[0] * R, a.y + u0[1] * R]
  const u2 = unit(c[0] - b.x, c[1] - b.y)
  const tip = [b.x + u2[0] * (R + 3), b.y + u2[1] * (R + 3)]
  const ar = arrowAt(tip, [-u2[0], -u2[1]])
  const path = `M${pt(start)} Q${pt(c)} ${pt(ar.base)}`
  const m = [
    0.25 * start[0] + 0.5 * c[0] + 0.25 * ar.base[0],
    0.25 * start[1] + 0.5 * c[1] + 0.25 * ar.base[1],
  ]
  let side = Math.sign(k)
  let nn = n
  if (side === 0) {
    nn = n[1] > 0 ? [-n[0], -n[1]] : n
    side = 1
  }
  return {
    ...g,
    loop: false,
    path,
    arrow: ar.points,
    label: { x: f(m[0] + nn[0] * side * 14), y: f(m[1] + nn[1] * side * 14) },
  }
}

export function computeLayout(automaton) {
  const { states, transitions, initial, error } = automaton

  // profundidad (BFS) desde el estado inicial, sin pasar por error
  const out = {}
  transitions.forEach((t) => {
    ;(out[t.from] ||= []).push(...t.to)
  })
  const depth = { [initial]: 0 }
  const queue = [initial]
  while (queue.length) {
    const s = queue.shift()
    for (const t of out[s] || []) {
      if (t === error || t in depth) continue
      depth[t] = depth[s] + 1
      queue.push(t)
    }
  }
  const normal = states.filter((s) => s.id !== error).map((s) => s.id)
  normal.forEach((id) => {
    if (!(id in depth)) depth[id] = 0
  })

  const layers = []
  normal.forEach((id) => {
    ;(layers[depth[id]] ||= []).push(id)
  })
  const cols = layers.filter(Boolean)
  const maxDepth = cols.length - 1
  const rows = Math.max(...cols.map((l) => l.length))
  const innerH = (rows - 1) * GAP_Y
  const cy = M_TOP + innerH / 2
  const natural = M_LEFT + maxDepth * GAP_X + M_RIGHT
  const width = Math.max(natural, 620)
  const ox = (width - natural) / 2

  const nodes = {}
  layers.forEach((layer, d) => {
    if (!layer) return
    layer.sort((a, b) => num(a) - num(b))
    layer.forEach((id, i) => {
      nodes[id] = { x: M_LEFT + ox + d * GAP_X, y: cy + (i - (layer.length - 1) / 2) * GAP_Y }
    })
  })
  let height = M_TOP + innerH + R + 60
  if (error) {
    const ey = M_TOP + innerH + 165
    nodes[error] = { x: width / 2, y: ey }
    height = ey + R + 100
  }

  // agrupa las flechas por (origen → destino): una sola curva con varios símbolos
  const groups = new Map()
  for (const t of transitions) {
    for (const to of t.to) {
      const key = `${t.from}->${to}`
      if (!groups.has(key)) groups.set(key, { key, from: t.from, to, symbols: [] })
      groups.get(key).symbols.push(t.symbol)
    }
  }
  const has = (a, b) => groups.has(`${a}->${b}`)

  const edges = [...groups.values()].map((g) => {
    if (g.from === g.to) return loopEdge(g, nodes[g.from], g.from === error)
    let k = 0
    if (has(g.to, g.from)) k = 0.2
    else if (g.to === error || g.from === error) k = 0.08
    else if (depth[g.to] - depth[g.from] !== 1) k = -0.32
    return linkEdge(g, nodes[g.from], nodes[g.to], k)
  })

  const p = nodes[initial]
  const tip = [p.x - R - 3, p.y]
  const ar = arrowAt(tip, [1, 0])
  const initialArrow = { line: `M${pt([p.x - R - 58, p.y])} L${pt(ar.base)}`, arrow: ar.points }

  return { width, height, nodes, edges, initialArrow }
}
