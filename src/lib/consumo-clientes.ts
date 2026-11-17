/**
 * Consumo de clientes de confianza (2026-11-16).
 * Un cliente marcado "Aparece en Consumo" (Cliente.enConsumo) sale en la pantalla de Consumo / Fiados.
 * Cada consumo se suma a UN solo crédito abierto de ese cliente (categoría 'Consumo'),
 * como una línea más, en vez de crear un crédito suelto por cada pan.
 * El crédito vive en creditos_clientes, así que se ve en Créditos de Clientes (saldo y abonos).
 */
import type { Cliente, CreditoCliente, ItemCredito } from '@/types';

export const CATEGORIA_CONSUMO = 'Consumo';

/** El crédito de consumo abierto (activo) de un cliente, si existe. */
export const creditoConsumoAbierto = (
  creditos: CreditoCliente[],
  clienteId: string
): CreditoCliente | undefined =>
  creditos.find(
    (c) => c.clienteId === clienteId && c.categoriaCliente === CATEGORIA_CONSUMO && c.estado === 'activo'
  );

export interface NuevoConsumo {
  cliente: Pick<Cliente, 'id' | 'nombre' | 'telefono'>;
  monto: number;
  descripcion: string;
  foto?: string | null;
  usuarioId: string;
  ahora?: Date;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Devuelve el crédito a guardar:
 * - esNuevo=true  → no había crédito de consumo abierto; hay que crearlo (sin id/createdAt).
 * - esNuevo=false → se suma la línea al crédito abierto; hay que actualizarlo.
 */
export const sumarConsumo = (
  abierto: CreditoCliente | undefined,
  datos: NuevoConsumo
):
  | { esNuevo: true; credito: Omit<CreditoCliente, 'id' | 'createdAt'> }
  | { esNuevo: false; credito: CreditoCliente } => {
  const monto = r2(Number(datos.monto));
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');

  const ahora = datos.ahora ?? new Date();
  const dd = String(ahora.getDate()).padStart(2, '0');
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const desc = (datos.descripcion || '').trim() || 'Consumo';
  const linea: ItemCredito = {
    productoId: 'consumo',
    nombre: `${dd}/${mm} · ${desc}`,
    cantidad: 1,
    precioUnitario: monto,
    subtotal: monto,
  };

  if (abierto) {
    return {
      esNuevo: false,
      credito: {
        ...abierto,
        monto: r2(abierto.monto + monto),
        saldo: r2(abierto.saldo + monto),
        items: [...(abierto.items || []), linea],
        fotoEvidencia: datos.foto || abierto.fotoEvidencia,
      },
    };
  }

  return {
    esNuevo: true,
    credito: {
      clienteId: datos.cliente.id,
      clienteNombre: datos.cliente.nombre,
      clienteTelefono: datos.cliente.telefono || undefined,
      categoriaCliente: CATEGORIA_CONSUMO,
      monto,
      saldo: monto,
      descripcion: 'Consumo / Fiados',
      fecha: ahora.toISOString().split('T')[0],
      estado: 'activo',
      items: [linea],
      fotoEvidencia: datos.foto || undefined,
      pagos: [],
      usuarioId: datos.usuarioId,
    },
  };
};
