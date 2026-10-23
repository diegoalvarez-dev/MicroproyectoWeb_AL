// Historial de ejercicios guardado en el navegador (localStorage).
const KEY = 'al-micro:designer-history:v1'
const MAX = 40

export function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* almacenamiento lleno o bloqueado: el historial simplemente no persiste */
  }
}
