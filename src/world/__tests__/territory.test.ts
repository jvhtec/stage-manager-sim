import { describe, expect, it } from 'vitest';
import { countTownShow, fadeTownShows, townShare } from '../territory';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';

describe('who works where', () => {
  it('tallies shows per town and fades them each year', () => {
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 3, country: 'GB', startYear: 1995 });
    expect(townShare(s, 'city-0')).toEqual({ total: 0 });
    countTownShow(s, 'city-0', 'player');
    countTownShow(s, 'city-0', 'player');
    countTownShow(s, 'city-0', 'rival-x');
    const share = townShare(s, 'city-0');
    expect(share.yours).toBeCloseTo(2 / 3);
    expect(share.leader).toEqual({ owner: 'player', share: 2 / 3 });
    fadeTownShows(s);
    expect(s.townShows['city-0'].player).toBeCloseTo(1.2);
  });

  it('rivals build up territory as they play', () => {
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 3, country: 'GB', startYear: 1995 });
    const later = advanceHours(s, 24 * 60);
    const owners = Object.values(later.townShows).flatMap(t => Object.keys(t));
    expect(owners.some(o => o !== 'player')).toBe(true);
  });
});
