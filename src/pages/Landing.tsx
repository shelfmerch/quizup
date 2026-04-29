import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LogIn } from "lucide-react";

const LOGO_SRC = "/branding/quizup-icon.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center px-8 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/images/quizup-7ba5e.webp')` }}
    >
      <div className="max-w-md w-full flex flex-col items-center mt-10">
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

      <motion.div
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
      </motion.div>
      </div>
    </div>
  );
};

export default Landing;
