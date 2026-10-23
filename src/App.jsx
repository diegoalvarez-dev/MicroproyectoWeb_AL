import Header from './components/Header.jsx'
import DesignerModule from './components/DesignerModule.jsx'

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <DesignerModule />
      <footer className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 text-center text-xs text-white/40">
        Microproyecto AL · Teoría de la computación · Diego Márquez · Juan Quintero · Diego Álvarez
      </footer>
    </div>
  )
}
