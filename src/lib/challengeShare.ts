import { APP_URL } from "@/config/env";

export interface ChallengeShareInfo {
  challengeId: string;
  fromUsername: string;
  toUsername?: string;
  categoryName: string;
  shareUrl?: string;
}

export function buildChallengeShareUrl(challengeId: string): string {
  return `${APP_URL}/#/challenge/${challengeId}`;
}

export function buildChallengeShareMessage(info: ChallengeShareInfo): string {
  const topic = info.categoryName || "Quiz";
  if (info.toUsername) {
    return `${info.fromUsername} challenged you to a ${topic} quiz on QuizUp! 🎯`;
  }
  return `Join me for a ${topic} quiz battle on QuizUp! 🎯`;
}

export function buildChallengeShareText(info: ChallengeShareInfo): string {
  const url = info.shareUrl || buildChallengeShareUrl(info.challengeId);
  return `${buildChallengeShareMessage(info)}\n\n${url}`;
}

export function shareViaWhatsApp(info: ChallengeShareInfo): void {
  const text = buildChallengeShareText(info);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function shareViaTelegram(info: ChallengeShareInfo): void {
  const url = info.shareUrl || buildChallengeShareUrl(info.challengeId);
  const text = buildChallengeShareMessage(info);
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export function shareViaTwitter(info: ChallengeShareInfo): void {
  const text = buildChallengeShareText(info);
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export async function copyChallengeLink(info: ChallengeShareInfo): Promise<void> {
  await navigator.clipboard.writeText(buildChallengeShareText(info));
}

export async function nativeShareChallenge(info: ChallengeShareInfo): Promise<boolean> {
  if (!navigator.share) return false;
  const url = info.shareUrl || buildChallengeShareUrl(info.challengeId);
  await navigator.share({
    title: "QuizUp Challenge",
    text: buildChallengeShareMessage(info),
    url,
  });
  return true;
}

export function buildAppInviteMessage(username?: string): string {
  const who = username ? `${username} invited you` : "Join me";
  return `${who} on QuizUp — the live quiz battle app! 🎯\n\n${APP_URL}/#/signup`;
}

export async function shareAppInvite(username?: string): Promise<void> {
  const text = buildAppInviteMessage(username);
  if (navigator.share) {
    await navigator.share({ title: "QuizUp", text, url: `${APP_URL}/#/signup` });
    return;
  }
  await navigator.clipboard.writeText(text);
}
