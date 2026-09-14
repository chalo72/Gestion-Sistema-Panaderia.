import { ARROBA_KG } from '@/types';

/**
 * Peso real de 1 arroba de MASA en Dulce Placer (medido en báscula).
 * Distinto de ARROBA_KG (12.5) que sigue valiendo para harina/compras.
 *
 * Director 2026-08-01:
 * - Masa de sal: 1 arroba = 21 kg
 * - Hojaldre: media arroba = 9.66 kg → 1 arroba = 19.32 kg
 * - Masa dulce: 1 arroba = 20.33 kg (confirmado por el Director)
 */
export const KG_ARROBA_MASA_SAL = 21;
export const KG_ARROBA_MASA_HOJALDRE = 19.32; // 9.66 kg × 2
export const KG_ARROBA_MASA_DULCE = 20.33; // Confirmado por el Director 2026-08-08: 1.5 arrobas = 30.5 kg (4+7+7+7+5.5)
export type TipoMasaArroba = 'sal' | 'hojaldre' | 'dulce' | 'otro';

export interface MasaArrobaRef {
    nombre?: string;
    categoria?: string;
    /** Campo opcional en formulación: kg reales por arroba (báscula) */
    kgPorArrobaReal?: number;
    /** Rendimiento histórico / suma de insumos (fallback) */
    rendimientoBaseKg?: number;
}

/** Detecta el tipo de masa por nombre o categoría. */
export const detectarTipoMasa = (ref?: MasaArrobaRef | null): TipoMasaArroba => {
    const n = `${ref?.nombre || ''} ${ref?.categoria || ''}`.toLowerCase();
    if (n.includes('hojald')) return 'hojaldre';
    if (n.includes('dulce')) return 'dulce';
    if (n.includes('sal')) return 'sal';
    return 'otro';
};

/**
 * Kg reales por 1 arroba de esa masa.
 * Orden: kgPorArrobaReal → defaults medidos (sal/hojaldre) → rendimientoBaseKg → 12.5.
 */
export const resolverKgPorArrobaMasa = (ref?: MasaArrobaRef | null): number => {
    const tipo = detectarTipoMasa(ref);
    
    const real = Number(ref?.kgPorArrobaReal);
    if (Number.isFinite(real) && real > 0) {
        // Si la base de datos local tiene el valor viejo guardado (22), forzamos el nuevo valor medido.
        if (tipo === 'dulce' && real === 22) return KG_ARROBA_MASA_DULCE;
        return Math.round(real * 1000) / 1000;
    }

    if (tipo === 'sal') return KG_ARROBA_MASA_SAL;
    if (tipo === 'hojaldre') return KG_ARROBA_MASA_HOJALDRE;
    if (tipo === 'dulce') return KG_ARROBA_MASA_DULCE;


    const rend = Number(ref?.rendimientoBaseKg);
    if (Number.isFinite(rend) && rend > 0) {
        // Mismo chequeo para rendimientoBaseKg viejo (22)
        if (tipo === 'dulce' && rend === 22) return KG_ARROBA_MASA_DULCE;
        return Math.round(rend * 1000) / 1000;
    }

    return ARROBA_KG;
};

/** Convierte arrobas de una masa concreta a kg reales. */
export const arrobasMasaAKg = (
    cantidadArrobas: number,
    ref?: MasaArrobaRef | null
): number => {
    const arr = Number(cantidadArrobas) || 0;
    return Math.round(arr * resolverKgPorArrobaMasa(ref) * 1000) / 1000;
};

/** Texto corto para UI: «1 arroba (21 kg)» */
export const etiquetaArrobaConKg = (
    cantidadArrobas: number,
    ref?: MasaArrobaRef | null
): string => {
    const kg = arrobasMasaAKg(cantidadArrobas, ref);
    const kgPorArr = resolverKgPorArrobaMasa(ref);
    return `${cantidadArrobas} arr · ${kg.toFixed(2)} kg (${kgPorArr} kg/arr)`;
};
