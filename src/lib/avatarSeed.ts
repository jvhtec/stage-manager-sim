import { createRng } from './rng';

/**
 * Deterministic per-entity cosmetic traits for `CrewAvatar`. Seeded from a
 * stable string id (crew id, or a candidate id before they're hired) rather
 * than the sim's shared `GameState.rngState` — this is cosmetic-only
 * rendering, not a gameplay roll, so it doesn't need to consume or persist
 * turns of the seeded sim sequence. Same id always paints the same face.
 */
export interface AvatarTraits {
  skinTone: string;
  hairStyle: 'bald' | 'short' | 'long' | 'mohawk' | 'afro';
  hairColor: string;
  accessory: 'none' | 'glasses' | 'beanie' | 'headband';
}

const SKIN_TONES = ['#f2c9a1', '#e0ac69', '#c68642', '#8d5524', '#5a3825'];
const HAIR_COLORS = ['#1c1c1c', '#3b2314', '#6b4423', '#a85c2a', '#c9c9c9', '#d4a017'];
const HAIR_STYLES: AvatarTraits['hairStyle'][] = ['bald', 'short', 'long', 'mohawk', 'afro'];
const ACCESSORIES: AvatarTraits['accessory'][] = ['none', 'none', 'glasses', 'beanie', 'headband'];

/** Simple string hash (FNV-1a) — just needs to be stable, not cryptographic. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getAvatarTraits(id: string): AvatarTraits {
  const rng = createRng(hashString(id));
  return {
    skinTone: rng.pick(SKIN_TONES),
    hairStyle: rng.pick(HAIR_STYLES),
    hairColor: rng.pick(HAIR_COLORS),
    accessory: rng.pick(ACCESSORIES),
  };
}
