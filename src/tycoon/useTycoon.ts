/**
 * Owns the live game: the state lives in a ref (the canvas reads it every
 * animation frame without React re-rendering), a requestAnimationFrame loop
 * advances the sim at the chosen speed, and the React UI is refreshed at a
 * throttled rate. Actions are applied synchronously to the ref.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { advanceHours } from '@/world/sim';
import {
  clearTycoonGame,
  createTycoonGame,
  loadTycoonGame,
  saveTycoonGame,
  type NewGameOptions,
} from '@/world/state';
import type { ActionOutcome, ActionResult, NewsItem, TycoonState } from '@/world/types';

/** Game hours per real second at each speed setting (0 = paused). */
export const SPEEDS = [0, 1, 3, 8, 24] as const;
const UI_REFRESH_MS = 200;
const AUTOSAVE_MS = 4000;
const MAX_STEPS_PER_FRAME = 48;

export interface Tycoon {
  state: TycoonState | null;
  stateRef: React.MutableRefObject<TycoonState | null>;
  alphaRef: React.MutableRefObject<number>;
  speed: number;
  setSpeed: (s: number) => void;
  dispatch: (fn: (s: TycoonState) => ActionOutcome) => ActionResult;
  newGame: (opts: NewGameOptions) => void;
  preview: (seed: number, hqCityId?: string) => void;
  isPreview: boolean;
  abandon: () => void;
  popups: NewsItem[];
  dismissPopup: (id: string) => void;
}

export function useTycoon(): Tycoon {
  const stateRef = useRef<TycoonState | null>(null);
  const alphaRef = useRef(0);
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(1);
  const [popups, setPopups] = useState<NewsItem[]>([]);
  const lastNewsId = useRef<string | null>(null);
  /** True while the new-game screen shows a throwaway preview of a map. */
  const previewRef = useRef(false);

  if (stateRef.current === null && typeof window !== 'undefined') {
    stateRef.current = loadTycoonGame();
    lastNewsId.current = stateRef.current?.news[0]?.id ?? null;
  }

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const collectNews = useCallback((s: TycoonState) => {
    const fresh: NewsItem[] = [];
    for (const item of s.news) {
      if (item.id === lastNewsId.current) break;
      fresh.push(item);
    }
    lastNewsId.current = s.news[0]?.id ?? null;
    const notable = fresh.filter(n => n.tone !== 'info').reverse();
    if (notable.length) setPopups(prev => [...prev, ...notable].slice(-4));
  }, []);

  // Simulation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let lastSave = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (s && !s.gameOver && !previewRef.current) {
        acc += dt * SPEEDS[speedRef.current];
        const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(acc));
        if (steps > 0) {
          acc -= steps;
          const next = advanceHours(s, steps);
          stateRef.current = next;
          collectNews(next);
          if (next.gameOver) setSpeed(0);
        }
        alphaRef.current = SPEEDS[speedRef.current] ? acc : 0;
      }
      if (now - lastUi > UI_REFRESH_MS) {
        lastUi = now;
        refresh();
      }
      if (now - lastSave > AUTOSAVE_MS && stateRef.current && !previewRef.current) {
        lastSave = now;
        saveTycoonGame(stateRef.current);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const flush = () => stateRef.current && !previewRef.current && saveTycoonGame(stateRef.current);
    window.addEventListener('pagehide', flush);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [collectNews, setSpeed]);

  const dispatch = useCallback(
    (fn: (s: TycoonState) => ActionOutcome): ActionResult => {
      const s = stateRef.current;
      if (!s) return { ok: false, message: 'No game running.' };
      const { state, result } = fn(s);
      stateRef.current = state;
      collectNews(state);
      saveTycoonGame(state);
      refresh();
      return result;
    },
    [collectNews],
  );

  const newGame = useCallback(
    (opts: NewGameOptions) => {
      const s = createTycoonGame(opts);
      previewRef.current = false;
      stateRef.current = s;
      lastNewsId.current = null;
      collectNews(s);
      saveTycoonGame(s);
      setSpeed(1);
      refresh();
    },
    [collectNews, setSpeed],
  );

  const preview = useCallback((seed: number, hqCityId?: string) => {
    previewRef.current = true;
    stateRef.current = createTycoonGame({ companyName: '', color: '#9ca3af', seed, hqCityId });
    refresh();
  }, []);

  const abandon = useCallback(() => {
    clearTycoonGame();
    stateRef.current = null;
    setPopups([]);
    refresh();
  }, []);

  const dismissPopup = useCallback((id: string) => setPopups(prev => prev.filter(p => p.id !== id)), []);

  return {
    state: stateRef.current,
    stateRef,
    alphaRef,
    speed,
    setSpeed,
    dispatch,
    newGame,
    preview,
    isPreview: previewRef.current,
    abandon,
    popups,
    dismissPopup,
  };
}
