import { motion } from 'framer-motion'

export const KINDS = [
  { id: 'AFD', title: 'AFD', sub: 'Determinista', desc: 'De cada estado sale exactamente una flecha por símbolo.' },
  { id: 'AFND', title: 'AFND', sub: 'No determinista', desc: 'Un símbolo puede salir de un estado hacia uno o más estados.' },
]

// Elegir entre AFD y AFND (se usa en el panel de diseño y en la pestaña de práctica).
export function KindPicker({ kind, onKind }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de autómata">
      {KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          role="radio"
          aria-checked={kind === k.id}
          onClick={() => onKind(k.id)}
          data-testid={`kind-${k.id}`}
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
  )
}

/**
 * Panel de diseño (lado derecho, pestaña «Ver el autómata diseñado»):
 * primero se registran las indicaciones (a la izquierda) y aquí se elige AFD o AFND y se diseña.
 *   registerState: 'none' (sin registrar) | 'stale' (cambiaron después de registrar) | 'done'
 */
export default function DesignPanel({ kind, onKind, registerState, text, onBuild, building }) {
  const ready = registerState === 'done'
  return (
    <section className="glass space-y-4 p-5" aria-label="Diseñar el autómata" data-testid="design-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Diseñar el autómata</h2>
        <span
          data-testid="register-status"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ready
              ? 'bg-emerald-300/15 text-emerald-200'
              : registerState === 'stale'
                ? 'bg-amber-300/15 text-amber-200'
                : 'bg-white/10 text-white/60'
          }`}
        >
          {ready
            ? '✓ Indicaciones registradas'
            : registerState === 'stale'
              ? 'Cambiaste las indicaciones: vuelve a registrarlas'
              : 'Aún no hay indicaciones registradas'}
        </span>
      </div>

      {ready && text?.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] px-4 py-3 text-sm text-white/85"
        >
          {text.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </motion.ul>
      )}
      {!ready && (
        <p className="text-sm text-white/55">
          Registra las indicaciones en el formulario (o genera un ejercicio) y después elige aquí qué autómata quieres que
          el proyecto diseñe.
        </p>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/80">¿Qué tipo de autómata?</h3>
        <KindPicker kind={kind} onKind={onKind} />
      </div>

      <button
        type="button"
        onClick={onBuild}
        disabled={!ready || building}
        className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
        </svg>
        {building ? 'Diseñando…' : `Diseñar ${kind}`}
      </button>
    </section>
  )
}