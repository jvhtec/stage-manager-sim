import { describe, expect, it } from 'vitest';
import { getAvatarTraits } from '../avatarSeed';

describe('getAvatarTraits', () => {
  it('is deterministic for the same id', () => {
    const a = getAvatarTraits('crew-123');
    const b = getAvatarTraits('crew-123');
    expect(a).toEqual(b);
  });

  it('produces different traits for different ids (in general)', () => {
    const traitSets = ['crew-1', 'crew-2', 'crew-3', 'crew-4', 'crew-5'].map(getAvatarTraits);
    const uniqueHairStyles = new Set(traitSets.map(t => t.hairStyle));
    // Not every id needs a unique style, but 5 ids landing on exactly one
    // style would indicate the hash isn't actually varying anything.
    expect(uniqueHairStyles.size).toBeGreaterThan(1);
  });

  it('always returns a valid trait shape', () => {
    const traits = getAvatarTraits('candidate-abc');
    expect(traits.skinTone).toMatch(/^#[0-9a-f]{6}$/i);
    expect(traits.hairColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(['bald', 'short', 'long', 'mohawk', 'afro']).toContain(traits.hairStyle);
    expect(['none', 'glasses', 'beanie', 'headband']).toContain(traits.accessory);
  });
});
