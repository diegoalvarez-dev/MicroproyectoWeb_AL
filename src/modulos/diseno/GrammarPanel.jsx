import { motion } from 'framer-motion'

// Gramática regular lineal por la derecha que sale del autómata diseñado.
export default function GrammarPanel({ grammar }) {
  if (!grammar) return null
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass space-y-4 p-5"
      aria-label="Gramática del autómata"
      data-testid="grammar"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          Gramática <span className="grad-text">regular</span>
        </h2>
        <span className="text-xs text-white/45">lineal por la derecha, equivalente al autómata</span>
      </div>

      <p className="sym rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{grammar.text}</p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/80">Producciones (P)</h3>
          <ul className="sym space-y-1.5 text-sm" data-testid="grammar-lines">
            {grammar.lines.map((l) => (
              <li key={l} className="rounded-lg bg-white/5 px-3 py-1.5 text-white/90">
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/80">Cada variable es un estado</h3>
          <ul className="space-y-1.5 text-sm">
            {grammar.mapping.map((m) => (
              <li key={m.variable} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-white/75">
                <span className="sym grid h-6 min-w-6 place-items-center rounded-md bg-cyan-300/15 text-cyan-100">
                  {m.variable}
                </span>
                <span>→ estado</span>
                <span className="sym text-white/90">{m.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-white/45">
        A → aB significa: estando en el estado A y leyendo a se pasa a B. A → ε significa que A es un estado final (la
        palabra puede terminar ahí). El estado error se omite: no genera palabras.
      </p>
    </motion.section>
  )
}