/**
 * Puente Caja POS (Ventas del día) ↔ Bóveda / Tesorería.
 * Mismo nombre de caja = misma cuenta (Principal, Helados…).
 */
import {
    addBoveda,
    addMovimientoBoveda,
    getBovedas,
    type Boveda,
    type TipoBoveda,
} from '@/lib/boveda-store';

/** Cajas del arqueo POS (Ventas del día) — no son bóveda “libre”. */
export const CAJAS_POS_DEFAULT = [
    'Principal',
    'Helados',
    'Mecato',
    'Michelada',
    'Tinto',
    'Fritos',
    'Tortas',
    'Juegos',
    'PIÑATERIA',
] as const;

export type NombreCajaPos = (typeof CAJAS_POS_DEFAULT)[number];

const CLAVE_SALIDAS = 'Gastos/Salidas';

const normalizar = (s: string) =>
    (s || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

/** Busca bóveda por nombre (exacto o contiene) o la crea. */
export const resolverBovedaPorNombre = (
    nombre: string,
    tipo: TipoBoveda = 'Caja Fuerte'
): Boveda => {
    const lista = getBovedas();
    const clave = normalizar(nombre);
    if (!clave) {
        throw new Error('Nombre de caja vacío');
    }
    const exacta = lista.find((b) => normalizar(b.nombre) === clave);
    if (exacta) return exacta;
    const parcial = lista.find((b) => {
        const bn = normalizar(b.nombre);
        return bn.includes(clave) || clave.includes(bn);
    });
    if (parcial) return parcial;
    return addBoveda({ nombre: nombre.trim(), tipo });
};

/** Ingreso a bóveda (arqueo POS / ventas del día). */
export const syncIngresoPosABoveda = (params: {
    nombreCaja: string;
    monto: number;
    motivo: string;
    usuario: string;
    metodoPago?: string;
    tipoBoveda?: TipoBoveda;
}): void => {
    const monto = Math.round((Number(params.monto) || 0) * 100) / 100;
    if (monto <= 0) return;
    if (normalizar(params.nombreCaja) === normalizar(CLAVE_SALIDAS)) return;

    const boveda = resolverBovedaPorNombre(
        params.nombreCaja,
        params.tipoBoveda || 'Caja Fuerte'
    );
    addMovimientoBoveda({
        bovedaDestinoId: boveda.id,
        monto,
        motivo: params.motivo,
        tipo: 'Ingreso',
        usuarioResponsable: params.usuario,
        metodoPago: params.metodoPago || 'Efectivo',
    });
};

/** Egreso desde bóveda (gasto diario desde caja POS o tesorería). */
export const syncEgresoDesdeBoveda = (params: {
    /** Id de bóveda o nombre de caja POS */
    bovedaId?: string;
    nombreCaja?: string;
    monto: number;
    motivo: string;
    usuario: string;
}): string | undefined => {
    const monto = Math.round((Number(params.monto) || 0) * 100) / 100;
    if (monto <= 0) return undefined;

    let boveda: Boveda | undefined;
    if (params.bovedaId) {
        boveda = getBovedas().find((b) => b.id === params.bovedaId);
    }
    if (!boveda && params.nombreCaja) {
        boveda = resolverBovedaPorNombre(params.nombreCaja, 'Caja Fuerte');
    }
    if (!boveda) return undefined;

    addMovimientoBoveda({
        bovedaOrigenId: boveda.id,
        monto,
        motivo: params.motivo.slice(0, 200),
        tipo: 'Egreso',
        usuarioResponsable: params.usuario,
        metodoPago: 'Efectivo',
    });
    return boveda.id;
};

/** Sincroniza el mapa de cajas de Ventas del día → bóveda. */
export const syncArqueoCajasABoveda = (params: {
    cajas: Record<string, string | number> | undefined;
    nequi: number;
    transferencia: number;
    turno: string;
    fecha: string;
    usuario: string;
}): void => {
    const motivoBase = `Arqueo de Caja - ${params.turno} (${params.fecha})`;

    if (params.cajas) {
        Object.entries(params.cajas).forEach(([nombreCaja, montoRaw]) => {
            const monto = parseFloat(String(montoRaw)) || 0;
            if (monto <= 0) return;

            if (normalizar(nombreCaja) === normalizar(CLAVE_SALIDAS)) {
                // Salidas del día: bajan de Principal (caja POS madre)
                syncEgresoDesdeBoveda({
                    nombreCaja: 'Principal',
                    monto,
                    motivo: `${motivoBase} · Gastos/Salidas`,
                    usuario: params.usuario,
                });
                return;
            }

            syncIngresoPosABoveda({
                nombreCaja,
                monto,
                motivo: motivoBase,
                usuario: params.usuario,
                metodoPago: 'Efectivo',
                tipoBoveda: 'Caja Fuerte',
            });
        });
    }

    syncIngresoPosABoveda({
        nombreCaja: 'Nequi',
        monto: params.nequi,
        motivo: motivoBase,
        usuario: params.usuario,
        metodoPago: 'Nequi',
        tipoBoveda: 'Banco',
    });
    syncIngresoPosABoveda({
        nombreCaja: 'Transferencia',
        monto: params.transferencia,
        motivo: motivoBase,
        usuario: params.usuario,
        metodoPago: 'Transferencia',
        tipoBoveda: 'Banco',
    });
};
