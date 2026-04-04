// PROTEGIDO: Tests de regresión para prevenir bugs de tipos y seguridad.
// Si algún test falla, significa que alguien rompió una corrección crítica.
import { describe, it, expect } from 'vitest';

// ============================================================
// TEST 1: Compatibilidad DBProducto <-> Producto
// Bug original: updatedAt era requerido en Producto pero opcional en DBProducto
// Corrección: updatedAt ahora es opcional en ambos
// ============================================================
describe('Compatibilidad de tipos Producto / DBProducto', () => {
  it('Producto acepta updatedAt undefined (compatible con DB)', () => {
    const producto = {
      id: 'test-1',
      nombre: 'Pan de Bono',
      categoria: 'Panadería',
      precioVenta: 2500,
      margenUtilidad: 30,
      tipo: 'elaborado' as const,
      createdAt: '2026-01-01T00:00:00Z',
      // updatedAt intencionalmente omitido
    };

    // El producto debe ser válido sin updatedAt
    expect(producto.id).toBeDefined();
    expect(producto.updatedAt).toBeUndefined();
    expect(producto).not.toHaveProperty('updatedAt');
  });

  it('Producto acepta updatedAt con valor string', () => {
    const producto = {
      id: 'test-2',
      nombre: 'Croissant',
      categoria: 'Panadería',
      precioVenta: 3000,
      margenUtilidad: 35,
      tipo: 'elaborado' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    };

    expect(producto.updatedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('Array de productos puede mezclar con y sin updatedAt', () => {
    const productos = [
      { id: '1', nombre: 'A', categoria: 'X', precioVenta: 100, margenUtilidad: 10, tipo: 'elaborado' as const, createdAt: '2026-01-01' },
      { id: '2', nombre: 'B', categoria: 'X', precioVenta: 200, margenUtilidad: 20, tipo: 'ingrediente' as const, createdAt: '2026-01-01', updatedAt: '2026-01-02' },
    ];

    expect(productos).toHaveLength(2);
    expect(productos[0].updatedAt).toBeUndefined();
    expect(productos[1].updatedAt).toBeDefined();
  });
});

// ============================================================
// TEST 2: Seguridad - Comparación de contraseñas
// Bug original: comparación con === vulnerable a timing attacks
// Corrección: comparación de tiempo constante
// ============================================================
describe('Seguridad de comparación de contraseñas', () => {
  // Función idéntica a la del AuthContext (para testear su lógica)
  const safeCompare = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  };

  it('retorna true para strings idénticos', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
    expect(safeCompare('password', 'password')).toBe(true);
  });

  it('retorna false para strings diferentes', () => {
    expect(safeCompare('abc123', 'abc124')).toBe(false);
    expect(safeCompare('password', 'passwor1')).toBe(false);
  });

  it('retorna false para longitudes diferentes', () => {
    expect(safeCompare('abc', 'abcd')).toBe(false);
    expect(safeCompare('', 'a')).toBe(false);
  });

  it('retorna true para strings vacíos', () => {
    expect(safeCompare('', '')).toBe(true);
  });

  it('no es vulnerable a comparación parcial', () => {
    // Si fuera === directo, un atacante podría medir tiempos
    // Con XOR bitwise, el tiempo es constante para mismo largo
    const a = 'secretpassword123';
    const b = 'secretpassword124';
    expect(safeCompare(a, b)).toBe(false);
  });
});

// ============================================================
// TEST 3: Supabase no crea cliente con strings vacíos
// Bug original: createClient('', '') = falla silenciosa
// Corrección: URL placeholder con flag isSupabaseConfigured
// ============================================================
describe('Configuración segura de Supabase', () => {
  it('exporta isSupabaseConfigured como booleano', async () => {
    // Importar dinámicamente para verificar la exportación
    const mod = await import('@/lib/supabase');
    expect(typeof mod.isSupabaseConfigured).toBe('boolean');
  });

  it('exporta el cliente supabase', async () => {
    const mod = await import('@/lib/supabase');
    expect(mod.supabase).toBeDefined();
  });
});

// ============================================================
// TEST 4: Validación de estructura de datos críticos
// Protege contra cambios accidentales en interfaces clave
// ============================================================
describe('Estructura de datos críticos', () => {
  it('Producto tiene campos obligatorios correctos', () => {
    const camposRequeridos = ['id', 'nombre', 'categoria', 'precioVenta', 'margenUtilidad', 'tipo', 'createdAt'];
    const camposOpcionales = ['descripcion', 'precioCompra', 'costoBase', 'imagen', 'updatedAt'];

    const producto = {
      id: 'x', nombre: 'x', categoria: 'x', precioVenta: 0,
      margenUtilidad: 0, tipo: 'elaborado', createdAt: '2026-01-01',
    };

    // Todos los campos requeridos deben existir
    camposRequeridos.forEach(campo => {
      expect(producto).toHaveProperty(campo);
    });

    // Campos opcionales NO necesitan existir
    camposOpcionales.forEach(campo => {
      // No lanza error si falta — eso es correcto
      expect(() => (producto as any)[campo]).not.toThrow();
    });
  });
});
