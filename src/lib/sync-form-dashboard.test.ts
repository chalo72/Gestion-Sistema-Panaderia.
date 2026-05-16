/**
 * ═══════════════════════════════════════════════════════════════════
 * TEST DE SINCRONIZACIÓN: Formulario Proveedor ↔ Dashboard Proveedores
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Verifica que los datos fluyen correctamente entre:
 * - ProveedorForm.tsx (crear/editar proveedor + catálogo de productos)
 * - Proveedores.tsx   (dashboard con KPIs, lista, tabla de productos)
 * 
 * ═══════════════════════════════════════════════════════════════════
 * CAPA 1: Integridad del formulario (campos enviados)
 * CAPA 2: handleSubmit sincroniza con DB (proveedor + productos)
 * CAPA 3: handleEdit carga datos correctos al formulario
 * CAPA 4: Dashboard muestra datos sincronizados  
 * CAPA 5: KPIs calculan correctamente desde los datos
 * ═══════════════════════════════════════════════════════════════════
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Leer archivos fuente
const srcDir = resolve(__dirname, '..');
const proveedoresPageSrc = readFileSync(resolve(srcDir, 'pages/Proveedores.tsx'), 'utf-8');
const proveedorFormSrc = readFileSync(resolve(srcDir, 'components/proveedores/ProveedorForm.tsx'), 'utf-8');

// ============================================================
// CAPA 1: ProveedorForm envía datos completos al submit
// ============================================================
describe('CAPA 1: ProveedorForm — datos completos en ProductoCatalogo', () => {

  it('ProductoCatalogo tiene campo nombre', () => {
    expect(proveedorFormSrc).toContain('nombre: string');
  });

  it('ProductoCatalogo tiene campo precioCosto (costo paca)', () => {
    expect(proveedorFormSrc).toContain('precioCosto: number');
  });

  it('ProductoCatalogo tiene campo costoUnitario (calculado)', () => {
    expect(proveedorFormSrc).toContain('costoUnitario: number');
  });

  it('ProductoCatalogo tiene campo precioVenta (venta unitario)', () => {
    expect(proveedorFormSrc).toContain('precioVenta: number');
  });

  it('ProductoCatalogo tiene campo cantidadEmbalaje', () => {
    expect(proveedorFormSrc).toContain('cantidadEmbalaje: number');
  });

  it('ProductoCatalogo tiene campo tipoEmbalaje', () => {
    expect(proveedorFormSrc).toContain('tipoEmbalaje: TipoEmbalaje');
  });

  it('ProductoCatalogo tiene campo margenVenta (%)', () => {
    expect(proveedorFormSrc).toContain('margenVenta: number');
  });

  it('ProductoCatalogo tiene campo categoria', () => {
    expect(proveedorFormSrc).toContain('categoria: string');
  });

  it('ProductoCatalogo tiene campo destino (insumo/venta)', () => {
    expect(proveedorFormSrc).toContain("destino: DestinoUso");
  });

  it('addProductoCatalogo redondea costoUnitario a centenas', () => {
    expect(proveedorFormSrc).toContain('costoUnitario: Math.round(costUnit / 100) * 100');
  });

  it('addProductoCatalogo redondea precioVenta a centenas', () => {
    expect(proveedorFormSrc).toContain('precioVenta: Math.round(sellPrice / 100) * 100');
  });

  it('handleSave llama onSubmit con formData y catalogoItems', () => {
    expect(proveedorFormSrc).toContain('await onSubmit(formData, catalogoItems)');
  });
});

// ============================================================
// CAPA 2: handleSubmit sincroniza datos Form → DB
// ============================================================
describe('CAPA 2: Proveedores.tsx handleSubmit — sincronización Form → DB', () => {

  it('handleSubmit guarda nombre del proveedor', () => {
    // data.nombre se pasa a onAddProveedor o onUpdateProveedor
    expect(proveedoresPageSrc).toContain('onUpdateProveedor(editingProveedor.id, data)');
    expect(proveedoresPageSrc).toContain('onAddProveedor(data)');
  });

  it('handleSubmit crea productos nuevos con nombre del formulario', () => {
    expect(proveedoresPageSrc).toContain('nombre: item.nombre');
  });

  it('handleSubmit envía precioCosto al crear precio', () => {
    expect(proveedoresPageSrc).toContain('precioCosto: Math.round((Number(item.precioCosto)');
  });

  it('handleSubmit envía cantidadEmbalaje al crear precio', () => {
    expect(proveedoresPageSrc).toContain('cantidadEmbalaje: Number(item.cantidadEmbalaje)');
  });

  it('handleSubmit envía tipoEmbalaje al crear precio', () => {
    expect(proveedoresPageSrc).toContain('tipoEmbalaje: item.tipoEmbalaje');
  });

  it('handleSubmit envía destino (insumo/venta) al crear precio', () => {
    expect(proveedoresPageSrc).toContain('destino: item.destino');
  });

  it('handleSubmit actualiza producto con precioVenta del formulario', () => {
    expect(proveedoresPageSrc).toContain('precioVenta: Number(item.precioVenta)');
  });

  it('handleSubmit actualiza producto con costoBase unitario', () => {
    expect(proveedoresPageSrc).toContain('costoBase: Math.round((Number(item.costoUnitario)');
  });

  it('handleSubmit actualiza producto con margenUtilidad', () => {
    expect(proveedoresPageSrc).toContain('margenUtilidad: Number(item.margenVenta)');
  });

  it('handleSubmit actualiza producto con la categoría del formulario', () => {
    expect(proveedoresPageSrc).toContain("categoria: item.categoria || 'Otro'");
  });
});

// ============================================================
// CAPA 3: handleEdit carga datos correctos al formulario
// ============================================================
describe('CAPA 3: Proveedores.tsx handleEdit — sincronización DB → Form', () => {

  it('handleEdit asigna uid desde precio.id (no genera nuevo)', () => {
    expect(proveedoresPageSrc).toContain('uid: precio.id');
  });

  it('handleEdit asigna productoId desde precio.productoId', () => {
    expect(proveedoresPageSrc).toContain('productoId: precio.productoId');
  });

  it('handleEdit carga nombre desde el producto real', () => {
    expect(proveedoresPageSrc).toContain("nombre: prod?.nombre");
  });

  it('handleEdit carga precioCosto desde PrecioProveedor', () => {
    expect(proveedoresPageSrc).toContain('precioCosto: precio.precioCosto');
  });

  it('handleEdit carga margenVenta desde producto.margenUtilidad', () => {
    expect(proveedoresPageSrc).toContain('margenVenta: prod?.margenUtilidad');
  });

  it('handleEdit carga precioVenta desde producto real (no recalcula)', () => {
    expect(proveedoresPageSrc).toContain('Math.round((prod?.precioVenta || 0) / 100) * 100');
  });

  it('handleEdit carga cantidadEmbalaje desde PrecioProveedor', () => {
    expect(proveedoresPageSrc).toContain('cantidadEmbalaje: precio.cantidadEmbalaje');
  });

  it('handleEdit carga tipoEmbalaje desde PrecioProveedor', () => {
    expect(proveedoresPageSrc).toContain('tipoEmbalaje:');
    expect(proveedoresPageSrc).toContain('precio.tipoEmbalaje');
  });

  it('handleEdit calcula costoUnitario = precioCosto / cantidadEmbalaje', () => {
    expect(proveedoresPageSrc).toContain('precio.precioCosto / precio.cantidadEmbalaje');
  });

  it('handleEdit carga categoría desde producto real', () => {
    expect(proveedoresPageSrc).toContain("categoria: prod?.categoria");
  });
});

// ============================================================
// CAPA 4: Dashboard muestra datos sincronizados con DB
// ============================================================
describe('CAPA 4: Dashboard — tabla expandida muestra datos reales', () => {

  it('Tabla tiene columna PRODUCTO que lee prodItem?.nombre', () => {
    expect(proveedoresPageSrc).toContain("prodItem?.nombre");
  });

  it('Tabla tiene columna EMPAQUE que lee precio.tipoEmbalaje', () => {
    expect(proveedoresPageSrc).toContain('precio.tipoEmbalaje');
    expect(proveedoresPageSrc).toContain('precio.cantidadEmbalaje');
  });

  it('Tabla calcula COSTO/U dividiendo precioCosto / cantidadEmbalaje', () => {
    expect(proveedoresPageSrc).toContain('precio.precioCosto / precio.cantidadEmbalaje');
  });

  it('Tabla muestra P.VENTA desde prodItem?.precioVenta', () => {
    expect(proveedoresPageSrc).toContain("prodItem?.precioVenta");
  });

  it('Tabla muestra categoría del producto', () => {
    expect(proveedoresPageSrc).toContain("prodItem?.categoria");
  });

  it('Fila de proveedor muestra nombre: prov.nombre', () => {
    expect(proveedoresPageSrc).toContain('prov.nombre');
  });

  it('Fila de proveedor muestra calificación: prov.calificacion', () => {
    expect(proveedoresPageSrc).toContain('prov.calificacion');
  });

  it('Badge "ins." cuenta insumos filtrados por destino !== venta', () => {
    expect(proveedoresPageSrc).toContain("destino !== 'venta'");
  });

  it('Badge "vta." cuenta ventas filtrados por destino === venta', () => {
    expect(proveedoresPageSrc).toContain("destino === 'venta'");
  });

  it('Empaque muestra ×N basado en cantidadEmbalaje > 1 (no tipoEmbalaje)', () => {
    expect(proveedoresPageSrc).toContain('cantPack > 1');
  });

  it('Nombres de productos se muestran en uppercase', () => {
    expect(proveedoresPageSrc).toContain('truncate uppercase');
  });

  it('Dashboard usa getPreciosByProveedor para obtener productos', () => {
    expect(proveedoresPageSrc).toContain('getPreciosByProveedor(prov.id)');
  });
});

// ============================================================
// CAPA 5: KPIs del dashboard calculan correctamente
// ============================================================
describe('CAPA 5: KPIs Dashboard — cálculos correctos desde datos', () => {

  it('totalInsumos suma TODOS los precios de TODOS los proveedores', () => {
    // acc + getPreciosByProveedor(p.id).length
    expect(proveedoresPageSrc).toContain('getPreciosByProveedor(p.id).length');
  });

  it('conProductos cuenta proveedores con al menos 1 precio', () => {
    expect(proveedoresPageSrc).toContain('getPreciosByProveedor(p.id).length > 0');
  });

  it('sinProductos = total - conProductos', () => {
    expect(proveedoresPageSrc).toContain('proveedores.length - conProductos');
  });

  it('promedioRating calcula promedio de calificaciones', () => {
    // Suma calificaciones y divide por cantidad
    expect(proveedoresPageSrc).toContain('p.calificacion || 5');
    expect(proveedoresPageSrc).toContain('/ proveedores.length');
  });

  it('KPIs dependen de proveedores y getPreciosByProveedor', () => {
    // useMemo deps correctas
    expect(proveedoresPageSrc).toContain('[proveedores, getPreciosByProveedor]');
  });
});

// ============================================================
// CAPA 6: Flujo completo — simulación de datos
// ============================================================
describe('CAPA 6: Flujo completo — cálculos de sincronización', () => {

  // Simula el flujo: Form crea item → handleSubmit guarda → Dashboard muestra
  const simularFlujoCompleto = (params: {
    nombre: string;
    precioCosto: number;
    cantidadEmbalaje: number;
    margenVenta: number;
  }) => {
    const { precioCosto, cantidadEmbalaje, margenVenta } = params;

    // PASO 1: Lo que calcula ProveedorForm al agregar producto
    const costUnit = precioCosto / (cantidadEmbalaje || 1);
    const sellPrice = costUnit * (1 + margenVenta / 100);
    const formItem = {
      nombre: params.nombre,
      precioCosto: Math.round(precioCosto / 100) * 100,
      costoUnitario: Math.round(costUnit / 100) * 100,
      precioVenta: Math.round(sellPrice / 100) * 100,
      cantidadEmbalaje,
      margenVenta,
    };

    // PASO 2: Lo que handleSubmit guarda en DB
    const precioEnDB = {
      precioCosto: formItem.precioCosto,
      cantidadEmbalaje: formItem.cantidadEmbalaje,
    };
    const productoEnDB = {
      nombre: formItem.nombre,
      costoBase: formItem.costoUnitario,
      precioVenta: formItem.precioVenta,
      margenUtilidad: formItem.margenVenta,
    };

    // PASO 3: Lo que Dashboard lee de la DB
    const costoUDashboard = precioEnDB.cantidadEmbalaje > 1
      ? precioEnDB.precioCosto / precioEnDB.cantidadEmbalaje
      : precioEnDB.precioCosto;
    const pVentaDashboard = productoEnDB.precioVenta;
    const nombreDashboard = productoEnDB.nombre;

    // PASO 4: Lo que handleEdit carga de vuelta al formulario
    const editCostoUnitario = precioEnDB.cantidadEmbalaje
      ? precioEnDB.precioCosto / precioEnDB.cantidadEmbalaje
      : precioEnDB.precioCosto;
    const editPrecioVenta = productoEnDB.precioVenta;
    const editMargenVenta = productoEnDB.margenUtilidad;

    return {
      formItem,
      precioEnDB,
      productoEnDB,
      costoUDashboard,
      pVentaDashboard,
      nombreDashboard,
      editCostoUnitario,
      editPrecioVenta,
      editMargenVenta,
    };
  };

  it('Producto unitario: Form → DB → Dashboard → Edit coinciden', () => {
    const r = simularFlujoCompleto({
      nombre: 'Harina 50kg',
      precioCosto: 85000,
      cantidadEmbalaje: 1,
      margenVenta: 30,
    });
    // Form calcula
    expect(r.formItem.costoUnitario).toBe(85000);
    expect(r.formItem.precioVenta).toBe(110500);
    // Dashboard muestra lo mismo
    expect(r.costoUDashboard).toBe(r.formItem.precioCosto);
    expect(r.pVentaDashboard).toBe(r.formItem.precioVenta);
    expect(r.nombreDashboard).toBe('Harina 50kg');
    // Edit carga lo mismo que el Form original
    expect(r.editCostoUnitario).toBe(r.formItem.costoUnitario);
    expect(r.editPrecioVenta).toBe(r.formItem.precioVenta);
    expect(r.editMargenVenta).toBe(30);
  });

  it('Pack x24 gaseosas: Form → DB → Dashboard → Edit coinciden', () => {
    const r = simularFlujoCompleto({
      nombre: 'Pool Gaseosa 400ml',
      precioCosto: 24500,
      cantidadEmbalaje: 24,
      margenVenta: 30,
    });
    // Dashboard debe mostrar costo unitario, NO el pack
    expect(r.costoUDashboard).toBeCloseTo(24500 / 24, 0);
    // Precio venta coherente
    expect(r.pVentaDashboard).toBe(r.formItem.precioVenta);
    expect(r.pVentaDashboard).toBeGreaterThan(r.costoUDashboard);
    // Edit carga mismos valores
    expect(r.editCostoUnitario).toBeCloseTo(r.costoUDashboard, 0);
    expect(r.editPrecioVenta).toBe(r.formItem.precioVenta);
  });

  it('Pack x12 Fresky: Form → DB → Dashboard → Edit coinciden', () => {
    const r = simularFlujoCompleto({
      nombre: 'Fresky Citrco 410ml',
      precioCosto: 16800,
      cantidadEmbalaje: 12,
      margenVenta: 41,
    });
    // Costo unitario = 16800/12 = 1400
    expect(r.costoUDashboard).toBe(1400);
    // Venta unitaria > costo unitario
    expect(r.pVentaDashboard).toBeGreaterThan(r.costoUDashboard);
    // El nombre se mantiene exacto en todo el flujo
    expect(r.nombreDashboard).toBe('Fresky Citrco 410ml');
  });

  it('Actualizar precio: Edit → Form → DB → Dashboard refleja cambio', () => {
    // Primer carga
    const original = simularFlujoCompleto({
      nombre: 'Leche Entera',
      precioCosto: 60000,
      cantidadEmbalaje: 12,
      margenVenta: 30,
    });
    // Precio baja a 55000
    const actualizado = simularFlujoCompleto({
      nombre: 'Leche Entera',
      precioCosto: 55000,
      cantidadEmbalaje: 12,
      margenVenta: 30,
    });
    // Dashboard debe reflejar el nuevo precio más bajo
    expect(actualizado.costoUDashboard).toBeLessThan(original.costoUDashboard);
    expect(actualizado.pVentaDashboard).toBeLessThan(original.pVentaDashboard);
    // Nombre no cambia
    expect(actualizado.nombreDashboard).toBe(original.nombreDashboard);
  });

  it('KPIs: agregar producto incrementa totalInsumos y conProductos', () => {
    // Simular estructura de datos
    const proveedores = [
      { id: 'p1', nombre: 'Pool', calificacion: 5 },
      { id: 'p2', nombre: 'Alpina', calificacion: 4 },
      { id: 'p3', nombre: 'Nuevo', calificacion: 5 }, // sin productos
    ];
    const preciosPorProveedor: Record<string, any[]> = {
      'p1': [{ id: '1' }, { id: '2' }],  // 2 productos
      'p2': [{ id: '3' }],                // 1 producto
      'p3': [],                            // sin productos
    };

    // Calcular KPIs (misma lógica que Proveedores.tsx)
    const totalInsumos = proveedores.reduce((acc, p) =>
      acc + (preciosPorProveedor[p.id]?.length || 0), 0);
    const conProductos = proveedores.filter(p =>
      (preciosPorProveedor[p.id]?.length || 0) > 0).length;
    const sinProductos = proveedores.length - conProductos;
    const promedioRating = proveedores.reduce((s, p) =>
      s + (p.calificacion || 5), 0) / proveedores.length;

    expect(totalInsumos).toBe(3);     // 2 + 1 + 0
    expect(conProductos).toBe(2);     // Pool y Alpina
    expect(sinProductos).toBe(1);     // Nuevo
    expect(promedioRating).toBeCloseTo(4.67, 1);  // (5+4+5)/3

    // Agregar producto a p3
    preciosPorProveedor['p3'].push({ id: '4' });
    const nuevoTotal = proveedores.reduce((acc, p) =>
      acc + (preciosPorProveedor[p.id]?.length || 0), 0);
    const nuevoConProductos = proveedores.filter(p =>
      (preciosPorProveedor[p.id]?.length || 0) > 0).length;

    expect(nuevoTotal).toBe(4);          // +1
    expect(nuevoConProductos).toBe(3);   // ahora todos tienen
  });
});
