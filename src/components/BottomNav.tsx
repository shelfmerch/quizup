import React from "react";
import { Home, Users, Grid3X3, Activity } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const LOGO_SRC = "/branding/quizup-icon.png";

const tabs = [
  { path: "/home", icon: Home, label: "HOME" },
  { path: "/leaderboard", icon: Users, label: "PEOPLE" },
  { path: "/categories", icon: Home, label: "", isCenter: true },
  { path: "/", icon: Grid3X3, label: "TOPICS" },
  { path: "/profile", icon: Activity, label: "ACTIVITY" },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-zinc-200 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map(({ path, icon: Icon, label, isCenter }) => {
          const active = location.pathname === path;
          
          if (isCenter) {
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center justify-center -mt-4"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden ${
                  active ? "quizup-header-red" : "quizup-header-red"
                } shadow-[0_10px_24px_rgba(0,0,0,0.25)]`}>
                  <img
                    src={LOGO_SRC}
                    alt=""
                    className="w-10 h-10 object-cover rounded-2xl"
                    width={40}
                    height={40}
                    draggable={false}
                  />
                </div>
              </button>
            );
          }

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active ? "text-[hsl(var(--quizup-red))]" : "text-zinc-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold tracking-wider">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
