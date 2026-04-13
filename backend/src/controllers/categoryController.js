const Category = require("../models/Category");

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    // Shape to match frontend Category type
    const shaped = categories.map((c) => ({
      id: c.slug,
      name: c.name,
      icon: c.icon,
      color: c.color,
      questionCount: c.questionCount,
      description: c.description,
    }));

    return res.json({ categories: shaped });
  } catch (err) {
    console.error("[Category] getCategories error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getCategories };
