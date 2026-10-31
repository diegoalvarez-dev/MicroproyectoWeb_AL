import { CHAR_STYLE, charTone } from './WordTester.jsx'

const SPEEDS = [0.5, 1, 2, 4]

const Ico = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
)
const D = {
  first: 'M6 6h2v12H6zM9.5 12 18 6v12z',
  prev: 'M15.5 6 7 12l8.5 6z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  next: 'M8.5 6 17 12l-8.5 6z',
  last: 'M16 6h2v12h-2zM6 6l8.5 6L6 18z',
}

function Btn({ label, onClick, disabled, children, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-30 ${
        primary ? 'bg-cyan-300/25 text-cyan-50 hover:bg-cyan-300/35' : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * La palabra que se está probando, en una esquina de la pantalla completa.
 * Va a la par del recorrido: pausa, paso a paso y clic en una letra para ir a ella.
 *   wr = useWordRun(...)
 */
export default function WordRunOverlay({ wr, speed, onSpeed }) {
  const { run, playing, togglePlay, seek, pos, max } = wr
  if (!run) return null
  const word = run.result.word
  return (
    <div
      data-testid="word-overlay"
      className="absolute bottom-10 right-3 z-10 max-w-[min(560px,calc(100%-1.5rem))] space-y-2 rounded-2xl border border-white/15 bg-[#0b1030]/92 p-3 shadow-xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 text-xs text-white/55">
        <span className="font-semibold text-white/80">Palabra</span>
        {run.finished && (
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold ${
              run.result.valid ? 'bg-emerald-300/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'
            }`}
          >
            {run.result.valid ? '✔ válida' : '✘ inválida'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Recorrido de la palabra">
        {word.length === 0 && <span className="text-sm text-white/45">(palabra vacía)</span>}
        {[...word].map((ch, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(i)}
            title="Ir a este símbolo"
            className={`sym grid h-9 min-w-9 place-items-center rounded-lg border px-1.5 text-base transition-all duration-200 ${
              CHAR_STYLE[charTone(i, run)]
            }`}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Btn label="Volver al inicio de la palabra" onClick={() => seek(0)} disabled={pos === 0}>
          <Ico d={D.first} />
        </Btn>
        <Btn label="Símbolo anterior" onClick={() => seek(pos - 1)} disabled={pos === 0}>
          <Ico d={D.prev} />
        </Btn>
        <Btn label={playing ? 'Pausar la palabra' : pos >= max ? 'Repetir la palabra' : 'Reproducir la palabra'} onClick={togglePlay} primary>
          <Ico d={playing ? D.pause : D.play} />
        </Btn>
        <Btn label="Símbolo siguiente" onClick={() => seek(pos + 1)} disabled={pos >= max}>
          <Ico d={D.next} />
        </Btn>
        <Btn label="Ir al final de la palabra" onClick={() => seek(max)} disabled={pos >= max}>
          <Ico d={D.last} />
        </Btn>
        {onSpeed && (
          <div className="ml-auto flex rounded-lg bg-white/8 p-0.5" role="group" aria-label="Velocidad de la palabra">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSpeed(s)}
                aria-pressed={speed === s}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition ${
                  speed === s ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}