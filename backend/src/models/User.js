const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      select: false, // never returned in queries by default
    },
    googleId: {
      type: String,
      index: true,
      default: null,
    },

    // Profile
    displayName: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 200 },
    country: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    favoriteCategory: { type: String, default: "" },
    lastActive: { type: Date, default: Date.now },

    // Progression
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    xpToNextLevel: { type: Number, default: 1000 },

    // Stats
    totalMatches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 },

    // Social
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Followed quiz topics (Category.slug values)
    followedCategories: [{ type: String, default: [] }],

    /** Recent question document ids (string) to reduce repeats across matches */
    lastPlayedQuestionIds: { type: [String], default: [] },

    // Achievements system
    unlockedAchievements: [
      {
        id: { type: String, required: true },
        unlockedAt: { type: Date, default: Date.now },
      },
    ],

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Avatar default: dicebear based on username seed
userSchema.pre("save", function (next) {
  if (!this.avatarUrl) {
    this.avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(this.username)}`;
  }
  if (!this.displayName) {
    this.displayName = this.username;
  }
  next();
});

/**
 * Hash a plain password before saving.
 */
userSchema.statics.hashPassword = async (plain) => {
  return bcrypt.hash(plain, 12);
};

/**
 * Compare plain password to stored hash.
 */
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * Level-up logic: called after XP is added.
 */
userSchema.methods.addXP = function (amount) {
  this.xp += amount;
  while (this.xp >= this.xpToNextLevel) {
    this.xp -= this.xpToNextLevel;
    this.level += 1;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.4);
  }
};

/**
 * Return a safe public-facing profile object (no hash, no internal fields).
 */
userSchema.methods.toProfile = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    role: this.role || "user",
    displayName: this.displayName,
    bio: this.bio,
    country: this.country,
    avatarUrl: this.avatarUrl,
    level: this.level,
    xp: this.xp,
    xpToNextLevel: this.xpToNextLevel,
    totalMatches: this.totalMatches,
    wins: this.wins,
    losses: this.losses,
    draws: this.draws,
    winStreak: this.winStreak,
    bestWinStreak: this.bestWinStreak,
    followers: this.followers.length,
    following: this.following.length,
    favoriteCategory: this.favoriteCategory,
    lastActive: this.lastActive,
    createdAt: this.createdAt,
    achievements: this.unlockedAchievements ? this.unlockedAchievements.map((a) => ({
      id: a.id,
      unlockedAt: a.unlockedAt.toISOString(),
      isUnlocked: true
    })) : [],
  };
};

module.exports = mongoose.model("User", userSchema);
