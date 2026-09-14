/**
 * Agrupa gastos por fecha → proveedor, mostrando cada línea por separado.
 * Si un registro viejo trae facturaItems fusionados, se desglosan en la lista.
 */
import type { Gasto } from '@/types';

export type GastoLineaLista = Gasto & {
  /** Línea desglosada de una factura fusionada (legacy / turbo antiguo). */
  esLineaFactura?: boolean;
  /** ID del gasto padre si es línea desglosada. */
  gastoPadreId?: string;
};

const SIN_PROVEEDOR = '__sin_proveedor__';

export function idGastoAccion(linea: GastoLineaLista): string {
  return linea.gastoPadreId || linea.id;
}

/** Resultado al desglosar descripción de gasto para la lista */
export interface LineaGastoDisplay {
  cantidad: number | null;
  nombre: string;
}

/**
 * Extrae cantidad + nombre limpio desde descripciones guardadas en Turbo/clásico.
 * Soporta: "2 UNIDS producto valor", "3x producto", "2 unidades producto", etc.
 */
export function parseDescripcionLineaGasto(descripcion: string): LineaGastoDisplay {
  let s = (descripcion || '').trim();
  if (!s) return { cantidad: null, nombre: '' };

  s = s.replace(/^\[ANULADO:[^\]]*\]\s*/i, '');

  let cantidad: number | null = null;

  const prefijos = [
    /^(\d+)\s+UNIDS?\s+(.+)$/i,
    /^(\d+)\s+UNIDAD(?:ES)?\s+(.+)$/i,
    /^(\d+)\s+UNDS?\s+(.+)$/i,
    /^(\d+)\s*x\s+(.+)$/i,
    /^(\d+)x\s+(.+)$/i,
  ];

  for (const re of prefijos) {
    const m = s.match(re);
    if (m) {
      cantidad = parseInt(m[1], 10);
      s = m[2];
      break;
    }
  }

  // UNIDS no al inicio (texto extra delante)
  if (cantidad === null) {
    const medio = s.match(/(?:^|\s)(\d+)\s+UNIDS?\s+(.+)$/i);
    if (medio) {
      cantidad = parseInt(medio[1], 10);
      s = medio[2];
    }
  }

  s = s.replace(/\s+valor\s*$/i, '').replace(/\s+/g, ' ').trim();

  return {
    cantidad: cantidad !== null && !Number.isNaN(cantidad) ? cantidad : null,
    nombre: s || descripcion.trim(),
  };
}

export function etiquetaUnidades(cantidad: number | null): string | null {
  if (cantidad === null || cantidad <= 0 || Number.isNaN(cantidad)) return null;
  return cantidad === 1 ? '1 UNID' : `${cantidad} UNIDS`;
}

/** Desglosa facturaItems en filas individuales para la UI. */
export function expandirGastosEnLineas(gastos: Gasto[]): GastoLineaLista[] {
  const out: GastoLineaLista[] = [];
  for (const g of gastos) {
    const items = g.facturaItems;
    if (items && items.length > 0) {
      items.forEach((item, i) => {
        const qty = Number(item.cantidad) || 1;
        const nombre = (item.nombre || 'Ítem').trim();
        const desc =
          qty >= 1 ? `${qty} UNIDS ${nombre} valor` : nombre;
        out.push({
          ...g,
          id: `${g.id}::linea::${i}`,
          descripcion: desc,
          monto: Number(item.total) || 0,
          facturaItems: undefined,
          esLineaFactura: true,
          gastoPadreId: g.id,
        });
      });
    } else {
      out.push(g);
    }
  }
  return out;
}

export function groupByDay<T extends { fecha?: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  items.forEach((g) => {
    const key = (g.fecha || '').split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  });
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export type GrupoProveedorDia = {
  proveedorId: string;
  lineas: GastoLineaLista[];
  total: number;
};

export type GrupoDiaGastos = {
  fecha: string;
  proveedores: GrupoProveedorDia[];
  sinProveedor: GastoLineaLista[];
  totalDia: number;
};

export function agruparGastosPorDiaYProveedor(
  gastos: Gasto[],
  signo: (g: Gasto) => number = (g) => (g.esIngreso ? 1 : -1)
): GrupoDiaGastos[] {
  const lineas = expandirGastosEnLineas(gastos);
  return groupByDay(lineas).map(([fecha, items]) => {
    const porProv = new Map<string, GastoLineaLista[]>();
    const sinProveedor: GastoLineaLista[] = [];

    for (const linea of items) {
      if (linea.proveedorId) {
        const list = porProv.get(linea.proveedorId) || [];
        list.push(linea);
        porProv.set(linea.proveedorId, list);
      } else {
        sinProveedor.push(linea);
      }
    }

    const proveedores: GrupoProveedorDia[] = Array.from(porProv.entries()).map(
      ([proveedorId, provLineas]) => ({
        proveedorId,
        lineas: provLineas.sort((a, b) =>
          (a.descripcion || '').localeCompare(b.descripcion || '', 'es')
        ),
        total: provLineas.reduce((s, g) => s + signo(g) * (Number(g.monto) || 0), 0),
      })
    );

    proveedores.sort((a, b) => {
      const na = a.lineas[0]?.descripcion || '';
      const nb = b.lineas[0]?.descripcion || '';
      return na.localeCompare(nb, 'es');
    });

    const totalDia = items.reduce(
      (s, g) => s + signo(g) * (Number(g.monto) || 0),
      0
    );

    return {
      fecha,
      proveedores,
      sinProveedor: sinProveedor.sort((a, b) =>
        (a.descripcion || '').localeCompare(b.descripcion || '', 'es')
      ),
      totalDia,
    };
  });
}

export { SIN_PROVEEDOR };
