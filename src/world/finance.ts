/**
 * Money that isn't cash: the bank's credit line grows with what you own and
 * how well you're run, and vehicles can be leased instead of bought — no
 * capital up front, a monthly bill instead, and a penalty to hand one back
 * early.
 */
import { getModel } from './catalog';
import { book, yearOf } from './core';
import { companyRating } from './awards';
import { companyValue } from './queries';
import type { TycoonState, Vehicle } from './types';

/** Lease per month as a share of the vehicle's price (≈30% a year). */
export const LEASE_RATE = 0.025;
/** Months of lease due if you hand a vehicle back early. */
export const LEASE_RETURN_MONTHS = 2;
/** A lease runs this long before you can hand it back free. */
export const LEASE_TERM_MONTHS = 24;
const HOURS_PER_MONTH = 24 * 30;

const BASE_CREDIT = 60000;
const ASSET_ADVANCE = 0.5;
const RATING_CREDIT = 150000;

export const leaseMonthly = (modelId: string) => Math.round(getModel(modelId).price * LEASE_RATE);

/** What you own, net of cash and debt (the bank lends against it). */
export function assetValue(state: TycoonState): number {
  return Math.max(0, companyValue(state) - state.company.cash + state.company.loan);
}

/** The bank's limit: a base line, half your assets, and more for a well-run firm. */
export function creditLimit(state: TycoonState): number {
  const year = yearOf(state, state.hour);
  const rating = Math.max(companyRating(state, year - 1).total, companyRating(state, year).total);
  const limit = BASE_CREDIT + assetValue(state) * ASSET_ADVANCE + (rating / 1000) * RATING_CREDIT;
  return Math.round(limit / 10000) * 10000;
}

export const borrowStep = (state: TycoonState) => Math.max(10000, Math.round(creditLimit(state) / 10 / 10000) * 10000);

export const monthlyLeasesTotal = (s: TycoonState) => s.vehicles.reduce((sum, v) => sum + (v.owner === 'player' && v.lease ? v.lease.monthly : 0), 0);

export function monthlyLeases(s: TycoonState) {
  const total = s.vehicles.reduce((sum, v) => sum + (v.owner === 'player' && v.lease ? v.lease.monthly : 0), 0);
  if (total) book(s, 'leasing', -total);
  s.vehicles.forEach(v => {
    if (v.owner === 'player' && v.lease) v.profitThisYear -= v.lease.monthly;
  });
}

export function leaseReturnPenalty(state: TycoonState, v: Vehicle): number {
  if (!v.lease) return 0;
  const months = (state.hour - v.lease.sinceHour) / HOURS_PER_MONTH;
  return months >= LEASE_TERM_MONTHS ? 0 : v.lease.monthly * LEASE_RETURN_MONTHS;
}
