# Autómatas Finitos · Microproyecto AL

Equipo: Diego Márquez · Juan Quintero · Diego Álvarez

Módulo 1 (diseño de AFD / AFND) implementado. Los módulos 2 (AFND → AFD) y 3 (minimización) quedan para las siguientes fases.

## Estructura

```
api/index.py        FastAPI (único entry point serverless)
backend/            lógica pura en Python
  automata.py       particiones, BFS, alcanzabilidad (reutilizable por los módulos 2 y 3)
  rules.py          semántica de las indicaciones + verificador directo
  validators.py     validación de indicaciones y palabras de ejemplo
  designer.py       construcción AFD/AFND, pasos de animación, recorrido de palabras
  generator.py      ejercicios aleatorios (fácil / medio / difícil)
src/                React + Vite + Tailwind + Framer Motion
tests/              verificación exhaustiva del backend
vercel.json         /api/* -> api/index.py (todo en un solo proyecto)
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
```

## Reglas del lenguaje (módulo 1)

- Alfabeto: 2 a 5 símbolos, solo números o solo letras minúsculas.
- Toda palabra inicia y finaliza en un símbolo dado; la palabra vacía no es válida.
- Sin regla en contra, un símbolo puede repetirse (subcadenas consecutivas).
- «No pueden existir subcadenas de X»: no puede haber dos X seguidas (una sola sí).
- «Pueden existir subcadenas de X precedidas de A y seguidas de B»: todo bloque de X debe tener A justo antes y B justo después.
- Los autómatas son completos: lo que incumple una regla va al estado `error`, con rizo de todo el alfabeto.


## Modulo 1(Por mejorar)
- Falta algunas indicaciones, por ejemplo que la suma total de VA sea "". Aca toca mirar que tenga coherencia ya que no puede existir una regla que diga que la suma de 2 sea 5 ya que eso es algo imposible.
- La validacion de la palabra a ingresar se sugiere que aparezca en el automata ahi arriba y no en el cuadro de texto. o se puede colocar en la parte superior encima del canvas del automata para ver mejor en vez de abajo.
- Debe mostrarse la gramatica final una vez se cree el automata finito(Buscar estructura)
- Es recomendable que las reglas vayan separadas osea no se complementen.
- Colocar velocidades para validar palabra.

## Modulo 2(Por mejorar)
- Es responsivo pero toca mejorarlo para que se vea un poco mejor en moviles.
- Ajustar de que uno pueda digitar el estado ahi mismo y no por medio del formulario
- Agregar como queda la gramatica final(Buscar estructura).

## Modulo 3(Por mejorar)
-Las fusiones ya que cuando se representa el AFDM no se aprecia bien los nuevos estados y los que desaparecen
-La tabla de transcion para el AFDM, mirar si ya la tenemos implementada
-Salir de dudas con respecto a la marcacion en los estados finales dentro de la minimizacion, si se marca el cuador que une a dos estados finales.