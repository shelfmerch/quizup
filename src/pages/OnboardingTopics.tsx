import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories, followCategory } from "@/services/categoryService";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Category } from "@/types";

const TILE_COLORS = [
  "#ff6b4a", "#ffd24f", "#18b9cf", "#895de8", "#f65357", "#20c997",
];

const TopicTile: React.FC<{
  category: Category;
  index: number;
  selected: boolean;
  onToggle: () => void;
}> = ({ category, index, selected, onToggle }) => {
  const color = TILE_COLORS[index % TILE_COLORS.length];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-[72px] shrink-0 text-center transition-transform active:scale-95 ${selected ? 'scale-105' : ''}`}
      aria-pressed={selected}
    >
      <span
        className={`quizup-topic-tile mx-auto flex h-[56px] w-[56px] rounded-lg items-center justify-center ${selected ? 'ring-4 ring-offset-2' : ''}`}
        style={{ 
          backgroundColor: color,
          ringColor: color,
        }}
      >
        <CategoryIcon
          category={category}
          size={64}
          style="fluency"
          className="h-11 w-11 object-contain"
        />
        {selected && (
          <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border-[3px] flex items-center justify-center shadow-sm" style={{ borderColor: color }}>
            <Check className="h-4 w-4" style={{ color }} strokeWidth={4} />
          </div>
        )}
      </span>
      <span className="mt-1 block min-h-[28px] text-[11px] font-bold leading-[12px] text-[#444] line-clamp-2">
        {category.name}
      </span>
    </button>
  );
};

const OnboardingTopics: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCategories()
      .then((list) => { if (!cancelled) setCategories(list.length ? list : MOCK_CATEGORIES); })
      .catch(() => { if (!cancelled) setCategories(MOCK_CATEGORIES); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleTopic = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = async () => {
    if (selected.size === 0) {
      toast.error("Please pick at least 1 topic");
      return;
    }
    setSaving(true);
    try {
      const chosen = categories.filter((c) => selected.has(c.id));
      await Promise.allSettled(chosen.map((c) => followCategory(c.id)));
      navigate("/");
    } catch {
      toast.error("Something went wrong, but you can always change topics later.");
      navigate("/");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate("/");

  return (
    <div className="quizup-app bg-white min-h-[100dvh] flex flex-col">
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-center shadow-sm">
        <h1 className="font-display font-bold text-white text-base">Select Topics</h1>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="px-6 pt-8 pb-4 text-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Step 2 of 2</p>
          <h2 className="text-2xl font-black text-foreground font-display">Pick your favorite topics</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground">Choose what you love to quiz about</p>
          
          {selected.size > 0 && (
            <div className="mt-4 inline-block bg-quizup-green/10 text-quizup-green text-xs font-bold px-3 py-1 rounded-full border border-quizup-green/20">
              {selected.size} topic{selected.size !== 1 ? "s" : ""} selected
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-quizup-teal" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-x-2 gap-y-6 justify-items-center sm:grid-cols-5">
              {categories.map((cat, index) => (
                <TopicTile
                  key={cat.id}
                  category={cat}
                  index={index}
                  selected={selected.has(cat.id)}
                  onToggle={() => toggleTopic(cat.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 px-6 py-5 bg-white/90 backdrop-blur-sm border-t border-slate-100">
          <button
            type="button"
            onClick={handleDone}
            disabled={saving || selected.size === 0}
            className="w-full h-14 rounded-lg quizup-header-green text-white font-display font-bold text-base disabled:opacity-50 shadow-md flex items-center justify-center gap-2 mb-3"
          >
            {saving ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                {selected.size === 0
                  ? "Select at least 1 topic"
                  : `Start Playing`}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full h-10 rounded-lg text-sm font-bold text-muted-foreground transition-opacity hover:opacity-70"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTopics;
