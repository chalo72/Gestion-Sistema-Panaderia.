import { useState, useCallback } from 'react';
import { generateUUID } from '@/lib/safe-utils';
import type { LoteStock, DespachoLote } from '@/types';

const STORAGE_KEY = 'dulceplacer_lotes_stock_v1';
const HORAS_VENCIMIENTO = 48; // panes duran 48h

function cargar(): LoteStock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LoteStock[];
  } catch {}
  return [];
}

function guardarEnStorage(lotes: LoteStock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lotes));
}

export function calcularEdadHoras(fechaProduccion: string): number {
  return (Date.now() - new Date(fechaProduccion).getTime()) / (1000 * 60 * 60);
}

export function calcularEstadoLote(lote: LoteStock): 'fresco' | 'alerta' | 'urgente' | 'vencido' {
  if (lote.estado === 'despachado' || lote.cantidadDisponible === 0) return 'fresco';
  const horas = calcularEdadHoras(lote.fechaProduccion);
  if (horas >= HORAS_VENCIMIENTO) return 'vencido';
  if (horas >= 24) return 'urgente';
  if (horas >= 12) return 'alerta';
  return 'fresco';
}

export function useLotesStock() {
  const [lotes, setLotes] = useState<LoteStock[]>(cargar);

  const crearLote = useCallback((data: Omit<LoteStock, 'id' | 'estado' | 'despachos'>) => {
    setLotes(prev => {
      // Si ya existe un lote para esta orden, reemplazarlo
      const filtrado = prev.filter(l => l.ordenProduccionId !== data.ordenProduccionId);
      const nuevo: LoteStock = { ...data, id: generateUUID(), estado: 'disponible', despachos: [] };
      const actualizado = [nuevo, ...filtrado];
      guardarEnStorage(actualizado);
      return actualizado;
    });
  }, []);

  const despacharLote = useCallback((loteId: string, cantidad: number, usuarioNombre: string) => {
    setLotes(prev => {
      const actualizado = prev.map(l => {
        if (l.id !== loteId) return l;
        const nuevo: LoteStock = {
          ...l,
          cantidadDisponible: Math.max(0, l.cantidadDisponible - cantidad),
          estado: l.cantidadDisponible - cantidad <= 0 ? 'despachado' : 'disponible',
          despachos: [
            ...l.despachos,
            { id: generateUUID(), fecha: new Date().toISOString(), cantidad, usuarioNombre },
          ],
        };
        return nuevo;
      });
      guardarEnStorage(actualizado);
      return actualizado;
    });
  }, []);

  const marcarVencido = useCallback((loteId: string) => {
    setLotes(prev => {
      const actualizado = prev.map(l => l.id === loteId ? { ...l, estado: 'vencido' as const } : l);
      guardarEnStorage(actualizado);
      return actualizado;
    });
  }, []);

  // Lotes disponibles ordenados por más viejo primero (FIFO)
  const lotesDisponibles = lotes
    .filter(l => l.estado === 'disponible' && l.cantidadDisponible > 0)
    .sort((a, b) => new Date(a.fechaProduccion).getTime() - new Date(b.fechaProduccion).getTime());

  const lotesConProblema = lotesDisponibles.filter(l => {
    const estado = calcularEstadoLote(l);
    return estado === 'urgente' || estado === 'vencido';
  });

  return { lotes, lotesDisponibles, lotesConProblema, crearLote, despacharLote, marcarVencido };
}
