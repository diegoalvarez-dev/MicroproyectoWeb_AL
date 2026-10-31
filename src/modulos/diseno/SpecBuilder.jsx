import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LEVELS,
  MAX_COUNT,
  MAX_LEN,
  MAX_RUN,
  MAX_SYMBOLS,
  MIN_SYMBOLS,
  SOURCE_LABEL,
  blankSpec,
  kindOf,
  newCount,
  newRule,
  noLength,
  poolFor,
  sanitizeSpec,
} from '../../compartido/lib/spec.js'

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

function SymbolSelect({ value, onChange, symbols, blank, label }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="field sym py-1.5!">
      {blank && <option value="">{blank}</option>}
      {symbols.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}

// Campo numérico: '' = vacío.
function NumField({ value, onChange, min = 1, max, label, placeholder = '—' }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
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

// ---------------------------------------------------------------------------
// Los símbolos de la materia. Al escogerlos aparece la indicación con su enunciado.
// ---------------------------------------------------------------------------
const SYMBOLS = {
  exists: {
    glyph: '∃w',
    title: 'Pueden existir',
    desc: 'subcadenas consecutivas de un símbolo',
    badge: 'border-cyan-300/50 bg-cyan-300/10 text-cyan-200',
  },
  forbid: {
    glyph: '~∃w',
    title: 'No pueden existir',
    desc: 'subcadenas consecutivas de un símbolo',
    badge: 'border-rose-300/50 bg-rose-400/10 text-rose-200',
  },
  all: {
    glyph: '∀w',
    title: 'Toda palabra',
    desc: 'inicia en … y finaliza en …',
    badge: 'border-violet-300/50 bg-violet-400/15 text-violet-200',
  },
  word: {
    glyph: 'w',
    title: 'Palabra',
    desc: 'su longitud o la suma total de un símbolo',
    badge: 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200',
  },
}

function Glyph({ kind, className = '' }) {
  const s = SYMBOLS[kind]
  return (
    <span
      className={`sym inline-grid h-9 min-w-12 place-items-center rounded-lg border px-2 text-base italic ${s.badge} ${className}`}
      title={s.title}
    >
      {s.glyph}
    </span>
  )
}

function SymbolPalette({ spec, onAdd }) {
  const [openW, setOpenW] = useState(false)
  const hasLength = spec.length.mode !== 'none'
  const pick = (kind) => {
    if (kind === 'word') {
      setOpenW((v) => !v)
      return
    }
    setOpenW(false)
    onAdd(kind)
  }
  return (
    <div className="space-y-2" data-testid="palette">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(SYMBOLS).map(([kind, s]) => {
          const disabled = kind === 'all' && spec.startEnd
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onClick={() => pick(kind)}
              aria-expanded={kind === 'word' ? openW : undefined}
              aria-label={`${s.glyph}: ${s.title} ${s.desc}`}
              title={disabled ? 'Ya agregaste esta indicación' : `Agregar: ${s.title} ${s.desc}`}
              data-symbol={kind}
              className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2 text-left transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Glyph kind={kind} />
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="block text-[11px] text-white/50">{s.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
      <AnimatePresence initial={false}>
        {openW && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-2 overflow-hidden"
          >
            <button
              type="button"
              disabled={hasLength}
              onClick={() => {
                setOpenW(false)
                onAdd('length')
              }}
              data-symbol="length"
              className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.07] px-3 py-2 text-left text-sm transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Longitud de la palabra
              <span className="block text-[11px] text-white/50">cuántos símbolos tiene</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenW(false)
                onAdd('count')
              }}
              data-symbol="count"
              className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.07] px-3 py-2 text-left text-sm transition hover:bg-emerald-300/15"
            >
              Suma total de un símbolo
              <span className="block text-[11px] text-white/50">cuántas veces aparece</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Tarjeta de una indicación: símbolo + enunciado con sus controles + botón de quitar.
function Card({ kind, onRemove, children, testId }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      data-testid={testId}
      data-kind={kind}
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
    >
      <Glyph kind={kind} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2 text-sm text-white/65">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar indicación"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-rose-400/15 hover:text-rose-300"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </motion.li>
  )
}

const Line = ({ children }) => <div className="flex flex-wrap items-center gap-x-2 gap-y-2">{children}</div>

// ---- ∀w: toda palabra inicia en … y finaliza en … ----
function StartEndCard({ spec, onChange }) {
  return (
    <Card kind="all" testId="card-all" onRemove={() => onChange({ ...spec, startEnd: false })}>
      <p className="font-medium text-white/85">Toda palabra inicia en … y finaliza en …</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['start', 'Inicia en'],
          ['end', 'Finaliza en'],
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
    </Card>
  )
}

// ---- w: longitud de la palabra ----
const LEN_MODES = [
  { value: 'exact', label: 'exactamente' },
  { value: 'min', label: 'al menos' },
  { value: 'max', label: 'como máximo' },
  { value: 'range', label: 'entre' },
]

// Cambia entre exacto / mínimo / máximo / rango conservando el número que ya había.
function switchMode(L, mode, top, fallback) {
  const v = L.min !== '' ? L.min : L.max !== '' ? L.max : fallback
  const patch = {
    exact: { min: v, max: v },
    min: { min: v, max: '' },
    max: { min: '', max: v },
    range: {
      min: L.min !== '' ? L.min : Math.min(v, top),
      max: L.max !== '' ? L.max : Math.min(top, Number(v) + 3),
    },
  }[mode]
  return { mode, ...patch }
}

function AmountFields({ L, top, min = 1, set, label }) {
  return (
    <>
      {L.mode === 'exact' && (
        <NumField value={L.min} min={min} max={top} label={`${label} exacto`} onChange={(v) => set({ min: v, max: v })} />
      )}
      {L.mode === 'min' && <NumField value={L.min} min={min} max={top} label={`${label} mínimo`} onChange={(v) => set({ min: v })} />}
      {L.mode === 'max' && <NumField value={L.max} min={min} max={top} label={`${label} máximo`} onChange={(v) => set({ max: v })} />}
      {L.mode === 'range' && (
        <>
          <NumField value={L.min} min={min} max={top} label={`${label} mínimo`} onChange={(v) => set({ min: v })} />
          <span>y</span>
          <NumField value={L.max} min={min} max={top} label={`${label} máximo`} onChange={(v) => set({ max: v })} />
        </>
      )}
    </>
  )
}

function LengthCard({ spec, onChange }) {
  const L = spec.length
  const set = (patch) => onChange({ ...spec, length: { ...L, ...patch } })
  return (
    <Card kind="word" testId="card-length" onRemove={() => onChange({ ...spec, length: noLength() })}>
      <Line>
        <span className="font-medium text-white/85">La longitud de la palabra es</span>
        <select
          value={L.mode}
          onChange={(e) => onChange({ ...spec, length: switchMode(L, e.target.value, MAX_LEN, 4) })}
          aria-label="Tipo de límite de longitud de la palabra"
          className="field py-1.5!"
        >
          {LEN_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <AmountFields L={L} top={MAX_LEN} set={set} label="Longitud" />
        <span>símbolos</span>
      </Line>
      <p className="text-xs text-white/40">Cuántos símbolos tiene la palabra completa (máximo {MAX_LEN}).</p>
    </Card>
  )
}

// ---- w: suma total de un símbolo ----
function CountCard({ count, spec, onPatch, onRemove }) {
  return (
    <Card kind="word" testId="card-count" onRemove={onRemove}>
      <Line>
        <span className="font-medium text-white/85">La suma total de</span>
        <SymbolSelect value={count.symbol} onChange={(s) => onPatch({ symbol: s })} symbols={spec.alphabet} label="Símbolo que se cuenta" />
        <span className="font-medium text-white/85">en la palabra es</span>
        <select
          value={count.mode}
          onChange={(e) => onPatch(switchMode(count, e.target.value, MAX_COUNT, 2))}
          aria-label="Tipo de total"
          className="field py-1.5!"
        >
          {LEN_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <AmountFields L={count} top={MAX_COUNT} min={0} set={onPatch} label="Total" />
      </Line>
      <p className="text-xs text-white/40">Cuántas veces aparece {count.symbol} en toda la palabra (máximo {MAX_COUNT}).</p>
    </Card>
  )
}

// ---- ∃w / ~∃w: subcadenas consecutivas de un símbolo (una condición por indicación) ----
const CONDS = [
  { value: 'none', label: 'sin condición' },
  { value: 'before', label: 'precedidas de' },
  { value: 'after', label: 'seguidas de' },
  { value: 'min_run', label: 'con una longitud mínima de' },
  { value: 'max_run', label: 'con una longitud máxima de' },
]

function RuleCard({ rule, spec, onPatch, onRemove }) {
  const forbid = rule.mode === 'forbid'
  const others = spec.alphabet.filter((a) => a !== rule.symbol)
  const setCond = (cond) => onPatch({ cond, before: '', after: '', min_run: '', max_run: '' })
  return (
    <Card kind={forbid ? 'forbid' : 'exists'} testId={forbid ? 'card-forbid' : 'card-exists'} onRemove={onRemove}>
      <Line>
        <span className="font-medium text-white/85">{forbid ? 'No pueden existir' : 'Pueden existir'} subcadenas consecutivas de</span>
        <SymbolSelect
          value={rule.symbol}
          onChange={(s) =>
            onPatch({
              symbol: s,
              before: rule.before === s ? '' : rule.before,
              after: rule.after === s ? '' : rule.after,
              cond: (rule.cond === 'before' && rule.before === s) || (rule.cond === 'after' && rule.after === s) ? 'none' : rule.cond,
            })
          }
          symbols={spec.alphabet}
          label="Símbolo de la indicación"
        />
      </Line>
      {!forbid && (
        <Line>
          <select
            value={rule.cond}
            onChange={(e) => setCond(e.target.value)}
            aria-label="Condición de la indicación"
            className="field py-1.5!"
          >
            {CONDS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {(rule.cond === 'before' || rule.cond === 'after') && (
            <SymbolSelect
              value={rule[rule.cond]}
              onChange={(v) => onPatch({ [rule.cond]: v })}
              symbols={others}
              blank="— elige —"
              label={rule.cond === 'before' ? 'Símbolo que debe preceder' : 'Símbolo que debe seguir'}
            />
          )}
          {(rule.cond === 'min_run' || rule.cond === 'max_run') && (
            <>
              <NumField
                value={rule[rule.cond]}
                min={rule.cond === 'min_run' ? 2 : 1}
                max={MAX_RUN}
                label={rule.cond === 'min_run' ? 'Longitud mínima de la subcadena' : 'Longitud máxima de la subcadena'}
                onChange={(v) => onPatch({ [rule.cond]: v })}
              />
              <span>símbolos seguidos</span>
            </>
          )}
        </Line>
      )}
    </Card>
  )
}


const secondaryBtn =
  'flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

export default function SpecBuilder({
  spec,
  onChange,
  validation,
  onRegister,
  registerState,
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
    onChange({ ...blankSpec(), alphabet: a, start: a[0], end: a[0], startEnd: spec.startEnd, length: spec.length ?? noLength() })
  }
  const toggleSymbol = (s) => {
    const has = spec.alphabet.includes(s)
    let next = has ? spec.alphabet.filter((x) => x !== s) : [...spec.alphabet, s]
    if ((has && next.length < MIN_SYMBOLS) || (!has && next.length > MAX_SYMBOLS)) return
    next = pool.filter((x) => next.includes(x))
    onChange(sanitizeSpec({ ...spec, alphabet: next }))
  }

  // ---- indicaciones ----
  const first = spec.alphabet[0]
  const addIndication = (what) => {
    if (what === 'exists') onChange({ ...spec, rules: [...spec.rules, newRule(first, 'allow')] })
    if (what === 'forbid') onChange({ ...spec, rules: [...spec.rules, newRule(first, 'forbid')] })
    if (what === 'all')
      onChange({
        ...spec,
        startEnd: true,
        start: spec.alphabet.includes(spec.start) ? spec.start : first,
        end: spec.alphabet.includes(spec.end) ? spec.end : first,
      })
    if (what === 'length') onChange({ ...spec, length: { mode: 'min', min: 3, max: '' } })
    if (what === 'count') {
      const free = spec.alphabet.find((a) => !(spec.counts || []).some((c) => c.symbol === a)) ?? first
      onChange({ ...spec, counts: [...(spec.counts || []), newCount(free)] })
    }
  }
  const patchRule = (id, patch) => onChange({ ...spec, rules: spec.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const removeRule = (id) => onChange({ ...spec, rules: spec.rules.filter((r) => r.id !== id) })
  const patchCount = (id, patch) =>
    onChange({ ...spec, counts: spec.counts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const removeCount = (id) => onChange({ ...spec, counts: spec.counts.filter((c) => c.id !== id) })

  const nothing = !spec.startEnd && spec.length.mode === 'none' && !spec.rules.length && !(spec.counts || []).length

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
          Genera indicaciones nuevas en el formulario de abajo; después puedes ver el autómata diseñado o practicar
          dibujando el tuyo.
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

        <Section n="2" title="Indicaciones" hint="escoge un símbolo para agregarla">
          <SymbolPalette spec={spec} onAdd={addIndication} />

          {nothing && (
            <p className="rounded-xl border border-dashed border-white/15 px-3 py-3 text-center text-sm text-white/45">
              Aún no hay indicaciones: toca un símbolo de arriba para agregar la primera.
            </p>
          )}

          <ul className="space-y-2.5" data-testid="indications">
            <AnimatePresence initial={false}>
              {spec.startEnd && <StartEndCard key="all" spec={spec} onChange={onChange} />}
              {spec.length.mode !== 'none' && <LengthCard key="length" spec={spec} onChange={onChange} />}
              {(spec.counts || []).map((c) => (
                <CountCard
                  key={`c${c.id}`}
                  count={c}
                  spec={spec}
                  onPatch={(p) => patchCount(c.id, p)}
                  onRemove={() => removeCount(c.id)}
                />
              ))}
              {spec.rules.map((r) => (
                <RuleCard
                  key={`r${r.id}`}
                  rule={r}
                  spec={spec}
                  onPatch={(p) => patchRule(r.id, p)}
                  onRemove={() => removeRule(r.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
          <p className="text-xs text-white/45">
            Cada indicación es independiente: si dos hablan del mismo símbolo, la palabra debe cumplir las dos. Sin una
            indicación en contra, cualquier símbolo puede repetirse sin límite.
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

           {/* ---- registrar las indicaciones (el diseño AFD/AFND se elige en el panel de la derecha) ---- */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={onRegister}
          disabled={!validation.ok || validation.loading || registerState === 'done'}
          data-testid="register-btn"
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          {registerState === 'done' ? 'Indicaciones registradas' : 'Registrar indicaciones'}
        </button>
        <p className="text-xs text-white/50" aria-live="polite">
          {registerState === 'done'
            ? 'Listo: elige AFD o AFND y pulsa «Diseñar» en el panel de diseño.'
            : registerState === 'stale'
              ? 'Cambiaste las indicaciones: vuelve a registrarlas para diseñar con los cambios.'
              : 'Cuando las indicaciones estén válidas, regístralas para poder diseñar el autómata.'}
        </p>

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