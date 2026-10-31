import { AnimatePresence, motion } from 'framer-motion'

const STATUS = {
  diagonal: { label: 'diagonal (mismo estado)', cls: 'bg-white/10 text-white/70' },
  marked: { label: 'marcado ✕', cls: 'bg-emerald-300/20 text-emerald-200' },
  fusion: { label: 'fusión F', cls: 'bg-amber-300/20 text-amber-200' },
  pending: { label: 'pendiente P', cls: 'bg-sky-300/20 text-sky-200' },
  empty: { label: 'sin marcar', cls: 'bg-white/5 text-white/55' },
}
const RESULT = {
  M: 'border-emerald-300/50 bg-emerald-300/15 text-emerald-200',
  F: 'border-amber-300/50 bg-amber-300/15 text-amber-200',
  P: 'border-sky-300/50 bg-sky-300/15 text-sky-200',
}

function statusOf(l) {
  if (l.status === 'empty' && l.same_pair) return { label: 'es el mismo par', cls: STATUS.empty.cls }
  return STATUS[l.status] || STATUS.empty
}

export function NotationChip({ item, enabled = false, active = false, onPick }) {
  return (
    <button
      type="button"
      data-notation={item.notation}
      disabled={!enabled}
      onClick={() => onPick?.(item)}
      className={`sym inline-block rounded-lg border px-2 py-0.5 text-xs transition ${RESULT[item.result]} ${
        enabled ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
      } ${active ? 'ring-2 ring-white/80' : ''}`}
      title={
        enabled
          ? 'Ver el análisis de este par'
          : item.review
            ? 'Resultado al revisar los pendientes (pausa la reproducción para consultarlo)'
            : 'Pausa la reproducción para ver el análisis de este par'
      }
    >
      {item.notation}
      {item.review && <span className="ml-1 text-white/45">↻</span>}
    </button>
  )
}

/** Detalle del par que se analiza (una línea por símbolo) y registro de notaciones. */
export default function AnalysisPanel({ progress, view = null, canPick = false, activeAt = null, onPickNote, onClearView }) {
  const { log, pending } = progress
  // `view`: análisis de un par elegido por el usuario (notación o casilla); si no, el del paso actual
  const { pair, lines, decision, phase, note } = view || progress
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-testid="analysis">
      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-sm font-semibold">
          {pair ? (
            <>
              Par en análisis: <span className="sym text-cyan-200">({pair.join(', ')})</span>
              {phase === 'review' && <span className="ml-2 text-xs font-normal text-white/45">(revisión de pendientes)</span>}
              {view && (
                <button
                  type="button"
                  onClick={onClearView}
                  data-testid="clear-view"
                  className="ml-3 rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-normal text-white/70 hover:bg-white/10"
                >
                  Volver al paso actual
                </button>
              )}
            </>
          ) : (
            'Par en análisis'
          )}
        </h3>
        {pair ? (
          <>
            {note && <p className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/80">{note}</p>}
            <ul className="space-y-1.5">
              {lines.map((l) => {
                const st = statusOf(l)
                return (
                  <li
                    key={l.symbol}
                    data-line={l.symbol}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-sm"
                  >
                    <span className="sym text-cyan-200">{l.symbol}</span>
                    <span className="sym">
                      {l.moves.map((m) => `${m.from}→${m.to}`).join('  ·  ')}
                    </span>
                    <span className="text-white/40">⇒</span>
                    <span className="sym">({l.succ.join(', ')})</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </li>
                )
              })}
            </ul>
            <AnimatePresence mode="wait">
              {decision && (
                <motion.div
                  key={decision.notation + decision.kind}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  data-testid="decision"
                  className={`sym inline-block rounded-xl border px-3 py-1.5 text-base ${RESULT[decision.result]}`}
                >
                  {decision.notation}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="text-sm text-white/45">
            Pulsa reproducir: aquí verás, par por par, a dónde lleva cada símbolo. Con la reproducción en pausa o terminada
            puedes pulsar una notación o una casilla de la tabla de pares para ver su análisis.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-sm font-semibold">
          Notaciones <span className="font-normal text-white/40">({log.length})</span>
        </h3>
        {log.length ? (
          <ul className="scroll-thin flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-testid="notations">
            {log.map((it, i) => (
              <li key={i}>
                <NotationChip item={it} enabled={canPick} active={activeAt === it.at} onPick={onPickNote} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/45">M = marcar · F = fusión · P = pendiente</p>
        )}
        {pending.length > 0 && (
          <p className="text-xs text-sky-200/80">Pendientes: {pending.map((k) => `(${k})`).join(' ')}</p>
        )}
      </div>
    </div>
  )
}