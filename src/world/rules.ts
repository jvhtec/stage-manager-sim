/**
 * Each country works by its own rules, and they change what a show asks of you:
 *  - Spain: summer fiestas — the town councils (ayuntamientos) book bands for the patron-saint
 *    weeks in July–September, far more often in small towns, and pay months late;
 *  - France: the *intermittents du spectacle* regime keeps a deep pool of cheap, experienced
 *    freelance technicians;
 *  - Germany: from the mid-90s big venues' regulations want a qualified *Meister für
 *    Veranstaltungstechnik* (an extra certified rigger) on the job;
 *  - Britain: the 1998 Working Time Regulations cap crew hours, so big or multi-day shows need
 *    relief crew;
 *  - America: right-to-work states have no union houses; the old union states do.
 * Edit freely — the numbers are game balance, the rules are real.
 */
import type { Gig, TycoonState, WorldMap } from './types';

// --- Spain ---------------------------------------------------------------------------------

/** Fiesta season: 1 July to 30 September. */
export const isFiestaSeason = (date: Date) => date.getUTCMonth() >= 6 && date.getUTCMonth() <= 8;
/** How much more often a small Spanish town offers a show in fiesta season. */
export const FIESTA_OFFER_BOOST = 1.8;
/** A council pays this many days after the show. */
export const COUNCIL_PAYMENT_DAYS = 75;

/** Is a show in a Spanish village or town in fiesta season, booked by the council? */
export function councilBooked(country: string, citySize: string, showDate: Date, tier: number): boolean {
  return country === 'ES' && (citySize === 'village' || citySize === 'town') && isFiestaSeason(showDate) && tier <= 2;
}

// --- France --------------------------------------------------------------------------------

/** The intermittents regime: freelancers are cheaper and there are more of them. */
export const INTERMITTENTS = { rate: 0.75, pool: 1.5 };

// --- Germany -------------------------------------------------------------------------------

/** From this year big German shows want a Meister für Veranstaltungstechnik. */
export const MEISTER_FROM = 1995;
export const needsMeister = (country: string, year: number, tier: number) => country === 'DE' && year >= MEISTER_FROM && tier >= 3;

// --- Britain -------------------------------------------------------------------------------

/** From this year crew hours are capped, and big or multi-day shows carry relief crew. */
export const WORKING_TIME_FROM = 1998;
export const needsReliefCrew = (country: string, year: number, tier: number, days: number) =>
  country === 'GB' && year >= WORKING_TIME_FROM && (tier >= 3 || days > 1);

// --- America -------------------------------------------------------------------------------

/** Right-to-work: union houses are rare. (Texas, Georgia, Florida, Tennessee, Nevada, Louisiana, Arizona.) */
const RIGHT_TO_WORK_TOWNS = new Set(['Dallas', 'Houston', 'Austin', 'Atlanta', 'Miami', 'Nashville', 'Las Vegas', 'New Orleans', 'Phoenix', 'San Antonio', 'Orlando', 'Charlotte']);
export const isRightToWork = (town: string) => RIGHT_TO_WORK_TOWNS.has(town);

// --- Where a show is played ----------------------------------------------------------------

/** The rules country of a show: a town abroad keeps its own country's. */
export function ruleCountry(state: Pick<TycoonState, 'country'>, world: Pick<WorldMap, 'cityById'>, cityId: string): string {
  return world.cityById.get(cityId)?.abroad?.country ?? state.country ?? 'GB';
}

/** One line per rule that applies to a show, for its window. */
export function showRules(country: string, gig: Pick<Gig, 'council' | 'meister' | 'relief'>): string[] {
  const out: string[] = [];
  if (gig.council) out.push(`Fiesta booked by the ayuntamiento — pays ${COUNCIL_PAYMENT_DAYS} days after the show`);
  if (gig.meister) out.push('Germany: a certified Meister für Veranstaltungstechnik (an extra rigger) must be on the crew');
  if (gig.relief) out.push('UK working-time rules: an extra pair of hands to relieve the crew');
  if (country === 'FR') out.push('Intermittents: freelance technicians are cheap and plentiful here');
  return out;
}
