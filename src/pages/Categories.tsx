import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories } from "@/services/categoryService";
import { Category } from "@/types";
import { Search, MessageCircle } from "lucide-react";
import Icons8Icon, { getCategoryIconSlug } from "@/components/Icons8Icon";

const GROUPS = ["General", "Education", "TV", "Movies", "Sports", "Music"];
const TILE_COLORS = ["#ff6b4a", "#ffd24f", "#18b9cf", "#895de8", "#f65357", "#20c997"];

function groupCategories(categories: Category[]) {
  return GROUPS.map((name, index) => ({
    name,
    items: categories.slice(index * 5, index * 5 + 5),
  })).filter((group) => group.items.length > 0);
}

const TopicTile: React.FC<{ category: Category; index: number; onClick: () => void }> = ({ category, index, onClick }) => {
  const { slug, fallback } = getCategoryIconSlug(category.name);

  return (
    <button type="button" onClick={onClick} className="w-[62px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto h-[50px] w-[50px]"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <Icons8Icon
          name={slug}
          fallback={fallback}
          size={64}
          style="fluency"
          className="h-10 w-10 object-contain"
          alt=""
        />
      </span>
      <span className="mt-1 block min-h-[24px] text-[10px] font-bold leading-[11px] text-[#444] line-clamp-2">
        {category.name}
      </span>
    </button>
  );
};

const Categories: React.FC = () => {
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

  const groups = useMemo(() => groupCategories(categories), [categories]);

  return (
    <div className="quizup-app">
      <div className="quizup-blackbar">
        <div className="w-8" />
        <h1 className="font-display text-[17px] font-extrabold">Topics</h1>
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
        </div>
      </div>

      {/* <div className="bg-white px-3 py-2">
        <div className="grid grid-cols-2 rounded-full border border-[#b8b8b8] bg-[#ededed] p-0.5 text-center text-[11px] font-black text-[#777]">
          <button className="h-7 rounded-full bg-white shadow-sm">Topics</button>
          <button className="h-7">Tournaments (6)</button>
        </div>
      </div> */}

      {loading ? (
        <p className="py-16 text-center text-sm font-semibold text-zinc-400">Loading topics...</p>
      ) : (
        <div className="bg-white">
          {groups.map((group, groupIndex) => (
            <section key={group.name} className="quizup-section border-t-0">
              <div className="flex items-center justify-between px-3 py-3">
                <h2 className="quizup-section-title">{group.name}</h2>
                <button className="quizup-see-all" onClick={() => navigate("/categories")}>See all</button>
              </div>
              <div className="flex gap-2 overflow-x-auto px-3 pb-4">
                {group.items.map((cat, index) => (
                  <TopicTile
                    key={cat.id}
                    category={cat}
                    index={index + groupIndex}
                    onClick={() => navigate(`/category/${cat.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Categories;
