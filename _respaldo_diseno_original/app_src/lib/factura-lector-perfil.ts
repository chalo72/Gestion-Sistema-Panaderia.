/**
 * Lector de facturas usando el perfil guardado por proveedor.
 * Extrae solo: descripción, cantidad/unidad y valor total por línea.
 */
import { normalizarTexto, type TipoFactura } from '@/lib/ocr-service';
import type { LineaFacturaPerfil, PerfilFacturaProveedor } from '@/types';

export const TEXTOS_IGNORAR_EXTRA = [
  'observacion',
  'olservacion',
  'sub-total',
  'sub total',
  'efectos legales',
  'no aceptamos',
  'esta factura de venta',
  'factura de venta se',
  'resolucion dian',
  'autorizacion numeracion',
  'total a pagar',
  'gran total',
  'valor total',
  'base gravable',
  'retencion',
  'reteiva',
  'retefuente',
  'cufe',
  'cude',
  'software',
  'elaborado por',
  'impreso por',
  'pagina',
  'hoja',
  'firma',
  'sello',
  'recibido conforme',
  'copia cliente',
  'original cliente',
  'continua',
  'son:',
  'items',
  'item',
];

const PATRON_PIE_FACTURA =
  /(?:sub[\s-]?total|observaci[oó]n|olservaci[oó]n|efectos legales|esta factura de venta|total a pagar|gran total|valor total|base gravable|forma de pago|^\s*total\b)/i;

/** Normaliza precio colombiano (1.500,00 / 25,800 → número). */
export function normalizarPrecioFactura(precio: string): number {
  if (!precio) return 0;
  let limpio = precio.replace(/\s/g, '');
  const tienePunto = limpio.includes('.');
  const tieneComa = limpio.includes(',');
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
  const n = parseFloat(limpio);
  return Number.isNaN(n) ? 0 : n;
}

export function limpiarLineaOCR(linea: string): string {
  return linea
    .replace(/[|]{1,}/g, ' ')
    .replace(/[_]{2,}/g, ' ')
    .replace(/--/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Correcciones suaves de OCR en nombres de producto. */
export function corregirDescripcionOCR(desc: string): string {
  let d = desc;
  if (/\bPOOL\b/i.test(d) && /\b(cascarrosa|casrosa|\?00l|g00l)\b/i.test(d)) {
    d = d.replace(/\b(cascarrosa|casrosa)\b/gi, 'GASEOSA');
    d = d.replace(/\?00l/gi, 'POOL');
    d = d.replace(/\bg00l\b/gi, 'POOL');
  }
  d = d.replace(/\bX\s+(\d+)\b/gi, 'X$1');
  d = d.replace(/\b(\d+)\s*ML\b/gi, '$1ML');
  return d.replace(/\s+/g, ' ').trim();
}

function limpiarDescripcionFinal(desc: string): string {
  return corregirDescripcionOCR(
    desc
      .replace(/\s+[o|y]\s*$/i, '')
      .replace(/\s+UD\s*$/i, '')
      .replace(/\s+e\s*$/i, '')
      .replace(/[.\[\]]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).substring(0, 80);
}

/** ¿La línea es basura (legal, totales, observaciones)? */
export function esLineaBasura(linea: string, textosIgnorar: string[]): boolean {
  const norm = normalizarTexto(linea);
  if (norm.length < 3) return true;

  const letras = (norm.match(/[a-z]/g) || []).length;
  if (letras < 3 && !/\d{4,}/.test(norm)) return true;

  if (PATRON_PIE_FACTURA.test(linea)) return true;

  const todos = [...textosIgnorar, ...TEXTOS_IGNORAR_EXTRA];
  for (const t of todos) {
    const clave = normalizarTexto(t);
    if (clave.length < 3) continue;
    if (norm.includes(clave)) return true;
  }

  if (/^(total|subtotal|iva|descuento|nit|rut|cufe)\b/.test(norm)) return true;
  if (/^\d+$/.test(norm)) return true;

  // Fragmentos OCR sin sentido
  if (/^e\s*o\s*\)?$/i.test(norm)) return true;
  if (letras <= 4 && /\d{4,}/.test(norm) && !/\b(X\d+|ML|GASEOSA|HARINA|GALLETA)\b/i.test(linea)) {
    return true;
  }

  return false;
}

function extraerNumeros(linea: string): number[] {
  const matches = [
    ...linea.matchAll(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:[.,]\d{3})*|\d+)/g),
  ];
  return matches
    .map((m) => normalizarPrecioFactura(m[1]))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

function parsearDimensiones(descripcion: string): {
  nombre: string;
  gramaje: string;
  cantidadEmbalaje: number;
} {
  const m3 = descripcion.match(/^(.+?)\s+(\d+)\*(\d+)\*(\d+(?:[.,]\d+)?[gGkKmMlL]{0,3})\s*$/i);
  if (m3) {
    return {
      nombre: m3[1].trim(),
      gramaje: m3[4],
      cantidadEmbalaje: parseInt(m3[3], 10),
    };
  }
  const m2 = descripcion.match(/^(.+?)\s+(\d+)\*(\d+)\s*$/);
  if (m2) {
    return { nombre: m2[1].trim(), gramaje: '', cantidadEmbalaje: parseInt(m2[3], 10) };
  }
  return { nombre: descripcion.trim(), gramaje: '', cantidadEmbalaje: 1 };
}

function parsearTipo1(linea: string): LineaFacturaPerfil | null {
  if (!/\d+\*\d+/.test(linea)) return null;
  const precioM = linea.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{4,8})\s*$/);
  const valorTotal = precioM ? normalizarPrecioFactura(precioM[1]) : 0;
  if (valorTotal < 100) return null;

  const cantM = linea.match(/^\s*(\d+)\s+/);
  const cantidad = cantM ? parseInt(cantM[1], 10) : 1;

  const desc = linea
    .replace(/^\s*\d+\s+/, '')
    .replace(precioM?.[0] || '', '')
    .trim();

  const dim = parsearDimensiones(desc);
  const nombre = dim.gramaje ? `${dim.nombre} ${dim.gramaje}`.trim() : dim.nombre;
  if (nombre.length < 3) return null;

  return {
    descripcion: limpiarDescripcionFinal(nombre),
    cantidad: cantidad > 0 ? cantidad : 1,
    unidad: 'UND',
    valorTotal: Math.round(valorTotal),
    confianza: 90,
  };
}

/**
 * Tabla distribuidora: SKU + descripción + embalaje X24 + UND + CANT + VALOR + IVA%.
 * Ej: | 10510 GASEOSA POOL COLA 400ML X24 o 12 12 25,800 19 0
 */
export function parsearLineaTablaDistribuidora(linea: string): LineaFacturaPerfil | null {
  let s = limpiarLineaOCR(linea).replace(/^[.\[\]]+\s*/, '');
  if (!/[A-Za-zÁÉÍÓÚñÑ]{4,}/.test(s)) return null;

  // Patrón completo: UND CANT PRECIO IVA [cola]
  const tailCompleto = s.match(
    /\s+(?:[o|y]\s*(?:UD\s*)?[e|]?\s*)?(\d{1,4})\s+(\d{1,4})\s+([\d.,]+)\s+(?:19|16|5|0)\s*(?:\d+|o)?\s*$/i,
  );
  if (tailCompleto) {
    const cantidad = parseInt(tailCompleto[2], 10);
    const valorTotal = normalizarPrecioFactura(tailCompleto[3]);
    let desc = s.slice(0, tailCompleto.index).trim();
    desc = desc.replace(/^\d{4,8}\s+/, '');
    desc = limpiarDescripcionFinal(desc);
    if (valorTotal >= 100 && desc.length >= 4) {
      return {
        descripcion: desc,
        cantidad: cantidad > 0 ? cantidad : 1,
        unidad: 'UND',
        valorTotal: Math.round(valorTotal),
        confianza: 88,
      };
    }
  }

  // Patrón corto: CANT PRECIO IVA (sin columna UND duplicada)
  const tailCorto = s.match(
    /\s+(?:[o|y]\s*UD\s*[e|]\s*)?(\d{1,4})\s+([\d.,]+)\s+(?:19|16|5|0)\s*\w*\s*$/i,
  );
  if (tailCorto) {
    const cantidad = parseInt(tailCorto[1], 10);
    const valorTotal = normalizarPrecioFactura(tailCorto[2]);
    let desc = s.slice(0, tailCorto.index).trim();
    desc = desc.replace(/^\d{4,8}\s+/, '');
    desc = limpiarDescripcionFinal(desc);
    if (valorTotal >= 100 && desc.length >= 4) {
      return {
        descripcion: desc,
        cantidad: cantidad > 0 ? cantidad : 1,
        unidad: 'UND',
        valorTotal: Math.round(valorTotal),
        confianza: 82,
      };
    }
  }

  return null;
}

function parsearTipo5(linea: string): LineaFacturaPerfil | null {
  const precioM = linea.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{4,8})\s*$/);
  if (!precioM) return null;
  const valorTotal = normalizarPrecioFactura(precioM[1]);
  if (valorTotal < 100) return null;

  const cantM = linea.match(/^\s*(\d+)\s+/);
  const cantidad = cantM ? parseInt(cantM[1], 10) : 1;

  let desc = linea.replace(precioM[0], '').replace(/^\s*\d+\s+/, '').trim();
  desc = desc.replace(/^\d{7,13}\s+/, '');
  desc = limpiarDescripcionFinal(desc);
  if (desc.length < 3) return null;

  return {
    descripcion: desc,
    cantidad: cantidad > 0 ? cantidad : 1,
    unidad: 'UND',
    valorTotal: Math.round(valorTotal),
    confianza: 80,
  };
}

/** Tabla genérica con SKU + varias columnas numéricas. */
function parsearTipo7o8(linea: string): LineaFacturaPerfil | null {
  const tab = parsearLineaTablaDistribuidora(linea);
  if (tab) return tab;

  const s = limpiarLineaOCR(linea);
  const nums = extraerNumeros(s);
  if (nums.length === 0) return null;

  const precios = nums.filter((n) => n >= 100 && n !== 19 && n !== 16 && n !== 5);
  if (precios.length === 0) return null;
  const valorTotal = precios[precios.length - 1];

  const cantidadCandidatos = nums.filter(
    (n) => n > 0 && n <= 999 && n !== valorTotal && n !== 19 && n !== 16 && n !== 5 && n !== 0,
  );
  const cantidad = cantidadCandidatos.length > 0 ? cantidadCandidatos[cantidadCandidatos.length - 1] : 1;

  let desc = s.replace(/^\d{4,8}\s+/, '');
  desc = desc.replace(/\s+(?:[o|y]\s*)?[\d.,\s]+$/i, '');
  desc = limpiarDescripcionFinal(desc);
  if ((desc.match(/[a-záéíóú]/gi) || []).length < 4) return null;

  return {
    descripcion: desc,
    cantidad,
    unidad: 'UND',
    valorTotal: Math.round(valorTotal),
    confianza: 72,
  };
}

function pareceLineaProducto(linea: string): boolean {
  return (
    /\d+\*\d+/.test(linea) ||
    /\bX\s*\d+\b/i.test(linea) ||
    /\d+ML\b/i.test(linea) ||
    /^\d{4,7}\s+/i.test(linea) ||
    /\b(GASEOSA|GALLETA|HARINA|CHICLE|JUGO|AGUA|SNACK)\b/i.test(linea)
  );
}

function parsearLineaConPerfil(linea: string, perfil: PerfilFacturaProveedor): LineaFacturaPerfil | null {
  const limpia = limpiarLineaOCR(linea);
  if (esLineaBasura(limpia, perfil.textosIgnorar)) return null;

  // Parsers específicos por forma de línea (cada factura mezcla formatos)
  if (/\d+\*\d+/.test(limpia)) {
    const t1 = parsearTipo1(limpia);
    if (t1) return t1;
  }

  if (pareceLineaProducto(limpia)) {
    const tab = parsearLineaTablaDistribuidora(limpia);
    if (tab) return tab;
  }

  const tipo = perfil.tipoFactura as TipoFactura;

  if (tipo === 'tipo1_dimensiones') {
    return parsearTipo1(limpia) ?? parsearTipo5(limpia);
  }
  if (tipo === 'tipo7_superficie' || tipo === 'tipo8_compleja' || tipo === 'tipo4_dian') {
    return parsearTipo7o8(limpia) ?? parsearTipo5(limpia);
  }
  if (tipo === 'tipo2_columnas') {
    const partes = limpia.split(/\s{2,}|\t/);
    if (partes.length >= 3) {
      const nums = partes.slice(1).map((p) => parseInt(p, 10)).filter((n) => !Number.isNaN(n) && n > 0);
      const precio = normalizarPrecioFactura(partes[partes.length - 1]);
      if (precio >= 100 && partes[0].length >= 3) {
        return {
          descripcion: limpiarDescripcionFinal(partes[0]),
          cantidad: nums.length >= 2 ? nums[1] : nums[0] ?? 1,
          unidad: 'UND',
          valorTotal: Math.round(precio),
          confianza: 85,
        };
      }
    }
  }

  return parsearLineaTablaDistribuidora(limpia) ?? parsearTipo5(limpia) ?? parsearTipo7o8(limpia);
}

/** Obtiene líneas de la zona tabla del perfil, excluyendo pie detectado por palabras clave. */
export function obtenerLineasZonaTabla(textoOriginal: string, perfil: PerfilFacturaProveedor): string[] {
  const lineas = textoOriginal.split('\n').map((l) => l.trim()).filter(Boolean);
  const zonaTabla = perfil.zonas.find((z) => z.id === 'tabla');
  const inicio = zonaTabla ? Math.max(0, zonaTabla.lineaInicio - 1) : 0;
  const fin = zonaTabla ? Math.min(lineas.length, zonaTabla.lineaFin) : lineas.length;

  const slice = lineas.slice(inicio, fin);
  return slice.filter((l) => !PATRON_PIE_FACTURA.test(l) && !esLineaBasura(l, perfil.textosIgnorar));
}

/**
 * Extrae líneas de producto usando el perfil del proveedor.
 * Solo devuelve descripción, cantidad y valor total.
 */
export function extraerLineasConPerfil(
  textoOriginal: string,
  perfil: PerfilFacturaProveedor,
): LineaFacturaPerfil[] {
  const lineas = obtenerLineasZonaTabla(textoOriginal, perfil);
  const resultados: LineaFacturaPerfil[] = [];
  const vistos = new Set<string>();

  for (const linea of lineas) {
    const parsed = parsearLineaConPerfil(linea, perfil);
    if (!parsed || parsed.valorTotal < 100) continue;
    if (parsed.descripcion.length < 3) continue;
    if (esLineaBasura(parsed.descripcion, perfil.textosIgnorar)) continue;

    const key = `${normalizarTexto(parsed.descripcion).substring(0, 18)}|${parsed.valorTotal}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    resultados.push(parsed);
  }

  return resultados;
}
