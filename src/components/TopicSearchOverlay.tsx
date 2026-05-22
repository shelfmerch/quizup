import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Category } from "@/types";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories } from "@/services/categoryService";
import { CategoryIcon } from "@/components/CategoryIcon";
import { filterCategories } from "@/lib/categorySearch";

const TILE_COLORS = ["#ff6b4a", "#ffd24f", "#18b9cf", "#895de8", "#f65357", "#20c997"];

interface TopicSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Pre-loaded topics; fetches from API when omitted or empty */
  categories?: Category[];
}

export const TopicSearchOverlay: React.FC<TopicSearchOverlayProps> = ({
  open,
  onClose,
  categories: categoriesProp,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>(categoriesProp ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    inputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (categoriesProp?.length) {
      setCategories(categoriesProp);
    }
  }, [categoriesProp]);

  useEffect(() => {
    if (!open || categoriesProp?.length) return;
    let cancelled = false;
    setLoading(true);
    fetchPublicCategories()
      .then((list) => {
        if (!cancelled) setCategories(list.length ? list : MOCK_CATEGORIES);
      })
      .catch(() => {
        if (!cancelled) setCategories(MOCK_CATEGORIES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, categoriesProp?.length]);

  const results = useMemo(() => filterCategories(categories, query), [categories, query]);

  const pick = (cat: Category) => {
    onClose();
    navigate(`/category/${cat.id}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white max-w-md mx-auto left-0 right-0">
      <div className="quizup-blackbar shrink-0 flex items-center gap-2 px-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics…"
            className="h-9 w-full rounded-lg bg-white/15 pl-9 pr-3 text-[15px] text-white placeholder:text-white/60 outline-none ring-0 focus:bg-white/20"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-2 text-white active:bg-white/10"
          aria-label="Close search"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f4f4f4]">
        {loading ? (
          <p className="py-16 text-center text-sm font-semibold text-zinc-400">Loading topics…</p>
        ) : results.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <p className="font-display text-[16px] font-extrabold text-[#242424]">
              {query.trim() ? "No topics found" : "Start typing to search"}
            </p>
            <p className="mt-1 text-sm text-[#65676b]">
              {query.trim()
                ? `Nothing matches "${query.trim()}"`
                : "Search by topic name or keyword"}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {!query.trim() && (
              <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wider text-[#8a8d91]">
                All topics ({results.length})
              </p>
            )}
            {query.trim() && (
              <p className="mb-3 px-1 text-[12px] font-semibold text-[#65676b]">
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
            )}
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-5">
              {results.map((cat, index) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => pick(cat)}
                  className="text-center active:scale-95 transition-transform"
                >
                  <span
                    className="quizup-topic-tile mx-auto flex h-[52px] w-[52px]"
                    style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
                  >
                    <CategoryIcon
                      category={cat}
                      size={64}
                      style="fluency"
                      className="h-10 w-10 object-contain"
                    />
                  </span>
                  <span className="mt-1 block min-h-[26px] text-[10px] font-bold leading-[11px] text-[#444] line-clamp-2">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface TopicSearchTriggerProps {
  categories?: Category[];
  className?: string;
  iconClassName?: string;
}

/** Header search button + overlay */
export const TopicSearchTrigger: React.FC<TopicSearchTriggerProps> = ({
  categories,
  className = "rounded-full p-1 active:bg-black/10",
  iconClassName = "h-5 w-5",
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Search topics"
      >
        <Search className={iconClassName} />
      </button>
      <TopicSearchOverlay open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
};
