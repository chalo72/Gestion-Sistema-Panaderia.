import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// Funciones puras extraídas de la lógica de negocio para ser testeadas
// ────────────────────────────────────────────────────────────────────

/** BUG-03: porcentajeCambio — no dividir cuando precioCosto = 0 */
function calcularPorcentajeCambio(precioNuevo: number, precioAnterior: number): number {
    return precioAnterior > 0 ? ((precioNuevo - precioAnterior) / precioAnterior) * 100 : 0;
}

/** BUG-02: margenPromedio — no dividir cuando no hay insumos */
function calcularMargenPromedio(margenes: number[]): number {
    return margenes.length > 0
        ? Math.round(margenes.reduce((s, m) => s + m, 0) / margenes.length)
        : 0;
}

/** BUG-01: ajuste de stock — delta, no valor absoluto */
function calcularDeltaStock(stockNuevo: number, stockActual: number): number {
    return stockNuevo - stockActual;
}

/** BUG-08: precio de venta con 2 decimales */
function calcularPrecioVenta(costoUnitario: number, margenPct: number): number {
    return Math.round(costoUnitario * (1 + margenPct / 100) * 100) / 100;
}

/** BUG-04: costo unitario con fallback a 1 si cantidadEmbalaje = 0 */
function calcularCostoUnitario(precioCosto: number, cantidadEmbalaje: number): number {
    const packQty = Number(cantidadEmbalaje || 1) || 1;
    return precioCosto / packQty;
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('calcularPorcentajeCambio (BUG-03)', () => {
    it('calcula % de aumento correctamente', () => {
        expect(calcularPorcentajeCambio(110, 100)).toBeCloseTo(10);
    });
    it('calcula % de reducción correctamente', () => {
        expect(calcularPorcentajeCambio(90, 100)).toBeCloseTo(-10);
    });
    it('retorna 0 cuando precioAnterior es 0 (evita Infinity)', () => {
        expect(calcularPorcentajeCambio(50, 0)).toBe(0);
    });
    it('retorna 0 cuando ambos son 0', () => {
        expect(calcularPorcentajeCambio(0, 0)).toBe(0);
    });
    it('retorna 0 sin cambio', () => {
        expect(calcularPorcentajeCambio(100, 100)).toBe(0);
    });
});

describe('calcularMargenPromedio (BUG-02)', () => {
    it('calcula promedio de margenes normales', () => {
        expect(calcularMargenPromedio([10, 20, 30])).toBe(20);
    });
    it('retorna 0 para array vacío (evita NaN)', () => {
        expect(calcularMargenPromedio([])).toBe(0);
    });
    it('redondea al entero más cercano', () => {
        expect(calcularMargenPromedio([10, 11])).toBe(11); // (10+11)/2 = 10.5 → round = 11
    });
    it('maneja un solo elemento', () => {
        expect(calcularMargenPromedio([35])).toBe(35);
    });
});

describe('calcularDeltaStock (BUG-01)', () => {
    it('stock aumenta: delta positivo', () => {
        expect(calcularDeltaStock(15, 10)).toBe(5);
    });
    it('stock disminuye: delta negativo', () => {
        expect(calcularDeltaStock(5, 10)).toBe(-5);
    });
    it('sin cambio: delta es 0', () => {
        expect(calcularDeltaStock(10, 10)).toBe(0);
    });
    it('desde stock 0: delta igual al stock nuevo', () => {
        expect(calcularDeltaStock(20, 0)).toBe(20);
    });
});

describe('calcularPrecioVenta (BUG-08)', () => {
    it('preserva 2 decimales monetarios', () => {
        // $10 costo + 27.5% margen = $12.75
        expect(calcularPrecioVenta(10, 27.5)).toBe(12.75);
    });
    it('no trunca a entero (bug original: Math.round(12.75) = 13)', () => {
        const conBug = Math.round(10 * 1.275);      // 13 — bug
        const corregido = calcularPrecioVenta(10, 27.5); // 12.75 — fix
        expect(conBug).toBe(13);
        expect(corregido).toBe(12.75);
        expect(corregido).not.toBe(conBug);
    });
    it('margen 0% devuelve el costo unitario', () => {
        expect(calcularPrecioVenta(10, 0)).toBe(10);
    });
    it('margen 100% duplica el costo', () => {
        expect(calcularPrecioVenta(5, 100)).toBe(10);
    });
});

describe('calcularCostoUnitario (BUG-04)', () => {
    it('divide correctamente por la cantidad de embalaje', () => {
        expect(calcularCostoUnitario(100, 4)).toBe(25);
    });
    it('usa 1 como fallback cuando cantidadEmbalaje es 0 (evita Infinity)', () => {
        expect(calcularCostoUnitario(100, 0)).toBe(100);
        expect(calcularCostoUnitario(100, 0)).not.toBe(Infinity);
    });
    it('usa 1 como fallback cuando cantidadEmbalaje es null/undefined', () => {
        expect(calcularCostoUnitario(100, null as any)).toBe(100);
    });
    it('costo 0 siempre da 0', () => {
        expect(calcularCostoUnitario(0, 4)).toBe(0);
    });
});
