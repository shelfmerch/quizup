import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Play, User } from "lucide-react";

const BANNER_SRC = "/images/default_banner.png";
const BRAND_SRC = "/images/quizup.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden font-display">
      <div className="pointer-events-none absolute inset-0 min-h-[100dvh]" aria-hidden>
        <img
          src={BANNER_SRC}
          alt=""
          className="h-full min-h-[100dvh] w-full object-cover object-center"
          decoding="async"
          fetchPriority="high"
        />
      </div>

      {/* Dim overlay so foreground stays legible on busy artwork */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/60"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 2 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-[min(22rem,88vw)]"
          >
            <img
              src={BRAND_SRC}
              alt="QuizUp — The biggest trivia community. Millions of topics. Endless fun."
              className="mx-auto h-auto w-full select-none drop-shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
              draggable={false}
              decoding="async"
            />
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
