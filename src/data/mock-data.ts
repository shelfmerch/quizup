import { Category, Question, LeaderboardEntry, MatchHistoryEntry, Achievement, Profile, Notification } from "@/types";

export const MOCK_CATEGORIES: Category[] = [
  { id: "science", name: "Science", icon: "🔬", color: "160 84% 44%", questionCount: 515, description: "Physics, Chemistry, Biology and more" },
  { id: "geography", name: "Geography", icon: "🌍", color: "210 90% 55%", questionCount: 420, description: "Countries, capitals, landmarks" },
  { id: "history", name: "History", icon: "📜", color: "38 92% 55%", questionCount: 380, description: "Ancient to modern world history" },
  { id: "movies", name: "Movies", icon: "🎬", color: "0 72% 55%", questionCount: 600, description: "Hollywood, Bollywood, and beyond" },
  { id: "sports", name: "Sports", icon: "⚽", color: "120 60% 45%", questionCount: 450, description: "Football, cricket, olympics" },
  { id: "music", name: "Music", icon: "🎵", color: "270 70% 60%", questionCount: 350, description: "Artists, albums, genres" },
  { id: "technology", name: "Technology", icon: "💻", color: "200 80% 50%", questionCount: 290, description: "Gadgets, coding, innovation" },
  { id: "literature", name: "Literature", icon: "📚", color: "30 70% 50%", questionCount: 310, description: "Books, authors, poetry" },
  { id: "gaming", name: "Gaming", icon: "🎮", color: "280 80% 55%", questionCount: 275, description: "Video games, esports, retro" },
  { id: "food", name: "Food & Drink", icon: "🍕", color: "15 85% 55%", questionCount: 240, description: "Cuisine, recipes, beverages" },
  { id: "nature", name: "Nature", icon: "🌿", color: "140 70% 40%", questionCount: 330, description: "Animals, plants, ecosystems" },
  { id: "art", name: "Art & Design", icon: "🎨", color: "320 70% 55%", questionCount: 200, description: "Painting, sculpture, design" },
  { id: "k-pop", name: "K-Pop", icon: "🎤", color: "330 80% 58%", questionCount: 120, description: "Korean pop, groups, and idols" },
  { id: "squid-game", name: "Squid Game", icon: "🦑", color: "142 65% 42%", questionCount: 85, description: "The Netflix series — trivia and lore" },
];

export const MOCK_QUESTIONS: Record<string, Question[]> = {
  science: [
    { id: "s1", categoryId: "science", text: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
    { id: "s2", categoryId: "science", text: "How many bones are in the adult human body?", options: ["196", "206", "216", "186"], correctIndex: 1, difficulty: "medium", timeLimit: 10 },
    { id: "s3", categoryId: "science", text: "What planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1, difficulty: "easy", timeLimit: 10 },
    { id: "s4", categoryId: "science", text: "What is the speed of light in km/s?", options: ["300,000", "150,000", "500,000", "250,000"], correctIndex: 0, difficulty: "hard", timeLimit: 10 },
    { id: "s5", categoryId: "science", text: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
    { id: "s6", categoryId: "science", text: "What is the hardest natural substance on Earth?", options: ["Titanium", "Diamond", "Quartz", "Topaz"], correctIndex: 1, difficulty: "medium", timeLimit: 10 },
    { id: "s7", categoryId: "science", text: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
  ],
  geography: [
    { id: "g1", categoryId: "geography", text: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"], correctIndex: 2, difficulty: "medium", timeLimit: 10 },
    { id: "g2", categoryId: "geography", text: "Which is the longest river in the world?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIndex: 1, difficulty: "easy", timeLimit: 10 },
    { id: "g3", categoryId: "geography", text: "What country has the most islands?", options: ["Indonesia", "Philippines", "Sweden", "Japan"], correctIndex: 2, difficulty: "hard", timeLimit: 10 },
    { id: "g4", categoryId: "geography", text: "Mount Everest is located in which mountain range?", options: ["Andes", "Alps", "Rockies", "Himalayas"], correctIndex: 3, difficulty: "easy", timeLimit: 10 },
    { id: "g5", categoryId: "geography", text: "What is the smallest country in the world?", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], correctIndex: 1, difficulty: "easy", timeLimit: 10 },
    { id: "g6", categoryId: "geography", text: "Which desert is the largest in the world?", options: ["Sahara", "Arabian", "Gobi", "Antarctic"], correctIndex: 3, difficulty: "hard", timeLimit: 10 },
    { id: "g7", categoryId: "geography", text: "What is the deepest ocean trench?", options: ["Tonga Trench", "Mariana Trench", "Java Trench", "Puerto Rico Trench"], correctIndex: 1, difficulty: "medium", timeLimit: 10 },
  ],
  history: [
    { id: "h1", categoryId: "history", text: "In what year did World War II end?", options: ["1943", "1944", "1945", "1946"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
    { id: "h2", categoryId: "history", text: "Who was the first Emperor of Rome?", options: ["Julius Caesar", "Augustus", "Nero", "Caligula"], correctIndex: 1, difficulty: "medium", timeLimit: 10 },
    { id: "h3", categoryId: "history", text: "The French Revolution began in which year?", options: ["1776", "1789", "1799", "1804"], correctIndex: 1, difficulty: "medium", timeLimit: 10 },
    { id: "h4", categoryId: "history", text: "Who built the Great Wall of China?", options: ["Ming Dynasty", "Qin Dynasty", "Han Dynasty", "Multiple Dynasties"], correctIndex: 3, difficulty: "hard", timeLimit: 10 },
    { id: "h5", categoryId: "history", text: "Which civilization built Machu Picchu?", options: ["Maya", "Aztec", "Inca", "Olmec"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
    { id: "h6", categoryId: "history", text: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Da Vinci", "Botticelli"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
    { id: "h7", categoryId: "history", text: "The Berlin Wall fell in which year?", options: ["1987", "1988", "1989", "1990"], correctIndex: 2, difficulty: "easy", timeLimit: 10 },
  ],
};

// Fill remaining categories with generic questions
const genericQs = (catId: string): Question[] => [
  { id: `${catId}1`, categoryId: catId, text: `What is the most popular ${catId} topic worldwide?`, options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 1, difficulty: "easy", timeLimit: 10 },
  { id: `${catId}2`, categoryId: catId, text: `Which ${catId} achievement is considered the greatest?`, options: ["First", "Second", "Third", "Fourth"], correctIndex: 0, difficulty: "medium", timeLimit: 10 },
  { id: `${catId}3`, categoryId: catId, text: `When did modern ${catId} begin?`, options: ["1800s", "1900s", "1950s", "2000s"], correctIndex: 1, difficulty: "easy", timeLimit: 10 },
  { id: `${catId}4`, categoryId: catId, text: `Who is the most influential figure in ${catId}?`, options: ["Person A", "Person B", "Person C", "Person D"], correctIndex: 2, difficulty: "hard", timeLimit: 10 },
  { id: `${catId}5`, categoryId: catId, text: `What is a key milestone in ${catId} history?`, options: ["Event A", "Event B", "Event C", "Event D"], correctIndex: 0, difficulty: "medium", timeLimit: 10 },
  { id: `${catId}6`, categoryId: catId, text: `Which country leads in ${catId}?`, options: ["USA", "UK", "Japan", "Germany"], correctIndex: 0, difficulty: "easy", timeLimit: 10 },
  { id: `${catId}7`, categoryId: catId, text: `What defines ${catId} in the 21st century?`, options: ["Innovation", "Tradition", "Fusion", "Digital"], correctIndex: 3, difficulty: "medium", timeLimit: 10 },
];

MOCK_CATEGORIES.forEach((c) => {
  if (!MOCK_QUESTIONS[c.id]) {
    MOCK_QUESTIONS[c.id] = genericQs(c.id);
  }
});

export const MOCK_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
];

export const MOCK_OPPONENTS = [
  { userId: "opp1", username: "QuizMaster99", avatarUrl: MOCK_AVATARS[1], level: 12 },
  { userId: "opp2", username: "BrainStorm", avatarUrl: MOCK_AVATARS[2], level: 8 },
  { userId: "opp3", username: "TriviaKing", avatarUrl: MOCK_AVATARS[3], level: 15 },
  { userId: "opp4", username: "SmartCookie", avatarUrl: MOCK_AVATARS[4], level: 6 },
  { userId: "opp5", username: "NerdAlert", avatarUrl: MOCK_AVATARS[5], level: 10 },
];

export const MOCK_USER_PROFILE: Profile = {
  id: "user1",
  username: "Player1",
  email: "player1@quizbattle.com",
  avatarUrl: MOCK_AVATARS[0],
  displayName: "Player One",
  bio: "Quiz enthusiast & trivia lover",
  country: "United States",
  level: 7,
  xp: 2450,
  xpToNextLevel: 3000,
  totalMatches: 48,
  wins: 29,
  losses: 16,
  draws: 3,
  winStreak: 4,
  bestWinStreak: 9,
  followers: 156,
  following: 89,
  achievements: [],
  favoriteCategory: "Science",
  lastActive: new Date().toISOString(),
  createdAt: "2025-01-15T10:00:00Z",
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: "lb1", username: "QuizGod", avatarUrl: MOCK_AVATARS[1], score: 15420, wins: 234, level: 42, country: "🇺🇸" },
  { rank: 2, userId: "lb2", username: "BrainiacX", avatarUrl: MOCK_AVATARS[2], score: 14880, wins: 221, level: 39, country: "🇬🇧" },
  { rank: 3, userId: "lb3", username: "TriviaQueen", avatarUrl: MOCK_AVATARS[3], score: 13950, wins: 198, level: 36, country: "🇩🇪" },
  { rank: 4, userId: "lb4", username: "MindBlower", avatarUrl: MOCK_AVATARS[4], score: 12300, wins: 175, level: 33, country: "🇯🇵" },
  { rank: 5, userId: "lb5", username: "SmartPanda", avatarUrl: MOCK_AVATARS[5], score: 11780, wins: 162, level: 30, country: "🇮🇳" },
  { rank: 6, userId: "user1", username: "Player1", avatarUrl: MOCK_AVATARS[0], score: 2450, wins: 29, level: 7, country: "🇺🇸" },
  { rank: 7, userId: "lb7", username: "QuizNinja", avatarUrl: MOCK_AVATARS[1], score: 2100, wins: 24, level: 6, country: "🇧🇷" },
  { rank: 8, userId: "lb8", username: "WiseFox", avatarUrl: MOCK_AVATARS[2], score: 1850, wins: 20, level: 5, country: "🇫🇷" },
  { rank: 9, userId: "lb9", username: "CleverCat", avatarUrl: MOCK_AVATARS[3], score: 1500, wins: 17, level: 4, country: "🇰🇷" },
  { rank: 10, userId: "lb10", username: "NovaBrain", avatarUrl: MOCK_AVATARS[4], score: 1200, wins: 14, level: 3, country: "🇨🇦" },
];

export const MOCK_MATCH_HISTORY: MatchHistoryEntry[] = [
  { matchId: "m1", opponentName: "QuizMaster99", opponentAvatar: MOCK_AVATARS[1], categoryName: "Science", playerScore: 5, opponentScore: 3, result: "win", playedAt: "2026-04-12T10:00:00Z" },
  { matchId: "m2", opponentName: "BrainStorm", opponentAvatar: MOCK_AVATARS[2], categoryName: "Geography", playerScore: 4, opponentScore: 6, result: "loss", playedAt: "2026-04-11T15:30:00Z" },
  { matchId: "m3", opponentName: "TriviaKing", opponentAvatar: MOCK_AVATARS[3], categoryName: "History", playerScore: 5, opponentScore: 5, result: "draw", playedAt: "2026-04-11T09:00:00Z" },
  { matchId: "m4", opponentName: "SmartCookie", opponentAvatar: MOCK_AVATARS[4], categoryName: "Movies", playerScore: 6, opponentScore: 2, result: "win", playedAt: "2026-04-10T20:00:00Z" },
  { matchId: "m5", opponentName: "NerdAlert", opponentAvatar: MOCK_AVATARS[5], categoryName: "Music", playerScore: 7, opponentScore: 4, result: "win", playedAt: "2026-04-10T14:00:00Z" },
];

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: "a1", name: "First Victory", description: "Win your first match", icon: "🏆", isUnlocked: true, unlockedAt: "2025-02-01" },
  { id: "a2", name: "Win Streak 5", description: "Win 5 matches in a row", icon: "🔥", isUnlocked: true, unlockedAt: "2025-03-15" },
  { id: "a3", name: "Perfect Round", description: "Answer all questions correctly in a match", icon: "⭐", isUnlocked: true, unlockedAt: "2025-04-01" },
  { id: "a4", name: "Category Master", description: "Win 10 matches in a single category", icon: "👑", isUnlocked: false },
  { id: "a5", name: "Speed Demon", description: "Answer a question in under 2 seconds", icon: "⚡", isUnlocked: true, unlockedAt: "2025-05-10" },
  { id: "a6", name: "Social Butterfly", description: "Follow 50 players", icon: "🦋", isUnlocked: false },
  { id: "a7", name: "Century Club", description: "Play 100 matches", icon: "💯", isUnlocked: false },
  { id: "a8", name: "Global Player", description: "Play in all categories", icon: "🌎", isUnlocked: false },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "achievement", title: "Achievement Unlocked!", message: "You earned Speed Demon", read: false, createdAt: "2026-04-12T09:00:00Z" },
  { id: "n2", type: "match_invite", title: "Challenge!", message: "QuizMaster99 challenged you to Science", read: false, createdAt: "2026-04-12T08:30:00Z" },
  { id: "n3", type: "follow", title: "New Follower", message: "BrainStorm started following you", read: true, createdAt: "2026-04-11T20:00:00Z" },
];
