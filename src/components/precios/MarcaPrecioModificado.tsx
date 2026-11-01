import type { HistorialPrecio } from '@/types';
import { formatearFechaCambio } from '@/lib/cambio-precio-catalogo';

/** Marca roja con la fecha. Solo se pinta si el precio de verdad cambió. */
export function MarcaPrecioModificado({ cambio }: { cambio: HistorialPrecio | null }) {
  if (!cambio) return null;
  const fecha = formatearFechaCambio(cambio.fechaCambio);
  if (!fecha) return null;
  return (
    <span
      className="inline-flex items-center text-[9px] font-black uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-300 rounded px-1.5 py-0.5 w-fit leading-tight"
      title={`Precio modificado. Antes ${cambio.precioAnterior} y ahora ${cambio.precioNuevo}.`}
    >
      Modificado {fecha}
    </span>
  );
}
