# Autómatas Finitos · Microproyecto AF

Equipo: Diego Márquez · Juan Quintero · Diego Álvarez

Microproyecto de Teoría de la computación con tres módulos, todos implementados:

1. **Diseño de autómatas (AFD / AFND)**: a partir de unas indicaciones se diseña el autómata, y además hay una pestaña para practicar dibujando el propio.
2. **AFND → AFD**: conversión por construcción de subconjuntos, paso a paso.
3. **Minimización**: minimización de un AFD (o de un AFND, que primero se convierte) por pares distinguibles.

Cada módulo muestra el autómata como diagrama de transición, su tabla de transición y su formalización `AF = ({Qn}, Q0, {Qt}, Σ, ς)`. El estado de error se muestra como **ξ**.

## Estructura

```
api/index.py              FastAPI (único entry point serverless)
backend/                  lógica pura en Python, una carpeta por módulo
  compartido/
    automata.py           particiones, BFS, alcanzabilidad (usado por los 3 módulos)
    grammar.py            gramática regular equivalente (ya no se muestra en la interfaz)
  diseno/                 módulo 1
    rules.py              semántica de las indicaciones + verificador directo
    validators.py         validación de indicaciones y palabras de ejemplo
    designer.py           construcción AFD/AFND, pasos de animación, recorrido de palabras
    generator.py          ejercicios aleatorios (fácil / medio / difícil)
    practice.py           comprobación del autómata que dibuja el estudiante
  conversion/             módulo 2
    converter.py          construcción de subconjuntos y pasos de la conversión
  minimizacion/           módulo 3
    minimizer.py          pares distinguibles, pasos, notaciones M / F / P
    service.py, router.py servicio y rutas del módulo
    generator.py          ejercicios aleatorios
src/                      React + Vite + Tailwind 4 + Framer Motion
  App.jsx, main.jsx
  compartido/
    componentes/          piezas reutilizables por los 3 módulos
      AutomatonCanvas     dibujo del autómata (SVG)
      PanZoom             zoom, arrastre y pantalla completa de los diagramas
      NfaDrawer, NfaForm  dibujar / escribir un autómata (mover, congelar, renombrar estados)
      TransitionTable     tabla de transición (+ StateBadge)
      FormalStructure     formalización AF = ({Qn}, Q0, {Qt}, Σ, ς)
      StepPlayer          reproductor paso a paso (pausa, velocidad, barra)
      WordTester          probar una palabra
      WordRunOverlay      la palabra recorriéndose sobre el diagrama (pantalla completa)
      RegistrationShell, HistoryPanel, Header, Banner, ui
    lib/                  layout, tablas, nombres (ξ), historial, validación, hooks
  modulos/
    diseno/               módulo 1: DesignerModule, DesignPanel, SpecBuilder, PracticePanel
    conversion/           módulo 2: ConverterModule, convert.js, api.js
    minimizacion/         módulo 3: MinimizationModule, PairsTable, AnalysisPanel,
                          progress.js, example.js, api.js
public/
  favicon.svg
  autores/                fotos del equipo (diego-marquez.jpg, juan-quintero.jpg, diego-alvarez.jpg)
tests/                    verificación del backend (diseño, conversión y minimización)
vercel.json               /api/* -> api/index.py (todo en un solo proyecto)
```

## Correr en local

Terminal 1 (backend):

```
pip install -r requirements.txt
npm run dev:api
```

Terminal 2 (frontend):

```
npm install
npm run dev
```

Abrir http://localhost:5173 (Vite redirige /api al backend en el puerto 8000).

## Pruebas del backend

```
python tests/test_designer.py
python tests/test_converter.py
python tests/test_minimizacion.py
```

## Qué hace cada módulo

### Módulo 1 · Diseño de AFD / AFND
- **Ver el autómata diseñado**: se registran las indicaciones (o se genera un ejercicio), se elige AFD o AFND y se diseña. Se anima la construcción paso a paso, se puede probar una palabra sobre el diagrama (con pausa, paso a paso y pantalla completa) y al terminar se ven la tabla de transición y la formalización.
- **Practicar: dibujar el mío**: el estudiante dibuja su autómata, se comprueba contra las indicaciones y se muestran su tabla de transición y su formalización.

### Módulo 2 · AFND → AFD
Se registra un AFND (dibujándolo o con formulario) y se ve su tabla de transición, su formalización y su diagrama. Luego se convierte a AFD por subconjuntos, paso a paso, con la tabla y el diagrama del AFD resultante.

### Módulo 3 · Minimización
Se registra un AF (AFD o AFND; si es AFND se muestra su AFD equivalente). Se minimiza con la tabla de pares distinguibles: cada par recibe una notación **M** (se marca), **F** (fusión) o **P** (pendiente). Con la reproducción en pausa o terminada se puede pulsar una notación o una casilla de la tabla para ver el análisis de ese par. El resultado es el AFDM con su tabla, formalización y diagrama.

## Reglas del lenguaje (módulo 1)

- Alfabeto: 2 a 5 símbolos, solo números o solo letras minúsculas.
- Toda palabra inicia y finaliza en un símbolo dado; la palabra vacía no es válida.
- Sin regla en contra, un símbolo puede repetirse (subcadenas consecutivas).
- «No pueden existir subcadenas de X»: no puede haber dos X seguidas (una sola sí).
- «Pueden existir subcadenas de X precedidas de A y seguidas de B»: todo bloque de X debe tener A justo antes y B justo después.
- Los autómatas son completos: lo que incumple una regla va al estado de error (ξ, id interno `error`), con rizo de todo el alfabeto.

## Modulo 1(Por mejorar)
- Las indicaciones algunas se contradicen, toca mejorar esto ya que no se pueden contradecir. Ejemplo subcadenas de 2 con longitud maxima de 4 y minima de 2 y la suma de 2 tiene que ser 2 en las subcadenas (Esto no deberia ser valido pero el microproyecto actualmente lo permite).

## Modulo 3(Por mejorar)
- Salir de dudas con respecto a la marcacion en los estados finales dentro de la minimizacion, si se marca el cuador que une a dos estados finales.


## Adicional
- Mirar todas las validaciones en los 3 modulos.
- Mejorar un poco mas el frontend(responsivo en moviles y comodo para el uso por parte del usuario).