import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ff8a3d] via-[#ff6a3a] to-[#ff5a3a]">
      <div className="min-h-screen flex items-center justify-center px-3 py-6">
        {/* Mobile "device" frame */}
        <div className="w-full max-w-[420px] relative">
          <div className="rounded-[28px] bg-black/15 p-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <div className="rounded-[22px] overflow-hidden bg-background max-h-[92vh]">
              <div className="pb-16">
                <Outlet />
              </div>
              <BottomNav />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
