import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories } from "@/services/categoryService";
import { Category } from "@/types";
import { ArrowLeft, Search } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORY_COLORS = [
  "quizup-header-red",
  "quizup-header-green",
  "quizup-header-teal",
  "quizup-header-blue",
  "quizup-header-purple",
  "quizup-header-orange",
];

const Categories: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPublicCategories();
        if (!cancelled) setCategories(list);
      } catch {
        if (!cancelled) setCategories(MOCK_CATEGORIES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-quizup-dark">
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-foreground text-base">Topics</h1>
        </div>
        <button type="button">
          <Search className="w-5 h-5 text-foreground/80" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading topics…</p>
        ) : (
          categories.map((cat, i) => (
            <motion.button
              key={cat.id}
              type="button"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/category/${cat.id}`)}
              className={`w-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} rounded-lg p-4 flex items-center gap-4 text-left`}
            >
              <span className="text-3xl">{cat.icon}</span>
              <div className="flex-1">
                <p className="font-display font-bold text-foreground">{cat.name}</p>
                <p className="text-foreground/60 text-xs">{cat.description}</p>
              </div>
              <div className="text-right">
                <p className="text-foreground/80 text-xs font-bold">{cat.questionCount}</p>
                <p className="text-foreground/50 text-[9px]">Questions</p>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
};

export default Categories;
