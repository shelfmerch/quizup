const Category = require("../models/Category");
const User = require("../models/User");

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

// GET /api/categories/followed (protected)
const getFollowedCategories = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("followedCategories").lean();
    const slugs = Array.isArray(me?.followedCategories) ? me.followedCategories : [];
    if (slugs.length === 0) return res.json({ categories: [] });

    const categories = await Category.find({ isActive: true, slug: { $in: slugs } }).lean();
    const bySlug = new Map(categories.map((c) => [c.slug, c]));

    // preserve user order
    const shaped = slugs
      .map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .map((c) => ({
        id: c.slug,
        name: c.name,
        icon: c.icon,
        color: c.color,
        questionCount: c.questionCount,
        description: c.description,
      }));

    return res.json({ categories: shaped });
  } catch (err) {
    console.error("[Category] getFollowedCategories error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// POST /api/categories/:slug/follow (protected)
const followCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const cat = await Category.findOne({ slug, isActive: true }).select("slug").lean();
    if (!cat) return res.status(404).json({ error: "Topic not found" });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { followedCategories: slug } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Category] followCategory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// DELETE /api/categories/:slug/follow (protected)
const unfollowCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $pull: { followedCategories: slug } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Category] unfollowCategory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getCategories, getFollowedCategories, followCategory, unfollowCategory };
