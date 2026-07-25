import { generateUUID } from '@/lib/safe-utils';

export type TipoBoveda = 'Caja Fuerte' | 'Base' | 'Banco' | 'Otro';

export interface Boveda {
  id: string;
  nombre: string;
  tipo: TipoBoveda;
  saldo: number;
  creadoEn: string;
}

export type TipoMovimientoBoveda = 'Ingreso' | 'Egreso' | 'Transferencia';

export interface MovimientoBoveda {
  id: string;
  bovedaOrigenId?: string; // Para Egresos y Transferencias
  bovedaDestinoId?: string; // Para Ingresos y Transferencias
  monto: number;
  motivo: string;
  tipo: TipoMovimientoBoveda;
  fecha: string;
  usuarioResponsable: string;
  metodoPago?: string; // e.g., 'Efectivo', 'Transferencia'
}

const KEY_BOVEDAS = 'dp_bovedas_lista';
const KEY_MOVIMIENTOS = 'dp_bovedas_movimientos';

// ── Bóvedas ─────────────────────────────────────────

export function getBovedas(): Boveda[] {
  try {
    const raw = localStorage.getItem(KEY_BOVEDAS);
    if (!raw) {
      // Inicializar con la Caja Principal
      const init: Boveda[] = [{
        id: 'boveda-principal',
        nombre: 'Caja Fuerte Principal',
        tipo: 'Caja Fuerte',
        saldo: 0,
        creadoEn: new Date().toISOString()
      }];
      localStorage.setItem(KEY_BOVEDAS, JSON.stringify(init));
      return init;
    }
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveBovedas(list: Boveda[]): void {
  localStorage.setItem(KEY_BOVEDAS, JSON.stringify(list));
}

export function addBoveda(data: Omit<Boveda, 'id' | 'saldo' | 'creadoEn'>): Boveda {
  const nueva: Boveda = {
    ...data,
    id: generateUUID(),
    saldo: 0,
    creadoEn: new Date().toISOString()
  };
  saveBovedas([...getBovedas(), nueva]);
  return nueva;
}

export function updateBovedaSaldo(id: string, montoCambio: number): void {
  const bovedas = getBovedas();
  const index = bovedas.findIndex(b => b.id === id);
  if (index !== -1) {
    bovedas[index].saldo += montoCambio;
    saveBovedas(bovedas);
  }
}

// ── Movimientos ─────────────────────────────────────

export function getMovimientosBoveda(): MovimientoBoveda[] {
  try {
    const raw = localStorage.getItem(KEY_MOVIMIENTOS);
    if (!raw) return [];
    const list = JSON.parse(raw) as MovimientoBoveda[];
    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  } catch { return []; }
}

export function saveMovimientos(list: MovimientoBoveda[]): void {
  localStorage.setItem(KEY_MOVIMIENTOS, JSON.stringify(list));
}

export function addMovimientoBoveda(data: Omit<MovimientoBoveda, 'id' | 'fecha'>): MovimientoBoveda {
  const nuevo: MovimientoBoveda = {
    ...data,
    id: generateUUID(),
    fecha: new Date().toISOString()
  };
  
  // Actualizar saldos según el tipo de movimiento
  if (data.tipo === 'Ingreso' && data.bovedaDestinoId) {
    updateBovedaSaldo(data.bovedaDestinoId, data.monto);
  } else if (data.tipo === 'Egreso' && data.bovedaOrigenId) {
    updateBovedaSaldo(data.bovedaOrigenId, -data.monto);
  } else if (data.tipo === 'Transferencia' && data.bovedaOrigenId && data.bovedaDestinoId) {
    updateBovedaSaldo(data.bovedaOrigenId, -data.monto);
    updateBovedaSaldo(data.bovedaDestinoId, data.monto);
  }

  saveMovimientos([nuevo, ...getMovimientosBoveda()]);
  return nuevo;
}
