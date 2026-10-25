import { motion } from 'framer-motion'

// Colores de las celdas y filas (los mismos que usa el diagrama).
const ROW_TONE = {
  new: 'bg-amber-300/25 text-amber-100',
  cur: 'bg-cyan-300/15 text-cyan-50',
  ref: 'bg-violet-400/15 text-violet-100',
}
const CELL_TONE = {
  new: 'bg-amber-300/30 text-amber-100 ring-1 ring-inset ring-amber-300/70',
  ok: 'bg-emerald-300/25 text-emerald-100 ring-1 ring-inset ring-emerald-300/60',
  ref: 'bg-violet-400/25 text-violet-100 ring-1 ring-inset ring-violet-300/50',
  nd: 'bg-fuchsia-400/15 text-fuchsia-100 ring-1 ring-inset ring-fuchsia-300/40',
}

function show(value) {
  if (value === undefined) return null // todavía no se calcula
  if (Array.isArray(value)) return value.length ? value.join(', ') : '∅'
  return value
}

// Nombre de un estado: si es final va encerrado en un círculo (como en el diagrama).
export function StateBadge({ name, final, className = '' }) {
  return (
    <span
      data-final={final ? 'true' : undefined}
      title={final ? 'Estado terminal (final)' : undefined}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 ${
        final ? 'border-2 border-current' : ''
      } ${className}`}
    >
      {name}
      {final && <span className="sr-only"> (final)</span>}
    </span>
  )
}

/**
 * Tabla de transición. `rows[i] = { state, initial, final, error, cells: { símbolo: 'BC' | ['B','C'] } }`.
 *  En la misma celda de Q: una flecha → apunta al estado inicial y los estados
 *  terminales (finales) van encerrados en un círculo, como en clase.
 *  rowTone(estado) y cellTone(estado, símbolo) devuelven el color de la fila/celda.
 */
export default function TransitionTable({ title, alphabet, rows, rowTone, cellTone, caption, animate = false, testId }) {
  return (
    <div className="space-y-2" data-testid={testId}>
      {title && <h3 className="font-semibold">{title}</h3>}
      <div className="scroll-thin overflow-x-auto rounded-xl border border-white/10 bg-black/20">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="text-xs text-white/50">
              <th className="sym px-3 py-2 text-white/80" scope="col">
                Q
              </th>
              {alphabet.map((a) => (
                <th key={a} className="sym border-l border-white/10 px-3 py-2 text-base text-cyan-200" scope="col">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const Row = animate ? motion.tr : 'tr'
              const extra = animate ? { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 } } : {}
              const tone = rowTone?.(row.state)
              return (
                <Row
                  key={row.state}
                  data-row={row.state}
                  className="border-t border-white/10 transition-colors duration-300"
                  {...extra}
                >
                  <td
                    className={`sym px-3 py-1.5 text-base transition-colors duration-300 ${
                      tone ? ROW_TONE[tone] : row.error ? 'text-rose-300/80' : ''
                    }`}
                    data-tone={tone || undefined}
                    data-initial={row.initial ? 'true' : undefined}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <span className="w-6 text-right text-lg leading-none text-white/75" title={row.initial ? 'Estado inicial' : undefined}>
                        {row.initial ? '→' : ''}
                        {row.initial && <span className="sr-only"> (inicial)</span>}
                      </span>
                      <StateBadge name={row.state} final={row.final} />
                      <span className="w-6" aria-hidden="true" />
                    </span>
                  </td>
                  {alphabet.map((a) => {
                    const value = show(row.cells[a])
                    const ct = cellTone?.(row.state, a)
                    return (
                      <td
                        key={a}
                        data-cell={`${row.state}|${a}`}
                        data-tone={ct || undefined}
                        className={`sym border-l border-white/10 px-3 py-2 text-base transition-colors duration-300 ${
                          ct ? CELL_TONE[ct] : ''
                        }`}
                      >
                        {value ?? <span className="text-white/20">·</span>}
                      </td>
                    )
                  })}
                </Row>
              )
            })}
          </tbody>
        </table>
      </div>
      {caption && <p className="text-xs leading-relaxed text-white/45">{caption}</p>}
    </div>
  )
}