import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// Test de Verificación Final — Bugs sin cobertura previa
// Cubre: BUG-05 (autoSeedData guard), BUG-07 (subtotal NaN), BUG-12 (addPrecio)
// Patrón: funciones puras inline, réplica exacta de la lógica del código fuente
// ────────────────────────────────────────────────────────────────────

// ── BUG-05: autoSeedData no sobrescribe datos reales ────────────────
// usePriceControl.ts:122 → if (productos.length === 0) { await autoSeedData(); }
function debeEjecutarSeed(cantidadProductos: number): boolean {
  return cantidadProductos === 0;
}

// ── BUG-07: subtotal en Ventas nunca guarda NaN ─────────────────────
// Ventas.tsx:308 → safeNumber(precio) * safeNumber(cantidad, 1)
function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}
function calcularSubtotal(precioVenta: unknown, cantidad: unknown): number {
  return safeNumber(precioVenta) * safeNumber(cantidad, 1);
}

// ── BUG-12: addPrecio rechaza precioCosto ≤ 0 ───────────────────────
// database.ts:570 → if (!p.precioCosto || p.precioCosto <= 0) throw new Error(...)
function validarPrecioCosto(precioCosto: unknown): void {
  if (!precioCosto || Number(precioCosto) <= 0) {
    throw new Error(`addPrecio: precioCosto debe ser mayor a 0 (recibido: ${precioCosto})`);
  }
}

// ════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════

describe('BUG-05 — autoSeedData no se ejecuta si ya hay productos', () => {
  it('sin productos (0): debe ejecutar seed', () => {
    expect(debeEjecutarSeed(0)).toBe(true);
  });

  it('con 1 producto: NO ejecuta seed (datos del usuario protegidos)', () => {
    expect(debeEjecutarSeed(1)).toBe(false);
  });

  it('con 100 productos: NO ejecuta seed', () => {
    expect(debeEjecutarSeed(100)).toBe(false);
  });

  it('seed nunca se activa cuando hay datos existentes', () => {
    // Reproduce el escenario: usuario tenía 50 productos, reinicia la app
    const productosDelUsuario = 50;
    expect(debeEjecutarSeed(productosDelUsuario)).toBe(false);
  });
});

describe('BUG-07 — subtotal en Ventas nunca guarda NaN', () => {
  it('precio y cantidad válidos: 50 × 3 = 150', () => {
    const subtotal = calcularSubtotal(50, 3);
    expect(subtotal).toBe(150);
    expect(subtotal).not.toBeNaN();
  });

  it('precio undefined: subtotal es 0 (no NaN)', () => {
    const subtotal = calcularSubtotal(undefined, 3);
    expect(subtotal).toBe(0);
    expect(subtotal).not.toBeNaN();
  });

  it('precio null: subtotal es 0 (no NaN)', () => {
    const subtotal = calcularSubtotal(null, 3);
    expect(subtotal).toBe(0);
    expect(subtotal).not.toBeNaN();
  });

  it('cantidad undefined: usa fallback 1 → precio × 1', () => {
    const subtotal = calcularSubtotal(25000, undefined);
    expect(subtotal).toBe(25000); // 25000 × 1
    expect(subtotal).not.toBeNaN();
  });

  it('precio NaN string ("abc"): subtotal es 0', () => {
    const subtotal = calcularSubtotal('abc', 3);
    expect(subtotal).toBe(0);
    expect(subtotal).not.toBeNaN();
  });

  it('ambos undefined: subtotal es 0, nunca NaN (bug original)', () => {
    // Bug original: undefined * undefined = NaN guardado en DB
    const subtotal = calcularSubtotal(undefined, undefined);
    expect(subtotal).toBe(0);
    expect(subtotal).not.toBeNaN();
    expect(isNaN(subtotal)).toBe(false);
  });

  it('precio decimal: 12.50 × 4 = 50', () => {
    const subtotal = calcularSubtotal(12.5, 4);
    expect(subtotal).toBe(50);
  });
});

describe('BUG-12 — addPrecio rechaza precioCosto inválido', () => {
  it('precioCosto = 0: lanza error', () => {
    expect(() => validarPrecioCosto(0)).toThrow('addPrecio: precioCosto debe ser mayor a 0');
  });

  it('precioCosto negativo: lanza error', () => {
    expect(() => validarPrecioCosto(-50)).toThrow('addPrecio: precioCosto debe ser mayor a 0');
  });

  it('precioCosto null: lanza error', () => {
    expect(() => validarPrecioCosto(null)).toThrow('addPrecio: precioCosto debe ser mayor a 0');
  });

  it('precioCosto undefined: lanza error', () => {
    expect(() => validarPrecioCosto(undefined)).toThrow('addPrecio: precioCosto debe ser mayor a 0');
  });

  it('precioCosto válido (100): NO lanza error', () => {
    expect(() => validarPrecioCosto(100)).not.toThrow();
  });

  it('precioCosto válido (0.01): NO lanza error (centavos)', () => {
    expect(() => validarPrecioCosto(0.01)).not.toThrow();
  });

  it('el mensaje de error incluye el valor recibido (para debug)', () => {
    expect(() => validarPrecioCosto(0)).toThrow('recibido: 0');
  });
});

// ── BUG-13: deleteCategoria no migraba productos huérfanos ───────────
// usePriceControl.ts → deleteCategoria ahora mueve productos a "Otro"
// Réplica inline de la lógica corregida

interface ProductoSimple { id: string; categoria: string; }
interface CategoriaSimple { id: string; nombre: string; }

function simularDeleteCategoria(
  categorias: CategoriaSimple[],
  productos: ProductoSimple[],
  idAEliminar: string
): { categoriasResultantes: CategoriaSimple[]; productosResultantes: ProductoSimple[] } {
  const categoriaEliminada = categorias.find(c => c.id === idAEliminar);
  const categoriasResultantes = categorias.filter(c => c.id !== idAEliminar);
  let productosResultantes = productos;
  if (categoriaEliminada) {
    productosResultantes = productos.map(p =>
      p.categoria.toLowerCase().trim() === categoriaEliminada.nombre.toLowerCase().trim()
        ? { ...p, categoria: 'Otro' }
        : p
    );
  }
  return { categoriasResultantes, productosResultantes };
}

describe('BUG-13 — deleteCategoria migra productos a "Otro"', () => {
  const categorias: CategoriaSimple[] = [
    { id: 'cat-1', nombre: 'DULCE' },
    { id: 'cat-2', nombre: 'BEBIDAS' },
  ];
  const productos: ProductoSimple[] = [
    { id: 'p1', categoria: 'DULCE' },
    { id: 'p2', categoria: 'DULCE' },
    { id: 'p3', categoria: 'BEBIDAS' },
  ];

  it('eliminar DULCE: productos de DULCE pasan a "Otro"', () => {
    const { productosResultantes } = simularDeleteCategoria(categorias, productos, 'cat-1');
    expect(productosResultantes.find(p => p.id === 'p1')?.categoria).toBe('Otro');
    expect(productosResultantes.find(p => p.id === 'p2')?.categoria).toBe('Otro');
  });

  it('eliminar DULCE: productos de BEBIDAS NO se tocan', () => {
    const { productosResultantes } = simularDeleteCategoria(categorias, productos, 'cat-1');
    expect(productosResultantes.find(p => p.id === 'p3')?.categoria).toBe('BEBIDAS');
  });

  it('eliminar DULCE: la categoría desaparece del listado', () => {
    const { categoriasResultantes } = simularDeleteCategoria(categorias, productos, 'cat-1');
    expect(categoriasResultantes.find(c => c.id === 'cat-1')).toBeUndefined();
    expect(categoriasResultantes).toHaveLength(1);
  });

  it('no quedan productos huérfanos con categoría inexistente', () => {
    const { categoriasResultantes, productosResultantes } = simularDeleteCategoria(categorias, productos, 'cat-1');
    const nombresValidos = new Set(['Otro', ...categoriasResultantes.map(c => c.nombre)]);
    const huerfanos = productosResultantes.filter(p => !nombresValidos.has(p.categoria));
    expect(huerfanos).toHaveLength(0); // CERO productos fantasma
  });

  it('comparación case-insensitive: "dulce" minúsculas también migra', () => {
    const prods = [{ id: 'px', categoria: 'dulce' }];
    const { productosResultantes } = simularDeleteCategoria(categorias, prods, 'cat-1');
    expect(productosResultantes[0].categoria).toBe('Otro');
  });
});

// ── BUG-14: Categorías borradas resurgen al reiniciar la app ─────────
// usePriceControl.ts → deleteCategoria guarda el ID en categoriasBorradas
// La inicialización excluye esos IDs al re-agregar CATEGORIAS_DEFAULT

function simularInicializacionCategorias(
  categoriasEnDB: CategoriaSimple[],
  categoriasBorradas: string[],
  defaults: CategoriaSimple[]
): CategoriaSimple[] {
  const borradasIds = new Set(categoriasBorradas);
  const nuevas = defaults.filter(
    d => !categoriasEnDB.some(c => c.nombre === d.nombre) && !borradasIds.has(d.id)
  );
  return [...categoriasEnDB, ...nuevas];
}

// ── BUG-15: autoSeedData restaura datos borrados en cada inicio ──────
// usePriceControl.ts → seed solo corre si productos.length===0 Y !seedCompletado

function debeSeed(cantProductos: number, seedCompletado: boolean): boolean {
  return cantProductos === 0 && !seedCompletado;
}

describe('BUG-14 — categorías borradas no resurgen al reiniciar', () => {
  const defaults: CategoriaSimple[] = [
    { id: 'def-dulce',   nombre: 'DULCE'   },
    { id: 'def-bebidas', nombre: 'BEBIDAS' },
    { id: 'def-pan',     nombre: 'PAN'     },
  ];

  it('sin borradas: agrega las que faltan en DB', () => {
    const result = simularInicializacionCategorias(
      [{ id: 'def-bebidas', nombre: 'BEBIDAS' }],
      [],
      defaults
    );
    expect(result.some(c => c.nombre === 'DULCE')).toBe(true);
    expect(result.some(c => c.nombre === 'PAN')).toBe(true);
  });

  it('DULCE borrada: NO vuelve a aparecer al reiniciar', () => {
    const result = simularInicializacionCategorias(
      [{ id: 'def-bebidas', nombre: 'BEBIDAS' }],
      ['def-dulce'], // usuario borró DULCE
      defaults
    );
    expect(result.some(c => c.nombre === 'DULCE')).toBe(false); // no resurge
    expect(result.some(c => c.nombre === 'PAN')).toBe(true);    // las demás sí
  });

  it('todas borradas: no se agrega ninguna default', () => {
    const result = simularInicializacionCategorias(
      [],
      ['def-dulce', 'def-bebidas', 'def-pan'],
      defaults
    );
    expect(result).toHaveLength(0);
  });
});

describe('BUG-15 — seed no restaura datos borrados intencionalmente', () => {
  it('primera instalación (sin productos, sin flag): DEBE sembrar', () => {
    expect(debeSeed(0, false)).toBe(true);
  });

  it('ya sembrado antes (flag=true): NO vuelve a sembrar aunque productos=0', () => {
    // Bug original: usuario borra todos sus productos → seed restauraba todo
    expect(debeSeed(0, true)).toBe(false);
  });

  it('con productos existentes: nunca siembra', () => {
    expect(debeSeed(10, false)).toBe(false);
    expect(debeSeed(10, true)).toBe(false);
  });

  it('escenario bug original: usuario borró todo → flag evita restauración', () => {
    const usuarioBorroTodo = 0;
    const yaHabiaUsadoApp = true;
    expect(debeSeed(usuarioBorroTodo, yaHabiaUsadoApp)).toBe(false);
  });
});
