/**
 * Precio redondo (2026-11-21, pedido de Gonzalo).
 *
 * Los precios de venta salían como $2.002, $3.001 o $501,65 porque el formulario de proveedor
 * guarda el % de ganancia y vuelve a calcular el precio desde ahí. En pesos colombianos
 * se cobra de 50 en 50, así que todo precio de venta calculado se lleva al múltiplo de 50 más cercano.
 */
export function redondearPrecio(valor: unknown, paso = 50): number {
  const n = Number(valor);
  if (!isFinite(n) || n <= 0) return 0;
  const r = Math.round(n / paso) * paso;
  return r > 0 ? r : paso; // un precio positivo nunca queda en $0
}
