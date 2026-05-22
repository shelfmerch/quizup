import { GIPHY_API_KEY } from "@/config/env";

export interface GiphyGif {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
}

interface GiphyApiImage {
  url?: string;
}

interface GiphyApiItem {
  id: string;
  title?: string;
  images?: {
    fixed_height_small?: GiphyApiImage;
    preview_gif?: GiphyApiImage;
    fixed_height?: GiphyApiImage;
    downsized?: GiphyApiImage;
    original?: GiphyApiImage;
  };
}

interface GiphyApiResponse {
  data?: GiphyApiItem[];
}

const BASE = "https://api.giphy.com/v1/gifs";

function mapGif(item: GiphyApiItem): GiphyGif | null {
  const images = item.images;
  if (!images) return null;
  const url =
    images.downsized?.url ||
    images.fixed_height?.url ||
    images.original?.url ||
    images.preview_gif?.url;
  const previewUrl =
    images.fixed_height_small?.url ||
    images.preview_gif?.url ||
    images.fixed_height?.url ||
    url;
  if (!url) return null;
  return {
    id: item.id,
    title: item.title || "",
    previewUrl: previewUrl || url,
    url,
  };
}

async function fetchGifs(path: string, params: Record<string, string>): Promise<GiphyGif[]> {
  if (!GIPHY_API_KEY) {
    throw new Error("Giphy API key is not configured");
  }
  const qs = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: "24",
    rating: "pg-13",
    ...params,
  });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) {
    throw new Error("Could not load GIFs");
  }
  const json = (await res.json()) as GiphyApiResponse;
  return (json.data || []).map(mapGif).filter((g): g is GiphyGif => g !== null);
}

export function searchGifs(query: string): Promise<GiphyGif[]> {
  const q = query.trim();
  if (!q) return fetchTrendingGifs();
  return fetchGifs("/search", { q });
}

export function fetchTrendingGifs(): Promise<GiphyGif[]> {
  return fetchGifs("/trending", {});
}
