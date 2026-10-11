/**
 * Historical company events (content/actors), applied once each when their year comes:
 * - ownership: news only — the company, its base, kit, crew and clients carry on (EML → PRG);
 * - absorbed: folded into the buying firm, assets, bookings and patch included (rivals.ts absorbInto);
 *   if the buyer isn't in this game, the firm simply stops trading;
 * - pivot: it leaves rental competition for another business — not a bankruptcy;
 * - closure: it stops trading.
 *
 * Historical events take precedence over the simulation's own mergers for the firms they name, but
 * never resurrect a firm the simulation has already put out of business.
 */
import { pushNews } from './core';
import { releaseRivalWork, absorbInto } from './rivals';
import { actorById, type CompanyEvent } from './content/actors';
import type { TycoonState, WorldMap } from './types';

export const eventKey = (actorId: string, e: CompanyEvent) => `${actorId}:${e.kind}:${e.year}`;

function retire(s: TycoonState, id: string) {
  releaseRivalWork(s, id);
  s.rivals = s.rivals.filter(r => r.id !== id);
  s.vehicles = s.vehicles.filter(v => v.owner !== id);
  s.goneRivals.push(id);
}

export function applyCompanyEvents(s: TycoonState, _world: WorldMap, year: number) {
  const applied = (s.companyEventsApplied ??= []);
  [...s.rivals].forEach(r => {
    const a = actorById(r.id);
    (a?.events ?? []).forEach(e => {
      const key = eventKey(r.id, e);
      if (e.year > year || applied.includes(key) || !s.rivals.some(x => x.id === r.id)) return;
      applied.push(key);
      const loud = s.hour > 24;
      if (e.kind === 'ownership') {
        if (loud) pushNews(s, e.news, 'big', { cityId: r.hqCityId });
      } else if (e.kind === 'absorbed') {
        const buyer = s.rivals.find(x => x.id === e.into);
        if (buyer) absorbInto(s, r, buyer);
        else retire(s, r.id);
        if (loud) pushNews(s, e.news, 'big', { cityId: r.hqCityId });
      } else {
        retire(s, r.id);
        if (loud) pushNews(s, e.news, e.kind === 'pivot' ? 'info' : 'big', { cityId: r.hqCityId });
      }
    });
  });
}
