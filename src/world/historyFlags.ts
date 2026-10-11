/**
 * Switches for the historical market layers, so the balance bench can measure what each one
 * changes (src/world/__bench__/history.bench.ts). The game always runs with all of them on.
 * - specialization: rivals own only their business lines' departments (supply.ts);
 * - partners: missing departments go to partner firms before the hire market;
 * - localCrowding: competition counts capable firms near the show, not every firm in the country.
 * The chronology itself (who exists, where and when) isn't switchable: it's the content.
 */
export const HISTORY = { specialization: true, partners: true, localCrowding: true };
