import { motion } from 'framer-motion'
import { StateBadge } from '../../compartido/componentes/TransitionTable.jsx'
import { pairKey } from './progress.js'

// Contenido de una casilla de la tabla de pares.
function Mark({ value }) {
  if (value === 'X')
    return (
      <motion.span
        key="X"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="sym text-2xl leading-none text-emerald-300"
        title="Distinguibles (M): se marca con X"
      >
        ✕<span className="sr-only">marcado</span>
      </motion.span>
    )
  if (value === 'F')
    return (
      <motion.span
        key="F"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-block h-6 w-6 rounded-full border-[3px] border-amber-300 bg-amber-300/30"
        title="Equivalentes (F): se fusionan"
      >
        <span className="sr-only">fusión</span>
      </motion.span>
    )
  if (value === 'P')
    return (
      <motion.span
        key="P"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="sym text-lg leading-none text-sky-300"
        title="Pendiente (P): depende de otros pares"
      >
        P
      </motion.span>
    )
  return null
}

/**
 * Tabla triangular de pares. Fila i, columna j (j ≤ i): el par (estado j, estado i).
 * La diagonal (cada estado con él mismo) ya viene pintada. Los nombres de las columnas van abajo.
 */
export default function PairsTable({ states, marks, curKey, refKeys }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-2" data-testid="pairs-table">
      <table className="mx-auto border-separate border-spacing-1 text-center" aria-label="Tabla de pares distinguibles">
        <tbody>
          {states.map((row, i) => (
            <tr key={row.id}>
              <th scope="row" className="sym pr-1 text-right text-sm font-bold text-cyan-200">
                <span className="inline-flex items-center gap-0.5">
                  {row.initial && <span className="text-white/70">→</span>}
                  <StateBadge name={row.id} final={row.final} className="h-8! min-w-8! text-sm" />
                </span>
              </th>
              {states.map((col, j) => {
                if (j > i) return <td key={col.id} />
                if (j === i)
                  return (
                    <td
                      key={col.id}
                      data-cell={`${col.id},${row.id}`}
                      data-kind="diagonal"
                      className="h-10 min-w-10 rounded-lg bg-white/[0.12]"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(135deg, rgba(255,255,255,.10) 0 4px, transparent 4px 8px)',
                      }}
                      title="Diagonal: un estado con él mismo (ya está pintada)"
                    />
                  )
                const key = pairKey(col.id, row.id)
                const mark = marks[key]
                const isCur = key === curKey
                const isRef = refKeys.has(key)
                return (
                  <td
                    key={col.id}
                    data-cell={key}
                    data-mark={mark || undefined}
                    data-tone={isCur ? 'cur' : isRef ? 'ref' : undefined}
                    className={`h-10 min-w-10 rounded-lg border transition-colors duration-300 ${
                      isCur
                        ? 'border-cyan-300 bg-cyan-300/20 shadow-[0_0_14px_-2px_rgba(34,211,238,.8)]'
                        : isRef
                          ? 'border-violet-300 bg-violet-400/20'
                          : mark === 'X'
                            ? 'border-emerald-300/30 bg-emerald-300/10'
                            : mark === 'F'
                              ? 'border-amber-300/30 bg-amber-300/10'
                              : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <Mark value={mark} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className="w-12" />
            {states.map((s) => (
              <th key={s.id} scope="col" className="sym text-sm font-bold text-cyan-200">
                <span className="inline-flex items-center gap-0.5">
                  {s.initial && <span className="text-white/70">→</span>}
                  <StateBadge name={s.id} final={s.final} className="h-8! min-w-8! text-sm" />
                </span>
              </th>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function PairsLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/55" aria-label="Colores de la tabla de pares">
      <li className="flex items-center gap-1.5">
        <span className="sym text-base leading-none text-emerald-300">✕</span> M: distinguibles (se marca)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-amber-300 bg-amber-300/30" /> F: equivalentes
        (se fusionan)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="sym text-sm leading-none text-sky-300">P</span> pendiente
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-white/25" /> diagonal
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-cyan-300/70" /> par que se analiza
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-violet-400/70" /> casillas a las que llega
      </li>
    </ul>
  )
}