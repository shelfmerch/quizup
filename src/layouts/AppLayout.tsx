import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
