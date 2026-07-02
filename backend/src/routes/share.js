const express = require("express");
const Category = require("../models/Category");
const { getChallengeById } = require("../sockets/challenge");
const { renderSharePageHtml } = require("../utils/sharePageHtml");

const router = express.Router();

function appBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "https://quizup.site"
  ).replace(/\/+$/, "");
}

function hashAppUrl(path) {
  const base = appBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}/#${normalized}`;
}

router.get("/challenge/:challengeId", (req, res) => {
  const baseUrl = appBaseUrl();
  const { challengeId } = req.params;
  const redirectUrl = hashAppUrl(`/challenge/${challengeId}`);
  const pageUrl = `${baseUrl}/share/challenge/${challengeId}`;
  const challenge = getChallengeById(challengeId);

  const title = challenge
    ? `${challenge.fromUsername} challenged you on QuizUp`
    : "QuizUp Challenge";
  const description = challenge
    ? `Join a live ${challenge.categoryName} quiz battle on QuizUp!`
    : "Accept the challenge and battle in real-time trivia on QuizUp.";

  res.type("html").send(
    renderSharePageHtml({
      baseUrl,
      title,
      description,
      pageUrl,
      redirectUrl,
      noindex: true,
    })
  );
});

router.get("/category/:categoryId", async (req, res) => {
  const baseUrl = appBaseUrl();
  const { categoryId } = req.params;
  const redirectUrl = hashAppUrl(`/find-match/${categoryId}`);
  const pageUrl = `${baseUrl}/share/category/${categoryId}`;

  let title = "QuizUp Trivia Challenge";
  let description = "Challenge a friend to a live quiz battle on QuizUp.";

  try {
    const lookup = /^[a-f\d]{24}$/i.test(categoryId)
      ? { $or: [{ slug: categoryId }, { _id: categoryId }], isActive: true }
      : { slug: categoryId, isActive: true };

    const category = await Category.findOne(lookup)
      .select("name description")
      .lean();

    if (category?.name) {
      title = `${category.name} Quiz on QuizUp`;
      description =
        category.description?.trim() ||
        `Battle in ${category.name} trivia — real-time 1v1 quizzes on QuizUp.`;
    }
  } catch (err) {
    console.warn("[share] category lookup failed:", err.message);
  }

  res.type("html").send(
    renderSharePageHtml({
      baseUrl,
      title,
      description,
      pageUrl,
      redirectUrl,
      noindex: true,
    })
  );
});

module.exports = router;
