import { create } from "zustand";

/** One clock for the whole case: hours relative to the image time. */
interface ClockState {
  h: number;
  min: number;
  max: number;
  playing: boolean;
  speed: number; // hours per second
  direction: 1 | -1;
  loop: boolean;
  setRange: (min: number, max: number) => void;
  setH: (h: number) => void;
  step: (dh: number) => void;
  play: (direction?: 1 | -1) => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  setLoop: (b: boolean) => void;
  /** Animate from `from` to `to` once (used by the Drift reconstruction moment). */
  runTo: (from: number, to: number, seconds: number) => void;
  target: number | null;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const useClock = create<ClockState>((set, get) => ({
  h: 0,
  min: -72,
  max: 24,
  playing: false,
  speed: 3,
  direction: 1,
  loop: false,
  target: null,
  setRange: (min, max) => set((s) => ({ min, max, h: clamp(s.h, min, max) })),
  setH: (h) => set((s) => ({ h: clamp(h, s.min, s.max) })),
  step: (dh) => set((s) => ({ h: clamp(Math.round((s.h + dh) * 4) / 4, s.min, s.max), playing: false, target: null })),
  play: (direction) =>
    set((s) => {
      const dir = direction ?? s.direction;
      let h = s.h;
      if (dir > 0 && h >= s.max) h = s.min;
      if (dir < 0 && h <= s.min) h = s.max;
      return { playing: true, direction: dir, h, target: null };
    }),
  pause: () => set({ playing: false, target: null }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),
  setLoop: (loop) => set({ loop }),
  runTo: (from, to, seconds) =>
    set((s) => ({
      h: clamp(from, s.min, s.max),
      playing: true,
      direction: to >= from ? 1 : -1,
      speed: Math.abs(to - from) / seconds,
      target: clamp(to, s.min, s.max),
    })),
}));

let raf = 0;
let last = 0;
function tick(now: number) {
  const s = useClock.getState();
  if (s.playing) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    let h = s.h + s.direction * s.speed * dt;
    if (s.target != null && (s.direction > 0 ? h >= s.target : h <= s.target)) {
      useClock.setState({ h: s.target, playing: false, target: null, speed: 3 });
    } else if (h > s.max || h < s.min) {
      if (s.loop) h = s.direction > 0 ? s.min : s.max;
      else {
        h = clamp(h, s.min, s.max);
        useClock.setState({ h, playing: false });
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      useClock.setState({ h });
    } else {
      useClock.setState({ h });
    }
  }
  last = now;
  raf = requestAnimationFrame(tick);
}

export function startClock() {
  if (!raf) raf = requestAnimationFrame(tick);
}
