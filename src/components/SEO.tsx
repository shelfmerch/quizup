import { useEffect } from "react";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  TWITTER_HANDLE,
  formatPageTitle,
  type SEOConfig,
} from "@/config/seo";

type MetaAttr = "name" | "property";

function upsertMeta(attr: MetaAttr, key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: MetaAttr, key: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeLink(rel: string) {
  document.querySelector(`link[rel="${rel}"]`)?.remove();
}

const MANAGED_META: Array<{ attr: MetaAttr; key: string }> = [
  { attr: "name", key: "description" },
  { attr: "name", key: "robots" },
  { attr: "property", key: "og:title" },
  { attr: "property", key: "og:description" },
  { attr: "property", key: "og:image" },
  { attr: "property", key: "og:url" },
  { attr: "property", key: "og:type" },
  { attr: "property", key: "og:site_name" },
  { attr: "name", key: "twitter:card" },
  { attr: "name", key: "twitter:title" },
  { attr: "name", key: "twitter:description" },
  { attr: "name", key: "twitter:image" },
  { attr: "name", key: "twitter:site" },
];

const JSON_LD_ID = "quizup-json-ld";

const SEO: React.FC<SEOConfig> = ({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  url,
  type = "website",
  noindex = false,
  jsonLd,
}) => {
  useEffect(() => {
    const pageTitle = formatPageTitle(title);
    const desc = description ?? "";
    const canonical = url;

    document.title = pageTitle;

    upsertMeta("name", "description", desc);

    if (noindex) {
      upsertMeta("name", "robots", "noindex, nofollow");
    } else {
      removeMeta("name", "robots");
    }

    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", SITE_NAME);
    if (canonical) {
      upsertMeta("property", "og:url", canonical);
      upsertLink("canonical", canonical);
    } else {
      removeMeta("property", "og:url");
      removeLink("canonical");
    }

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", image);
    upsertMeta("name", "twitter:site", TWITTER_HANDLE);

    const existingJsonLd = document.getElementById(JSON_LD_ID);
    if (jsonLd) {
      const script = existingJsonLd ?? document.createElement("script");
      script.id = JSON_LD_ID;
      script.setAttribute("type", "application/ld+json");
      script.textContent = JSON.stringify(jsonLd);
      if (!existingJsonLd) document.head.appendChild(script);
    } else {
      existingJsonLd?.remove();
    }

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
      MANAGED_META.forEach(({ attr, key }) => removeMeta(attr, key));
      removeLink("canonical");
    };
  }, [title, description, image, url, type, noindex, jsonLd]);

  return null;
};

export default SEO;
