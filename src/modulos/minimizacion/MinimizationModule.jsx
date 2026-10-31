import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AutomatonCanvas from "../../compartido/componentes/AutomatonCanvas.jsx";
import FormalStructure from "../../compartido/componentes/FormalStructure.jsx";
import HistoryPanel from "../../compartido/componentes/HistoryPanel.jsx";
import PanZoom from "../../compartido/componentes/PanZoom.jsx";
import StepPlayer from "../../compartido/componentes/StepPlayer.jsx";
import TransitionTable, {
  StateBadge,
} from "../../compartido/componentes/TransitionTable.jsx";
import Banner from "../../compartido/componentes/Banner.jsx";
import RegistrationShell, {
  LEVELS as BASE_LEVELS,
} from "../../compartido/componentes/RegistrationShell.jsx";
import { loadHistory, saveHistory } from "../../compartido/lib/history.js";
import {
  computeLayout,
  layoutWithPositions,
} from "../../compartido/lib/layout.js";
import {
  blankNfa,
  describeNfa,
  nfaFromApi,
  nfaKey,
  nfaToApi,
} from "../../compartido/lib/nfa.js";
import { minApi } from "./api.js";
import AnalysisPanel from "./AnalysisPanel.jsx";
import { exampleAfd } from "./example.js";
import PairsTable, { PairsLegend } from "./PairsTable.jsx";
import { highlightOf, inspectPair, minimizationProgress } from "./progress.js";
const MINIMIZER_KEY = "al-micro:minimizer-history:v1";
const NO_HIGHLIGHT = { nodes: {}, edges: {} };
const HINTS = {
  facil: "AFD de 4 estados, 2 símbolos",
  medio: "AFD de 5–6 estados, hasta 3 símbolos",
  dificil: "AFND: se convierte y luego se minimiza",
};
const LEVELS = BASE_LEVELS.map((l) => ({ ...l, hint: HINTS[l.id] }));
// pausa antes de mostrar cada tipo de paso (ms)
const STEP_MS = {
  init: 900,
  terminals: 1400,
  sym: 850,
  decide: 1100,
  review_start: 1100,
  review: 1500,
  review_final: 1300,
  done: 900,
};

const fullyVisible = (automaton, layout) => ({
  states: new Set(automaton.states.map((s) => s.id)),
  edges: new Map(layout.edges.map((e) => [e.key, e.symbols])),
  last: null,
});

function Diagram({
  automaton,
  layout,
  highlight = NO_HIGHLIGHT,
  resetKey,
  className = "h-[360px]",
  title,
  footer,
}) {
  const visible = useMemo(
    () => fullyVisible(automaton, layout),
    [automaton, layout],
  );
  return (
    <PanZoom
      bounds={layout.bounds}
      resetKey={resetKey}
      className={className}
      title={title}
      footer={footer}
    >
      <AutomatonCanvas
        automaton={automaton}
        layout={layout}
        visible={visible}
        highlight={highlight}
        last={null}
      />
    </PanZoom>
  );
}

export default function MinimizationModule({ onOpenConverter }) {
  const [nfa, setNfaRaw] = useState(exampleAfd);
  const [source, setSource] = useState("manual");
  const [lastLevel, setLastLevel] = useState("facil");
  const [genKind, setGenKind] = useState("random");
  const [flash, setFlash] = useState(0);
  const [validation, setValidation] = useState({
    ok: false,
    errors: [],
    warnings: [],
    loading: true,
    key: "",
  });
  const [registered, setRegistered] = useState(null);
  const [result, setResult] = useState(null); // minimización en curso o terminada
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState(null); // notación (X, F o P) cuyos pares se están viendo
  const [inspect, setInspect] = useState(null); // par elegido para consultar: { key, at }
  const [busy, setBusy] = useState(null); // 'register' | 'minimize' | 'generate' | 'word'
  const [netError, setNetError] = useState("");
  const [history, setHistory] = useState(() => loadHistory(MINIMIZER_KEY));
  const registeredRef = useRef(null);
  const analysisRef = useRef(null);
  const resultRef = useRef(null);

  const key = useMemo(() => nfaKey(nfa), [nfa]);
  const updateNfa = useCallback((next) => {
    setNfaRaw(next);
    setSource("manual");
  }, []);
  const staleRegistered = !!registered && registered.key !== key;

  // ---- validación en vivo ----
  useEffect(() => {
    let cancelled = false;
    setValidation((v) => ({ ...v, loading: true }));
    const t = setTimeout(async () => {
      try {
        const r = await minApi.validate(nfa);
        if (cancelled) return;
        setValidation({ ...r, loading: false, key });
        setNetError("");
      } catch {
        if (cancelled) return;
        setValidation((v) => ({ ...v, ok: false, loading: false, key }));
        setNetError(
          "No se pudo conectar con el backend. ¿Está corriendo «npm run dev:api»?",
        );
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ---- reproducción ----
  useEffect(() => {
    if (!playing || !result) return undefined;
    if (idx >= result.steps.length) {
      setPlaying(false);
      return undefined;
    }
    const t = setTimeout(
      () => setIdx((i) => i + 1),
      (STEP_MS[result.steps[idx].kind] || 900) / speed,
    );
    return () => clearTimeout(t);
  }, [playing, idx, speed, result]);

  // las notaciones solo se pueden consultar con la animación en pausa o terminada
  useEffect(() => {
    if (playing) setNote(null);
  }, [playing]);

  // el análisis de un par elegido solo vale con la animación en pausa y en el mismo paso
  useEffect(() => {
    setInspect(null);
  }, [playing, idx, result]);

  useEffect(() => {
    if (registered)
      registeredRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
  }, [registered]);
  useEffect(() => {
    if (result)
      analysisRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
  }, [result]);

  // ---- acciones ----
  const pushHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.key !== entry.key)].slice(
        0,
        40,
      );
      saveHistory(next, MINIMIZER_KEY);
      return next;
    });
  }, []);

  const resetResults = () => {
    setRegistered(null);
    setResult(null);
    setIdx(0);
    setPlaying(false);
  };

  const registerWith = async (n, useSource) => {
    setBusy("register");
    try {
      const r = await minApi.validate(n);
      if (!r.ok) {
        setValidation({ ...r, loading: false, key: nfaKey(n) });
        return;
      }
      setResult(null);
      setIdx(0);
      setPlaying(false);
      setRegistered({ key: nfaKey(n), nfa: n, ...r });
      setNetError("");
      pushHistory({
        id: Date.now(),
        key: nfaKey(n),
        ts: Date.now(),
        kind: r.kind,
        source: useSource,
        nfa: nfaToApi(n),
        text: describeNfa(n),
      });
    } catch {
      setNetError("No se pudo registrar el autómata: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  const minimize = async () => {
    if (!registered) return;
    setBusy("minimize");
    try {
      const r = await minApi.run(registered.nfa);
      if (!r.ok || !r.minimal) {
        setNetError(
          (r.errors || ["No se pudo minimizar el autómata."]).join(" "),
        );
        return;
      }
      setResult({ key: registered.key, ...r });
      setIdx(0);
      setPlaying(true);
      setNetError("");
    } catch {
      setNetError("No se pudo minimizar el autómata: el backend no respondió.");
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async (level, alphabetKind) => {
    setBusy("generate");
    try {
      const r = await minApi.generate(level, alphabetKind);
      setNfaRaw(nfaFromApi(r.nfa));
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

  const handleClear = () => {
    setNfaRaw(blankNfa());
    setSource("manual");
    resetResults();
    setNetError("");
    setFlash((f) => f + 1);
  };

  const loadFromHistory = (item) => {
    const n = nfaFromApi(item.nfa);
    setNfaRaw(n);
    setSource(item.source);
    if (item.source !== "manual") setLastLevel(item.source);
    setFlash((f) => f + 1);
    resetResults();
    registerWith(n, item.source);
  };

  // ---- derivados ----
  const regLayout = useMemo(
    () =>
      registered
        ? layoutWithPositions(registered.automaton, registered.nfa.pos)
        : null,
    [registered],
  );
  const dfaLayout = useMemo(
    () => (registered ? computeLayout(registered.dfa.automaton) : null),
    [registered],
  );
  const minLayout = useMemo(
    () => (result ? computeLayout(result.minimal.automaton) : null),
    [result],
  );
  const names = useMemo(
    () => (result ? result.dfa.automaton.states.map((s) => s.id) : []),
    [result],
  );
  const progress = useMemo(
    () => (result ? minimizationProgress(result.steps, idx, names) : null),
    [result, idx, names],
  );
  const finished = !!result && idx >= result.steps.length;
  // análisis del par que el usuario pulsó (notación o casilla): solo en pausa o al terminar
  const view = useMemo(
    () =>
      result && inspect && !playing
        ? inspectPair(result.steps, idx, inspect.key, inspect.at)
        : null,
    [result, inspect, playing, idx],
  );
  const shownLight = useMemo(
    () => (view ? highlightOf(view.pair, view.lines, names) : null),
    [view, names],
  );
  const pickNote = (item) =>
    setInspect({ key: `${item.pair[0]},${item.pair[1]}`, at: item.at });
  const pickCell = (key) => setInspect({ key, at: null });
  const fresh = validation.key === key && !validation.loading;
  const ok = fresh && validation.ok;

  const status = (
    <>
      {fresh &&
        validation.errors.map((e) => (
          <Banner key={e} tone="err">
            ✕ {e}
          </Banner>
        ))}
      {fresh &&
        validation.warnings?.map((w) => (
          <Banner key={w} tone="warn">
            ⚠ {w}
          </Banner>
        ))}
      {ok && validation.kind === "AFD" && (
        <Banner tone="ok">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            ✓ AFD válido
          </p>
          <p>
            Ya es determinista: se puede minimizar directamente.
            {validation.removed?.length > 0 &&
              ` Se descartan los estados inaccesibles: ${validation.removed.join(", ")}.`}
          </p>
        </Banner>
      )}
      {ok && validation.kind === "AFND" && (
        <Banner tone="info">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
            ✓ AFND válido
          </p>
          <p>
            Para minimizar hace falta un AFD, así que este módulo lo convierte
            automáticamente
            {` (quedaría con ${validation.dfa_states} estados)`} y luego lo
            minimiza.
          </p>
        </Banner>
      )}
    </>
  );

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 pb-10">
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

      <RegistrationShell
        ariaLabel="Registro del autómata a minimizar"
        title="Registrar un autómata (AFD o AFND)"
        nfa={nfa}
        onChange={updateNfa}
        source={source}
        levels={LEVELS}
        genKind={genKind}
        setGenKind={setGenKind}
        onGenerate={handleGenerate}
        lastLevel={lastLevel}
        generating={busy === "generate"}
        flash={flash}
        onClear={handleClear}
        status={status}
        primary={{
          label: "Registrar autómata",
          busyLabel: "Registrando…",
          busy: busy === "register",
          disabled: !ok || busy === "register",
          onClick: () => registerWith(nfa, source),
        }}
      />

      {/* ------------------------------ autómata registrado ------------------------------ */}
      {registered && regLayout && dfaLayout && (
        <section
          ref={registeredRef}
          className="glass scroll-mt-4 space-y-4 p-5"
          data-testid="registered"
          aria-label="Autómata registrado"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              <span className="grad-text">{registered.kind}</span> registrado
            </h2>
            {staleRegistered && (
              <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-200">
                Editaste el autómata: pulsa «Registrar autómata» para usar los
                cambios
              </span>
            )}
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <TransitionTable
              testId="reg-table"
              title={`Tabla de transición del ${registered.kind}`}
              alphabet={registered.automaton.alphabet}
              rows={registered.table}
              cellTone={(s, a) =>
                registered.table.find((r) => r.state === s).cells[a].length > 1
                  ? "nd"
                  : undefined
              }
              caption="→ estado inicial · estado dentro de un círculo = terminal (final) · ∅ = sin flecha: ese símbolo va al estado error (ξ)."
            />
            <FormalStructure
              name={registered.kind}
              automaton={registered.automaton}
              testId="formal-reg"
            />
          </div>
          <Diagram
            automaton={registered.automaton}
            layout={regLayout}
            title={`Diagrama de transición del ${registered.kind}`}
            resetKey={registered.key}
            className="h-[460px]"
          />

          {registered.converted && (
            <div
              className="space-y-3 border-t border-white/10 pt-4"
              data-testid="converted"
            >
              <Banner tone="info">
                <p className="font-semibold">
                  Era un AFND: lo convertimos a AFD para poder minimizarlo.
                </p>
                <p className="mt-0.5 opacity-90">
                  La construcción de subconjuntos dio un AFD de{" "}
                  {registered.dfa_states} estados. Cada estado nuevo es el
                  conjunto de estados del AFND a los que se llega.
                </p>
                {onOpenConverter && (
                  <button
                    type="button"
                    onClick={() => onOpenConverter(nfaToApi(registered.nfa))}
                    className="mt-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                  >
                    Ver la conversión paso a paso (módulo 2) →
                  </button>
                )}
              </Banner>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-3">
                  <TransitionTable
                    testId="dfa-table"
                    title="Tabla de transición del AFD equivalente"
                    alphabet={registered.dfa.automaton.alphabet}
                    rows={registered.dfa.table}
                  />
                  <ul
                    className="flex flex-wrap gap-2 text-sm"
                    data-testid="mapping"
                  >
                    {registered.dfa.mapping.map((m) => (
                      <li
                        key={m.name}
                        className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <StateBadge
                            name={m.name}
                            final={m.final}
                            className="sym min-h-7! min-w-7! text-cyan-200"
                          />
                          <span className="text-white/45">=</span>
                          <span className="sym">
                            {m.members.length
                              ? `{${m.members.join(", ")}}`
                              : "∅"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <FormalStructure
                  name="AFD"
                  automaton={registered.dfa.automaton}
                  testId="formal-dfa"
                />
              </div>
              <Diagram
                automaton={registered.dfa.automaton}
                layout={dfaLayout}
                title="Diagrama de transición del AFD equivalente"
                resetKey={`${registered.key}-dfa`}
                className="h-[460px]"
              />
            </div>
          )}

          {!registered.converted && registered.removed.length > 0 && (
            <Banner tone="warn">
              Estados inaccesibles desde el inicial (
              {registered.removed.join(", ")}): se descartan antes de minimizar.
            </Banner>
          )}

          <button
            type="button"
            onClick={minimize}
            disabled={busy === "minimize"}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
          >
            {busy === "minimize" ? "Minimizando…" : "Minimizar"}
          </button>
        </section>
      )}

      {/* ------------------------------ análisis paso a paso ------------------------------ */}
      {result && progress && dfaLayout && (
        <section
          ref={analysisRef}
          className="glass scroll-mt-4 space-y-4 p-5"
          data-testid="analysis-section"
          aria-label="Análisis de pares"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              Minimización por{" "}
              <span className="grad-text">pares distinguibles</span>
            </h2>
            <span className="text-xs text-white/45">
              AFD de {result.dfa.automaton.states.length} estados · Σ = {"{"}
              {result.dfa.automaton.alphabet.join(", ")}
              {"}"}
            </span>
          </div>
          <PairsLegend
            marks={progress.marks}
            enabled={!playing}
            active={note}
            onPick={setNote}
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <PairsTable
                states={result.dfa.automaton.states}
                marks={progress.marks}
                curKey={shownLight ? shownLight.curKey : progress.curKey}
                refKeys={shownLight ? shownLight.refKeys : progress.refKeys}
                focusMark={note}
                canPick={!playing}
                onPickCell={pickCell}
              />
              <AnalysisPanel
                progress={progress}
                view={view}
                canPick={!playing}
                activeAt={view && inspect ? inspect.at : null}
                onPickNote={pickNote}
                onClearView={() => setInspect(null)}
              />
            </div>
            <div className="min-w-0 space-y-4">
              <TransitionTable
                testId="afd-table"
                title="Tabla de transición del AFD"
                alphabet={result.dfa.automaton.alphabet}
                rows={result.dfa.table}
                rowTone={(s) => (shownLight || progress).rowTone[s]}
                cellTone={(s, a) =>
                  (shownLight || progress).cellTone[`${s}|${a}`]
                }
                caption="Cian: los dos estados del par. Violeta: a dónde llega cada uno con el símbolo que se analiza."
              />
              <Diagram
                automaton={result.dfa.automaton}
                layout={dfaLayout}
                highlight={(shownLight || progress).highlight}
                title="Diagrama de transición del AFD"
                resetKey={result.key}
                className="h-[340px]"
                footer={
                  <div className="rounded-2xl border border-white/15 bg-[#0a1030]/90 p-3">
                    <StepPlayer
                      steps={result.steps}
                      idx={idx}
                      setIdx={setIdx}
                      playing={playing}
                      setPlaying={setPlaying}
                      speed={speed}
                      setSpeed={setSpeed}
                    />
                  </div>
                }
              />
            </div>
          </div>

          <div className="sticky bottom-3 z-30 rounded-2xl border border-white/15 bg-[#0a1030]/90 p-3 shadow-2xl shadow-black/50 backdrop-blur">
            <StepPlayer
              steps={result.steps}
              idx={idx}
              setIdx={setIdx}
              playing={playing}
              setPlaying={setPlaying}
              speed={speed}
              setSpeed={setSpeed}
            />
          </div>
        </section>
      )}

      {/* ------------------------------ AFD minimizado ------------------------------ */}
      {result && finished && minLayout && (
        <motion.section
          ref={resultRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass space-y-4 p-5"
          data-testid="minimal"
          aria-label="AFD minimizado"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              AFD <span className="grad-text">minimizado</span> (AFDM)
            </h2>
            <span
              className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-200"
              data-testid="stats"
            >
              {result.stats.before} → {result.stats.after} estados
            </span>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm" data-testid="classes">
            {result.minimal.mapping.map((m) => (
              <li
                key={m.name}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5"
              >
                <span className="inline-flex items-center gap-1.5">
                  <StateBadge
                    name={m.name}
                    final={m.final}
                    className="sym min-h-8! min-w-8! text-cyan-200"
                  />
                  <span className="text-white/45">=</span>
                  <span className="sym">{`{${m.members.join(", ")}}`}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <TransitionTable
              testId="min-table"
              title="Tabla de transición del AFDM"
              alphabet={result.minimal.automaton.alphabet}
              rows={result.minimal.table}
              caption={
                result.stats.before === result.stats.after
                  ? "Ningún par se fusionó: el AFD ya era mínimo."
                  : "Cada estado del AFDM agrupa los estados equivalentes que se fusionaron."
              }
            />
            <FormalStructure
              name="AFDM"
              automaton={result.minimal.automaton}
              testId="formal-min"
            />
          </div>
          <Diagram
            automaton={result.minimal.automaton}
            layout={minLayout}
            title="Diagrama de transición del AFDM"
            resetKey={`${result.key}-min`}
            className="h-[460px]"
          />
        </motion.section>
      )}

      <HistoryPanel
        items={history}
        emptyText="Cada autómata que registres queda guardado aquí, en este navegador, para retomarlo cuando quieras."
        onLoad={loadFromHistory}
        onDelete={(id) =>
          setHistory((prev) => {
            const next = prev.filter((h) => h.id !== id);
            saveHistory(next, MINIMIZER_KEY);
            return next;
          })
        }
        onClear={() => {
          setHistory([]);
          saveHistory([], MINIMIZER_KEY);
        }}
      />
    </main>
  );
}
