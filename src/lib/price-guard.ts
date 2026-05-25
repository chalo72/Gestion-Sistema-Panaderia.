/**
 * PRICE GUARD — Nivel 1 de protección de precios
 * Valida márgenes y cambios de precio antes de guardar.
 * Bloquea datos erróneos y advierte sobre cambios inusuales.
 */

export const LIMITES_PRECIO = {
  MAX_MARGEN_PORCENTAJE: 400,   // Margen máximo permitido (400%)
  MAX_CAMBIO_PRECIO: 250,       // % máximo de cambio en una actualización
  MIN_PRECIO_POSITIVO: 1,       // Precio mínimo válido
  MAX_EMBALAJE: 10000,          // Cantidad máxima razonable de unidades por embalaje
};

export interface ResultadoValidacion {
  valido: boolean;
  bloquear: boolean;
  advertencias: string[];        // todos los mensajes (errores primero, luego suaves)
  erroresBloqueantes: string[];  // solo los que impiden guardar
}

/**
 * Valida un ítem del catálogo de proveedor antes de guardar.
 */
export function validarItemCatalogo(
  item: {
    nombre: string;
    precioCosto: number;
    cantidadEmbalaje: number;
    costoUnitario: number;
    precioVenta: number;
    margenVenta: number;
    destino?: 'insumo' | 'venta';
  },
  precioCostoAnterior?: number
): ResultadoValidacion {
  const bloqueantes: string[] = [];
  const suaves: string[] = [];
  const nombre = `"${item.nombre}"`;

  // — Bloqueos duros —
  if (!item.precioCosto || item.precioCosto <= 0) {
    bloqueantes.push(`${nombre}: el precio de costo no puede ser cero o negativo.`);
  }

  if (!item.cantidadEmbalaje || item.cantidadEmbalaje <= 0) {
    bloqueantes.push(`${nombre}: la cantidad de embalaje debe ser mayor a 0.`);
  }

  if (item.cantidadEmbalaje > LIMITES_PRECIO.MAX_EMBALAJE) {
    bloqueantes.push(`${nombre}: cantidad de embalaje (${item.cantidadEmbalaje}) parece incorrecta.`);
  }

  // Solo bloquear por margen excesivo si el costo unitario es válido y positivo
  // (evita falsos positivos cuando costoUnitario ≈ 0 por rounding)
  if (
    item.costoUnitario > 0 &&
    item.margenVenta > 0 &&
    item.margenVenta > LIMITES_PRECIO.MAX_MARGEN_PORCENTAJE
  ) {
    bloqueantes.push(
      `${nombre}: margen ${item.margenVenta.toFixed(0)}% supera el límite de ${LIMITES_PRECIO.MAX_MARGEN_PORCENTAJE}%. ` +
      `¿Verificaste la cantidad de embalaje?`
    );
  }

  // — Advertencias suaves (no bloquean) —
  // Solo para productos de venta; los insumos pueden tener costo > precio de venta
  if (item.destino !== 'insumo' && item.precioVenta > 0 && item.costoUnitario > item.precioVenta) {
    suaves.push(
      `${nombre}: costo unitario ($${fmt(item.costoUnitario)}) es mayor al precio de venta ($${fmt(item.precioVenta)}).`
    );
  }

  if (precioCostoAnterior && precioCostoAnterior > 0 && item.precioCosto > 0) {
    const cambio = ((item.precioCosto - precioCostoAnterior) / precioCostoAnterior) * 100;
    if (Math.abs(cambio) > LIMITES_PRECIO.MAX_CAMBIO_PRECIO) {
      const direccion = cambio > 0 ? 'subió' : 'bajó';
      suaves.push(
        `${nombre}: el precio ${direccion} un ${Math.abs(cambio).toFixed(0)}% ` +
        `(de $${fmt(precioCostoAnterior)} → $${fmt(item.precioCosto)}).`
      );
    }
  }

  const bloquear = bloqueantes.length > 0;
  return {
    valido: bloqueantes.length === 0 && suaves.length === 0,
    bloquear,
    advertencias: [...bloqueantes, ...suaves],
    erroresBloqueantes: bloqueantes,
  };
}

/**
 * Valida todos los ítems de un catálogo de proveedor.
 * Los errores bloqueantes aparecen primero en la lista de mensajes.
 */
export function validarCatalogo(
  items: Parameters<typeof validarItemCatalogo>[0][],
  preciosAnteriores: Record<string, number> = {}
): ResultadoValidacion {
  const todosBloqueantes: string[] = [];
  const todosSuaves: string[] = [];
  let bloquearAlguno = false;

  for (const item of items) {
    const r = validarItemCatalogo(item, preciosAnteriores[item.nombre]);
    todosBloqueantes.push(...r.erroresBloqueantes);
    // Agregar suaves solo si no hay bloqueo en ese ítem (para no confundir)
    if (!r.bloquear) todosSuaves.push(...r.advertencias.filter(a => !r.erroresBloqueantes.includes(a)));
    if (r.bloquear) bloquearAlguno = true;
  }

  return {
    valido: todosBloqueantes.length === 0 && todosSuaves.length === 0,
    bloquear: bloquearAlguno,
    advertencias: [...todosBloqueantes, ...todosSuaves],
    erroresBloqueantes: todosBloqueantes,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}
