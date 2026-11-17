import { useEffect, useState } from 'react';
import { db } from '@/lib/database';
import type { HistorialPrecio } from '@/types';

/** Solo cuenta un cambio real de precio. Ignora filas donde el valor no se movió. */
export function normalizarHistorial(rows: unknown): HistorialPrecio[] {
  if (!Array.isArray(rows)) return [];
  const limpio: HistorialPrecio[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const productoId = String(r.productoId ?? r.producto_id ?? '');
    const proveedorId = String(r.proveedorId ?? r.proveedor_id ?? '');
    const precioAnterior = Number(r.precioAnterior ?? r.precio_anterior);
    const precioNuevo = Number(r.precioNuevo ?? r.precio_nuevo);
    const fechaCambio = String(r.fechaCambio ?? r.fecha_cambio ?? '');
    if (!productoId || !proveedorId || !fechaCambio) continue;
    if (!Number.isFinite(precioAnterior) || !Number.isFinite(precioNuevo)) continue;
    if (precioAnterior === precioNuevo) continue;
    limpio.push({
      id: String(r.id ?? `${productoId}-${fechaCambio}`),
      productoId,
      proveedorId,
      precioAnterior,
      precioNuevo,
      fechaCambio,
    });
  }
  return limpio;
}

export function ultimoCambioPrecio(
  historial: HistorialPrecio[],
  productoId: string,
  proveedorId: string,
): HistorialPrecio | null {
  let mejor: HistorialPrecio | null = null;
  for (const h of historial) {
    if (h.productoId !== productoId || h.proveedorId !== proveedorId) continue;
    if (!mejor || h.fechaCambio > mejor.fechaCambio) mejor = h;
  }
  return mejor;
}

export function formatearFechaCambio(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Vuelve a leer el historial cuando cambia la lista de precios del catálogo. */
export function useCambiosPrecio(precios: unknown): HistorialPrecio[] {
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  useEffect(() => {
    let vivo = true;
    db.getAllHistorial()
      .then((rows) => {
        if (vivo) setHistorial(normalizarHistorial(rows));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [precios]);
  return historial;
}
