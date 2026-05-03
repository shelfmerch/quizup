const Category = require("../models/Category");
const Question = require("../models/Question");

const syncQuestionCount = async (categorySlug) => {
  const count = await Question.countDocuments({ categoryId: categorySlug, isActive: true });
  await Category.findOneAndUpdate({ slug: categorySlug }, { questionCount: count });
};

module.exports = { syncQuestionCount };
