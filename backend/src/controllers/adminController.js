const Category = require("../models/Category");
const Question = require("../models/Question");

const normalizeImageUrl = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > 2048) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return s;
  return null;
};

const slugify = (name) => {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "topic";
};

const syncQuestionCount = async (categorySlug) => {
  const count = await Question.countDocuments({ categoryId: categorySlug, isActive: true });
  await Category.findOneAndUpdate({ slug: categorySlug }, { questionCount: count });
};

// GET /api/admin/categories
const listCategories = async (_req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    const shaped = categories.map((c) => ({
      id: c.slug,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
      description: c.description,
      questionCount: c.questionCount,
      isActive: c.isActive,
    }));
    return res.json({ categories: shaped });
  } catch (err) {
    console.error("[Admin] listCategories error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// POST /api/admin/categories  { name, slug?, icon?, color?, description? }
const createCategory = async (req, res) => {
  try {
    const { name, icon = "🎯", color = "160 84% 44%", description = "" } = req.body;
    let { slug } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(422).json({ error: "name is required" });
    }

    slug = (slug && String(slug).trim()) || slugify(name);
    slug = slug.toLowerCase();

    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(409).json({ error: "A topic with this slug already exists" });
    }

    const cat = await Category.create({
      slug,
      name: name.trim(),
      icon: String(icon).trim() || "🎯",
      color: String(color).trim() || "160 84% 44%",
      description: String(description).trim(),
      questionCount: 0,
      isActive: true,
    });

    return res.status(201).json({
      category: {
        id: cat.slug,
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        description: cat.description,
        questionCount: 0,
        isActive: cat.isActive,
      },
    });
  } catch (err) {
    console.error("[Admin] createCategory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/admin/questions?categoryId=slug
const listQuestions = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) {
      return res.status(422).json({ error: "categoryId query is required" });
    }

    const questions = await Question.find({ categoryId: String(categoryId) })
      .sort({ createdAt: -1 })
      .lean();

    const shaped = questions.map((q) => ({
      id: q._id.toString(),
      categoryId: q.categoryId,
      text: q.text,
      imageUrl: q.imageUrl || null,
      options: q.options,
      correctIndex: q.correctIndex,
      timeLimit: q.timeLimit,
      isActive: q.isActive,
    }));

    return res.json({ questions: shaped });
  } catch (err) {
    console.error("[Admin] listQuestions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// POST /api/admin/questions
// { categoryId, text, options: string[4], correctIndex, timeLimit? }
const createQuestion = async (req, res) => {
  try {
    const {
      categoryId,
      text,
      options,
      correctIndex,
      timeLimit = 10,
      imageUrl: imageUrlRaw,
    } = req.body;

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(422).json({ error: "categoryId is required" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(422).json({ error: "text is required" });
    }
    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(422).json({ error: "options must be an array of exactly 4 strings" });
    }
    const opts = options.map((o) => String(o).trim());
    if (opts.some((o) => !o)) {
      return res.status(422).json({ error: "Each option must be non-empty" });
    }
    const ci = Number(correctIndex);
    if (!Number.isInteger(ci) || ci < 0 || ci > 3) {
      return res.status(422).json({ error: "correctIndex must be 0, 1, 2, or 3" });
    }
    const tl = Math.min(120, Math.max(5, Number(timeLimit) || 10));

    const cat = await Category.findOne({ slug: categoryId.trim().toLowerCase() });
    if (!cat) {
      return res.status(404).json({ error: "Topic (category) not found" });
    }

    const imageUrl = normalizeImageUrl(imageUrlRaw);
    if (imageUrlRaw && imageUrlRaw !== "" && !imageUrl) {
      return res.status(422).json({
        error: "imageUrl must be a valid http(s) URL or /uploads/... path from upload",
      });
    }

    const q = await Question.create({
      categoryId: cat.slug,
      text: text.trim(),
      imageUrl,
      options: opts,
      correctIndex: ci,
      timeLimit: tl,
      isActive: true,
    });

    await syncQuestionCount(cat.slug);

    return res.status(201).json({
      question: {
        id: q._id.toString(),
        categoryId: q.categoryId,
        text: q.text,
        imageUrl: q.imageUrl || null,
        options: q.options,
        correctIndex: q.correctIndex,
        timeLimit: q.timeLimit,
        isActive: q.isActive,
      },
    });
  } catch (err) {
    console.error("[Admin] createQuestion error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  listCategories,
  createCategory,
  listQuestions,
  createQuestion,
};
