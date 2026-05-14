const Category = require("../models/Category");
const Question = require("../models/Question");
const { syncQuestionCount } = require("../services/categoryQuestionCount");
const { resolveEmptyImageFromSerp, resolveEmptyImageFromCustom } = require("../services/serpImageSearch");

const normalizeImageUrl = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > 2048) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/")) return s;
  return null;
};

/**
 * Supports JSON shapes that use either `correctIndex` or `answer`.
 * - If `correctIndex` is present, it is validated and used.
 * - Else if `answer` is a number 0-3, it's used as correctIndex.
 * - Else if `answer` is a string, it must match one of the 4 options.
 * @param {unknown} correctIndexRaw
 * @param {unknown} answerRaw
 * @param {string[]} opts
 * @returns {number}
 */
const resolveCorrectIndex = (correctIndexRaw, answerRaw, opts) => {
  const hasCorrectIndex = correctIndexRaw !== undefined && correctIndexRaw !== null && String(correctIndexRaw).trim() !== "";
  if (hasCorrectIndex) {
    const ci = Number(correctIndexRaw);
    if (!Number.isInteger(ci) || ci < 0 || ci > 3) {
      throw new Error("correctIndex must be 0, 1, 2, or 3");
    }
    return ci;
  }

  if (answerRaw === undefined || answerRaw === null) {
    throw new Error("Either correctIndex or answer is required");
  }

  if (typeof answerRaw === "number") {
    const ai = Number(answerRaw);
    if (!Number.isInteger(ai) || ai < 0 || ai > 3) {
      throw new Error("answer as a number must be 0, 1, 2, or 3");
    }
    return ai;
  }

  const answer = String(answerRaw).trim();
  if (!answer) {
    throw new Error("answer must be a non-empty string (or a number 0-3)");
  }

  const idx = opts.findIndex((o) => o.trim().toLowerCase() === answer.toLowerCase());
  if (idx === -1) {
    throw new Error("answer must match one of the provided options");
  }
  return idx;
};

const slugify = (name) => {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "topic";
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
      questionType: q.questionType || (q.imageUrl ? "IMAGE" : "TEXT"),
      conceptKey: q.conceptKey || "",
      difficulty: q.difficulty ?? 5,
      source: q.source || "MANUAL",
      verified: q.verified ?? false,
      tags: q.tags || [],
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
// { categoryId, text, options: string[4], correctIndex? | answer?, timeLimit?, imageUrl? }
const createQuestion = async (req, res) => {
  try {
    const {
      categoryId,
      text,
      options,
      correctIndex,
      answer,
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
    let ci;
    try {
      ci = resolveCorrectIndex(correctIndex, answer, opts);
    } catch (e) {
      return res.status(422).json({ error: e instanceof Error ? e.message : "Invalid correct answer" });
    }
    const tl = Math.min(120, Math.max(5, Number(timeLimit) || 10));

    const cat = await Category.findOne({ slug: categoryId.trim().toLowerCase() });
    if (!cat) {
      return res.status(404).json({ error: "Topic (category) not found" });
    }

    const rawImageTrimmed = imageUrlRaw == null ? "" : String(imageUrlRaw).trim();
    let imageUrl = normalizeImageUrl(imageUrlRaw);
    if (!imageUrl && rawImageTrimmed === "") {
      imageUrl = await resolveEmptyImageFromSerp(text.trim(), opts[ci]);
    }
    if (rawImageTrimmed && !imageUrl) {
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

const generateQuestionsQueued = async (req, res) => {
  try {
    const { categoryId, count } = req.body;
    if (!categoryId || typeof categoryId !== "string") {
      return res.status(422).json({ error: "categoryId is required" });
    }
    const slug = categoryId.trim().toLowerCase();
    const cat = await Category.findOne({ slug });
    if (!cat) {
      return res.status(404).json({ error: "Topic (category) not found" });
    }

    const { enqueueQuestionGeneration } = require("../queue/questionPipelineQueue");
    const { jobIds, batches } = await enqueueQuestionGeneration({ categoryId: slug, count });

    return res.status(202).json({
      accepted: true,
      categoryId: slug,
      jobIds,
      batches,
      message: "Jobs queued. Generation runs in the background.",
    });
  } catch (err) {
    console.error("[Admin] generateQuestionsQueued error:", err);
    const msg = String(err?.message || err || "");
    const isRedis =
      msg.includes("REDIS_URL") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("WRONGPASS") ||
      msg.includes("NOAUTH") ||
      msg.includes("Redis") ||
      msg.includes("Stream isn't writeable") ||
      msg.includes("enableOfflineQueue");
    if (isRedis) {
      return res.status(503).json({
        error:
          "Cannot reach Redis for the job queue. Set REDIS_URL on the server. Redis Cloud often requires rediss:// (TLS) on port 6380.",
      });
    }
    if (msg.includes("Cannot find module") || msg.includes("bullmq")) {
      return res.status(503).json({
        error: "Queue package missing on server. Run npm install in the backend folder and restart.",
      });
    }
    const dev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: "Failed to queue generation",
      ...(dev ? { detail: msg } : {}),
    });
  }
};

// POST /api/admin/questions/bulk
// { categoryId, questions: [...], autoImageProvider?: "searchstack"|"custom", customImageApiUrl?: string }
const createBulkQuestions = async (req, res) => {
  try {
    const { categoryId, questions, autoImageProvider = "searchstack", customImageApiUrl = "" } = req.body;

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(422).json({ error: "categoryId is required" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(422).json({ error: "questions must be a non-empty array" });
    }
    if (questions.length > 200) {
      return res.status(422).json({ error: "Maximum 200 questions per bulk request" });
    }

    const provider = String(autoImageProvider || "searchstack").toLowerCase();
    const customTemplate = String(customImageApiUrl || "").trim();
    if (provider === "custom") {
      if (!customTemplate) {
        return res.status(422).json({ error: "customImageApiUrl is required when autoImageProvider is custom" });
      }
      if (!customTemplate.includes("{query}")) {
        return res.status(422).json({
          error: "customImageApiUrl must include the literal {query} placeholder (replaced with a search string)",
        });
      }
      if (!/^https:\/\//i.test(customTemplate) || customTemplate.length > 2048) {
        return res.status(422).json({ error: "customImageApiUrl must be an https URL (max 2048 chars)" });
      }
    } else if (provider !== "searchstack") {
      return res.status(422).json({ error: "autoImageProvider must be searchstack or custom" });
    }

    const slug = categoryId.trim().toLowerCase();
    const cat = await Category.findOne({ slug });
    if (!cat) {
      return res.status(404).json({ error: "Topic (category) not found" });
    }

    const results = [];
    let successCount = 0;
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      const raw = questions[i];
      try {
        // Validate text
        if (!raw.text || typeof raw.text !== "string" || !raw.text.trim()) {
          throw new Error("text is required");
        }
        // Validate options
        if (!Array.isArray(raw.options) || raw.options.length !== 4) {
          throw new Error("options must be an array of exactly 4 strings");
        }
        const opts = raw.options.map((o) => String(o).trim());
        if (opts.some((o) => !o)) {
          throw new Error("Each option must be non-empty");
        }
        // Resolve correctIndex (supports `answer` field)
        const ci = resolveCorrectIndex(raw.correctIndex, raw.answer, opts);
        // TimeLimit
        const tl = Math.min(120, Math.max(5, Number(raw.timeLimit) || 10));
        // ImageUrl — empty/missing: SearchStack (SEARCHSTACK_KEY) or admin-provided custom HTTPS template
        let imageUrl = normalizeImageUrl(raw.imageUrl);
        if (!imageUrl) {
          if (provider === "custom") {
            imageUrl = await resolveEmptyImageFromCustom(customTemplate, raw.text.trim(), opts[ci]);
          } else {
            let directQ = raw.answer ? raw.answer.trim() : null;
            if (directQ && slug === "logos" && !directQ.toLowerCase().includes("logo")) {
              directQ += " logo";
            }
            imageUrl = await resolveEmptyImageFromSerp(raw.text.trim(), opts[ci], directQ);
          }
        }

        const q = await Question.create({
          categoryId: slug,
          text: raw.text.trim(),
          imageUrl,
          options: opts,
          correctIndex: ci,
          timeLimit: tl,
          isActive: true,
          source: "MANUAL",
        });

        successCount++;
        results.push({
          index: i,
          ok: true,
          id: q._id.toString(),
          text: q.text,
        });
      } catch (qErr) {
        errors.push({
          index: i,
          ok: false,
          text: raw.text || `(question #${i + 1})`,
          error: qErr.message || "Validation failed",
        });
      }
    }

    if (successCount > 0) {
      await syncQuestionCount(slug);
    }

    return res.status(201).json({
      created: successCount,
      failed: errors.length,
      total: questions.length,
      results,
      errors,
    });
  } catch (err) {
    console.error("[Admin] createBulkQuestions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  listCategories,
  createCategory,
  listQuestions,
  createQuestion,
  createBulkQuestions,
  generateQuestionsQueued,
};
