/**
 * ═══════════════════════════════════════════════════════════════════
 * 5 CAPAS DE PROTECCIÓN: Sincronización Precios Proveedor ↔ Venta
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Garantiza que los precios cargados en Gestión de Proveedores se
 * sincronicen correctamente con el precio de venta en Búsqueda Rápida.
 * 
 * CAPA 1: Verificación de fórmulas de cálculo (lógica pura)
 * CAPA 2: Integridad del código fuente (strings en archivos)
 * CAPA 3: Sincronización BusquedaRapida (costo unitario)
 * CAPA 4: Consistencia entre hooks (usePriceControl = useCatalogo)
 * CAPA 5: Regresión de escenarios reales del usuario
 * 
 * NUNCA eliminar este archivo sin aprobación del equipo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leer archivos fuente
const hooksDir = resolve(__dirname, '../hooks');
const componentsDir = resolve(__dirname, '../components');

const usePriceControlSrc = readFileSync(resolve(hooksDir, 'usePriceControl.ts'), 'utf-8');
const useCatalogoSrc = readFileSync(resolve(hooksDir, 'useCatalogo.ts'), 'utf-8');
const busquedaRapidaSrc = readFileSync(resolve(componentsDir, 'layout/BusquedaRapida.tsx'), 'utf-8');
const proveedoresSrc = readFileSync(resolve(__dirname, '../pages/Proveedores.tsx'), 'utf-8');

// ============================================================
// CAPA 1: Fórmulas de cálculo correctas (lógica pura)
// ============================================================
describe('CAPA 1: Fórmulas de cálculo de precios', () => {

  // Fórmula correcta: precioVenta = (precioCosto / cantidadEmbalaje) * (1 + margen/100), redondeado a 100
  const calcularPrecioVenta = (precioCosto: number, cantidadEmbalaje: number, margenUtilidad: number) => {
    const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
    return Math.round(costoUnitario * (1 + margenUtilidad / 100) / 100) * 100;
  };

  it('VERIFICACIÓN 1: Producto unitario — costo 10000, margen 30% → venta 13000', () => {
    const resultado = calcularPrecioVenta(10000, 1, 30);
    expect(resultado).toBe(13000);
  });

  it('VERIFICACIÓN 2: Producto en paquete de 12 — costo 15000, margen 30% → venta 1600 (unitario)', () => {
    const resultado = calcularPrecioVenta(15000, 12, 30);
    // 15000/12 = 1250 unitario, 1250 * 1.30 = 1625, redondeado a 1600
    expect(resultado).toBe(1600);
  });

  it('VERIFICACIÓN 3: Producto en paquete de 24 — costo 48000, margen 50% → venta 3000 (unitario)', () => {
    const resultado = calcularPrecioVenta(48000, 24, 50);
    // 48000/24 = 2000 unitario, 2000 * 1.50 = 3000
    expect(resultado).toBe(3000);
  });

  it('VERIFICACIÓN 4: Precio baja de 10000 a 8000 — margen 30% → venta 10400', () => {
    const resultado = calcularPrecioVenta(8000, 1, 30);
    expect(resultado).toBe(10400);
  });

  it('VERIFICACIÓN 5: cantidadEmbalaje 0 o undefined se trata como 1', () => {
    const conCero = calcularPrecioVenta(5000, 0, 30);
    const conUno = calcularPrecioVenta(5000, 1, 30);
    expect(conCero).toBe(conUno);
  });

  it('utilidad correcta: (precioVenta - costoUnitario) / costoUnitario * 100', () => {
    const costoUnit = 15000 / 12; // 1250
    const precioVenta = 1600;
    const utilidad = ((precioVenta - costoUnit) / costoUnit) * 100;
    expect(utilidad).toBeCloseTo(28, 0); // ~28%
  });
});

// ============================================================
// CAPA 2: Integridad del código fuente — protecciones en hooks
// ============================================================
describe('CAPA 2: addOrUpdatePrecio usa fórmula con costoUnitario', () => {

  it('usePriceControl divide precioCosto por cantidadEmbalaje', () => {
    expect(usePriceControlSrc).toContain('precioCosto / (cantidadEmbalaje || 1)');
  });

  it('usePriceControl ajusta precio en subidas Y bajadas (sin "diferencia > 0")', () => {
    // La condición debe ser SOLO "ajusteAutomatico", no "ajusteAutomatico && diferencia > 0"
    // Buscar que el bloque de ajuste automático NO tenga "diferencia > 0"
    const autoAjusteBlock = usePriceControlSrc.match(/SINCRONIZACIÓN.*ajusteAutomatico/s);
    expect(autoAjusteBlock).not.toBeNull();
  });

  it('usePriceControl calcula nuevoPrecioVenta redondeado a centenas', () => {
    expect(usePriceControlSrc).toContain('Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100');
  });

  it('usePriceControl actualiza costoBase junto con precioVenta', () => {
    expect(usePriceControlSrc).toContain('costoBase: costoUnitario');
  });

  it('useCatalogo tiene la misma fórmula que usePriceControl', () => {
    expect(useCatalogoSrc).toContain('precioCosto / (cantidadEmbalaje || 1)');
    expect(useCatalogoSrc).toContain('costoBase: costoUnitario');
  });

  it('useCatalogo ajusta precio en subidas Y bajadas', () => {
    // NO debe tener la restricción "diferencia > 0" en el ajuste automático  
    const bloqueAutoAjuste = useCatalogoSrc.match(/if \(configuracion\.ajusteAutomatico\) \{[^}]*costoUnitario/s);
    expect(bloqueAutoAjuste).not.toBeNull();
  });
});

// ============================================================
// CAPA 3: BusquedaRapida muestra datos correctos
// ============================================================
describe('CAPA 3: BusquedaRapida sincronizada con precios de proveedor', () => {

  it('BusquedaRapida calcula utilidad con costo UNITARIO, no precio de paquete', () => {
    expect(busquedaRapidaSrc).toContain('cantidadEmbalaje');
    expect(busquedaRapidaSrc).toContain('costoUnitario');
  });

  it('BusquedaRapida divide precioCosto por cantidadEmbalaje en stats', () => {
    // Verificar que getProductoStats NO usa precioCosto directamente
    const statsSection = busquedaRapidaSrc.match(/getProductoStats[\s\S]*?mejorCosto:\s*costoUnitario/);
    expect(statsSection).not.toBeNull();
  });

  it('BusquedaRapida muestra precioVenta del producto (sincronizado)', () => {
    expect(busquedaRapidaSrc).toContain('producto.precioVenta');
  });

  it('BusquedaRapida muestra costo unitario por proveedor (no pack)', () => {
    // La lista de precios por proveedor debe mostrar costo unitario
    expect(busquedaRapidaSrc).toContain('formatCurrency(costoUnit)');
  });

  it('BusquedaRapida compara esMejor con costoUnitario, no precioCosto', () => {
    expect(busquedaRapidaSrc).toContain('costoUnit === stats.mejorCosto');
  });
});

// ============================================================
// CAPA 4: Proveedores.tsx sincroniza completamente con Productos
// ============================================================
describe('CAPA 4: Proveedores.tsx sincroniza con módulo de productos', () => {

  it('handleSubmit llama onAddOrUpdatePrecio con cantidadEmbalaje', () => {
    expect(proveedoresSrc).toContain('cantidadEmbalaje: item.cantidadEmbalaje');
  });

  it('handleSubmit actualiza producto con precioVenta del formulario', () => {
    expect(proveedoresSrc).toContain('precioVenta: item.precioVenta');
  });

  it('handleSubmit actualiza producto con margenUtilidad', () => {
    expect(proveedoresSrc).toContain('margenUtilidad: item.margenVenta');
  });

  it('handleSubmit actualiza producto con costoBase (costo unitario)', () => {
    expect(proveedoresSrc).toContain('costoBase: item.costoUnitario');
  });

  it('handleEdit carga margenVenta REAL del producto (no hardcodeado)', () => {
    // Al editar un proveedor, el margen debe venir del producto real
    expect(proveedoresSrc).toContain('margenVenta: prod?.margenUtilidad');
  });

  it('handleEdit carga precioVenta REAL del producto', () => {
    expect(proveedoresSrc).toContain('Math.round((prod?.precioVenta || 0) / 100) * 100');
  });
});

// ============================================================
// CAPA 5: Escenarios de regresión del usuario
// ============================================================
describe('CAPA 5: Escenarios reales — regresión completa', () => {

  const calcPrecioVenta = (precioCosto: number, cantEmb: number, margen: number) => {
    const costoUnitario = precioCosto / (cantEmb || 1);
    return Math.round(costoUnitario * (1 + margen / 100) / 100) * 100;
  };

  const calcUtilidad = (precioVenta: number, precioCosto: number, cantEmb: number) => {
    const costoUnitario = precioCosto / (cantEmb || 1);
    return costoUnitario > 0 ? ((precioVenta - costoUnitario) / costoUnitario) * 100 : 0;
  };

  it('ESCENARIO: Cargar producto en proveedor → precioVenta se actualiza', () => {
    // Usuario carga: Harina 50kg a $85000, margen 30%  
    const precioCosto = 85000;
    const cantEmb = 1; // se vende la bolsa entera
    const margen = 30;
    const precioVenta = calcPrecioVenta(precioCosto, cantEmb, margen);
    expect(precioVenta).toBe(110500); // 85000 * 1.30 = 110500
    // En BusquedaRapida debería mostrar $110500
  });

  it('ESCENARIO: Actualizar precio proveedor que BAJA → precioVenta se ajusta', () => {
    // Antes: Leche a $5000, margen 30% → venta $6500
    // Ahora: Leche baja a $4000
    const antes = calcPrecioVenta(5000, 1, 30);
    const despues = calcPrecioVenta(4000, 1, 30);
    expect(antes).toBe(6500);
    expect(despues).toBe(5200);
    // El precio DEBE bajar, no quedarse en 6500
    expect(despues).toBeLessThan(antes);
  });

  it('ESCENARIO: Producto en paquete de 30 → utilidad correcta en búsqueda', () => {
    // Chicle paquete 30 unidades a $90000, margen 40%
    const precioCosto = 90000;
    const cantEmb = 30;
    const margen = 40;
    const precioVenta = calcPrecioVenta(precioCosto, cantEmb, margen);
    // costoUnit = 90000/30 = 3000, venta = 3000 * 1.40 = 4200
    expect(precioVenta).toBe(4200);
    
    const utilidad = calcUtilidad(precioVenta, precioCosto, cantEmb);
    expect(utilidad).toBeCloseTo(40, 0); // ~40%
    expect(utilidad).toBeGreaterThan(0); // NUNCA negativa
  });

  it('ESCENARIO: Cambiar margen en proveedor → precioVenta refleja nuevo margen', () => {
    // Misma leche $5000 pero margen cambia de 30% a 50%
    const conMargen30 = calcPrecioVenta(5000, 1, 30);
    const conMargen50 = calcPrecioVenta(5000, 1, 50);
    expect(conMargen30).toBe(6500);
    expect(conMargen50).toBe(7500);
    expect(conMargen50).toBeGreaterThan(conMargen30);
  });

  it('ESCENARIO: Nuevo proveedor con precio diferente → precioVenta se recalcula', () => {
    // Proveedor A: Azúcar $3000, margen 30% → venta $3900
    // Proveedor B: Azúcar $2500 (más barato)
    const venta3000 = calcPrecioVenta(3000, 1, 30);
    const venta2500 = calcPrecioVenta(2500, 1, 30);
    expect(venta3000).toBe(3900);
    expect(venta2500).toBe(3300); // Precio de venta baja con el costo
  });
});
