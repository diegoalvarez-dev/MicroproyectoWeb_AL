import { toApi } from './spec.js'

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
}