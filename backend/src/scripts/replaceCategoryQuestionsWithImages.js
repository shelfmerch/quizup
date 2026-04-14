require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const Question = require("../models/Question");

function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveCategory(categoryArg) {
  const raw = String(categoryArg || "").trim();
  if (!raw) throw new Error("Missing category id/slug. Usage: node replaceCategoryQuestionsWithImages.js <categoryIdOrSlug>");

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await Category.findById(raw).lean();
    if (byId) return byId;
  }
  const slug = raw.toLowerCase();
  const bySlug = await Category.findOne({ slug }).lean();
  if (bySlug) return bySlug;

  throw new Error(`Category not found for '${raw}'. Provide Mongo _id or slug.`);
}

const IMAGE_QUESTIONS = [
  {
    text: "What is the main objective of players in this scene?",
    options: ["Break the candy quickly", "Eat the candy", "Carve the shape without breaking it", "Trade candies with others"],
    correctIndex: 2,
    timeLimit: 6,
    imageUrl: "/uploads/squid-seed/dalgona-wide.png",
  },
  {
    text: "What role does Player 218 primarily play in the group dynamics?",
    options: ["Comic relief", "Strategic thinker and manipulator", "Silent observer", "Game organizer"],
    correctIndex: 1,
    timeLimit: 7,
    imageUrl: "/uploads/squid-seed/dorm-218.png",
  },
  {
    text: "What technique helps the player succeed in this challenge?",
    options: ["Breaking it fast", "Using brute force", "Licking the candy to loosen shape", "Ignoring the shape"],
    correctIndex: 2,
    timeLimit: 6,
    imageUrl: "/uploads/squid-seed/player-456-dalgona.png",
  },
  {
    text: "What makes this character unique compared to others?",
    options: ["He refuses to play", "He secretly controls the game", "He is the youngest", "He never speaks"],
    correctIndex: 1,
    timeLimit: 7,
    imageUrl: "/uploads/squid-seed/player-001-smile.png",
  },
  {
    text: "What is this character best known for?",
    options: ["Physical strength", "Emotional leadership", "Survival instincts and intelligence", "Comic personality"],
    correctIndex: 2,
    timeLimit: 6,
    imageUrl: "/uploads/squid-seed/player-067-close.png",
  },
  {
    text: "What is the primary role of masked figures like this?",
    options: ["Compete in games", "Train players", "Oversee and control the games", "Provide rewards"],
    correctIndex: 2,
    timeLimit: 6,
    imageUrl: "/uploads/squid-seed/masked-vip.png",
  },
  {
    text: "What is this person best known for in Squid Game?",
    options: ["Player 456", "Front Man", "VIP Host", "Recruiter"],
    correctIndex: 1,
    timeLimit: 5,
    imageUrl: "/uploads/squid-seed/front-man-suit.png",
  },
  {
    text: "How does Player 101 typically survive in the games?",
    options: ["Solving puzzles", "Team coordination", "Using force and intimidation", "Avoiding conflict"],
    correctIndex: 2,
    timeLimit: 6,
    imageUrl: "/uploads/squid-seed/player-101.png",
  },
];

async function main() {
  const arg = process.argv[2];
  await connectDB();

  const cat = await resolveCategory(arg);
  const slug = cat.slug;

  const existing = await Question.find({ categoryId: slug, isActive: true }).select("_id text").lean();
  if (existing.length < IMAGE_QUESTIONS.length) {
    throw new Error(`Not enough active questions in '${slug}'. Need >= ${IMAGE_QUESTIONS.length}, have ${existing.length}.`);
  }

  const toRemove = shuffleInPlace([...existing]).slice(0, IMAGE_QUESTIONS.length);
  const removeIds = toRemove.map((q) => q._id);

  await Question.deleteMany({ _id: { $in: removeIds } });

  const docs = IMAGE_QUESTIONS.map((q) => ({
    categoryId: slug,
    text: q.text,
    imageUrl: q.imageUrl,
    options: q.options,
    correctIndex: q.correctIndex,
    timeLimit: q.timeLimit,
    isActive: true,
  }));

  await Question.insertMany(docs, { ordered: true });

  // Keep existing count (we removed 8 and inserted 8), but also sync stored questionCount for UI.
  const total = await Question.countDocuments({ categoryId: slug, isActive: true });
  await Category.findOneAndUpdate({ slug }, { questionCount: total });

  console.log(`✅ Replaced ${IMAGE_QUESTIONS.length} questions in '${slug}'. Active count is now ${total}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ replaceCategoryQuestionsWithImages failed:", err);
  process.exit(1);
});

