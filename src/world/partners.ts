/**
 * Manufacturer partnerships. Commit a department to one brand — Meyer for
 * sound, Martin for lights — and the maker looks after you: a discount on
 * their kit and a monthly sponsorship while most of your racks wear their
 * name. Go back to a mixed rack and they walk. A partnership can't be
 * swapped for a year: loyalty cuts both ways.
 */
import { book, dayOf, formatMoney, pushNews, yearOf } from './core';
import { productsAvailableIn, getProduct } from './content/gear';
import { tierInfo } from './catalog';
import { ownedStock } from './wear';
import { DEPTS, type Dept, type TycoonState } from './types';

/** Reputation a maker wants before they'll put your name on a poster. */
export const PARTNER_REPUTATION = tierInfo(2).minReputation;
/** Discount on the partner brand's kit in that department. */
export const PARTNER_DISCOUNT = 0.1;
/** Share of the department's racks that must wear their name for the sponsorship to flow. */
export const PARTNER_SHARE = 0.5;
/** Months below the share before they walk. */
export const PARTNER_GRACE = 2;
/** Days before you can swap a partner. */
export const PARTNER_LOCK_DAYS = 365;

export function brandsFor(state: TycoonState, dept: Dept): string[] {
  const year = yearOf(state, state.hour);
  const all = [...productsAvailableIn(year, dept), ...state.ownProducts.map(getProduct).filter(p => p.dept === dept)];
  return [...new Set(all.map(p => p.brand))].filter(b => b !== state.company.name).sort();
}

/** Share of a department's owned kit that carries `brand` (by units). */
export function brandShare(state: TycoonState, dept: Dept, brand: string): number {
  const stock = ownedStock(state);
  let total = 0;
  let mine = 0;
  for (const id in stock) {
    const p = getProduct(id);
    if (p.dept !== dept) continue;
    total += stock[id];
    if (p.brand === brand) mine += stock[id];
  }
  return total ? mine / total : 0;
}

/** Price you pay: the partner's discount on their own kit. */
export function partnerPrice(state: TycoonState, productId: string): number {
  const p = getProduct(productId);
  const partner = state.partners[p.dept];
  return Math.round(partner && partner.brand === p.brand ? p.price * (1 - PARTNER_DISCOUNT) : p.price);
}

/** What a partnership pays per month at your current share and standing. */
export function sponsorship(state: TycoonState, dept: Dept): number {
  const partner = state.partners[dept];
  if (!partner) return 0;
  const share = brandShare(state, dept, partner.brand);
  if (share < PARTNER_SHARE) return 0;
  return Math.round(share * (150 + state.company.reputation * 6));
}

export function partnerBlocker(state: TycoonState, dept: Dept, brand: string): string | null {
  if (state.company.reputation < PARTNER_REPUTATION) return `Makers want reputation ${PARTNER_REPUTATION}+ before they'll partner with you.`;
  if (!brandsFor(state, dept).includes(brand)) return `${brand} doesn't make ${dept} kit yet.`;
  const current = state.partners[dept];
  if (current && current.brand !== brand && dayOf(state.hour) - current.sinceDay < PARTNER_LOCK_DAYS) return `You signed with ${current.brand} less than a year ago.`;
  return null;
}

/** Mutating: sign (or switch to) a partner. */
export function signPartner(s: TycoonState, dept: Dept, brand: string) {
  s.partners[dept] = { brand, sinceDay: dayOf(s.hour), lapse: 0 };
}

export function endPartner(s: TycoonState, dept: Dept) {
  delete s.partners[dept];
}

/** Monthly: sponsorship money in; partners notice when your racks stop wearing their name. */
export function monthlyPartners(s: TycoonState) {
  DEPTS.forEach(dept => {
    const partner = s.partners[dept];
    if (!partner) return;
    const share = brandShare(s, dept, partner.brand);
    if (share >= PARTNER_SHARE) {
      partner.lapse = 0;
      const pay = sponsorship(s, dept);
      book(s, 'sponsorship', pay);
      return;
    }
    partner.lapse = (partner.lapse ?? 0) + 1;
    if (partner.lapse > PARTNER_GRACE) {
      endPartner(s, dept);
      pushNews(s, `${partner.brand} ends its ${dept} partnership — your racks hardly carry their name any more.`, 'bad');
    } else {
      pushNews(s, `${partner.brand} warns you: they want at least ${Math.round(PARTNER_SHARE * 100)}% of your ${dept} kit to carry their name (now ${Math.round(share * 100)}%).`, 'info');
    }
  });
}

export const describeSponsorship = (state: TycoonState, dept: Dept) => formatMoney(state, sponsorship(state, dept));
