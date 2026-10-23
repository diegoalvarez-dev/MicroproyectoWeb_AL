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
