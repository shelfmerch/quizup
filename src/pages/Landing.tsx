import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Play, User, Zap } from "lucide-react";

const TILE_BACKGROUNDS = [
  "#14b8a6",
  "#14532d",
  "#fbcfe8",
  "#ea580c",
  "#27272a",
  "#7c3aed",
  "#dc2626",
  "#eab308",
  "#0d9488",
  "#166534",
  "#f9a8d4",
  "#c2410c",
  "#18181b",
  "#9333ea",
  "#b91c1c",
  "#ca8a04",
  "#2dd4bf",
  "#15803d",
  "#fda4af",
  "#f97316",
  "#3f3f46",
  "#a855f7",
  "#ef4444",
  "#fde047",
];

const TILE_ICONS = [
  "🎬",
  "⌨️",
  "🌍",
  "🐞",
  "🚌",
  "🎠",
  "⚡",
  "⚛️",
  "🧭",
  "🎵",
  "🎮",
  "🎥",
  "🧭",
  "👤",
  "🐻",
  "👑",
  "💀",
  "🎯",
  "📷",
  "🎨",
  "🔬",
  "🎪",
  "🌟",
  "🎸",
];

const GRID_COLS = 14;
const GRID_ROWS = 22;

function LandingIconGrid() {
  const tiles = useMemo(() => {
    const total = GRID_COLS * GRID_ROWS;
    return Array.from({ length: total }, (_, i) => {
      const bg = TILE_BACKGROUNDS[(i * 7 + i % 3) % TILE_BACKGROUNDS.length];
      const icon = TILE_ICONS[(i * 11) % TILE_ICONS.length];
      return { bg, icon, key: i };
    });
  }, []);

  return (
    <div
      className="absolute inset-0 min-h-[100dvh] grid gap-[2px] bg-neutral-950/80 p-[2px]"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
      }}
      aria-hidden
    >
      {tiles.map(({ bg, icon, key }) => (
        <div
          key={key}
          className="flex min-h-0 min-w-0 items-center justify-center text-[clamp(0.65rem,2.8vw,0.95rem)] leading-none shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: bg }}
        >
          <span className="select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">{icon}</span>
        </div>
      ))}
    </div>
  );
}

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden font-display">
      <LandingIconGrid />

      {/* Dim overlay so foreground stays legible on busy grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/60"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative mb-7"
          >
            <span
              className="absolute -left-1 -top-2 text-lg text-sky-300 drop-shadow-md"
              aria-hidden
            >
              ✦
            </span>
            <span
              className="absolute -right-2 top-3 text-sm text-amber-300 drop-shadow-md"
              aria-hidden
            >
              ✧
            </span>
            <span
              className="absolute -bottom-1 left-1/2 text-xs text-pink-300 drop-shadow-md"
              aria-hidden
            >
              ·✦·
            </span>
            <div className="flex h-[7.25rem] w-[7.25rem] items-center justify-center rounded-full border-[5px] border-white bg-gradient-to-b from-[#ff4d4d] to-[#d91a1a] shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.15)_inset]">
              <Zap
                className="h-[3.35rem] w-[3.35rem] fill-white text-white"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-[2.65rem] font-black tracking-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
          >
            QuizUp
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="mt-4 max-w-[17.5rem] space-y-1 text-[0.95rem] font-semibold leading-snug text-white/95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
          >
            <p>The biggest trivia community.</p>
            <p>Millions of topics. Endless fun.</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="flex w-full flex-col items-stretch gap-4"
        >
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="group relative grid h-[4.25rem] w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-full px-5 text-[1.15rem] font-black text-white shadow-[0_0_28px_rgba(248,113,113,0.55),0_14px_36px_rgba(0,0,0,0.35)] transition-transform active:scale-[0.98]"
            style={{
              background: "linear-gradient(90deg, #ff6b5b 0%, #ff5a6d 45%, #ff4d8d 100%)",
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center justify-self-start rounded-full bg-white text-[#e11d48] shadow-inner">
              <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
            </span>
            <span className="text-center">Play Now</span>
            <ChevronRight
              className="h-8 w-8 justify-self-end stroke-[2.5] opacity-95"
              aria-hidden
            />
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="grid h-[4.25rem] w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-full border border-white/85 bg-white/20 px-5 text-[1.15rem] font-black text-white shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-[14px] transition-transform active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center justify-self-start rounded-full bg-white text-neutral-700 shadow-sm">
              <User className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="text-center">Continue</span>
            <ChevronRight
              className="h-8 w-8 justify-self-end stroke-[2.5] opacity-95"
              aria-hidden
            />
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-[0.95rem] font-semibold text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        >
          <span>Already have an account? </span>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="border-b border-white pb-0.5 font-black text-white underline decoration-white underline-offset-4 transition-opacity hover:opacity-90"
          >
            Sign In
          </button>
        </motion.p>
      </div>
    </div>
  );
};

export default Landing;
