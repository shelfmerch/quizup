import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const LOGO_SRC = "/branding/quizup-icon.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 max-w-md mx-auto">
      <motion.div
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
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl font-display font-black text-slate-900 text-center mb-2 tracking-tight"
      >
        QuizUp
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-slate-500 font-medium text-center mb-12 text-base max-w-[240px]"
      >
        Real-time 1v1 quiz battles with players worldwide
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-4"
      >
        <button
          onClick={() => navigate("/signup")}
          className="w-full h-16 rounded-2xl btn-gradient-green text-white font-display font-bold text-lg shadow-xl shadow-green-500/20"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate("/login")}
          className="w-full h-16 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 text-slate-700 font-display font-bold text-lg shadow-sm"
        >
          Sign In
        </button>
      </motion.div>
    </div>
  );
};

export default Landing;
