import { AnimatePresence, motion } from 'framer-motion'

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

export default function StepPlayer({ steps, idx, setIdx, playing, setPlaying, speed, setSpeed }) {
  const total = steps.length
  const current = idx > 0 ? steps[idx - 1] : null
  const done = idx >= total

  const pauseAnd = (fn) => () => {
    setPlaying(false)
    fn()
  }
  const togglePlay = () => {
    if (playing) return setPlaying(false)
    if (done) setIdx(0)
    setPlaying(true)
  }

  return (
    <div className="space-y-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
          animate={{ width: `${total ? (idx / total) * 100 : 0}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

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
            {current ? current.text : 'Pulsa reproducir para ver cómo se construye el autómata, estado por estado.'}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
