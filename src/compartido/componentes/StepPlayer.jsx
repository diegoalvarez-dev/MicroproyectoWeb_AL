import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ERROR_SYMBOL } from '../lib/names.js'

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONS = {
  first: 'M6 6h2v12H6zM9.5 12 18 6v12z',
  prev: 'M15.5 6 7 12l8.5 6z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M8.5 6 17 12l-8.5 6z',
  last: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
}

const SPEEDS = [0.5, 1, 2, 4]

function CtlButton({ label, onClick, disabled, children, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-xl transition disabled:opacity-30 ${
        primary
          ? 'btn-primary h-11 w-11'
          : 'bg-white/8 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-cyan-300'
      }`}
    >
      {children}
    </button>
  )
}

// Barra de avance: un clic (o arrastrar) en cualquier parte lleva a ese paso; también responde a las flechas del teclado.
function SeekBar({ idx, total, onSeek }) {
  const ref = useRef(null)
  const [dragging, setDragging] = useState(false)
  const pct = total ? (idx / total) * 100 : 0
  const at = (e) => {
    const r = ref.current.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1)))
    onSeek(Math.round(f * total))
  }
  const onKey = (e) => {
    const k = { ArrowLeft: idx - 1, ArrowDown: idx - 1, ArrowRight: idx + 1, ArrowUp: idx + 1, Home: 0, End: total }[e.key]
    if (k === undefined) return
    e.preventDefault()
    onSeek(Math.min(total, Math.max(0, k)))
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Barra de avance de los pasos"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={idx}
      aria-valuetext={`Paso ${idx} de ${total}`}
      title="Haz clic en la barra para ir a ese paso"
      data-testid="seekbar"
      className="group relative cursor-pointer py-2.5 outline-none focus-visible:[&>div]:ring-2 focus-visible:[&>div]:ring-cyan-300"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        at(e)
      }}
      onPointerMove={(e) => dragging && at(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKey}
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10 transition group-hover:h-2">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 ${dragging ? '' : 'transition-[width] duration-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ left: `${pct}%`, opacity: dragging ? 1 : undefined }}
      />
    </div>
  )
}

export default function StepPlayer({ steps, idx, setIdx, playing, setPlaying, speed, setSpeed }) {
  const total = steps.length
  const current = idx > 0 ? steps[idx - 1] : null
  const done = idx >= total

  const pauseAnd = (fn) => () => {
    setPlaying(false)
    fn()
  }
  const pauseAnd2 = (n) => {
    setPlaying(false)
    setIdx(n)
  }
  const togglePlay = () => {
    if (playing) return setPlaying(false)
    if (done) setIdx(0)
    setPlaying(true)
  }

  return (
    <div className="space-y-3">
      <SeekBar idx={idx} total={total} onSeek={pauseAnd2} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CtlButton label="Volver al inicio" onClick={pauseAnd(() => setIdx(0))} disabled={idx === 0}>
            <Icon d={ICONS.first} />
          </CtlButton>
          <CtlButton label="Paso anterior" onClick={pauseAnd(() => setIdx((i) => Math.max(0, i - 1)))} disabled={idx === 0}>
            <Icon d={ICONS.prev} />
          </CtlButton>
          <CtlButton label={playing ? 'Pausar' : done ? 'Repetir animación' : 'Reproducir'} onClick={togglePlay} primary>
            <Icon d={playing ? ICONS.pause : ICONS.play} size={22} />
          </CtlButton>
          <CtlButton label="Paso siguiente" onClick={pauseAnd(() => setIdx((i) => Math.min(total, i + 1)))} disabled={done}>
            <Icon d={ICONS.next} />
          </CtlButton>
          <CtlButton label="Ir al final" onClick={pauseAnd(() => setIdx(total))} disabled={done}>
            <Icon d={ICONS.last} />
          </CtlButton>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/50 tabular-nums">
            Paso {idx} / {total}
          </span>
          <div className="flex rounded-xl bg-white/8 p-1" role="group" aria-label="Velocidad">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
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
      </div>

      <div className="min-h-[3.25rem] rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className={current ? 'text-white/90' : 'text-white/45'}
          >
          {current ? current.text.replace(/\berror\b/g, ERROR_SYMBOL) : 'Pulsa reproducir para ver cómo se construye el autómata, estado por estado.'}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}