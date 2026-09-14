import { describe, it, expect } from 'vitest';

// ────────────────────────────────────────────────────────────────────
// QA Shield — Agente Forense OCR v3.0
// Verifica: parsearDimensiones + extracción tipo1_dimensiones
//
// REGLA CLAVE (QA-01):
//   Formato A*B*Cg  →  B = cantidadEmbalaje (SIEMPRE unidades por pack)
//   Columna CANTIDAD (inicio de línea) → stockRecibido (cajas compradas)
//   El número A (40) NUNCA debe convertirse en stockRecibido
// ────────────────────────────────────────────────────────────────────

/** Replica exacta de parsearDimensiones en ocr-service.ts
 *  A = primero = cantidadBulto (referencia, va a notas)
 *  B = medio   = cantidadEmbalaje (SIEMPRE unidades por embalaje)
 *  Cg = gramaje → se agrega al nombre del producto
 */
function parsearDimensiones(descripcion: string): {
  nombre: string;
  gramaje: string;
  cantidadEmbalaje: number;
  cantidadBulto: number;
} {
  // Patrón NOMBRE A*B*Cg  (con gramaje)
  const m3 = descripcion.match(
    /^(.+?)\s+(\d+)\*(\d+)\*(\d+(?:[.,]\d+)?[gGkKmMlLkK]{0,3})\s*$/i
  );
  if (m3) {
    return {
      nombre: m3[1].trim(),
      gramaje: m3[4],
      cantidadEmbalaje: parseInt(m3[3]), // B = MEDIO = unidades por pack
      cantidadBulto: parseInt(m3[2]),    // A = PRIMERO = referencia bulto
    };
  }

  // Patrón NOMBRE A*B  (sin gramaje)
  const m2 = descripcion.match(/^(.+?)\s+(\d+)\*(\d+)\s*$/);
  if (m2) {
    return {
      nombre: m2[1].trim(),
      gramaje: '',
      cantidadEmbalaje: parseInt(m2[3]), // B = segundo número
      cantidadBulto: parseInt(m2[2]),    // A = primero
    };
  }

  // Sin dimensiones — fallback
  return { nombre: descripcion.trim(), gramaje: '', cantidadEmbalaje: 1, cantidadBulto: 1 };
}

/** normalizarPrecio: extrae número limpio de string colombiano */
function normalizarPrecio(raw: string): number {
  if (!raw) return 0;
  // Puntos como separador de miles (166.667 → 166667), coma decimal (3,8 → 3.8)
  const limpio = raw.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

/** Replica de la extracción tipo1_dimensiones para una sola línea.
 *  Misma lógica que ocr-service.ts → extraerProductosForense → tipo1_dimensiones.
 *
 *  Flujo:
 *    1. Si no tiene patrón A*B → null (no es línea de producto)
 *    2. Precio = último número al final de la línea
 *    3. CANTIDAD = primer número AISLADO al inicio → stockRecibido
 *    4. Descripción = lo que queda entre CANTIDAD y precio
 *    5. parsearDimensiones(desc) → extrae B como cantidadEmbalaje
 */
function extraerLineaTipo1(linea: string): {
  nombre: string;
  gramaje: string;
  cantidadEmbalaje: number;
  cantidadBulto: number;
  stockRecibido: number;
  precioCosto: number;
  notasExtra: string;
} | null {
  // Filtro: solo líneas con patrón de dimensiones
  if (!/\d+\*\d+/.test(linea)) return null;

  // Precio: último número al final de la línea
  const precioM = linea.match(/\s+(\d[\d.,]*\d)\s*$/);
  const precioCosto = precioM ? normalizarPrecio(precioM[1]) : 0;

  // CANTIDAD de cajas: primer número AISLADO al inicio (columna separada)
  const cantM = linea.match(/^\s*(\d+)\s+/);
  const stockRecibido = cantM ? parseInt(cantM[1]) : 1; // default 1 si no hay columna

  // Descripción: quitar CANTIDAD del inicio y precio del final
  const desc = linea
    .replace(/^\s*\d+\s+/, '')            // remover CANTIDAD inicial
    .replace(precioM?.[0] || '', '')      // remover precio final
    .trim();

  const dim = parsearDimensiones(desc);
  const nombre = dim.gramaje ? `${dim.nombre} ${dim.gramaje}` : dim.nombre;
  if (nombre.length < 3) return null;

  // A (cantidadBulto) va SOLO a notas como referencia — nunca a stockRecibido
  const notasExtra =
    dim.cantidadBulto > 1
      ? `${dim.cantidadBulto} und/bulto · ${dim.cantidadEmbalaje} und/pack`
      : '';

  return { nombre, gramaje: dim.gramaje, cantidadEmbalaje: dim.cantidadEmbalaje, cantidadBulto: dim.cantidadBulto, stockRecibido, precioCosto, notasExtra };
}

// ════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════

describe('parsearDimensiones — extracción A*B*Cg', () => {
  it('CHICLE BUBBALOO FRESA 40*30*3.8g → cantidadEmbalaje=30 (B), cantidadBulto=40 (A)', () => {
    const r = parsearDimensiones('CHICLE BUBBALOO FRESA 40*30*3.8g');
    expect(r.cantidadEmbalaje).toBe(30);  // B = MEDIO = unidades por pack
    expect(r.cantidadBulto).toBe(40);     // A = PRIMERO = referencia bulto
    expect(r.gramaje).toBe('3.8g');
    expect(r.nombre).toBe('CHICLE BUBBALOO FRESA');
  });

  it('GALLETA OREO 12*12*36g → cantidadEmbalaje=12, cantidadBulto=12', () => {
    const r = parsearDimensiones('GALLETA OREO 12*12*36g');
    expect(r.cantidadEmbalaje).toBe(12);
    expect(r.cantidadBulto).toBe(12);
    expect(r.gramaje).toBe('36g');
    expect(r.nombre).toBe('GALLETA OREO');
  });

  it('TRIDENT SPLASH 2S 10*12 (sin gramaje) → cantidadEmbalaje=12 (B), cantidadBulto=10 (A)', () => {
    const r = parsearDimensiones('TRIDENT SPLASH 2S 10*12');
    expect(r.cantidadEmbalaje).toBe(12); // B = segundo número
    expect(r.cantidadBulto).toBe(10);    // A = primero
    expect(r.gramaje).toBe('');
    expect(r.nombre).toBe('TRIDENT SPLASH 2S');
  });

  it('HARINA TRIGO (sin dims) → cantidadEmbalaje=1, cantidadBulto=1 (fallback)', () => {
    const r = parsearDimensiones('HARINA TRIGO');
    expect(r.cantidadEmbalaje).toBe(1);
    expect(r.cantidadBulto).toBe(1);
    expect(r.gramaje).toBe('');
    expect(r.nombre).toBe('HARINA TRIGO');
  });

  it('B (medio) es DIFERENTE al A cuando A≠B: 40*30 → embalaje=30, bulto=40', () => {
    const r = parsearDimensiones('CHICLE BUBBALOO FRESA 40*30*3.8g');
    // Verificar que NO se invirtieron los roles
    expect(r.cantidadEmbalaje).not.toBe(r.cantidadBulto);
    expect(r.cantidadEmbalaje).toBe(30); // NO 40
    expect(r.cantidadBulto).toBe(40);    // NO 30
  });

  it('gramaje con coma decimal: 7*24*330ml → embalaje=24, gramaje="330ml"', () => {
    const r = parsearDimensiones('JUGO HIT 7*24*330ml');
    expect(r.cantidadEmbalaje).toBe(24);
    expect(r.cantidadBulto).toBe(7);
    expect(r.gramaje).toBe('330ml');
    expect(r.nombre).toBe('JUGO HIT');
  });
});

describe('QA-01 CRÍTICO — stockRecibido viene de columna CANTIDAD, NUNCA del A en A*B*Cg', () => {
  it('línea con CANTIDAD=3: stockRecibido=3 (no 40)', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r).not.toBeNull();
    expect(r!.stockRecibido).toBe(3);         // columna CANTIDAD al inicio de línea
    expect(r!.stockRecibido).not.toBe(40);    // NUNCA tomar A como stock
  });

  it('cantidadEmbalaje siempre es 30 (B) aunque CANTIDAD sea 3', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.cantidadEmbalaje).toBe(30); // B del formato
    expect(r!.cantidadEmbalaje).not.toBe(3);  // no confundir con stockRecibido
  });

  it('línea SIN cantidad al inicio: stockRecibido=1 (default, NUNCA 40)', () => {
    const r = extraerLineaTipo1('CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r).not.toBeNull();
    expect(r!.stockRecibido).toBe(1);      // default correcto
    expect(r!.stockRecibido).not.toBe(40); // 40 es parte de descripción, no cajas
  });

  it('cantidadEmbalaje=30 sin importar si hay o no CANTIDAD en la línea', () => {
    const conCantidad = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    const sinCantidad = extraerLineaTipo1('CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(conCantidad!.cantidadEmbalaje).toBe(30);
    expect(sinCantidad!.cantidadEmbalaje).toBe(30);
  });

  it('CANTIDAD=5 distinta al A=40: cada una va a su campo correcto', () => {
    const r = extraerLineaTipo1('5  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.stockRecibido).toBe(5);
    expect(r!.cantidadBulto).toBe(40);
    expect(r!.cantidadEmbalaje).toBe(30);
  });
});

describe('extracción tipo1_dimensiones — integración nombre + notas + precio', () => {
  it('nombre final incluye gramaje: "CHICLE BUBBALOO FRESA 3.8g"', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.nombre).toBe('CHICLE BUBBALOO FRESA 3.8g');
  });

  it('notasExtra documenta A y B como referencia: "40 und/bulto · 30 und/pack"', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.notasExtra).toBe('40 und/bulto · 30 und/pack');
  });

  it('precioCosto extraído del final de línea: 166667', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.precioCosto).toBe(166667);
  });

  it('cantidadBulto (A) se preserva para generar las notas', () => {
    const r = extraerLineaTipo1('3  CHICLE BUBBALOO FRESA 40*30*3.8g  166667');
    expect(r!.cantidadBulto).toBe(40);
  });

  it('GALLETA OREO: precio=85000, stockRecibido=2, embalaje=12', () => {
    const r = extraerLineaTipo1('2  GALLETA OREO 12*12*36g  85000');
    expect(r).not.toBeNull();
    expect(r!.stockRecibido).toBe(2);
    expect(r!.cantidadEmbalaje).toBe(12);
    expect(r!.precioCosto).toBe(85000);
    expect(r!.nombre).toBe('GALLETA OREO 36g');
  });

  it('línea sin patrón A*B retorna null (no es producto con dimensiones)', () => {
    expect(extraerLineaTipo1('HARINA TRIGO  3500')).toBeNull();
    expect(extraerLineaTipo1('5  HARINA TRIGO  3500')).toBeNull();
    expect(extraerLineaTipo1('SUBTOTAL  1250000')).toBeNull();
  });
});
