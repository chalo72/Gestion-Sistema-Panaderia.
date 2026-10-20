/** Cuadre de una factura de recepción contra lo que suma la plataforma. */

export interface LineaCuadre {
  id: string;
  cantidad: number;
  precio: number;
  crudo: number;
  redondeada: number;
  dtoPct: number;
  ivaPct: number;
  descuento: number;
  neto: number;
  iva: number;
  total: number;
}

export interface CuadreFactura {
  subtotalCrudo: number;
  subtotal: number;
  redondeo: number;
  iva: number;
  descuento: number;
  descuentoLineas: number;
  lineas: LineaCuadre[];
  total: number;
  totalImpreso: number | null;
  diferencia: number | null;
  motivos: string[];
}

const peso = (n: number) => Math.round(n);
/** La factura del proveedor trabaja en centavos. No se sube cada paso al peso. */
const centavo = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type ItemCuadre = {
  id: string;
  cantidadRecibida: number;
  precioFacturado: number;
  /** Porcentaje de ese producto. Vacío = no tiene descuento. */
  descuentoPorcentaje?: number;
  /** Porcentaje de ese producto. Vacío = usa el IVA de la factura, o cero si la factura no trae IVA. */
  ivaPorcentaje?: number;
};

/** Primero el descuento del producto, después el IVA sobre lo que queda. Cada paso en centavos. */
export function calcularLinea(
  item: ItemCuadre,
  opts: { incluyeIva?: boolean; porcentajeIva?: number }
): LineaCuadre {
  const cantidad = Number(item.cantidadRecibida) || 0;
  const precio = Number(item.precioFacturado) || 0;
  const crudo = cantidad * precio;
  const redondeada = centavo(crudo);
  const dtoPct = Math.max(0, Number(item.descuentoPorcentaje) || 0);
  const descuento = centavo(redondeada * dtoPct / 100);
  const neto = Math.max(0, centavo(redondeada - descuento));
  const propio = item.ivaPorcentaje != null && Number.isFinite(Number(item.ivaPorcentaje));
  const ivaPct = propio
    ? Math.max(0, Number(item.ivaPorcentaje))
    : (opts.incluyeIva ? Math.max(0, Number(opts.porcentajeIva) || 0) : 0);
  const iva = centavo(neto * ivaPct / 100);
  return {
    id: item.id,
    cantidad,
    precio,
    crudo,
    redondeada,
    dtoPct,
    ivaPct,
    descuento,
    neto,
    iva,
    total: neto + iva,
  };
}

export function cuadreFactura(
  items: ItemCuadre[],
  opts: {
    incluyeIva?: boolean;
    porcentajeIva?: number;
    descuento?: number;
    totalImpreso?: number | null;
  }
): CuadreFactura {
  const lineas = items.map(item => calcularLinea(item, opts));
  const subtotalCrudo = lineas.reduce((s, l) => s + l.crudo, 0);
  const subtotal = lineas.reduce((s, l) => s + l.neto, 0);
  const redondeo = lineas.reduce((s, l) => s + (l.redondeada - l.crudo), 0);
  const iva = lineas.reduce((s, l) => s + l.iva, 0);
  const descuentoLineas = lineas.reduce((s, l) => s + l.descuento, 0);
  const descuento = centavo(Math.max(0, Number(opts.descuento) || 0));
  const total = centavo(Math.max(0, subtotal + iva - descuento));
  const impreso = opts.totalImpreso != null && opts.totalImpreso > 0 ? opts.totalImpreso : null;
  const diferencia = impreso == null ? null : impreso - total;

  const motivos: string[] = [];
  if (lineas.some(l => l.dtoPct > 0 || l.ivaPct > 0)) {
    motivos.push('En cada producto primero se quita su descuento y el IVA se calcula sobre lo que queda.');
  }
  if (iva > 0) motivos.push(`IVA sumado de los productos: ${iva}.`);
  if (Math.abs(redondeo) >= 0.01) {
    motivos.push('Se conservan los centavos de la factura. No se sube cada cuenta al peso.');
  }
  if (descuentoLineas > 0) motivos.push(`Descuento de los productos: ${descuentoLineas}.`);
  if (descuento > 0) motivos.push(`Descuento en pesos al final del papel: ${descuento}.`);
  if (diferencia != null && Math.abs(diferencia) >= 1) {
    const iva19 = peso(subtotal * 0.19);
    if (!opts.incluyeIva && iva19 > 0 && Math.abs(Math.abs(diferencia) - iva19) <= Math.max(100, subtotal * 0.015)) {
      motivos.push('La diferencia se parece al 19% de IVA. Activa “Esta factura trae IVA”.');
    } else if (opts.incluyeIva && Math.abs(diferencia) >= 1) {
      motivos.push('El IVA está activo y aun así no cuadra. Revisa si solo algunos productos llevan IVA, o si falta un flete o un descuento.');
    } else {
      motivos.push('Los precios se ven iguales, pero cantidad × precio de algún renglón no da el total del papel. Revisa cantidades y decimales.');
    }
  } else if (impreso != null) {
    motivos.push('El total de la plataforma coincide con el de la factura.');
  }

  return {
    subtotalCrudo,
    subtotal,
    redondeo,
    iva,
    descuento,
    descuentoLineas,
    lineas,
    total,
    totalImpreso: impreso,
    diferencia,
    motivos,
  };
}
