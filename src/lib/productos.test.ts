import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// Funciones puras extraídas de la lógica de Productos para ser testeadas
// ────────────────────────────────────────────────────────────────────

/** BUG-10: Normalización de categorías — evitar duplicados "Pan" vs "pan" */
function normalizarCategorias(productos: Array<{ categoria?: string }>): string[] {
    const normalizadas = productos
        .map(p => p.categoria?.trim())
        .filter((c): c is string => !!c);
    const unicas = [...new Set(normalizadas.map(c => c.toLowerCase()))];
    return unicas.map(cLower => normalizadas.find(c => c.toLowerCase() === cLower) || cLower);
}

/** BUG-01: Delta de stock — pasar diferencia, no valor absoluto */
function calcularDeltaStock(stockNuevo: number, stockActual: number): number {
    return stockNuevo - stockActual;
}

/** Calcular rentabilidad de un producto (precioVenta - precioCosto) / precioCosto */
function calcularRentabilidad(precioVenta: number, precioCosto: number): number {
    if (precioCosto <= 0) return 0;
    return Math.round(((precioVenta - precioCosto) / precioCosto) * 10000) / 100; // 2 decimales %
}

/** Validar que un producto tenga los campos requeridos antes de guardar */
function validarProducto(p: { nombre?: string; precioCosto?: number; categoria?: string }): string[] {
    const errores: string[] = [];
    if (!p.nombre?.trim()) errores.push('El nombre es obligatorio');
    if (!p.precioCosto || p.precioCosto <= 0) errores.push('El costo debe ser mayor a 0');
    if (!p.categoria?.trim()) errores.push('La categoría es obligatoria');
    return errores;
}

/** Calcular stock mínimo sugerido: 20% del stock máximo histórico */
function calcularStockMinimo(stockMaximo: number): number {
    if (stockMaximo <= 0) return 0;
    return Math.ceil(stockMaximo * 0.2);
}

/** Determinar si un producto está bajo stock mínimo */
function estaEnAlerta(stockActual: number, stockMinimo: number): boolean {
    return stockActual <= stockMinimo;
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('normalizarCategorias (BUG-10)', () => {
    it('elimina duplicados con diferente capitalización', () => {
        const prods = [
            { categoria: 'Pan' },
            { categoria: 'pan' },
            { categoria: 'PAN' },
        ];
        const result = normalizarCategorias(prods);
        expect(result).toHaveLength(1);
    });

    it('preserva el primer valor encontrado como representativo', () => {
        const prods = [
            { categoria: 'Pan Dulce' },
            { categoria: 'pan dulce' },
        ];
        const result = normalizarCategorias(prods);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('Pan Dulce');
    });

    it('elimina entradas undefined y vacías', () => {
        const prods = [
            { categoria: 'Harina' },
            { categoria: undefined },
            { categoria: '   ' },
            { categoria: '' },
        ];
        const result = normalizarCategorias(prods);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('Harina');
    });

    it('retorna array vacío cuando no hay productos', () => {
        expect(normalizarCategorias([])).toEqual([]);
    });

    it('retorna múltiples categorías distintas', () => {
        const prods = [
            { categoria: 'Pan' },
            { categoria: 'Harina' },
            { categoria: 'Azúcar' },
        ];
        const result = normalizarCategorias(prods);
        expect(result).toHaveLength(3);
    });

    it('trim elimina espacios en blanco alrededor', () => {
        const prods = [
            { categoria: '  Pan  ' },
            { categoria: 'Pan' },
        ];
        const result = normalizarCategorias(prods);
        expect(result).toHaveLength(1);
    });
});

describe('calcularDeltaStock (BUG-01 — Productos)', () => {
    it('ajuste hacia arriba: delta positivo', () => {
        expect(calcularDeltaStock(15, 10)).toBe(5);
    });

    it('ajuste hacia abajo: delta negativo', () => {
        expect(calcularDeltaStock(3, 10)).toBe(-7);
    });

    it('sin cambio: delta es 0', () => {
        expect(calcularDeltaStock(10, 10)).toBe(0);
    });

    it('desde stock 0: delta igual al valor nuevo', () => {
        expect(calcularDeltaStock(20, 0)).toBe(20);
    });

    it('no retorna el stock nuevo como valor absoluto (bug original)', () => {
        // Bug original: onAjustarStock(id, editForm.stock, ...) → pasaba 15 en lugar de +5
        const bugOriginal = 15; // valor absoluto
        const correcto = calcularDeltaStock(15, 10); // delta = 5
        expect(correcto).not.toBe(bugOriginal);
        expect(correcto).toBe(5);
    });
});

describe('calcularRentabilidad', () => {
    it('calcula rentabilidad positiva correctamente', () => {
        // costo $100, precio $130 → 30%
        expect(calcularRentabilidad(130, 100)).toBe(30);
    });

    it('calcula rentabilidad con decimales', () => {
        // costo $80, precio $100 → 25%
        expect(calcularRentabilidad(100, 80)).toBe(25);
    });

    it('retorna 0 cuando precioCosto es 0 (evita Infinity/NaN)', () => {
        expect(calcularRentabilidad(130, 0)).toBe(0);
    });

    it('retorna negativo cuando vende por debajo del costo', () => {
        expect(calcularRentabilidad(80, 100)).toBe(-20);
    });

    it('retorna 0% cuando precio = costo (sin margen)', () => {
        expect(calcularRentabilidad(100, 100)).toBe(0);
    });
});

describe('validarProducto', () => {
    it('producto válido no tiene errores', () => {
        const errores = validarProducto({ nombre: 'Pan Integral', precioCosto: 500, categoria: 'Pan' });
        expect(errores).toHaveLength(0);
    });

    it('nombre vacío genera error', () => {
        const errores = validarProducto({ nombre: '', precioCosto: 500, categoria: 'Pan' });
        expect(errores).toContain('El nombre es obligatorio');
    });

    it('nombre solo espacios genera error', () => {
        const errores = validarProducto({ nombre: '   ', precioCosto: 500, categoria: 'Pan' });
        expect(errores).toContain('El nombre es obligatorio');
    });

    it('precioCosto = 0 genera error', () => {
        const errores = validarProducto({ nombre: 'Pan', precioCosto: 0, categoria: 'Pan' });
        expect(errores).toContain('El costo debe ser mayor a 0');
    });

    it('precioCosto negativo genera error', () => {
        const errores = validarProducto({ nombre: 'Pan', precioCosto: -10, categoria: 'Pan' });
        expect(errores).toContain('El costo debe ser mayor a 0');
    });

    it('categoría vacía genera error', () => {
        const errores = validarProducto({ nombre: 'Pan', precioCosto: 500, categoria: '' });
        expect(errores).toContain('La categoría es obligatoria');
    });

    it('múltiples campos inválidos generan múltiples errores', () => {
        const errores = validarProducto({ nombre: '', precioCosto: 0, categoria: '' });
        expect(errores).toHaveLength(3);
    });
});

describe('calcularStockMinimo', () => {
    it('20% del stock máximo histórico', () => {
        expect(calcularStockMinimo(100)).toBe(20);
    });

    it('redondea hacia arriba (ceil)', () => {
        // 20% de 15 = 3.0
        expect(calcularStockMinimo(15)).toBe(3);
        // 20% de 11 = 2.2 → ceil = 3
        expect(calcularStockMinimo(11)).toBe(3);
    });

    it('retorna 0 para stock máximo 0 o negativo', () => {
        expect(calcularStockMinimo(0)).toBe(0);
        expect(calcularStockMinimo(-5)).toBe(0);
    });
});

describe('estaEnAlerta', () => {
    it('stock igual al mínimo está en alerta', () => {
        expect(estaEnAlerta(5, 5)).toBe(true);
    });

    it('stock por debajo del mínimo está en alerta', () => {
        expect(estaEnAlerta(3, 5)).toBe(true);
    });

    it('stock por encima del mínimo NO está en alerta', () => {
        expect(estaEnAlerta(10, 5)).toBe(false);
    });

    it('stock 0 siempre está en alerta', () => {
        expect(estaEnAlerta(0, 5)).toBe(true);
        expect(estaEnAlerta(0, 0)).toBe(true);
    });
});
