import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const MIN_K = 0.12;
const MAX_K = 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const Ico = ({ children }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      {children}
    </button>
  );
}

/**
 * Lienzo que se puede mover (arrastrando con el clic presionado) y ampliar o
 * reducir (rueda del mouse o botones). `bounds` es el rectángulo del dibujo; al
 * cargar un autómata nuevo, o al entrar/salir de pantalla completa (`resetKey`),
 * se encuadra automáticamente para que se vea completo.
 */
export default function PanZoom({
  bounds,
  resetKey,
  expanded,
  onToggleExpand,
  className = "",
  children,
}) {
  const boxRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const touched = useRef(false); // el usuario ya movió o amplió: no reencuadrar solo
  const drag = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const pad = 20;
    const k = clamp(
      Math.min((size.w - pad * 2) / bounds.w, (size.h - pad * 2) / bounds.h),
      MIN_K,
      1.3,
    );
    setView({
      k,
      x: size.w / 2 - (bounds.x + bounds.w / 2) * k,
      y: size.h / 2 - (bounds.y + bounds.h / 2) * k,
    });
  }, [size, bounds]);

  const refit = useCallback(() => {
    touched.current = false;
    fit();
  }, [fit]);

  // autómata nuevo o cambio de pantalla completa: encuadrar de nuevo
  useEffect(() => {
    touched.current = false;
  }, [resetKey]);
  // y mientras el usuario no toque nada, seguir el tamaño del contenedor
  useEffect(() => {
    if (!touched.current) fit();
  }, [fit, resetKey]);

  const zoomAt = useCallback((factor, cx, cy) => {
    touched.current = true;
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      const r = k / v.k;
      return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  }, []);

  // rueda del mouse (listener no pasivo para poder evitar que la página se desplace)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const speed = e.deltaMode === 1 ? 0.05 : 0.0016;
      zoomAt(
        Math.exp(-e.deltaY * speed),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      x: viewRef.current.x,
      y: viewRef.current.y,
    };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    touched.current = true;
    setView((v) => ({
      ...v,
      x: d.x + e.clientX - d.sx,
      y: d.y + e.clientY - d.sy,
    }));
  };
  const onPointerEnd = (e) => {
    if (drag.current && drag.current.id === e.pointerId) {
      drag.current = null;
      setDragging(false);
    }
  };

  const dot = 26 * view.k;
  return (
    <div
      ref={boxRef}
      data-testid="panzoom"
      className={`relative select-none overflow-hidden rounded-2xl border border-white/10 bg-[#070b1f]/70 ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
      style={{
        touchAction: "none",
        backgroundImage:
          dot > 9
            ? "radial-gradient(rgba(255,255,255,.09) 1.2px, transparent 1.2px)"
            : "none",
        backgroundSize: `${dot}px ${dot}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={refit}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Diagrama de transición del autómata"
      >
        <g
          data-testid="panzoom-content"
          transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
        >
          {children}
        </g>
      </svg>

      <div
        className="absolute right-3 top-3 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#0b1030]/90 p-1 shadow-lg backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <ToolButton
          label="Acercar"
          onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)}
        >
          <Ico>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
          </Ico>
        </ToolButton>
        <ToolButton
          label="Alejar"
          onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)}
        >
          <Ico>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3M8 11h6" />
          </Ico>
        </ToolButton>
        <ToolButton label="Ajustar a la pantalla" onClick={refit}>
          <Ico>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </Ico>
        </ToolButton>
        {onToggleExpand && (
          <ToolButton
            label={
              expanded ? "Salir de pantalla completa" : "Pantalla completa"
            }
            onClick={onToggleExpand}
          >
            {expanded ? (
              <Ico>
                <path d="M3 8h3a2 2 0 0 0 2-2V3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M21 16h-3a2 2 0 0 0-2 2v3" />
              </Ico>
            ) : (
              <Ico>
                <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
              </Ico>
            )}
          </ToolButton>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-3 text-[11px] text-white/40">
        <span className="tabular-nums text-white/60">
          {Math.round(view.k * 100)}%
        </span>
        <span>
          Arrastra para mover · rueda para zoom · doble clic para ajustar
        </span>
      </div>
    </div>
  );
}
