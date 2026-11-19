import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Camera, 
  Trash2,
  Coffee,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import type { Trabajador, CreditoTrabajador, Cliente, CreditoCliente } from '@/types';
import { sumarConsumo, creditoConsumoAbierto, historialCliente } from '@/lib/consumo-clientes';
import { DetalleCuentaCliente } from '@/components/consumo/DetalleCuentaCliente';
import { achicarFoto } from '@/lib/achicar-foto';
import { OrigenCredito, HistorialCredito } from '@/components/nomina/HistorialCredito';

const PREFIJO_CLIENTE = 'cli:';

// Pesos enteros: en celular el teclado escribe "7.000" y un input type="number" lo lee como 7.
const soloDigitos = (s: string) => s.replace(/\D/g, '');
const conMiles = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

interface FiadosEmpleadosProps {
  trabajadores?: Trabajador[];
  usuarios?: any[];
  creditos?: CreditoTrabajador[];
  onAddCredito?: (c: Omit<CreditoTrabajador, 'id'>) => Promise<void>;
  onUpdateCredito?: (id: string, c: Partial<CreditoTrabajador>) => Promise<void>;
  onDeleteCredito?: (id: string) => Promise<void>;
  esAdmin?: boolean;
  // Clientes de confianza (Cliente.enConsumo): su consumo se guarda como crédito del cliente
  clientes?: Cliente[];
  creditosClientes?: CreditoCliente[];
  onAddCreditoCliente?: (c: Omit<CreditoCliente, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateCreditoCliente?: (id: string, updates: Partial<CreditoCliente>) => Promise<void>;
  usuarioId?: string;
  /** Trae la foto de un registro desde la nube solo cuando se toca (la lista no las descarga). */
  onVerFoto?: (id: string) => Promise<string | null>;
}

export default function FiadosEmpleados({
  trabajadores = [], creditos = [], onAddCredito, onUpdateCredito, onDeleteCredito, esAdmin = false,
  clientes = [], creditosClientes = [], onAddCreditoCliente, onUpdateCreditoCliente, usuarioId, onVerFoto,
}: FiadosEmpleadosProps) {
  const clientesConsumo = useMemo(() => clientes.filter(c => c.enConsumo), [clientes]);
  const puedeAnotarClientes = !!onAddCreditoCliente && !!onUpdateCreditoCliente && clientesConsumo.length > 0;
  const [guardando, setGuardando] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);
  const [nuevoCreditoTrabajador, setNuevoCreditoTrabajador] = useState('');
  const [nuevoCreditoMonto, setNuevoCreditoMonto] = useState('');
  const [nuevoCreditoDesc, setNuevoCreditoDesc] = useState('');
  const [nuevoCreditoFoto, setNuevoCreditoFoto] = useState<string | null>(null);
  const [nuevoCreditoTipo, setNuevoCreditoTipo] = useState<'consumo' | 'prestamo'>('consumo');

  const [filtroTrabajador, setFiltroTrabajador] = useState<string>('todos');
  const [clienteDetalleId, setClienteDetalleId] = useState<string | null>(null);
  const [editandoCreditoId, setEditandoCreditoId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editTipo, setEditTipo] = useState<'consumo' | 'prestamo'>('consumo');

  // Solo empleadas reales (módulo Trabajadores). Las cuentas de acceso (usuarios) NO son empleadas:
  // incluían inactivas/duplicadas y sus registros no se descontaban en Nómina (que busca por id de trabajadora).
  const todosLosEmpleados = useMemo(() => {
    const vistos = new Set<string>();
    return trabajadores
      .filter(t => t?.id && String(t.estado ?? '').trim().toLowerCase() === 'activo')
      .filter(t => (vistos.has(t.id) ? false : (vistos.add(t.id), true)))
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  }, [trabajadores]);

  const empleadosAnteriores = useMemo(() => {
    const activos = new Set(todosLosEmpleados.map(t => t.id));
    const mapa = new Map<string, string>();
    creditos.forEach(c => {
      if (c.trabajadorId && !activos.has(c.trabajadorId) && !mapa.has(c.trabajadorId)) {
        mapa.set(c.trabajadorId, c.trabajadorNombre || 'Sin nombre');
      }
    });
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }));
  }, [creditos, todosLosEmpleados]);

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Se achica antes de guardar: una foto de celular de 4 MB saturaba la nube (2026-11-16)
    achicarFoto(file)
      .then(setNuevoCreditoFoto)
      .catch(() => toast.error('No se pudo leer la foto.'));
  };

  const limpiarFormulario = () => {
    setNuevoCreditoMonto('');
    setNuevoCreditoDesc('');
    setNuevoCreditoFoto(null);
    setNuevoCreditoTrabajador('');
  };

  // Cliente de confianza → se suma a su cuenta de consumo abierta (crédito de cliente, va a la nube)
  const handleAddConsumoCliente = async (clienteId: string, monto: number) => {
    const cliente = clientesConsumo.find(c => c.id === clienteId);
    if (!cliente || !onAddCreditoCliente || !onUpdateCreditoCliente) {
      toast.error('No se encontró el cliente.');
      return;
    }
    const abierto = creditoConsumoAbierto(creditosClientes, cliente.id);
    const r = sumarConsumo(abierto, {
      cliente,
      monto,
      descripcion: nuevoCreditoDesc,
      foto: nuevoCreditoFoto,
      usuarioId: usuarioId || 'consumo',
    });
    if (r.esNuevo) await onAddCreditoCliente(r.credito);
    else await onUpdateCreditoCliente(r.credito.id, r.credito);
    limpiarFormulario();
    toast.success(`Anotado a ${cliente.nombre}. Debe ${formatCurrency(r.credito.saldo)}.`);
  };

  const verFoto = async (c: CreditoTrabajador) => {
    if (c.fotoEvidencia) { setFotoAbierta(c.fotoEvidencia); return; }
    if (!onVerFoto) return;
    const foto = await onVerFoto(c.id).catch(() => null);
    if (foto) setFotoAbierta(foto);
    else toast.error('No se pudo traer la foto.');
  };

  const handleAddCredito = async () => {
    if (!nuevoCreditoTrabajador || !nuevoCreditoMonto || !nuevoCreditoDesc) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    const monto = parseFloat(nuevoCreditoMonto);
    if (isNaN(monto) || monto <= 0) {
      toast.error('Monto inválido');
      return;
    }
    if (guardando) return;
    if (nuevoCreditoTrabajador.startsWith(PREFIJO_CLIENTE)) {
      setGuardando(true);
      try {
        await handleAddConsumoCliente(nuevoCreditoTrabajador.slice(PREFIJO_CLIENTE.length), monto);
      } catch (e) {
        console.error('[Consumo] Error guardando consumo de cliente:', e);
        toast.error('No se pudo guardar el consumo del cliente.');
      } finally {
        setGuardando(false);
      }
      return;
    }
    const trabajador = todosLosEmpleados.find(t => t.id === nuevoCreditoTrabajador);
    if (!trabajador || !onAddCredito) return;

    setGuardando(true);
    try {
      await onAddCredito({
        trabajadorId: trabajador.id,
        trabajadorNombre: trabajador.nombre,
        monto: monto,
        saldo: monto,
        descripcion: nuevoCreditoDesc,
        tipo: nuevoCreditoTipo,
        fecha: new Date().toISOString(),
        estado: 'activo',
        items: [],
        descontarDeSalario: true,
        pagos: [],
        usuarioId: usuarioId || 'anon',
        createdAt: new Date().toISOString(),
        fotoEvidencia: nuevoCreditoFoto || undefined
      });

      toast.success('Registro guardado');
      limpiarFormulario();
    } catch (e) {
      console.error('[Consumo] Error guardando registro:', e);
      toast.error('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleUpdate = async (c: CreditoTrabajador) => {
    if (!onUpdateCredito) return;
    const m = parseFloat(editMonto);
    if (isNaN(m) || m <= 0) {
      toast.error("Monto inválido");
      return;
    }
    await onUpdateCredito(c.id, { 
      tipo: editTipo, 
      descripcion: editDesc, 
      monto: m, 
      saldo: c.estado === 'activo' ? m : 0 
    });
    toast.success("Actualizado");
    setEditandoCreditoId(null);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('¿Seguro que quieres borrar este registro?')) {
      if (onDeleteCredito) await onDeleteCredito(id);
    }
  };

  const creditosFiltrados = useMemo(() => {
    let result = [...creditos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    if (filtroTrabajador !== 'todos') {
      result = result.filter(c => c.trabajadorId === filtroTrabajador);
    }
    return result;
  }, [creditos, filtroTrabajador]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
              <Coffee className="w-6 h-6" />
            </div>
            Consumo y Préstamos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registro de consumos internos (fiados) y préstamos para empleados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="w-5 h-5" /> Registrar Nuevo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Registro</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800"
                  value={nuevoCreditoTipo}
                  onChange={e => setNuevoCreditoTipo(e.target.value as 'consumo' | 'prestamo')}
                >
                  <option value="consumo">🛍️ Consumo de Productos (Fiado)</option>
                  <option value="prestamo">💸 Préstamo de Dinero / Adelanto</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">{puedeAnotarClientes ? 'Empleada o Cliente' : 'Trabajadora / Empleada'}</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800"
                  value={nuevoCreditoTrabajador}
                  onChange={e => setNuevoCreditoTrabajador(e.target.value)}
                >
                  <option value="">{todosLosEmpleados.length === 0 ? 'No hay empleadas activas (créalas en Trabajadores)' : 'Selecciona empleada...'}</option>
                  <optgroup label="Empleadas">
                    {todosLosEmpleados.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </optgroup>
                  {puedeAnotarClientes && (
                    <optgroup label="Clientes de confianza">
                      {clientesConsumo.map(c => (
                        <option key={c.id} value={`${PREFIJO_CLIENTE}${c.id}`}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Monto ($ COP)</Label>
                <Input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="Ej: 25.000" 
                  value={conMiles(nuevoCreditoMonto)}
                  onChange={e => setNuevoCreditoMonto(soloDigitos(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Descripción</Label>
                <Input 
                  placeholder="Ej: 2 Panes o Préstamo para transporte" 
                  value={nuevoCreditoDesc}
                  onChange={e => setNuevoCreditoDesc(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Evidencia Fotográfica (Opcional)</Label>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors w-full">
                    <Camera className="w-4 h-4" /> 
                    {nuevoCreditoFoto ? 'Cambiar Foto' : 'Tomar / Subir Foto'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoUpload} />
                  </label>
                  {nuevoCreditoFoto && (
                    <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border border-slate-200">
                      <img src={nuevoCreditoFoto} alt="Evidencia" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleAddCredito} disabled={guardando} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg font-bold">
                {guardando ? 'Guardando…' : 'Guardar Registro'}
              </Button>
            </CardContent>
          </Card>

          {puedeAnotarClientes && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Clientes de confianza — cuenta abierta</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clientesConsumo.map(cl => {
                    const h = historialCliente(creditosClientes, cl.id);
                    const ultimas = h.lineas.slice(0, 3);
                    return (
                      <button
                        type="button"
                        key={cl.id}
                        onClick={() => setClienteDetalleId(cl.id)}
                        className="w-full text-left p-4 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-white">{cl.nombre}</h4>
                          <span className="font-black text-indigo-600 dark:text-indigo-400">
                            {h.deudaTotal > 0 ? `Debe ${formatCurrency(h.deudaTotal)}` : 'Al día'}
                          </span>
                        </div>
                        {h.deudaOtros > 0 && (
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Consumo {formatCurrency(h.deudaConsumo)} + registrado en Clientes {formatCurrency(h.deudaOtros)}
                          </p>
                        )}
                        {ultimas.map(it => (
                          <p key={it.key} className="text-sm text-slate-600 dark:text-slate-400 flex justify-between gap-2">
                            <span>{it.etiquetaFecha} · {it.texto}</span>
                            <span className="tabular-nums">{formatCurrency(it.monto)}</span>
                          </p>
                        ))}
                        {h.lineas.length > 0 && (
                          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300 pt-1">
                            Ver detalle, imprimir o enviar ({h.lineas.length}) →
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 mb-4 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <select
              className="bg-transparent text-sm font-medium outline-none text-slate-700 dark:text-slate-300 w-full"
              value={filtroTrabajador}
              onChange={e => setFiltroTrabajador(e.target.value)}
            >
              <option value="todos">Todas las empleadas</option>
              {todosLosEmpleados.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
              {empleadosAnteriores.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} (ya no activa)</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {creditosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Coffee className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No hay registros para mostrar</p>
              </div>
            ) : (
              creditosFiltrados.map(c => {
                const isEditing = editandoCreditoId === c.id;
                const isPrestamo = c.tipo === 'prestamo';
                return (
                  <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    {isEditing ? (
                      <div className="w-full flex flex-col gap-2">
                        <div className="flex gap-2">
                          <select 
                            className="h-9 rounded-md border px-2 text-xs"
                            value={editTipo}
                            onChange={e => setEditTipo(e.target.value as 'consumo'|'prestamo')}
                          >
                            <option value="consumo">Consumo</option>
                            <option value="prestamo">Préstamo</option>
                          </select>
                          <Input className="h-9 text-xs flex-1" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción" />
                          <Input className="h-9 text-xs w-24" type="text" inputMode="numeric" value={conMiles(editMonto)} onChange={e => setEditMonto(soloDigitos(e.target.value))} placeholder="Monto" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditandoCreditoId(null)}>Cancelar</Button>
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => handleUpdate(c)}>Guardar</Button>
                          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(c.id)}>🗑️</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPrestamo ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            {isPrestamo ? '💸' : '🛍️'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              {c.trabajadorNombre}
                              {isPrestamo && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-widest font-black">Préstamo</span>}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{c.descripcion}</p>
                            <div className="mt-1 space-y-0.5">
                              <OrigenCredito c={c} />
                              <HistorialCredito c={c} />
                            </div>
                            <div className="flex gap-2 items-center mt-1.5">
                              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                                {new Date(c.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {esAdmin && (
                                <button onClick={() => {
                                  setEditandoCreditoId(c.id);
                                  setEditDesc(c.descripcion);
                                  setEditMonto(String(Math.round(c.monto)));
                                  setEditTipo(c.tipo || 'consumo');
                                }} className="text-[10px] text-blue-500 hover:underline font-bold">Editar</button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                          <div className="text-right">
                            <p className="text-lg font-black text-slate-900 dark:text-white">
                              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.monto)}
                            </p>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              c.estado === 'pagado' || c.estado === 'descontado'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}>
                              {c.estado === 'activo' ? 'PENDIENTE' : c.estado}
                            </span>
                          </div>
                          {c.fotoEvidencia ? (
                            <button type="button" onClick={() => verFoto(c)} aria-label="Ver foto">
                              <img src={c.fotoEvidencia} alt="Evidencia" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                            </button>
                          ) : c.tieneFoto && onVerFoto ? (
                            <button type="button" onClick={() => verFoto(c)} className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500" aria-label="Ver foto">
                              <Camera className="w-5 h-5" />
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {clienteDetalleId && (() => {
        const cl = clientesConsumo.find(c => c.id === clienteDetalleId);
        return cl ? (
          <DetalleCuentaCliente
            cliente={{ id: cl.id, nombre: cl.nombre, telefono: cl.telefono }}
            creditos={creditosClientes}
            formatCurrency={formatCurrency}
            onCerrar={() => setClienteDetalleId(null)}
          />
        ) : null;
      })()}

      {fotoAbierta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoAbierta(null)}>
          <img src={fotoAbierta} alt="Evidencia" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
