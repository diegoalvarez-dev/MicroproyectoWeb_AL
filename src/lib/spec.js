export const DIGITS = '0123456789'.split('')
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const MIN_SYMBOLS = 2
export const MAX_SYMBOLS = 5

export const poolFor = (kind) => (kind === 'letters' ? LETTERS : DIGITS)
export const kindOf = (alphabet) => (alphabet.length && /[a-z]/.test(alphabet[0]) ? 'letters' : 'digits')

// Ejemplo del enunciado: Σ = {0,1}, inicia en 0, finaliza en 0, subcadenas de 1.
export const defaultSpec = () => ({
  alphabet: ['0', '1'],
  start: '0',
  end: '0',
  rules: [{ symbol: '1', mode: 'allow', before: '', after: '' }],
})

// La API devuelve null en before/after; la interfaz usa '' para el «— cualquiera —».
export const fromApi = (spec) => ({
  alphabet: [...spec.alphabet],
  start: spec.start,
  end: spec.end,
  rules: spec.rules.map((r) => ({
    symbol: r.symbol,
    mode: r.mode,
    before: r.before || '',
    after: r.after || '',
  })),
})

// Tras cambiar el alfabeto, descarta lo que ya no pertenece a él.
export function sanitizeSpec(spec) {
  const a = spec.alphabet
  return {
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

export const specKey = (spec, kind) => JSON.stringify([spec, kind])

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
