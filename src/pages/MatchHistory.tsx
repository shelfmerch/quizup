import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/hooks/useAuth";
import { MatchHistoryEntry } from "@/types";
import { resolveMediaUrl } from "@/config/env";
import {
  ArrowLeft,
  Calendar,
  Minus,
  Search,
  Swords,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

type ResultFilter = "all" | "win" | "loss" | "draw";

function formatPlayedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMatch = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMatch.getTime()) / 86400000
  );

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  if (dayDiff < 7) {
    return `${d.toLocaleDateString(undefined, { weekday: "short" })} · ${time}`;
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMatch = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMatch.getTime()) / 86400000
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This week";
  if (dayDiff < 30) return "This month";
  return "Earlier";
}

const MatchCardSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-[#eee] bg-white p-3 shadow-sm animate-pulse">
    <div className="h-11 w-11 shrink-0 rounded-full bg-[#eee]" />
    <div className="h-11 w-11 shrink-0 rounded-full bg-[#eee]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-16 rounded bg-[#eee]" />
      <div className="h-4 w-32 rounded bg-[#eee]" />
      <div className="h-3 w-24 rounded bg-[#eee]" />
    </div>
    <div className="h-8 w-14 rounded bg-[#eee]" />
  </div>
);

const MatchHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    profileService
      .getMatchHistory(user.id, 50)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const m of history) {
      if (m.result === "win") wins++;
      else if (m.result === "loss") losses++;
      else draws++;
    }
    const played = history.length;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return { wins, losses, draws, played, winRate };
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((m) => {
      if (resultFilter !== "all" && m.result !== resultFilter) return false;
      if (!q) return true;
      return (
        m.opponentName.toLowerCase().includes(q) ||
        m.categoryName.toLowerCase().includes(q)
      );
    });
  }, [history, query, resultFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, MatchHistoryEntry[]>();
    const order = ["Today", "Yesterday", "This week", "This month", "Earlier"];
    for (const m of filtered) {
      const label = dateGroupLabel(m.playedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    }
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, matches: map.get(label)! }));
  }, [filtered]);

  return (
    <div className="min-h-screen pb-4">
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
          Match History
        </h1>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery("");
          }}
          aria-label={searchOpen ? "Close search" : "Search matches"}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 ${
            searchOpen ? "bg-white/20" : "hover:bg-white/10"
          }`}
        >
          {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {searchOpen && (
        <div className="border-b border-[#ddd] bg-white px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Opponent or category…"
              autoFocus
              className="h-10 w-full rounded-xl border border-[#ddd] bg-[#f8f8f8] pl-9 pr-9 text-sm font-semibold text-[#333] placeholder:text-[#aaa] focus:border-[#f65357] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#f65357]/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#888] hover:bg-[#eee]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && history.length > 0 && (
        <section className="border-b border-[#ddd] bg-white px-4 py-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              {
                label: "Played",
                value: stats.played,
                color: "text-[#333]",
                icon: null,
              },
              {
                label: "Wins",
                value: stats.wins,
                color: "text-[#15b78f]",
                icon: TrendingUp,
              },
              {
                label: "Losses",
                value: stats.losses,
                color: "text-[#f65357]",
                icon: TrendingDown,
              },
              {
                label: "Draws",
                value: stats.draws,
                color: "text-[#888]",
                icon: Minus,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-[#f8f8f8] px-1 py-2.5 border border-[#eee]"
              >
                {s.icon ? (
                  <s.icon className={`mx-auto h-3.5 w-3.5 ${s.color}`} />
                ) : null}
                <p className={`font-display text-xl font-black leading-none ${s.color}`}>
                  {s.value}
                </p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-[#999]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          {/* {stats.played > 0 && (
            <p className="mt-3 text-center text-[11px] font-bold text-[#888]">
              Win rate{" "}
              <span className="font-black text-[#15b78f]">{stats.winRate}%</span>
            </p>
          )} */}
        </section>
      )}

      <div className="sticky top-14 z-30 border-b border-[#ddd] bg-white/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {(
            [
              { key: "all" as const, label: "All" },
              { key: "win" as const, label: "Wins" },
              { key: "loss" as const, label: "Losses" },
              { key: "draw" as const, label: "Draws" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setResultFilter(tab.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition active:scale-[0.98] ${
                resultFilter === tab.key
                  ? "bg-[#f65357] text-white shadow-sm"
                  : "bg-[#f0f0f0] text-[#666] hover:bg-[#e8e8e8]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-14 text-center">
            <Calendar className="h-10 w-10 text-[#ccc]" />
            <p className="mt-3 font-display text-base font-black text-[#333]">
              No matches yet
            </p>
            <p className="mt-1 max-w-[260px] text-xs font-semibold text-[#888]">
              Your battle results will show up here after you complete your first
              quiz match.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-5 flex h-10 items-center gap-2 rounded-xl bg-[#f65357] px-5 text-xs font-black uppercase tracking-wide text-white shadow-md transition active:scale-[0.98]"
            >
              <Swords className="h-4 w-4" />
              Find a match
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#ddd] bg-white px-6 py-12 text-center">
            <Search className="h-9 w-9 text-[#ccc]" />
            <p className="mt-3 font-display text-sm font-black text-[#333]">
              No matches found
            </p>
            <p className="mt-1 text-xs font-semibold text-[#888]">
              Try a different search or filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResultFilter("all");
                setSearchOpen(false);
              }}
              className="mt-4 text-xs font-black uppercase tracking-wide text-[#f65357]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ label, matches }) => (
              <section key={label}>
                <h2 className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#999]">
                  {label}
                </h2>
                <ul className="space-y-2.5">
                  {matches.map((match) => {
                    const isWin = match.result === "win";
                    const isLoss = match.result === "loss";
                    const bgColor = isWin
                      ? "bg-emerald-50/90"
                      : isLoss
                        ? "bg-red-50/90"
                        : "bg-[#f8f8f8]";
                    const borderColor = isWin
                      ? "border-emerald-100"
                      : isLoss
                        ? "border-red-100"
                        : "border-[#e5e5e5]";
                    const textColor = isWin
                      ? "text-[#15b78f]"
                      : isLoss
                        ? "text-[#f65357]"
                        : "text-[#888]";
                    const label = isWin ? "Victory" : isLoss ? "Defeat" : "Draw";
                    const resultImg = isWin
                      ? "/images/victory.png"
                      : isLoss
                        ? "/images/defeat.png"
                        : "/images/draw.png";
                    const avatar = resolveMediaUrl(
                      match.opponentAvatar,
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(match.opponentName)}`
                    );

                    return (
                      <li key={match.matchId}>
                        <article
                          className={`${bgColor} border ${borderColor} rounded-2xl p-3 shadow-sm transition active:scale-[0.99]`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={avatar}
                                alt=""
                                className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(match.opponentName)}`;
                                }}
                              />
                              <img
                                src={resultImg}
                                alt=""
                                className="absolute -bottom-1 left-1/2 h-5 w-auto -translate-x-1/2 drop-shadow"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[10px] font-black uppercase tracking-wider ${textColor}`}
                              >
                                {label}
                              </p>
                              <p className="truncate text-[15px] font-black leading-tight text-[#222]">
                                {match.opponentName}
                              </p>
                              <p className="truncate text-[11px] font-semibold text-[#777]">
                                {match.categoryName}
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold text-[#aaa]">
                                {formatPlayedAt(match.playedAt)}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p
                                className={`font-display text-2xl font-black tracking-tighter ${textColor}`}
                              >
                                {match.playerScore}
                                <span className="mx-0.5 text-sm font-bold text-[#bbb]">
                                  –
                                </span>
                                {match.opponentScore}
                              </p>
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchHistory;
