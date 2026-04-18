import React, { useState } from "react";

/**
 * Icons8Icon — displays a colorful / animated icon from Icons8 CDN.
 *
 * Styles available (best for quiz app visuals):
 *   "animated-fluency"  → smooth Lottie-style GIF animations  ✨
 *   "fluency"           → flat colorful static  🎨
 *   "color"             → rich, detailed color PNGs
 *   "nolan"             → outline + color gradient
 *   "doodle"            → hand-drawn playful look
 *
 * Size: Icons8 supports 48, 96 etc.
 * Pass `animated` prop to use "animated-fluency" style.
 */

type Icons8Style =
  | "animated-fluency"
  | "fluency"
  | "color"
  | "nolan"
  | "doodle"
  | "3d-fluency"
  | "emoji";

interface Icons8IconProps {
  /** Icons8 icon slug, e.g. "trophy", "brain", "music" */
  name: string;
  /** Pixel size (48 | 96 | 128). Default: 96 */
  size?: 48 | 64 | 96 | 128;
  /** Icons8 style. Default: "animated-fluency" */
  style?: Icons8Style;
  /** Alt text */
  alt?: string;
  /** Extra CSS class names */
  className?: string;
  /** Fallback emoji if image fails to load */
  fallback?: string;
}

const Icons8Icon: React.FC<Icons8IconProps> = ({
  name,
  size = 96,
  style = "animated-fluency",
  alt = "",
  className = "",
  fallback = "🎯",
}) => {
  const [failed, setFailed] = useState(false);

  // Animated fluency uses GIF, others use PNG
  const ext = style === "animated-fluency" ? "gif" : "png";
  const src = `https://img.icons8.com/${style}/${size}/${name}.${ext}`;

  if (failed) {
    return (
      <span
        className={`flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: size * 0.55 }}
      >
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
};

export default Icons8Icon;

// ─── Pre-mapped slugs for quiz categories ────────────────────────────────────
/**
 * Returns the best Icons8 slug for a given category name.
 * Extend this map as you add categories.
 */
export function getCategoryIconSlug(categoryName: string): {
  slug: string;
  fallback: string;
} {
  const lower = categoryName.toLowerCase();

  if (lower.includes("k-pop") || lower.includes("kpop"))
    return { slug: "musical-notes", fallback: "🎤" };
  if (lower.includes("squid"))
    return { slug: "octopus", fallback: "🦑" };
  if (lower.includes("drama") || lower.includes("movie") || lower.includes("film"))
    return { slug: "film", fallback: "🎬" };
  if (lower.includes("english") || lower.includes("vocab"))
    return { slug: "literature", fallback: "📘" };
  if (lower.includes("urdu"))
    return { slug: "open-book", fallback: "📗" };
  if (lower.includes("logo") || lower.includes("brand"))
    return { slug: "verified-badge", fallback: "🧠" };
  if (lower.includes("science") || lower.includes("biology") || lower.includes("chemistry"))
    return { slug: "test-tube", fallback: "🔬" };
  if (lower.includes("physics"))
    return { slug: "physics", fallback: "⚛️" };
  if (lower.includes("math") || lower.includes("maths"))
    return { slug: "calculator", fallback: "🔢" };
  if (lower.includes("history"))
    return { slug: "scroll", fallback: "📜" };
  if (lower.includes("geography") || lower.includes("geo"))
    return { slug: "globe", fallback: "🌍" };
  if (lower.includes("sport") || lower.includes("football") || lower.includes("soccer"))
    return { slug: "football-2", fallback: "⚽" };
  if (lower.includes("cricket"))
    return { slug: "cricket", fallback: "🏏" };
  if (lower.includes("music"))
    return { slug: "musical-notes", fallback: "🎵" };
  if (lower.includes("art"))
    return { slug: "paint-palette", fallback: "🎨" };
  if (lower.includes("food") || lower.includes("cooking"))
    return { slug: "food-bar", fallback: "🍕" };
  if (lower.includes("tech") || lower.includes("computer") || lower.includes("coding"))
    return { slug: "source-code", fallback: "💻" };
  if (lower.includes("animal") || lower.includes("zoo"))
    return { slug: "paw-print", fallback: "🐾" };
  if (lower.includes("game") || lower.includes("gaming"))
    return { slug: "controller", fallback: "🎮" };
  if (lower.includes("flag"))
    return { slug: "flag", fallback: "🚩" };
  if (lower.includes("capital") || lower.includes("city"))
    return { slug: "city", fallback: "🏙️" };
  if (lower.includes("celebrity") || lower.includes("famous"))
    return { slug: "star", fallback: "⭐" };
  if (lower.includes("pokemon") || lower.includes("anime"))
    return { slug: "pokemon-go-app", fallback: "⚡" };
  if (lower.includes("harry potter") || lower.includes("wizard"))
    return { slug: "wizard", fallback: "🧙" };
  if (lower.includes("marvel") || lower.includes("superhero"))
    return { slug: "spider-man-head", fallback: "🦸" };
  if (lower.includes("religion") || lower.includes("islam") || lower.includes("quran"))
    return { slug: "quran", fallback: "📿" };

  // Generic brain/quiz fallback
  return { slug: "brain", fallback: "🧠" };
}
