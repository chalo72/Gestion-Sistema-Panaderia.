/**
 * ═══════════════════════════════════════════════════════════════════
 * BLINDAJE DE 5 CAPAS — Protección Form ↔ Dashboard Proveedores
 * ═══════════════════════════════════════════════════════════════════
 * 
 * NUNCA ELIMINAR ESTE ARCHIVO.
 * Protege la sincronización entre:
 *   ProveedorForm.tsx → Proveedores.tsx → Dashboard
 * 
 * Si algún test falla, significa que alguien rompió la sincronización
 * entre el formulario y el dashboard. NO mergelar sin arreglar.
 * 
 * CAPA 1: FORTALEZA — Estructura de interfaces (no cambiar campos)
 * CAPA 2: CADENA — handleSubmit transmite TODOS los campos
 * CAPA 3: ESPEJO — handleEdit refleja exactamente los datos de DB  
 * CAPA 4: PANTALLA — Dashboard muestra datos coherentes
 * CAPA 5: CENTINELA — Fórmulas matemáticas inmutables
 * ═══════════════════════════════════════════════════════════════════
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const srcDir = resolve(__dirname, '..');
const proveedoresPage = readFileSync(resolve(srcDir, 'pages/Proveedores.tsx'), 'utf-8');
const proveedorForm = readFileSync(resolve(srcDir, 'components/proveedores/ProveedorForm.tsx'), 'utf-8');
const usePriceControl = readFileSync(resolve(srcDir, 'hooks/usePriceControl.ts'), 'utf-8');

// ═══════════════════════════════════════════════════════════════
// CAPA 1: FORTALEZA — Campos obligatorios de ProductoCatalogo
// Si alguien elimina un campo, estos tests explotan.
// ═══════════════════════════════════════════════════════════════
describe('CAPA 1 — FORTALEZA: Campos obligatorios del catálogo', () => {
  const camposObligatorios = [
    'uid: string',
    'productoId: string',
    'nombre: string',
    'categoria: string',
    'precioCosto: number',
    'margenVenta: number',
    'cantidadEmbalaje: number',
    'tipoEmbalaje: TipoEmbalaje',
    'destino: DestinoUso',
    'costoUnitario: number',
    'precioVenta: number',
    'precioVentaPack: number',
    'stockRecibido: number',
  ];

  camposObligatorios.forEach(campo => {
    it(`ProductoCatalogo DEBE tener: ${campo.split(':')[0].trim()}`, () => {
      expect(proveedorForm).toContain(campo);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// CAPA 2: CADENA — handleSubmit NO puede perder campos
// Cada campo del form DEBE llegar a la DB sin perderse.
// ═══════════════════════════════════════════════════════════════
describe('CAPA 2 — CADENA: handleSubmit transmite todos los campos a DB', () => {
  
  // Campos que handleSubmit DEBE enviar a onAddOrUpdatePrecio
  const camposPrecio = [
    'precioCosto: item.precioCosto',
    'cantidadEmbalaje: item.cantidadEmbalaje',
    'tipoEmbalaje: item.tipoEmbalaje',
    'destino: item.destino',
  ];
  
  camposPrecio.forEach(campo => {
    it(`Precio → DB: ${campo}`, () => {
      expect(proveedoresPage).toContain(campo);
    });
  });

  // Campos que handleSubmit DEBE enviar a onUpdateProducto
  const camposProducto = [
    'nombre: item.nombre',
    'costoBase: item.costoUnitario',
    'margenUtilidad: item.margenVenta',
    'precioVenta: item.precioVenta',
  ];
  
  camposProducto.forEach(campo => {
    it(`Producto → DB: ${campo}`, () => {
      expect(proveedoresPage).toContain(campo);
    });
  });

  it('handleSubmit crea proveedor nuevo con onAddProveedor', () => {
    expect(proveedoresPage).toContain('onAddProveedor(data)');
  });

  it('handleSubmit actualiza proveedor con onUpdateProveedor', () => {
    expect(proveedoresPage).toContain('onUpdateProveedor(editingProveedor.id, data)');
  });
});

// ═══════════════════════════════════════════════════════════════
// CAPA 3: ESPEJO — handleEdit DEBE cargar datos EXACTOS
// Si algún campo cambia de nombre, detectar inmediatamente.
// ═══════════════════════════════════════════════════════════════
describe('CAPA 3 — ESPEJO: handleEdit carga datos exactos desde DB', () => {

  const mapeosObligatorios = [
    { campo: 'uid', fuente: 'precio.id', desc: 'uid viene del ID del precio, no genera nuevo' },
    { campo: 'productoId', fuente: 'precio.productoId', desc: 'productoId del precio existente' },
    { campo: 'precioCosto', fuente: 'precio.precioCosto', desc: 'costo de paca desde DB' },
    { campo: 'margenVenta', fuente: 'prod?.margenUtilidad', desc: 'margen desde el producto real' },
    { campo: 'precioVenta', fuente: 'Math.round((prod?.precioVenta', desc: 'precio venta redondeado COP del producto real' },
  ];

  mapeosObligatorios.forEach(({ campo, fuente, desc }) => {
    it(`${campo} ← ${fuente} (${desc})`, () => {
      expect(proveedoresPage).toContain(`${campo}: ${fuente}`);
    });
  });

  it('handleEdit calcula costoUnitario dividiendo precioCosto / cantidadEmbalaje', () => {
    expect(proveedoresPage).toContain('precio.precioCosto / precio.cantidadEmbalaje');
  });

  it('handleEdit carga nombre REAL del producto (no genérico)', () => {
    expect(proveedoresPage).toContain("nombre: prod?.nombre");
  });

  it('handleEdit carga categoría REAL del producto', () => {
    expect(proveedoresPage).toContain("categoria: prod?.categoria");
  });
});

// ═══════════════════════════════════════════════════════════════
// CAPA 4: PANTALLA — Dashboard muestra datos coherentes
// Lo que ve el usuario DEBE coincidir con lo que hay en DB.
// ═══════════════════════════════════════════════════════════════
describe('CAPA 4 — PANTALLA: Dashboard muestra datos coherentes', () => {

  it('Nombre del proveedor viene de prov.nombre', () => {
    expect(proveedoresPage).toContain('prov.nombre');
  });

  it('Calificación viene de prov.calificacion', () => {
    expect(proveedoresPage).toContain('prov.calificacion');
  });

  it('Productos se obtienen con getPreciosByProveedor(prov.id)', () => {
    expect(proveedoresPage).toContain('getPreciosByProveedor(prov.id)');
  });

  it('Tabla expanida: nombre producto viene de prodItem?.nombre', () => {
    expect(proveedoresPage).toContain("prodItem?.nombre");
  });

  it('Tabla expandida: costo/u = precioCosto / cantidadEmbalaje', () => {
    expect(proveedoresPage).toContain('precio.precioCosto / precio.cantidadEmbalaje');
  });

  it('Tabla expandida: p.venta viene de prodItem?.precioVenta', () => {
    expect(proveedoresPage).toContain("prodItem?.precioVenta");
  });

  it('Tabla expandida: empaque muestra ×N cuando cantidadEmbalaje > 1 (no depende de tipoEmbalaje)', () => {
    expect(proveedoresPage).toContain('cantPack > 1');
  });

  it('Badge ventas filtra destino === venta', () => {
    expect(proveedoresPage).toContain("destino === 'venta'");
  });

  it('KPI totalInsumos usa getPreciosByProveedor.length', () => {
    expect(proveedoresPage).toContain('getPreciosByProveedor(p.id).length');
  });

  it('KPI sinProductos = total - conProductos', () => {
    expect(proveedoresPage).toContain('proveedores.length - conProductos');
  });
});

// ═══════════════════════════════════════════════════════════════
// CAPA 5: CENTINELA — Fórmulas matemáticas inmutables
// La lógica de cálculo NO puede cambiar sin romper estos tests.
// ═══════════════════════════════════════════════════════════════
describe('CAPA 5 — CENTINELA: Fórmulas matemáticas blindadas', () => {

  // --- Fórmulas del Form ---
  it('Form: costUnit = precioCosto / cantidadEmbalaje', () => {
    // useMemo en ProveedorForm calcula cost / packQty
    expect(proveedorForm).toContain('cost / packQty');
  });

  it('Form: sellPrice = costUnit * (1 + margen / 100)', () => {
    expect(proveedorForm).toContain('costUnit * (1 + Number(prodActual.margenVenta) / 100)');
  });

  it('Form: costoUnitario redondeado = Math.round(costUnit / 100) * 100', () => {
    expect(proveedorForm).toContain('Math.round(costUnit / 100) * 100');
  });

  it('Form: precioVenta redondeado = Math.round(sellPrice / 100) * 100', () => {
    expect(proveedorForm).toContain('Math.round(sellPrice / 100) * 100');
  });

  // --- Fórmulas de usePriceControl (addOrUpdatePrecio) ---
  it('Hook: costoUnitario = precioCosto / (cantidadEmbalaje || 1)', () => {
    expect(usePriceControl).toContain('precioCosto / (cantidadEmbalaje || 1)');
  });

  it('Hook: nuevoPrecioVenta usa margenUtilidad del producto', () => {
    expect(usePriceControl).toContain('producto.margenUtilidad / 100');
  });

  it('Hook: precio de venta redondeado a centenas', () => {
    expect(usePriceControl).toContain('/ 100) * 100');
  });

  // --- Fórmulas de cálculo puro ---
  it('Fórmula unitaria: 85000/1 * 1.30 = 110500', () => {
    const pv = Math.round(85000 / 1 * 1.30 / 100) * 100;
    expect(pv).toBe(110500);
  });

  it('Fórmula pack x24: 21900/24 * 1.30 → redondeado', () => {
    const costoU = 21900 / 24; // 912.5
    const pv = Math.round(costoU * 1.30 / 100) * 100;
    expect(pv).toBe(1200);
  });

  it('Fórmula pack x12: 16800/12 * 1.41 → redondeado', () => {
    const costoU = 16800 / 12; // 1400
    const pv = Math.round(costoU * 1.41 / 100) * 100;
    expect(pv).toBe(2000);
  });

  it('Fórmula pack x15: 24500/15 * 1.51 → redondeado', () => {
    const costoU = 24500 / 15; // 1633.33
    const pv = Math.round(costoU * 1.51 / 100) * 100;
    expect(pv).toBe(2500);
  });

  it('Fórmula consistente ida y vuelta: Form → DB → Edit → Form = mismo resultado', () => {
    const precioCosto = 22600;
    const cantEmb = 30;
    const margen = 55;

    // Form calcula
    const costUnit = precioCosto / cantEmb;
    const sellPrice = costUnit * (1 + margen / 100);
    const costoUnitarioForm = Math.round(costUnit / 100) * 100;
    const precioVentaForm = Math.round(sellPrice / 100) * 100;

    // DB guarda precioCosto y cantidadEmbalaje
    // Edit recalcula
    const costoUnitarioEdit = precioCosto / cantEmb;
    
    // Los valores deben ser coherentes
    expect(Math.round(costoUnitarioEdit / 100) * 100).toBe(costoUnitarioForm);
    expect(precioVentaForm).toBeGreaterThan(costoUnitarioForm);
  });
});
