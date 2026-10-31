import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SpecBuilder from "./SpecBuilder.jsx";
import DesignPanel, { KindPicker } from "./DesignPanel.jsx";
import FormalStructure from "../../compartido/componentes/FormalStructure.jsx";
import AutomatonCanvas from "../../compartido/componentes/AutomatonCanvas.jsx";
import PanZoom from "../../compartido/componentes/PanZoom.jsx";
import StepPlayer from "../../compartido/componentes/StepPlayer.jsx";
import WordTester from "../../compartido/componentes/WordTester.jsx";
import WordRunOverlay from "../../compartido/componentes/WordRunOverlay.jsx";
import TransitionTable from "../../compartido/componentes/TransitionTable.jsx";
import HistoryPanel from "../../compartido/componentes/HistoryPanel.jsx";
import { Segmented } from "../../compartido/componentes/ui.jsx";
import PracticePanel from "./PracticePanel.jsx";
import { api } from "./api.js";
import { computeLayout } from "../../compartido/lib/layout.js";
import { runHighlight } from "../../compartido/lib/highlight.js";
import { tableOf } from "../../compartido/lib/table.js";
import { useWordRun } from "../../compartido/lib/useWordRun.js";
import {
  blankSpec,
  defaultSpec,
  specKey,
  toUi,
} from "../../compartido/lib/spec.js";
import { loadHistory, saveHistory } from "../../compartido/lib/history.js";

const EMPTY_VALIDATION = {
  ok: false,
  errors: [],
  warnings: [],
  text: [],
  examples: { valid: [], invalid: [] },
  loading: true,
};
const NO_HIGHLIGHT = { nodes: {}, edges: {} };

function EmptyCanvas() {
  return (
    <div className="grid min-h-[320px] place-items-center px-6 py-12 text-center">
      <div className="space-y-4">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          className="mx-auto"
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="rgba(139,156,255,.5)"
            strokeWidth="3"
            strokeDasharray="10 10"
            className="orbit"
          />
          <circle
            cx="60"
            cy="60"
            r="26"
            fill="none"
            stroke="rgba(34,211,238,.5)"
            strokeWidth="2.5"
          />
          <path
            d="M6 60h14"
            stroke="#22d3ee"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div>
          <p className="text-lg font-semibold">Aquí aparecerá tu autómata</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-white/50">
            Registra las indicaciones (o genera un ejercicio), elige AFD o AFND
            en el panel de arriba y pulsa «Diseñar». Verás cómo se crea cada
            estado y hacia dónde sale cada símbolo.
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/50">
      <li className="flex items-center gap-1.5">
        <svg width="26" height="10" aria-hidden="true">
          <path d="M1 5h18" stroke="#8b9cff" strokeWidth="2" />
          <path d="M16 1l8 4-8 4z" fill="#8b9cff" />
        </svg>
        estado inicial
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="20" height="20" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="8.5"
            fill="none"
            stroke="#8b9cff"
            strokeWidth="1.6"
          />
          <circle
            cx="10"
            cy="10"
            r="5"
            fill="none"
            stroke="#8b9cff"
            strokeWidth="1.6"
          />
        </svg>
        estado final (doble círculo)
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 rounded-full border-2"
          style={{ borderColor: "#b4637a" }}
        />
        estado error (rizo con todo el alfabeto)
      </li>
    </ul>
  );
}

export default function DesignerModule() {
  const [spec, setSpecRaw] = useState(defaultSpec);
  const [registered, setRegistered] = useState(null); // indicaciones registradas: con ellas se diseña
  const [kind, setKind] = useState("AFD");
  const [source, setSource] = useState("manual");
  const [lastLevel, setLastLevel] = useState("facil");
  const [flash, setFlash] = useState(0);
  const [validation, setValidation] = useState(EMPTY_VALIDATION);
  const [built, setBuilt] = useState(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // velocidad de la creación del autómata
  const [wordSpeed, setWordSpeed] = useState(1); // velocidad del recorrido de una palabra
  const [view, setView] = useState("design"); // 'design' | 'practice'
  const wr = useWordRun(wordSpeed); // recorrido de la palabra (con pausa y avance manual)
  const { run, setRun } = wr;
  const [busy, setBusy] = useState(null); // 'build' | 'generate' | 'word'
  const [netError, setNetError] = useState("");
  const [full, setFull] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const buildCounter = useRef(0);

  const updateSpec = useCallback((next) => {
    setSpecRaw(next);
    setSource("manual");
  }, []);

  const stale = !!built && built.key !== specKey(spec, kind);
  const registerState = !registered
    ? "none"
    : specKey(registered, "R") === specKey(spec, "R")
      ? "done"
      : "stale";

  // ---- validación en vivo (backend) ------------------------------------
  useEffect(() => {
    let cancelled = false;
    setValidation((v) => ({ ...v, loading: true }));
    const t = setTimeout(async () => {
      try {
        const r = await api.validate(spec);
        if (cancelled) return;
        setValidation({ ...r, loading: false });
        setNetError("");
      } catch {
        if (cancelled) return;
        setValidation((v) => ({ ...v, ok: false, loading: false }));
        setNetError(
          "No se pudo conectar con el backend. ¿Está corriendo «npm run dev:api»?",
        );
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [spec]);

  // ---- reproducción de la creación -------------------------------------
  useEffect(() => {
    if (!playing || !built) return;
    if (idx >= built.steps.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => i + 1), 1000 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, built]);

  // si las indicaciones cambian, el recorrido anterior ya no corresponde
  useEffect(() => {
    if (stale) setRun(null);
  }, [stale]);

  // pantalla completa: Esc la cierra y la página de atrás no se desplaza
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  // ---- acciones ---------------------------------------------------------
  const pushHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.key !== entry.key)].slice(
        0,
        40,
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const build = useCallback(
    async (useSpec, useKind, useSource) => {
      setBusy("build");
      setRun(null);
      try {
        const r = await api.build(useSpec, useKind);
        if (!r.ok || !r.automaton) {
          setValidation((v) => ({ ...v, ...r, loading: false }));
          return;
        }
        const key = specKey(useSpec, useKind);
        buildCounter.current += 1;
        setBuilt({
          uid: buildCounter.current,
          automaton: r.automaton,
          steps: r.steps,
          text: r.text,
          grammar: r.grammar,
          spec: useSpec,
          kind: useKind,
          key,
        });
        setIdx(0);
        setPlaying(true);
        setNetError("");
        pushHistory({
          id: Date.now(),
          key,
          ts: Date.now(),
          kind: useKind,
          source: useSource,
          spec: useSpec,
          text: r.text,
        });
      } catch {
        setNetError("No se pudo diseñar el autómata: el backend no respondió.");
      } finally {
        setBusy(null);
      }
    },
    [pushHistory],
  );

  const handleGenerate = async (level, alphabetKind) => {
    setBusy("generate");
    try {
      const r = await api.generate(level, alphabetKind);
      const generated = toUi(r.spec);
      setSpecRaw(generated);
      setRegistered(generated); // un ejercicio generado ya viene válido: queda registrado
      setView("design"); // se ve de una vez el lado del autómata diseñado
      setSource(level);
      setLastLevel(level);
      setFlash((f) => f + 1);
      setNetError("");
    } catch {
      setNetError("No se pudo generar el ejercicio: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  // «Limpiar campos»: deja el formulario vacío y quita el diagrama y la palabra de prueba
  const handleClear = () => {
    setSpecRaw(blankSpec());
    setRegistered(null);
    setSource("manual");
    setBuilt(null);
    setRun(null);
    setIdx(0);
    setPlaying(false);
    setFull(false);
    setNetError("");
    setFlash((f) => f + 1);
  };

  const handleRunWord = async (word) => {
    if (!built || stale) return;
    setBusy("word");
    setPlaying(false);
    setIdx(built.steps.length);
    try {
      const r = await api.checkWord(built.spec, built.kind, word);
      if (r.ok) wr.start(r);
    } catch {
      setNetError("No se pudo validar la palabra: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  const loadFromHistory = (item) => {
    const s = toUi(item.spec);
    setSpecRaw(s);
    setRegistered(s);
    setKind(item.kind);
    setSource(item.source);
    if (item.source !== "manual") setLastLevel(item.source);
    setFlash((f) => f + 1);
    build(s, item.kind, item.source);
  };

  // ---- derivados --------------------------------------------------------
  const layout = useMemo(
    () => (built ? computeLayout(built.automaton) : null),
    [built],
  );

  const visible = useMemo(() => {
    const states = new Set();
    const edges = new Map();
    let last = null;
    if (built) {
      built.steps.slice(0, idx).forEach((s) => {
        last = s;
        if (s.kind === "state") states.add(s.state);
        else {
          const key = `${s.from}->${s.to}`;
          edges.set(key, [...(edges.get(key) || []), s.symbol]);
        }
      });
    }
    return { states, edges, last };
  }, [built, idx]);

  const highlight = useMemo(
    () => (run ? runHighlight(run) : NO_HIGHLIGHT),
    [run],
  );
  const canTest = !!built && !stale && idx >= built.steps.length;

  return (
    <main className="mx-auto grid max-w-[1500px] gap-6 px-4 pb-10 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
      <aside className="scroll-thin lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <SpecBuilder
          spec={spec}
          onChange={updateSpec}
          validation={validation}
          onRegister={() => setRegistered(spec)}
          registerState={registerState}
          onGenerate={handleGenerate}
          generating={busy === "generate"}
          onClear={handleClear}
          lastLevel={lastLevel}
          flash={flash}
          source={source}
        />
      </aside>

      <section className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={view}
            onChange={setView}
            label="Qué quieres hacer"
            options={[
              { value: "design", label: "Ver el autómata diseñado" },
              { value: "practice", label: "Practicar: dibujar el mío" },
            ]}
          />
          <p className="text-xs text-white/45">
            {view === "design"
              ? "El proyecto diseña el autómata a partir de las indicaciones."
              : "Tú dibujas el autómata y el proyecto comprueba si cumple las indicaciones."}
          </p>
        </div>

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

        {/* ------------------------- modo: ver el autómata diseñado ------------------------- */}
        <div className={view === "design" ? "space-y-6" : "hidden"}>
          <DesignPanel
            kind={kind}
            onKind={setKind}
            registerState={registerState}
            text={validation.text}
            onBuild={() => registered && build(registered, kind, source)}
            building={busy === "build"}
          />

          {/* La validación de palabras va ARRIBA, encima del diagrama, para ver el recorrido de inmediato. */}
          {built && (
            <WordTester
              key={flash}
              enabled={canTest}
              stale={stale}
              examples={validation.examples}
              run={run}
              onRun={handleRunWord}
              onClear={() => setRun(null)}
              busy={busy === "word"}
              speed={wordSpeed}
              onSpeed={setWordSpeed}
            />
          )}

          <div
            className={
              full
                ? "fixed inset-0 z-50 m-0! flex flex-col gap-3 overflow-y-auto bg-[#060919] p-4"
                : "glass overflow-hidden p-5"
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">
                {built ? (
                  <>
                    <span className="grad-text">{built.kind}</span> diseñado
                  </>
                ) : (
                  "Diagrama de transición"
                )}
              </h2>
              {built && (
                <span className="text-xs text-white/45">
                  {built.automaton.states.length} estados · Σ = {"{"}
                  {built.automaton.alphabet.join(", ")}
                  {"}"}
                </span>
              )}
            </div>

            {built && layout ? (
              <>
                <PanZoom
                  bounds={layout.bounds}
                  resetKey={`${built.uid}-${full}`}
                  expanded={full}
                  onToggleExpand={() => setFull((v) => !v)}
                  title={`Diagrama de transición del ${built.kind}`}
                  overlay={
                    <WordRunOverlay
                      wr={wr}
                      speed={wordSpeed}
                      onSpeed={setWordSpeed}
                    />
                  }
                  className={full ? "min-h-0 flex-1" : "h-[460px] sm:h-[560px]"}
                >
                  <AutomatonCanvas
                    automaton={built.automaton}
                    layout={layout}
                    visible={visible}
                    highlight={highlight}
                    last={run ? null : visible.last}
                  />
                </PanZoom>
                {built.automaton.note && (
                  <p className="rounded-lg bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    {built.automaton.note}
                  </p>
                )}
                <Legend />
                <StepPlayer
                  steps={built.steps}
                  idx={idx}
                  setIdx={setIdx}
                  playing={playing}
                  setPlaying={setPlaying}
                  speed={speed}
                  setSpeed={setSpeed}
                />
              </>
            ) : (
              <EmptyCanvas />
            )}
          </div>

          {/* La tabla de transición y la formalización aparecen al terminar de crear el autómata */}
          {built && idx >= built.steps.length && (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="glass p-5">
                <TransitionTable
                  testId="design-table"
                  title={`Tabla de transición del ${built.kind}`}
                  alphabet={built.automaton.alphabet}
                  rows={tableOf(built.automaton)}
                  cellTone={(s, a) =>
                    built.automaton.transitions.find((t) => t.from === s && t.symbol === a)?.to.length > 1 ? 'nd' : undefined
                  }
                  caption="→ estado inicial · estado dentro de un círculo = terminal (final) · ∅ = sin flecha (va al estado ξ, el error)."
                />
              </section>
              <FormalStructure name={built.kind} automaton={built.automaton} testId="formal-design" />
            </div>
          )}

          <HistoryPanel
            items={history}
            onLoad={loadFromHistory}
            onDelete={(id) =>
              setHistory((prev) => {
                const next = prev.filter((h) => h.id !== id);
                saveHistory(next);
                return next;
              })
            }
            onClear={() => {
              setHistory([]);
              saveHistory([]);
            }}
          />
        </div>

        {/* ------------------------- modo: practicar ------------------------- */}
        <div className={view === "practice" ? "space-y-6" : "hidden"}>
          <section
            className="glass space-y-3 p-5"
            aria-label="Tipo de autómata a practicar"
          >
            <h3 className="font-semibold">
              ¿Qué tipo de autómata quieres dibujar?
            </h3>
            <KindPicker kind={kind} onKind={setKind} />
          </section>
          <PracticePanel
            spec={spec}
            kind={kind}
            validation={validation}
            specOk={validation.ok && !validation.loading}
          />
        </div>
      </section>
    </main>
  );
}
