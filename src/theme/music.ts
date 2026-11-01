import { create } from "zustand";
import trackUrl from "../assets/themes/legacy-8bit/music.mp3?url";
import { readPref, writePref } from "../state/persistence";

export const TRACK = { src: trackUrl, title: "The Return of the 8-bit Era" };

/**
 * The soundtrack. Its control is part of every theme's markup and hidden by
 * CSS unless the theme shows it. Off on every visit - browsers block autoplay anyway,
 * and a tool that starts making noise on load is annoying. The volume is
 * remembered; the track is only downloaded the first time someone presses play.
 */
interface MusicState {
  playing: boolean;
  volume: number;
  toggle(): Promise<void>;
  setVolume(volume: number): void;
  stop(): void;
}

export const DEFAULT_VOLUME = 0.5;

let audio: HTMLAudioElement | null = null;

function clamp(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : DEFAULT_VOLUME));
}

export const useMusic = create<MusicState>((set, get) => ({
  playing: false,
  volume: clamp(readPref<number>("musicVolume", DEFAULT_VOLUME)),

  toggle: async () => {
    if (get().playing) {
      get().stop();
      return;
    }
    if (!audio) {
      audio = new Audio(TRACK.src);
      audio.loop = true;
    }
    audio.volume = get().volume;
    try {
      await audio.play();
      set({ playing: true });
    } catch (error) {
      console.info("Playback was blocked:", error);
      set({ playing: false });
    }
  },

  setVolume: (volume) => {
    const v = clamp(volume);
    if (audio) audio.volume = v;
    writePref("musicVolume", v);
    set({ volume: v });
  },

  stop: () => {
    audio?.pause();
    set({ playing: false });
  },
}));
