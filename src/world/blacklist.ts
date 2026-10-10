/**
 * Burnt bridges. A show that falls apart isn't forgotten after a reputation dip: the act won't
 * book you for two years, and a promoter you had no goodwill with closes the venue's door for one.
 * Break the same act's rider twice in a year and they stop calling too. Bans run out — and the
 * story of why is in the post-mortems.
 */
import { dayOf, formatDay, pushNews } from './core';
import { logIncident } from './consequences';
import type { Cause, Gig, TycoonState } from './types';

export const ACT_BAN_DAYS = 730;
export const VENUE_BAN_DAYS = 365;
export const BREACH_BAN_DAYS = 365;

const actKey = (act: string) => `act:${act}`;
const venueKey = (venueId: string) => `venue:${venueId}`;

export const bannedUntil = (s: Pick<TycoonState, 'blacklist'>, key: string) => s.blacklist?.[key] ?? -1;
export const actBanned = (s: Pick<TycoonState, 'blacklist' | 'hour'>, act: string) => bannedUntil(s, actKey(act)) > dayOf(s.hour);
export const venueBanned = (s: Pick<TycoonState, 'blacklist' | 'hour'>, venueId: string) => bannedUntil(s, venueKey(venueId)) > dayOf(s.hour);
export const offerBlocked = (s: Pick<TycoonState, 'blacklist' | 'hour'>, gig: Pick<Gig, 'act' | 'venueId'>) => actBanned(s, gig.act) || venueBanned(s, gig.venueId);

function ban(s: TycoonState, key: string, days: number, title: string, causes: Cause[], news: string) {
  const until = dayOf(s.hour) + days;
  if (bannedUntil(s, key) >= until) return;
  s.blacklist = { ...(s.blacklist ?? {}), [key]: until };
  logIncident(s, { kind: 'client', title, causes, outcome: `No work from them until ${formatDay(s, until)}.` });
  pushNews(s, `${news} Not until ${formatDay(s, until)}.`, 'bad');
}

/** A show fell apart: the act walks, and a promoter with no goodwill to spare closes the door. */
export function afterDisaster(s: TycoonState, gig: Gig, where: string, venueGoodwill: number) {
  if (gig.festival || gig.event) return;
  const cause: Cause = { id: 'disaster', label: 'The show fell apart', detail: `${gig.act} at ${where}.`, weight: 1 };
  ban(s, actKey(gig.act), ACT_BAN_DAYS, `${gig.act} won't work with you`, [cause], `${gig.act}'s management won't book you again after ${where}.`);
  if (venueGoodwill <= 0 && !gig.overseas)
    ban(s, venueKey(gig.venueId), VENUE_BAN_DAYS, `Banned from ${where.split(',')[0]}`, [cause, { id: 'no-goodwill', label: 'No goodwill to fall back on', detail: 'You had no history with the promoter to soften it.', weight: 0.5 }], `The promoter at ${where.split(',')[0]} has had enough of you.`);
}

/** A broken rider: twice in a year for the same act and they stop calling. */
export function afterBreach(s: TycoonState, gig: Gig) {
  const today = dayOf(s.hour);
  const log = (s.breachLog ??= {});
  const recent = (log[gig.act] ?? []).filter(d => today - d <= 365);
  recent.push(today);
  log[gig.act] = recent;
  if (recent.length >= 2)
    ban(s, actKey(gig.act), BREACH_BAN_DAYS, `${gig.act} won't work with you`, [{ id: 'rider-twice', label: 'Rider broken twice', detail: `You broke ${gig.act}'s technical rider ${recent.length} times in a year.`, weight: 0.9 }], `${gig.act}'s engineer has told their management: never again.`);
}

/** Bans still running, for the League window. */
export function activeBans(s: Pick<TycoonState, 'blacklist' | 'hour'>): { key: string; until: number }[] {
  const today = dayOf(s.hour);
  return Object.entries(s.blacklist ?? {})
    .filter(([, until]) => until > today)
    .map(([key, until]) => ({ key, until }))
    .sort((a, b) => b.until - a.until);
}
