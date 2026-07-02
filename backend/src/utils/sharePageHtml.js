const DEFAULT_DESCRIPTION = "Real-time 1v1 quiz battles on QuizUp.";
const DEFAULT_IMAGE = "/images/quiz.png";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(base, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Minimal HTML page with Open Graph / Twitter meta for crawlers,
 * plus a redirect for human visitors into the HashRouter app.
 */
function renderSharePageHtml({
  baseUrl,
  title,
  description = DEFAULT_DESCRIPTION,
  imagePath = DEFAULT_IMAGE,
  pageUrl,
  redirectUrl,
  noindex = true,
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safePageUrl = escapeHtml(pageUrl);
  const safeRedirectUrl = escapeHtml(redirectUrl);
  const imageUrl = escapeHtml(absoluteUrl(baseUrl, imagePath));
  const robots = noindex ? "noindex, nofollow" : "index, follow";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta name="robots" content="${robots}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${safePageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="QuizUp" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${safePageUrl}" />
  <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}" />
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body>
  <p>Redirecting to <a href="${safeRedirectUrl}">${safeTitle}</a>…</p>
</body>
</html>`;
}

module.exports = { renderSharePageHtml, absoluteUrl };
