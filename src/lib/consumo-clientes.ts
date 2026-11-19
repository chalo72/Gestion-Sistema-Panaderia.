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

/** Una línea del historial de consumo de un cliente de confianza (2026-11-19). */
export interface LineaHistorialCliente {
  key: string;
  fecha: string; // 'YYYY-MM-DD' para ordenar
  etiquetaFecha: string; // 'dd/mm'
  texto: string;
  monto: number;
  origen: 'consumo' | 'credito';
}

const fechaCorta = (f: string | undefined): { fecha: string; etiqueta: string } => {
  const s = String(f || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { fecha: `${m[1]}-${m[2]}-${m[3]}`, etiqueta: `${m[3]}/${m[2]}` };
  return { fecha: '', etiqueta: '' };
};

/**
 * Todo lo que un cliente de confianza debe, en una sola lista:
 * - las líneas de su cuenta de consumo (cada pan anotado en Consumo),
 * - y los créditos sueltos que tenga activos en Créditos de Clientes.
 * Antes la pantalla de Consumo solo mostraba las 3 últimas líneas y no sumaba lo demás.
 */
export const historialCliente = (
  creditos: CreditoCliente[],
  clienteId: string
): { lineas: LineaHistorialCliente[]; deudaConsumo: number; deudaOtros: number; deudaTotal: number } => {
  const activos = creditos.filter((c) => c.clienteId === clienteId && c.estado === 'activo');
  const lineas: LineaHistorialCliente[] = [];
  let deudaConsumo = 0;
  let deudaOtros = 0;
  for (const c of activos) {
    const base = fechaCorta(c.fecha || (c as any).createdAt);
    if (c.categoriaCliente === CATEGORIA_CONSUMO) {
      deudaConsumo += Number(c.saldo) || 0;
      (c.items || []).forEach((it, i) => {
        // La línea guarda la fecha al inicio: "19/11 · 2 helados"
        const m = String(it.nombre || '').match(/^(\d{2})\/(\d{2})\s*·\s*(.*)$/);
        const anio = base.fecha.slice(0, 4) || String(new Date().getFullYear());
        lineas.push({
          key: `${c.id}-${i}`,
          fecha: m ? `${anio}-${m[2]}-${m[1]}` : base.fecha,
          etiquetaFecha: m ? `${m[1]}/${m[2]}` : base.etiqueta,
          texto: m ? m[3] : String(it.nombre || 'Consumo'),
          monto: Number(it.subtotal) || 0,
          origen: 'consumo',
        });
      });
    } else {
      deudaOtros += Number(c.saldo) || 0;
      lineas.push({
        key: c.id,
        fecha: base.fecha,
        etiquetaFecha: base.etiqueta,
        texto: c.descripcion || 'Crédito',
        monto: Number(c.saldo) || 0,
        origen: 'credito',
      });
    }
  }
  // Más reciente primero; dentro del mismo día, lo último anotado arriba
  lineas.reverse().sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { lineas, deudaConsumo: r2(deudaConsumo), deudaOtros: r2(deudaOtros), deudaTotal: r2(deudaConsumo + deudaOtros) };
};

/** Texto de la cuenta para WhatsApp (y base de la impresión). */
export const textoCuentaCliente = (
  nombre: string,
  h: ReturnType<typeof historialCliente>,
  fmt: (n: number) => string,
  hoy: Date = new Date()
): string => {
  const f = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  let t = `🧾 *Cuenta de ${nombre} — Dulce Placer*\n📅 ${f}\n\n`;
  const consumo = h.lineas.filter((l) => l.origen === 'consumo');
  const otros = h.lineas.filter((l) => l.origen === 'credito');
  if (consumo.length > 0) {
    t += `*Consumo*\n`;
    for (const l of consumo) t += `• ${l.etiquetaFecha} ${l.texto} — ${fmt(l.monto)}\n`;
    t += `Subtotal consumo: ${fmt(h.deudaConsumo)}\n\n`;
  }
  if (otros.length > 0) {
    t += `*Registrado en Clientes*\n`;
    for (const l of otros) t += `• ${l.etiquetaFecha} ${l.texto} — ${fmt(l.monto)}\n`;
    t += `Subtotal: ${fmt(h.deudaOtros)}\n\n`;
  }
  t += `💰 *TOTAL A PAGAR: ${fmt(h.deudaTotal)}*\n\nGracias 🙏`;
  return t;
};

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
