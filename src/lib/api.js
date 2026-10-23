async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  return res.json()
}

export const api = {
  validate: (spec) => post('/designer/validate', { spec }),
  build: (spec, kind) => post('/designer/build', { spec, kind }),
  checkWord: (spec, kind, word) => post('/designer/check-word', { spec, kind, word }),
  generate: (level, alphabetKind) =>
    post('/designer/generate', { level, alphabet_kind: alphabetKind }),
}
