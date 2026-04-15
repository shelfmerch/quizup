import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const LOGO_SRC = "/branding/quizup-icon.png";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-quizup-dark flex flex-col items-center justify-center px-6 max-w-md mx-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-6"
      >
        <img
          src={LOGO_SRC}
          alt="QuizUp"
          className="w-24 h-24 rounded-3xl shadow-lg object-cover select-none"
          width={96}
          height={96}
          draggable={false}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl font-display font-extrabold text-foreground text-center mb-1"
      >
        QuizUp
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-center mb-10 text-sm"
      >
        Real-time 1v1 quiz battles with friends
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-3"
      >
        <button
          onClick={() => navigate("/signup")}
          className="w-full h-14 rounded-lg quizup-header-green text-foreground font-display font-bold text-base"
        >
          Create Account
        </button>
        <button
          onClick={() => navigate("/login")}
          className="w-full h-14 rounded-lg bg-quizup-card border border-border text-foreground font-display font-bold text-base"
        >
          Sign In
        </button>
      </motion.div>
    </div>
  );
};

export default Landing;
