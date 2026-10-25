import { useState } from 'react'
import Header from './components/Header.jsx'
import DesignerModule from './components/DesignerModule.jsx'
import ConverterModule from './components/ConverterModule.jsx'

export default function App() {
  const [module, setModule] = useState(1)
  return (
    <div className="min-h-screen">
      <Header module={module} onModule={setModule} />
      {/* los dos módulos siguen montados: al cambiar de pestaña no se pierde lo que se estaba haciendo */}
      <div className={module === 1 ? '' : 'hidden'}>
        <DesignerModule />
      </div>
      <div className={module === 2 ? '' : 'hidden'}>
        <ConverterModule />
      </div>
      <footer className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 text-center text-xs text-white/40">
        Microproyecto AL · Teoría de la computación · Diego Márquez · Juan Quintero · Diego Álvarez
      </footer>
    </div>
  )
}