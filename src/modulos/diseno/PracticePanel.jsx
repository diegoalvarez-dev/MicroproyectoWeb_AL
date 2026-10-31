import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AutomatonCanvas from "../../compartido/componentes/AutomatonCanvas.jsx";
import Banner from "../../compartido/componentes/Banner.jsx";
import NfaDrawer from "../../compartido/componentes/NfaDrawer.jsx";
import NfaForm from "../../compartido/componentes/NfaForm.jsx";
import PanZoom from "../../compartido/componentes/PanZoom.jsx";
import TransitionTable from "../../compartido/componentes/TransitionTable.jsx";
import WordTester from "../../compartido/componentes/WordTester.jsx";
import WordRunOverlay from "../../compartido/componentes/WordRunOverlay.jsx";
import FormalStructure from "../../compartido/componentes/FormalStructure.jsx";
import {
  Section,
  Segmented,
  secondaryBtn,
} from "../../compartido/componentes/ui.jsx";
import { layoutWithPositions } from "../../compartido/lib/layout.js";
import { runHighlight } from "../../compartido/lib/highlight.js";
import { blankNfa, nfaKey, setAlphabet } from "../../compartido/lib/nfa.js";
import { specKey } from "../../compartido/lib/spec.js";
import { useWordRun } from "../../compartido/lib/useWordRun.js";
import { api } from "./api.js";

const NO_HIGHLIGHT = { nodes: {}, edges: {} };

// Autómata vacío (dos estados A y B) con el alfabeto de las indicaciones.
const fresh = (alphabet) => setAlphabet(blankNfa(), [...alphabet]);

function allVisible(automaton, layout) {
  return {
    states: new Set(automaton.states.map((s) => s.id)),
    edges: new Map(layout.edges.map((e) => [e.key, e.symbols])),
    last: null,
  };
}

// Una palabra de contraejemplo que se puede probar con un clic.
function Counter({ title, tone, item, onTry }) {
  const cls =
    tone === "rose"
      ? "border-rose-400/35 bg-rose-400/10"
      : "border-amber-300/35 bg-amber-300/10";
  return (
    <div className={`space-y-1.5 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <p className="font-semibold">{title}</p>
      <p className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onTry(item.word)}
          className="sym rounded-lg border border-white/20 bg-black/25 px-3 py-1 text-base tracking-widest transition hover:bg-white/10"
          title="Probar esta palabra en tu autómata"
        >
          {item.word === "" ? "ε (palabra vacía)" : item.word}
        </button>
        <span className="text-white/70">{item.reason}</span>
      </p>
    </div>
  );
}

/**
 * Modo práctica: el estudiante dibuja (o llena en formulario) el autómata que cree que cumple
 * las indicaciones y el backend dice si es correcto; si no, da la palabra más corta que lo demuestra.
 */
export default function PracticePanel({ spec, kind, validation, specOk }) {
  const [nfa, setNfa] = useState(() => fresh(spec.alphabet));
  const [mode, setMode] = useState("draw");
  const [result, setResult] = useState(null); // { key, data }
  const [speed, setSpeed] = useState(1);
  const wr = useWordRun(speed); // recorrido de la palabra (con pausa y avance manual)
  const { run, setRun } = wr;
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const resultRef = useRef(null);

  const exKey = specKey(spec, kind);
  const alphaKey = spec.alphabet.join("");

  // El alfabeto del autómata del estudiante siempre es el de las indicaciones.
  useEffect(() => {
    setNfa((n) =>
      n.alphabet.join("") === alphaKey ? n : setAlphabet(n, [...spec.alphabet]),
    );
  }, [alphaKey, spec.alphabet]);

  const key = useMemo(() => `${exKey}|${nfaKey(nfa)}`, [exKey, nfa]);
  const stale = !!result && result.key !== key;
  const data = result?.data;
  const shown = data?.ok ? data : null;

  useEffect(() => {
    if (stale) setRun(null);
  }, [stale]);

  const layout = useMemo(
    () => (shown ? layoutWithPositions(shown.automaton, result.pos) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );
  const visible = useMemo(
    () => (shown && layout ? allVisible(shown.automaton, layout) : null),
    [shown, layout],
  );
  const highlight = run ? runHighlight(run) : NO_HIGHLIGHT;

  const check = async () => {
    setBusy("check");
    setRun(null);
    try {
      const r = await api.practiceCheck(spec, kind, nfa);
      setResult({ key, data: r, pos: nfa.pos });
      setError("");
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "start",
          }),
        60,
      );
    } catch {
      setError("No se pudo comprobar el autómata: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  const runWord = async (word) => {
    if (!shown || stale) return;
    setBusy("word");
    try {
      const r = await api.practiceWord(spec, kind, nfa, word);
      if (r.ok) wr.start(r);
    } catch {
      setError("No se pudo validar la palabra: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    setNfa(fresh(spec.alphabet));
    setResult(null);
    setRun(null);
    setError("");
  };

  const examples = validation.examples ?? { valid: [], invalid: [] };
  const counters = shown?.counterexamples;

  const diagram =
    shown && layout && visible ? (
      <div className="min-w-0">
        <PanZoom
          bounds={layout.bounds}
          resetKey={result.key}
          title="Diagrama de transición de tu autómata"
          overlay={<WordRunOverlay wr={wr} speed={speed} onSpeed={setSpeed} />}
          className="h-[400px] sm:h-[460px]"
        >
          <AutomatonCanvas
            automaton={shown.automaton}
            layout={layout}
            visible={visible}
            highlight={highlight}
            last={null}
          />
        </PanZoom>
      </div>
    ) : null;

  return (
    <div className="space-y-6" data-testid="practice">
      <section className="glass space-y-4 p-5" aria-label="Tu autómata">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            Practica: dibuja tu <span className="grad-text">{kind}</span>
          </h2>
          <span className="text-xs text-white/45">
            Σ = {"{"}
            {spec.alphabet.join(", ")}
            {"}"}
          </span>
        </div>

        {specOk ? (
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Indicaciones del ejercicio
            </p>
            <ul
              className="space-y-1 text-sm text-white/85"
              data-testid="practice-text"
            >
              {validation.text.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : (
          <Banner tone="warn">
            Primero deja las indicaciones válidas en el formulario de la
            izquierda (o genera un ejercicio): contra ellas se comprobará tu
            autómata.
          </Banner>
        )}

        <Section
          n="1"
          title="Tu autómata"
          hint="dibujo o formulario: son dos vistas del mismo autómata"
        >
          <Segmented
            value={mode}
            onChange={setMode}
            label="Forma de registro de tu autómata"
            options={[
              { value: "draw", label: "Dibujar" },
              { value: "form", label: "Formulario" },
            ]}
          />
          {mode === "draw" ? (
            <NfaDrawer nfa={nfa} onChange={setNfa} />
          ) : (
            <NfaForm nfa={nfa} onChange={setNfa} />
          )}
          <p className="text-xs text-white/45">
            El alfabeto es el de las indicaciones.{" "}
            {kind === "AFD"
              ? "Se pide un AFD: de cada estado debe salir una sola flecha por símbolo (lo que falte va al estado error, que no se dibuja)."
              : "Se pide un AFND: un símbolo puede salir de un estado hacia varios estados."}
          </p>
        </Section>

        <Section n="2" title="Comprobar">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={check}
              disabled={!specOk || busy === "check"}
              className="btn-primary flex items-center justify-center gap-2 py-3 text-base"
              data-testid="practice-check"
            >
              {busy === "check" ? "Comprobando…" : "Comprobar mi autómata"}
            </button>
            <button type="button" onClick={clear} className={secondaryBtn}>
              Limpiar
            </button>
          </div>
          {error && <Banner tone="err">{error}</Banner>}
        </Section>
      </section>

      <AnimatePresence>
        {data && (
          <motion.section
            ref={resultRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass scroll-mt-4 space-y-4 p-5"
            aria-label="Resultado de la práctica"
            data-testid="practice-result"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Resultado</h2>
              {stale && (
                <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  Cambiaste el autómata o las indicaciones: vuelve a comprobar
                </span>
              )}
            </div>

            {!data.ok && (
              <div className="space-y-2" data-testid="practice-errors">
                {data.errors.map((e) => (
                  <Banner key={e} tone="err">
                    ✕ {e}
                  </Banner>
                ))}
              </div>
            )}

            {shown && (
              <>
                {shown.correct ? (
                  <Banner tone="ok">
                    <p
                      className="text-base font-bold text-emerald-300"
                      data-testid="verdict"
                    >
                      ✔ ¡Correcto! Tu autómata cumple todas las indicaciones.
                    </p>
                    <p className="mt-0.5 text-white/80">
                      Acepta exactamente las palabras que piden las
                      indicaciones, ni una más ni una menos.
                    </p>
                  </Banner>
                ) : (
                  <Banner tone="err">
                    <p className="text-base font-bold" data-testid="verdict">
                      ✘ Todavía no es correcto
                    </p>
                    <p className="mt-0.5 opacity-90">
                      {shown.language_ok
                        ? "Acepta las palabras correctas, pero no es del tipo que piden las indicaciones."
                        : "Hay palabras que tu autómata trata distinto a lo que piden las indicaciones. Pulsa una para probarla."}
                    </p>
                  </Banner>
                )}

                {shown.kind_note && (
                  <Banner tone={shown.kind_ok ? "info" : "err"}>
                    {shown.kind_note}
                  </Banner>
                )}
                {shown.warnings?.map((w) => (
                  <Banner key={w} tone="warn">
                    ⚠ {w}
                  </Banner>
                ))}
                {!shown.complete && !counters?.missing && !counters?.extra && (
                  <Banner tone="warn">
                    El autómata es muy grande para comprobarlo por completo; con
                    las palabras revisadas no se encontró ninguna diferencia.
                  </Banner>
                )}

                {counters?.missing && (
                  <Counter
                    title="Esta palabra debería ser aceptada y tu autómata la rechaza:"
                    tone="amber"
                    item={counters.missing}
                    onTry={runWord}
                  />
                )}
                {counters?.extra && (
                  <Counter
                    title="Esta palabra NO debería ser aceptada y tu autómata la acepta:"
                    tone="rose"
                    item={counters.extra}
                    onTry={runWord}
                  />
                )}
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {shown && layout && (
        <>
          <WordTester
            title="Probar una palabra en tu autómata"
            enabled={!stale}
            stale={stale}
            examples={examples}
            run={run}
            onRun={runWord}
            onClear={() => setRun(null)}
            busy={busy === "word"}
            speed={speed}
            onSpeed={setSpeed}
            disabledHint="Vuelve a comprobar tu autómata"
          />
          <section
            className="glass space-y-3 p-5"
            aria-label="Tu autómata dibujado"
          >
            <h2 className="text-lg font-bold">
              Tu autómata{" "}
              <span className="text-xs font-normal text-white/45">
                ({shown.student_kind})
              </span>
            </h2>
            {diagram}
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <TransitionTable
                testId="practice-table"
                title="Tabla de transición de tu autómata"
                alphabet={shown.automaton.alphabet}
                rows={shown.table}
                caption="→ estado inicial · estado dentro de un círculo = final · ∅ = sin flecha (va al estado ξ, el error)."
              />
              <FormalStructure
                name={shown.student_kind}
                automaton={shown.automaton}
                testId="formal-practice"
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
