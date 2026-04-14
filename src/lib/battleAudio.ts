type AudioState = {
  matchMusic: HTMLAudioElement | null;
  victory: HTMLAudioElement | null;
  defeat: HTMLAudioElement | null;
};

const state: AudioState = {
  matchMusic: null,
  victory: null,
  defeat: null,
};

function safePlay(a: HTMLAudioElement) {
  const p = a.play();
  if (p && typeof (p as Promise<void>).catch === "function") {
    (p as Promise<void>).catch(() => {});
  }
}

function create(src: string, { loop, volume }: { loop: boolean; volume: number }) {
  const a = new Audio(src);
  a.loop = loop;
  a.preload = "auto";
  a.volume = Math.max(0, Math.min(1, volume));
  return a;
}

export function startMatchMusic() {
  if (!state.matchMusic) {
    state.matchMusic = create("/audio/quizup-match.mp3", { loop: true, volume: 0.35 });
  }
  state.matchMusic.currentTime = 0;
  safePlay(state.matchMusic);
}

export function stopMatchMusic() {
  const a = state.matchMusic;
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

export function playVictorySfx() {
  if (!state.victory) {
    state.victory = create("/audio/quizup-victory.mp3", { loop: false, volume: 0.7 });
  }
  state.victory.currentTime = 0;
  safePlay(state.victory);
}

export function playDefeatSfx() {
  if (!state.defeat) {
    state.defeat = create("/audio/quizup-defeat.mp3", { loop: false, volume: 0.7 });
  }
  state.defeat.currentTime = 0;
  safePlay(state.defeat);
}

