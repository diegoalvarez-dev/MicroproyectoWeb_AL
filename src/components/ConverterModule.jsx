import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AutomatonCanvas from './AutomatonCanvas.jsx'
import HistoryPanel from './HistoryPanel.jsx'
import NfaDrawer from './NfaDrawer.jsx'
import NfaForm from './NfaForm.jsx'
import PanZoom from './PanZoom.jsx'
import StepPlayer from './StepPlayer.jsx'
import TransitionTable, { StateBadge } from './TransitionTable.jsx'
import WordTester from './WordTester.jsx'
import { Chip, Section, Segmented, secondaryBtn } from './ui.jsx'
import { api } from '../lib/api.js'
import { conversionProgress } from '../lib/convert.js'
import { CONVERTER_KEY, loadHistory, saveHistory } from '../lib/history.js'
import { computeLayout, layoutWithPositions } from '../lib/layout.js'
import { runHighlight } from '../lib/highlight.js'
import {
  MAX_NFA_SYMBOLS,
  MIN_NFA_SYMBOLS,
  blankNfa,
  describeNfa,
  exampleNfa,
  kindOf,
  nfaFromApi,
  nfaKey,
  nfaToApi,
  poolFor,
  setAlphabet,
} from '../lib/nfa.js'

const NO_HIGHLIGHT = { nodes: {}, edges: {} }
const LEVELS = [
  { id: 'facil', label: 'Fácil', hint: '3 estados, 2 símbolos', color: '#34d399' },
  { id: 'medio', label: 'Medio', hint: '4 estados, hasta 3 símbolos', color: '#fbbf24' },
  { id: 'dificil', label: 'Difícil', hint: '5–6 estados, hasta 3 símbolos', color: '#fb7185' },
]
const STEP_MS = { init: 900, row: 700, cell: 1250, done: 900 } // pausa antes de mostrar cada tipo de paso

// Todo el autómata a la vista (el AFND registrado se muestra de una vez).
function fullyVisible(automaton, layout) {
  return {
    states: new Set(automaton.states.map((s) => s.id)),
    edges: new Map(layout.edges.map((e) => [e.key, e.symbols])),
    last: null,
  }
}

function Banner({ tone, children }) {
  const cls = {
    err: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
    warn: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
    ok: 'border-emerald-300/30 bg-emerald-300/[0.07] text-white/90',
  }[tone]
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/55" aria-label="Colores de la conversión">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-amber-300/70" /> amarillo: estado nuevo (entra a la columna Q)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-emerald-300/70" /> verde: ya estaba en Q
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-cyan-300/70" /> cian: estado que se analiza
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded bg-violet-400/70" /> violeta: celdas del AFND que se unen
      </li>
    </ul>
  )
}

export default function ConverterModule() {
  const [nfa, setNfaRaw] = useState(exampleNfa)
  const [mode, setMode] = useState('draw')
  const [source, setSource] = useState('manual')
  const [lastLevel, setLastLevel] = useState('facil')
  const [genKind, setGenKind] = useState('random')
  const [flash, setFlash] = useState(0)
  const [validation, setValidation] = useState({ ok: false, errors: [], warnings: [], loading: true, key: '' })
  const [registered, setRegistered] = useState(null) // AFND ya registrado (se ve el autómata y su tabla)
  const [conv, setConv] = useState(null) // conversión en curso o terminada
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [run, setRun] = useState(null)
  const [busy, setBusy] = useState(null) // 'register' | 'convert' | 'generate' | 'word'
  const [netError, setNetError] = useState('')
  const [full, setFull] = useState(false)
  const [history, setHistory] = useState(() => loadHistory(CONVERTER_KEY))
  const registeredRef = useRef(null)
  const conversionRef = useRef(null)

  const key = useMemo(() => nfaKey(nfa), [nfa])
  const updateNfa = useCallback((next) => {
    setNfaRaw(next)
    setSource('manual')
  }, [])
  const staleRegistered = !!registered && registered.key !== key

  // ---- validación en vivo (backend); mover estados en el dibujo no la repite ----
  useEffect(() => {
    let cancelled = false
    setValidation((v) => ({ ...v, loading: true }))
    const t = setTimeout(async () => {
      try {
        const r = await api.nfaValidate(nfa)
        if (cancelled) return
        setValidation({ ...r, loading: false, key })
        setNetError('')
      } catch {
        if (cancelled) return
        setValidation((v) => ({ ...v, ok: false, loading: false, key }))
        setNetError('No se pudo conectar con el backend. ¿Está corriendo «npm run dev:api»?')
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // ---- reproducción de la conversión ------------------------------------------
  useEffect(() => {
    if (!playing || !conv) return undefined
    if (idx >= conv.steps.length) {
      setPlaying(false)
      return undefined
    }
    const t = setTimeout(() => setIdx((i) => i + 1), STEP_MS[conv.steps[idx].kind] / speed)
    return () => clearTimeout(t)
  }, [playing, idx, speed, conv])

  // ---- recorrido de una palabra ---------------------------------------------------
  useEffect(() => {
    if (!run || run.finished) return undefined
    const n = run.result.path.length
    const delay = run.k === 0 ? 450 : 700 / speed
    const t = setTimeout(
      () => setRun((r) => (r && !r.finished ? (r.k < n ? { ...r, k: r.k + 1 } : { ...r, finished: true }) : r)),
      delay,
    )
    return () => clearTimeout(t)
  }, [run, speed])

  // pantalla completa del diagrama de la conversión
  useEffect(() => {
    if (!full) return undefined
    const onKey = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [full])

  // al registrar o convertir, baja hasta lo nuevo
  useEffect(() => {
    if (registered) registeredRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [registered])
  useEffect(() => {
    if (conv) conversionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [conv])

  // ---- acciones --------------------------------------------------------------------
  const pushHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.key !== entry.key)].slice(0, 40)
      saveHistory(next, CONVERTER_KEY)
      return next
    })
  }, [])

  const resetResults = () => {
    setRegistered(null)
    setConv(null)
    setRun(null)
    setIdx(0)
    setPlaying(false)
    setFull(false)
  }

  // Registra el AFND (muestra el autómata y su tabla); si es AFD solo avisa.
  const registerWith = async (n, useSource) => {
    setBusy('register')
    try {
      const r = await api.nfaValidate(n)
      if (!r.ok) {
        setValidation({ ...r, loading: false, key: nfaKey(n) })
        return
      }
      if (r.kind !== 'AFND') {
        setValidation({ ...r, loading: false, key: nfaKey(n) })
        return
      }
      setConv(null)
      setRun(null)
      setIdx(0)
      setPlaying(false)
      setRegistered({
        key: nfaKey(n),
        nfa: n,
        automaton: r.automaton,
        table: r.table,
        pos: n.pos,
        nondeterministic: r.nondeterministic,
        warnings: r.warnings,
      })
      setNetError('')
      pushHistory({
        id: Date.now(),
        key: nfaKey(n),
        ts: Date.now(),
        kind: 'AFND',
        source: useSource,
        nfa: nfaToApi(n),
        text: describeNfa(n),
      })
    } catch {
      setNetError('No se pudo registrar el autómata: el backend no respondió.')
    } finally {
      setBusy(null)
    }
  }

  const convert = async () => {
    if (!registered) return
    setBusy('convert')
    try {
      const r = await api.nfaConvert(registered.nfa)
      if (!r.ok || !r.dfa) {
        setNetError((r.errors || ['No se pudo convertir el autómata.']).join(' '))
        return
      }
      setRun(null)
      setConv({ key: registered.key, steps: r.steps, dfa: r.dfa, examples: r.examples })
      setIdx(0)
      setPlaying(true)
      setNetError('')
    } catch {
      setNetError('No se pudo convertir el autómata: el backend no respondió.')
    } finally {
      setBusy(null)
    }
  }

  const handleGenerate = async (level, alphabetKind) => {
    setBusy('generate')
    try {
      const r = await api.nfaGenerate(level, alphabetKind)
      setNfaRaw(nfaFromApi(r.nfa))
      setSource(level)
      setLastLevel(level)
      setFlash((f) => f + 1)
      setNetError('')
    } catch {
      setNetError('No se pudo generar el ejercicio: el backend no respondió.')
    } finally {
      setBusy(null)
    }
  }

  const handleClear = () => {
    setNfaRaw(blankNfa())
    setSource('manual')
    resetResults()
    setNetError('')
    setFlash((f) => f + 1)
  }

  const handleRunWord = async (word) => {
    if (!registered || !conv) return
    setBusy('word')
    setPlaying(false)
    setIdx(conv.steps.length)
    try {
      const r = await api.nfaCheckWord(registered.nfa, word)
      if (r.ok) setRun({ result: r, k: 0, finished: false })
    } catch {
      setNetError('No se pudo validar la palabra: el backend no respondió.')
    } finally {
      setBusy(null)
    }
  }

  const loadFromHistory = (item) => {
    const n = nfaFromApi(item.nfa)
    setNfaRaw(n)
    setSource(item.source)
    if (item.source !== 'manual') setLastLevel(item.source)
    setFlash((f) => f + 1)
    resetResults()
    registerWith(n, item.source)
  }

  // ---- alfabeto -----------------------------------------------------------------------
  const alphaKind = kindOf(nfa.alphabet)
  const pool = poolFor(alphaKind)
  const switchAlphabet = (k) => {
    if (k === alphaKind) return
    updateNfa({ ...nfa, alphabet: poolFor(k).slice(0, 2), delta: {} })
  }
  const toggleSymbol = (s) => {
    const has = nfa.alphabet.includes(s)
    let next = has ? nfa.alphabet.filter((x) => x !== s) : [...nfa.alphabet, s]
    if ((has && next.length < MIN_NFA_SYMBOLS) || (!has && next.length > MAX_NFA_SYMBOLS)) return
    next = pool.filter((x) => next.includes(x))
    updateNfa(setAlphabet(nfa, next))
  }

  // ---- derivados ------------------------------------------------------------------------
  const regLayout = useMemo(
    () => (registered ? layoutWithPositions(registered.automaton, registered.pos) : null),
    [registered],
  )
  const regVisible = useMemo(
    () => (registered && regLayout ? fullyVisible(registered.automaton, regLayout) : null),
    [registered, regLayout],
  )
  const dfaLayout = useMemo(() => (conv ? computeLayout(conv.dfa.automaton) : null), [conv])
  const progress = useMemo(
    () => (conv ? conversionProgress(conv.steps, idx, conv.dfa.automaton) : null),
    [conv, idx],
  )
  const highlight = run ? runHighlight(run) : progress ? progress.highlight : NO_HIGHLIGHT
  const finished = !!conv && idx >= conv.steps.length

  const fresh = validation.key === key && !validation.loading
  const isAfd = fresh && validation.ok && validation.kind === 'AFD'
  const isAfnd = fresh && validation.ok && validation.kind === 'AFND'
  const lvlLabel = LEVELS.find((l) => l.id === lastLevel)?.label ?? 'Fácil'

  // En pantalla completa se saca del panel con un portal: el panel usa backdrop-filter y
  // eso haría que `fixed` se midiera contra el panel y no contra la ventana.
  const diagram =
    conv && dfaLayout && progress && registered ? (
      <div
        className={
          full ? 'fixed inset-0 z-50 m-0! flex flex-col gap-3 bg-[#060919] p-4' : 'min-w-0'
        }
      >
        <PanZoom
          bounds={dfaLayout.bounds}
          resetKey={`${registered.key}-${conv.steps.length}-${full}`}
          expanded={full}
          onToggleExpand={() => setFull((v) => !v)}
          className={full ? 'min-h-0 flex-1' : 'h-[460px] sm:h-[560px]'}
        >
          <AutomatonCanvas
            automaton={conv.dfa.automaton}
            layout={dfaLayout}
            visible={progress.visible}
            highlight={highlight}
            last={run ? null : progress.visible.last}
          />
        </PanZoom>
      </div>
    ) : null

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 pb-10">
      <AnimatePresence>
        {netError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
          >
            {netError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------ registro del AFND ------------------------------ */}
      <section className="glass p-5" aria-label="Registro del AFND">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Registrar un AFND</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              source === 'manual' ? 'bg-white/10 text-white/60' : 'bg-violet-400/20 text-violet-200'
            }`}
          >
            {source === 'manual' ? 'Registro manual' : `Ejercicio ${LEVELS.find((l) => l.id === source).label.toLowerCase()}`}
          </span>
        </div>

        {/* A la izquierda los datos (ejercicio, alfabeto, aviso y botones) y a la derecha el autómata,
            para que el dibujo quede arriba y a la vista mientras se registra. */}
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(270px,330px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Section title="Ejercicio aleatorio">
              <div className="space-y-2">
                <div className="grid gap-1.5">
                  {LEVELS.map((l) => (
                    <motion.button
                      key={l.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={busy === 'generate'}
                      onClick={() => handleGenerate(l.id, genKind)}
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
                <p className="text-xs text-white/45">No se pueden mezclar números y letras. Cambiar entre números y letras borra las flechas.</p>
              </Section>

              {/* ---- validación ---- */}
              <div aria-live="polite" className="space-y-2" data-testid="validation">
                {fresh &&
                  validation.errors.map((e) => (
                    <Banner key={e} tone="err">
                      ✕ {e}
                    </Banner>
                  ))}
                {fresh &&
                  validation.warnings?.map((w) => (
                    <Banner key={w} tone="warn">
                      ⚠ {w}
                    </Banner>
                  ))}
                {isAfd && (
                  <Banner tone="warn">
                    <p className="font-semibold">⚠ Este autómata es un AFD, no un AFND.</p>
                    <p className="mt-0.5 opacity-90">
                      Ninguna celda de la tabla tiene más de un destino, así que ya es determinista y no necesita
                      conversión. Para convertir, haz que algún símbolo salga de un estado hacia dos o más estados. Un
                      AFD se reduce con la minimización (módulo 3).
                    </p>
                  </Banner>
                )}
                {isAfnd && (
                  <Banner tone="ok">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">✓ AFND válido</p>
                    <p>
                      Es no determinista porque{' '}
                      {validation.nondeterministic.map((c, i) => (
                        <span key={`${c.state}${c.symbol}`}>
                          {i > 0 && '; '}
                          <span className="sym">{c.state}</span> con <span className="sym">{c.symbol}</span> va a{' '}
                          <span className="sym">{c.targets.join(', ')}</span>
                        </span>
                      ))}
                      .
                    </p>
                  </Banner>
                )}
              </div>
            </motion.div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => registerWith(nfa, source)}
                disabled={!isAfnd || busy === 'register'}
                className="btn-primary flex items-center justify-center gap-2 px-6 py-3 text-base"
              >
                {busy === 'register' ? 'Registrando…' : 'Registrar AFND'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleClear} className={secondaryBtn}>
                  Limpiar campos
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate(lastLevel, genKind)}
                  disabled={busy === 'generate'}
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
              {mode === 'draw' ? <NfaDrawer nfa={nfa} onChange={updateNfa} /> : <NfaForm nfa={nfa} onChange={updateNfa} />}
            </Section>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------ AFND registrado ------------------------------ */}
      {registered && regLayout && (
        <section ref={registeredRef} className="glass scroll-mt-4 space-y-4 p-5" data-testid="registered" aria-label="AFND registrado">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              <span className="grad-text">AFND</span> registrado
            </h2>
            {staleRegistered && (
              <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-200">
                Editaste el autómata: pulsa «Registrar AFND» para usar los cambios
              </span>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]">
            <PanZoom bounds={regLayout.bounds} resetKey={registered.key} className="h-[420px]">
              <AutomatonCanvas
                automaton={registered.automaton}
                layout={regLayout}
                visible={regVisible}
                highlight={NO_HIGHLIGHT}
                last={null}
              />
            </PanZoom>
            <div className="space-y-4">
              <TransitionTable
                testId="nfa-table"
                title="Tabla de transición del AFND"
                alphabet={registered.automaton.alphabet}
                rows={registered.table}
                cellTone={(s, a) => {
                  const row = registered.table.find((r) => r.state === s)
                  return row.cells[a].length > 1 ? 'nd' : undefined
                }}
                caption="→ estado inicial · estado dentro de un círculo = terminal (final) · las celdas resaltadas tienen más de un destino (por eso es AFND) · ∅ = sin flecha: ese símbolo va al estado error."
              />
              <button
                type="button"
                onClick={convert}
                disabled={busy === 'convert'}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
              >
                {busy === 'convert' ? 'Convirtiendo…' : 'Convertir a AFD'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ conversión ------------------------------ */}
      {conv && progress && dfaLayout && registered && (
        <section ref={conversionRef} className="glass scroll-mt-4 space-y-4 p-5" data-testid="conversion" aria-label="Conversión a AFD">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              Conversión <span className="grad-text">AFND → AFD</span>
            </h2>
            <span className="text-xs text-white/45">
              {conv.dfa.automaton.states.length} estados en el AFD · Σ = {'{'}
              {conv.dfa.automaton.alphabet.join(', ')}
              {'}'}
            </span>
          </div>
          <Legend />
          <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.3fr)]">
            <div className="space-y-4">
              <TransitionTable
                testId="afd-table"
                title="Tabla del AFD (se va construyendo)"
                alphabet={conv.dfa.automaton.alphabet}
                rows={progress.rows}
                animate
                rowTone={(s) => progress.rowTone[s]}
                cellTone={(s, a) => progress.cellTone[`${s}|${a}`]}
                caption="Q = estados del AFD. → marca el inicial y el círculo, los terminales. Cada estado nuevo es el conjunto de estados del AFND a los que se llega; el nombre junta sus letras (BC = {B, C})."
              />
              <TransitionTable
                testId="nfa-ref-table"
                title="Tabla del AFND (de donde salen los datos)"
                alphabet={registered.automaton.alphabet}
                rows={registered.table}
                rowTone={(s) => (progress.refRows[s] ? 'ref' : undefined)}
                cellTone={(s, a) => (progress.refCells[`${s}|${a}`] ? 'ref' : undefined)}
              />
            </div>

            {full ? createPortal(diagram, document.body) : diagram}
          </div>

          {/* los controles quedan pegados abajo de la pantalla mientras se recorre la conversión */}
          <div className="sticky bottom-3 z-30 rounded-2xl border border-white/15 bg-[#0a1030]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur">
            <StepPlayer
              steps={conv.steps}
              idx={idx}
              setIdx={setIdx}
              playing={playing}
              setPlaying={setPlaying}
              speed={speed}
              setSpeed={setSpeed}
            />
          </div>

          {finished && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2" data-testid="mapping">
              <h3 className="font-semibold">Correspondencia de estados</h3>
              <ul className="flex flex-wrap gap-2 text-sm">
                {conv.dfa.mapping.map((m) => (
                  <li key={m.name} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <StateBadge name={m.name} final={m.final} className="sym h-8! min-w-8! text-cyan-200" />
                      <span className="text-white/45">=</span>
                      <span className="sym">{m.members.length ? `{${m.members.join(', ')}}` : '∅'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </section>
      )}

      {conv && (
        <WordTester
          key={`${flash}-${conv.key}`}
          enabled={finished}
          stale={false}
          examples={conv.examples}
          run={run}
          onRun={handleRunWord}
          onClear={() => setRun(null)}
          busy={busy === 'word'}
          title="Probar una palabra en el AFD"
          disabledHint="Termina la conversión para probar palabras"
          placeholder="Escribe una palabra, p. ej. 0110"
        />
      )}

      <HistoryPanel
        items={history}
        emptyText="Cada AFND que registres queda guardado aquí, en este navegador, para retomarlo cuando quieras."
        onLoad={loadFromHistory}
        onDelete={(id) =>
          setHistory((prev) => {
            const next = prev.filter((h) => h.id !== id)
            saveHistory(next, CONVERTER_KEY)
            return next
          })
        }
        onClear={() => {
          setHistory([])
          saveHistory([], CONVERTER_KEY)
        }}
      />
    </main>
  )
}