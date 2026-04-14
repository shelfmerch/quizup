import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
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
import SettingsPage from "./pages/SettingsPage";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import CategoryDetail from "./pages/CategoryDetail";
import AdminRoute from "@/components/AdminRoute";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected app routes with bottom nav */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/home" element={<HomeLobby />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/history" element={<MatchHistory />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/category/:categoryId" element={<CategoryDetail />} />
            </Route>

            {/* Full-screen routes (no bottom nav) */}
            <Route path="/find-match/:categoryId" element={<ProtectedRoute><FindMatch /></ProtectedRoute>} />
            <Route path="/battle" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
