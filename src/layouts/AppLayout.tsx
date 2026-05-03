import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  const fullWidthShell = pathname === "/leaderboard";

  return (
    <div
      className={cn(
        "min-h-screen bg-[#f4f4f4] mx-auto relative shadow-2xl shadow-black/40",
        fullWidthShell ? "w-full max-w-none" : "max-w-md"
      )}
    >
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
