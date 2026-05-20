import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";

export default function AchievementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const achievements = useMemo(() => {
    return MOCK_ACHIEVEMENTS.map((mockAch) => {
      const unlocked = user?.achievements?.find((a) => a.id === mockAch.id);
      return { ...mockAch, isUnlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt };
    });
  }, [user]);

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col pb-6">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 bg-white px-4 shadow-sm">
        <button onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </button>
        <h1 className="font-display text-lg font-black text-slate-900">Achievements</h1>
      </div>

      {/* Header Info */}
      <div className="bg-[#f65357] text-white px-6 py-6 shadow-md rounded-b-3xl">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#f65357] shadow-inner">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-black">Your Progress</h2>
            <p className="text-sm font-semibold opacity-90">{unlockedCount} of {achievements.length} Unlocked</p>
          </div>
        </div>
      </div>

      {/* Achievements List */}
      <div className="px-4 pt-6 flex flex-col gap-3">
        {achievements.map((ach) => (
          <div 
            key={ach.id} 
            className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border ${
              ach.isUnlocked ? "border-[#f65357]/20" : "border-slate-100 opacity-75"
            }`}
          >
            {/* Icon */}
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 ${ach.isUnlocked ? "" : "grayscale"}`}>
              {ach.src ? (
                <img src={ach.src} alt={ach.name} className="h-10 w-10 object-contain drop-shadow-md" />
              ) : (
                <span className="text-2xl">{ach.icon}</span>
              )}
              {!ach.isUnlocked && (
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 shadow-sm border border-white">
                  <Lock className="h-3 w-3 text-slate-500" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className={`truncate font-black ${ach.isUnlocked ? "text-slate-900" : "text-slate-600"}`}>
                {ach.name}
              </h3>
              <p className="mt-0.5 text-xs font-semibold leading-tight text-slate-500">
                {ach.description}
              </p>
              {ach.isUnlocked && ach.unlockedAt ? (
                <p className="mt-1 text-[10px] font-bold text-[#15b78f]">
                  Unlocked on {new Date(ach.unlockedAt).toLocaleDateString()}
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Locked - Complete requirement to unlock
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
