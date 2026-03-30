import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// Funciones puras extraídas de la lógica de Proveedores para testear
// (ProveedorForm.tsx — costUnit, sellPrice, precioVentaPack, validaciones)
// ────────────────────────────────────────────────────────────────────

/** costUnit: precioCosto / cantidadEmbalaje (BUG-04: fallback a 1 si embalaje=0) */
function calcularCostoUnitario(precioCosto: number, cantidadEmbalaje: number): number {
    const packQty = Number(cantidadEmbalaje || 1) || 1;
    return precioCosto / packQty;
}

/** sellPrice: costUnit * (1 + margen/100). Si margen es null/undefined → devuelve costUnit (BUG-06) */
function calcularPrecioVentaBase(costUnit: number, margenVenta: number | null | undefined): number {
    if (margenVenta === undefined || margenVenta === null) return costUnit;
    return costUnit * (1 + Number(margenVenta) / 100);
}

/** precioVenta redondeado a 2 decimales monetarios (BUG-08: evitar Math.round() que trunca a entero) */
function calcularPrecioVenta(sellPrice: number): number {
    return Math.round(sellPrice * 100) / 100;
}

/** precioVentaPack: precio por unidad * cantidad del pack (redondeado 2 dec) */
function calcularPrecioVentaPack(sellPrice: number, cantidadEmbalaje: number): number {
    const qty = cantidadEmbalaje || 1;
    return Math.round(sellPrice * qty * 100) / 100;
}

/** Validaciones de addProductoCatalogo antes de agregar al catálogo */
function validarProductoCatalogo(p: {
    nombre?: string;
    precioCosto?: number;
    categoria?: string;
}): string[] {
    const errores: string[] = [];
    if (!p.nombre?.trim()) errores.push('Nombre de producto requerido');
    if (!p.precioCosto || p.precioCosto <= 0) errores.push('Costo debe ser mayor a 0');
    if (!p.categoria) errores.push('Selecciona una categoría para el producto');
    return errores;
}

/** BUG-02: margenPromedio — división segura sobre array de márgenes */
function calcularMargenPromedio(margenes: number[]): number {
    if (margenes.length === 0) return 0;
    return Math.round(margenes.reduce((s, m) => s + m, 0) / margenes.length);
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('calcularCostoUnitario (BUG-04)', () => {
    it('divide precioCosto entre cantidadEmbalaje', () => {
        expect(calcularCostoUnitario(120, 6)).toBe(20);
    });

    it('usa fallback 1 cuando cantidadEmbalaje es 0 (evita Infinity)', () => {
        expect(calcularCostoUnitario(100, 0)).toBe(100);
        expect(calcularCostoUnitario(100, 0)).not.toBe(Infinity);
    });

    it('usa fallback 1 cuando cantidadEmbalaje es null', () => {
        expect(calcularCostoUnitario(100, null as any)).toBe(100);
    });

    it('usa fallback 1 cuando cantidadEmbalaje es undefined', () => {
        expect(calcularCostoUnitario(100, undefined as any)).toBe(100);
    });

    it('precioCosto 0 → costoUnitario 0', () => {
        expect(calcularCostoUnitario(0, 5)).toBe(0);
    });

    it('embalaje 1 devuelve el precioCosto directamente', () => {
        expect(calcularCostoUnitario(500, 1)).toBe(500);
    });

    it('embalaje 12 (docena)', () => {
        expect(calcularCostoUnitario(2400, 12)).toBe(200);
    });
});

describe('calcularPrecioVentaBase (BUG-06 — margen=0 es válido)', () => {
    it('margen 30%: incrementa correctamente', () => {
        expect(calcularPrecioVentaBase(100, 30)).toBeCloseTo(130);
    });

    it('margen 0%: devuelve el costoUnitario (no aplica markup)', () => {
        // BUG-06: margen=0 era tratado como falsy, sobreescrito
        expect(calcularPrecioVentaBase(100, 0)).toBe(100);
    });

    it('margen null: devuelve costoUnitario sin modificar', () => {
        expect(calcularPrecioVentaBase(100, null)).toBe(100);
    });

    it('margen undefined: devuelve costoUnitario sin modificar', () => {
        expect(calcularPrecioVentaBase(100, undefined)).toBe(100);
    });

    it('margen 100%: duplica el costoUnitario', () => {
        expect(calcularPrecioVentaBase(50, 100)).toBe(100);
    });

    it('margen negativo: reduce el precio (descuento)', () => {
        expect(calcularPrecioVentaBase(100, -10)).toBeCloseTo(90);
    });

    it('diferencia clave entre margen=0 y margen=null (BUG-06)', () => {
        const con0 = calcularPrecioVentaBase(100, 0);    // 0% markup → 100
        const conNull = calcularPrecioVentaBase(100, null); // sin definir → 100
        // Ambos devuelven 100, pero por razones distintas — el test documenta el comportamiento
        expect(con0).toBe(100);
        expect(conNull).toBe(100);
    });
});

describe('calcularPrecioVenta (BUG-08 — 2 decimales monetarios)', () => {
    it('preserva centavos: $12.75 no se redondea a $13', () => {
        // Bug original: Math.round(12.75) = 13
        const bugOriginal = Math.round(12.75);   // 13
        const correcto = calcularPrecioVenta(12.75); // 12.75
        expect(correcto).toBe(12.75);
        expect(correcto).not.toBe(bugOriginal);
    });

    it('redondea a 2 decimales: 12.756 → 12.76', () => {
        expect(calcularPrecioVenta(12.756)).toBe(12.76);
    });

    it('precio entero no cambia: $130 → $130', () => {
        expect(calcularPrecioVenta(130)).toBe(130);
    });

    it('precio con 1 decimal se conserva: $15.5 → $15.5', () => {
        expect(calcularPrecioVenta(15.5)).toBe(15.5);
    });

    it('redondea hacia abajo: 12.754 → 12.75', () => {
        expect(calcularPrecioVenta(12.754)).toBe(12.75);
    });
});

describe('calcularPrecioVentaPack', () => {
    it('precio pack = precio unitario * cantidad', () => {
        // $12.50/unidad × 12 = $150.00
        expect(calcularPrecioVentaPack(12.5, 12)).toBe(150);
    });

    it('redondeado a 2 decimales', () => {
        // $3.333... × 3 = $9.999... → $10.00
        expect(calcularPrecioVentaPack(3.333, 3)).toBe(10);
    });

    it('embalaje 1: igual al precio unitario', () => {
        expect(calcularPrecioVentaPack(25.99, 1)).toBe(25.99);
    });

    it('embalaje 0: usa 1 como fallback', () => {
        expect(calcularPrecioVentaPack(100, 0)).toBe(100);
    });
});

describe('validarProductoCatalogo', () => {
    it('producto válido no genera errores', () => {
        const errores = validarProductoCatalogo({
            nombre: 'Harina Especial',
            precioCosto: 3500,
            categoria: 'Insumo',
        });
        expect(errores).toHaveLength(0);
    });

    it('nombre vacío es inválido', () => {
        const errores = validarProductoCatalogo({ nombre: '', precioCosto: 100, categoria: 'Pan' });
        expect(errores).toContain('Nombre de producto requerido');
    });

    it('nombre solo espacios es inválido', () => {
        const errores = validarProductoCatalogo({ nombre: '   ', precioCosto: 100, categoria: 'Pan' });
        expect(errores).toContain('Nombre de producto requerido');
    });

    it('precioCosto = 0 es inválido', () => {
        const errores = validarProductoCatalogo({ nombre: 'Harina', precioCosto: 0, categoria: 'Insumo' });
        expect(errores).toContain('Costo debe ser mayor a 0');
    });

    it('precioCosto negativo es inválido', () => {
        const errores = validarProductoCatalogo({ nombre: 'Harina', precioCosto: -50, categoria: 'Insumo' });
        expect(errores).toContain('Costo debe ser mayor a 0');
    });

    it('categoría vacía es inválida', () => {
        const errores = validarProductoCatalogo({ nombre: 'Harina', precioCosto: 100, categoria: '' });
        expect(errores).toContain('Selecciona una categoría para el producto');
    });

    it('todos los campos inválidos generan 3 errores', () => {
        const errores = validarProductoCatalogo({ nombre: '', precioCosto: 0, categoria: '' });
        expect(errores).toHaveLength(3);
    });
});

describe('calcularMargenPromedio (BUG-02 — Proveedores)', () => {
    it('promedio correcto con varios márgenes', () => {
        expect(calcularMargenPromedio([20, 30, 40])).toBe(30);
    });

    it('array vacío retorna 0 (evita NaN/Infinity)', () => {
        // BUG-02: proveedor sin productos → margenes.length = 0
        expect(calcularMargenPromedio([])).toBe(0);
        expect(calcularMargenPromedio([])).not.toBeNaN();
    });

    it('un solo margen retorna ese mismo valor', () => {
        expect(calcularMargenPromedio([45])).toBe(45);
    });

    it('redondea al entero más cercano', () => {
        expect(calcularMargenPromedio([10, 11])).toBe(11); // 10.5 → round = 11
    });

    it('incluye márgenes 0% sin fallos', () => {
        expect(calcularMargenPromedio([0, 30, 0])).toBe(10); // 30/3 = 10
    });

    it('márgenes todos iguales devuelven ese valor', () => {
        expect(calcularMargenPromedio([25, 25, 25])).toBe(25);
    });
});
