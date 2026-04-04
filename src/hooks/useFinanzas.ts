/**
 * useFinanzas — Sub-hook para gestión de gastos, créditos y trabajadores
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useCallback } from 'react';
import { db } from '@/lib/database';
import type {
  Gasto,
  CreditoCliente,
  CreditoTrabajador,
  PagoCredito,
  Trabajador,
  Venta,
} from '@/types';
import { toast } from 'sonner';

interface UseFinanzasParams {
  onAjustarStock: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida', motivo: string) => Promise<void>;
}

export function useFinanzas({ onAjustarStock }: UseFinanzasParams) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ahorros, setAhorros] = useState<any[]>([]);
  const [creditosClientes, setCreditosClientes] = useState<CreditoCliente[]>([]);
  const [creditosTrabajadores, setCreditosTrabajadores] = useState<CreditoTrabajador[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);

  // --- Gastos ---
  const addGasto = useCallback(async (g: Omit<Gasto, 'id'>) => {
    const newG = { ...g, id: crypto.randomUUID() };
    await db.addGasto(newG as any);
    setGastos(prev => [newG as Gasto, ...prev]);
  }, []);

  const updateGasto = useCallback(async (id: string, updates: Partial<Gasto>) => {
    const gasto = gastos.find(g => g.id === id);
    if (!gasto) return;
    const updated = { ...gasto, ...updates };
    await db.updateGasto(updated as any);
    setGastos(prev => prev.map(g => g.id === id ? updated : g));
  }, [gastos]);

  const deleteGasto = useCallback(async (id: string) => {
    await db.deleteGasto(id);
    setGastos(prev => prev.filter(g => g.id !== id));
  }, []);

  const generarReporte = useCallback((periodo: string, ventas: Venta[]) => {
    const gastosPeriodo = gastos.filter(g => g.fecha.startsWith(periodo));
    const ventasPeriodo = ventas.filter(v => v.fecha.startsWith(periodo));

    const totalVentas = ventasPeriodo.reduce((s, v) => s + v.total, 0);
    const totalGastos = gastosPeriodo.reduce((s, g) => s + g.monto, 0);

    const gastosPorCategoria = gastosPeriodo.reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + g.monto;
      return acc;
    }, {} as any);

    return {
      periodo,
      totalVentas,
      totalGastos,
      utilidadBruta: totalVentas - totalGastos,
      gastosPorCategoria,
      ventasPorMetodoPago: ventasPeriodo.reduce((acc, v) => {
        acc[v.metodoPago] = (acc[v.metodoPago] || 0) + v.total;
        return acc;
      }, {} as any)
    };
  }, [gastos]);

  // --- Créditos Clientes ---
  const addCreditoCliente = useCallback(async (c: Omit<CreditoCliente, 'id' | 'createdAt'>) => {
    const nuevo: CreditoCliente = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.addCreditoCliente(nuevo);
    setCreditosClientes(prev => [nuevo, ...prev]);
  }, []);

  const updateCreditoCliente = useCallback(async (id: string, updates: Partial<CreditoCliente>) => {
    const credito = creditosClientes.find(c => c.id === id);
    if (!credito) return;
    const updated = { ...credito, ...updates };
    await db.updateCreditoCliente(updated);
    setCreditosClientes(prev => prev.map(c => c.id === id ? updated : c));
  }, [creditosClientes]);

  const deleteCreditoCliente = useCallback(async (id: string) => {
    await db.deleteCreditoCliente(id);
    setCreditosClientes(prev => prev.filter(c => c.id !== id));
  }, []);

  const registrarPagoCredito = useCallback(async (creditoId: string, pago: Omit<PagoCredito, 'id' | 'creditoId'>) => {
    const credito = creditosClientes.find(c => c.id === creditoId);
    if (!credito) return;
    if (pago.monto <= 0) return;
    const nuevoPago: PagoCredito = { ...pago, id: crypto.randomUUID(), creditoId };
    const nuevoSaldo = Math.max(0, credito.saldo - pago.monto);
    const updated: CreditoCliente = {
      ...credito,
      saldo: nuevoSaldo,
      estado: nuevoSaldo <= 0 ? 'pagado' : credito.estado,
      pagos: [...credito.pagos, nuevoPago]
    };
    await db.updateCreditoCliente(updated);
    setCreditosClientes(prev => prev.map(c => c.id === creditoId ? updated : c));
  }, [creditosClientes]);

  // --- Créditos Trabajadores ---
  const addCreditoTrabajador = useCallback(async (c: Omit<CreditoTrabajador, 'id' | 'createdAt'>) => {
    const nuevo: CreditoTrabajador = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.addCreditoTrabajador(nuevo);
    setCreditosTrabajadores(prev => [nuevo, ...prev]);
    // Descontar del inventario cada producto tomado
    for (const item of c.items) {
      if (item.productoId && item.cantidad > 0) {
        await onAjustarStock(item.productoId, item.cantidad, 'salida', `Crédito trabajador: ${c.trabajadorNombre}`);
      }
    }
  }, [onAjustarStock]);

  const updateCreditoTrabajador = useCallback(async (id: string, updates: Partial<CreditoTrabajador>) => {
    const credito = creditosTrabajadores.find(c => c.id === id);
    if (!credito) return;
    const updated = { ...credito, ...updates };
    await db.updateCreditoTrabajador(updated);
    setCreditosTrabajadores(prev => prev.map(c => c.id === id ? updated : c));
  }, [creditosTrabajadores]);

  const deleteCreditoTrabajador = useCallback(async (id: string) => {
    await db.deleteCreditoTrabajador(id);
    setCreditosTrabajadores(prev => prev.filter(c => c.id !== id));
  }, []);

  const registrarPagoCreditoTrabajador = useCallback(async (creditoId: string, pago: Omit<PagoCredito, 'id' | 'creditoId'>) => {
    const credito = creditosTrabajadores.find(c => c.id === creditoId);
    if (!credito) return;
    if (pago.monto <= 0) return;
    const nuevoPago: PagoCredito = { ...pago, id: crypto.randomUUID(), creditoId };
    const nuevoSaldo = credito.saldo - pago.monto;
    const nuevoEstado = nuevoSaldo <= 0 ? (credito.descontarDeSalario ? 'descontado' : 'pagado') : credito.estado;
    const updated: CreditoTrabajador = {
      ...credito,
      saldo: Math.max(0, nuevoSaldo),
      estado: nuevoEstado,
      pagos: [...credito.pagos, nuevoPago],
    };
    await db.updateCreditoTrabajador(updated);
    setCreditosTrabajadores(prev => prev.map(c => c.id === creditoId ? updated : c));
  }, [creditosTrabajadores]);

  // --- Trabajadores ---
  const addTrabajador = useCallback(async (t: Omit<Trabajador, 'id' | 'createdAt'>) => {
    const nuevo: Trabajador = { ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await db.addTrabajador(nuevo);
    setTrabajadores(prev => [nuevo, ...prev]);
  }, []);

  const updateTrabajador = useCallback(async (id: string, updates: Partial<Trabajador>) => {
    const trab = trabajadores.find(t => t.id === id);
    if (!trab) return;
    const updated = { ...trab, ...updates };
    await db.updateTrabajador(updated);
    setTrabajadores(prev => prev.map(t => t.id === id ? updated : t));
  }, [trabajadores]);

  const deleteTrabajador = useCallback(async (id: string) => {
    await db.deleteTrabajador(id);
    setTrabajadores(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    // State
    gastos, setGastos,
    ahorros, setAhorros,
    creditosClientes, setCreditosClientes,
    creditosTrabajadores, setCreditosTrabajadores,
    trabajadores, setTrabajadores,
    // Actions
    addGasto, updateGasto, deleteGasto, generarReporte,
    addCreditoCliente, updateCreditoCliente, deleteCreditoCliente, registrarPagoCredito,
    addCreditoTrabajador, updateCreditoTrabajador, deleteCreditoTrabajador, registrarPagoCreditoTrabajador,
    addTrabajador, updateTrabajador, deleteTrabajador,
  };
}
