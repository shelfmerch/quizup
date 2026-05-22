import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories } from "@/services/categoryService";
import { Category } from "@/types";
import { ArrowLeft } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TopicSearchTrigger } from "@/components/TopicSearchOverlay";

const TILE_COLORS = ["#ff6b4a", "#ffd24f", "#18b9cf", "#895de8", "#f65357", "#20c997"];

const TopicTile: React.FC<{ category: Category; index: number; onClick: () => void }> = ({ category, index, onClick }) => {
  return (
    <button type="button" onClick={onClick} className="w-[72px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto h-[56px] w-[56px]"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <CategoryIcon
          category={category}
          size={64}
          style="fluency"
          className="h-11 w-11 object-contain"
        />
      </span>
      <span className="mt-1 block min-h-[28px] text-[11px] font-bold leading-[12px] text-[#444] line-clamp-2">
        {category.name}
      </span>
    </button>
  );
};

const AllCategories: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPublicCategories();
        if (!cancelled) setCategories(list.length ? list : MOCK_CATEGORIES);
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
    <div className="quizup-app bg-white min-h-[100dvh]">
      <div className="quizup-blackbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-white w-8">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[17px] font-extrabold flex-1 text-center">All Topics</h1>
        <TopicSearchTrigger
          categories={categories}
          className="text-white w-8 flex justify-end rounded-full active:bg-white/10"
          iconClassName="h-5 w-5 text-white"
        />
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm font-semibold text-zinc-400">Loading topics...</p>
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-5 md:grid-cols-6 justify-items-center">
            {categories.map((cat, index) => (
              <TopicTile
                key={cat.id}
                category={cat}
                index={index}
                onClick={() => navigate(`/category/${cat.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllCategories;
