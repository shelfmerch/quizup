import { resolveMediaUrl } from "@/lib/mediaUrl";

/** True when `categories.icon` is an image URL/path (not an emoji). */
export function isCategoryIconImage(icon?: string | null): boolean {
  if (!icon?.trim()) return false;
  const t = icon.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/") || t.startsWith("data:image")) {
    return true;
  }
  if (/\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(t)) return true;
  if (t.includes("amazonaws.com") || t.includes("/uploads/")) return true;
  return false;
}

/** Resolve `categories.icon` to a loadable image URL (S3 proxy, API base, etc.). */
export function resolveCategoryIconUrl(icon?: string | null): string | undefined {
  if (!isCategoryIconImage(icon)) return undefined;
  const resolved = resolveMediaUrl(icon!.trim(), "");
  return resolved || undefined;
}
