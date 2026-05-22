import React, { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import {
  EMOJI_GROUPS,
  EmojiFamilyItem,
  fetchEmojisByGroup,
  searchEmojis,
} from "@/services/emojiService";

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  brandColor?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  open,
  onClose,
  onSelect,
  brandColor = "#128c7e",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState(EMOJI_GROUPS[0].id);
  const [emojis, setEmojis] = useState<EmojiFamilyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setEmojis([]);
      setError(null);
      setActiveGroup(EMOJI_GROUPS[0].id);
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
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const load = query.trim()
        ? searchEmojis(query)
        : fetchEmojisByGroup(activeGroup);
      load
        .then((list) => {
          if (!cancelled) setEmojis(list);
        })
        .catch((err) => {
          if (!cancelled) {
            setEmojis([]);
            setError(err instanceof Error ? err.message : "Could not load emojis");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, activeGroup]);

  if (!open) return null;

  return (
    <div
      className="shrink-0 border-t border-black/10 bg-white flex flex-col z-30"
      style={{ maxHeight: "min(42vh, 320px)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5">
        <div className="flex-1 flex items-center bg-[#f0f0f0] rounded-full px-3 gap-2 min-h-[36px]">
          <Search className="w-4 h-4 text-[#888] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="flex-1 text-[13px] bg-transparent outline-none py-1.5 text-[#111] placeholder:text-[#aaa]"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f0f0f0] text-[#666] shrink-0"
          aria-label="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!query.trim() && (
        <div className="shrink-0 flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-black/5 scrollbar-none">
          {EMOJI_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroup(g.id)}
              className={`shrink-0 w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                activeGroup === g.id ? "bg-[#e8f5f3]" : "bg-[#f5f5f5] hover:bg-[#eee]"
              }`}
              style={
                activeGroup === g.id
                  ? { outline: `2px solid ${brandColor}`, outlineOffset: -1 }
                  : undefined
              }
              aria-label={g.id}
              title={g.id}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {loading && emojis.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: brandColor }} />
          </div>
        )}
        {error && !loading && (
          <p className="text-center text-[13px] text-red-600 py-6 px-4">{error}</p>
        )}
        {!loading && !error && emojis.length === 0 && (
          <p className="text-center text-[13px] text-[#888] py-6">No emojis found</p>
        )}
        {emojis.length > 0 && (
          <div className="grid grid-cols-8 gap-0.5">
            {emojis.map((item) => (
              <button
                key={`${item.hexcode}-${item.emoji}`}
                type="button"
                onClick={() => onSelect(item.emoji)}
                className="aspect-square rounded-lg text-[22px] leading-none flex items-center justify-center hover:bg-[#f0f0f0] active:bg-[#e5e5e5] focus:outline-none"
                title={item.annotation}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-1.5 border-t border-black/5 flex justify-end">
        <a
          href="https://www.emoji.family"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#999] hover:text-[#666]"
        >
          emoji.family
        </a>
      </div>
    </div>
  );
};
