import { useState } from 'react'
import Header from './compartido/componentes/Header.jsx'
import DesignerModule from './modulos/diseno/DesignerModule.jsx'
import ConverterModule from './modulos/conversion/ConverterModule.jsx'
import MinimizationModule from './modulos/minimizacion/MinimizationModule.jsx'

export default function App() {
  const [module, setModule] = useState(1)
  // AFND que el módulo 3 le pasa al módulo 2 para mostrar la conversión paso a paso
  const [incoming, setIncoming] = useState(null)

  const openConverter = (nfa) => {
    setIncoming({ nfa, id: Date.now() })
    setModule(2)
    window.scrollTo?.({ top: 0 })
  }

  return (
    <div className="min-h-screen">
      <Header module={module} onModule={setModule} />
      {/* los tres módulos siguen montados: al cambiar de pestaña no se pierde lo que se estaba haciendo */}
      <div className={module === 1 ? '' : 'hidden'}>
        <DesignerModule />
      </div>
      <div className={module === 2 ? '' : 'hidden'}>
        <ConverterModule incoming={incoming} />
      </div>
      <div className={module === 3 ? '' : 'hidden'}>
        <MinimizationModule onOpenConverter={openConverter} />
      </div>
      <footer className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 text-center text-xs text-white/40">
        Microproyecto AL · Teoría de la computación · Diego Márquez · Juan Quintero · Diego Álvarez
      </footer>
    </div>
  )
}