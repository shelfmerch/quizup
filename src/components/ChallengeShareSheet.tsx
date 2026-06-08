import React, { useState } from "react";
import { Copy, MessageCircle, Send, Share2, X } from "lucide-react";
import { toast } from "sonner";
import {
  ChallengeShareInfo,
  copyChallengeLink,
  nativeShareChallenge,
  shareViaTelegram,
  shareViaWhatsApp,
} from "@/lib/challengeShare";

interface ChallengeShareSheetProps {
  info: ChallengeShareInfo;
  onClose: () => void;
  subtitle?: string;
}

const ChallengeShareSheet: React.FC<ChallengeShareSheetProps> = ({ info, onClose, subtitle }) => {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => void | Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error("Could not share", { position: "top-center" });
      }
    } finally {
      setBusy(null);
    }
  };

  const options = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      color: "bg-[#25D366]",
      icon: MessageCircle,
      action: () => shareViaWhatsApp(info),
    },
    {
      id: "telegram",
      label: "Telegram",
      color: "bg-[#229ED9]",
      icon: Send,
      action: () => shareViaTelegram(info),
    },
    {
      id: "more",
      label: "More",
      color: "bg-slate-800",
      icon: Share2,
      action: async () => {
        const shared = await nativeShareChallenge(info);
        if (!shared) {
          await copyChallengeLink(info);
          toast.success("Link copied — paste in Instagram, Snapchat, etc.", { position: "top-center" });
        }
      },
    },
    {
      id: "copy",
      label: "Copy link",
      color: "bg-[#f65357]",
      icon: Copy,
      action: async () => {
        await copyChallengeLink(info);
        toast.success("Challenge link copied!", { position: "top-center" });
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Share challenge</p>
            <p className="text-[15px] font-black text-slate-900 mt-0.5 truncate">
              {info.toUsername
                ? `Tell ${info.toUsername} on social media`
                : "Invite friends to play"}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">{subtitle}</p>
            )}
            <p className="text-xs text-amber-700 font-semibold mt-2 leading-snug">
              Match starts only when both players are online in the app.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 px-4 py-5">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={busy !== null}
                onClick={() => run(opt.id, opt.action)}
                className="flex flex-col items-center gap-2 disabled:opacity-50"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md ${opt.color}`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-[10px] font-bold text-slate-600">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeShareSheet;
