export const DIGITS = '0123456789'.split('')
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const MIN_SYMBOLS = 2
export const MAX_SYMBOLS = 5
export const MAX_LEN = 12 // longitud máxima de la palabra (el backend valida lo mismo)
export const MAX_RUN = 8 // longitud máxima de una subcadena
export const MAX_COUNT = 12 // total máximo de un símbolo en la palabra

export const poolFor = (kind) => (kind === 'letters' ? LETTERS : DIGITS)
export const kindOf = (alphabet) => (alphabet.length && /[a-z]/.test(alphabet[0]) ? 'letters' : 'digits')

// ---- modelo de la interfaz ------------------------------------------------
// startEnd: ¿está la indicación ∀w «toda palabra inicia en … y finaliza en …»?
// length  : { mode: 'none' | 'exact' | 'min' | 'max' | 'range', min, max }  ('' = vacío; 'none' = sin indicación)
// rules   : una fila por cada indicación ∃w / ~∃w, con UNA sola condición:
//           { id, symbol, mode: 'allow' | 'forbid', cond: 'none' | 'before' | 'after' | 'min_run' | 'max_run',
//             before, after, min_run, max_run }
// counts  : suma total de un símbolo en la palabra: { id, symbol, mode: 'exact' | 'min' | 'max' | 'range', min, max }
let nextId = 1
const uid = () => nextId++

export const noLength = () => ({ mode: 'none', min: '', max: '' })
export const emptyRule = (symbol, mode = 'allow') => ({
  id: uid(),
  symbol,
  mode,
  cond: 'none',
  before: '',
  after: '',
  min_run: '',
  max_run: '',
})
export const newRule = (symbol, mode = 'allow') => emptyRule(symbol, mode)
export const newCount = (symbol) => ({ id: uid(), symbol, mode: 'exact', min: 2, max: 2 })

// Ejemplo del enunciado: Σ = {0,1}, inicia en 0, finaliza en 0, subcadenas de 1.
export const defaultSpec = () => ({
  alphabet: ['0', '1'],
  startEnd: true,
  start: '0',
  end: '0',
  rules: [newRule('1')],
  length: noLength(),
  counts: [],
})

// Formulario vacío (botón «Limpiar campos»): sin ninguna indicación.
export const blankSpec = () => ({
  alphabet: ['0', '1'],
  startEnd: false,
  start: '0',
  end: '0',
  rules: [],
  length: noLength(),
  counts: [],
})

const orEmpty = (v) => (v === null || v === undefined ? '' : v)
const COND_FIELDS = ['before', 'after', 'min_run', 'max_run']

function uiLength(L) {
  if (!L) return noLength()
  if (L.mode) return { mode: L.mode, min: orEmpty(L.min), max: orEmpty(L.max) }
  const min = orEmpty(L.min)
  const max = orEmpty(L.max)
  let mode = 'max'
  if (min === '' && max === '') mode = 'none'
  else if (min !== '' && max !== '') mode = min === max ? 'exact' : 'range'
  else if (min !== '') mode = 'min'
  return { mode, min, max }
}

function uiCount(c) {
  const min = orEmpty(c.min)
  const max = orEmpty(c.max)
  let mode = c.mode
  if (!mode) {
    if (min !== '' && max !== '') mode = min === max ? 'exact' : 'range'
    else mode = min !== '' ? 'min' : 'max'
  }
  return { id: uid(), symbol: c.symbol, mode, min, max }
}

// Una regla del backend puede traer varias condiciones: en la interfaz va una fila por condición.
function splitRule(r) {
  const base = { symbol: r.symbol, mode: r.mode }
  if (r.mode === 'forbid') return [emptyRule(base.symbol, 'forbid')]
  const rows = COND_FIELDS.filter((f) => r[f] !== null && r[f] !== undefined && r[f] !== '').map((f) => ({
    ...emptyRule(base.symbol, 'allow'),
    cond: f,
    [f]: r[f],
  }))
  return rows.length ? rows : [emptyRule(base.symbol, 'allow')]
}

// Acepta tanto lo que devuelve la API (null, {min,max}) como lo guardado en el historial.
export const toUi = (spec) => ({
  alphabet: [...spec.alphabet],
  startEnd: spec.startEnd !== undefined ? !!spec.startEnd : !!(spec.start || spec.end),
  start: spec.start || spec.alphabet[0],
  end: spec.end || spec.alphabet[0],
  rules: (spec.rules || []).flatMap(splitRule),
  length: uiLength(spec.length),
  counts: (spec.counts || []).map(uiCount),
})

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.trunc(Number(v)))

function apiLength(L) {
  if (!L || L.mode === 'none') return null
  if (L.mode === 'exact') return { min: num(L.min), max: num(L.min) }
  if (L.mode === 'min') return { min: num(L.min), max: null }
  if (L.mode === 'max') return { min: null, max: num(L.max) }
  return { min: num(L.min), max: num(L.max) }
}

function apiCount(c) {
  const r = apiLength(c)
  return { symbol: c.symbol, min: r.min, max: r.max }
}

// Lo que se envía al backend.
export const toApi = (spec) => ({
  alphabet: spec.alphabet,
  start: spec.startEnd ? spec.start : '',
  end: spec.startEnd ? spec.end : '',
  rules: spec.rules.map((r) => ({
    symbol: r.symbol,
    mode: r.mode,
    before: r.before || null,
    after: r.after || null,
    min_run: num(r.min_run),
    max_run: num(r.max_run),
  })),
  length: apiLength(spec.length),
  counts: (spec.counts || []).map(apiCount),
})

// Tras cambiar el alfabeto, descarta lo que ya no pertenece a él.
export function sanitizeSpec(spec) {
  const a = spec.alphabet
  return {
    ...spec,
    alphabet: a,
    start: a.includes(spec.start) ? spec.start : a[0],
    end: a.includes(spec.end) ? spec.end : a[0],
    rules: spec.rules
      .filter((r) => a.includes(r.symbol))
      .map((r) => ({
        ...r,
        before: a.includes(r.before) ? r.before : '',
        after: a.includes(r.after) ? r.after : '',
        cond: (r.cond === 'before' && !a.includes(r.before)) || (r.cond === 'after' && !a.includes(r.after)) ? 'none' : r.cond,
      })),
    counts: (spec.counts || []).filter((c) => a.includes(c.symbol)),
  }
}

export const specKey = (spec, kind) => JSON.stringify([toApi(spec), kind])

export const LEVELS = [
  { id: 'facil', label: 'Fácil', hint: '2 símbolos, 0–1 reglas', color: '#34d399' },
  { id: 'medio', label: 'Medio', hint: '3 símbolos, con precedencia', color: '#fbbf24' },
  { id: 'dificil', label: 'Difícil', hint: '3–4 símbolos, varias reglas', color: '#fb7185' },
]

export const SOURCE_LABEL = {
  manual: 'Manual',
  facil: 'Fácil',
  medio: 'Medio',
  dificil: 'Difícil',
}