import React, { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { fetchTrendingGifs, GiphyGif, searchGifs } from "@/services/giphyService";

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GiphyGif) => void;
  brandColor?: string;
}

export const GifPicker: React.FC<GifPickerProps> = ({
  open,
  onClose,
  onSelect,
  brandColor = "#128c7e",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setGifs([]);
      setError(null);
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
      const load = query.trim() ? searchGifs(query) : fetchTrendingGifs();
      load
        .then((list) => {
          if (!cancelled) setGifs(list);
        })
        .catch((err) => {
          if (!cancelled) {
            setGifs([]);
            setError(err instanceof Error ? err.message : "Could not load GIFs");
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
  }, [open, query]);

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
            placeholder="Search GIFs"
            className="flex-1 text-[13px] bg-transparent outline-none py-1.5 text-[#111] placeholder:text-[#aaa]"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f0f0f0] text-[#666] shrink-0"
          aria-label="Close GIF picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {loading && gifs.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: brandColor }} />
          </div>
        )}
        {error && !loading && (
          <p className="text-center text-[13px] text-red-600 py-6 px-4">{error}</p>
        )}
        {!loading && !error && gifs.length === 0 && (
          <p className="text-center text-[13px] text-[#888] py-6">No GIFs found</p>
        )}
        {gifs.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif)}
                className="relative aspect-square rounded-lg overflow-hidden bg-[#f0f0f0] active:opacity-80 focus:outline-none"
                title={gif.title}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title || "GIF"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-1.5 border-t border-black/5 flex justify-end">
        <img
          src="https://giphy.com/static/img/powered-by-giphy.png"
          alt="Powered by GIPHY"
          className="h-3.5 opacity-70"
        />
      </div>
    </div>
  );
};
