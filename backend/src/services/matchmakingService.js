const Question = require("../models/Question");
const Match = require("../models/Match");
const User = require("../models/User");
const Category = require("../models/Category");
const MatchQueue = require("../models/MatchQueue");
const {
  selectQuestionsForMatch,
  mapQuestionForMatch,
} = require("./matchQuestionSelection");
const { getRecentQuestionIdSetForTwoUsers } = require("./userQuestionExposure");

const joinQueue = async (userId, categoryId, socketId) => {
  userId = userId.toString();

  // Prevent duplicate queue joins
  const existingDoc = await MatchQueue.findOne({ userId });
  if (existingDoc) {
    return { matched: false, alreadyQueued: true };
  }

  // Find longest waiting opponent 
  const opponent = await MatchQueue.findOneAndDelete({ categoryId, userId: { $ne: userId } }, { sort: { createdAt: 1 } });
  
  if (!opponent) {
    // No opponent, create my own queue
    await MatchQueue.create({ userId, categoryId, socketId });
    return { matched: false };
  }

  // Fetch questions
  const allQuestions = await Question.find({ categoryId, isActive: true }).lean();
  if (allQuestions.length === 0) {
    // Fallback if no questions, put them both back
    await MatchQueue.create([{ userId, categoryId, socketId }, { userId: opponent.userId, categoryId, socketId: opponent.socketId }]);
    return { matched: false };
  }

  const excludeIds = await getRecentQuestionIdSetForTwoUsers(userId, opponent.userId);
  const shuffled = selectQuestionsForMatch(allQuestions, excludeIds);

  const category = await Category.findOne({ slug: categoryId }).lean();
  const categoryName = category ? category.name : categoryId;

  const [p1User, p2User] = await Promise.all([
    User.findById(userId).lean(),
    User.findById(opponent.userId).lean(),
  ]);

  if (!p1User || !p2User) {
    return { matched: false };
  }

  const questionsMapped = shuffled.map((q, idx) => mapQuestionForMatch(q, idx, shuffled.length));

  const match = await Match.create({
    categoryId,
    categoryName,
    player1: {
      userId: p1User._id,
      username: p1User.username,
      avatarUrl: p1User.avatarUrl,
      socketId: socketId,
      score: 0,
      answers: [],
      level: p1User.level,
    },
    player2: {
      userId: p2User._id,
      username: p2User.username,
      avatarUrl: p2User.avatarUrl,
      socketId: opponent.socketId,
      score: 0,
      answers: [],
      level: p2User.level,
    },
    status: "waiting",
    totalRounds: shuffled.length,
    startedAt: new Date(),
    questions: questionsMapped,
    currentQuestionIndex: -1,
    connectedPlayers: [],
    roundAnswers: {},
    timerEndsAt: null,
  });

  const matchId = match._id.toString();
  const activeState = match.toObject();
  
  // Make state compatible with older logic that expected players explicitly mapped
  activeState.matchId = matchId;
  activeState.player1.userId = activeState.player1.userId.toString();
  activeState.player2.userId = activeState.player2.userId.toString();

  return {
    matched: true,
    matchId,
    match: activeState,
    player1SocketId: socketId,
    player2SocketId: opponent.socketId,
  };
};

/**
 * Create a direct 1v1 match between two specific users (no queue).
 * Socket ids are optional; they will be refreshed when players join the match room.
 */
const createDirectMatch = async (challengerId, opponentId, categoryId, challengerSocketId = null, opponentSocketId = null) => {
  const p1Id = challengerId.toString();
  const p2Id = opponentId.toString();
  if (!categoryId) throw new Error("categoryId is required");
  if (p1Id === p2Id) throw new Error("Cannot create match against self");

  const allQuestions = await Question.find({ categoryId, isActive: true }).lean();
  if (allQuestions.length === 0) {
    throw new Error("No questions available for this category");
  }
  const excludeIds = await getRecentQuestionIdSetForTwoUsers(p1Id, p2Id);
  const shuffled = selectQuestionsForMatch(allQuestions, excludeIds);

  const category = await Category.findOne({ slug: categoryId }).lean();
  const categoryName = category ? category.name : categoryId;

  const [p1User, p2User] = await Promise.all([User.findById(p1Id).lean(), User.findById(p2Id).lean()]);
  if (!p1User || !p2User) throw new Error("User not found");

  const questionsMapped = shuffled.map((q, idx) => mapQuestionForMatch(q, idx, shuffled.length));

  const match = await Match.create({
    categoryId,
    categoryName,
    player1: {
      userId: p1User._id,
      username: p1User.username,
      avatarUrl: p1User.avatarUrl,
      socketId: challengerSocketId,
      score: 0,
      answers: [],
      level: p1User.level,
    },
    player2: {
      userId: p2User._id,
      username: p2User.username,
      avatarUrl: p2User.avatarUrl,
      socketId: opponentSocketId,
      score: 0,
      answers: [],
      level: p2User.level,
    },
    status: "waiting",
    totalRounds: shuffled.length,
    startedAt: new Date(),
    questions: questionsMapped,
    currentQuestionIndex: -1,
    connectedPlayers: [],
    roundAnswers: {},
    timerEndsAt: null,
  });

  const matchId = match._id.toString();
  const activeState = match.toObject();
  activeState.matchId = matchId;
  activeState.player1.userId = activeState.player1.userId.toString();
  activeState.player2.userId = activeState.player2.userId.toString();

  return { matchId, match: activeState };
};

const leaveQueue = async (userId, categoryId) => {
  if (categoryId) {
    await MatchQueue.findOneAndDelete({ userId, categoryId });
  } else {
    await MatchQueue.findOneAndDelete({ userId });
  }
};

const leaveAllQueues = async (userId) => {
  await MatchQueue.deleteMany({ userId });
};

const getActiveMatch = async (matchId) => {
  const match = await Match.findById(matchId).lean();
  if (!match) return null;
  match.matchId = match._id.toString();
  match.player1.userId = match.player1.userId.toString();
  match.player2.userId = match.player2.userId.toString();
  return match;
};

const updateActiveMatch = async (matchId, updates) => {
  const current = await Match.findById(matchId).lean();
  if (!current) return null;

  // The engine usually passes a function `(s) => newS`
  const next = typeof updates === "function" ? updates(current) : { ...current, ...updates };

  // Make sure to clean fields that shouldn't crash MongoDB writes
  delete next._id;
  delete next.matchId; // Don't persist this back to root!
  delete next.__v;
  
  const updatedMatch = await Match.findByIdAndUpdate(matchId, next, { new: true }).lean();
  if (!updatedMatch) return null;
  
  updatedMatch.matchId = updatedMatch._id.toString();
  updatedMatch.player1.userId = updatedMatch.player1.userId.toString();
  updatedMatch.player2.userId = updatedMatch.player2.userId.toString();

  return updatedMatch;
};

const removeActiveMatch = async (matchId) => {
  // Optional cleanup of ultra-large transient fields to save space
  await Match.findByIdAndUpdate(matchId, { $unset: { questions: "", roundAnswers: "" }});
};

const getUserCurrentMatch = async (userId) => {
  const activeMatch = await Match.findOne({
    $or: [{ "player1.userId": userId }, { "player2.userId": userId }],
    status: { $in: ["waiting", "in_progress", "finalizing"] }
  }).sort({ createdAt: -1 });

  return activeMatch ? activeMatch._id.toString() : null;
};

/**
 * Return a match id only if the user is "busy" in a live match.
 *
 * - Always busy if status is in_progress or finalizing
 * - Busy in waiting only if it is very recent (prevents stale "waiting" rows from blocking challenges)
 */
const getUserBusyMatch = async (userId, { waitingMaxAgeMs = 2 * 60_000 } = {}) => {
  const now = Date.now();
  const recentCutoff = new Date(now - waitingMaxAgeMs);

  const match = await Match.findOne({
    $or: [{ "player1.userId": userId }, { "player2.userId": userId }],
    $or: [
      { status: { $in: ["in_progress", "finalizing"] } },
      { status: "waiting", createdAt: { $gte: recentCutoff } },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  return match ? match._id.toString() : null;
};

const clearUserMatch = async (userId) => {
  // Not needed: deduced automatically by match status in Mongo
};

/**
 * Atomically record a player entering the Socket.io match room.
 * Uses $addToSet so concurrent joins cannot overwrite each other's connectedPlayers entry
 * (read-modify-write on the full document used to drop one player and block startMatch).
 */
const recordPlayerJoinedRoom = async (matchId, userId, isP1, socketId) => {
  const socketField = isP1 ? "player1.socketId" : "player2.socketId";
  const updated = await Match.findByIdAndUpdate(
    matchId,
    {
      $set: { [socketField]: socketId },
      $addToSet: { connectedPlayers: userId },
    },
    { new: true }
  ).lean();

  if (!updated) return null;
  updated.matchId = updated._id.toString();
  updated.player1.userId = updated.player1.userId.toString();
  updated.player2.userId = updated.player2.userId.toString();
  return updated;
};

module.exports = {
  joinQueue,
  createDirectMatch,
  leaveQueue,
  leaveAllQueues,
  getActiveMatch,
  updateActiveMatch,
  removeActiveMatch,
  getUserCurrentMatch,
  getUserBusyMatch,
  clearUserMatch,
  recordPlayerJoinedRoom,
};
