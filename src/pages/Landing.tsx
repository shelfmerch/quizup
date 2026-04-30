import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, ChevronRight, Play, User } from "lucide-react";

const LOGO_SRC = "/branding/quizup-icon.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center px-8 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/images/quizup-landing.png')` }}
    >
      <div className="max-w-md w-full min-h-screen flex flex-col items-center">
        {/* <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-8 p-1 rounded-[2rem] bg-gradient-to-br from-white to-slate-200 shadow-2xl"
      >
        <img
          src={LOGO_SRC}
          alt="QuizUp"
          className="w-28 h-28 rounded-[1.8rem] shadow-inner object-cover select-none"
          width={112}
          height={112}
          draggable={false}
        />
      </motion.div> */}

      {/* <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl font-display font-black text-slate-900 text-center mb-2 tracking-tight"
      >
        QuizUp
      </motion.h1> */}

      {/* <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-slate-500 font-medium text-center mb-12 text-base max-w-[240px]"
      >
        Real-time 1v1 quiz battles with players worldwide
      </motion.p> */}

      {/* <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-40 w-full rounded-[1.65rem] border border-white/35 bg-black/25 p-2 shadow-2xl shadow-black/35 backdrop-blur-md"
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate("/signup")}
            className="group flex h-14 min-w-0 items-center justify-center gap-2 rounded-[1.15rem] bg-[#f65357] px-3 font-display text-[15px] font-extrabold text-white shadow-lg shadow-black/25 transition-all hover:bg-[#ff6266] active:scale-[0.97]"
          >
            <span className="truncate">Get Started</span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => navigate("/login")}
            className="flex h-14 min-w-0 items-center justify-center gap-2 rounded-[1.15rem] border border-white/60 bg-white/92 px-3 font-display text-[15px] font-extrabold text-[#242424] shadow-lg shadow-black/15 transition-all bg-white active:scale-[0.97]"
          >
            <LogIn className="h-4 w-4 shrink-0 text-[#f65357]" />
            <span className="truncate">Sign In</span>
          </button>
        </div>
      </motion.div> */}

       <main className="flex w-full flex-1 flex-col items-center justify-end pb-8 text-center">
            {/* <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
              className="flex w-full flex-col items-center"
            >

              <p className="mt-8 max-w-[20rem] text-[25px] font-semibold leading-tight text-white drop-shadow-[0_3px_5px_rgba(0,0,0,0.55)]">
                The biggest trivia community. Millions of topics. Endless fun.
              </p>
            </motion.div> */}

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex w-full flex-col items-center gap-4"
            >
              <button
                onClick={() => navigate("/signup")}
                className="relative flex h-20 w-[94%] overflow-hidden gap-4 items-center justify-between rounded-full bg-[#f65357] px-6 font-display text-[20px] font-black text-white shadow-[0_-5px_22px_rgba(255,222,84,0.34),0_9px_0_rgba(175,38,57,0.78),0_22px_42px_rgba(246,83,87,0.58),inset_0_3px_0_rgba(255,255,255,0.28),inset_0_-8px_16px_rgba(152,15,45,0.2)] active:translate-y-1 active:scale-[0.99] active:shadow-[0_-3px_16px_rgba(255,222,84,0.28),0_5px_0_rgba(175,38,57,0.74),0_14px_30px_rgba(246,83,87,0.48),inset_0_2px_0_rgba(255,255,255,0.24),inset_0_-5px_12px_rgba(152,15,45,0.18)]"
                style={{
                  background: "linear-gradient(180deg, #ff6258 0%, #f65357 54%, #e84252 100%)",
                }}
              >
                <span className="pointer-events-none absolute left-10 right-10 top-0 h-[5px] rounded-b-full bg-gradient-to-r from-transparent via-[#ffe66d] to-transparent opacity-95 shadow-[0_0_16px_rgba(255,226,95,0.78)]" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#f65357]">
                  <Play className="h-4 w-4 fill-current" />
                </span>
                <span>Play Now</span>
                <ChevronRight className="h-10 w-10 stroke-[2]" />
              </button>

              <button
                onClick={() => navigate("/login")}
                className="flex mb-40 h-16 w-[94%] gap-2 items-center justify-between rounded-full border-[3px] border-white/90 bg-black/30 px-6 font-display text-[20px] font-black text-white shadow-[0_0_22px_rgba(255,255,255,0.24),0_16px_38px_rgba(0,0,0,0.5)] backdrop-blur-md active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#14784f]">
                  <User className="h-7 w-7 fill-current" />
                </span>
                <span>Continue</span>
                <ChevronRight className="h-9 w-9 stroke-[2]" />
              </button>
            </motion.div>

            {/* <div className="mt-10 pb-7 text-center text-[23px] font-semibold">
              <span className="text-white/95">Already have an account?</span>
              <button onClick={() => navigate("/login")} className="ml-5 border-b-2 border-white pb-0.5 font-black text-white">
                Sign In
              </button>
            </div> */}

            <div className="mx-auto h-1.5 w-36 rounded-full bg-white" />
          </main>
      </div>
    </div>
  );
};

export default Landing;
