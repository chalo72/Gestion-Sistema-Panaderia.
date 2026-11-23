/**
 * Guardián del catálogo de proveedores (2026-11-23, pedido de Gonzalo: "en vez de actualizar
 * creaste otro producto y duplicaste las cosas… y las cantidades por paca las dejas en uno").
 *
 * 1) Una fila que ya estaba en el catálogo (su uid es un precio guardado) SIEMPRE actualiza
 *    el producto de ese precio, aunque se le haya cambiado el nombre.
 * 2) Una fila nueva cuyo nombre es el de un producto que este proveedor ya vende (igual o casi
 *    igual y mismo tamaño: «Paletya Nucita» = «Paleta Nucita») reutiliza ese producto.
 * 3) Si el precio que llega dice «1 unidad» pero cuesta como la paca que ya estaba guardada
 *    (3 veces o más el costo por unidad anterior), se conserva la cantidad de la paca.
 */
import { analizarNombre, compararProductos } from './productos-duplicados';

interface PrecioMin { id: string; productoId: string; proveedorId: string; precioCosto: number; cantidadEmbalaje?: number; tipoEmbalaje?: string }
interface ProductoMin { id: string; nombre: string }

const normal = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Producto ya existente al que corresponde esta fila del catálogo, o undefined si de verdad es nuevo. */
export function productoExistenteDeFila(
  fila: { uid?: string; productoId?: string; nombre: string },
  ctx: { precios: PrecioMin[]; productos: ProductoMin[]; proveedorId: string },
): string | undefined {
  const existe = (id?: string) => !!id && ctx.productos.some(p => p.id === id);
  // 1) La fila es un precio que ya estaba guardado → su producto, se haya renombrado o no
  const precioGuardado = fila.uid ? ctx.precios.find(p => p.id === fila.uid) : undefined;
  if (precioGuardado && existe(precioGuardado.productoId)) return precioGuardado.productoId;
  if (existe(fila.productoId)) return fila.productoId;
  // Nombre exacto (sin importar mayúsculas, tildes ni espacios)
  const n = normal(fila.nombre);
  if (!n) return undefined;
  const exacto = ctx.productos.find(p => normal(p.nombre) === n);
  if (exacto) return exacto.id;
  // 2) Casi igual, entre los productos que este proveedor ya vende
  const delProveedor = new Set(ctx.precios.filter(p => p.proveedorId === ctx.proveedorId).map(p => p.productoId));
  const info = analizarNombre(fila.nombre);
  const parecidos = ctx.productos.filter(p => {
    if (!delProveedor.has(p.id)) return false;
    const m = compararProductos(info, analizarNombre(p.nombre));
    return m === 'mismo-tamano' || m === 'mismo-nombre';
  });
  return parecidos.length === 1 ? parecidos[0].id : undefined;
}

/**
 * Cantidad por empaque a guardar. Si la nueva dice 1 pero el costo es el de la paca guardada,
 * se conserva la paca (cantidad y tipo). Devuelve también si se corrigió, para avisar.
 */
export function cantidadQueSeGuarda(
  nueva: { precioCosto: number; cantidadEmbalaje: number; tipoEmbalaje?: string },
  previo: PrecioMin | undefined,
): { cantidadEmbalaje: number; tipoEmbalaje?: string; corregida: boolean } {
  const cantPrevia = Number(previo?.cantidadEmbalaje) || 1;
  const costoUnitPrevio = previo && cantPrevia > 0 ? Number(previo.precioCosto) / cantPrevia : 0;
  if (previo && cantPrevia > 1 && (Number(nueva.cantidadEmbalaje) || 1) <= 1
    && costoUnitPrevio > 0 && Number(nueva.precioCosto) >= costoUnitPrevio * 3) {
    return { cantidadEmbalaje: cantPrevia, tipoEmbalaje: previo.tipoEmbalaje || nueva.tipoEmbalaje, corregida: true };
  }
  return { cantidadEmbalaje: nueva.cantidadEmbalaje, tipoEmbalaje: nueva.tipoEmbalaje, corregida: false };
}
