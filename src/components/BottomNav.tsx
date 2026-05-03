import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Grid3X3, Home, Newspaper, Users } from "lucide-react";

const LOGO_SRC = "/branding/quizup-icon.png";

type NavTab = {
  path: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
};

const tabs: NavTab[] = [
  { path: "/home", label: "Feed", Icon: Newspaper },
  { path: "/leaderboard", label: "People", Icon: Users },
  { path: "/categories", label: "Quiz", isCenter: true },
  { path: "/history", label: "Topics", Icon: Grid3X3 },
  { path: "/profile", label: "Activity", Icon: Bell },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#080808] border-t border-black safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map(({ path, label, Icon, isCenter }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + "/");

          if (isCenter) {
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center justify-center -mt-5 flex-1"
                aria-label="Browse topics"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-[#f65357] border-[3px] border-[#222] shadow-[0_8px_18px_rgba(0,0,0,0.45)]">
                  <img
                    src={LOGO_SRC}
                    alt=""
                    className="w-13 h-13 object-cover rounded-full"
                    width={40}
                    height={40}
                    draggable={false}
                  />
                </div>
              </button>
            );
          }

          const TabIcon = Icon ?? Home;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-opacity duration-200 ${
                active ? "opacity-100" : "opacity-45 hover:opacity-80"
              }`}
            >
              <TabIcon className={`w-7 h-7 ${active ? "text-[#f65357]" : "text-zinc-300"}`} />
              <span className={`text-[10px] font-semibold ${active ? "text-[#f65357]" : "text-zinc-400"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
