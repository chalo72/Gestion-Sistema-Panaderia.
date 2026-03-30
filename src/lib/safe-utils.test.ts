import { describe, it, expect } from 'vitest';
import { safeNumber, safeString } from './safe-utils';

describe('safeNumber', () => {
    it('retorna 0 para null', () => expect(safeNumber(null)).toBe(0));
    it('retorna 0 para undefined', () => expect(safeNumber(undefined)).toBe(0));
    it('retorna 0 para NaN', () => expect(safeNumber(NaN)).toBe(0));
    it('retorna 0 para objeto', () => expect(safeNumber({})).toBe(0));
    it('retorna el número si es válido', () => expect(safeNumber(42)).toBe(42));
    it('retorna 0 para número negativo no — preserva negativos', () => expect(safeNumber(-5)).toBe(-5));
    it('convierte string numérico', () => expect(safeNumber('3.5')).toBe(3.5));
    it('retorna 0 para string no numérico', () => expect(safeNumber('abc')).toBe(0));
    it('maneja decimales correctamente', () => expect(safeNumber(12.75)).toBe(12.75));
    it('retorna 0 para string vacío', () => expect(safeNumber('')).toBe(0));
});

describe('safeString', () => {
    it('retorna vacío para null', () => expect(safeString(null)).toBe(''));
    it('retorna vacío para undefined', () => expect(safeString(undefined)).toBe(''));
    it('retorna el string tal cual', () => expect(safeString('hola')).toBe('hola'));
    it('convierte número a string', () => expect(safeString(42)).toBe('42'));
    it('serializa objeto a JSON', () => expect(safeString({ a: 1 })).toBe('{"a":1}'));
});
