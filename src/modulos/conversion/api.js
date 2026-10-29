// Llamadas al backend del módulo 2 (rutas /api/converter/*).
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

// `nfa` es el modelo de la interfaz; aquí se convierte al formato del backend.
export const api = {
  nfaValidate: (nfa) => post('/converter/validate', { nfa: nfaToApi(nfa) }),
  nfaConvert: (nfa) => post('/converter/convert', { nfa: nfaToApi(nfa) }),
  nfaCheckWord: (nfa, word) => post('/converter/check-word', { nfa: nfaToApi(nfa), word }),
  nfaGenerate: (level, alphabetKind) =>
    post('/converter/generate', { level, alphabet_kind: alphabetKind }),
}
