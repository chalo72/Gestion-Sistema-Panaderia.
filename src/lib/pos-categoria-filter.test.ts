/**
 * POS-CATEGORIA-FILTER — Deep Functional Test Suite
 * Verifica: filtrado de categorías, tipo elaborado, mapper Supabase, push inteligente
 * IDs: MOD-01..MOD-10, SINC-01..SINC-05, CONS-01..CONS-03
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readSrc(rel: string) {
  return fs.readFileSync(path.resolve(__dirname, '../../src', rel), 'utf-8');
}

// Simula el filtro productosVenta de Ventas.tsx
function safeString(v: any): string { return (v == null ? '' : String(v)); }
function safeNumber(v: any): number { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n; }

function filtrarProductosVenta(productos: any[], searchTerm: string, selectedCategory: string | null) {
  return productos.filter(p => {
    const matchesSearch = safeString(p.nombre).toLowerCase().includes(searchTerm.toLowerCase());
    const categoriaLower = safeString(p.categoria).toLowerCase().trim();
    const isNotInsumo = !categoriaLower.startsWith('ins:') && !categoriaLower.startsWith('insumos');
    const matchesCategory = !selectedCategory || categoriaLower === selectedCategory.toLowerCase().trim();
    const precio = safeNumber(p.precioVenta);
    const esElaborado = p.tipo === 'elaborado';
    return matchesSearch && matchesCategory && precio >= 0 && isNotInsumo && esElaborado;
  });
}

// Simula mapProductoFromDB (versión ACTUAL con bug)
function mapProductoFromDB_actual(p: any) {
  return { ...p, tipo: p.tipo || 'ingrediente' };
}

// Simula mapProductoFromDB (versión CORREGIDA)
function mapProductoFromDB_fixed(p: any) {
  return { ...p, tipo: p.tipo || 'elaborado' };
}

// ─── Dataset de prueba ────────────────────────────────────────────────────────

const PRODUCTOS_MOCK = [
  { id: 'p1', nombre: 'Mogolla', categoria: 'PANES', tipo: 'elaborado', precioVenta: 500 },
  { id: 'p2', nombre: 'Croissant', categoria: 'panes', tipo: 'elaborado', precioVenta: 1200 },
  { id: 'p3', nombre: 'Coca-Cola 600ml', categoria: 'COCACOLA', tipo: 'elaborado', precioVenta: 3500 },
  { id: 'p4', nombre: 'Azúcar kg', categoria: 'ins:materias primas', tipo: 'ingrediente', precioVenta: 2500 },
  { id: 'p5', nombre: 'Harina 50kg', categoria: 'insumos', tipo: 'ingrediente', precioVenta: 0 },
  { id: 'p6', nombre: 'Dulce de leche', categoria: 'Panes', tipo: 'elaborado', precioVenta: 800 },
  { id: 'p7', nombre: 'Producto sin tipo', categoria: 'PANES', tipo: undefined, precioVenta: 300 },
  { id: 'p8', nombre: 'Producto tipo null', categoria: 'PANES', tipo: null, precioVenta: 400 },
  { id: 'p9', nombre: 'Gaseosa sin tipo (Supabase)', categoria: 'COCACOLA', tipo: null, precioVenta: 2000 },
];

// ─── MOD: Filtro de Categoría ─────────────────────────────────────────────────

describe('MOD-01 — Filtro categoría: solo muestra productos de la categoría seleccionada', () => {
  it('MOD-01a: seleccionar PANES no muestra COCACOLA', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, '', 'PANES');
    const nombres = result.map(p => p.nombre);
    expect(nombres).not.toContain('Coca-Cola 600ml');
    expect(nombres).toContain('Mogolla');
    expect(nombres).toContain('Croissant');
  });

  it('MOD-01b: seleccionar COCACOLA no muestra PANES', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, '', 'COCACOLA');
    const nombres = result.map(p => p.nombre);
    expect(nombres).not.toContain('Mogolla');
    expect(nombres).not.toContain('Croissant');
    expect(nombres).toContain('Coca-Cola 600ml');
  });

  it('MOD-01c: comparación es case-insensitive (Panes = PANES = panes)', () => {
    const r1 = filtrarProductosVenta(PRODUCTOS_MOCK, '', 'PANES');
    const r2 = filtrarProductosVenta(PRODUCTOS_MOCK, '', 'Panes');
    const r3 = filtrarProductosVenta(PRODUCTOS_MOCK, '', 'panes');
    expect(r1.map(p => p.id).sort()).toEqual(r2.map(p => p.id).sort());
    expect(r2.map(p => p.id).sort()).toEqual(r3.map(p => p.id).sort());
  });

  it('MOD-01d: sin categoría seleccionada muestra todo lo elaborado', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, '', null);
    const tipos = result.map(p => p.tipo);
    expect(tipos.every(t => t === 'elaborado')).toBe(true);
  });
});

// ─── MOD: Filtro de Insumos ───────────────────────────────────────────────────

describe('MOD-02 — Insumos NUNCA aparecen en el POS', () => {
  it('MOD-02a: ins: prefix oculta del POS', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, '', null);
    expect(result.find(p => p.id === 'p4')).toBeUndefined();
  });

  it('MOD-02b: "insumos" category oculta del POS', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, '', null);
    expect(result.find(p => p.id === 'p5')).toBeUndefined();
  });
});

// ─── MOD: Bug tipo=null del mapper ───────────────────────────────────────────

describe('MOD-03 — BUG CRÍTICO: tipo=null desde Supabase oculta productos del POS', () => {
  it('MOD-03a: tipo=undefined → mapper ACTUAL convierte a "ingrediente" → OCULTO del POS', () => {
    const mapped = mapProductoFromDB_actual({ id: 'p7', nombre: 'Sin tipo', categoria: 'PANES', tipo: undefined, precioVenta: 300 });
    expect(mapped.tipo).toBe('ingrediente');
    const filtered = filtrarProductosVenta([mapped], '', 'PANES');
    expect(filtered).toHaveLength(0); // ← BUG: debería mostrar el producto
  });

  it('MOD-03b: tipo=null → mapper ACTUAL convierte a "ingrediente" → OCULTO del POS', () => {
    const mapped = mapProductoFromDB_actual({ id: 'p8', nombre: 'Tipo null', categoria: 'PANES', tipo: null, precioVenta: 400 });
    expect(mapped.tipo).toBe('ingrediente');
    const filtered = filtrarProductosVenta([mapped], '', 'PANES');
    expect(filtered).toHaveLength(0); // ← BUG confirmado
  });

  it('MOD-03c: tipo=null → mapper CORREGIDO convierte a "elaborado" → VISIBLE en POS', () => {
    const mapped = mapProductoFromDB_fixed({ id: 'p7', nombre: 'Sin tipo', categoria: 'PANES', tipo: undefined, precioVenta: 300 });
    expect(mapped.tipo).toBe('elaborado');
    const filtered = filtrarProductosVenta([mapped], '', 'PANES');
    expect(filtered).toHaveLength(1); // ← CORRECTO con el fix
  });

  it('MOD-03d: tipo=null en COCACOLA → CORREGIDO → visible en COCACOLA, NO en PANES', () => {
    const mapped = mapProductoFromDB_fixed({ id: 'p9', nombre: 'Gaseosa', categoria: 'COCACOLA', tipo: null, precioVenta: 2000 });
    const enCoca = filtrarProductosVenta([mapped], '', 'COCACOLA');
    const enPanes = filtrarProductosVenta([mapped], '', 'PANES');
    expect(enCoca).toHaveLength(1);  // visible en su categoría ✓
    expect(enPanes).toHaveLength(0); // NO en Panes ✓
  });
});

// ─── SINC: Push inteligente con timestamps ───────────────────────────────────

describe('SINC-01 — Push inteligente: lógica de timestamp para productos', () => {
  // Simula la lógica del push inteligente en useRealtimeSync.ts
  function smartPush(localItems: any[], supabaseMap: Map<string, string>, tombstones: Set<string>) {
    return localItems.filter((local: any) => {
      if (tombstones.has(local.id)) return false;
      const remoteTs = supabaseMap.get(local.id);
      if (remoteTs === undefined) return true; // nuevo
      return new Date(local.updatedAt ?? local.createdAt ?? 0) > new Date(remoteTs);
    });
  }

  const AHORA = new Date().toISOString();
  const AYER = new Date(Date.now() - 86400000).toISOString();
  const HACE1H = new Date(Date.now() - 3600000).toISOString();

  it('SINC-01a: producto nuevo (no en Supabase) → siempre se sube', () => {
    const local = [{ id: 'nuevo', updatedAt: AYER }];
    const sMap = new Map<string, string>(); // vacío
    const result = smartPush(local, sMap, new Set());
    expect(result).toHaveLength(1);
  });

  it('SINC-01b: producto local más nuevo → se sube (sincroniza edición)', () => {
    const local = [{ id: 'p1', updatedAt: AHORA }];
    const sMap = new Map([['p1', AYER]]);
    const result = smartPush(local, sMap, new Set());
    expect(result).toHaveLength(1);
  });

  it('SINC-01c: producto local más viejo → NO se sube (evita sobreescribir edición de otro dispositivo)', () => {
    const local = [{ id: 'p1', updatedAt: AYER }];
    const sMap = new Map([['p1', AHORA]]);
    const result = smartPush(local, sMap, new Set());
    expect(result).toHaveLength(0); // ← correcto: Supabase tiene versión más nueva
  });

  it('SINC-01d: producto tombstoneado → NO se sube (evita resurrección)', () => {
    const local = [{ id: 'eliminado', updatedAt: AHORA }];
    const sMap = new Map<string, string>();
    const tombstones = new Set(['eliminado']);
    const result = smartPush(local, sMap, tombstones);
    expect(result).toHaveLength(0); // ← correcto: no resurrectar eliminado
  });

  it('SINC-01e: mezcla — nuevo + más nuevo + más viejo + tombstone', () => {
    const local = [
      { id: 'nuevo', updatedAt: AHORA },
      { id: 'masNuevo', updatedAt: AHORA },
      { id: 'masViejo', updatedAt: AYER },
      { id: 'eliminado', updatedAt: AHORA },
    ];
    const sMap = new Map([
      ['masNuevo', HACE1H],  // local es más nuevo → sube
      ['masViejo', AHORA],   // Supabase más nuevo → NO sube
    ]);
    const tombstones = new Set(['eliminado']);
    const result = smartPush(local, sMap, tombstones);
    const ids = result.map((i: any) => i.id);
    expect(ids).toContain('nuevo');       // nuevo → sube ✓
    expect(ids).toContain('masNuevo');    // local newer → sube ✓
    expect(ids).not.toContain('masViejo');  // supabase newer → no sube ✓
    expect(ids).not.toContain('eliminado'); // tombstoned → no sube ✓
  });
});

// ─── SINC: Pull inteligente con timestamps ───────────────────────────────────

describe('SINC-02 — Pull inteligente: descarga solo items más nuevos', () => {
  function smartPull(supabaseItems: any[], localItems: any[], tombstones: string[]) {
    const localIds   = new Set(localItems.map((i: any) => i.id));
    const localTsMap = new Map(localItems.map((i: any) => [i.id, i.updatedAt ?? i.createdAt ?? '']));
    const tombSet    = new Set(tombstones);

    const nuevos = supabaseItems.filter((i: any) =>
      i.id && !localIds.has(i.id) && !tombSet.has(i.id)
    );
    const actualizados = supabaseItems.filter((remote: any) => {
      if (!remote.id || !localIds.has(remote.id) || tombSet.has(remote.id)) return false;
      const localTs  = new Date(localTsMap.get(remote.id) ?? 0).getTime();
      const remoteTs = new Date(remote.updatedAt ?? remote.createdAt ?? 0).getTime();
      return remoteTs > localTs;
    });
    return { nuevos, actualizados };
  }

  const AHORA = new Date().toISOString();
  const AYER  = new Date(Date.now() - 86400000).toISOString();

  it('SINC-02a: item nuevo en Supabase → se descarga', () => {
    const { nuevos } = smartPull([{ id: 'nuevo', updatedAt: AHORA }], [], []);
    expect(nuevos).toHaveLength(1);
  });

  it('SINC-02b: item tombstoneado → NO se descarga (LOCAL SIEMPRE GANA en eliminaciones)', () => {
    const { nuevos } = smartPull([{ id: 'eliminado', updatedAt: AHORA }], [], ['eliminado']);
    expect(nuevos).toHaveLength(0);
  });

  it('SINC-02c: Supabase más nuevo → se actualiza local (captura ediciones de otro dispositivo)', () => {
    const local   = [{ id: 'p1', nombre: 'Nombre viejo', updatedAt: AYER }];
    const remote  = [{ id: 'p1', nombre: 'Nombre nuevo', updatedAt: AHORA }];
    const { actualizados } = smartPull(remote, local, []);
    expect(actualizados).toHaveLength(1);
    expect(actualizados[0].nombre).toBe('Nombre nuevo');
  });

  it('SINC-02d: local más nuevo → NO se sobreescribe (respeta edición local)', () => {
    const local  = [{ id: 'p1', nombre: 'Edición local', updatedAt: AHORA }];
    const remote = [{ id: 'p1', nombre: 'Versión vieja Supabase', updatedAt: AYER }];
    const { actualizados } = smartPull(remote, local, []);
    expect(actualizados).toHaveLength(0);
  });
});

// ─── CONS: Integridad en código fuente ───────────────────────────────────────

describe('CONS-01 — Integridad del código fuente', () => {
  it('CONS-01a: Ventas.tsx tiene filtro esElaborado', () => {
    const src = readSrc('pages/Ventas.tsx');
    expect(src).toContain("p.tipo === 'elaborado'");
  });

  it('CONS-01b: Ventas.tsx filtra insumos con ins: prefix', () => {
    const src = readSrc('pages/Ventas.tsx');
    expect(src).toContain("categoriaLower.startsWith('ins:')");
  });

  it('CONS-01c: Ventas.tsx comparación de categoría es lowercase', () => {
    const src = readSrc('pages/Ventas.tsx');
    expect(src).toContain('selectedCategory.toLowerCase().trim()');
  });

  it('CONS-01d: supabase-sync-bridge.ts tiene deleteProducto en DELETES', () => {
    const src = readSrc('lib/supabase-sync-bridge.ts');
    expect(src).toContain("method: 'deleteProducto'");
  });

  it('CONS-01e: useRealtimeSync.ts tiene push inteligente con updatedAt', () => {
    const src = readSrc('hooks/useRealtimeSync.ts');
    expect(src).toContain('sProdsMap');
    expect(src).toContain('tombSet.has(local.id)');
    expect(src).toContain('updatedAt ?? local.createdAt');
  });

  it('CONS-01f: useRealtimeSync.ts tiene pull inteligente con actualizados', () => {
    const src = readSrc('hooks/useRealtimeSync.ts');
    expect(src).toContain('actualizados');
    expect(src).toContain("['productos', 'proveedores', 'precios'].includes(table)");
  });

  it('CONS-01g: Fix 5 (restaurar tombstones) está REVERTIDO', () => {
    const src = readSrc('hooks/useRealtimeSync.ts');
    expect(src).not.toContain('removeTombstone');
    expect(src).not.toContain('Fix 5');
  });
});

// ─── MOD: Búsqueda cross-categoría ───────────────────────────────────────────

describe('MOD-04 — Búsqueda global no contamina categorías', () => {
  it('MOD-04a: buscar "Cola" sin categoría muestra productos de categorías correctas', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, 'Cola', null);
    // Solo Coca-Cola debe aparecer (es elaborado, no insumo, contiene "Cola")
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Coca-Cola 600ml');
    expect(result[0].categoria?.toLowerCase()).toBe('cocacola');
  });

  it('MOD-04b: buscar "Pan" EN categoría PANES solo muestra PANES', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, 'pan', 'PANES');
    result.forEach(p => {
      expect(p.categoria?.toLowerCase().trim()).toBe('panes');
    });
  });

  it('MOD-04c: buscar "Coca" en categoría PANES retorna vacío', () => {
    const result = filtrarProductosVenta(PRODUCTOS_MOCK, 'coca', 'PANES');
    expect(result).toHaveLength(0);
  });
});
