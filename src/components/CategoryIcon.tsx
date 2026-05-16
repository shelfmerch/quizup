import React, { useState } from "react";
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
  const iconRaw = category.icon;

  if (iconRaw && !errored) {
    // Basic check to see if it's likely a URL
    if (iconRaw.startsWith("http") || iconRaw.startsWith("/") || iconRaw.startsWith("data:image")) {
      // For actual image uploads/links, we want them larger and with less padding
      // to fill the category tile better.
      const imgUrlClass = `${className} p-0.5 scale-95`;
      return (
        <img
          src={iconRaw}
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
    // Else treat as emoji
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
