import { useState } from "react";
import { ERROR_SYMBOL, showName } from "../lib/names.js";

/**
 * Estructura formal de un autómata:  AF = ({Qn}, Q0, {Qt}, Σ, ς)
 *   Qn  conjunto de estados · Q0 estado inicial · Qt estados terminales · Σ alfabeto
 *   ς   transiciones: una fila por estado, una columna por símbolo
 */
const set = (items) =>
  items.length ? `{${items.map(showName).join(", ")}}` : "∅";

export function formalOf(automaton) {
  const qn = automaton.states.map((s) => s.id);
  const qt = automaton.states.filter((s) => s.final).map((s) => s.id);
  const line = (t) =>
    `${showName(t.from)},${t.symbol} → ${t.to.length > 1 ? set(t.to) : showName(t.to[0])}`;
  const found = Object.fromEntries(
    automaton.transitions
      .filter((t) => t.to.length)
      .map((t) => [`${t.from}|${t.symbol}`, t]),
  );
  // una fila por estado, una columna por símbolo:   A,0 → B     A,1 → A
  const sigmaRows = automaton.states.map((st) =>
    automaton.alphabet.map((a) =>
      found[`${st.id}|${a}`] ? line(found[`${st.id}|${a}`]) : "",
    ),
  );
  const sigma = sigmaRows.flat().filter(Boolean);
  const errorId = automaton.states.find((s) => s.error) ? ERROR_SYMBOL : null;
  return {
    qn,
    q0: showName(automaton.initial),
    qt,
    alphabet: automaton.alphabet,
    sigma,
    sigmaRows,
    errorId,
  };
}

export function formalText(name, automaton) {
  const f = formalOf(automaton);
  const width = Math.max(0, ...f.sigmaRows.flat().map((c) => c.length));
  return [
    `${name} = (${set(f.qn)}, ${f.q0}, ${set(f.qt)}, ${set(f.alphabet)}, ς)`,
    "ς = {",
    ...f.sigmaRows.map(
      (r) =>
        `  ${r
          .map((c) => c.padEnd(width))
          .join("   ")
          .trimEnd()}`,
    ),
    "}",
  ].join("\n");
}

function Row({ k, title, children }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 sm:grid-cols-[3rem_9rem_minmax(0,1fr)]">
      <dt className="sym text-base font-bold text-cyan-200">{k}</dt>
      <dd className="col-start-2 text-xs text-white/50 sm:col-start-auto">
        {title}
      </dd>
      <dd className="sym col-start-2 break-words text-sm text-white/90 sm:col-start-auto">
        {children}
      </dd>
    </div>
  );
}

export default function FormalStructure({
  name,
  automaton,
  testId = "formal",
  className = "",
}) {
  const [copied, setCopied] = useState(false);
  const f = formalOf(automaton);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formalText(name, automaton));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles: no pasa nada */
    }
  };

  return (
    <section
      data-testid={testId}
      aria-label={`Estructura formal del ${name}`}
      className={`space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          Formalización del <span className="grad-text">{name}</span>
        </h3>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-white/12 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>

      <p
        className="sym scroll-thin overflow-x-auto rounded-xl bg-[#070b1f]/70 px-3 py-2.5 text-[15px] leading-relaxed text-white"
        data-testid={`${testId}-formula`}
      >
        {name} = ({"{"}Qn{"}"}, Q0, {"{"}Qt{"}"}, Σ, ς)
        <span className="text-white/40"> =</span>
        <br />
        <span className="text-cyan-100" data-testid={`${testId}-values`}>
          ({set(f.qn)}, {f.q0}, {set(f.qt)}, {set(f.alphabet)}, ς)
        </span>
      </p>

      <dl className="space-y-2">
        <Row k="Qn" title="Estados (todos los círculos)">
          {set(f.qn)}
          {f.errorId && (
            <span className="font-sans text-xs text-white/45">
              {" "}
              · {f.errorId} es el estado error
            </span>
          )}
        </Row>
        <Row k="Q0" title="Estado inicial">
          {f.q0}
        </Row>
        <Row k="Qt" title="Estados terminales">
          {set(f.qt)}
        </Row>
        <Row k="Σ" title="Alfabeto">
          {set(f.alphabet)}
        </Row>
      </dl>

      <div>
        <p className="mb-1 text-xs text-white/50">
          <span className="sym text-base font-bold text-cyan-200">ς</span> ·
          transiciones (estado, símbolo → destino)
        </p>
        <div
          data-testid={`${testId}-sigma`}
          className="sym scroll-thin max-h-80 overflow-auto rounded-xl bg-[#070b1f]/70 px-3 py-2.5 text-sm leading-relaxed text-white/90"
        >
          <p>ς = {"{"}</p>
          <div
            className="grid gap-x-6 py-0.5 pl-4"
            style={{
              gridTemplateColumns: `repeat(${f.alphabet.length}, max-content)`,
            }}
          >
            {f.sigmaRows.flat().map((c, i) => (
              <span key={i} className="whitespace-pre" data-sigma-cell>
                {c || " "}
              </span>
            ))}
          </div>
          <p>{"}"}</p>
        </div>
      </div>
    </section>
  );
}
