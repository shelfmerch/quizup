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
    <div className="min-h-screen">
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-slate-900 text-base">Topics</h1>
        </div>
        <button type="button">
          <Search className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading topics…</p>
        ) : (
          categories.map((cat, i) => {
            const themeKey = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <motion.button
                key={cat.id}
                type="button"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/category/${cat.id}`)}
                className={`w-full rounded-2xl p-5 flex items-center gap-5 text-left shadow-lg shadow-black/5 transition-all relative overflow-hidden group`}
                style={{
                  background: `linear-gradient(135deg, ${themeKey === 'bg-white' ? '#fff' : 'hsl(var(--' + themeKey.replace('quizup-header-', 'quizup-') + '))'}, ${themeKey === 'bg-white' ? '#f8f9fa' : 'hsl(var(--' + themeKey.replace('quizup-header-', 'quizup-') + ') / 0.8)'})`
                }}
              >
                <div className="absolute top-0 right-0 w-32 h-full bg-white/10 skew-x-12 translate-x-16 group-hover:translate-x-8 transition-transform" />
                <span className="text-4xl drop-shadow-md z-10">{cat.icon}</span>
                <div className="flex-1 z-10">
                  <p className="font-display font-bold text-white text-lg leading-tight tracking-tight">{cat.name}</p>
                  <p className="text-white/80 text-[11px] mt-1 font-medium">{cat.description}</p>
                </div>
                <div className="text-right z-10">
                  <p className="text-white text-sm font-display font-black">{cat.questionCount}</p>
                  <p className="text-white/60 text-[9px] font-bold uppercase tracking-tighter">Qs</p>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Categories;
