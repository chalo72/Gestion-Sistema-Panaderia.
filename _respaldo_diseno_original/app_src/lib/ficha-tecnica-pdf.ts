import type { FormulacionBase, Receta, Producto } from '@/types';
import { descargarInformePdf, type InformePdfDatos } from '@/lib/informe-pdf';

type NombreProducto = (id: string) => string;
type FormatMoney = (n: number) => string;

const pasosDesdeTexto = (texto?: string): string[] => {
  const raw = (texto || '').trim();
  if (!raw) return [];

  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const lista = Array.isArray(parsed) ? parsed : [parsed];
      return lista
        .map((p) => {
          if (p && typeof p === 'object' && 'descripcion' in p) {
            const d = String((p as { descripcion: unknown }).descripcion ?? '');
            const t = (p as { titulo?: unknown }).titulo;
            return t ? `${String(t)}: ${d}` : d;
          }
          return typeof p === 'string' ? p : '';
        })
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      /* sigue como texto plano */
    }
  }

  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
};

/** Construye el PDF de una receta tradicional (ficha de producto). */
export const datosPdfReceta = (
  receta: Receta,
  producto: Producto | undefined,
  nombreInsumo: NombreProducto,
  formatCurrency: FormatMoney
): InformePdfDatos => {
  const nombre = producto?.nombre || 'Receta sin producto';
  const pasos = pasosDesdeTexto(receta.instrucciones);

  const filasInsumos = (receta.ingredientes || []).map((ing) => [
    nombreInsumo(ing.productoId),
    `${ing.cantidad} ${ing.unidad}`,
    formatCurrency(Number(ing.costoCalculado) || 0),
  ]);

  const secciones: InformePdfDatos['secciones'] = [
    {
      titulo: 'Información general',
      encabezados: ['Campo', 'Valor'],
      filas: [
        ['Producto', nombre],
        ['Categoría', producto?.categoria || '—'],
        ['Porciones / unidades', String(receta.porcionesResultantes || 0)],
        ['Dificultad', receta.dificultad || '—'],
        ['Temp. horno (°C)', receta.temperaturaHorno != null ? String(receta.temperaturaHorno) : '—'],
        ['Tiempo horneado (min)', receta.tiempoHorneado != null ? String(receta.tiempoHorneado) : '—'],
        ['Tiempo fermentación (min)', receta.tiempoFermentacion != null ? String(receta.tiempoFermentacion) : '—'],
        ['Actualización', receta.fechaActualizacion ? new Date(receta.fechaActualizacion).toLocaleDateString('es-CO') : '—'],
      ],
    },
    {
      titulo: 'Insumos',
      encabezados: ['Insumo', 'Cantidad', 'Costo'],
      filas: filasInsumos.length > 0 ? filasInsumos : [['Sin insumos', '—', '—']],
    },
  ];

  if (pasos.length > 0) {
    secciones.push({
      titulo: 'Proceso / ficha técnica (pasos)',
      encabezados: ['#', 'Paso'],
      filas: pasos.map((p, i) => [String(i + 1), p]),
    });
  }

  return {
    titulo: `Ficha técnica · ${nombre}`,
    kpis: [
      { label: 'Costo total', value: formatCurrency(Number(receta.costoTotal) || 0) },
      { label: 'Costo / unidad', value: formatCurrency(Number(receta.costoPorPorcion) || 0) },
      { label: 'Precio venta', value: formatCurrency(Number(producto?.precioVenta) || 0) },
      { label: 'Insumos', value: String((receta.ingredientes || []).length) },
    ],
    secciones,
  };
};

/** Resumen general de todas las recetas técnicas. */
export const datosPdfCatalogoRecetas = (
  recetas: Receta[],
  getProducto: (id: string) => Producto | undefined,
  formatCurrency: FormatMoney
): InformePdfDatos => {
  const filas = recetas.map((r) => {
    const p = getProducto(r.productoId);
    return [
      p?.nombre || r.productoId,
      p?.categoria || '—',
      String(r.porcionesResultantes || 0),
      String((r.ingredientes || []).length),
      formatCurrency(Number(r.costoTotal) || 0),
      formatCurrency(Number(r.costoPorPorcion) || 0),
      r.dificultad || '—',
    ];
  });

  return {
    titulo: 'Catálogo general · Fichas técnicas de recetas',
    kpis: [
      { label: 'Recetas', value: String(recetas.length) },
      {
        label: 'Con pasos',
        value: String(recetas.filter((r) => pasosDesdeTexto(r.instrucciones).length > 0).length),
      },
    ],
    secciones: [
      {
        titulo: 'Resumen de fichas',
        encabezados: ['Producto', 'Categoría', 'Unidades', 'Insumos', 'Costo total', 'Costo/ud', 'Dificultad'],
        filas: filas.length > 0 ? filas : [['Sin recetas', '—', '—', '—', '—', '—', '—']],
      },
    ],
  };
};

/** Ficha de formulación maestra (por arroba) — usada en Producción / Guías. */
export const datosPdfFormulacion = (
  f: FormulacionBase,
  nombreInsumo: NombreProducto,
  formatCurrency: FormatMoney
): InformePdfDatos => {
  const pasos = pasosDesdeTexto(f.instrucciones);
  const filasIng = (f.ingredientes || []).map((ing) => [
    nombreInsumo(ing.productoId),
    `${ing.cantidadPorArroba} ${ing.unidad}`,
    formatCurrency(Number(ing.costoTotalArroba) || 0),
  ]);

  const secciones: InformePdfDatos['secciones'] = [
    {
      titulo: 'Información general',
      encabezados: ['Campo', 'Valor'],
      filas: [
        ['Nombre', f.nombre],
        ['Categoría', f.categoria],
        ['Descripción', f.descripcion || '—'],
        ['Rendimiento base (kg)', String(f.rendimientoBaseKg ?? '—')],
        ['Kg por arroba real', f.kgPorArrobaReal != null ? String(f.kgPorArrobaReal) : '—'],
        ['Temp. horno (°C)', f.temperaturaHorno != null ? String(f.temperaturaHorno) : '—'],
        ['Tiempo horneado (min)', f.tiempoHorneado != null ? String(f.tiempoHorneado) : '—'],
        ['Tiempo fermentación (min)', f.tiempoFermentacion != null ? String(f.tiempoFermentacion) : '—'],
        ['Activa', f.activo ? 'Sí' : 'No'],
      ],
    },
    {
      titulo: 'Insumos por arroba',
      encabezados: ['Insumo', 'Cantidad / arroba', 'Costo / arroba'],
      filas: filasIng.length > 0 ? filasIng : [['Sin insumos', '—', '—']],
    },
  ];

  const sospechosos = (f.ingredientes || []).filter((i) => Number(i.costoTotalArroba) >= 5_000_000);
  if (sospechosos.length > 0) {
    secciones.push({
      titulo: 'ALERTA: costos imposibles detectados',
      encabezados: ['Insumo', 'Costo registrado', 'Acción'],
      filas: sospechosos.map((i) => [
        nombreInsumo(i.productoId),
        formatCurrency(Number(i.costoTotalArroba) || 0),
        'Recalcular en Recetas → Recalcular costos. Revisar bulto÷kg en Proveedores.',
      ]),
    });
  }

  if (pasos.length > 0) {
    secciones.push({
      titulo: 'Instrucciones de elaboración',
      encabezados: ['#', 'Paso'],
      filas: pasos.map((p, i) => [String(i + 1), p]),
    });
  }

  return {
    titulo: `Ficha técnica · ${f.nombre}`,
    kpis: [
      { label: 'Costo / arroba', value: formatCurrency(Number(f.costoTotalArroba) || 0) },
      { label: 'Insumos', value: String((f.ingredientes || []).length) },
      { label: 'Pasos', value: String(pasos.length) },
    ],
    secciones,
  };
};

export const descargarPdfReceta = async (
  receta: Receta,
  producto: Producto | undefined,
  nombreInsumo: NombreProducto,
  formatCurrency: FormatMoney
): Promise<void> => {
  await descargarInformePdf(datosPdfReceta(receta, producto, nombreInsumo, formatCurrency));
};

export const descargarPdfCatalogoRecetas = async (
  recetas: Receta[],
  getProducto: (id: string) => Producto | undefined,
  formatCurrency: FormatMoney
): Promise<void> => {
  await descargarInformePdf(datosPdfCatalogoRecetas(recetas, getProducto, formatCurrency));
};

export const descargarPdfFormulacion = async (
  f: FormulacionBase,
  nombreInsumo: NombreProducto,
  formatCurrency: FormatMoney
): Promise<void> => {
  await descargarInformePdf(datosPdfFormulacion(f, nombreInsumo, formatCurrency));
};

export const descargarPdfCatalogoFormulaciones = async (
  formulaciones: FormulacionBase[],
  nombreInsumo: NombreProducto,
  formatCurrency: FormatMoney
): Promise<void> => {
  const lista = formulaciones.filter((f) => f.activo !== false);
  const filas = lista.map((f) => [
    f.nombre,
    f.categoria,
    String((f.ingredientes || []).length),
    formatCurrency(Number(f.costoTotalArroba) || 0),
    f.temperaturaHorno != null ? `${f.temperaturaHorno}°C` : '—',
    f.tiempoFermentacion != null ? `${f.tiempoFermentacion} min` : '—',
    pasosDesdeTexto(f.instrucciones).length > 0 ? 'Sí' : 'No',
  ]);

  await descargarInformePdf({
    titulo: 'Catálogo general · Formulaciones / fichas técnicas',
    kpis: [
      { label: 'Fórmulas', value: String(lista.length) },
      {
        label: 'Con instructivo',
        value: String(lista.filter((f) => pasosDesdeTexto(f.instrucciones).length > 0).length),
      },
    ],
    secciones: [
      {
        titulo: 'Resumen',
        encabezados: ['Nombre', 'Categoría', 'Insumos', 'Costo/arroba', 'Horno', 'Fermentación', 'Pasos'],
        filas: filas.length > 0 ? filas : [['Sin fórmulas', '—', '—', '—', '—', '—', '—']],
      },
    ],
  });
};
