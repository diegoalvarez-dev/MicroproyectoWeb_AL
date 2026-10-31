import { useCallback, useEffect, useState } from 'react'

/**
 * Recorrido de una palabra sobre el autómata, con pausa y avance manual.
 *   run = { result, k, finished }   (el mismo formato que usa runHighlight y WordTester)
 *   posición 0 … n+1: 0..n = el símbolo k está en curso, n+1 = terminó (n = longitud del recorrido).
 */
export function useWordRun(speed = 1) {
  const [run, setRun] = useState(null)
  const [playing, setPlaying] = useState(true)

  // avanza solo mientras no esté en pausa
  useEffect(() => {
    if (!run || run.finished || !playing) return undefined
    const n = run.result.path.length
    const delay = run.k === 0 ? 450 : 700 / speed
    const t = setTimeout(
      () => setRun((r) => (r && !r.finished ? (r.k < n ? { ...r, k: r.k + 1 } : { ...r, finished: true }) : r)),
      delay,
    )
    return () => clearTimeout(t)
  }, [run, speed, playing])

  const start = useCallback((result) => {
    setRun({ result, k: 0, finished: false })
    setPlaying(true)
  }, [])
  const clear = useCallback(() => setRun(null), [])

  const max = run ? run.result.path.length + 1 : 0
  const pos = run ? (run.finished ? max : run.k) : 0

  const seek = useCallback((p) => {
    setPlaying(false)
    setRun((r) => {
      if (!r) return r
      const n = r.result.path.length
      const q = Math.min(n + 1, Math.max(0, p))
      return { ...r, k: Math.min(q, n), finished: q > n }
    })
  }, [])

  const togglePlay = useCallback(() => {
    if (playing) return setPlaying(false)
    if (run && run.finished) setRun({ ...run, k: 0, finished: false })
    setPlaying(true)
  }, [playing, run])

  return { run, setRun, start, clear, playing, setPlaying, togglePlay, seek, pos, max }
}