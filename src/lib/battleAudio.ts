type AudioState = {
  matchMusic: HTMLAudioElement | null;
  victory: HTMLAudioElement | null;
  defeat: HTMLAudioElement | null;
  countdown: HTMLAudioElement | null;
};

const state: AudioState = {
  matchMusic: null,
  victory: null,
  defeat: null,
  countdown: null,
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
    state.matchMusic = create("/audio/quizup-match.mp3", { loop: true, volume: 0.9 });
  }
  // Don't restart the track on every render/question; only start/resume if paused/ended.
  if (state.matchMusic.ended) state.matchMusic.currentTime = 0;
  if (state.matchMusic.paused) safePlay(state.matchMusic);
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

export function playCountdownSfx() {
  if (!state.countdown) {
    state.countdown = create("/audio/timer.mp3", { loop: false, volume: 0.9 });
  }
  state.countdown.currentTime = 0;
  safePlay(state.countdown);
}

export function stopCountdownSfx() {
  const a = state.countdown;
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

export function stopVictorySfx() {
  const a = state.victory;
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

export function stopDefeatSfx() {
  const a = state.defeat;
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}
