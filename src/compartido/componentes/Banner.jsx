// Aviso de color (error / advertencia / correcto). Lo pueden usar todos los módulos.
const TONES = {
  err: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
  warn: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
  ok: 'border-emerald-300/30 bg-emerald-300/[0.07] text-white/90',
  info: 'border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-50',
}

export default function Banner({ tone = 'info', children }) {
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${TONES[tone]}`}>{children}</div>
}