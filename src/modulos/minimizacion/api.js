// Llamadas al backend del módulo 3 (rutas /api/minimizer/*).
import { nfaToApi } from '../../compartido/lib/nfa.js'

async function post(path, body) {
  const res = await fetch(`/api/minimizer${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  return res.json()
}

// `nfa` es el modelo de la interfaz (el mismo del módulo 2); aquí se pasa al formato del backend.
export const minApi = {
  validate: (nfa) => post('/validate', { nfa: nfaToApi(nfa) }),
  run: (nfa) => post('/run', { nfa: nfaToApi(nfa) }),
  checkWord: (nfa, word) => post('/check-word', { nfa: nfaToApi(nfa), word }),
  generate: (level, alphabetKind) => post('/generate', { level, alphabet_kind: alphabetKind }),
}