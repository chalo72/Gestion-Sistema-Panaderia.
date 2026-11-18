import { useState } from 'react';
import { History } from 'lucide-react';
import type { CreditoTrabajador } from '@/types';

/**
 * Quién anotó el crédito, desde qué aparato y cuándo; y su historial completo al tocar
 * "Ver historial" (2026-11-18, pedido de Gonzalo: para cuando alguien dice "eso no es mío").
 */

const fechaHora = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  if (!d || !Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
};

const ETIQUETA: Record<string, string> = {
  creado: 'Anotado',
  editado: 'Cambiado',
  cobrado: 'Cobrado',
  pospuesto: 'Pospuesto',
  cobrar_atrasado: 'Cobrado (atrasado)',
};

export function OrigenCredito({ c }: { c: CreditoTrabajador }) {
  const creado = (c.historial || []).find(e => e.accion === 'creado');
  return (
    <p className="text-[11px] text-gray-600 dark:text-gray-300">
      {creado
        ? <>Anotado el {fechaHora(creado.fecha)} por <b>{creado.usuario}</b> · {creado.aparato}</>
        : <>Anotado el {fechaHora(c.createdAt || c.fecha) || String(c.fecha || '').slice(0, 10)} (sin historial: anotado antes del 18-nov)</>}
    </p>
  );
}

export function HistorialCredito({ c }: { c: CreditoTrabajador }) {
  const [abierto, setAbierto] = useState(false);
  const eventos = [...(c.historial || [])].reverse();
  if (eventos.length === 0) return null;
  return (
    <div>
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:underline">
        <History className="w-3.5 h-3.5" /> {abierto ? 'Ocultar historial' : `Ver historial (${eventos.length})`}
      </button>
      {abierto && (
        <ul className="mt-1 space-y-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
          {eventos.map(e => (
            <li key={e.id} className="text-[11px] text-gray-700 dark:text-gray-200">
              <span className="font-bold">{ETIQUETA[e.accion] || e.accion}</span> · {fechaHora(e.fecha)} · {e.usuario} · {e.aparato}
              {e.detalle && <span className="block text-gray-500 dark:text-gray-400">{e.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Posponer a la próxima quincena" con su motivo. */
export function PosponerCredito({ onPosponer }: { onPosponer: (motivo: string) => void | Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline">
        Posponer a la próxima quincena
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus
        aria-label="Motivo para posponer"
        placeholder="Motivo. Ej: no le alcanzó, lo paga en la otra"
        className="flex-1 min-w-[12rem] h-9 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 px-2 text-xs" />
      <button type="button" disabled={guardando}
        onClick={async () => { setGuardando(true); try { await onPosponer(motivo); setAbierto(false); setMotivo(''); } finally { setGuardando(false); } }}
        className="h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50">
        {guardando ? 'Guardando…' : 'Posponer'}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="h-9 px-2 text-xs font-bold text-gray-500">Cancelar</button>
    </div>
  );
}
