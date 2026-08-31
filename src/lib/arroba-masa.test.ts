import { describe, expect, it } from 'vitest';
import {
    KG_ARROBA_MASA_HOJALDRE,
    KG_ARROBA_MASA_SAL,
    arrobasMasaAKg,
    detectarTipoMasa,
    resolverKgPorArrobaMasa,
} from './arroba-masa';
import { ARROBA_KG } from '@/types';

describe('arroba-masa (pesos reales Dulce Placer)', () => {
    it('detecta tipo por nombre', () => {
        expect(detectarTipoMasa({ nombre: 'Masa de Sal Mixta' })).toBe('sal');
        expect(detectarTipoMasa({ nombre: 'Hojaldre mantequilla', categoria: 'hojaldres' })).toBe('hojaldre');
        expect(detectarTipoMasa({ nombre: 'Masa Dulce Especial' })).toBe('dulce');
    });

    it('masa de sal: 1 arroba = 21 kg', () => {
        expect(resolverKgPorArrobaMasa({ nombre: 'Masa de Sal' })).toBe(KG_ARROBA_MASA_SAL);
        expect(arrobasMasaAKg(1, { nombre: 'sal' })).toBe(21);
        expect(arrobasMasaAKg(1.5, { nombre: 'Masa de Sal' })).toBe(31.5);
    });

    it('hojaldre: media arroba = 9.66 kg (1 arroba = 19.32)', () => {
        expect(resolverKgPorArrobaMasa({ nombre: 'Masa de Hojaldre' })).toBe(KG_ARROBA_MASA_HOJALDRE);
        expect(arrobasMasaAKg(0.5, { nombre: 'hojaldre' })).toBeCloseTo(9.66, 2);
        expect(arrobasMasaAKg(1, { categoria: 'hojaldres' })).toBe(19.32);
    });

    it('respeta kgPorArrobaReal si viene en la fórmula', () => {
        expect(
            resolverKgPorArrobaMasa({ nombre: 'Masa de Sal', kgPorArrobaReal: 20.5 })
        ).toBe(20.5);
    });

    it('masa dulce sin medida aún cae a rendimiento o su constante de 20.33', () => {
        expect(resolverKgPorArrobaMasa({ nombre: 'Masa Dulce', rendimientoBaseKg: 20.33 })).toBe(20.33);
        expect(resolverKgPorArrobaMasa({ nombre: 'Masa Dulce' })).toBe(20.33);
    });
});
