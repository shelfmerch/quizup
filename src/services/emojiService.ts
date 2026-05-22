import { API_URL } from "@/config/env";

/** Proxied via our API to avoid browser CORS blocks on emoji.family */
const BASE = `${API_URL}/emojis`;

export interface EmojiFamilyItem {
  emoji: string;
  hexcode: string;
  group: string;
  subgroup: string;
  annotation: string;
  tags: string[];
  shortcodes: string[];
  emoticons: string[];
  directional: boolean;
  variation: boolean;
  order: number;
}

export const EMOJI_GROUPS: { id: string; label: string }[] = [
  { id: "smileys-emotion", label: "😀" },
  { id: "people-body", label: "👋" },
  { id: "animals-nature", label: "🐶" },
  { id: "food-drink", label: "🍕" },
  { id: "travel-places", label: "✈️" },
  { id: "activities", label: "⚽" },
  { id: "objects", label: "💡" },
  { id: "symbols", label: "❤️" },
  { id: "flags", label: "🏳️" },
];

const DEFAULT_GROUP = EMOJI_GROUPS[0].id;

export async function fetchEmojis(options?: {
  group?: string;
  search?: string;
  tag?: string;
}): Promise<EmojiFamilyItem[]> {
  const qs = new URLSearchParams();
  const group = options?.group?.trim();
  const search = options?.search?.trim();
  const tag = options?.tag?.trim();

  if (group) qs.set("group", group);
  if (search) qs.set("search", search);
  if (tag) qs.set("tag", tag);

  const url = qs.toString() ? `${BASE}?${qs}` : `${BASE}?group=${DEFAULT_GROUP}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Could not reach emoji service. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as EmojiFamilyItem[] | { error?: string } | null;
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && data.error
        ? String(data.error)
        : "Could not load emojis";
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export function fetchEmojisByGroup(group: string): Promise<EmojiFamilyItem[]> {
  return fetchEmojis({ group: group || DEFAULT_GROUP });
}

export function searchEmojis(query: string): Promise<EmojiFamilyItem[]> {
  const q = query.trim();
  if (!q) return fetchEmojisByGroup(DEFAULT_GROUP);
  return fetchEmojis({ search: q });
}
