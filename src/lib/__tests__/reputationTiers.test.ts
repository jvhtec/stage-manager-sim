import { describe, expect, it } from 'vitest';
import {
  getReputationTier,
  getCompanyLevel,
  syncCompanyLevel,
  getTierProgress,
  getCrisisIntensityMultiplierForTier,
  REPUTATION_TIERS,
} from '../reputationTiers';
import { createInitialCompany } from '../gameData';

describe('getReputationTier', () => {
  it('places a fresh company (reputation 50) in tier 2', () => {
    expect(getReputationTier(50).level).toBe(2);
  });

  it('places 0 reputation in tier 1', () => {
    expect(getReputationTier(0).level).toBe(1);
  });

  it('places 100 reputation in the top tier', () => {
    expect(getReputationTier(100).level).toBe(4);
  });

  it('is monotonic — higher reputation never yields a lower tier', () => {
    let previousLevel = 0;
    for (let rep = 0; rep <= 100; rep += 5) {
      const level = getReputationTier(rep).level;
      expect(level).toBeGreaterThanOrEqual(previousLevel);
      previousLevel = level;
    }
  });

  it('lands exactly on a tier boundary in that tier, not the one below', () => {
    const tierTwo = REPUTATION_TIERS.find(t => t.level === 2)!;
    expect(getReputationTier(tierTwo.minReputation).level).toBe(2);
    expect(getReputationTier(tierTwo.minReputation - 1).level).toBe(1);
  });
});

describe('getCompanyLevel / syncCompanyLevel', () => {
  it('matches the tier level', () => {
    expect(getCompanyLevel(50)).toBe(getReputationTier(50).level);
  });

  it('updates a stale company.level to match current reputation', () => {
    const company = { ...createInitialCompany(), reputation: 90, level: 1 };
    const synced = syncCompanyLevel(company);
    expect(synced.level).toBe(4);
  });

  it('returns the same object reference when level is already correct (no unnecessary churn)', () => {
    const company = { ...createInitialCompany(), reputation: 50, level: 2 };
    expect(syncCompanyLevel(company)).toBe(company);
  });
});

describe('getTierProgress', () => {
  it('reports how much reputation is needed for the next tier', () => {
    const progress = getTierProgress(50);
    expect(progress.current.level).toBe(2);
    expect(progress.next?.level).toBe(3);
    expect(progress.repToNext).toBe(10); // tier 3 starts at 60
  });

  it('has no next tier at the top', () => {
    const progress = getTierProgress(100);
    expect(progress.next).toBeUndefined();
    expect(progress.repToNext).toBeUndefined();
  });
});

describe('getCrisisIntensityMultiplierForTier', () => {
  it('increases with tier', () => {
    const multipliers = REPUTATION_TIERS.map(t => getCrisisIntensityMultiplierForTier(t.level));
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
    }
  });

  it('falls back to 1 for an unknown tier level', () => {
    expect(getCrisisIntensityMultiplierForTier(99)).toBe(1);
  });
});
