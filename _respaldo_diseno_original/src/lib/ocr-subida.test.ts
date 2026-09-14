import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Tests de subida de archivo de factura — Pipeline de procesamiento OCR
// Cubre el camino: archivo subido → texto OCR → normalización → productos
// Replica inline las funciones de ocr-service.ts (sin imports de la app)
// ─────────────────────────────────────────────────────────────────────────────

// ── Réplica: normalizarPrecio ────────────────────────────────────────────────
function normalizarPrecio(precio: string): number {
  if (!precio) return 0;
  let limpio = precio.replace(/\s/g, '');
  const tienePunto = limpio.includes('.');
  const tieneComa  = limpio.includes(',');
  if (tienePunto && tieneComa) {
    if (limpio.lastIndexOf(',') > limpio.lastIndexOf('.')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else {
      limpio = limpio.replace(/,/g, '');
    }
  } else if (tieneComa) {
    const partes = limpio.split(',');
    if (partes[1]?.length === 2) limpio = limpio.replace(',', '.');
    else limpio = limpio.replace(/,/g, '');
  } else if (tienePunto) {
    const partes = limpio.split('.');
    if (partes[1]?.length !== 2) limpio = limpio.replace(/\./g, '');
  }
  return parseFloat(limpio) || 0;
}

// ── Réplica: preprocesarTexto ────────────────────────────────────────────────
function preprocesarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[|]{2,}/g, ' ')
    .replace(/[_]{3,}/g, ' ')
    .replace(/[-]{3,}/g, '\n')
    .replace(/[=]{3,}/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s{2,}/g, ' ').trim())
    .filter(l => l.length > 0)
    .join('\n');
}

// ── Réplica: estimarCalidadOCR ───────────────────────────────────────────────
function estimarCalidadOCR(texto: string): number {
  if (!texto || texto.length < 10) return 0;
  const totalChars         = texto.length;
  const alphanumeric       = (texto.match(/[a-zA-Z0-9]/g) || []).length;
  const ruido              = (texto.match(/[^a-zA-Z0-9\s\n.,;:$%\-\/()]/g) || []).length;
  const lineas             = texto.split('\n').length;
  const lineasConContenido = texto.split('\n').filter(l => l.trim().length > 3).length;
  const ratio              = alphanumeric / totalChars;
  const linearidad         = lineasConContenido / Math.max(lineas, 1);
  const penalizacion       = Math.min(ruido / totalChars, 0.3);
  return Math.round(Math.min(100, Math.max(0, (ratio * 60 + linearidad * 40 - penalizacion * 50))));
}

// ── Réplica: detectarTipoFactura ─────────────────────────────────────────────
type TipoFactura =
  | 'tipo1_dimensiones' | 'tipo2_columnas' | 'tipo3_lista_precios'
  | 'tipo4_dian'        | 'tipo5_tiquete'  | 'tipo6_remision'
  | 'tipo7_superficie'  | 'tipo8_compleja' | 'desconocido';

function detectarTipoFactura(texto: string): TipoFactura {
  const t = texto.toUpperCase();
  if (/CUFE|CUDE|FACTURA\s+ELECTRONICA/.test(t))           return 'tipo4_dian';
  if (/PVP\s*SUG|PRECIO.*SUGERIDO|P\/UNIT.*DESC.*IVA/s.test(t)) return 'tipo8_compleja';
  if (/\d+\*\d+\*\d+(?:[.,]\d+)?[gGkKmMlL]/.test(texto))  return 'tipo1_dimensiones';
  if (/^\d{7,13}\s+/m.test(texto))                         return 'tipo7_superficie';
  if (/PRESENTACI[OÓ]N/.test(t))                            return 'tipo3_lista_precios';
  if (!/\$?\s*\d{3,}/.test(texto))                          return 'tipo6_remision';
  if (/UNIDADES?\s+CANTIDAD|CANT\s+UND/.test(t))            return 'tipo2_columnas';
  return 'tipo5_tiquete';
}

// ── Réplica: extraerProveedorForense ─────────────────────────────────────────
interface ProveedorForense {
  razonSocial: string; nit: string; rubro: string;
  asesor: string; telefono: string; email: string;
  direccion: string; confianza: number;
}

function extraerProveedorForense(texto: string): ProveedorForense {
  const lineas = texto.split('\n');
  const t = texto.toUpperCase();

  let razonSocial = '';
  for (const linea of lineas.slice(0, 8)) {
    const l = linea.trim();
    if (l.length > 4 && l.length < 70 &&
        !/NIT|RUT|TEL|CEL|FAX|EMAIL|FECHA|FACTURA|DIRECCION/i.test(l) &&
        !/^\d/.test(l) && /[A-ZÁÉÍÓÚ]{3,}/i.test(l)) {
      razonSocial = l; break;
    }
  }

  const nitMatch = texto.match(/(?:NIT|N\.I\.T|RUT)[\s:.-]*(\d[\d.\-]+\d)/i);
  const nit = nitMatch?.[1]?.replace(/\s/g, '') || '';

  const telPatrones = [
    /(?:TEL|TELEF|TELEFONO|CELULAR|CEL|MOVIL|WHATSAPP|WA)[\s:.]*(\+?57[\s]?\d[\d\s]{7,12})/i,
    /(?:TEL|TELEF|TELEFONO|CELULAR|CEL|MOVIL|WHATSAPP|WA)[\s:.]*(\d{7,10})/i,
    /\b(3\d{9})\b/,
    /\b(60\d\s?\d{7})\b/,
  ];
  let telefono = '';
  for (const pat of telPatrones) {
    const m = texto.match(pat);
    if (m) { telefono = m[1].replace(/\s/g, ''); break; }
  }

  const emailMatch = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] || '';

  const asesorMatch = texto.match(/(?:VENDEDOR|ASESOR|REPRESENTANTE|AGENTE|ATENDIDO\s+POR)[\s:.-]*([A-ZÁÉÍÓÚ][a-záéíóú]+(?:[ \t]+[A-ZÁÉÍÓÚ][a-záéíóú]+)*)/i);
  const asesor = asesorMatch?.[1]?.trim() || '';

  const dirMatch = texto.match(/(?:DIRECCI[OÓ]N|DIR|DOMICILIO)[\s:.-]*([^\n]{5,60})/i);
  const direccion = dirMatch?.[1]?.trim() || '';

  let rubro = '';
  if (/DISTRIBUIDORA|DISTRIB/.test(t))      rubro = 'Distribuidora';
  else if (/LACTEOS|LÁCTEOS/.test(t))       rubro = 'Lácteos';
  else if (/HARINAS|GRANOS|CEREAL/.test(t)) rubro = 'Harinas y Cereales';
  else if (/MAYORISTA|MAKRO/.test(t))       rubro = 'Mayorista';
  else if (/DULCER|CONFITE|GOLOSINA/.test(t)) rubro = 'Dulces / Confitería';

  const confianza = [razonSocial, telefono, nit].filter(Boolean).length * 33;
  return { razonSocial, nit, rubro, asesor, telefono, email, direccion, confianza };
}

// ═════════════════════════════════════════════════════════════════════════════

describe('normalizarPrecio — formatos colombiano y americano', () => {
  it('formato colombiano 1.500,00 → 1500', () => {
    expect(normalizarPrecio('1.500,00')).toBe(1500);
  });
  it('formato americano 1,500.00 → 1500', () => {
    expect(normalizarPrecio('1,500.00')).toBe(1500);
  });
  it('número entero sin separadores → valor exacto', () => {
    expect(normalizarPrecio('5000')).toBe(5000);
  });
  it('precio con punto de miles sin decimales: 5.000 → 5000', () => {
    expect(normalizarPrecio('5.000')).toBe(5000);
  });
  it('precio con decimales reales: 12.50 → 12.5', () => {
    expect(normalizarPrecio('12.50')).toBe(12.5);
  });
  it('string vacío → 0', () => {
    expect(normalizarPrecio('')).toBe(0);
  });
  it('texto no numérico → 0', () => {
    expect(normalizarPrecio('TOTAL')).toBe(0);
  });
  it('precio grande colombiano: 166.667 → 166667', () => {
    expect(normalizarPrecio('166.667')).toBe(166667);
  });
  it('precio con espacio: "5 000" → 5000', () => {
    expect(normalizarPrecio('5 000')).toBe(5000);
  });
  it('precio sin separadores: 85000 → 85000', () => {
    expect(normalizarPrecio('85000')).toBe(85000);
  });
  it('precio sin separadores: 166667 → 166667', () => {
    expect(normalizarPrecio('166667')).toBe(166667);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('preprocesarTexto — limpieza de artefactos Tesseract', () => {
  it('elimina pipes dobles (artefacto Tesseract)', () => {
    const resultado = preprocesarTexto('HARINA||TRIGO\nPRECIO 5000');
    expect(resultado).not.toContain('||');
  });
  it('convierte líneas de guiones en saltos de línea', () => {
    const resultado = preprocesarTexto('PROVEEDOR\n------\nPRODUCTO');
    expect(resultado).toContain('\n');
    expect(resultado).not.toContain('------');
  });
  it('elimina líneas vacías', () => {
    const resultado = preprocesarTexto('LINEA1\n\n\nLINEA2');
    const lineas = resultado.split('\n');
    expect(lineas.every(l => l.length > 0)).toBe(true);
  });
  it('colapsa espacios múltiples dentro de una línea', () => {
    const resultado = preprocesarTexto('HARINA    DE    TRIGO');
    expect(resultado).toBe('HARINA DE TRIGO');
  });
  it('normaliza saltos de línea Windows (\\r\\n) a Unix (\\n)', () => {
    const resultado = preprocesarTexto('LINEA1\r\nLINEA2\r\nLINEA3');
    expect(resultado).not.toContain('\r');
    expect(resultado).toBe('LINEA1\nLINEA2\nLINEA3');
  });
  it('convierte líneas de igual (===) en saltos de línea', () => {
    const resultado = preprocesarTexto('ENCABEZADO\n=======\nCONTENIDO');
    expect(resultado).not.toContain('=======');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('estimarCalidadOCR — puntuación de legibilidad del texto', () => {
  it('texto legible bien estructurado → calidad alta (>70)', () => {
    const texto = 'DISTRIBUIDORA DULCE VIDA\nNIT: 900123456-7\nHARINA DE TRIGO 50kg\nPRECIO: 85000\nTOTAL: 255000';
    expect(estimarCalidadOCR(texto)).toBeGreaterThan(70);
  });
  it('texto vacío → 0', () => {
    expect(estimarCalidadOCR('')).toBe(0);
  });
  it('texto con menos de 10 caracteres → 0', () => {
    expect(estimarCalidadOCR('ABC')).toBe(0);
  });
  it('texto con mucho ruido de caracteres especiales → calidad baja (<50)', () => {
    const basura = '##@@!!%%^^&&**##@@!!%%^^&&**##@@!!%%' + '@@@@####$$$$%%%%';
    expect(estimarCalidadOCR(basura)).toBeLessThan(50);
  });
  it('devuelve número entre 0 y 100', () => {
    const textoNormal = 'HARINA TRIGO 5000 AZUCAR 3000 MANTEQUILLA 8000';
    const calidad = estimarCalidadOCR(textoNormal);
    expect(calidad).toBeGreaterThanOrEqual(0);
    expect(calidad).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('detectarTipoFactura — clasificación automática', () => {
  it('texto con patrón A*B*Cg → tipo1_dimensiones', () => {
    const texto = 'CHICLE BUBBALOO FRESA 40*30*3.8g  166667\nGALLETA OREO 12*12*36g  85000';
    expect(detectarTipoFactura(texto)).toBe('tipo1_dimensiones');
  });
  it('texto con CUFE → tipo4_dian (factura electrónica)', () => {
    const texto = 'FACTURA ELECTRONICA\nCUFE: abc123def456\nNIT: 900123456';
    expect(detectarTipoFactura(texto)).toBe('tipo4_dian');
  });
  it('texto con FACTURA ELECTRONICA → tipo4_dian', () => {
    const texto = 'FACTURA ELECTRONICA DE VENTA\nNIT 800123456-1';
    expect(detectarTipoFactura(texto)).toBe('tipo4_dian');
  });
  it('texto con PRESENTACIÓN → tipo3_lista_precios', () => {
    const texto = 'PRODUCTO\tPRESENTACIÓN\tPRECIO\nHARINA\t50KG\t85000';
    expect(detectarTipoFactura(texto)).toBe('tipo3_lista_precios');
  });
  it('texto con PVP SUGERIDO → tipo8_compleja', () => {
    const texto = 'PRODUCTO\tPVP SUG\tDESC\tIVA\nHARINA\t85000\t5%\t19%';
    expect(detectarTipoFactura(texto)).toBe('tipo8_compleja');
  });
  it('texto sin precios → tipo6_remision (nota de entrega)', () => {
    const texto = 'REMISION DE MERCANCIA\nHARINA DE TRIGO\nAZUCAR BLANCA\nMANTEQUILLA';
    expect(detectarTipoFactura(texto)).toBe('tipo6_remision');
  });
  it('texto con código EAN de 7+ dígitos al inicio → tipo7_superficie', () => {
    const texto = '7702009  HARINA TRIGO 50KG  85000\n7890001  AZUCAR 25KG  42000';
    expect(detectarTipoFactura(texto)).toBe('tipo7_superficie');
  });
  it('texto con CANT UND → tipo2_columnas', () => {
    const texto = 'CANT UND DESCRIPCION PRECIO\n3 KG HARINA 85000\n2 UN AZUCAR 42000';
    expect(detectarTipoFactura(texto)).toBe('tipo2_columnas');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extraerProveedorForense — datos del proveedor desde texto', () => {
  it('extrae razón social de las primeras líneas', () => {
    const texto = 'DISTRIBUIDORA DULCE VIDA\nNIT: 900123456-7\nTEL: 3001234567';
    const r = extraerProveedorForense(texto);
    expect(r.razonSocial).toBe('DISTRIBUIDORA DULCE VIDA');
  });
  it('extrae NIT correctamente', () => {
    const texto = 'HARINAS EL SOL\nNIT: 800.234.567-1\nTEL: 3001234567';
    const r = extraerProveedorForense(texto);
    expect(r.nit).toBeTruthy();
    expect(r.nit).toContain('800');
  });
  it('extrae teléfono celular colombiano', () => {
    const texto = 'PROVEEDOR SA\nCEL: 3157654321\nDIRECCION: Calle 10';
    const r = extraerProveedorForense(texto);
    expect(r.telefono).toBe('3157654321');
  });
  it('extrae email', () => {
    const texto = 'DISTRIBUIDORA ABC\nventas@distribuidora.com\nTEL 3001234567';
    const r = extraerProveedorForense(texto);
    expect(r.email).toBe('ventas@distribuidora.com');
  });
  it('infiere rubro DISTRIBUIDORA correctamente', () => {
    const texto = 'DISTRIBUIDORA NACIONAL DE ALIMENTOS\nNIT 900111222-3';
    const r = extraerProveedorForense(texto);
    expect(r.rubro).toBe('Distribuidora');
  });
  it('infiere rubro LACTEOS correctamente', () => {
    const texto = 'LACTEOS DEL CAMPO SAS\nNIT 800555666-1';
    const r = extraerProveedorForense(texto);
    expect(r.rubro).toBe('Lácteos');
  });
  it('confianza = 99 cuando tiene razón social + NIT + teléfono', () => {
    const texto = 'HARINAS EL SOL\nNIT: 800234567-1\nTEL: 3001234567';
    const r = extraerProveedorForense(texto);
    expect(r.confianza).toBe(99);
  });
  it('confianza = 0 para texto sin datos de proveedor', () => {
    const texto = '3 HARINA TRIGO 85000\n2 AZUCAR 42000';
    const r = extraerProveedorForense(texto);
    expect(r.confianza).toBe(0);
  });
  it('extrae asesor/vendedor', () => {
    const texto = 'DISTRIBUIDORA XYZ\nVENDEDOR: Carlos Perez\nNIT 900123456';
    const r = extraerProveedorForense(texto);
    expect(r.asesor).toBe('Carlos Perez');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Pipeline completo — texto factura subida → estructura correcta', () => {
  it('factura tipo1 real: preprocesar → detectar → normalizar precios', () => {
    const textoRaw = 'DISTRIBUIDORA DULCE VIDA\r\nNIT: 900.123.456-7\r\nTEL: 3001234567\r\n------\r\n3  CHICLE BUBBALOO FRESA 40*30*3.8g  166.667\r\n2  GALLETA OREO 12*12*36g  85.000\r\n';

    // Paso 1: preprocesar (limpia artefactos OCR)
    const textoProcesado = preprocesarTexto(textoRaw);
    expect(textoProcesado).not.toContain('\r');
    expect(textoProcesado).not.toContain('------');

    // Paso 2: detectar tipo (debe ser tipo1 por el patrón A*B*Cg)
    const tipo = detectarTipoFactura(textoProcesado);
    expect(tipo).toBe('tipo1_dimensiones');

    // Paso 3: normalizar precios de las líneas
    expect(normalizarPrecio('166.667')).toBe(166667);
    expect(normalizarPrecio('85.000')).toBe(85000);

    // Paso 4: extraer proveedor
    const proveedor = extraerProveedorForense(textoProcesado);
    expect(proveedor.razonSocial).toBe('DISTRIBUIDORA DULCE VIDA');
    expect(proveedor.telefono).toBe('3001234567');
  });

  it('factura electrónica DIAN: detecta tipo4 y extrae NIT', () => {
    const texto = preprocesarTexto(
      'HARINAS EL SOL SAS\nNIT 800.234.567-1\nFACTURA ELECTRONICA\nCUFE: a1b2c3d4e5f6\nHARINA DE TRIGO 50KG  85.000\n'
    );
    expect(detectarTipoFactura(texto)).toBe('tipo4_dian');
    const p = extraerProveedorForense(texto);
    expect(p.nit).toContain('800');
  });

  it('texto con mucho ruido OCR tiene calidad baja', () => {
    const textoBasura = '##@@ HARINA||TRIGO $$## 5000 @@##\n@@##$$%%&&**';
    const calidad = estimarCalidadOCR(textoBasura);
    expect(calidad).toBeLessThan(60);
  });

  it('factura limpia tiene calidad alta', () => {
    const textoLimpio = [
      'DISTRIBUIDORA NACIONAL DE ALIMENTOS',
      'NIT: 900123456-7',
      'TEL: 3001234567',
      'HARINA DE TRIGO 50KG  85000',
      'AZUCAR BLANCA 25KG  42000',
      'MANTEQUILLA ANCHETA 10KG  120000',
      'TOTAL: 247000',
    ].join('\n');
    expect(estimarCalidadOCR(textoLimpio)).toBeGreaterThan(70);
  });
});
