import { useState } from "react";
import { motion } from "framer-motion";

// Fotos: coloca los archivos en  public/autores/  con estos nombres (jpg, png, jpeg o webp).
// Si no hay foto todavía, se muestran las iniciales.
const TEAM = [
  { name: "Diego Álvarez", photo: "diego-alvarez" },
  { name: "Diego Márquez", photo: "diego-marquez" },
  { name: "Juan Quintero", photo: "juan-quintero" },
];
const EXTENSIONS = ["jpg", "png", "jpeg", "webp"];

function Avatar({ name, photo }) {
  const [attempt, setAttempt] = useState(0);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("");
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-[#060919] ring-2 ring-white/15">
      {attempt < EXTENSIONS.length ? (
        <img
          src={`/autores/${photo}.${EXTENSIONS[attempt]}`}
          alt={name}
          onError={() => setAttempt((a) => a + 1)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

const MODULES = [
  { id: 1, title: "Diseño de autómatas", sub: "AFD · AFND", ready: true },
  {
    id: 2,
    title: "AFND → AFD",
    sub: "Construcción de subconjuntos",
    ready: true,
  },
  { id: 3, title: "Minimización", sub: "Pares distinguibles", ready: true },
];

function Logo() {
  return (
    <svg width="46" height="46" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect
        width="64"
        height="64"
        rx="16"
        fill="#0b1030"
        stroke="rgba(255,255,255,.12)"
      />
      <circle
        cx="34"
        cy="32"
        r="16"
        fill="none"
        stroke="url(#logo-g)"
        strokeWidth="4"
      />
      <circle
        cx="34"
        cy="32"
        r="8"
        fill="none"
        stroke="url(#logo-g)"
        strokeWidth="3"
      />
      <path
        d="M5 32h11"
        stroke="#22d3ee"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Header({ module = 1, onModule = () => {} }) {
  return (
    <header className="mx-auto max-w-[1500px] px-4 pb-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Logo />
          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Autómatas <span className="grad-text">Finitos</span>
            </h1>
            <p className="text-sm text-white/55">
              Microproyecto AF · Teoría de la computación
            </p>
          </div>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2"
          aria-label="Equipo de trabajo"
        >
          {TEAM.map(({ name, photo }) => (
            <li
              key={name}
              className="glass flex items-center gap-2.5 rounded-full! py-1.5 pl-1.5 pr-4 text-sm"
            >
              <Avatar name={name} photo={photo} />
              <span className="grad-text font-semibold">{name}</span>
            </li>
          ))}
        </motion.ul>
      </div>

      <nav className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Módulos">
        {MODULES.map((m, i) => {
          const active = m.id === module;
          return (
            <motion.button
              key={m.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              disabled={!m.ready}
              onClick={() => onModule(m.id)}
              aria-current={active ? "page" : undefined}
              className={`glass flex items-center gap-3 px-4 py-3 text-left transition ${
                active
                  ? "border-cyan-300/40! bg-cyan-300/[0.07]!"
                  : m.ready
                    ? "hover:border-white/30!"
                    : "cursor-not-allowed opacity-55"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${
                  active
                    ? "bg-gradient-to-br from-violet-500 to-cyan-400 text-[#060919]"
                    : "bg-white/10"
                }`}
              >
                {m.id}
              </span>
              <span className="leading-tight">
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-xs text-white/50">{m.sub}</span>
              </span>
            </motion.button>
          );
        })}
      </nav>
    </header>
  );
}
