import { useState } from 'react'
import {
  MAX_NFA_STATES,
  MIN_NFA_STATES,
  cellOf,
  nameProblem,
  renameState,
  setStateCount,
  toggleFinal,
  toggleTarget,
} from '../lib/nfa.js'
import { Chip } from './ui.jsx'

const COUNTS = Array.from({ length: MAX_NFA_STATES - MIN_NFA_STATES + 1 }, (_, i) => MIN_NFA_STATES + i)

/**
 * Registro por formulario: se elige cuántos estados hay y, para cada estado y cada
 * símbolo del alfabeto, a qué estados va (puede ser más de uno: es un AFND).
 */
export default function NfaForm({ nfa, onChange }) {
  const [nameErr, setNameErr] = useState('')

  // La letra de un estado se escribe directamente en su casilla de la columna Q.
  const rename = (id, raw) => {
    const ch = raw.slice(-1).toUpperCase()
    if (!ch) return
    const problem = nameProblem(nfa, ch, id)
    setNameErr(problem)
    if (!problem) onChange(renameState(nfa, id, ch))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-white/60">Número de estados</span>
        <div className="inline-flex flex-wrap rounded-xl bg-black/25 p-1" role="group" aria-label="Número de estados">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(setStateCount(nfa, n))}
              aria-pressed={nfa.states.length === n}
              aria-label={`${n} estados`}
              className={`sym h-8 w-8 rounded-lg text-sm transition ${
                nfa.states.length === n ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto rounded-xl border border-white/10 bg-black/20">
        <table className="w-full min-w-[460px] border-collapse text-center" aria-label="Tabla de transiciones del AFND">
          <thead>
            <tr className="text-xs text-white/55">
              <th className="px-3 py-2 font-medium" scope="col">
                Inicial
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Final
              </th>
              <th className="sym border-l border-white/10 px-3 py-2 text-white/80" scope="col">
                Q
              </th>
              {nfa.alphabet.map((a) => (
                <th key={a} className="border-l border-white/10 px-3 py-2 text-left font-medium" scope="col">
                  Con <span className="sym text-base text-cyan-200">{a}</span> va a…
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nfa.states.map((s) => (
              <tr key={s} className="border-t border-white/10" data-state-row={s}>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name="nfa-initial"
                    checked={nfa.initial === s}
                    onChange={() => onChange({ ...nfa, initial: s })}
                    aria-label={`Estado inicial ${s}`}
                    className="h-4 w-4 accent-cyan-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={nfa.finals.includes(s)}
                    onChange={() => onChange(toggleFinal(nfa, s))}
                    aria-label={`Estado final ${s}`}
                    className="h-4 w-4 accent-emerald-300"
                  />
                </td>
                <td className="border-l border-white/10 px-3 py-2">
                  <input
                    value={s}
                    onChange={(e) => rename(s, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setNameErr('')}
                    aria-label={`Nombre del estado ${s}`}
                    title="Escribe otra letra para cambiar el nombre del estado"
                    spellCheck={false}
                    autoComplete="off"
                    className="field sym w-12 py-1! text-center text-base"
                  />
                </td>
                {nfa.alphabet.map((a) => {
                  const targets = cellOf(nfa, s, a)
                  return (
                    <td key={a} className="border-l border-white/10 px-3 py-2 text-left">
                      <div className="flex flex-wrap items-center gap-1">
                        {nfa.states.map((t) => (
                          <Chip
                            key={t}
                            size="sm"
                            active={targets.includes(t)}
                            label={`Desde ${s} con ${a} va a ${t}`}
                            onClick={() => onChange(toggleTarget(nfa, s, a, t))}
                          >
                            {t}
                          </Chip>
                        ))}
                        {targets.length === 0 && <span className="ml-1 text-[11px] text-white/35">→ error</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nameErr && (
        <p role="alert" className="text-xs text-amber-200">
          {nameErr}
        </p>
      )}
      <p className="text-xs text-white/45">
        Puedes cambiar la letra de cada estado escribiéndola en la columna Q. Marca todos los estados a los que llega
        cada símbolo: si marcas más de uno es no determinista. Si no marcas ninguno, ese símbolo va al estado error.
      </p>
    </div>
  )
}