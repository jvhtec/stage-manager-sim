/**
 * Visas and carnets. Taking a rig and a crew across a border costs paperwork:
 * an ATA carnet for the kit (a flat fee, a slice of its value, and a little
 * per extra country) and a work visa per head where the country wants one.
 * Which countries want what depends on where you're from and the year — the
 * EU is a single room for EU firms; the UK needs carnets for Europe from 2021.
 */
import { getProduct } from './content/gear';
import { REGIONS } from './content/world';
import type { CountryCode } from './content/countries';
import type { Gig, GearStock, TycoonState } from './types';

/** Flat fee per carnet, a share of the insured kit value, and per extra country on it. */
export const CARNET_FLAT = 400;
export const CARNET_VALUE_RATE = 0.003;
export const CARNET_PER_EXTRA_COUNTRY = 120;

/** Work visa per head, by destination country code (non-EU, from outside it). Cost in home-currency units. */
export const VISA_PER_HEAD: Record<string, number> = { US: 480, CA: 220, MX: 0, BR: 90, AR: 0, CL: 0, CO: 0, JP: 260, KR: 200, AU: 380, SG: 150 };

const EU = new Set<string>(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'DK', 'AT', 'IE']);

/** Kit needs a carnet unless it's moving inside the single market. */
export function needsCarnet(home: CountryCode, dest: string, year: number): boolean {
  if (home === dest) return false;
  if (EU.has(home) && EU.has(dest)) return false;
  // The UK stayed in free circulation until 2021, then needed carnets for the EU too.
  if ((home === 'GB' && EU.has(dest)) || (EU.has(home) && dest === 'GB')) return year >= 2021;
  if (home === 'GB' && dest === 'IE') return year >= 2021;
  return true;
}

export function visaPerHead(home: CountryCode, dest: string, year: number): number {
  if (home === dest || EU.has(dest) || dest === 'GB') return 0;
  const base = VISA_PER_HEAD[dest] ?? 0;
  // Visa fees crept up over the decades.
  return Math.round(base * (0.55 + 0.45 * Math.min(1, Math.max(0, (year - 1975) / 45))));
}

export interface PaperworkLine {
  country: string;
  code: string;
  visa: number;
  carnet: boolean;
}

export interface Paperwork {
  lines: PaperworkLine[];
  carnet: number;
  visas: number;
  total: number;
}

const kitValue = (kit: GearStock) => Object.entries(kit).reduce((sum, [id, n]) => sum + getProduct(id).price * n, 0);

/** A planning estimate before any kit is loaded: what the show asks for, at a typical price a unit. */
export function estimatePaperwork(state: Pick<TycoonState, 'country'>, gig: Gig, year: number): Paperwork {
  const units = Object.values(gig.needs).reduce((a, b) => a + b, 0);
  return paperworkFor(state, gig, {}, gig.crewNeeded, year, units * 2500);
}

/** What a leg abroad costs in paperwork for `crew` heads and `kit` going out. */
export function paperworkFor(state: Pick<TycoonState, 'country'>, gig: Gig, kit: GearStock, crew: number, year: number, valueOverride?: number): Paperwork {
  if (!gig.overseas) return { lines: [], carnet: 0, visas: 0, total: 0 };
  const seen = new Map<string, PaperworkLine>();
  gig.overseas.stops.forEach(s => {
    const code = codeOf(s.city, s.country);
    if (seen.has(code)) return;
    seen.set(code, { country: s.country, code, visa: visaPerHead(state.country, code, year), carnet: needsCarnet(state.country, code, year) });
  });
  const lines = [...seen.values()];
  const carnetCountries = lines.filter(l => l.carnet).length;
  const carnet = carnetCountries ? Math.round(CARNET_FLAT + (valueOverride ?? kitValue(kit)) * CARNET_VALUE_RATE + (carnetCountries - 1) * CARNET_PER_EXTRA_COUNTRY) : 0;
  const visas = lines.reduce((sum, l) => sum + l.visa * crew, 0);
  return { lines, carnet, visas, total: carnet + visas };
}

/** ISO code for an overseas stop (stops carry the country's display name, the content has the code). */
function codeOf(city: string, country: string): string {
  for (const r of REGIONS) {
    const hit = r.cities.find(c => c.city === city);
    if (hit) return hit.code;
  }
  return country;
}
