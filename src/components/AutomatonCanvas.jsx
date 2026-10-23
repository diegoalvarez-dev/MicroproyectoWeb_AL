import { motion } from 'framer-motion'
import { R } from '../lib/layout.js'

// Colores por estado de la animación
export const TONES = {
  base: '#8b9cff',
  new: '#fbbf24', // lo que acaba de crearse
  cur: '#22d3ee', // paso actual del recorrido de una palabra
  ok: '#34d399', // recorrido correcto
  bad: '#fb7185', // recorrido que falla
  error: '#b4637a', // estado error y flechas hacia él
}
const NODE_FILL = '#0d1230'
const glow = (tone) => (tone === 'base' || tone === 'error' ? undefined : `drop-shadow(0 0 7px ${TONES[tone]})`)

function Edge({ edge, symbols, tone }) {
  const color = TONES[tone]
  const text = symbols.join(',')
  const w = Math.max(28, text.length * 9.5 + 16)
  const strong = tone !== 'base' && tone !== 'error'
  return (
    <g style={{ filter: glow(tone) }}>
      <motion.path
        d={edge.path}
        fill="none"
        stroke={color}
        strokeWidth={strong ? 3.4 : 2.2}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <motion.polygon
        points={edge.arrow}
        fill={color}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.2 }}
      />
      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.25 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <rect
          x={edge.label.x - w / 2}
          y={edge.label.y - edge.label.h / 2}
          width={w}
          height={edge.label.h}
          rx={12}
          fill="#060919"
          fillOpacity={0.94}
          stroke={color}
          strokeOpacity={0.75}
        />
        <text
          x={edge.label.x}
          y={edge.label.y + 5}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="#f1f3ff"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {text}
        </text>
      </motion.g>
    </g>
  )
}

function Node({ id, pos, state, tone }) {
  const color = TONES[tone]
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center', filter: glow(tone) }}
    >
      <circle
        cx={pos.x}
        cy={pos.y}
        r={R}
        fill={state.error ? '#1a0b1c' : NODE_FILL}
        stroke={color}
        strokeWidth={2.6}
      />
      {state.final && (
        <circle cx={pos.x} cy={pos.y} r={R - 6.5} fill="none" stroke={color} strokeWidth={2.2} />
      )}
      <text
        x={pos.x}
        y={pos.y + 5}
        textAnchor="middle"
        fontSize={state.error ? 13 : 17}
        fontWeight={700}
        fill="#f1f3ff"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {id}
      </text>
    </motion.g>
  )
}

// Dibuja el contenido (estados y flechas); el <svg> y el zoom los pone PanZoom.
export default function AutomatonCanvas({ automaton, layout, visible, highlight, last }) {
  const byId = Object.fromEntries(automaton.states.map((s) => [s.id, s]))

  const nodeTone = (id) => {
    if (highlight.nodes[id]) return highlight.nodes[id]
    if (last && last.kind === 'state' && last.state === id) return 'new'
    return byId[id].error ? 'error' : 'base'
  }
  const edgeTone = (e) => {
    if (highlight.edges[e.key]) return highlight.edges[e.key]
    if (last && last.kind === 'edge' && `${last.from}->${last.to}` === e.key) return 'new'
    return e.to === automaton.error ? 'error' : 'base'
  }

  const showInitial = visible.states.has(automaton.initial)
  const initTone = nodeTone(automaton.initial)

  return (
    <>
      {layout.edges.map((e) => {
        const symbols = visible.edges.get(e.key)
        if (!symbols) return null
        return <Edge key={e.key} edge={e} symbols={symbols} tone={edgeTone(e)} />
      })}

      {showInitial && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <path d={layout.initialArrow.line} stroke={TONES[initTone]} strokeWidth={3} strokeLinecap="round" fill="none" />
          <polygon points={layout.initialArrow.arrow} fill={TONES[initTone]} />
        </motion.g>
      )}

      {automaton.states.map((s) =>
        visible.states.has(s.id) ? (
          <Node key={s.id} id={s.id} pos={layout.nodes[s.id]} state={s} tone={nodeTone(s.id)} />
        ) : null,
      )}
    </>
  )
}