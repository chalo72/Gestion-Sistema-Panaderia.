import { generateUUID } from '@/lib/safe-utils';
/**
 * useVentas — Sub-hook para gestión de ventas, caja, mesas y pedidos activos
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/database';
import { SupabaseDatabase } from '@/lib/supabase-db';
import { supabase } from '@/lib/supabase';
import type {
  Venta,
  CajaSesion,
  Mesa,
  PedidoActivo,
  MovimientoCaja
} from '@/types';
import { toast } from 'sonner';
import { procesarCuadreTurno, vigilarMovimientoCaja } from '@/lib/security-agent';
import { upsertCajaEnVentaDiaria } from '@/lib/finanzas-personales';
import { hoyLocal } from '@/lib/fecha-local';

const _supaDB = new SupabaseDatabase();

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
    const monto = Number(montoApertura);
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error('Monto de apertura inválido');
      throw new Error('Monto de apertura inválido');
    }

    // Leer extras pasados por localStorage desde AperturaCajaModal
    let extras: any = {};
    try {
      const raw = localStorage.getItem('dp_caja_extras');
      if (raw) {
        extras = JSON.parse(raw);
        localStorage.removeItem('dp_caja_extras'); // Consumido
      }
    } catch (e) { /* ignore */ }

    // Blindaje: no abrir un turno duplicado para una caja que ya tiene uno abierto
    // (bug real reportado por Gonzalo 2026-09-20: la app dejaba abrir varias veces la
    // misma caja, sobre todo tras el crash del modal de apertura — ver AperturaCajaModal.tsx).
    // Si ya hay una sesion 'abierta' con el mismo nombre de caja, avisamos y devolvemos
    // esa sesion existente en vez de crear una nueva.
    const nombreNuevaCajaNorm = String(extras.cajaNombre || '').trim().toLowerCase();
    if (nombreNuevaCajaNorm) {
      // 🩹 2026-10-09 (AUTORIZO Gonzalo): antes se miraba la lista en memoria de este hook,
      // que NO se enteraba de los cierres hechos en Control de Caja (Entrega de Turno /
      // Cierre de Jornada). En la tarde y la noche avisaba "ya tiene un turno abierto desde
      // las 08:52" de cajas YA cerradas, y "Cancelar" las volvía a cerrar y depositaba otra
      // vez en Bóveda ($100.000 de más cada vez). Ahora se lee el estado real guardado.
      let sesionesReales: CajaSesion[] = sesionesCaja;
      try {
        const frescas = await db.getAllSesionesCaja();
        if (Array.isArray(frescas) && frescas.length > 0) sesionesReales = frescas as CajaSesion[];
      } catch { /* sin lectura: se usa la lista en memoria */ }
      let yaAbierta = sesionesReales.find(s => s.estado === 'abierta' && String(s.cajaNombre || '').trim().toLowerCase() === nombreNuevaCajaNorm);
      // 🩹 2026-10-09 noche (AUTORIZO Gonzalo "dale"): si la entrega se hizo en OTRO aparato y este
      // aún no sincronizó, la copia local la sigue viendo abierta. Antes de avisar (y de que
      // "Cancelar" la vuelva a cerrar pisando lo contado y depositando otra vez en Bóveda),
      // se pregunta a la nube. Si allá ya está cerrada, no se avisa ni se toca.
      if (yaAbierta) {
        try {
          const { data: enNube } = await supabase.from('caja').select('estado').eq('id', yaAbierta.id).maybeSingle();
          if (enNube && enNube.estado && enNube.estado !== 'abierta') yaAbierta = undefined;
        } catch { /* sin conexión: se sigue con el dato local */ }
      }
      if (yaAbierta) {
        // Pedido de Gonzalo 2026-09-20: que el aviso de turno duplicado sea una decision real,
        // no solo un bloqueo. Aceptar = seguir usando el turno ya abierto (comportamiento previo).
        // Cancelar = cerrar ese turno viejo y abrir uno nuevo.
        const horaApertura = new Date(yaAbierta.fechaApertura).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const entradasViejas = (yaAbierta.movimientos || []).filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.monto, 0);
        const salidasViejas = (yaAbierta.movimientos || []).filter(m => m.tipo === 'salida').reduce((a, m) => a + m.monto, 0);
        const esperadoViejo = (yaAbierta.montoApertura || 0) + (yaAbierta.totalVentasEfectivo || 0) + entradasViejas - salidasViejas;
        const seguirUsando = window.confirm(
          `⚠️ ${extras.cajaNombre} ya tiene un turno abierto desde las ${horaApertura} (${yaAbierta.vendedoraNombre || 'sin nombre'}).\n\n` +
          `Aceptar = seguir usando ese turno que ya está abierto.\n` +
          `Cancelar = cerrar ese turno (con $${esperadoViejo.toLocaleString('es-CO')} calculado por el sistema, no contado a mano) y abrir uno nuevo.`
        );
        if (seguirUsando) {
          setCajaActiva(yaAbierta);
          toast.success(`Se siguió usando el turno de ${extras.cajaNombre} que ya estaba abierto.`);
          return yaAbierta;
        }
        // No seguir usando: cerrar el turno viejo (monto = efectivo esperado por el sistema,
        // igual que el boton "Usar sistema" de Entrega de Turno) y depositarlo en Boveda
        // Principal, igual que hace todo cierre normal en ControlCaja.tsx (handleEntregaTurno /
        // handleCierreJornada) - para no dejar ese dinero sin registrar.
        try {
          await cerrarCaja(esperadoViejo, yaAbierta.vendedoraNombre, undefined, 'Cerrada automáticamente al abrir un turno nuevo en la misma caja (monto = efectivo esperado por el sistema, no contado a mano).', yaAbierta.id);
          if (esperadoViejo > 0) {
            const { addMovimientoBoveda } = await import('@/lib/boveda-store');
            addMovimientoBoveda({
              bovedaDestinoId: 'boveda-principal',
              monto: esperadoViejo,
              motivo: `Cierre automático (turno nuevo): ${yaAbierta.cajaNombre || 'Caja'} (${yaAbierta.vendedoraNombre || 'Vendedora'})`,
              tipo: 'Ingreso',
              usuarioResponsable: yaAbierta.vendedoraNombre || 'Sistema',
              metodoPago: 'Efectivo'
            });
          }
          toast.success(`✅ Se cerró el turno anterior de ${extras.cajaNombre} y se está abriendo uno nuevo.`);
        } catch (e) {
          console.error('Error cerrando turno anterior antes de abrir uno nuevo:', e);
          toast.error('No se pudo cerrar el turno anterior automáticamente. Contacta al administrador.');
        }
      }
    }

    const sesion: CajaSesion = {
      id: generateUUID(),
      usuarioId,
      fechaApertura: new Date().toISOString(),
      montoApertura: Math.round(monto * 100) / 100,
      totalVentas: 0,
      totalVentasEfectivo: 0,
      totalCreditos: 0,
      montoCierre: undefined,
      estado: 'abierta',
      movimientos: [],
      ventasIds: [],
      cajaNombre: extras.cajaNombre,
      turno: extras.turno,
      vendedoraNombre: extras.vendedoraNombre,
      eventoEspecial: extras.eventoEspecial
    };
    await db.addSesionCaja(sesion as any);
    _supaDB.addSesionCaja(sesion as any).catch(() => {});
    setSesionesCaja(prev => [...prev, sesion]);
    setCajaActiva(sesion);
    localStorage.setItem('dp_caja_apertura_ts', sesion.fechaApertura);
    toast.success('Caja abierta correctamente');
    return sesion;
  }, [sesionesCaja]);

  // cajaId opcional: permite cerrar UNA caja especifica de la lista (no siempre la
  // "cajaActiva" de este dispositivo). Sin cajaId, se comporta exactamente igual que antes
  // (cierra cajaActiva) - fix 2026-09-17 Claude Sonnet 5, ver mesa de trabajo en CORE_MEMORY.md.
  const cerrarCaja = useCallback(async (montoCierre: number, nombreUsuario?: string, ventasManual?: number, nota?: string, cajaId?: string) => {
    const targetId = cajaId || cajaActiva?.id;
    const target = !targetId ? undefined : (cajaActiva?.id === targetId ? cajaActiva : sesionesCaja.find(s => s.id === targetId));
    // 2026-10-02 (AUTORIZO Gonzalo): antes devolvia undefined EN SILENCIO y el modal de
    // cierre se cerraba igual, asi que la vendedora creia que habia guardado y no se
    // habia guardado nada. Ahora truena con un mensaje que dice exactamente que paso.
    if (!target) {
      const detalle = !targetId
        ? 'no llego el identificador de la caja'
        : 'esa caja ya no aparece como abierta en este dispositivo';
      throw new Error('No se pudo cerrar la caja: ' + detalle + '. NO se guardo nada. Recarga la lista de cajas y reintenta.');
    }
    const hayVentaManual = Number.isFinite(ventasManual) && (ventasManual as number) > 0;
    const sesion: CajaSesion = {
      ...target,
      fechaCierre: new Date().toISOString(),
      montoCierre,
      estado: 'cerrada',
      ...(hayVentaManual ? {
        totalVentas: ventasManual as number,
        totalVentasEfectivo: ventasManual as number,
        ventasManualIngresadas: true,
      } : {}),
      ...(nota ? { observaciones: nota } : {}),
    };
    await db.updateSesionCaja(sesion as any);
    _supaDB.updateSesionCaja(sesion as any).catch(() => {});
    setSesionesCaja(prev => prev.map(s => s.id === sesion.id ? sesion : s));
    window.dispatchEvent(new Event('dp_sesiones_caja_changed'));
    if (cajaActiva?.id === sesion.id) setCajaActiva(undefined);
    // Generar cuadre de seguridad automáticamente
    try {
      // Separar lo que de verdad entró en billetes de lo pagado por Nequi/transferencia/tarjeta.
      // totalVentasEfectivo suma todo lo que no es crédito, y eso daba faltantes falsos.
      const ventasCaja = ventas.filter(v => v.cajaId === target.id);
      const sumar = (pred: (m: string) => boolean) => ventasCaja
        .filter(v => pred(v.metodoPago)).reduce((acc, v) => acc + (Number(v.total) || 0), 0);
      const usarDetalle = !hayVentaManual && ventasCaja.length > 0;
      const movs = target.movimientos || [];
      const entradas = movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + (Number(m.monto) || 0), 0);
      const salidas = movs.filter(m => m.tipo === 'salida').reduce((a, m) => a + (Number(m.monto) || 0), 0);
      procesarCuadreTurno({
        usuarioId: target.usuarioId || 'desconocido',
        usuarioNombre: nombreUsuario || target.vendedoraNombre || target.usuarioId || 'Vendedora',
        fechaApertura: target.fechaApertura,
        montoApertura: target.montoApertura || 0,
        montoDeclarado: montoCierre,
        ventasEfectivo: usarDetalle ? sumar(m => m === 'efectivo') : (sesion.totalVentasEfectivo || 0),
        ventasNequi: usarDetalle ? sumar(m => m === 'nequi' || m === 'daviplata') : ((target as any).totalVentasNequi || 0),
        ventasTransferencia: usarDetalle ? sumar(m => m === 'transferencia' || m === 'tarjeta') : ((target as any).totalVentasTransferencia || 0),
        ventasCredito: usarDetalle ? sumar(m => m === 'credito') : (target.totalCreditos || 0),
        entradas,
        salidas,
      });
      if (cajaActiva?.id === sesion.id) localStorage.removeItem('dp_caja_apertura_ts');
    } catch (e) {
      console.warn('[Security] Error al generar cuadre:', e);
    }
    // Sincroniza el total manual con "Ventas del Día" (Reportes → Análisis Financiero)
    // para no tener que anotarlo dos veces en pantallas distintas.
    if (hayVentaManual) {
      try {
        const fechaHoy = hoyLocal();
        upsertCajaEnVentaDiaria(fechaHoy, sesion.cajaNombre || 'Caja', ventasManual as number);
      } catch (e) {
        console.warn('[Caja] No se pudo sincronizar con Ventas del Día:', e);
      }
    }
    toast.success('Caja cerrada correctamente');
    return sesion;
  }, [cajaActiva, sesionesCaja, ventas]);

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
      id: generateUUID(),
      cajaId: targetCajaId,
      usuarioId: _usuarioId || 'admin',
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

    // Bitácora anti-robo: todo movimiento queda registrado; retiros grandes o sin motivo alertan
    try {
      const sesionMov = cajaActiva?.id === targetCajaId ? cajaActiva : sesionesCaja.find(s => s.id === targetCajaId);
      vigilarMovimientoCaja({
        tipo: data.tipo,
        monto: Number(data.monto) || 0,
        motivo: data.motivo,
        usuarioId: nuevoMovimiento.usuarioId,
        usuarioNombre: sesionMov?.vendedoraNombre || nuevoMovimiento.usuarioId,
        cajaNombre: sesionMov?.cajaNombre,
      });
    } catch (e) {
      console.warn('[Security] Error al vigilar movimiento:', e);
    }

    toast.success('Movimiento registrado');
  }, [cajaActiva, sesionesCaja]);

  // --- Gestión de Ventas ---
  const registrarVenta = useCallback(async (data: Omit<Venta, 'id' | 'fecha'>): Promise<Venta> => {
    if (!cajaActiva) {
      toast.error('Debe abrir caja antes de registrar ventas');
      throw new Error('Caja cerrada');
    }

    // Si el caller no mandó total, calcularlo de ítems (evita NaN en caja/historial)
    const totalCalculado = Math.round(
      (data.items || []).reduce((sum, item) => {
        const sub =
          typeof item.subtotal === 'number' && Number.isFinite(item.subtotal)
            ? item.subtotal
            : (Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 0);
        return sum + sub;
      }, 0) * 100
    ) / 100;
    const total =
      typeof data.total === 'number' && Number.isFinite(data.total) && data.total >= 0
        ? Math.round(data.total * 100) / 100
        : totalCalculado;

    const venta: Venta = {
      ...data,
      // Amarrar la venta a su caja: sin esto el cuadre no puede separar efectivo de Nequi
      cajaId: data.cajaId || cajaActiva.id,
      total,
      id: generateUUID(),
      fecha: new Date().toISOString(),
    };

    // 1. Guardar venta en DB local + Supabase (para que otros dispositivos la vean)
    await db.addVenta(venta as any);
    _supaDB.addVenta(venta as any).catch(() => {});
    setVentas(prev => [venta, ...prev]);

    // 2. Descontar del inventario
    for (const item of venta.items) {
      // Líneas de servicio (ej. cobro de pedido de torta) no son productos del inventario
      if (String(item.productoId).startsWith('servicio:')) continue;
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
    _supaDB.updateMesa(mesa).catch(() => {});
    setMesas(prev => prev.map(m => m.id === mesa.id ? mesa : m));
  }, []);

  const addMesa = useCallback(async (mesa: Mesa) => {
    await db.updateMesa(mesa);
    _supaDB.updateMesa(mesa).catch(() => {});
    setMesas(prev => [...prev, mesa]);
  }, []);

  const deleteMesa = useCallback(async (id: string) => {
    await db.deleteMesa(id);
    _supaDB.deleteMesa(id).catch(() => {});
    setMesas(prev => prev.filter(m => m.id !== id));
  }, []);

  // --- Gestión de Pedidos Activos ---
  const addPedidoActivo = useCallback(async (pedido: PedidoActivo) => {
    await db.addPedidoActivo(pedido);
    _supaDB.updatePedidoActivo(pedido).catch(() => {});
    setPedidosActivos(prev => [...prev, pedido]);
  }, []);

  const updatePedidoActivo = useCallback(async (pedido: PedidoActivo) => {
    await db.updatePedidoActivo(pedido);
    _supaDB.updatePedidoActivo(pedido).catch(() => {});
    setPedidosActivos(prev => prev.map(p => p.id === pedido.id ? pedido : p));
  }, []);

  const deletePedidoActivo = useCallback(async (id: string) => {
    await db.deletePedidoActivo(id);
    _supaDB.deletePedidoActivo(id).catch(() => {});
    setPedidosActivos(prev => prev.filter(p => p.id !== id));
  }, []);

  // 🩹 2026-10-09: cuando Control de Caja cierra/entrega una caja en ESTE aparato, refrescar
  // la lista de este hook (antes quedaba vieja y seguía viendo esas cajas "abiertas").
  useEffect(() => {
    const refrescar = () => {
      db.getAllSesionesCaja().then(lista => {
        const sesiones = lista as CajaSesion[];
        setSesionesCaja(sesiones);
        setCajaActiva(prev => {
          if (!prev) return prev;
          const actual = sesiones.find(s => s.id === prev.id);
          if (!actual) return prev;
          return actual.estado === 'abierta' ? actual : undefined;
        });
      }).catch(() => {});
    };
    window.addEventListener('dp_sesiones_caja_changed', refrescar);
    return () => window.removeEventListener('dp_sesiones_caja_changed', refrescar);
  }, []);

  // Sync bidireccional: actualiza React state cuando otro dispositivo hace cambios
  useEffect(() => {
    const handle = async (e: Event) => {
      const { table, eventType, id } = (e as CustomEvent<{ table: string; eventType: string; id: string }>).detail;

      if (table === 'ventas') {
        if (eventType === 'DELETE') {
          setVentas(prev => prev.filter(v => v.id !== id));
        } else {
          db.getAllVentas().then(setVentas).catch(() => {});
        }
      } else if (table === 'caja' || table === 'sesiones_caja') {
        // useRealtimeSync avisa con 'sesiones_caja'. Si otro aparato cerró la caja de este,
        // se suelta; no se cambia a la caja abierta de otro aparato.
        db.getAllSesionesCaja().then(lista => {
          const sesiones = lista as CajaSesion[];
          setSesionesCaja(sesiones);
          setCajaActiva(prev => {
            if (!prev) return prev;
            const actual = sesiones.find(s => s.id === prev.id);
            if (!actual) return prev;
            return actual.estado === 'abierta' ? actual : undefined;
          });
        }).catch(() => {});
      } else if (table === 'mesas') {
        if (eventType === 'DELETE') {
          setMesas(prev => prev.filter(m => m.id !== id));
        } else {
          db.getAllMesas().then(setMesas).catch(() => {});
        }
      } else if (table === 'pedidos_activos') {
        if (eventType === 'DELETE') {
          setPedidosActivos(prev => prev.filter(p => p.id !== id));
        } else {
          db.getAllPedidosActivos().then(setPedidosActivos).catch(() => {});
        }
      }
    };
    window.addEventListener('nexus-realtime-change', handle);
    return () => window.removeEventListener('nexus-realtime-change', handle);
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
