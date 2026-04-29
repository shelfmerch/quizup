import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f4f4f4] max-w-md mx-auto relative shadow-2xl shadow-black/40">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
