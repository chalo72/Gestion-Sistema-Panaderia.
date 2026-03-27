// Servicio OCR para lectura de facturas con Tesseract.js

export interface ProductoDetectado {
  id: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  costoTotal: number;
  categoria: string;
  confianza: number; // Porcentaje de confianza en la detección
}

export interface ProveedorDetectado {
  nombre: string;
  telefono: string;
  direccion: string;
  nit: string;
}

export interface ResultadoOCR {
  texto: string;
  proveedor: ProveedorDetectado | null;
  productos: ProductoDetectado[];
  fechaFactura: string | null;
  numeroFactura: string | null;
  total: number | null;
  errores: string[];
}

// Genera un ID único
function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Patrones comunes en facturas colombianas/latinas
const PATRONES = {
  // Detectar línea de producto: cantidad, descripción, precio unitario, total
  lineaProducto: /(\d+(?:[.,]\d+)?)\s*(?:UND|UN|KG|GR|LB|LT|ML|PQ|CJ|BL)?\s+(.+?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
  
  // Patrones alternativos
  lineaSimple: /^(.+?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$/gm,
  
  // Detectar proveedor (NIT, nombre comercial)
  nit: /(?:NIT|N\.I\.T|RUT)[\s:]*(\d{1,3}(?:[.,]\d{3})*-?\d?)/i,
  telefono: /(?:TEL|TELEFONO|CEL|CELULAR|MOVIL)[\s:]*(\d{3}[\s.-]?\d{3}[\s.-]?\d{4})/i,
  
  // Detectar fecha de factura
  fecha: /(?:FECHA|FEC)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  
  // Detectar número de factura
  numeroFactura: /(?:FACTURA|FAC|FACT|No\.|NUM|NUMERO)[\s:#]*([A-Z0-9\-]+)/i,
  
  // Detectar total
  total: /(?:TOTAL|SUBTOTAL|VALOR TOTAL)[\s:$]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
  
  // Unidades de medida
  unidad: /(UND|UN|KG|GR|LB|LT|ML|PQ|CJ|BL|UNIDAD|KILO|GRAMO|LIBRA|LITRO)/i,
};

// Normaliza precios (1.500,00 o 1,500.00 → 1500)
function normalizarPrecio(precio: string): number {
  if (!precio) return 0;
  // Remover espacios
  let limpio = precio.replace(/\s/g, '');
  // Detectar formato: si tiene punto y coma, determinar cuál es decimal
  const tienePunto = limpio.includes('.');
  const tieneComa = limpio.includes(',');
  
  if (tienePunto && tieneComa) {
    // Formato europeo: 1.500,00 → punto es miles, coma es decimal
    if (limpio.lastIndexOf(',') > limpio.lastIndexOf('.')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 1,500.00
      limpio = limpio.replace(/,/g, '');
    }
  } else if (tieneComa) {
    // Solo coma: puede ser 1,500 (miles) o 15,00 (decimal)
    const partes = limpio.split(',');
    if (partes[1]?.length === 2) {
      limpio = limpio.replace(',', '.');
    } else {
      limpio = limpio.replace(/,/g, '');
    }
  } else if (tienePunto) {
    // Solo punto: puede ser 1.500 (miles) o 15.00 (decimal)
    const partes = limpio.split('.');
    if (partes[1]?.length === 2) {
      // Es decimal
    } else {
      limpio = limpio.replace(/\./g, '');
    }
  }
  
  return parseFloat(limpio) || 0;
}

// Extraer información del proveedor
function extraerProveedor(texto: string): ProveedorDetectado | null {
  const nit = texto.match(PATRONES.nit)?.[1] || '';
  const telefono = texto.match(PATRONES.telefono)?.[1] || '';
  
  // Intentar extraer nombre del proveedor (usualmente en las primeras líneas)
  const lineas = texto.split('\n').slice(0, 5);
  let nombre = '';
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (limpia.length > 5 && limpia.length < 50 && !PATRONES.nit.test(limpia) && !PATRONES.telefono.test(limpia)) {
      nombre = limpia;
      break;
    }
  }
  
  if (!nombre && !nit) return null;
  
  return {
    nombre: nombre || 'Proveedor Desconocido',
    telefono,
    direccion: '',
    nit,
  };
}

// Extraer productos de las líneas
function extraerProductos(texto: string): ProductoDetectado[] {
  const productos: ProductoDetectado[] = [];
  const lineas = texto.split('\n');
  
  for (const linea of lineas) {
    const limpia = linea.trim();
    if (limpia.length < 5) continue;
    
    // Intentar varios patrones
    let match = PATRONES.lineaProducto.exec(limpia);
    PATRONES.lineaProducto.lastIndex = 0; // Reset regex
    
    if (match) {
      const cantidad = parseFloat(match[1].replace(',', '.')) || 1;
      const descripcion = match[2].trim();
      const precioUnitario = normalizarPrecio(match[3]);
      const costoTotal = normalizarPrecio(match[4]);
      
      if (descripcion && (precioUnitario > 0 || costoTotal > 0)) {
        productos.push({
          id: generateId(),
          nombre: descripcion.substring(0, 50),
          descripcion: descripcion,
          cantidad,
          unidad: 'UND',
          precioUnitario: precioUnitario || (costoTotal / cantidad),
          costoTotal: costoTotal || (precioUnitario * cantidad),
          categoria: '',
          confianza: 85,
        });
      }
      continue;
    }
    
    // Patrón más simple: buscar líneas con precios
    const precioMatch = limpia.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/);
    if (precioMatch) {
      const descripcion = limpia.replace(precioMatch[0], '').trim();
      const precio = normalizarPrecio(precioMatch[1]);
      
      if (descripcion.length > 3 && precio > 100) { // Filtrar ruido
        productos.push({
          id: generateId(),
          nombre: descripcion.substring(0, 50),
          descripcion: descripcion,
          cantidad: 1,
          unidad: 'UND',
          precioUnitario: precio,
          costoTotal: precio,
          categoria: '',
          confianza: 60,
        });
      }
    }
  }
  
  return productos;
}

// Función principal de OCR
export async function procesarImagenFactura(
  imagen: File | string,
  onProgress?: (progress: number) => void
): Promise<ResultadoOCR> {
  const errores: string[] = [];
  
  try {
    // Cargar Tesseract dinámicamente solo cuando se necesita
    const Tesseract = await import('tesseract.js');
    
    // Ejecutar OCR con Tesseract
    const result = await Tesseract.recognize(
      imagen,
      'spa', // Español
      {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      }
    );
    
    const texto = result.data.text;
    
    if (!texto || texto.length < 20) {
      errores.push('No se pudo leer texto de la imagen. Asegúrate de que la imagen sea clara.');
      return { texto: '', proveedor: null, productos: [], fechaFactura: null, numeroFactura: null, total: null, errores };
    }
    
    // Extraer información
    const proveedor = extraerProveedor(texto);
    const productos = extraerProductos(texto);
    
    // Extraer metadatos
    const fechaMatch = texto.match(PATRONES.fecha);
    const numeroMatch = texto.match(PATRONES.numeroFactura);
    const totalMatch = texto.match(PATRONES.total);
    
    if (productos.length === 0) {
      errores.push('No se detectaron productos. Intenta con una imagen más clara o ingresa los datos manualmente.');
    }
    
    return {
      texto,
      proveedor,
      productos,
      fechaFactura: fechaMatch?.[1] || null,
      numeroFactura: numeroMatch?.[1] || null,
      total: totalMatch ? normalizarPrecio(totalMatch[1]) : null,
      errores,
    };
  } catch (error) {
    console.error('Error en OCR:', error);
    errores.push('Error al procesar la imagen: ' + (error as Error).message);
    return { texto: '', proveedor: null, productos: [], fechaFactura: null, numeroFactura: null, total: null, errores };
  }
}

// Sugerencia de categorías basadas en palabras clave
export function sugerirCategoria(nombreProducto: string): string {
  const nombre = nombreProducto.toLowerCase();
  
  const categorias: Record<string, string[]> = {
    'Harinas': ['harina', 'trigo', 'maiz', 'avena', 'centeno', 'fecula', 'almidon', 'premezcla'],
    'Lácteos': ['leche', 'crema', 'mantequilla', 'queso', 'yogurt', 'lacteo', 'suero', 'cuajada', 'kefir'],
    'Azúcares': ['azucar', 'azúcar', 'miel', 'panela', 'endulzante', 'edulcorante', 'steva', 'fructosa'],
    'Huevos': ['huevo', 'huevos', 'clara', 'yema', 'huevo liquido'],
    'Aceites': ['aceite', 'manteca', 'margarina', 'grasa', 'palma', 'girasol'],
    'Frutas y Verduras': ['fruta', 'frutas', 'manzana', 'fresa', 'mora', 'naranja', 'limon', 'uva', 'durazno', 'mango', 'cereza', 'cebolla', 'ajo', 'pimenton'],
    'Chocolates': ['chocolate', 'cacao', 'cocoa', 'nutella', 'colacao', 'milo'],
    'Levaduras': ['levadura', 'polvo de hornear', 'bicarbonato', 'royal', 'leudante'],
    'Esencias': ['esencia', 'vainilla', 'extracto', 'aroma', 'esencia de'],
    'Empaques': ['bolsa', 'caja', 'empaque', 'envase', 'bandeja', 'papel', 'film', 'vinipel', 'domo', 'tarrina'],
    'Limpieza': ['detergente', 'jabon', 'desinfectante', 'limpiador', 'cloro', 'lavaloza', 'antibacterial'],
    'Rellenos y Cárnicos': ['jamon', 'mortadela', 'tocino', 'chorizo', 'carne', 'pollo', 'atun', 'bocadillo', 'arequipe', 'mermelada', 'crema pastelera', 'chantilly'],
    'Decoración y Coberturas': ['sprinkles', 'grageas', 'perlas', 'colorante', 'fondant', 'granillo', 'brillo', 'perla', 'azucar glass'],
    'Frutos Secos y Semillas': ['nuez', 'almendra', 'ajonjoli', 'chia', 'linaza', 'mani', 'pistacho', 'semilla', 'quinoa', 'avellana'],
    'Aditivos y Conservantes': ['propionato', 'antimoho', 'sorbato', 'benzoato', 'antioxidante', 'emulsionante', 'mejorador'],
    'Utensilios y Despacho': ['servilleta', 'pitillo', 'venero', 'tenedor', 'cuchara', 'cuchillo', 'plato desechable', 'espatula', 'brocha'],
    'Servicios/Varios': ['agua', 'luz', 'gas', 'arriendo', 'nomina', 'reparacion', 'mantenimiento', 'materia prima general']
  };
  
  for (const [categoria, palabras] of Object.entries(categorias)) {
    if (palabras.some(p => nombre.includes(p))) {
      return categoria;
    }
  }
  
  return 'General';
}
