import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SPEEDS = [0.5, 1, 2, 4]

const CHAR_STYLE = {
  idle: 'border-white/10 bg-white/5 text-white/45',
  cur: 'border-cyan-300 bg-cyan-300/20 text-cyan-100 shadow-[0_0_18px_-2px_rgba(34,211,238,.9)] -translate-y-1',
  ok: 'border-emerald-300/70 bg-emerald-300/15 text-emerald-100',
  bad: 'border-rose-400/80 bg-rose-400/20 text-rose-100',
}

function charTone(i, run) {
  const { result, k, finished } = run
  if (result.invalid_symbol) return i === result.fail_index ? 'bad' : 'idle'
  if (finished) {
    if (result.valid) return 'ok'
    return result.fail_index != null && i >= result.fail_index ? 'bad' : 'ok'
  }
  if (i < k) return result.path[i]?.ok ? 'ok' : 'bad'
  if (i === k) return 'cur'
  return 'idle'
}

export default function WordTester({
  enabled,
  stale,
  examples,
  run,
  onRun,
  onClear,
  busy,
  title = 'Probar una palabra',
  disabledHint = 'Primero diseña el autómata',
  placeholder = 'Escribe una palabra, p. ej. 00011110010',
  speed,
  onSpeed,
}) {
  const [word, setWord] = useState('')

  const submit = (w = word) => {
    if (enabled && !busy) onRun(w)
  }
  const pick = (w) => {
    setWord(w)
    submit(w)
  }

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {onSpeed && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span>Velocidad</span>
            <div className="flex rounded-xl bg-white/8 p-1" role="group" aria-label="Velocidad del recorrido de la palabra">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    speed === s ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        )}
        {stale && (
          <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-200">
            Cambiaste las indicaciones: vuelve a diseñar el autómata
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex gap-2"
      >
        <input
          value={word}
          onChange={(e) => setWord(e.target.value.replace(/\s/g, ''))}
          disabled={!enabled}
          placeholder={enabled ? placeholder : disabledHint}
          aria-label="Palabra a validar"
          spellCheck={false}
          autoComplete="off"
          className="field sym min-w-0 flex-1 py-2.5! text-lg tracking-widest disabled:opacity-50"
        />
        <button type="submit" disabled={!enabled || busy} className="btn-primary px-5 text-sm">
          {busy ? '…' : 'Validar'}
        </button>
        {run && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl bg-white/8 px-3 text-sm text-white/70 transition hover:bg-white/15"
          >
            Limpiar
          </button>
        )}
      </form>

      {enabled && (examples.valid.length > 0 || examples.invalid.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-white/45">Prueba rápida:</span>
          {examples.valid.map((w) => (
            <button
              key={`v${w}`}
              type="button"
              onClick={() => pick(w)}
              className="sym rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-emerald-100 transition hover:bg-emerald-300/20"
            >
              {w}
            </button>
          ))}
          {examples.invalid.map((w) => (
            <button
              key={`i${w}`}
              type="button"
              onClick={() => pick(w)}
              className="sym rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-rose-100 transition hover:bg-rose-400/20"
            >
              {w}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {run && (
          <motion.div
            key={run.result.word + run.result.kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap gap-1.5" aria-label="Recorrido de la palabra">
              {run.result.word.length === 0 && <span className="text-sm text-white/45">(palabra vacía)</span>}
              {[...run.result.word].map((ch, i) => (
                <span
                  key={i}
                  className={`sym grid h-11 min-w-11 place-items-center rounded-xl border px-2 text-lg transition-all duration-200 ${
                    CHAR_STYLE[charTone(i, run)]
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>

            <AnimatePresence>
              {run.finished && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  role="status"
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    run.result.valid
                      ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-50'
                      : 'border-rose-400/40 bg-rose-400/10 text-rose-50'
                  }`}
                >
                  <p className="text-base font-bold">
                    {run.result.valid ? '✔ Palabra válida' : '✘ Palabra inválida'}
                  </p>
                  <p className="mt-0.5 opacity-90">{run.result.reason}</p>
                  {!run.result.consistent && (
                    <p className="mt-1 text-xs text-amber-200">
                      Aviso: el autómata y la revisión directa no coinciden; revisa el diseño.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}