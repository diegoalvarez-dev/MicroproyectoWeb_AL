import { useState } from 'react'
import { motion } from 'framer-motion'
import NfaDrawer from './NfaDrawer.jsx'
import NfaForm from './NfaForm.jsx'
import { Chip, Section, Segmented, secondaryBtn } from './ui.jsx'
import { SOURCE_LABEL } from '../lib/spec.js'
import { MAX_NFA_SYMBOLS, MIN_NFA_SYMBOLS, kindOf, poolFor, setAlphabet } from '../lib/nfa.js'

export const LEVELS = [
  { id: 'facil', label: 'Fácil', color: '#34d399' },
  { id: 'medio', label: 'Medio', color: '#fbbf24' },
  { id: 'dificil', label: 'Difícil', color: '#fb7185' },
]

/**
 * Pantalla de registro compartida: ejercicio aleatorio, alfabeto, aviso de validación,
 * botones y el autómata (dibujo o formulario, que son dos vistas del mismo modelo).
 *
 *   nfa, onChange        modelo de la interfaz (src/lib/nfa.js) y cómo editarlo
 *   levels               [{ id, label, hint, color }] niveles del generador
 *   status               aviso de validación (ReactNode) que se muestra bajo el alfabeto
 *   primary              { label, busyLabel, disabled, busy, onClick } botón principal
 */
export default function RegistrationShell({
  ariaLabel,
  title,
  nfa,
  onChange,
  source,
  levels,
  genKind,
  setGenKind,
  onGenerate,
  lastLevel,
  generating,
  flash,
  onClear,
  status,
  primary,
}) {
  const [mode, setMode] = useState('draw')

  const alphaKind = kindOf(nfa.alphabet)
  const pool = poolFor(alphaKind)
  const switchAlphabet = (k) => {
    if (k === alphaKind) return
    onChange({ ...nfa, alphabet: poolFor(k).slice(0, 2), delta: {} })
  }
  const toggleSymbol = (s) => {
    const has = nfa.alphabet.includes(s)
    let next = has ? nfa.alphabet.filter((x) => x !== s) : [...nfa.alphabet, s]
    if ((has && next.length < MIN_NFA_SYMBOLS) || (!has && next.length > MAX_NFA_SYMBOLS)) return
    next = pool.filter((x) => next.includes(x))
    onChange(setAlphabet(nfa, next))
  }
  const lvlLabel = levels.find((l) => l.id === lastLevel)?.label ?? levels[0].label

  return (
    <section className="glass p-5" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            source === 'manual' ? 'bg-white/10 text-white/60' : 'bg-violet-400/20 text-violet-200'
          }`}
        >
          {source === 'manual' ? 'Registro manual' : `Ejercicio ${SOURCE_LABEL[source]?.toLowerCase() ?? source}`}
        </span>
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(270px,330px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Section title="Ejercicio aleatorio">
            <div className="space-y-2">
              <div className="grid gap-1.5">
                {levels.map((l) => (
                  <motion.button
                    key={l.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={generating}
                    onClick={() => onGenerate(l.id, genKind)}
                    className="flex items-baseline justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
                    style={{ boxShadow: `inset 0 -3px 0 ${l.color}` }}
                  >
                    <span className="font-semibold">{l.label}</span>
                    <span className="text-[11px] leading-tight text-white/50">{l.hint}</span>
                  </motion.button>
                ))}
              </div>
              <Segmented
                value={genKind}
                onChange={setGenKind}
                label="Tipo de alfabeto del ejercicio"
                options={[
                  { value: 'random', label: 'Mixto' },
                  { value: 'digits', label: '0-9' },
                  { value: 'letters', label: 'a-z' },
                ]}
              />
            </div>
          </Section>

          <hr className="border-white/10" />

          <motion.div
            key={`left-${flash}`}
            initial={flash ? { opacity: 0.3, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-5"
          >
            <Section n="1" title="Alfabeto" hint={`${nfa.alphabet.length} de ${MAX_NFA_SYMBOLS} símbolos`}>
              <div className="space-y-3">
                <Segmented
                  value={alphaKind}
                  onChange={switchAlphabet}
                  label="Tipo de símbolos"
                  options={[
                    { value: 'digits', label: 'Números' },
                    { value: 'letters', label: 'Letras' },
                  ]}
                />
                <div className="flex flex-wrap gap-1.5">
                  {pool.map((s) => (
                    <Chip key={s} active={nfa.alphabet.includes(s)} onClick={() => toggleSymbol(s)} label={`Símbolo ${s}`}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
              <p className="text-xs text-white/45">
                No se pueden mezclar números y letras. Cambiar entre números y letras borra las flechas.
              </p>
            </Section>

            <div aria-live="polite" className="space-y-2" data-testid="validation">
              {status}
            </div>
          </motion.div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-base"
            >
              {primary.busy ? primary.busyLabel : primary.label}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClear} className={secondaryBtn}>
                Limpiar campos
              </button>
              <button
                type="button"
                onClick={() => onGenerate(lastLevel, genKind)}
                disabled={generating}
                title={`Genera otro ejercicio de nivel ${lvlLabel}`}
                className={secondaryBtn}
              >
                Generar nuevo · {lvlLabel}
              </button>
            </div>
          </div>
        </div>

        <motion.div
          key={`right-${flash}`}
          initial={flash ? { opacity: 0.3, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="min-w-0"
        >
          <Section n="2" title="Autómata" hint="dibujo o formulario: son dos vistas del mismo autómata">
            <Segmented
              value={mode}
              onChange={setMode}
              label="Forma de registro"
              options={[
                { value: 'draw', label: 'Dibujar' },
                { value: 'form', label: 'Formulario' },
              ]}
            />
            {mode === 'draw' ? <NfaDrawer nfa={nfa} onChange={onChange} /> : <NfaForm nfa={nfa} onChange={onChange} />}
          </Section>
        </motion.div>
      </div>
    </section>
  )
}