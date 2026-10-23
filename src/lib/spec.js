export const DIGITS = '0123456789'.split('')
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const MIN_SYMBOLS = 2
export const MAX_SYMBOLS = 5
export const MAX_LEN = 12 // longitud máxima de la palabra (el backend valida lo mismo)
export const MAX_RUN = 8 // longitud máxima de una subcadena

export const poolFor = (kind) => (kind === 'letters' ? LETTERS : DIGITS)
export const kindOf = (alphabet) => (alphabet.length && /[a-z]/.test(alphabet[0]) ? 'letters' : 'digits')

// ---- modelo de la interfaz ------------------------------------------------
// length: { mode: 'none' | 'exact' | 'min' | 'max' | 'range', min, max }  ('' = vacío)
// regla : { symbol, mode: 'allow' | 'forbid', before, after, min_run, max_run }
export const noLength = () => ({ mode: 'none', min: '', max: '' })
export const newRule = (symbol) => ({ symbol, mode: 'allow', before: '', after: '', min_run: '', max_run: '' })

// Ejemplo del enunciado: Σ = {0,1}, inicia en 0, finaliza en 0, subcadenas de 1.
export const defaultSpec = () => ({
  alphabet: ['0', '1'],
  start: '0',
  end: '0',
  rules: [newRule('1')],
  length: noLength(),
})

// Formulario vacío (botón «Limpiar campos»).
export const blankSpec = () => ({ alphabet: ['0', '1'], start: '0', end: '0', rules: [], length: noLength() })

const orEmpty = (v) => (v === null || v === undefined ? '' : v)

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

// Acepta tanto lo que devuelve la API (null, {min,max}) como lo guardado en el historial.
export const toUi = (spec) => ({
  alphabet: [...spec.alphabet],
  start: spec.start,
  end: spec.end,
  rules: (spec.rules || []).map((r) => ({
    symbol: r.symbol,
    mode: r.mode,
    before: r.before || '',
    after: r.after || '',
    min_run: orEmpty(r.min_run),
    max_run: orEmpty(r.max_run),
  })),
  length: uiLength(spec.length),
})

const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.trunc(Number(v)))

function apiLength(L) {
  if (!L || L.mode === 'none') return null
  if (L.mode === 'exact') return { min: num(L.min), max: num(L.min) }
  if (L.mode === 'min') return { min: num(L.min), max: null }
  if (L.mode === 'max') return { min: null, max: num(L.max) }
  return { min: num(L.min), max: num(L.max) }
}

// Lo que se envía al backend.
export const toApi = (spec) => ({
  alphabet: spec.alphabet,
  start: spec.start,
  end: spec.end,
  rules: spec.rules.map((r) => ({
    symbol: r.symbol,
    mode: r.mode,
    before: r.before || null,
    after: r.after || null,
    min_run: num(r.min_run),
    max_run: num(r.max_run),
  })),
  length: apiLength(spec.length),
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
      })),
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