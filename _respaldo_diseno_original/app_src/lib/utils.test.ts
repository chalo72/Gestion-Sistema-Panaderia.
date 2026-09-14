import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('combines classes correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });

    it('merges tailwind classes using tailwind-merge', () => {
      expect(cn('p-4 p-2')).toBe('p-2');
    });

    it('handles conditional classes via clsx', () => {
      expect(cn('p-4', false && 'text-red-500', true && 'text-blue-500')).toBe('p-4 text-blue-500');
    });
  });

  describe('formatCurrency', () => {
    it('formats numbers as COP currency', () => {
      const formatted = formatCurrency(15000);
      // Replace non-breaking spaces with regular spaces for assertion if needed,
      // but matching the currency string works
      expect(formatted.replace(/\s+/g, ' ')).toMatch(/\$\s?15\.000/);
    });

    it('formats string numbers correctly', () => {
      const formatted = formatCurrency("25000");
      expect(formatted.replace(/\s+/g, ' ')).toMatch(/\$\s?25\.000/);
    });

    it('handles 0 or invalid values by formatting 0', () => {
      expect(formatCurrency(0).replace(/\s+/g, ' ')).toMatch(/\$\s?0/);
      expect(formatCurrency("invalid").replace(/\s+/g, ' ')).toMatch(/\$\s?0/);
    });
  });
});
