import { describe, expect, it } from 'vitest';
import { START_YEARS } from '../catalog';
import { ERA } from '../../tycoon/ui/Intro';

describe('intro text', () => {
  it('has an opening for every start year', () => {
    START_YEARS.forEach(y => {
      expect(ERA[y], String(y)).toBeDefined();
      expect(ERA[y].headline.length).toBeGreaterThan(5);
      expect(ERA[y].text.length).toBeGreaterThan(60);
    });
  });
});
