import React, { useState } from "react";

interface Icons8IconProps {
  /** Icons8 icon slug, e.g. "home", "lightning-bolt" */
  name: string;
  /** Emoji or text to render if the image fails to load */
  fallback: string;
  /** Icon size in pixels (used in the CDN URL) */
  size?: number;
  /** Icons8 style, e.g. "animated-fluency", "fluency", "color" */
  style?: string;
  className?: string;
  alt?: string;
}

/**
 * Renders an animated icon from the Icons8 CDN.
 * Falls back to an emoji span if the image fails to load.
 *
 * CDN pattern:
 *   https://img.icons8.com/{style}/{size}/{slug}.gif  (animated styles)
 *   https://img.icons8.com/{style}/{size}/{slug}.png  (static styles)
 */
const Icons8Icon: React.FC<Icons8IconProps> = ({
  name,
  fallback,
  size = 48,
  style = "animated-fluency",
  className = "",
  alt = "",
}) => {
  const [errored, setErrored] = useState(false);

  if (!name || errored) {
    return (
      <span
        className={className}
        role="img"
        aria-label={alt || fallback}
        style={{ fontSize: size * 0.6, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        {fallback}
      </span>
    );
  }

  const isAnimated = style.startsWith("animated");
  const ext = isAnimated ? "gif" : "png";
  const src = `https://img.icons8.com/${style}/${size}/${name}.${ext}`;

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
};

export default Icons8Icon;

// ─── Category → Icon slug mapping ────────────────────────────────────────────
// Keys are lowercased category names (exact match first, then substring).
// Icons8 animated-fluency slugs: https://img.icons8.com/animated-fluency/96/<slug>.gif

/** Exact-name → icon, checked before substring keywords */
const EXACT_MAP: Record<string, { slug: string; fallback: string }> = {
  // ── Core quiz categories ──────────────────────────────────────────────────
  "science":         { slug: "microscope",           fallback: "🔬" },
  "geography":       { slug: "globe",                fallback: "🌍" },
  "history":         { slug: "scroll",               fallback: "📜" },
  "movies":          { slug: "clapperboard",         fallback: "🎬" },
  "sports":          { slug: "trophy",               fallback: "🏆" },
  "music":           { slug: "musical-notes",        fallback: "🎵" },
  "technology":      { slug: "circuit",              fallback: "💻" },
  "literature":      { slug: "open-book",            fallback: "📚" },
  "gaming":          { slug: "game-controller",      fallback: "🎮" },
  "food & drink":    { slug: "spaghetti",            fallback: "🍝" },
  "nature":          { slug: "oak-tree",             fallback: "🌿" },
  "art & design":    { slug: "paint-palette",        fallback: "🎨" },
  // ── Niche / extra categories ─────────────────────────────────────────────
  "k-pop":           { slug: "star",                 fallback: "⭐" },
  "squid game":      { slug: "squid",                fallback: "🦑" },
  "pak dramas":      { slug: "tv",                   fallback: "📺" },
  "english":         { slug: "literature",           fallback: "📘" },
  "urdu":            { slug: "quran",                fallback: "📗" },
  "logos":           { slug: "brand",                fallback: "🏷️" },
  // ── Common variants ───────────────────────────────────────────────────────
  "biology":         { slug: "dna",                  fallback: "🧬" },
  "chemistry":       { slug: "flask",                fallback: "⚗️" },
  "physics":         { slug: "physics",              fallback: "⚛️" },
  "astronomy":       { slug: "telescope",            fallback: "🔭" },
  "space":           { slug: "rocket",               fallback: "🚀" },
  "animals":         { slug: "paw-print",            fallback: "🐾" },
  "television":      { slug: "tv",                   fallback: "📺" },
  "mathematics":     { slug: "calculator",           fallback: "🔢" },
  "math":            { slug: "calculator",           fallback: "🔢" },
  "coding":          { slug: "code",                 fallback: "💻" },
  "football":        { slug: "football",             fallback: "⚽" },
  "soccer":          { slug: "football",             fallback: "⚽" },
  "basketball":      { slug: "basketball",           fallback: "🏀" },
  "tennis":          { slug: "tennis",               fallback: "🎾" },
  "food":            { slug: "spaghetti",            fallback: "🍝" },
  "cooking":         { slug: "cooking",              fallback: "👨‍🍳" },
  "travel":          { slug: "passport",             fallback: "✈️" },
  "politics":        { slug: "capitol-hill",         fallback: "🏛️" },
  "art":             { slug: "paint-palette",        fallback: "🎨" },
  "film":            { slug: "clapperboard",         fallback: "🎬" },
  "language":        { slug: "translate",            fallback: "💬" },
  "general":         { slug: "idea",                 fallback: "💡" },
  "trivia":          { slug: "lightning-bolt",       fallback: "⚡" },
};

/**
 * Returns an Icons8 slug and emoji fallback for a category name.
 * 1. Exact match (case-insensitive)
 * 2. First substring keyword match
 * 3. Default fallback
 */
export function getCategoryIconSlug(categoryName: string): { slug: string; fallback: string } {
  const lower = categoryName.toLowerCase().trim();

  // 1. exact
  if (EXACT_MAP[lower]) return EXACT_MAP[lower];

  // 2. substring — iterate in insertion order so longer/more-specific keys win
  for (const [key, info] of Object.entries(EXACT_MAP)) {
    if (lower.includes(key)) return info;
  }

  // 3. default
  return { slug: "idea", fallback: "💡" };
}
