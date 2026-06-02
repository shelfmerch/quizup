import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Lock,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";
import {
  AchievementModal,
  AchievementBadge,
  ACHIEVEMENT_TIERS,
  ACHIEVEMENT_RARITY_MAP,
} from "@/components/AchievementModal";
import type { Achievement } from "@/types";

type FilterTab = "all" | "unlocked" | "locked";

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

function achievementBadgeSrc(src: string): string {
  if (!src) return "";
  const path = src.startsWith("/") ? src.slice(1) : src;
  return `${import.meta.env.BASE_URL || "/"}${path}`;
}

export default function AchievementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const achievements = useMemo(() => {
    return MOCK_ACHIEVEMENTS.map((mockAch) => {
      const unlocked = user?.achievements?.find((a) => a.id === mockAch.id);
      return { ...mockAch, isUnlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt };
    });
  }, [user]);

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalCount = achievements.length;
  const percentUnlocked =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filtered = useMemo(() => {
    let list = achievements;
    if (filter === "unlocked") list = list.filter((a) => a.isUnlocked);
    if (filter === "locked") list = list.filter((a) => !a.isUnlocked);
    return [...list].sort((a, b) => {
      if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
      const ra = RARITY_ORDER[ACHIEVEMENT_RARITY_MAP[a.id] || "common"] ?? 9;
      const rb = RARITY_ORDER[ACHIEVEMENT_RARITY_MAP[b.id] || "common"] ?? 9;
      return ra - rb;
    });
  }, [achievements, filter]);

  const modalOpen = selectedId !== null;

  return (
    <div className="quizup-app min-h-[100dvh] pb-8">
      <div className="quizup-topbar">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[17px] font-black tracking-tight">
          Achievements
        </h1>
        <div className="w-9" aria-hidden />
      </div>

      {/* Progress hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f65357] via-[#e84a4e] to-[#c93d41] px-5 py-6 text-white shadow-md">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner ring-2 ring-white/25">
            <Trophy className="h-9 w-9 text-amber-300 drop-shadow" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
              Collection progress
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-black leading-tight">
              {unlockedCount}{" "}
              <span className="text-lg font-bold text-white/75">/ {totalCount}</span>
            </h2>
            <p className="mt-1 text-xs font-semibold text-white/85">
              {percentUnlocked === 100 ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                  All achievements unlocked!
                </span>
              ) : (
                <>Keep battling to unlock {totalCount - unlockedCount} more</>
              )}
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
            <span className="text-white/70">Completion</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-white">
              {percentUnlocked}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/20 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-white to-teal-200 transition-all duration-700 ease-out"
              style={{ width: `${percentUnlocked}%` }}
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-14 z-40 border-b border-[#dddddd] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex gap-2">
          {(
            [
              { key: "all" as const, label: "All", count: totalCount },
              { key: "unlocked" as const, label: "Unlocked", count: unlockedCount },
              {
                key: "locked" as const,
                label: "Locked",
                count: totalCount - unlockedCount,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`flex-1 rounded-xl py-2 text-center text-[11px] font-black uppercase tracking-wide transition active:scale-[0.98] ${
                filter === tab.key
                  ? "bg-[#f65357] text-white shadow-sm"
                  : "bg-[#f4f4f4] text-[#666] hover:bg-[#ebebeb]"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1 tabular-nums ${
                  filter === tab.key ? "text-white/80" : "text-[#999]"
                }`}
              >
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-4 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-14 text-center">
            <Award className="h-10 w-10 text-[#ccc]" />
            <p className="mt-3 font-display text-base font-black text-[#333]">
              {filter === "unlocked" ? "No unlocks yet" : "Nothing here"}
            </p>
            <p className="mt-1 max-w-[240px] text-xs font-semibold text-[#888]">
              {filter === "unlocked"
                ? "Win matches and complete challenges to earn your first badge."
                : "You've unlocked every achievement in this view."}
            </p>
            {filter === "unlocked" && (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#f65357] px-5 text-xs font-black uppercase tracking-wide text-white shadow-md transition active:scale-[0.98]"
              >
                <Swords className="h-4 w-4" />
                Play now
              </button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((ach) => {
              const rarityKey = ACHIEVEMENT_RARITY_MAP[ach.id] || "common";
              const tier = ACHIEVEMENT_TIERS[rarityKey];

              return (
                <li key={ach.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ach.id)}
                    className={`group flex w-full items-center gap-3.5 rounded-2xl border bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99] ${
                      ach.isUnlocked
                        ? `border-transparent bg-gradient-to-br ${tier.bgGradient} p-[2px] ${tier.glowClass}`
                        : "border-[#e8e8e8] opacity-90 hover:border-[#ddd]"
                    }`}
                  >
                    <div
                      className={`flex flex-1 items-center gap-3.5 rounded-[14px] bg-white p-2 ${
                        ach.isUnlocked ? "" : "w-full"
                      }`}
                    >
                      <div
                        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                          ach.isUnlocked ? "bg-[#fafafa]" : "bg-[#f4f4f4] grayscale"
                        }`}
                      >
                        <AchievementBadge
                          src={achievementBadgeSrc(ach.src)}
                          icon={ach.icon}
                          alt={ach.name}
                          className="h-11 w-11"
                          isUnlocked={ach.isUnlocked}
                        />
                        {!ach.isUnlocked && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#eee] shadow-sm">
                            <Lock className="h-2.5 w-2.5 text-[#888]" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-[9px] font-black uppercase tracking-[0.15em] ${
                            ach.isUnlocked ? tier.textClass : "text-[#aaa]"
                          }`}
                        >
                          {tier.name}
                        </span>
                        <h3
                          className={`truncate font-display text-[15px] font-black leading-tight ${
                            ach.isUnlocked ? "text-[#222]" : "text-[#666]"
                          }`}
                        >
                          {ach.name}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-[#888]">
                          {ach.description}
                        </p>
                        {ach.isUnlocked && ach.unlockedAt ? (
                          <p className="mt-1 text-[10px] font-bold text-[#15b78f]">
                            Unlocked{" "}
                            {new Date(ach.unlockedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#bbb]">
                            Tap for details
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${
                          ach.isUnlocked ? "text-[#15b78f]" : "text-[#ccc]"
                        }`}
                      >
                        {ach.isUnlocked ? "✓" : "—"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AchievementModal
        isOpen={modalOpen}
        onClose={() => setSelectedId(null)}
        achievements={achievements as Achievement[]}
        focusId={selectedId}
        onPlayNow={() => {
          setSelectedId(null);
          navigate("/");
        }}
      />
    </div>
  );
}
