// ============================================================
// MOTOR FORENSE OCR — Antigravity Nexus · v2.0.0
// Panadería Dulce Placer · Especialista en Facturas
// ============================================================

export interface ProductoDetectado {
  id: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  costoTotal: number;
  categoria: string;
  confianza: number;      // 0-100 — confianza de extraccion OCR
  confianzaMatch?: number; // 0-100 — confianza de coincidencia con catálogo
}

export interface ProveedorDetectado {
  nombre: string;
  telefono: string;
  direccion: string;
  nit: string;
}

export interface ResultadoOCR {
  texto: string;
  textoLimpio: string;    // texto pre-procesado para debug
  proveedor: ProveedorDetectado | null;
  productos: ProductoDetectado[];
  fechaFactura: string | null;
  numeroFactura: string | null;
  total: number | null;
  errores: string[];
  calidadOCR: number;     // 0-100 — calidad estimada del texto extraído
}

export interface MatchResultado {
  indice: number;          // -1 si no encontró
  score: number;           // 0-1
  metodo: 'exacto' | 'fuzzy' | 'parcial' | 'token' | 'ninguno';
}

// ── Genera ID temporal ──────────────────────────────────────
function generateId(): string {
  return `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================
// MOTOR DE SIMILITUD — Jaro-Winkler
// ============================================================

// Normaliza texto para comparación: minúsculas, sin tildes, sin símbolos
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')      // solo letras/números/espacios
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaro similarity
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  const matchDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matched = new Array(s1.length).fill(false);
  const s2Matched = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matched[j] || s1[i] !== s2[j]) continue;
      s1Matched[i] = true;
      s2Matched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matched[i]) continue;
    while (!s2Matched[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

// Jaro-Winkler (da más peso a prefijo común)
function jaroWinkler(s1: string, s2: string): number {
  const j = jaro(s1, s2);
  let prefLen = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefLen++;
    else break;
  }
  return j + prefLen * 0.1 * (1 - j);
}

// ============================================================
// MATCHING INTELIGENTE CONTRA CATÁLOGO
// ============================================================

/**
 * Busca el mejor match de un nombre OCR contra un catálogo.
 * Usa 4 estrategias en cascada:
 *  1. Exacto (normalizado)
 *  2. Fuzzy Jaro-Winkler de la frase completa
 *  3. Match por tokens (palabras clave coincidentes)
 *  4. Contención (uno contiene al otro)
 */
export function matchProductoEnCatalogo<T>(
  nombreOCR: string,
  catalogo: T[],
  getNombre: (item: T) => string,
  umbralMinimo = 0.58
): MatchResultado {
  if (!nombreOCR || catalogo.length === 0) return { indice: -1, score: 0, metodo: 'ninguno' };

  const ocrNorm = normalizarTexto(nombreOCR);
  const ocrTokens = ocrNorm.split(' ').filter(t => t.length > 2);

  let mejorIndice = -1;
  let mejorScore = 0;
  let mejorMetodo: MatchResultado['metodo'] = 'ninguno';

  for (let i = 0; i < catalogo.length; i++) {
    const catNorm = normalizarTexto(getNombre(catalogo[i]));
    const catTokens = catNorm.split(' ').filter(t => t.length > 2);

    // 1. Exacto
    if (ocrNorm === catNorm) return { indice: i, score: 1, metodo: 'exacto' };

    // 2. Jaro-Winkler frase completa
    const jwScore = jaroWinkler(ocrNorm, catNorm);

    // 3. Match por tokens
    const tokensCoincidentes = ocrTokens.filter(t =>
      catTokens.some(ct => jaroWinkler(t, ct) > 0.85)
    ).length;
    const tokenScore = ocrTokens.length > 0
      ? tokensCoincidentes / Math.max(ocrTokens.length, catTokens.length)
      : 0;

    // 4. Contención (uno contiene al otro)
    const contiene = ocrNorm.includes(catNorm) || catNorm.includes(ocrNorm);
    const longitudMinima = Math.min(ocrNorm.length, catNorm.length);
    const contencionScore = contiene && longitudMinima > 3 ? 0.80 : 0;

    // Score combinado (ponderado)
    const scoreCompuesto = Math.max(
      jwScore * 0.6 + tokenScore * 0.4,
      tokenScore * 0.7 + jwScore * 0.3,
      contencionScore
    );

    if (scoreCompuesto > mejorScore) {
      mejorScore = scoreCompuesto;
      mejorIndice = i;
      if (jwScore >= tokenScore && jwScore >= contencionScore) mejorMetodo = 'fuzzy';
      else if (tokenScore >= jwScore && tokenScore >= contencionScore) mejorMetodo = 'token';
      else mejorMetodo = 'parcial';
    }
  }

  if (mejorScore < umbralMinimo) return { indice: -1, score: mejorScore, metodo: 'ninguno' };
  return { indice: mejorIndice, score: mejorScore, metodo: mejorMetodo };
}

/**
 * Busca el mejor match de un proveedor OCR contra el catálogo de proveedores.
 */
export function matchProveedorEnCatalogo<T>(
  nombreOCR: string,
  catalogo: T[],
  getNombre: (item: T) => string,
  umbral = 0.55
): MatchResultado {
  return matchProductoEnCatalogo(nombreOCR, catalogo, getNombre, umbral);
}

// ============================================================
// PATRONES DE EXTRACCIÓN — Facturas colombianas/latinas
// ============================================================

const PATRONES = {
  // Línea completa: cantidad + unidad + desc + precio unitario + total
  lineaCompleta: /(\d+(?:[.,]\d+)?)\s*(?:UND|UN|KG|GR|LB|LT|ML|PQ|CJ|BL|UNID|UNIDADES?)?\s+(.{4,50}?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi,

  // Línea con descripción y precio al final (sin cantidad explícita)
  lineaSimple: /^(.{4,45}?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?:\s*$)/gm,

  // Línea con formato "CANT x DESC PRECIO"
  lineaX: /(\d+)\s*[xX]\s*(.{4,40}?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi,

  // Metadatos de factura
  nit:           /(?:NIT|N\.I\.T|RUT)[\s:]*(\d{1,3}(?:[.,]\d{3})*-?\d?)/i,
  telefono:      /(?:TEL|TELEFONO|CEL|CELULAR|MOVIL|WHATSAPP)[\s:.]*(\d[\d\s.\-]{7,14}\d)/i,
  fecha:         /(?:FECHA|FEC|DATE)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  fechaTexto:    /(\d{1,2})\s+(?:DE\s+)?(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(?:DE\s+)?(\d{4})/i,
  numeroFactura: /(?:FACTURA|FAC\.?|FACT\.?|INVOICE|No\.?|N[°º]\.?|NUMERO|FOLIO)\s*[:#]?\s*([A-Z0-9\-]+)/i,
  total:         /(?:TOTAL\s+A\s+PAGAR|VALOR\s+TOTAL|TOTAL\s+FACTURA|TOTAL|SUBTOTAL|GRAN\s+TOTAL)\s*[:\$]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
  unidad:        /\b(UND|UN|KG|GR|LB|LT|ML|PQ|CJ|BL|UNIDAD|KILO|GRAMO|LIBRA|LITRO|BOLSA|CAJA)\b/i,
};

// Palabras a ignorar en líneas de factura (encabezados, totales, etc.)
const PALABRAS_RUIDO = [
  'subtotal', 'total', 'iva', 'descuento', 'precio', 'valor', 'cantidad',
  'descripcion', 'item', 'cod', 'ref', 'fecha', 'factura', 'nit', 'cliente',
  'direccion', 'telefono', 'observaciones', 'forma de pago', 'gracias',
  'vendedor', 'cajero', 'copie', 'original', 'duplicado', 'tirilla',
];

// ── Normaliza precios (1.500,00 o 1,500.00 → 1500) ─────────
function normalizarPrecio(precio: string): number {
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
  return parseFloat(limpio) || 0;
}

// ── Pre-procesar texto OCR ──────────────────────────────────
function preprocesarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Limpiar artefactos comunes de Tesseract
    .replace(/[|]{2,}/g, ' ')
    .replace(/[_]{3,}/g, ' ')
    .replace(/[-]{3,}/g, '\n')
    .replace(/[=]{3,}/g, '\n')
    // Normalizar espacios dentro de líneas (no los saltos)
    .split('\n')
    .map(l => l.replace(/\s{2,}/g, ' ').trim())
    .filter(l => l.length > 0)
    .join('\n');
}

// ── Estimar calidad del texto OCR ───────────────────────────
function estimarCalidadOCR(texto: string): number {
  if (!texto || texto.length < 10) return 0;
  const totalChars = texto.length;
  const alphanumeric = (texto.match(/[a-zA-Z0-9]/g) || []).length;
  const ruido = (texto.match(/[^a-zA-Z0-9\s\n.,;:$%\-\/()]/g) || []).length;
  const lineas = texto.split('\n').length;
  const lineasConContenido = texto.split('\n').filter(l => l.trim().length > 3).length;
  const ratio = alphanumeric / totalChars;
  const linearidad = lineasConContenido / Math.max(lineas, 1);
  const penalizacion = Math.min(ruido / totalChars, 0.3);
  return Math.round(Math.min(100, Math.max(0, (ratio * 60 + linearidad * 40 - penalizacion * 50))));
}

// ── Extraer proveedor ────────────────────────────────────────
function extraerProveedor(texto: string): ProveedorDetectado | null {
  const nit = texto.match(PATRONES.nit)?.[1] || '';
  const telefono = texto.match(PATRONES.telefono)?.[1]?.replace(/\s+/g, '') || '';

  // Nombre: buscar en las primeras 8 líneas la más larga con solo texto
  const lineas = texto.split('\n').slice(0, 8);
  let nombre = '';
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (
      limpia.length > 5 && limpia.length < 60 &&
      !PATRONES.nit.test(limpia) &&
      !PATRONES.telefono.test(limpia) &&
      !/^\d+$/.test(limpia) &&
      !PATRONES.numeroFactura.test(limpia)
    ) {
      nombre = limpia;
      break;
    }
  }

  if (!nombre && !nit && !telefono) return null;
  return { nombre: nombre || 'Proveedor Detectado', telefono, direccion: '', nit };
}

// ── Extraer productos ────────────────────────────────────────
function extraerProductos(texto: string): ProductoDetectado[] {
  const productos: ProductoDetectado[] = [];
  const nombresVistas = new Set<string>();

  const esRuido = (desc: string) => {
    const d = desc.toLowerCase().trim();
    return PALABRAS_RUIDO.some(r => d === r || d.startsWith(r + ' ')) ||
           d.length < 3 || /^\d+$/.test(d);
  };

  const agregar = (nombre: string, cantidad: number, precioUnitario: number, costoTotal: number, confianza: number) => {
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ').substring(0, 60);
    const key = normalizarTexto(nombreLimpio).substring(0, 12);
    if (esRuido(nombreLimpio) || nombresVistas.has(key)) return;
    const pu = precioUnitario > 0 ? precioUnitario : (costoTotal / Math.max(cantidad, 1));
    const ct = costoTotal > 0 ? costoTotal : (precioUnitario * Math.max(cantidad, 1));
    if (pu < 10 && ct < 10) return; // Ignorar valores casi cero
    nombresVistas.add(key);
    productos.push({
      id: generateId(),
      nombre: nombreLimpio,
      descripcion: nombreLimpio,
      cantidad: Math.max(cantidad, 1),
      unidad: PATRONES.unidad.exec(nombreLimpio)?.[1]?.toUpperCase() || 'UND',
      precioUnitario: pu,
      costoTotal: ct,
      categoria: sugerirCategoria(nombreLimpio),
      confianza,
    });
  };

  // Patrón 1: línea completa (cantidad + desc + precio unitario + total)
  let match: RegExpExecArray | null;
  PATRONES.lineaCompleta.lastIndex = 0;
  while ((match = PATRONES.lineaCompleta.exec(texto)) !== null) {
    agregar(match[2], parseFloat(match[1].replace(',', '.')) || 1,
      normalizarPrecio(match[3]), normalizarPrecio(match[4]), 90);
  }

  // Patrón 2: cantidad x descripción precio
  PATRONES.lineaX.lastIndex = 0;
  while ((match = PATRONES.lineaX.exec(texto)) !== null) {
    const cant = parseInt(match[1]) || 1;
    const precio = normalizarPrecio(match[3]);
    agregar(match[2], cant, precio / cant, precio, 80);
  }

  // Patrón 3: línea simple (descripción + precio al final)
  const lineas = texto.split('\n');
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (limpia.length < 5) continue;
    const precioMatch = limpia.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*$/);
    if (!precioMatch) continue;
    const descripcion = limpia.replace(precioMatch[0], '').trim();
    const precio = normalizarPrecio(precioMatch[1]);
    if (descripcion.length > 3 && precio >= 10) {
      agregar(descripcion, 1, precio, precio, 65);
    }
  }

  return productos;
}

// ============================================================
// FUNCIÓN PRINCIPAL DE OCR
// ============================================================

export async function procesarImagenFactura(
  imagen: File | string,
  onProgress?: (progress: number) => void
): Promise<ResultadoOCR> {
  const errores: string[] = [];

  try {
    const Tesseract = await import('tesseract.js');

    // Intentar con español primero, luego inglés si falla
    let textoFinal = '';
    try {
      const result = await Tesseract.recognize(
        imagen,
        'spa',
        {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text' && onProgress) {
              onProgress(Math.round(m.progress * 100));
            }
          },
        }
      );
      textoFinal = result.data.text;
    } catch {
      // Fallback sin idioma específico
      const result = await Tesseract.recognize(imagen);
      textoFinal = result.data.text;
    }

    if (!textoFinal || textoFinal.length < 15) {
      errores.push('No se pudo leer texto. Asegúrate de que la imagen sea clara, bien iluminada y sin reflejos.');
      return { texto: '', textoLimpio: '', proveedor: null, productos: [], fechaFactura: null, numeroFactura: null, total: null, errores, calidadOCR: 0 };
    }

    const textoLimpio = preprocesarTexto(textoFinal);
    const calidadOCR = estimarCalidadOCR(textoLimpio);

    if (calidadOCR < 20) {
      errores.push(`Calidad de imagen baja (${calidadOCR}%). Mejora la iluminación o sube una foto más nítida.`);
    }

    const proveedor = extraerProveedor(textoLimpio);
    const productos = extraerProductos(textoLimpio);

    const fechaMatch = textoLimpio.match(PATRONES.fecha) || textoLimpio.match(PATRONES.fechaTexto);
    const numeroMatch = textoLimpio.match(PATRONES.numeroFactura);
    const totalMatch = textoLimpio.match(PATRONES.total);

    if (productos.length === 0) {
      errores.push('No se detectaron productos. Intenta con imagen más clara o ingresa los datos manualmente.');
    }

    return {
      texto: textoFinal,
      textoLimpio,
      proveedor,
      productos,
      fechaFactura: fechaMatch ? (fechaMatch[1] + (fechaMatch[2] ? '/' + fechaMatch[2] : '')) : null,
      numeroFactura: numeroMatch?.[1] || null,
      total: totalMatch ? normalizarPrecio(totalMatch[1]) : null,
      errores,
      calidadOCR,
    };
  } catch (error) {
    console.error('[OCR Forense] Error crítico:', error);
    errores.push('Error al procesar imagen: ' + (error as Error).message);
    return { texto: '', textoLimpio: '', proveedor: null, productos: [], fechaFactura: null, numeroFactura: null, total: null, errores, calidadOCR: 0 };
  }
}

// ============================================================
// SUGERENCIA DE CATEGORÍAS (panadería colombiana)
// ============================================================

export function sugerirCategoria(nombreProducto: string): string {
  const nombre = normalizarTexto(nombreProducto);

  const categorias: Record<string, string[]> = {
    'Harinas': ['harina', 'trigo', 'maiz', 'avena', 'centeno', 'fecula', 'almidon', 'premezcla', 'mezcla pan', 'mezcla torta'],
    'Lácteos': ['leche', 'crema', 'mantequilla', 'queso', 'yogurt', 'lacteo', 'suero', 'cuajada', 'kefir', 'kumis'],
    'Azúcares': ['azucar', 'miel', 'panela', 'endulzante', 'edulcorante', 'stevia', 'fructosa', 'glucosa', 'jarabe'],
    'Huevos': ['huevo', 'clara', 'yema', 'huevo liquido'],
    'Aceites y Grasas': ['aceite', 'manteca', 'margarina', 'grasa', 'palma', 'girasol', 'canola', 'shortening'],
    'Frutas y Verduras': ['manzana', 'fresa', 'mora', 'naranja', 'limon', 'uva', 'durazno', 'mango', 'cereza', 'cebolla', 'ajo', 'pimenton', 'tomate', 'banano', 'fruta'],
    'Chocolates': ['chocolate', 'cacao', 'cocoa', 'nutella', 'colacao', 'milo', 'chips chocolate'],
    'Levaduras': ['levadura', 'polvo hornear', 'bicarbonato', 'royal', 'leudante', 'cremor'],
    'Esencias': ['esencia', 'vainilla', 'extracto', 'aroma'],
    'Empaques': ['bolsa', 'caja', 'empaque', 'envase', 'bandeja', 'papel', 'film', 'vinipel', 'domo', 'tarrina', 'servilleta', 'pitillo'],
    'Limpieza': ['detergente', 'jabon', 'desinfectante', 'limpiador', 'cloro', 'lavaloza', 'antibacterial', 'ajax', 'vim'],
    'Rellenos y Cárnicos': ['jamon', 'mortadela', 'tocino', 'chorizo', 'carne', 'pollo', 'atun', 'bocadillo', 'arequipe', 'mermelada', 'crema pastelera', 'chantilly', 'dulce leche'],
    'Decoración': ['sprinkles', 'grageas', 'perlas', 'colorante', 'fondant', 'granillo', 'brillo', 'azucar glass', 'lustre', 'glase'],
    'Frutos Secos': ['nuez', 'almendra', 'ajonjoli', 'chia', 'linaza', 'mani', 'pistacho', 'semilla', 'quinoa', 'avellana', 'pasas', 'datil'],
    'Aditivos': ['propionato', 'antimoho', 'sorbato', 'benzoato', 'antioxidante', 'emulsionante', 'mejorador', 'conservante'],
    'Sal y Especias': ['sal', 'pimienta', 'canela', 'nuez moscada', 'oregano', 'tomillo', 'comino', 'curry', 'jengibre'],
    'Servicios/Varios': ['agua', 'luz', 'gas', 'arriendo', 'nomina', 'reparacion', 'mantenimiento'],
  };

  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(p => nombre.includes(p))) return categoria;
  }
  return 'General';
}
