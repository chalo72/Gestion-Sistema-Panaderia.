/**
 * Parseo de dinero escrito a mano en formato colombiano.
 *
 * `parseFloat('1.500')` devuelve 1.5 y `parseFloat('1,500')` devuelve 1: en un campo de TEXTO
 * (p. ej. el precio manual) eso guardaba precios ~1000 veces más chicos. Los campos
 * `type="number"` no tienen el problema (el navegador ya entrega "1500" o "1500.5").
 *
 * Reglas (misma lógica que `parsearNumero` de excel-parser.ts y `normalizarPrecio` de ocr-service.ts,
 * que siguen siendo privadas y no se tocan aquí):
 *  - Con punto Y coma: el que aparece último es el decimal, el otro es separador de miles.
 *  - Solo comas / solo puntos: si hay más de uno, o el último grupo tiene exactamente 3 dígitos,
 *    son separadores de miles ("45.000" = 45000); con 1 o 2 dígitos es decimal ("45,5" = 45.5).
 * Caso ambiguo asumido: "1.500" es mil quinientos (no uno punto cinco), que es lo normal en pesos.
 *
 * Devuelve NaN si el texto no es un número válido, para que quien llama use su `isNaN` de siempre.
 */
export function parsearDineroCO(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (valor == null) return NaN;

  const limpio = String(valor).replace(/[$€£¥₡]/g, '').replace(/\s/g, '');
  if (!/^[\d.,]*\d[\d.,]*$/.test(limpio)) return NaN;

  const puntos = limpio.split('.').length - 1;
  const comas = limpio.split(',').length - 1;
  let numero = limpio;

  if (puntos > 0 && comas > 0) {
    numero = limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (comas > 0) {
    const grupos = limpio.split(',');
    const esMiles = comas > 1 || grupos[1].length === 3;
    numero = esMiles ? limpio.replace(/,/g, '') : limpio.replace(',', '.');
  } else if (puntos > 0) {
    const grupos = limpio.split('.');
    const esMiles = puntos > 1 || grupos[1].length === 3;
    numero = esMiles ? limpio.replace(/\./g, '') : limpio;
  }

  const n = Number(numero);
  return Number.isFinite(n) ? n : NaN;
}
