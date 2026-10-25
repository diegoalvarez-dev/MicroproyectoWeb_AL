import { useMemo, useRef, useState } from 'react'
import { R, layoutWithPositions } from '../lib/layout.js'
import {
  CANVAS,
  MAX_NFA_STATES,
  addState,
  clearEdge,
  edgeSymbols,
  nameProblem,
  nextFreeName,
  nfaForDrawing,
  rearrange,
  removeState,
  renameState,
  toggleFinal,
  toggleTarget,
} from '../lib/nfa.js'
import { Chip, secondaryBtn } from './ui.jsx'

const TOOLS = [
  { id: 'move', label: 'Mover', hint: 'Arrastra los estados para acomodarlos. Haz clic en una flecha para editar sus símbolos.' },
  { id: 'state', label: 'Estado', hint: 'Elige la letra del estado y haz clic en un espacio vacío del dibujo para colocarlo.' },
  { id: 'edge', label: 'Flecha', hint: 'Haz clic en el estado de origen y luego en el de destino; después eliges los símbolos.' },
  { id: 'initial', label: 'Inicial', hint: 'Haz clic en el estado que será el inicial: recibe la flecha de entrada.' },
  { id: 'final', label: 'Final', hint: 'Haz clic en un estado para marcarlo o desmarcarlo como final (doble círculo).' },
  { id: 'rename', label: 'Renombrar', hint: 'Haz clic en un estado para cambiarle la letra.' },
  { id: 'delete', label: 'Borrar', hint: 'Haz clic en un estado o en una flecha para borrarlo.' },
]
const CURSOR = {
  move: 'cursor-default',
  state: 'cursor-crosshair',
  edge: 'cursor-pointer',
  initial: 'cursor-pointer',
  final: 'cursor-pointer',
  rename: 'cursor-pointer',
  delete: 'cursor-pointer',
}

const BASE = '#8b9cff'
const CYAN = '#22d3ee'
const AMBER = '#fbbf24'
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/**
 * Registro por dibujo: círculos para los estados (con la letra que elija el usuario),
 * flechas con símbolos, la flecha del estado inicial y el doble círculo de los finales.
 * Edita el mismo modelo que el formulario.
 *
 * La barra que está entre las herramientas y el dibujo tiene altura fija: ahí aparecen
 * la ayuda, la letra del estado nuevo, el cambio de nombre y los símbolos de una flecha,
 * así el dibujo no se mueve mientras se trabaja.
 */
export default function NfaDrawer({ nfa, onChange }) {
  const svgRef = useRef(null)
  const drag = useRef(null)
  const [tool, setToolRaw] = useState(nfa.states.length ? 'move' : 'state')
  const [pending, setPending] = useState(null) // estado de origen de una flecha en curso
  const [editing, setEditing] = useState(null) // { from, to } abierto en el panel de símbolos
  const [renaming, setRenaming] = useState(null) // estado que se está renombrando
  const [newName, setNewName] = useState('') // letra del próximo estado ('' = la primera libre)
  const [notice, setNotice] = useState('')

  const layout = useMemo(
    () => (nfa.states.length ? layoutWithPositions(nfaForDrawing(nfa), nfa.pos) : null),
    [nfa],
  )

  const setTool = (id) => {
    setToolRaw(id)
    setPending(null)
    setEditing(null)
    setRenaming(null)
    setNotice('')
  }

  const toSvg = (e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return { x: p.x, y: p.y }
  }

  const editingValid =
    editing && nfa.states.includes(editing.from) && nfa.states.includes(editing.to) ? editing : null
  const renamingValid = renaming && nfa.states.includes(renaming) ? renaming : null

  // letra que se usará para el próximo estado
  const stateName = newName || nextFreeName(nfa)
  const nameIssue = nfa.states.length >= MAX_NFA_STATES ? '' : nameProblem(nfa, stateName)

  const onBackgroundDown = (e) => {
    setPending(null)
    if (tool !== 'state') return
    if (nfa.states.length >= MAX_NFA_STATES) {
      setNotice(`Máximo ${MAX_NFA_STATES} estados.`)
      return
    }
    if (nameIssue) {
      setNotice(nameIssue)
      return
    }
    const p = toSvg(e)
    setNotice('')
    const next = addState(
      nfa,
      { x: Math.round(clamp(p.x, R + 10, CANVAS.w - R - 10)), y: Math.round(clamp(p.y, R + 40, CANVAS.h - R - 40)) },
      stateName,
    )
    onChange(next)
    setNewName(nextFreeName(next, stateName)) // la siguiente letra libre después de la que se acaba de usar
  }

  const onNodeDown = (e, id) => {
    e.stopPropagation()
    setNotice('')
    if (tool === 'move') {
      const p = toSvg(e)
      svgRef.current.setPointerCapture(e.pointerId)
      drag.current = { id, dx: p.x - nfa.pos[id].x, dy: p.y - nfa.pos[id].y }
    } else if (tool === 'edge') {
      if (pending === null) setPending(id)
      else {
        setEditing({ from: pending, to: id })
        setPending(null)
      }
    } else if (tool === 'initial') {
      onChange({ ...nfa, initial: id })
    } else if (tool === 'final') {
      onChange(toggleFinal(nfa, id))
    } else if (tool === 'rename') {
      setRenaming(id)
    } else if (tool === 'delete') {
      onChange(removeState(nfa, id))
    }
  }

  const onEdgeDown = (e, edge) => {
    e.stopPropagation()
    if (tool === 'delete') onChange(clearEdge(nfa, edge.from, edge.to))
    else if (tool === 'move' || tool === 'edge') setEditing({ from: edge.from, to: edge.to })
  }

  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const p = toSvg(e)
    const x = Math.round(clamp(p.x - d.dx, R + 6, CANVAS.w - R - 6))
    const y = Math.round(clamp(p.y - d.dy, R + 6, CANVAS.h - R - 6))
    onChange({ ...nfa, pos: { ...nfa.pos, [d.id]: { x, y } } })
  }
  const onUp = () => {
    drag.current = null
  }

  // letra escrita en la casilla (se toma la última tecla pulsada)
  const typeNewName = (raw) => {
    const ch = raw.slice(-1).toUpperCase()
    if (ch) {
      setNewName(ch)
      setNotice('')
    }
  }
  const typeRename = (raw) => {
    const ch = raw.slice(-1).toUpperCase()
    if (!ch || !renamingValid) return
    const problem = nameProblem(nfa, ch, renamingValid)
    setNotice(problem)
    if (problem) return
    onChange(renameState(nfa, renamingValid, ch))
    setRenaming(ch)
    setEditing(null)
    setPending(null)
  }

  const hint = TOOLS.find((t) => t.id === tool).hint
  const toolHint =
    tool === 'edge' && pending ? `Origen ${pending}: haz clic en el estado de destino (o en el mismo para hacer un rizo).` : hint
  const full = nfa.states.length >= MAX_NFA_STATES

  let bar
  if (editingValid) {
    bar = (
      <div className="flex flex-wrap items-center gap-3" data-testid="edge-panel">
        <p className="text-sm">
          Flecha <span className="sym text-cyan-200">{editingValid.from}</span> →{' '}
          <span className="sym text-cyan-200">{editingValid.to}</span>
          {editingValid.from === editingValid.to && <span className="text-white/50"> (rizo)</span>}: se pasa con
        </p>
        <div className="flex gap-1.5">
          {nfa.alphabet.map((a) => (
            <Chip
              key={a}
              active={edgeSymbols(nfa, editingValid.from, editingValid.to).includes(a)}
              label={`Símbolo ${a} de ${editingValid.from} a ${editingValid.to}`}
              onClick={() => onChange(toggleTarget(nfa, editingValid.from, a, editingValid.to))}
            >
              {a}
            </Chip>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(clearEdge(nfa, editingValid.from, editingValid.to))
              setEditing(null)
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:bg-rose-400/15 hover:text-rose-300"
          >
            Quitar flecha
          </button>
          <button type="button" onClick={() => setEditing(null)} className="btn-primary px-4 py-1.5 text-sm">
            Listo
          </button>
        </div>
      </div>
    )
  } else if (tool === 'rename' && renamingValid) {
    bar = (
      <div className="flex flex-wrap items-center gap-3" data-testid="rename-panel">
        <label className="flex items-center gap-2 text-sm">
          Nueva letra para el estado <span className="sym text-cyan-200">{renamingValid}</span>:
          <input
            value={renamingValid}
            onChange={(e) => typeRename(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Nuevo nombre del estado"
            spellCheck={false}
            autoComplete="off"
            className="field sym w-14 py-1! text-center text-lg"
          />
        </label>
        {notice ? <span className="text-sm text-amber-200">{notice}</span> : <span className="text-sm text-white/45">Escribe la letra que quieras (A–Z).</span>}
        <button
          type="button"
          onClick={() => {
            setRenaming(null)
            setNotice('')
          }}
          className="btn-primary ml-auto px-4 py-1.5 text-sm"
        >
          Listo
        </button>
      </div>
    )
  } else if (tool === 'state') {
    bar = (
      <div className="flex flex-wrap items-center gap-3" data-testid="state-panel">
        <label className="flex items-center gap-2 text-sm">
          Letra del nuevo estado:
          <input
            value={full ? '' : stateName}
            onChange={(e) => typeNewName(e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={full}
            aria-label="Nombre del nuevo estado"
            spellCheck={false}
            autoComplete="off"
            className="field sym w-14 py-1! text-center text-lg disabled:opacity-40"
          />
        </label>
        <span className={`text-sm ${notice || nameIssue || full ? 'text-amber-200' : 'text-white/55'}`}>
          {full
            ? `Ya tienes el máximo de ${MAX_NFA_STATES} estados.`
            : notice || nameIssue || 'Haz clic en un espacio vacío del dibujo para colocarlo.'}
        </span>
      </div>
    )
  } else {
    bar = (
      <p className="text-sm text-white/55" aria-live="polite">
        {notice ? <span className="text-amber-200">{notice}</span> : toolHint}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl bg-black/25 p-1" role="group" aria-label="Herramientas de dibujo">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              aria-pressed={tool === t.id}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tool === t.id ? 'bg-cyan-300/20 text-cyan-100' : 'text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange(rearrange(nfa))}
          disabled={!nfa.states.length}
          className={`${secondaryBtn} py-1.5!`}
          title="Vuelve a acomodar los estados por columnas"
        >
          Ordenar estados
        </button>
        <span className="ml-auto text-xs text-white/40">
          {nfa.states.length} de {MAX_NFA_STATES} estados
        </span>
      </div>

      <div
        data-testid="drawer-bar"
        className="flex min-h-[58px] items-center rounded-xl border border-white/10 bg-black/20 px-4 py-2"
      >
        <div className="w-full">{bar}</div>
      </div>

      {/* el ancho se limita para que el dibujo completo quepa en la altura de la pantalla */}
      <div className="mx-auto w-full" style={{ maxWidth: 'max(560px, calc((100vh - 250px) * 1.7308))' }}>
        <svg
          ref={svgRef}
          data-testid="drawer"
          role="img"
          aria-label="Editor de dibujo del AFND"
          viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
          className={`w-full select-none rounded-2xl border border-white/10 bg-[#070b1f]/70 ${CURSOR[tool]}`}
          style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}`, touchAction: 'none' }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <pattern id="drawer-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.1" fill="rgba(255,255,255,.1)" />
            </pattern>
          </defs>
          <rect data-testid="drawer-bg" width={CANVAS.w} height={CANVAS.h} fill="url(#drawer-grid)" onPointerDown={onBackgroundDown} />

          {!nfa.states.length && (
            <text x={CANVAS.w / 2} y={CANVAS.h / 2} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="18" pointerEvents="none">
              Elige «Estado», escribe su letra y haz clic aquí para colocar el primer estado
            </text>
          )}

          {layout &&
            layout.edges.map((e) => {
              const active = editingValid && editingValid.from === e.from && editingValid.to === e.to
              const color = active ? CYAN : BASE
              return (
                <g key={e.key} data-edge={e.key} onPointerDown={(ev) => onEdgeDown(ev, e)} className="cursor-pointer">
                  <path d={e.path} fill="none" stroke="transparent" strokeWidth={18} />
                  <path d={e.path} fill="none" stroke={color} strokeWidth={active ? 3.2 : 2.2} strokeLinecap="round" />
                  <polygon points={e.arrow} fill={color} />
                  <rect
                    x={e.label.x - e.label.w / 2}
                    y={e.label.y - e.label.h / 2}
                    width={e.label.w}
                    height={e.label.h}
                    rx={12}
                    fill="#060919"
                    fillOpacity={0.94}
                    stroke={color}
                    strokeOpacity={0.75}
                  />
                  <text
                    x={e.label.x}
                    y={e.label.y + 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fill="#f1f3ff"
                    style={{ fontFamily: 'var(--font-mono)' }}
                    pointerEvents="none"
                  >
                    {e.text}
                  </text>
                </g>
              )
            })}

          {layout && layout.initialArrow && (
            <g pointerEvents="none">
              <path d={layout.initialArrow.line} stroke={CYAN} strokeWidth={3} strokeLinecap="round" fill="none" />
              <polygon points={layout.initialArrow.arrow} fill={CYAN} />
            </g>
          )}

          {nfa.states.map((id) => {
            const p = nfa.pos[id]
            const isEnd = editingValid && (editingValid.from === id || editingValid.to === id)
            const color = pending === id || renamingValid === id ? AMBER : isEnd ? CYAN : BASE
            return (
              <g
                key={id}
                data-testid={`node-${id}`}
                onPointerDown={(e) => onNodeDown(e, id)}
                className={tool === 'move' ? 'cursor-grab active:cursor-grabbing' : ''}
              >
                <circle cx={p.x} cy={p.y} r={R} fill="#0d1230" stroke={color} strokeWidth={2.6} />
                {nfa.finals.includes(id) && <circle cx={p.x} cy={p.y} r={R - 6.5} fill="none" stroke={color} strokeWidth={2.2} />}
                <text
                  x={p.x}
                  y={p.y + 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={700}
                  fill="#f1f3ff"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  pointerEvents="none"
                >
                  {id}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}