import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buyGear, setPartner } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { PARTNER_DISCOUNT, PARTNER_GRACE, brandShare, brandsFor, monthlyPartners, partnerPrice, sponsorship } from '../partners';
import { getProduct } from '../content/gear';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'P', color: '#f00', seed: 5, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 3_000_000, reputation: 60 } };
};
/** The brand that makes the most of the audio kit you start with. */
const mainBrand = (s: TycoonState) => {
  const counts: Record<string, number> = {};
  Object.entries(s.depots[0].gear).forEach(([id, n]) => {
    const p = getProduct(id);
    if (p.dept === 'audio') counts[p.brand] = (counts[p.brand] ?? 0) + n;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

describe('maker partnerships', () => {
  it('need standing, and the brand has to make that kind of kit', () => {
    const low = { ...game(), company: { ...game().company, reputation: 5 } };
    expect(setPartner(low, 'audio', mainBrand(low)).result.ok).toBe(false);
    const s = game();
    expect(setPartner(s, 'audio', 'No Such Brand').result.ok).toBe(false);
    expect(brandsFor(s, 'audio')).toContain(mainBrand(s));
  });

  it('give a discount on the partner brand only', () => {
    let s = game();
    const brand = mainBrand(s);
    s = setPartner(s, 'audio', brand).state;
    const ids = s.announcedGear;
    const partnerId = ids.find(id => getProduct(id).brand === brand && getProduct(id).dept === 'audio')!;
    const otherId = ids.find(id => getProduct(id).brand !== brand && getProduct(id).dept === 'audio')!;
    expect(partnerPrice(s, partnerId)).toBe(Math.round(getProduct(partnerId).price * (1 - PARTNER_DISCOUNT)));
    expect(partnerPrice(s, otherId)).toBe(getProduct(otherId).price);
    const before = s.company.cash;
    const bought = buyGear(s, s.depots[0].id, partnerId).state;
    expect(before - bought.company.cash).toBe(partnerPrice(s, partnerId));
  });

  it('pay a sponsorship while most of the racks wear their name', () => {
    let s = game();
    const brand = mainBrand(s);
    s = setPartner(s, 'audio', brand).state;
    const share = brandShare(s, 'audio', brand);
    const cash = s.company.cash;
    if (share >= 0.5) {
      expect(sponsorship(s, 'audio')).toBeGreaterThan(0);
      monthlyPartners(s);
      expect(s.company.cash - cash).toBe(sponsorship(s, 'audio'));
      expect(s.ledger[1995]?.sponsorship ?? 0).toBeGreaterThan(0);
    } else {
      expect(sponsorship(s, 'audio')).toBe(0);
    }
  });

  it('walk away after repeated warnings when the racks go mixed', () => {
    let s = game();
    const brand = mainBrand(s);
    s = setPartner(s, 'audio', brand).state;
    // Fill the audio racks with someone else's kit.
    const other = s.announcedGear.find(id => getProduct(id).dept === 'audio' && getProduct(id).brand !== brand)!;
    s.depots[0].gear[other] = 500;
    expect(brandShare(s, 'audio', brand)).toBeLessThan(0.5);
    for (let i = 0; i <= PARTNER_GRACE; i++) monthlyPartners(s);
    expect(s.partners.audio).toBeUndefined();
    expect(s.news.some(n => /ends its audio partnership/.test(n.text))).toBe(true);
  });

  it('cannot be swapped inside a year, but can be ended any time', () => {
    let s = game();
    const brand = mainBrand(s);
    s = setPartner(s, 'audio', brand).state;
    const other = brandsFor(s, 'audio').find(b => b !== brand)!;
    expect(setPartner(s, 'audio', other).result.ok).toBe(false);
    s = advanceHours(s, 366 * HOURS_PER_DAY);
    expect(setPartner({ ...s, company: { ...s.company, reputation: 60 } }, 'audio', other).result.ok).toBe(true);
    expect(setPartner(s, 'audio').result.ok).toBe(true);
  });
});
