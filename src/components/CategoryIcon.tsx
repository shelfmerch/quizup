import React, { useState } from "react";
import { isCategoryIconImage, resolveCategoryIconUrl } from "@/lib/categoryIcon";
import { getCategoryIconSlug } from "./Icons8Icon";

interface CategoryIconProps {
  category: { name: string; icon?: string };
  size?: number;
  className?: string;
  style?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 48,
  className = "",
  style = "animated-fluency"
}) => {
  const [errored, setErrored] = useState(false);
  const iconRaw = category.icon?.trim();
  const iconSrc = resolveCategoryIconUrl(iconRaw);

  if (iconSrc && !errored) {
    const imgUrlClass = `${className} p-0.5 scale-95`;
    return (
      <img
        src={iconSrc}
        alt={category.name}
        width={size}
        height={size}
        className={imgUrlClass}
        onError={() => setErrored(true)}
        draggable={false}
        style={{ objectFit: "contain" }}
      />
    );
  }

  if (iconRaw && !isCategoryIconImage(iconRaw) && !errored) {
    const emojiClass = `${className} p-1.5 scale-[0.8]`;
    return (
      <span
        className={emojiClass}
        role="img"
        aria-label={category.name}
        style={{ fontSize: size * 0.7, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        {iconRaw}
      </span>
    );
  }

  // Fallback to old Icons8 logic
  const { slug, fallback } = getCategoryIconSlug(category.name);
  if (!slug || errored) {
    return (
      <span
        className={className}
        role="img"
        aria-label={category.name}
        style={{ fontSize: size * 0.6, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        {fallback}
      </span>
    );
  }

  const isAnimated = style.startsWith("animated");
  const ext = isAnimated ? "gif" : "png";
  const src = `https://img.icons8.com/${style}/${size}/${slug}.${ext}`;

  return (
    <img
      src={src}
      alt={category.name}
      width={size}
      height={size}
      className={className}
      onError={() => setErrored(true)}
      draggable={false}
      style={{ objectFit: "contain" }}
    />
  );
};
