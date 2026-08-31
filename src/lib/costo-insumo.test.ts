import { describe, it, expect } from 'vitest';
import {
  factorUnidadAKg,
  precioPorKg,
  calcularCostoLineaInsumo,
  esCostoInsumoSospechoso,
  COSTO_INSUMO_SOSPECHOSO
} from './costo-insumo';

describe('costo-insumo utility', () => {
  describe('factorUnidadAKg', () => {
    it('debe devolver 0.001 para gramos (gr, g)', () => {
      expect(factorUnidadAKg('gr')).toBe(0.001);
      expect(factorUnidadAKg('g')).toBe(0.001);
    });

    it('debe devolver 0.001 para mililitros (ml)', () => {
      expect(factorUnidadAKg('ml')).toBe(0.001);
    });

    it('debe devolver 0.5 para libras (lb, libra, libras)', () => {
      expect(factorUnidadAKg('lb')).toBe(0.5);
      expect(factorUnidadAKg('libra')).toBe(0.5);
      expect(factorUnidadAKg('libras')).toBe(0.5);
    });

    it('debe devolver 0.0283 para onzas (oz)', () => {
      expect(factorUnidadAKg('oz')).toBe(0.0283);
    });

    it('debe devolver 1 para litros (l, lt, litro, litros)', () => {
      expect(factorUnidadAKg('l')).toBe(1);
      expect(factorUnidadAKg('lt')).toBe(1);
      expect(factorUnidadAKg('litro')).toBe(1);
      expect(factorUnidadAKg('litros')).toBe(1);
    });

    it('debe devolver 0.05 para unidades (und, unidades, unidad, u)', () => {
      expect(factorUnidadAKg('und')).toBe(0.05);
      expect(factorUnidadAKg('unidades')).toBe(0.05);
      expect(factorUnidadAKg('unidad')).toBe(0.05);
      expect(factorUnidadAKg('u')).toBe(0.05);
    });

    it('debe devolver 12.5 para arroba (arroba, arr)', () => {
      expect(factorUnidadAKg('arroba')).toBe(12.5);
      expect(factorUnidadAKg('arr')).toBe(12.5);
    });

    it('debe devolver 1 por defecto para kg u otros', () => {
      expect(factorUnidadAKg('kg')).toBe(1);
      expect(factorUnidadAKg('cualquiercosa')).toBe(1);
      expect(factorUnidadAKg('')).toBe(1);
    });
  });

  describe('precioPorKg', () => {
    it('debe calcular correctamente el precio por kg cuando cantidadEmbalaje es válido', () => {
      const result = precioPorKg({ precioCosto: 10000, cantidadEmbalaje: 5 });
      expect(result).toBe(2000);
    });

    it('debe asumir divisor 1 si cantidadEmbalaje es 0, inválido o no provisto', () => {
      expect(precioPorKg({ precioCosto: 10000, cantidadEmbalaje: 0 })).toBe(10000);
      expect(precioPorKg({ precioCosto: 10000 })).toBe(10000);
    });

    it('debe devolver costoBaseFallback si el mejorPrecio es null/undefined o <= 0', () => {
      expect(precioPorKg(null, 5000)).toBe(5000);
      expect(precioPorKg(undefined, 5000)).toBe(5000);
      expect(precioPorKg({ precioCosto: 0 }, 5000)).toBe(5000);
    });
  });

  describe('calcularCostoLineaInsumo', () => {
    it('debe retornar 0 si la cantidad es 0 o menor', () => {
      expect(calcularCostoLineaInsumo({ cantidad: 0, unidad: 'kg', mejorPrecio: null })).toBe(0);
      expect(calcularCostoLineaInsumo({ cantidad: -5, unidad: 'kg', mejorPrecio: null })).toBe(0);
    });

    it('debe calcular y redondear el costo correctamente para kg', () => {
      const args = {
        cantidad: 2.5,
        unidad: 'kg',
        mejorPrecio: { precioCosto: 10000, cantidadEmbalaje: 1 },
      };
      // 10000 * 2.5 = 25000
      expect(calcularCostoLineaInsumo(args)).toBe(25000);
    });

    it('debe calcular el costo correctamente para libras', () => {
      const args = {
        cantidad: 4, // 4 libras = 2 kg
        unidad: 'lb',
        mejorPrecio: { precioCosto: 5000 }, // 5000 por kg
      };
      // 5000 * 2 = 10000
      expect(calcularCostoLineaInsumo(args)).toBe(10000);
    });

    it('debe redondear el resultado para evitar decimales', () => {
      const args = {
        cantidad: 1.333,
        unidad: 'kg',
        mejorPrecio: { precioCosto: 10000 },
      };
      // 13330
      expect(calcularCostoLineaInsumo(args)).toBe(13330);
    });
  });

  describe('esCostoInsumoSospechoso', () => {
    it('debe devolver true si el costo es mayor o igual al límite sospechoso', () => {
      expect(esCostoInsumoSospechoso(COSTO_INSUMO_SOSPECHOSO)).toBe(true);
      expect(esCostoInsumoSospechoso(6_000_000)).toBe(true);
    });

    it('debe devolver false si el costo es menor al límite', () => {
      expect(esCostoInsumoSospechoso(4_999_999)).toBe(false);
      expect(esCostoInsumoSospechoso(10000)).toBe(false);
    });
  });
});
