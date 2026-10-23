import { AnimatePresence, motion } from 'framer-motion'
import { SOURCE_LABEL } from '../lib/spec.js'

const SOURCE_COLOR = {
  manual: 'bg-white/10 text-white/60',
  facil: 'bg-emerald-300/15 text-emerald-200',
  medio: 'bg-amber-300/15 text-amber-200',
  dificil: 'bg-rose-400/15 text-rose-200',
}

const fmt = (ts) =>
  new Date(ts).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function HistoryPanel({ items, onLoad, onDelete, onClear }) {
  return (
    <div className="glass space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          Historial <span className="text-sm font-normal text-white/40">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-white/45 transition hover:text-rose-300">
            Borrar todo
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/45">
          Cada autómata que diseñes queda guardado aquí, en este navegador, para retomarlo cuando quieras.
        </p>
      ) : (
        <ul className="scroll-thin max-h-80 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="group flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${SOURCE_COLOR[it.source]}`}>
                      {SOURCE_LABEL[it.source]}
                    </span>
                    <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 font-semibold text-cyan-200">{it.kind}</span>
                    <span className="text-white/35">{fmt(it.ts)}</span>
                  </div>
                  <p className="truncate text-sm text-white/80" title={it.text.join(' ')}>
                    {it.text.slice(1).join(' ')}
                  </p>
                  <p className="sym text-xs text-white/40">{it.text[0]}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoad(it)}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-cyan-300/20 hover:text-cyan-100"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(it.id)}
                    aria-label="Eliminar del historial"
                    className="rounded-lg px-2 text-white/35 transition hover:bg-rose-400/15 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
