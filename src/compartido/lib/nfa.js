// Modelo del AFND en la interfaz (módulo 2) y utilidades para editarlo.
//
//   nfa = {
//     alphabet: ['0', '1'],
//     states:   ['A', 'B', 'C'],          // una letra mayúscula (A–Z) por estado, la elige el usuario
//     initial:  'A',
//     finals:   ['C'],
//     delta:    { A: { '0': ['B', 'C'], '1': ['C'] } },   // celda vacía = sin flecha (va a error)
//     pos:      { A: { x, y }, … },       // posición de cada estado en el dibujo
//   }
//
// El dibujo y el formulario son dos vistas del mismo modelo: lo que se hace en una
// aparece en la otra.
import { computeLayout } from './layout.js'
import { DIGITS, LETTERS, kindOf, poolFor } from './spec.js'

export const STATE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const MIN_NFA_STATES = 2
export const MAX_NFA_STATES = 12
export const MIN_NFA_SYMBOLS = 2
export const MAX_NFA_SYMBOLS = 4
export const CANVAS = { w: 900, h: 520 } // área del editor de dibujo

export { DIGITS, LETTERS, kindOf, poolFor }

export const cellOf = (nfa, s, a) => nfa.delta?.[s]?.[a] ?? []

const byLetter = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// Primera letra libre (empezando por `from`, y dando la vuelta al llegar a la Z).
export function nextFreeName(nfa, from = 'A') {
  const start = Math.max(0, STATE_LETTERS.indexOf(from))
  for (let i = 0; i < STATE_LETTERS.length; i++) {
    const l = STATE_LETTERS[(start + i) % STATE_LETTERS.length]
    if (!nfa.states.includes(l)) return l
  }
  return ''
}

// ¿Se puede usar `name` como nombre de un estado nuevo (o de un renombrado)?
export const nameProblem = (nfa, name, except) => {
  if (!STATE_LETTERS.includes(name)) return 'Usa una sola letra mayúscula (A–Z).'
  if (name !== except && nfa.states.includes(name)) return `La letra ${name} ya está en uso.`
  return ''
}

// ---- geometría del editor ---------------------------------------------------
const GRID_X = [90, 240, 390, 540, 690, 830]
const GRID_Y = [90, 230, 370]

function freeSpot(pos) {
  const taken = Object.values(pos)
  let best = null
  for (const y of GRID_Y) {
    for (const x of GRID_X) {
      const d = taken.length ? Math.min(...taken.map((p) => Math.hypot(p.x - x, p.y - y))) : 1e9
      if (d >= 130) return { x, y }
      if (!best || d > best.d) best = { x, y, d }
    }
  }
  return { x: best.x, y: best.y }
}

// Autómata (sin estado error) para calcular las flechas del dibujo.
export function nfaForDrawing(nfa) {
  return {
    states: nfa.states.map((id) => ({ id })),
    transitions: nfa.states.flatMap((s) =>
      nfa.alphabet.flatMap((a) => {
        const t = cellOf(nfa, s, a)
        return t.length ? [{ from: s, symbol: a, to: t }] : []
      }),
    ),
    initial: nfa.initial,
    error: null,
  }
}

// Acomoda los estados por columnas (distancia al inicial) dentro del área del editor.
export function autoPositions(nfa) {
  if (!nfa.states.length) return {}
  const start = nfa.states.includes(nfa.initial) ? nfa.initial : nfa.states[0]
  const L = computeLayout({ ...nfaForDrawing(nfa), initial: start })
  const pts = Object.entries(L.nodes)
  const xs = pts.map(([, p]) => p.x)
  const ys = pts.map(([, p]) => p.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  const k = Math.min(1, w ? (CANVAS.w - 260) / w : 1, h ? (CANVAS.h - 200) / h : 1)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const out = {}
  pts.forEach(([id, p]) => {
    out[id] = { x: Math.round(CANVAS.w / 2 + (p.x - cx) * k), y: Math.round(CANVAS.h / 2 + (p.y - cy) * k) }
  })

  // Con muchos estados (o muchas columnas) las columnas quedarían encimadas: se reparten en elipse.
  let closest = Infinity
  const list = Object.values(out)
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) closest = Math.min(closest, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y))
  if (closest >= 105) return out
  const order = [...pts].sort((a, b) => a[1].x - b[1].x || a[1].y - b[1].y).map(([id]) => id)
  const rx = (CANVAS.w - 200) / 2
  const ry = (CANVAS.h - 170) / 2
  order.forEach((id, i) => {
    const t = Math.PI + (2 * Math.PI * i) / order.length // el primero (el inicial) queda a la izquierda
    out[id] = { x: Math.round(CANVAS.w / 2 + rx * Math.cos(t)), y: Math.round(CANVAS.h / 2 + ry * Math.sin(t)) }
  })
  return out
}

// Garantiza que cada estado tenga posición.
export function ensurePos(nfa) {
  const pos = { ...(nfa.pos || {}) }
  const missing = nfa.states.filter((s) => !pos[s])
  if (!missing.length) return { ...nfa, pos }
  if (missing.length === nfa.states.length) return { ...nfa, pos: autoPositions(nfa) }
  missing.forEach((s) => {
    pos[s] = freeSpot(pos)
  })
  return { ...nfa, pos }
}

export const rearrange = (nfa) => ({ ...nfa, pos: autoPositions(nfa) })

// ---- ejemplos -----------------------------------------------------------------
// El ejemplo del enunciado del equipo: Σ = {0,1}, estados A,B,C,D, final D.
export const exampleNfa = () =>
  ensurePos({
    alphabet: ['0', '1'],
    states: ['A', 'B', 'C', 'D'],
    initial: 'A',
    finals: ['D'],
    delta: {
      A: { 0: ['B', 'C'], 1: ['C'] },
      B: { 0: ['C'], 1: ['B'] },
      C: { 0: ['D'], 1: ['A'] },
      D: { 0: ['A', 'D'], 1: ['B'] },
    },
  })

// Formulario vacío («Limpiar campos»).
export const blankNfa = () =>
  ensurePos({ alphabet: ['0', '1'], states: ['A', 'B'], initial: 'A', finals: [], delta: {} })

// ---- ediciones (todas devuelven un modelo nuevo) --------------------------------
export function toggleTarget(nfa, from, symbol, to) {
  const cur = cellOf(nfa, from, symbol)
  const next = cur.includes(to) ? cur.filter((t) => t !== to) : [...cur, to].sort(byLetter)
  return { ...nfa, delta: { ...nfa.delta, [from]: { ...(nfa.delta[from] || {}), [symbol]: next } } }
}

export function clearEdge(nfa, from, to) {
  const row = { ...(nfa.delta[from] || {}) }
  nfa.alphabet.forEach((a) => {
    if (row[a]) row[a] = row[a].filter((t) => t !== to)
  })
  return { ...nfa, delta: { ...nfa.delta, [from]: row } }
}

export const edgeSymbols = (nfa, from, to) => nfa.alphabet.filter((a) => cellOf(nfa, from, a).includes(to))

export function addState(nfa, at, name) {
  if (nfa.states.length >= MAX_NFA_STATES) return nfa
  const id = name || nextFreeName(nfa)
  if (!id || nameProblem(nfa, id)) return nfa
  const states = [...nfa.states, id].sort(byLetter)
  const pos = { ...nfa.pos, [id]: at || freeSpot(nfa.pos || {}) }
  const initial = nfa.initial || id
  return { ...nfa, states, pos, initial }
}

export function removeState(nfa, id) {
  const delta = {}
  nfa.states
    .filter((s) => s !== id)
    .forEach((s) => {
      delta[s] = Object.fromEntries(
        Object.entries(nfa.delta[s] || {}).map(([a, t]) => [a, t.filter((x) => x !== id)]),
      )
    })
  const pos = { ...nfa.pos }
  delete pos[id]
  return {
    ...nfa,
    states: nfa.states.filter((s) => s !== id),
    finals: nfa.finals.filter((s) => s !== id),
    initial: nfa.initial === id ? '' : nfa.initial,
    delta,
    pos,
  }
}

// Cambia la letra de un estado (en las flechas, el inicial, los finales y la posición).
export function renameState(nfa, from, to) {
  if (from === to || !nfa.states.includes(from) || nameProblem(nfa, to)) return nfa
  const re = (s) => (s === from ? to : s)
  const delta = {}
  nfa.states.forEach((s) => {
    delta[re(s)] = Object.fromEntries(
      Object.entries(nfa.delta[s] || {}).map(([a, t]) => [a, t.map(re).sort(byLetter)]),
    )
  })
  const pos = { ...nfa.pos, [to]: nfa.pos?.[from] }
  delete pos[from]
  return {
    ...nfa,
    states: nfa.states.map(re).sort(byLetter),
    initial: re(nfa.initial),
    finals: nfa.finals.map(re).sort(byLetter),
    delta,
    pos,
  }
}

export function setStateCount(nfa, n) {
  let cur = nfa
  while (cur.states.length < n) cur = addState(cur)
  while (cur.states.length > n) cur = removeState(cur, cur.states[cur.states.length - 1])
  return cur
}

export const toggleFinal = (nfa, id) => ({
  ...nfa,
  finals: nfa.finals.includes(id) ? nfa.finals.filter((s) => s !== id) : [...nfa.finals, id].sort(byLetter),
})

// Cambia el alfabeto y descarta las flechas con símbolos que ya no existen.
export function setAlphabet(nfa, alphabet) {
  const delta = {}
  Object.entries(nfa.delta).forEach(([s, row]) => {
    delta[s] = Object.fromEntries(Object.entries(row).filter(([a]) => alphabet.includes(a)))
  })
  return { ...nfa, alphabet, delta }
}

// Agrupa las flechas por (origen → destino) con sus símbolos.
export function edgeGroups(nfa) {
  const groups = []
  nfa.states.forEach((from) =>
    nfa.states.forEach((to) => {
      const symbols = edgeSymbols(nfa, from, to)
      if (symbols.length) groups.push({ from, to, symbols })
    }),
  )
  return groups
}

// ---- conversión con el backend -------------------------------------------------------
export function nfaToApi(nfa) {
  const delta = {}
  nfa.states.forEach((s) => {
    const row = {}
    nfa.alphabet.forEach((a) => {
      const t = cellOf(nfa, s, a)
      if (t.length) row[a] = [...t].sort(byLetter)
    })
    delta[s] = row
  })
  return { alphabet: nfa.alphabet, states: nfa.states, initial: nfa.initial, finals: [...nfa.finals].sort(byLetter), delta }
}

export const nfaKey = (nfa) => JSON.stringify(nfaToApi(nfa))

export const nfaFromApi = (api) =>
  ensurePos({
    alphabet: [...api.alphabet],
    states: [...api.states],
    initial: api.initial,
    finals: [...api.finals],
    delta: JSON.parse(JSON.stringify(api.delta || {})),
  })

// Resumen para el historial: [Σ y cantidad de estados, resto…]
export function describeNfa(nfa) {
  const rows = nfa.states
    .map((s) => {
      const moves = nfa.alphabet
        .map((a) => `${a}→${cellOf(nfa, s, a).join(',') || '∅'}`)
        .join(' ')
      return `${s}: ${moves}`
    })
    .join(' · ')
  return [
    `Σ = {${nfa.alphabet.join(', ')}} · ${nfa.states.length} estados`,
    `Inicial ${nfa.initial || '—'} · Finales ${nfa.finals.join(', ') || '—'} · ${rows}`,
  ]
}