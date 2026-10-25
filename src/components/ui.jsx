// Piezas pequeñas de interfaz compartidas por el módulo 2.

export function Section({ n, title, hint, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        {n && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-cyan-300">
            {n}
          </span>
        )}
        <h3 className="font-semibold">{title}</h3>
        {hint && <span className="ml-auto text-xs text-white/40">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export function Chip({ active, onClick, children, label, tone = 'cyan', size = 'md', title }) {
  const on =
    tone === 'cyan'
      ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100 shadow-[0_0_18px_-4px_rgba(34,211,238,.7)]'
      : 'border-violet-300/70 bg-violet-400/20 text-violet-100'
  const dims = size === 'sm' ? 'h-7 min-w-7 rounded-lg px-1.5 text-xs' : 'h-10 min-w-10 rounded-xl px-2 text-base'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={title}
      className={`sym border transition ${dims} ${
        active ? on : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function Segmented({ value, onChange, options, label }) {
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

export const secondaryBtn =
  'flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'