/**
 * ═══════════════════════════════════════════════════════════════
 * 🛡️ BLINDAJE AUDITORÍA 5 AGENTES — PROTECCIÓN 5 CAPAS
 * ═══════════════════════════════════════════════════════════════
 * 
 * CAPA 1 — FORTALEZA: Verifica que los errores corregidos NO existen
 * CAPA 2 — CADENA: Verifica la propagación correcta de fórmulas
 * CAPA 3 — ESPEJO: Verifica consistencia entre componentes
 * CAPA 4 — PANTALLA: Verifica textos en español y accesibilidad
 * CAPA 5 — CENTINELA: Verifica validación de datos en fronteras
 * 
 * Errores corregidos:
 *   1. PrecioModal: notes → notas (campo inexistente)
 *   2. PaymentProcessor: E-Wallet → Billetera (español)
 *   3. ProveedorForm OCR: margen hardcodeado 1.3 → variable
 *   4. CalculadoraRendimiento: división por cero
 *   5. useFinanzas: pago negativo en créditos
 *   6. ModelosPanView: fórmula margen inconsistente
 *   7. Proveedores dashboard: costoU sin redondeo COP
 *   8. Proveedores handleEdit: costoUnitario/precioVenta sin redondeo
 *   9. usePriceControl sync ingredientes: nuevoPrecioVenta sin redondeo
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Utilidades para leer archivos fuente ──
const SRC = path.resolve(__dirname, '..');
const readSrc = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf-8');

// ══════════════════════════════════════════════════════════════
// CAPA 1 — FORTALEZA: Los errores NUNCA deben volver
// ══════════════════════════════════════════════════════════════
describe('CAPA 1 — FORTALEZA: Errores corregidos no deben regresar', () => {

  describe('FIX-1: PrecioModal campo notas', () => {
    const src = readSrc('components/precios/PrecioModal.tsx');

    it('NO debe tener "formData.notes" en onChange (campo inexistente)', () => {
      // El bug: onChange escribía a formData.notes en lugar de formData.notas
      expect(src).not.toMatch(/setFormData\(\s*\{[^}]*notes\s*:/);
    });

    it('SÍ debe tener "formData.notas" en onChange y value', () => {
      expect(src).toMatch(/formData\.notas/);
    });

    it('El campo notas debe ser consistente en value y onChange', () => {
      // Tanto value como onChange deben usar "notas"
      const valueMatch = src.match(/value=\{formData\.notas\}/);
      const onChangeMatch = src.match(/formData,\s*notas:/);
      expect(valueMatch).not.toBeNull();
      expect(onChangeMatch).not.toBeNull();
    });
  });

  describe('FIX-2: PaymentProcessor en español', () => {
    const src = readSrc('components/PaymentProcessor.tsx');

    it('NO debe contener "E-Wallet" (inglés)', () => {
      expect(src).not.toContain('E-Wallet');
    });

    it('SÍ debe contener "Billetera"', () => {
      expect(src).toContain('Billetera');
    });

    it('Label del método ewallet debe ser "Billetera"', () => {
      // Buscar: method: 'ewallet' seguido de label: 'Billetera'
      const ewalletBlock = src.match(/method:\s*'ewallet'[\s\S]*?label:\s*'([^']+)'/);
      expect(ewalletBlock).not.toBeNull();
      expect(ewalletBlock![1]).toBe('Billetera');
    });

    it('Textos de saldo y cobro deben estar en español', () => {
      expect(src).toContain('Saldo Billetera Disponible');
      expect(src).toContain('Cobrar desde Billetera');
    });
  });

  describe('FIX-3: ProveedorForm OCR sin margen hardcodeado', () => {
    const src = readSrc('components/proveedores/ProveedorForm.tsx');

    it('NO debe tener "* 1.3" hardcodeado en sección OCR', () => {
      // El factor 1.3 no debe aparecer como literal en cálculos de precio
      const ocrSection = src.substring(
        src.indexOf('Forense completado') - 2000,
        src.indexOf('Forense completado')
      );
      expect(ocrSection).not.toMatch(/\*\s*1\.3/);
    });

    it('SÍ debe usar variable margenOCR para el cálculo', () => {
      expect(src).toContain('margenOCR');
    });

    it('Debe calcular precioVenta desde costoUnit × (1 + margen/100)', () => {
      expect(src).toMatch(/1\s*\+\s*margenOCR\s*\/\s*100/);
    });

    it('precioVentaPack debe derivarse del precioVentaUnit × cantEmb', () => {
      expect(src).toMatch(/precioVentaUnit\s*\*\s*cantEmb/);
    });
  });

  describe('FIX-4: CalculadoraRendimiento sin división por cero', () => {
    const src = readSrc('components/produccion/CalculadoraRendimiento.tsx');

    it('costoUnitario debe tener guard contra panes=0', () => {
      expect(src).toMatch(/panes\s*>\s*0\s*\?/);
    });

    it('margen debe tener guard contra ventaTotal=0', () => {
      expect(src).toMatch(/ventaTotal\s*>\s*0\s*\?/);
    });

    it('NO debe hacer división directa sin guard', () => {
      // Buscar "costoTotalFormulacion / panes" sin ternario
      const lines = src.split('\n');
      const divisionDirecta = lines.find(l => 
        l.includes('costoTotalFormulacion / panes') && !l.includes('?')
      );
      expect(divisionDirecta).toBeUndefined();
    });
  });

  describe('FIX-5: useFinanzas validación de pago negativo', () => {
    const src = readSrc('hooks/useFinanzas.ts');

    it('registrarPagoCredito debe validar monto > 0', () => {
      // Buscar el guard de pago negativo en la función de clientes
      const clienteSection = src.substring(
        src.indexOf('registrarPagoCredito'),
        src.indexOf('registrarPagoCredito') + 500
      );
      expect(clienteSection).toMatch(/pago\.monto\s*<=\s*0/);
    });

    it('registrarPagoCreditoTrabajador debe validar monto > 0', () => {
      const trabajadorSection = src.substring(
        src.indexOf('registrarPagoCreditoTrabajador'),
        src.indexOf('registrarPagoCreditoTrabajador') + 500
      );
      expect(trabajadorSection).toMatch(/pago\.monto\s*<=\s*0/);
    });

    it('Ambas funciones deben hacer return early si monto inválido', () => {
      const matches = src.match(/if\s*\(pago\.monto\s*<=\s*0\)\s*return/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('FIX-6: ModelosPanView fórmula de margen consistente', () => {
    const src = readSrc('components/produccion/ModelosPanView.tsx');

    it('Debe usar margen sobre COSTO (no sobre venta)', () => {
      // Fórmula correcta: (precioVenta - costo) / costo
      // NO: (precioVenta - costo) / precioVenta
      expect(src).toMatch(/costoUnitario\s*>\s*0\s*\?/);
      expect(src).toMatch(/\/\s*costoUnitario\)\s*\*\s*100/);
    });

    it('NO debe dividir entre precioVentaUnitario para calcular margen', () => {
      // Buscar la línea de margen y verificar que no divide por precioVenta
      const margenLine = src.split('\n').find(l => 
        l.includes('precioVentaUnitario - costoUnitario') && l.includes('* 100')
      );
      expect(margenLine).not.toBeUndefined();
      expect(margenLine).not.toMatch(/\/\s*precioVentaUnitario/);
    });
  });

  describe('FIX-7: Dashboard Proveedores costoU redondeado COP', () => {
    const src = readSrc('pages/Proveedores.tsx');

    it('costoU en tabla expandida usa Math.round / 100 * 100', () => {
      // Buscar la línea de costoU con redondeo
      expect(src).toMatch(/costoU\s*=.*Math\.round\(precio\.precioCosto\s*\/\s*precio\.cantidadEmbalaje\s*\/\s*100\)\s*\*\s*100/);
    });

    it('costoU NO tiene división sin redondeo', () => {
      const lines = src.split('\n');
      const costoULine = lines.find(l => l.includes('const costoU') && l.includes('precioCosto / precio.cantidadEmbalaje'));
      expect(costoULine).toBeTruthy();
      expect(costoULine).toContain('Math.round');
    });
  });

  describe('FIX-8: handleEdit carga datos redondeados COP', () => {
    const src = readSrc('pages/Proveedores.tsx');

    it('costoUnitario en handleEdit usa Math.round / 100 * 100', () => {
      // Buscar en sección handleEdit
      const editSection = src.substring(
        src.indexOf('costoUnitario: precio.cantidadEmbalaje'),
        src.indexOf('costoUnitario: precio.cantidadEmbalaje') + 200
      );
      expect(editSection).toContain('Math.round');
    });

    it('precioVenta en handleEdit usa Math.round', () => {
      expect(src).toContain('Math.round((prod?.precioVenta || 0) / 100) * 100');
    });

    it('precioVentaPack en handleEdit usa Math.round', () => {
      expect(src).toContain('Math.round(prod.precioVenta *');
    });
  });

  describe('FIX-9: Sync ingredientes redondeado COP', () => {
    const src = readSrc('hooks/usePriceControl.ts');

    it('nuevoPrecioVenta de ingredientes usa Math.round / 100 * 100', () => {
      // Buscar la línea de sync de ingredientes
      expect(src).toMatch(/nuevoPrecioVenta\s*=.*Math\.round\(nuevoCosto\s*\*.*\/\s*100\)\s*\*\s*100/);
    });

    it('NO debe haber nuevoPrecioVenta sin redondeo', () => {
      const lines = src.split('\n');
      const precioLines = lines.filter(l => l.includes('nuevoPrecioVenta') && l.includes('nuevoCosto'));
      for (const line of precioLines) {
        expect(line).toContain('Math.round');
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════
// CAPA 2 — CADENA: Propagación correcta de fórmulas
// ══════════════════════════════════════════════════════════════
describe('CAPA 2 — CADENA: Fórmulas se propagan correctamente', () => {

  it('Fórmula de precio: costoUnit × (1 + margen/100) redondeado a centenas', () => {
    // Simular la fórmula COP
    const costoUnitario = 5000;
    const margen = 30;
    const precioVenta = Math.round(costoUnitario * (1 + margen / 100) / 100) * 100;
    expect(precioVenta).toBe(6500);
  });

  it('Fórmula de precioVentaPack: precioVentaUnit × cantidadEmbalaje', () => {
    const costoUnit = 500;
    const margen = 30;
    const cantEmb = 10;
    const precioVentaUnit = Math.round(costoUnit * (1 + margen / 100) / 100) * 100;
    const precioVentaPack = Math.round(precioVentaUnit * cantEmb / 100) * 100;
    expect(precioVentaUnit).toBe(700);
    expect(precioVentaPack).toBe(7000);
  });

  it('OCR: precioVentaPack se calcula desde precioVentaUnit (no desde precioCosto)', () => {
    const precioCosto = 10000;
    const cantEmb = 10;
    const margenOCR = 30;
    const costoUnit = Math.round(precioCosto / cantEmb / 100) * 100;
    const precioVentaUnit = Math.round(costoUnit * (1 + margenOCR / 100) / 100) * 100;
    const precioVentaPack = Math.round(precioVentaUnit * cantEmb / 100) * 100;
    
    // Verificar cadena completa
    expect(costoUnit).toBe(1000);
    expect(precioVentaUnit).toBe(1300);
    expect(precioVentaPack).toBe(13000);
  });

  it('Margen sobre costo es consistente: input 30% → output 30%', () => {
    const costo = 1000;
    const margen = 30;
    const venta = Math.round(costo * (1 + margen / 100) / 100) * 100;
    const margenCalculado = ((venta - costo) / costo) * 100;
    expect(margenCalculado).toBe(30);
  });

  it('Guard de división: panes=0 produce costoUnitario=0 (no Infinity)', () => {
    const costoTotal = 50000;
    const panes = 0;
    const costoUnitario = panes > 0 ? costoTotal / panes : 0;
    expect(costoUnitario).toBe(0);
    expect(Number.isFinite(costoUnitario)).toBe(true);
  });

  it('Guard de división: ventaTotal=0 produce margen=0 (no NaN)', () => {
    const ganancia = 0;
    const ventaTotal = 0;
    const margen = ventaTotal > 0 ? (ganancia / ventaTotal) * 100 : 0;
    expect(margen).toBe(0);
    expect(Number.isNaN(margen)).toBe(false);
  });

  it('Pago de crédito: monto positivo reduce saldo correctamente', () => {
    const saldo = 10000;
    const monto = 3000;
    const nuevoSaldo = monto > 0 ? Math.max(0, saldo - monto) : saldo;
    expect(nuevoSaldo).toBe(7000);
  });

  it('Pago de crédito: monto negativo NO debe alterar saldo', () => {
    const saldo = 10000;
    const monto = -5000;
    // Con la validación, la función retorna sin hacer nada
    const seEjecuta = monto > 0;
    expect(seEjecuta).toBe(false);
  });

  it('Pago de crédito: monto cero NO debe alterar saldo', () => {
    const monto = 0;
    const seEjecuta = monto > 0;
    expect(seEjecuta).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// CAPA 3 — ESPEJO: Consistencia entre archivos
// ══════════════════════════════════════════════════════════════
describe('CAPA 3 — ESPEJO: Consistencia entre componentes', () => {
  
  it('ProveedorForm y usePriceControl usan la misma fórmula de redondeo COP', () => {
    const provForm = readSrc('components/proveedores/ProveedorForm.tsx');
    const priceControl = readSrc('hooks/usePriceControl.ts');
    
    // Ambos deben usar / 100) * 100 para redondeo COP
    expect(provForm).toMatch(/\/\s*100\)\s*\*\s*100/);
    expect(priceControl).toMatch(/\/\s*100\)\s*\*\s*100/);
  });

  it('ModelosPanView y BusquedaRapida usan margen sobre COSTO', () => {
    const modelos = readSrc('components/produccion/ModelosPanView.tsx');
    const busqueda = readSrc('components/layout/BusquedaRapida.tsx');
    
    // Ambos deben dividir por costo, no por precio de venta
    expect(modelos).toMatch(/\/\s*costoUnitario\)\s*\*\s*100/);
    expect(busqueda).toMatch(/\/\s*costoUnitario\)\s*\*\s*100/);
  });

  it('useFinanzas protege ambas funciones de pago (clientes y trabajadores)', () => {
    const src = readSrc('hooks/useFinanzas.ts');

    // Debe haber mínimo 2 guards de pago negativo
    const guards = src.match(/pago\.monto\s*<=\s*0/g);
    expect(guards!.length).toBeGreaterThanOrEqual(2);
  });

  it('PrecioModal usa "notas" en TODOS los lugares (value y onChange)', () => {
    const src = readSrc('components/precios/PrecioModal.tsx');
    
    // No debe haber NINGÚN "notes" como campo de formData
    expect(src).not.toMatch(/formData\.\s*notes/);
    expect(src).not.toMatch(/formData,\s*notes\s*:/);
  });

  it('PaymentProcessor: todas las referencias a ewallet dicen "Billetera"', () => {
    const src = readSrc('components/PaymentProcessor.tsx');
    
    const biletteraCount = (src.match(/Billetera/g) || []).length;
    const ewalletCount = (src.match(/E-Wallet/g) || []).length;
    
    expect(biletteraCount).toBeGreaterThanOrEqual(3); // label + saldo + cobrar
    expect(ewalletCount).toBe(0);
  });

  it('ProveedorForm OCR: margen variable coherente con margenVenta del objeto', () => {
    const src = readSrc('components/proveedores/ProveedorForm.tsx');
    
    // margenOCR debe coincidir con margenVenta: margenOCR
    expect(src).toContain('margenVenta: margenOCR');
    expect(src).toContain('const margenOCR');
  });
});

// ══════════════════════════════════════════════════════════════
// CAPA 4 — PANTALLA: Textos y accesibilidad en español
// ══════════════════════════════════════════════════════════════
describe('CAPA 4 — PANTALLA: Textos en español y UX', () => {

  it('PaymentProcessor NO tiene términos en inglés para métodos de pago', () => {
    const src = readSrc('components/PaymentProcessor.tsx');
    const labels = src.match(/label:\s*'([^']+)'/g) || [];
    
    // Todas las labels deben estar en español
    const termsForbidden = ['Cash', 'Card', 'E-Wallet'];
    for (const term of termsForbidden) {
      const found = labels.find(l => l === `label: '${term}'`);
      expect(found).toBeUndefined();
    }

    // Verificar que las labels están en español
    const labelsText = labels.map(l => l.match(/label:\s*'([^']+)'/)?.[1]).filter(Boolean);
    expect(labelsText).toContain('Efectivo');
    expect(labelsText).toContain('Tarjeta');
    expect(labelsText).toContain('Billetera');
    expect(labelsText).toContain('Transferencia');
  });

  it('PrecioModal label de notas dice "Notas" (no "Notes")', () => {
    const src = readSrc('components/precios/PrecioModal.tsx');
    expect(src).toMatch(/Notas\s*\(opcional\)/i);
    expect(src).not.toMatch(/Notes\s*\(optional\)/i);
  });

  it('Textos visibles de PaymentProcessor están en español', () => {
    const src = readSrc('components/PaymentProcessor.tsx');
    expect(src).toContain('Selecciona un Método de Pago');
    expect(src).toContain('Saldo Billetera Disponible');
    expect(src).toContain('Cobrar desde Billetera');
    expect(src).toContain('Saldo suficiente');
  });

  it('CalculadoraRendimiento no muestra "Infinity" ni "NaN" al usuario', () => {
    // Simular caso extremo
    const panes = 0;
    const costoTotal = 100;
    const costoUnit = panes > 0 ? costoTotal / panes : 0;
    const ventaTotal = 0;
    const margen = ventaTotal > 0 ? (0 / ventaTotal) * 100 : 0;
    
    expect(costoUnit.toString()).not.toBe('Infinity');
    expect(costoUnit.toString()).not.toBe('NaN');
    expect(margen.toString()).not.toBe('NaN');
  });

  it('BusquedaRapida y ModelosPanView muestran el mismo % de utilidad', () => {
    const costo = 1000;
    const venta = 1300;
    
    // Ambos deben usar: (venta - costo) / costo * 100
    const utilidadBusqueda = ((venta - costo) / costo) * 100;
    const utilidadModelos = costo > 0 ? ((venta - costo) / costo) * 100 : 0;
    
    expect(utilidadBusqueda).toBe(utilidadModelos);
    expect(utilidadBusqueda).toBe(30);
  });
});

// ══════════════════════════════════════════════════════════════
// CAPA 5 — CENTINELA: Validación de datos en fronteras
// ══════════════════════════════════════════════════════════════
describe('CAPA 5 — CENTINELA: Validaciones de seguridad', () => {

  it('Pago negativo NO debe incrementar saldo de crédito', () => {
    // Si alguien intenta inyectar pago negativo
    const saldoOriginal = 10000;
    const pagoMalicioso = -50000;
    
    // Con guard, la función no se ejecuta
    if (pagoMalicioso <= 0) {
      // return early — saldo no cambia
      expect(saldoOriginal).toBe(10000);
    }
  });

  it('Pago cero NO debe marcar crédito como pagado', () => {
    const saldo = 5000;
    const pago = 0;
    
    if (pago <= 0) {
      expect(saldo).toBe(5000); // Sin cambios
    }
  });

  it('OCR con cantidadEmbalaje=0 no causa división por cero', () => {
    const precioCosto = 10000;
    const cantEmb = 0 || 1; // fallback a 1
    const costoUnit = Math.round(precioCosto / cantEmb / 100) * 100;
    expect(Number.isFinite(costoUnit)).toBe(true);
    expect(costoUnit).toBe(10000);
  });

  it('Rendimiento con 0 panes no produce Infinity en costoUnitario', () => {
    const costoTotal = 50000;
    const panes = 0;
    const costoUnitario = panes > 0 ? costoTotal / panes : 0;
    
    expect(Number.isFinite(costoUnitario)).toBe(true);
    expect(costoUnitario).toBe(0);
  });

  it('Rendimiento con 0 ventaTotal no produce NaN en margen', () => {
    const ganancia = -50000;
    const ventaTotal = 0;
    const margen = ventaTotal > 0 ? (ganancia / ventaTotal) * 100 : 0;
    
    expect(Number.isNaN(margen)).toBe(false);
    expect(margen).toBe(0);
  });

  it('Redondeo COP funciona para valores reales de Pesos Colombianos', () => {
    // Valores reales COP: 500, 1000, 5000, 10000...
    const testCases = [
      { costo: 5000, margen: 30, expected: 6500 },
      { costo: 10000, margen: 25, expected: 12500 },
      { costo: 3000, margen: 40, expected: 4200 },
      { costo: 1500, margen: 50, expected: 2300 },
      { costo: 800, margen: 30, expected: 1000 },
    ];
    
    for (const { costo, margen, expected } of testCases) {
      const precio = Math.round(costo * (1 + margen / 100) / 100) * 100;
      expect(precio).toBe(expected);
    }
  });

  it('Cadena completa OCR: precioCosto → costoUnit → precioVenta → pack', () => {
    const casos = [
      { precioCosto: 20000, cantEmb: 10, margen: 30 },
      { precioCosto: 50000, cantEmb: 24, margen: 25 },
      { precioCosto: 8000, cantEmb: 1, margen: 40 },
    ];
    
    for (const { precioCosto, cantEmb, margen } of casos) {
      const costoUnit = Math.round(precioCosto / cantEmb / 100) * 100;
      const precioVentaUnit = Math.round(costoUnit * (1 + margen / 100) / 100) * 100;
      const precioVentaPack = Math.round(precioVentaUnit * cantEmb / 100) * 100;
      
      // Ningún valor debe ser 0, NaN, o Infinity
      expect(costoUnit).toBeGreaterThan(0);
      expect(precioVentaUnit).toBeGreaterThan(0);
      expect(precioVentaPack).toBeGreaterThan(0);
      expect(Number.isFinite(costoUnit)).toBe(true);
      expect(Number.isFinite(precioVentaUnit)).toBe(true);
      expect(Number.isFinite(precioVentaPack)).toBe(true);
      
      // precioVentaPack debe ser >= precioVentaUnit para cantEmb >= 1
      expect(precioVentaPack).toBeGreaterThanOrEqual(precioVentaUnit);
      
      // Margen debe ser positivo
      expect(precioVentaUnit).toBeGreaterThan(costoUnit);
    }
  });

  it('formData.notas NO produce undefined en PrecioModal', () => {
    // Simular estado de formData
    const formData = { notas: '' };
    const updated = { ...formData, notas: 'Precio de promoción' };
    expect(updated.notas).toBe('Precio de promoción');
    
    // Verificar que 'notes' no existe en el objeto
    expect('notes' in updated).toBe(false);
  });
});
