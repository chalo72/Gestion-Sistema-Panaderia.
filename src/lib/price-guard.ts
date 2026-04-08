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
  valido: boolean;       // true si puede guardarse sin confirmación
  bloquear: boolean;     // true si NO debe guardarse en absoluto
  advertencias: string[]; // mensajes a mostrar al usuario
}

/**
 * Valida un ítem del catálogo de proveedor antes de guardar.
 * @param item - datos del ítem a guardar
 * @param precioCostoAnterior - precio anterior (para calcular % de cambio)
 */
export function validarItemCatalogo(
  item: {
    nombre: string;
    precioCosto: number;
    cantidadEmbalaje: number;
    costoUnitario: number;
    precioVenta: number;
    margenVenta: number;
  },
  precioCostoAnterior?: number
): ResultadoValidacion {
  const advertencias: string[] = [];
  let bloquear = false;

  const nombre = `"${item.nombre}"`;

  // — Bloqueos duros —
  if (!item.precioCosto || item.precioCosto <= 0) {
    advertencias.push(`${nombre}: el precio de costo no puede ser cero o negativo.`);
    bloquear = true;
  }

  if (!item.cantidadEmbalaje || item.cantidadEmbalaje <= 0) {
    advertencias.push(`${nombre}: la cantidad de embalaje debe ser mayor a 0.`);
    bloquear = true;
  }

  if (item.cantidadEmbalaje > LIMITES_PRECIO.MAX_EMBALAJE) {
    advertencias.push(`${nombre}: cantidad de embalaje (${item.cantidadEmbalaje}) parece incorrecta.`);
    bloquear = true;
  }

  if (item.margenVenta > LIMITES_PRECIO.MAX_MARGEN_PORCENTAJE) {
    advertencias.push(
      `${nombre}: margen ${item.margenVenta.toFixed(0)}% supera el límite de ${LIMITES_PRECIO.MAX_MARGEN_PORCENTAJE}%. ` +
      `¿Verificaste la cantidad de embalaje?`
    );
    bloquear = true;
  }

  // — Advertencias suaves (no bloquean, pero se muestran) —
  if (item.precioVenta > 0 && item.costoUnitario > item.precioVenta) {
    advertencias.push(
      `${nombre}: costo unitario ($${fmt(item.costoUnitario)}) es mayor al precio de venta ($${fmt(item.precioVenta)}).`
    );
  }

  if (precioCostoAnterior && precioCostoAnterior > 0 && item.precioCosto > 0) {
    const cambio = ((item.precioCosto - precioCostoAnterior) / precioCostoAnterior) * 100;
    if (Math.abs(cambio) > LIMITES_PRECIO.MAX_CAMBIO_PRECIO) {
      const direccion = cambio > 0 ? 'subió' : 'bajó';
      advertencias.push(
        `${nombre}: el precio ${direccion} un ${Math.abs(cambio).toFixed(0)}% ` +
        `(de $${fmt(precioCostoAnterior)} → $${fmt(item.precioCosto)}).`
      );
    }
  }

  return {
    valido: advertencias.length === 0,
    bloquear,
    advertencias,
  };
}

/**
 * Valida todos los ítems de un catálogo de proveedor.
 * Retorna resultado combinado y lista de todos los problemas.
 */
export function validarCatalogo(
  items: Parameters<typeof validarItemCatalogo>[0][],
  preciosAnteriores: Record<string, number> = {}
): ResultadoValidacion {
  const todas: string[] = [];
  let bloquearAlguno = false;

  for (const item of items) {
    const r = validarItemCatalogo(item, preciosAnteriores[item.nombre]);
    todas.push(...r.advertencias);
    if (r.bloquear) bloquearAlguno = true;
  }

  return {
    valido: todas.length === 0,
    bloquear: bloquearAlguno,
    advertencias: todas,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}
