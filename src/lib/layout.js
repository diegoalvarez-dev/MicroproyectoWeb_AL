// Geometría del diagrama: posiciones de los estados, curvas de las flechas y
// etiquetas. Es JavaScript puro (sin React) para poder probarlo fuera del navegador.
//
//  * Los estados se ordenan en columnas por distancia al estado inicial.
//  * Las flechas entre columnas vecinas son rectas; las que saltan columnas o
//    regresan se dibujan como arcos (por arriba o por abajo) para no tapar estados.
//  * Cada etiqueta busca, entre varias posiciones candidatas, la que menos se
//    solape con otras etiquetas, con estados y con otras flechas.
//  * Se calcula el rectángulo exacto (`bounds`) que ocupa todo el dibujo.

export const R = 30 // radio de un estado
const GAP_X = 205
const GAP_Y = 155
const ERR_GAP = 200
const ARROW_L = 11
const ARROW_W = 5.5
const LABEL_H = 24
const SAMPLES = 26

const num = (id) => (id === 'error' ? 1e9 : parseInt(id.slice(1), 10))
const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1
  return [x / d, y / d]
}
const f = (n) => Math.round(n * 10) / 10
const pt = (p) => `${f(p[0])},${f(p[1])}`

const quad = (p0, c, p2, t) => {
  const u = 1 - t
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]
}
const cubic = (p0, c1, c2, p3, t) => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]]
}

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
  return {
    ...g,
    loop: true,
    path: `M${pt(p0)} C${pt(c1)} ${pt(c2)} ${pt(ar.base)}`,
    arrow: ar.points,
    tip,
    at: (t) => cubic(p0, c1, c2, ar.base, t),
  }
}

// k > 0 curva hacia la normal izquierda del sentido de la flecha; k = 0 es recta.
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
  return {
    ...g,
    loop: false,
    path: `M${pt(start)} Q${pt(c)} ${pt(ar.base)}`,
    arrow: ar.points,
    tip,
    at: (t) => quad(start, c, ar.base, t),
  }
}

// Curvatura para que el arco se abra `bow` píxeles hacia arriba (dirY = -1) o
// hacia abajo (dirY = 1). Si la flecha es casi vertical, se abre hacia la derecha.
function bowK(a, b, bow, dirY) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const ny = dx / d
  const nx = -dy / d
  const s = Math.abs(ny) > 0.3 ? Math.sign(dirY * ny) : Math.sign(nx) || 1
  return (s * 2 * bow) / d
}

const T_CANDS = [0.5, 0.4, 0.6, 0.32, 0.68, 0.24, 0.76]
const OFFS = [0, 17, -17, 34, -34]

function labelWidth(text) {
  return Math.max(28, text.length * 9.5 + 16)
}

function placeLabels(edges, nodes, samples) {
  const nodeList = Object.values(nodes)
  const placed = []
  // primero las etiquetas más anchas: son las más difíciles de acomodar
  const order = edges.map((_, i) => i).sort((a, b) => edges[b].text.length - edges[a].text.length || a - b)
  for (const i of order) {
    const e = edges[i]
    const w = labelWidth(e.text)
    const h = LABEL_H
    let best = null
    for (const t of T_CANDS) {
      const [px, py] = e.at(t)
      const [ax, ay] = e.at(Math.min(1, t + 0.02))
      const [bx, by] = e.at(Math.max(0, t - 0.02))
      const tl = Math.hypot(ax - bx, ay - by) || 1
      const nx = -(ay - by) / tl
      const ny = (ax - bx) / tl
      for (const off of OFFS) {
        const cx = px + nx * off
        const cy = py + ny * off
        let score = Math.abs(t - 0.5) * 60 + Math.abs(off) * 0.6
        for (const q of placed) {
          const ox = (w + q.w) / 2 - Math.abs(cx - q.x)
          const oy = (h + q.h) / 2 - Math.abs(cy - q.y)
          if (ox > 0 && oy > 0) score += 1000 + ox * oy
        }
        for (const n of nodeList) {
          const dx = Math.max(Math.abs(cx - n.x) - w / 2, 0)
          const dy = Math.max(Math.abs(cy - n.y) - h / 2, 0)
          const dist = Math.hypot(dx, dy)
          if (dist < R + 5) score += 900 + (R + 5 - dist) * 10
        }
        for (let j = 0; j < edges.length; j++) {
          if (j === i) continue
          for (const [sx, sy] of samples[j]) {
            if (Math.abs(sx - cx) < w / 2 + 3 && Math.abs(sy - cy) < h / 2 + 3) score += 55
          }
        }
        if (!best || score < best.score) best = { score, x: cx, y: cy }
      }
    }
    e.label = { x: f(best.x), y: f(best.y), w, h }
    placed.push({ x: best.x, y: best.y, w, h })
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

  // predecesores (para ordenar cada columna según de dónde vienen)
  const preds = {}
  transitions.forEach((t) =>
    t.to.forEach((to) => {
      if (t.from !== error && to !== error && t.from !== to) (preds[to] ||= new Set()).add(t.from)
    }),
  )

  const layers = []
  normal.forEach((id) => {
    ;(layers[depth[id]] ||= []).push(id)
  })
  const nodes = {}
  layers.forEach((layer, d) => {
    if (!layer) return
    if (d === 0) {
      layer.sort((a, b) => num(a) - num(b))
    } else {
      const bary = (id) => {
        const ys = [...(preds[id] || [])].filter((p) => nodes[p] && depth[p] < d).map((p) => nodes[p].y)
        return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : 0
      }
      layer.sort((a, b) => bary(a) - bary(b) || num(a) - num(b))
    }
    layer.forEach((id, i) => {
      nodes[id] = { x: d * GAP_X, y: (i - (layer.length - 1) / 2) * GAP_Y }
    })
  })
  if (error) {
    const xs = normal.map((id) => nodes[id].x)
    const ys = normal.map((id) => nodes[id].y)
    nodes[error] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...ys) + ERR_GAP }
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

  const edges = [...groups.values()].map((raw) => {
    const g = { ...raw, text: raw.symbols.join(',') }
    const a = nodes[g.from]
    const b = nodes[g.to]
    if (g.from === g.to) return loopEdge(g, a, g.from === error)
    if (g.to === error || g.from === error) return linkEdge(g, a, b, 0)
    const diff = depth[g.to] - depth[g.from]
    const reverse = has(g.to, g.from)
    if (diff === 1) return linkEdge(g, a, b, reverse ? 0.2 : 0)
    if (diff === 0) {
      const adjacent = Math.abs(a.y - b.y) <= GAP_Y * 1.01
      return linkEdge(g, a, b, adjacent ? (reverse ? 0.2 : 0) : bowK(a, b, 55, 0))
    }
    if (diff >= 2) return linkEdge(g, a, b, bowK(a, b, 110 + 30 * (diff - 2), -1)) // salto hacia adelante: por arriba
    if (diff === -1 && reverse) return linkEdge(g, a, b, 0.2)
    return linkEdge(g, a, b, bowK(a, b, 66 + 30 * (-diff - 1), 1)) // regreso: por abajo
  })

  const samples = edges.map((e) => Array.from({ length: SAMPLES }, (_, i) => e.at((i + 0.5) / SAMPLES)))
  placeLabels(edges, nodes, samples)

  const p = nodes[initial]
  const tip = [p.x - R - 3, p.y]
  const ar = arrowAt(tip, [1, 0])
  const initialArrow = { line: `M${pt([p.x - R - 58, p.y])} L${pt(ar.base)}`, arrow: ar.points }

  // rectángulo exacto que ocupa el dibujo
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const grow = (x, y) => {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  Object.values(nodes).forEach((n) => {
    grow(n.x - R - 3, n.y - R - 3)
    grow(n.x + R + 3, n.y + R + 3)
  })
  samples.forEach((list, i) => {
    list.forEach(([x, y]) => grow(x, y))
    grow(edges[i].tip[0], edges[i].tip[1])
  })
  edges.forEach((e) => {
    grow(e.label.x - e.label.w / 2, e.label.y - e.label.h / 2)
    grow(e.label.x + e.label.w / 2, e.label.y + e.label.h / 2)
  })
  grow(p.x - R - 60, p.y)
  const PAD = 28
  const bounds = { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 }

  return { bounds, nodes, edges, initialArrow }
}