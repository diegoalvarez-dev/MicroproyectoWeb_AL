import { toApi } from './spec.js'
import { nfaToApi } from './nfa.js'

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

  // Módulo 2: AFND → AFD (`nfa` es el modelo de la interfaz)
  nfaValidate: (nfa) => post('/converter/validate', { nfa: nfaToApi(nfa) }),
  nfaConvert: (nfa) => post('/converter/convert', { nfa: nfaToApi(nfa) }),
  nfaCheckWord: (nfa, word) => post('/converter/check-word', { nfa: nfaToApi(nfa), word }),
  nfaGenerate: (level, alphabetKind) =>
    post('/converter/generate', { level, alphabet_kind: alphabetKind }),
}