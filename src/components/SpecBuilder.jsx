import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LEVELS,
  MAX_LEN,
  MAX_RUN,
  MAX_SYMBOLS,
  MIN_SYMBOLS,
  SOURCE_LABEL,
  blankSpec,
  kindOf,
  newRule,
  noLength,
  poolFor,
  sanitizeSpec,
} from '../lib/spec.js'

function Section({ n, title, hint, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-cyan-300">
          {n}
        </span>
        <h3 className="font-semibold">{title}</h3>
        {hint && <span className="ml-auto text-xs text-white/40">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Chip({ active, onClick, children, label, tone = 'cyan' }) {
  const on =
    tone === 'cyan'
      ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_-4px_rgba(34,211,238,.7)]'
      : 'border-violet-300/70 bg-violet-400/20 text-violet-100'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`sym h-10 min-w-10 rounded-xl border px-2 text-base transition ${
        active ? on : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="inline-flex rounded-xl bg-black/25 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SymbolSelect({ value, onChange, symbols, blank, label, disabledSymbols = [] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="field sym py-1.5!"
    >
      {blank && <option value="">{blank}</option>}
      {symbols.map((s) => (
        <option key={s} value={s} disabled={disabledSymbols.includes(s)}>
          {s}
        </option>
      ))}
    </select>
  )
}

// Campo numérico: '' = sin límite.
function NumField({ value, onChange, max, label, placeholder = '—' }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? '' : Math.trunc(Number(v)))
      }}
      className="field sym w-[4.6rem] py-1.5! text-center"
    />
  )
}

const LEN_MODES = [
  { value: 'none', label: 'Sin límite' },
  { value: 'exact', label: 'Longitud exacta' },
  { value: 'min', label: 'Longitud mínima' },
  { value: 'max', label: 'Longitud máxima' },
  { value: 'range', label: 'Entre un mínimo y un máximo' },
]

function LengthRow({ spec, onChange }) {
  const L = spec.length
  const set = (patch) => onChange({ ...spec, length: { ...L, ...patch } })
  const changeMode = (mode) => {
    const v = L.min !== '' ? L.min : L.max !== '' ? L.max : 4
    const patch = {
      none: { min: '', max: '' },
      exact: { min: v, max: v },
      min: { min: v, max: '' },
      max: { min: '', max: v },
      range: {
        min: L.min !== '' ? L.min : 3,
        max: L.max !== '' ? L.max : Math.min(MAX_LEN, (L.min !== '' ? Number(L.min) : 3) + 3),
      },
    }[mode]
    onChange({ ...spec, length: { mode, ...patch } })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
      <select
        value={L.mode}
        onChange={(e) => changeMode(e.target.value)}
        aria-label="Tipo de límite de longitud de la palabra"
        className="field py-1.5!"
      >
        {LEN_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {L.mode === 'exact' && (
        <>
          <span>la palabra debe tener exactamente</span>
          <NumField value={L.min} max={MAX_LEN} label="Longitud exacta" onChange={(v) => set({ min: v, max: v })} />
          <span>símbolos</span>
        </>
      )}
      {L.mode === 'min' && (
        <>
          <span>al menos</span>
          <NumField value={L.min} max={MAX_LEN} label="Longitud mínima" onChange={(v) => set({ min: v })} />
          <span>símbolos</span>
        </>
      )}
      {L.mode === 'max' && (
        <>
          <span>como máximo</span>
          <NumField value={L.max} max={MAX_LEN} label="Longitud máxima" onChange={(v) => set({ max: v })} />
          <span>símbolos</span>
        </>
      )}
      {L.mode === 'range' && (
        <>
          <span>entre</span>
          <NumField value={L.min} max={MAX_LEN} label="Longitud mínima" onChange={(v) => set({ min: v })} />
          <span>y</span>
          <NumField value={L.max} max={MAX_LEN} label="Longitud máxima" onChange={(v) => set({ max: v })} />
          <span>símbolos</span>
        </>
      )}
    </div>
  )
}

function RuleRow({ rule, index, spec, onPatch, onRemove }) {
  const forbid = rule.mode === 'forbid'
  const others = spec.alphabet.filter((a) => a !== rule.symbol)
  const used = spec.rules.filter((_, j) => j !== index).map((r) => r.symbol)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-2.5 rounded-2xl border border-white/10 bg-black/20 p-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={rule.mode}
          onChange={(e) =>
            onPatch(
              e.target.value === 'forbid'
                ? { mode: 'forbid', before: '', after: '', min_run: '', max_run: '' }
                : { mode: 'allow' },
            )
          }
          aria-label="Tipo de regla"
          className="field py-1.5!"
        >
          <option value="allow">Pueden existir</option>
          <option value="forbid">No pueden existir</option>
        </select>
        <span className="text-white/60">subcadenas consecutivas de</span>
        <SymbolSelect
          value={rule.symbol}
          onChange={(s) =>
            onPatch({
              symbol: s,
              before: rule.before === s ? '' : rule.before,
              after: rule.after === s ? '' : rule.after,
            })
          }
          symbols={spec.alphabet}
          disabledSymbols={used}
          label="Símbolo de la regla"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar regla"
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/40 transition hover:bg-rose-400/15 hover:text-rose-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {!forbid && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-white/60">
            <span>con una longitud</span>
            <span>mínima de</span>
            <NumField
              value={rule.min_run}
              max={MAX_RUN}
              label="Longitud mínima de la subcadena"
              placeholder="sin"
              onChange={(v) => onPatch({ min_run: v })}
            />
            <span>y máxima de</span>
            <NumField
              value={rule.max_run}
              max={MAX_RUN}
              label="Longitud máxima de la subcadena"
              placeholder="sin"
              onChange={(v) => onPatch({ max_run: v })}
            />
            <span>símbolos seguidos</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-white/60">
            <span>siempre y cuando vayan</span>
            <span>precedidas de</span>
            <SymbolSelect
              value={rule.before}
              onChange={(v) => onPatch({ before: v })}
              symbols={others}
              blank="— cualquiera —"
              label="Símbolo que debe preceder"
            />
            <span>y seguidas de</span>
            <SymbolSelect
              value={rule.after}
              onChange={(v) => onPatch({ after: v })}
              symbols={others}
              blank="— cualquiera —"
              label="Símbolo que debe seguir"
            />
          </div>
        </>
      )}
    </motion.li>
  )
}

const KINDS = [
  { id: 'AFD', title: 'AFD', sub: 'Determinista', desc: 'De cada estado sale exactamente una flecha por símbolo.' },
  { id: 'AFND', title: 'AFND', sub: 'No determinista', desc: 'Un símbolo puede salir de un estado hacia uno o más estados.' },
]

const secondaryBtn =
  'flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

export default function SpecBuilder({
  spec,
  onChange,
  kind,
  onKind,
  validation,
  onBuild,
  building,
  onGenerate,
  generating,
  onClear,
  lastLevel,
  flash,
  source,
}) {
  const [genKind, setGenKind] = useState('random')
  const alphaKind = kindOf(spec.alphabet)
  const pool = poolFor(alphaKind)
  const lastLevelLabel = LEVELS.find((l) => l.id === lastLevel)?.label ?? 'Fácil'

  const switchAlphabet = (k) => {
    if (k === alphaKind) return
    const a = poolFor(k).slice(0, 2)
    onChange({ ...blankSpec(), alphabet: a, start: a[0], end: a[0], length: spec.length ?? noLength() })
  }
  const toggleSymbol = (s) => {
    const has = spec.alphabet.includes(s)
    let next = has ? spec.alphabet.filter((x) => x !== s) : [...spec.alphabet, s]
    if ((has && next.length < MIN_SYMBOLS) || (!has && next.length > MAX_SYMBOLS)) return
    next = pool.filter((x) => next.includes(x))
    onChange(sanitizeSpec({ ...spec, alphabet: next }))
  }
  const patchRule = (i, patch) =>
    onChange({ ...spec, rules: spec.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const removeRule = (i) => onChange({ ...spec, rules: spec.rules.filter((_, j) => j !== i) })
  const addRule = () => {
    const free = spec.alphabet.find((a) => !spec.rules.some((r) => r.symbol === a))
    if (!free) return
    onChange({ ...spec, rules: [...spec.rules, newRule(free)] })
  }
  const canAddRule = spec.rules.length < spec.alphabet.length

  return (
    <div className="glass space-y-6 p-5">
      {/* ---- ejercicio aleatorio ---- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Ejercicio aleatorio</h2>
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
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <motion.button
              key={l.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              disabled={generating}
              onClick={() => onGenerate(l.id, genKind)}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
              style={{ boxShadow: `inset 0 -3px 0 ${l.color}` }}
            >
              <span className="block font-semibold">{l.label}</span>
              <span className="mt-0.5 block text-[11px] leading-tight text-white/50">{l.hint}</span>
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-white/45">
          Genera indicaciones nuevas en el formulario de abajo; después eliges AFD o AFND y diseñas el autómata.
        </p>
      </section>

      <hr className="border-white/10" />

      <motion.div
        key={flash}
        initial={flash ? { opacity: 0.3, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Indicaciones</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              source === 'manual' ? 'bg-white/10 text-white/60' : 'bg-violet-400/20 text-violet-200'
            }`}
          >
            {source === 'manual' ? 'Registro manual' : `Ejercicio ${SOURCE_LABEL[source].toLowerCase()}`}
          </span>
        </div>

        <Section n="1" title="Alfabeto" hint={`${spec.alphabet.length} de ${MAX_SYMBOLS} símbolos`}>
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
              <Chip key={s} active={spec.alphabet.includes(s)} onClick={() => toggleSymbol(s)} label={`Símbolo ${s}`}>
                {s}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-white/45">No se pueden mezclar números y letras.</p>
        </Section>

        <Section n="2" title="Inicio y fin">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['start', 'Toda palabra inicia en'],
              ['end', 'y finaliza en'],
            ].map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <span className="text-xs text-white/55">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {spec.alphabet.map((s) => (
                    <Chip
                      key={s}
                      tone="violet"
                      active={spec[field] === s}
                      onClick={() => onChange({ ...spec, [field]: s })}
                      label={`${label} ${s}`}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section n="3" title="Longitud de la palabra" hint="opcional">
          <LengthRow spec={spec} onChange={onChange} />
          <p className="text-xs text-white/45">Cuántos símbolos tiene la palabra completa (máximo {MAX_LEN}).</p>
        </Section>

        <Section n="4" title="Reglas de subcadenas" hint="opcional">
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {spec.rules.map((r, i) => (
                <RuleRow
                  key={`${i}-${r.symbol}`}
                  rule={r}
                  index={i}
                  spec={spec}
                  onPatch={(p) => patchRule(i, p)}
                  onRemove={() => removeRule(i)}
                />
              ))}
            </AnimatePresence>
          </ul>
          <button
            type="button"
            onClick={addRule}
            disabled={!canAddRule}
            className="w-full rounded-xl border border-dashed border-white/20 py-2.5 text-sm text-white/65 transition hover:border-cyan-300/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35"
          >
            + Agregar regla
          </button>
          <p className="text-xs text-white/45">
            Sin una regla en contra, cualquier símbolo puede repetirse sin límite. La longitud de una subcadena es
            cuántos símbolos iguales van seguidos (máximo {MAX_RUN}); «precedidas / seguidas» aplica a todo bloque de
            ese símbolo.
          </p>
        </Section>

        {/* ---- validación ---- */}
        <div aria-live="polite" className="space-y-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {validation.errors.map((e) => (
              <motion.div
                key={e}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-100"
              >
                ✕ {e}
              </motion.div>
            ))}
            {validation.warnings.map((w) => (
              <motion.div
                key={w}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3.5 py-2.5 text-sm text-amber-100"
              >
                ⚠ {w}
              </motion.div>
            ))}
          </AnimatePresence>

          {validation.ok && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.07] px-4 py-3"
            >
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                ✓ Indicaciones válidas
              </p>
              <ul className="space-y-1 text-sm text-white/85">
                {validation.text.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </motion.div>

      <hr className="border-white/10" />

      {/* ---- tipo de autómata y diseño ---- */}
      <section className="space-y-3">
        <h3 className="font-semibold">¿Qué autómata quieres que se diseñe?</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de autómata">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => onKind(k.id)}
              className={`rounded-2xl border p-3 text-left transition ${
                kind === k.id
                  ? 'border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_24px_-8px_rgba(34,211,238,.8)]'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{k.title}</span>
                <span className="text-xs text-white/50">{k.sub}</span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-white/55">{k.desc}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onBuild}
          disabled={!validation.ok || building || validation.loading}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
          </svg>
          {building ? 'Diseñando…' : `Diseñar ${kind}`}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClear} className={secondaryBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
            </svg>
            Limpiar campos
          </button>
          <button
            type="button"
            onClick={() => onGenerate(lastLevel, genKind)}
            disabled={generating}
            title={`Genera otro ejercicio de nivel ${lastLevelLabel}`}
            className={secondaryBtn}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </svg>
            Generar nuevo · {lastLevelLabel}
          </button>
        </div>
      </section>
    </div>
  )
}