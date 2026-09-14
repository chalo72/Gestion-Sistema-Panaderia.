import type { ColumnaFacturaPerfil, PerfilFacturaProveedor, ZonaFacturaPerfil } from '@/types';
import type { ResultadoForense, TipoFactura } from '@/lib/ocr-service';
import { extraerLineasConPerfil } from '@/lib/factura-lector-perfil';

export const VERSION_PERFIL_FACTURA = 1 as const;

const ETIQUETAS_TIPO: Record<TipoFactura, string> = {
  tipo1_dimensiones: 'Formato A×B×gramaje (distribuidoras)',
  tipo2_columnas: 'Columnas UNIDADES + CANTIDAD',
  tipo3_lista_precios: 'Lista con columna PRESENTACIÓN',
  tipo4_dian: 'Factura electrónica DIAN',
  tipo5_tiquete: 'Tiquete POS simple',
  tipo6_remision: 'Remisión / nota de entrega',
  tipo7_superficie: 'SKU + descripción (mayoristas)',
  tipo8_compleja: 'Desglose IVA + descuento + PVP',
  desconocido: 'Formato por confirmar',
};

const REGLAS_POR_TIPO: Record<TipoFactura, string[]> = {
  tipo1_dimensiones: [
    'La cantidad al inicio de la línea son cajas/pacas compradas.',
    'Los números A×B×g del nombre son empaque, no cantidad comprada.',
    'El precio al final de la línea es el total de esa fila.',
  ],
  tipo2_columnas: [
    'Separar columnas por espacios amplios o tabulación.',
    'UNIDADES = unidades por empaque; CANTIDAD = packs comprados.',
  ],
  tipo3_lista_precios: [
    'La columna PRESENTACIÓN describe el empaque, no la cantidad comprada.',
    'Usar el precio de la fila como costo del pack.',
  ],
  tipo4_dian: [
    'Ignorar bloques CUFE, QR y textos legales DIAN.',
    'Leer ítems en el cuerpo; total en el pie.',
  ],
  tipo5_tiquete: [
    'Patrón: cantidad + descripción + precio al final.',
    'Ignorar encabezado de caja y mensajes promocionales.',
  ],
  tipo6_remision: [
    'Puede no traer precios; solo registrar cantidades y descripción.',
  ],
  tipo7_superficie: [
    'Quitar SKU numérico largo al inicio antes del nombre.',
    'Precio suele estar al final de cada línea.',
  ],
  tipo8_compleja: [
    'Usar precio sin IVA menos descuento como costo real.',
    'PVP sugerido es referencia, no precio de venta automático.',
  ],
  desconocido: [
    'Revisar manualmente la primera vez hasta confirmar el perfil.',
  ],
};

const COLUMNAS_POR_TIPO: Record<TipoFactura, ColumnaFacturaPerfil[]> = {
  tipo1_dimensiones: [
    { id: 'cantidad', etiqueta: 'Cantidad comprada', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción (A×B×g)', orden: 2, presente: true },
    { id: 'precio', etiqueta: 'Valor línea', orden: 3, presente: true },
  ],
  tipo2_columnas: [
    { id: 'descripcion', etiqueta: 'Producto', orden: 1, presente: true },
    { id: 'unidades', etiqueta: 'Unidades/pack', orden: 2, presente: true },
    { id: 'cantidad', etiqueta: 'Cantidad packs', orden: 3, presente: true },
    { id: 'precio', etiqueta: 'Precio', orden: 4, presente: true },
  ],
  tipo3_lista_precios: [
    { id: 'descripcion', etiqueta: 'Producto', orden: 1, presente: true },
    { id: 'presentacion', etiqueta: 'Presentación', orden: 2, presente: true },
    { id: 'precio', etiqueta: 'Precio', orden: 3, presente: true },
  ],
  tipo4_dian: [
    { id: 'codigo', etiqueta: 'Código', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción', orden: 2, presente: true },
    { id: 'cantidad', etiqueta: 'Cantidad', orden: 3, presente: true },
    { id: 'precio', etiqueta: 'Precio unitario', orden: 4, presente: true },
    { id: 'iva', etiqueta: 'IVA', orden: 5, presente: true },
    { id: 'total', etiqueta: 'Total línea', orden: 6, presente: true },
  ],
  tipo5_tiquete: [
    { id: 'cantidad', etiqueta: 'Cant.', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción', orden: 2, presente: true },
    { id: 'precio', etiqueta: 'Precio', orden: 3, presente: true },
  ],
  tipo6_remision: [
    { id: 'cantidad', etiqueta: 'Cantidad', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción', orden: 2, presente: true },
  ],
  tipo7_superficie: [
    { id: 'sku', etiqueta: 'SKU / Código', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción', orden: 2, presente: true },
    { id: 'precio', etiqueta: 'Precio', orden: 3, presente: true },
  ],
  tipo8_compleja: [
    { id: 'cantidad', etiqueta: 'Cant.', orden: 1, presente: true },
    { id: 'descripcion', etiqueta: 'Descripción', orden: 2, presente: true },
    { id: 'precio_sin_iva', etiqueta: 'P/ unit s/ IVA', orden: 3, presente: true },
    { id: 'descuento', etiqueta: 'Descuento %', orden: 4, presente: true },
    { id: 'iva', etiqueta: 'IVA', orden: 5, presente: true },
    { id: 'pvp', etiqueta: 'PVP ref.', orden: 6, presente: true },
  ],
  desconocido: [
    { id: 'descripcion', etiqueta: 'Descripción', orden: 1, presente: true },
    { id: 'precio', etiqueta: 'Precio', orden: 2, presente: false },
  ],
};

const TEXTOS_IGNORAR_BASE = [
  'subtotal', 'sub-total', 'sub total', 'total', 'iva', 'descuento', 'factura electrónica', 'cufe', 'cude',
  'resolución dian', 'autorización', 'forma de pago', 'gracias por su compra',
  'vendedor', 'cajero', 'original', 'copia', 'nit cliente', 'qr',
  'términos y condiciones', 'publicidad', 'promoción',
  'observaciones', 'observacion', 'efectos legales', 'no aceptamos',
  'esta factura de venta', 'total a pagar', 'gran total', 'valor total',
];

export function etiquetaTipoFactura(tipo: TipoFactura): string {
  return ETIQUETAS_TIPO[tipo] ?? ETIQUETAS_TIPO.desconocido;
}

const PATRON_INICIO_PIE =
  /(?:sub[\s-]?total|observaci[oó]n|olservaci[oó]n|efectos legales|esta factura de venta|total a pagar|gran total|valor total|base gravable|forma de pago|^\s*total\b)/i;

export function inferirZonasFactura(textoOriginal: string): ZonaFacturaPerfil[] {
  const lineas = textoOriginal.split('\n').map((l) => l.trim()).filter(Boolean);
  const total = lineas.length;
  if (total === 0) {
    return [
      { id: 'cabecera', titulo: 'Cabecera', descripcion: 'Proveedor, NIT, fecha y número', lineaInicio: 0, lineaFin: 0 },
      { id: 'tabla', titulo: 'Tabla de ítems', descripcion: 'Productos, códigos y valores', lineaInicio: 0, lineaFin: 0 },
      { id: 'pie', titulo: 'Pie / totales', descripcion: 'Subtotal, IVA y total a pagar', lineaInicio: 0, lineaFin: 0 },
    ];
  }

  let pieIni = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (PATRON_INICIO_PIE.test(lineas[i])) {
      pieIni = i + 1;
      break;
    }
  }
  if (pieIni === 0) {
    pieIni = Math.max(2, Math.floor(total * 0.88) + 1);
  }

  const cabFin = Math.max(1, Math.min(4, Math.floor(total * 0.2)));

  return [
    {
      id: 'cabecera',
      titulo: 'Cabecera',
      descripcion: 'Proveedor, NIT, fecha, número de factura',
      lineaInicio: 1,
      lineaFin: cabFin,
    },
    {
      id: 'tabla',
      titulo: 'Tabla de ítems',
      descripcion: 'Líneas de productos con cantidades y precios',
      lineaInicio: cabFin + 1,
      lineaFin: Math.max(cabFin + 1, pieIni - 1),
    },
    {
      id: 'pie',
      titulo: 'Pie / totales',
      descripcion: 'Subtotal, IVA, descuentos y total',
      lineaInicio: pieIni,
      lineaFin: total,
    },
  ];
}

/** Comprime la imagen de referencia para IndexedDB (máx. ~900px ancho). */
export async function comprimirImagenFacturaReferencia(
  file: File,
  maxAncho = 900,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen');
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, maxAncho / Math.max(img.width, 1));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error('Error al comprimir imagen'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida o corrupta'));
    };
    img.src = url;
  });
}

/** Construye el perfil estructural (sin registrar productos en catálogo). */
export function construirPerfilFacturaProveedor(
  resultado: ResultadoForense,
  imagenReferencia: string,
): PerfilFacturaProveedor {
  const tipo = resultado.tipoFactura;
  const lineas = resultado.textoOriginal.split('\n').filter((l) => l.trim()).length;

  const perfilBase: PerfilFacturaProveedor = {
    version: VERSION_PERFIL_FACTURA,
    activo: true,
    imagenReferencia,
    tipoFactura: tipo,
    etiquetaTipo: etiquetaTipoFactura(tipo),
    nitDetectado: resultado.proveedor.nit || undefined,
    razonSocialDetectada: resultado.proveedor.razonSocial || undefined,
    numeroFacturaEjemplo: resultado.numeroFactura || undefined,
    fechaFacturaEjemplo: resultado.fechaFactura || undefined,
    totalFacturaEjemplo: resultado.totalFactura > 0 ? resultado.totalFactura : undefined,
    zonas: inferirZonasFactura(resultado.textoOriginal),
    columnas: COLUMNAS_POR_TIPO[tipo] ?? COLUMNAS_POR_TIPO.desconocido,
    textosIgnorar: [...TEXTOS_IGNORAR_BASE],
    reglasLectura: REGLAS_POR_TIPO[tipo] ?? REGLAS_POR_TIPO.desconocido,
    calidadReferencia: resultado.calidadOCR,
    lineasEjemploDetectadas: lineas,
    analizadoEn: new Date().toISOString(),
  };

  const lineasEjemplo = extraerLineasConPerfil(resultado.textoOriginal, perfilBase);
  return {
    ...perfilBase,
    lineasEjemplo: lineasEjemplo.length > 0 ? lineasEjemplo : undefined,
  };
}

export function proveedorTienePerfilFactura(
  perfil?: PerfilFacturaProveedor | null,
): perfil is PerfilFacturaProveedor {
  return Boolean(perfil?.activo && perfil.version === VERSION_PERFIL_FACTURA);
}
