import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import useAndroidBackButton from "@/hooks/useAndroidBackButton";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ChatUnreadProvider } from "@/hooks/useChatUnread";
import ProtectedRoute from "@/components/ProtectedRoute";
import PublicRoute from "@/components/PublicRoute";
import AppLayout from "@/layouts/AppLayout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import HomeLobby from "./pages/HomeLobby";
import Categories from "./pages/Categories";
import FindMatch from "./pages/FindMatch";
import BattlePage from "./pages/BattlePage";
import Leaderboard from "./pages/Leaderboard";
import MatchHistory from "./pages/MatchHistory";
import ProfilePage from "./pages/ProfilePage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import CategoryDetail from "./pages/CategoryDetail";
import AdminRoute from "@/components/AdminRoute";
import AdminPage from "./pages/AdminPage";
import People from "./pages/People";
import Friends from "./pages/Friends";
import Social from "./pages/Social";
import AllCategories from "./pages/AllCategories";
import OnboardingProfile from "./pages/OnboardingProfile";
import OnboardingTopics from "./pages/OnboardingTopics";
import AchievementsPage from "./pages/AchievementsPage";
import ChallengeInvitePage from "./pages/ChallengeInvitePage";

const queryClient = new QueryClient();

/**
 * Registers the Android hardware back button inside the Router context.
 * Must be rendered inside <HashRouter> so it has access to useNavigate/useLocation.
 */
const AndroidBackButtonHandler: React.FC = () => {
  useAndroidBackButton();
  return null;
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <ChatUnreadProvider>
    <TooltipProvider>
      <Sonner />
      {/* HashRouter is required for Capacitor — the Android WebView loads files
          via file:// protocol which has no HTTP server to handle pushState routes.
          HashRouter uses URL fragments (#/route) which always work. */}
      <HashRouter>
        {/* Handles Android hardware back button globally */}
        <AndroidBackButtonHandler />
        <Routes>
          {/* Public auth routes */}
          <Route path="/landing" element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/home" element={<Navigate to="/" replace />} />

          {/* Protected app routes with bottom nav */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/all-categories" element={<ProtectedRoute><AllCategories /></ProtectedRoute>} />
            <Route path="/" element={<HomeLobby />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/history" element={<MatchHistory />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/category/:categoryId" element={<CategoryDetail />} />
            <Route path="/people" element={<People />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/social" element={<Social />} />
          </Route>

          {/* Onboarding routes (full-screen, no bottom nav) */}
          <Route path="/onboarding/profile" element={<ProtectedRoute><OnboardingProfile /></ProtectedRoute>} />
          <Route path="/onboarding/topics" element={<ProtectedRoute><OnboardingTopics /></ProtectedRoute>} />

          {/* Full-screen routes (no bottom nav) */}
          <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
          <Route path="/find-match/:categoryId" element={<ProtectedRoute><FindMatch /></ProtectedRoute>} />
          <Route path="/battle" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
          <Route path="/challenge/:challengeId" element={<ProtectedRoute><ChallengeInvitePage /></ProtectedRoute>} />
          <Route path="/chat/:peerId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
    </ChatUnreadProvider>
  </AuthProvider>
);

const App = () => {
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

  return (
    <QueryClientProvider client={queryClient}>
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>
          <Shell />
        </GoogleOAuthProvider>
      ) : (
        <Shell />
      )}
    </QueryClientProvider>
  );
};

export default App;
