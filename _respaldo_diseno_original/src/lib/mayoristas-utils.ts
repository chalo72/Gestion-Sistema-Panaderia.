import type { Producto, PrecioProveedor } from '@/types';

export function cargarConfig(): { margenNegocio: number; margenRevendedor: number } {
    try { return JSON.parse(localStorage.getItem('ag_mayoristas_config') || '{"margenNegocio":20,"margenRevendedor":25}'); }
    catch { return { margenNegocio: 20, margenRevendedor: 25 }; }
}

export function guardarConfig(c: { margenNegocio: number; margenRevendedor: number }) {
    try { localStorage.setItem('ag_mayoristas_config', JSON.stringify(c)); } catch {}
}

/** Calcula el costo real de un producto (costo por unidad base: kg, L, und) */
export function calcularCosto(producto: Producto, mejorPrecio: PrecioProveedor | null): number {
    if (mejorPrecio?.precioCosto && mejorPrecio.precioCosto > 0) {
        // Dividir entre cantidadEmbalaje para obtener el costo por unidad (kg/L/und)
        const cantEmb = (mejorPrecio as any).cantidadEmbalaje || 1;
        return mejorPrecio.precioCosto / cantEmb;
    }
    if (producto.costoBase && producto.costoBase > 0) return producto.costoBase;
    if (producto.margenUtilidad > 0 && producto.precioVenta > 0) {
        return producto.precioVenta / (1 + producto.margenUtilidad / 100);
    }
    return 0;
}
