// Llamadas al backend del módulo 1 (rutas /api/designer/*).
import { toApi } from '../../compartido/lib/spec.js'
import { nfaToApi } from '../../compartido/lib/nfa.js'

async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  return res.json()
}

// `spec` es el modelo de la interfaz; aquí se convierte al formato del backend.
export const api = {
  validate: (spec) => post('/designer/validate', { spec: toApi(spec) }),
  build: (spec, kind) => post('/designer/build', { spec: toApi(spec), kind }),
  checkWord: (spec, kind, word) => post('/designer/check-word', { spec: toApi(spec), kind, word }),
  generate: (level, alphabetKind) =>
    post('/designer/generate', { level, alphabet_kind: alphabetKind }),
  // Práctica: el estudiante dibuja su autómata y el backend lo compara con las indicaciones.
  practiceCheck: (spec, kind, nfa) =>
    post('/designer/practice/check', { spec: toApi(spec), kind, nfa: nfaToApi(nfa) }),
  practiceWord: (spec, kind, nfa, word) =>
    post('/designer/practice/word', { spec: toApi(spec), kind, nfa: nfaToApi(nfa), word }),
}