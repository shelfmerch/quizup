import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icons8Icon from "@/components/Icons8Icon";

const LOGO_SRC = "/branding/quizup-icon.png";

type NavTab = {
  path: string;
  label: string;
  iconSlug: string;
  fallback: string;
  isCenter?: boolean;
};

const tabs: NavTab[] = [
  { path: "/home",        label: "HOME",     iconSlug: "home",        fallback: "🏠" },
  { path: "/leaderboard", label: "PEOPLE",   iconSlug: "conference",  fallback: "👥" },
  { path: "/categories",  label: "",         iconSlug: "",            fallback: "",  isCenter: true },
  { path: "/history",     label: "HISTORY",  iconSlug: "activity-history", fallback: "📋" },
  { path: "/profile",     label: "ACTIVITY", iconSlug: "user-male-circle", fallback: "👤" },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-zinc-200 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map(({ path, label, iconSlug, fallback, isCenter }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + "/");

          if (isCenter) {
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center justify-center -mt-4"
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden quizup-header-red shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
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
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 ${
                active ? "scale-105" : "opacity-50 hover:opacity-80"
              }`}
            >
              {/* Color icon when active, greyscale when inactive via CSS filter */}
              <div
                className="transition-all duration-200"
                style={active ? {} : { filter: "grayscale(1) brightness(0.8)" }}
              >
                <Icons8Icon
                  name={iconSlug}
                  fallback={fallback}
                  size={48}
                  style="animated-fluency"
                  className="w-7 h-7 object-contain"
                  alt={label}
                />
              </div>
              <span
                className={`text-[9px] font-semibold tracking-wider transition-colors duration-200 ${
                  active ? "text-[hsl(var(--quizup-red))]" : "text-slate-400"
                }`}
              >
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

