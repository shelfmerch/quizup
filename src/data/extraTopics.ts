import { Category } from "@/types";

/** Merged with API categories when missing (e.g. before seed). After seed, API values win. */
export const EXTRA_HOME_TOPICS: Category[] = [
  {
    id: "k-pop",
    name: "K-Pop",
    icon: "🎤",
    color: "330 80% 58%",
    questionCount: 0,
    description: "Korean pop, groups, and idols",
  },
  {
    id: "squid-game",
    name: "Squid Game",
    icon: "🦑",
    color: "142 65% 42%",
    questionCount: 0,
    description: "The Netflix series — trivia and lore",
  },
  {
    id: "pak-dramas",
    name: "Pak Dramas",
    icon: "🎬",
    color: "24 90% 55%",
    questionCount: 0,
    description: "Pakistani dramas — iconic stories & characters",
  },
  {
    id: "english",
    name: "English",
    icon: "📘",
    color: "210 85% 55%",
    questionCount: 0,
    description: "Vocabulary, meanings, and usage",
  },
  {
    id: "urdu",
    name: "Urdu",
    icon: "📗",
    color: "152 69% 42%",
    questionCount: 0,
    description: "Urdu vocabulary — meanings and usage",
  },
];
