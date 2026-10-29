// Historial de ejercicios guardado en el navegador (localStorage).
const KEY = 'al-micro:designer-history:v1'
const MAX = 40

export const CONVERTER_KEY = 'al-micro:converter-history:v1'

export function loadHistory(key = KEY) {
  try {
    const raw = JSON.parse(localStorage.getItem(key))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveHistory(list, key = KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* almacenamiento lleno o bloqueado: el historial simplemente no persiste */
  }
}