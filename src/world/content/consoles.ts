import type { GearProduct } from './gear';

/** Inputs each desk takes (approximate, for flavour). */
const CONSOLE_INPUTS: Record<string, number> = {
  'yamaha-pm1000': 16,
  'midas-pro4': 24,
  'yamaha-pm3000': 40,
  'midas-xl3': 40,
  'soundcraft-series5': 48,
  'yamaha-pm4000': 48,
  'midas-xl4': 48,
  'yamaha-pm1d': 96,
  'digico-d5': 112,
  'yamaha-pm5d': 48,
  'avid-profile': 96,
  'midas-xl8': 112,
  'digico-sd7': 192,
  'yamaha-cl5': 72,
  'ssl-live': 128,
  'yamaha-pm10': 144,
  'ah-dlive': 128,
  'avid-s6l': 192,
  'digico-quantum7': 192,
};

export const consoleInputs = (p: GearProduct) => CONSOLE_INPUTS[p.id] ?? (p.kind === 'console-digital' ? 64 : Math.round(p.quality * 9));
