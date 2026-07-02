import { APP_URL } from "@/config/env";

export const SITE_NAME = "QuizUp";
export const SITE_TAGLINE = "Real-time 1v1 quiz battles";
export const SITE_DESCRIPTION =
  "Challenge friends in live trivia battles across thousands of topics. Compete 1v1, climb the leaderboard, and join the QuizUp community.";
export const SITE_KEYWORDS =
  "quiz, trivia, quiz game, multiplayer quiz, 1v1 quiz, quiz battle, trivia challenge, QuizUp";
export const DEFAULT_OG_IMAGE = `${APP_URL}/images/quiz.png`;
export const TWITTER_HANDLE = "@quizup";

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function formatPageTitle(title?: string): string {
  if (!title || title === SITE_NAME) return SITE_NAME;
  return `${title} | ${SITE_NAME}`;
}

/** HashRouter canonical: `https://quizup.site/#/path` */
export function hashCanonicalUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${APP_URL}/#${path === "/" ? "/" : path}`;
}

export function shareChallengeUrl(challengeId: string): string {
  return `${APP_URL}/share/challenge/${challengeId}`;
}

export function shareCategoryUrl(categoryId: string): string {
  return `${APP_URL}/share/category/${categoryId}`;
}

export const ROUTE_SEO: Record<string, SEOConfig> = {
  "/landing": {
    title: `${SITE_NAME} — Live Trivia Battles`,
    description: SITE_DESCRIPTION,
    type: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: APP_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web, Android",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  },
  "/login": {
    title: "Log In",
    description: `Sign in to ${SITE_NAME} and jump into live 1v1 quiz battles.`,
    noindex: true,
  },
  "/signup": {
    title: "Sign Up",
    description: `Create your free ${SITE_NAME} account and start challenging friends in real-time trivia.`,
    noindex: true,
  },
};

export const DEFAULT_APP_SEO: SEOConfig = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  noindex: true,
};
