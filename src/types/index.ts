export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  createdAt: string;
}

export interface Profile extends User {
  role?: "user" | "admin";
  displayName: string;
  bio: string;
  country: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
  followers: number;
  following: number;
  isFollowing?: boolean; // true when the logged-in user already follows this profile
  achievements: Achievement[];
  favoriteCategory: string;
  lastActive: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string; // ISO
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  questionCount: number;
  description: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  categoryId: string;
  text: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  timeLimit: number; // seconds
}

/** Payload from Socket.io `match_found` (questions omit correctIndex). */
export interface MatchFoundPayload {
  matchId: string;
  categoryId: string;
  categoryName: string;
  totalRounds: number;
  myUserId: string;
  mySeat: "player1" | "player2";
  opponent: {
    userId: string;
    username: string;
    avatarUrl: string;
    level: number;
  };
}

export interface Match {
  id: string;
  categoryId: string;
  categoryName: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
  status: "waiting" | "in_progress" | "completed";
  currentRound: number;
  totalRounds: number;
  questions: Question[];
  startedAt: string;
  completedAt?: string;
  winnerId?: string;
}

export interface MatchPlayer {
  userId: string;
  username: string;
  avatarUrl: string;
  score: number;
  answers: PlayerAnswer[];
  level: number;
}

export interface PlayerAnswer {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  timeMs: number;
}

export interface BattleState {
  match: Match;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  timeRemaining: number;
  playerAnswer: number | null;
  opponentAnswer: number | null;
  roundResult: "waiting" | "correct" | "incorrect" | "timeout" | null;
  phase: "intro" | "question" | "answer_reveal" | "round_result" | "match_end";
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string;
  score: number;
  wins: number;
  level: number;
  country: string;
}

export interface MatchHistoryEntry {
  matchId: string;
  opponentName: string;
  opponentAvatar: string;
  categoryName: string;
  playerScore: number;
  opponentScore: number;
  result: "win" | "loss" | "draw";
  playedAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export interface Notification {
  id: string;
  type: "match_invite" | "achievement" | "follow" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
