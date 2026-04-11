/**
 * useVentas — Sub-hook para gestión de ventas, caja, mesas y pedidos activos
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useCallback } from 'react';
import { db } from '@/lib/database';
import type { 
  Venta, 
  CajaSesion, 
  Mesa, 
  PedidoActivo, 
  MovimientoCaja
} from '@/types';
import { toast } from 'sonner';

interface UseVentasParams {
  onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => Promise<void>;
}

export function useVentas({ onAjustarStock }: UseVentasParams) {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [sesionesCaja, setSesionesCaja] = useState<CajaSesion[]>([]);
  const [cajaActiva, setCajaActiva] = useState<CajaSesion | undefined>(undefined);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<PedidoActivo[]>([]);

  // --- Gestión de Caja ---
  const abrirCaja = useCallback(async (usuarioId: string, montoApertura: number) => {
    const sesion: CajaSesion = {
      id: crypto.randomUUID(),
      usuarioId,
      fechaApertura: new Date().toISOString(),
      montoApertura,
      totalVentas: 0,
      totalVentasEfectivo: 0,
      totalCreditos: 0,
      montoCierre: undefined,
      estado: 'abierta',
      movimientos: [],
      ventasIds: []
    };
    await db.addSesionCaja(sesion as any);
    setSesionesCaja(prev => [...prev, sesion]);
    setCajaActiva(sesion);
    toast.success('Caja abierta correctamente');
    return sesion;
  }, []);

  const cerrarCaja = useCallback(async (montoCierre: number) => {
    if (!cajaActiva) return undefined;
    const sesion: CajaSesion = {
      ...cajaActiva,
      fechaCierre: new Date().toISOString(),
      montoCierre,
      estado: 'cerrada'
    };
    await db.updateSesionCaja(sesion as any);
    setSesionesCaja(prev => prev.map(s => s.id === sesion.id ? sesion : s));
    setCajaActiva(undefined);
    toast.success('Caja cerrada correctamente');
    return sesion;
  }, [cajaActiva]);

  const registrarMovimientoCaja = useCallback(async (movimiento: Omit<MovimientoCaja, 'id' | 'fecha' | 'cajaId' | 'usuarioId'> | number, tipo?: 'entrada' | 'salida', motivo?: string, _usuarioId?: string, cajaId?: string) => {
    const targetCajaId = cajaId || cajaActiva?.id;
    if (!targetCajaId) {
      toast.error('No se especificó una caja válida para el movimiento');
      return;
    }

    const data: Omit<MovimientoCaja, 'id' | 'fecha' | 'cajaId' | 'usuarioId'> = typeof movimiento === 'number' 
      ? { monto: movimiento, tipo: tipo || 'entrada', motivo: motivo || '' }
      : movimiento;

    const nuevoMovimiento: MovimientoCaja = {
      ...data,
      id: crypto.randomUUID(),
      cajaId: targetCajaId,
      usuarioId: 'admin',
      fecha: new Date().toISOString()
    };
    
    // Si es la caja activa, actualizamos el estado local
    if (cajaActiva?.id === targetCajaId) {
      setCajaActiva(current => {
        if (!current) return undefined;
        const updated = {
          ...current,
          movimientos: [...(current.movimientos || []), nuevoMovimiento],
        };
        db.updateSesionCaja(updated as any).catch(console.error);
        return updated;
      });
    } else {
      // Si es otra caja, actualizamos directamente en DB y en la lista de sesiones
      const sesion = sesionesCaja.find(s => s.id === targetCajaId);
      if (sesion) {
        const updated = {
          ...sesion,
          movimientos: [...(sesion.movimientos || []), nuevoMovimiento]
        };
        await db.updateSesionCaja(updated as any);
        setSesionesCaja(prev => prev.map(s => s.id === targetCajaId ? updated : s));
      }
    }

    toast.success('Movimiento registrado');
  }, [cajaActiva, sesionesCaja]);

  // --- Gestión de Ventas ---
  const registrarVenta = useCallback(async (data: Omit<Venta, 'id' | 'fecha'>): Promise<Venta> => {
    if (!cajaActiva) {
      toast.error('Debe abrir caja antes de registrar ventas');
      throw new Error('Caja cerrada');
    }

    const venta: Venta = {
      ...data,
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
    };

    // 1. Guardar venta en DB
    await db.addVenta(venta as any);
    setVentas(prev => [venta, ...prev]);

    // 2. Descontar del inventario
    for (const item of venta.items) {
      await onAjustarStock(
        item.productoId,
        item.cantidad,
        'salida',
        `Venta: ${venta.id.slice(0, 8)}`
      );
    }

    // 3. Actualizar caja activa
    const esCredito = venta.metodoPago === 'credito';
    setCajaActiva(current => {
      if (!current) return undefined;
      const updated = {
        ...current,
        totalVentas: (current.totalVentas || 0) + venta.total,
        totalVentasEfectivo: (current.totalVentasEfectivo ?? current.totalVentas ?? 0) + (esCredito ? 0 : venta.total),
        totalCreditos: (current.totalCreditos || 0) + (esCredito ? venta.total : 0),
        ventasIds: [...(current.ventasIds || []), venta.id]
      };
      db.updateSesionCaja(updated as any).catch(console.error);
      return updated;
    });

    setSesionesCaja(prev => prev.map(s => s.id === cajaActiva.id ? {
      ...s,
      totalVentas: (s.totalVentas || 0) + venta.total,
      totalVentasEfectivo: (s.totalVentasEfectivo ?? s.totalVentas ?? 0) + (esCredito ? 0 : venta.total),
      totalCreditos: (s.totalCreditos || 0) + (esCredito ? venta.total : 0),
      ventasIds: [...(s.ventasIds || []), venta.id]
    } : s));

    toast.success(`Venta registrada por $${venta.total}`);
    return venta;
  }, [cajaActiva, onAjustarStock]);

  // --- Gestión de Mesas ---
  const updateMesa = useCallback(async (mesa: Mesa) => {
    await db.updateMesa(mesa);
    setMesas(prev => prev.map(m => m.id === mesa.id ? mesa : m));
  }, []);

  const addMesa = useCallback(async (mesa: Mesa) => {
    await db.updateMesa(mesa); 
    setMesas(prev => [...prev, mesa]);
  }, []);

  const deleteMesa = useCallback(async (id: string) => {
    await db.deleteMesa(id);
    setMesas(prev => prev.filter(m => m.id !== id));
  }, []);

  // --- Gestión de Pedidos Activos ---
  const addPedidoActivo = useCallback(async (pedido: PedidoActivo) => {
    await db.addPedidoActivo(pedido);
    setPedidosActivos(prev => [...prev, pedido]);
  }, []);

  const updatePedidoActivo = useCallback(async (pedido: PedidoActivo) => {
    await db.updatePedidoActivo(pedido);
    setPedidosActivos(prev => prev.map(p => p.id === pedido.id ? pedido : p));
  }, []);

  const deletePedidoActivo = useCallback(async (id: string) => {
    await db.deletePedidoActivo(id);
    setPedidosActivos(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    ventas, setVentas,
    sesionesCaja, setSesionesCaja,
    cajaActiva, setCajaActiva,
    mesas, setMesas,
    pedidosActivos, setPedidosActivos,
    abrirCaja, cerrarCaja, registrarMovimientoCaja, registrarVenta,
    updateMesa, addMesa, deleteMesa,
    addPedidoActivo, updatePedidoActivo, deletePedidoActivo
  };
}
