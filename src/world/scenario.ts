/**
 * What are you playing for? A goal (or none) and a difficulty chosen at the
 * start, a progress read-out, a moment of victory — and a legacy score that
 * sums up the whole career when it ends or whenever you want to look.
 */
import { NEGATIVE_MONTHS_GAME_OVER } from './catalog';
import { dayOf, pushNews, yearOf } from './core';
import { companyValue } from './queries';
import type { Difficulty, GoalId, TycoonState } from './types';

export interface DifficultyInfo {
  label: string;
  blurb: string;
  startingCash: number;
  /** Multiplier on how readily rivals snap up offers. */
  rivals: number;
  /** Multiplier on how often things go wrong on the day. */
  crises: number;
  /** Months in the red before the bank pulls the plug. */
  graceMonths: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  easy: { label: 'Gentle', blurb: 'More cash to start, softer rivals, patient bank.', startingCash: 1.6, rivals: 0.8, crises: 0.7, graceMonths: 5 },
  normal: { label: 'Standard', blurb: 'The game as designed.', startingCash: 1, rivals: 1, crises: 1, graceMonths: NEGATIVE_MONTHS_GAME_OVER },
  hard: { label: 'Cutthroat', blurb: 'Lean start, hungry rivals, a jumpy bank.', startingCash: 0.7, rivals: 1.25, crises: 1.3, graceMonths: 2 },
};
export const DIFFICULTY_IDS: Difficulty[] = ['easy', 'normal', 'hard'];
export const difficultyOf = (s: Pick<TycoonState, 'difficulty'>): DifficultyInfo => DIFFICULTIES[s.difficulty ?? 'normal'];

export interface GoalProgress {
  /** 0-1. */
  fraction: number;
  /** "Reputation 54 / 90". */
  text: string;
  done: boolean;
}

export interface GoalInfo {
  label: string;
  blurb: string;
  /** Years from the start to do it in; none = no deadline. */
  years?: number;
  progress: (s: TycoonState) => GoalProgress;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ratio = (value: number, target: number, text: string): GoalProgress => ({ fraction: clamp01(value / target), text, done: value >= target });

export const GOALS: Record<GoalId, GoalInfo> = {
  sandbox: { label: 'Sandbox', blurb: 'No goal. Build whatever you like.', progress: () => ({ fraction: 0, text: '', done: false }) },
  top: { label: 'Top of the industry', blurb: 'Reach reputation 90 within 25 years.', years: 25, progress: s => ratio(s.company.reputation, 90, `Reputation ${Math.round(s.company.reputation)} / 90`) },
  empire: { label: 'An empire', blurb: 'Be worth £15 million within 20 years.', years: 20, progress: s => ratio(companyValue(s), 15_000_000, `Worth ${Math.round(companyValue(s) / 1000)}k / 15,000k`) },
  worlds: { label: 'Around the world', blurb: 'Complete three world tours within 25 years.', years: 25, progress: s => {
    const n = s.tours.filter(t => t.kind === 'world' && t.status === 'done').length;
    return ratio(n, 3, `${n} / 3 world tours`);
  } },
  awards: { label: 'Silverware', blurb: 'Win Production Company of the Year three times.', progress: s => {
    const n = s.awards.filter(a => a.title === 'Production Company of the Year').length;
    return ratio(n, 3, `${n} / 3 titles`);
  } },
  consolidator: { label: 'The consolidator', blurb: 'Buy out three rivals within 25 years.', years: 25, progress: s => {
    const n = s.stats.rivalsBought ?? 0;
    return ratio(n, 3, `${n} / 3 rivals bought`);
  } },
  survivor: { label: 'Built to last', blurb: 'Keep the company going for 30 years.', years: 30, progress: s => {
    const y = Math.floor(s.hour / (24 * 365));
    return ratio(y, 30, `${y} / 30 years`);
  } },
};
export const GOAL_IDS = Object.keys(GOALS) as GoalId[];

export const goalDeadlineYear = (s: Pick<TycoonState, 'goal' | 'startYear'>): number | undefined => {
  const years = GOALS[s.goal ?? 'sandbox'].years;
  return years === undefined ? undefined : s.startYear + years;
};

/** Monthly: has the goal been met — or has time run out? */
export function monthlyGoal(s: TycoonState) {
  const id = s.goal ?? 'sandbox';
  if (id === 'sandbox' || s.goalResult) return;
  const info = GOALS[id];
  const p = info.progress(s);
  if (p.done) {
    s.goalResult = { status: 'won', day: dayOf(s.hour) };
    pushNews(s, `🏆 GOAL REACHED — ${info.label}: ${info.blurb.replace(/\.$/, '')}. ${s.company.name} has made it. Keep going for a higher legacy score.`, 'big');
    return;
  }
  const deadline = goalDeadlineYear(s);
  if (deadline !== undefined && yearOf(s, s.hour) >= deadline) {
    s.goalResult = { status: 'missed', day: dayOf(s.hour) };
    pushNews(s, `Time's up on "${info.label}" — you didn't get there (${p.text}). The company carries on.`, 'info');
  }
}

export interface LegacyScore {
  total: number;
  parts: { label: string; points: number }[];
}

/** One number for the whole career. */
export function legacyScore(s: TycoonState): LegacyScore {
  const years = (s.gameOver ? s.gameOver.hour : s.hour) / (24 * 365);
  const diff = { easy: 0.8, normal: 1, hard: 1.25 }[s.difficulty ?? 'normal'];
  const parts = [
    { label: 'Company value', points: Math.round(Math.max(0, companyValue(s)) / 10_000) },
    { label: 'Reputation', points: Math.round(s.company.reputation * 10) },
    { label: 'Shows played', points: Math.round(s.stats.showsPlayed * 0.5) },
    { label: 'Awards', points: s.awards.length * 150 },
    { label: 'Milestones', points: s.milestones.length * 40 },
    { label: 'Years in business', points: Math.round(years * 20) },
    { label: 'Goal reached', points: s.goalResult?.status === 'won' ? 1000 : 0 },
  ];
  return { total: Math.round(parts.reduce((a, p) => a + p.points, 0) * diff), parts };
}
