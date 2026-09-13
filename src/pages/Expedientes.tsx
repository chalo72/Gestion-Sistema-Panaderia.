import React, { useState, useEffect } from 'react';
import { ShieldAlert, User, Clock, AlertTriangle, Eye, CheckCircle2, MoreVertical, Search, FileDown, Trophy, Star, TrendingUp, Medal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/database';
import { GRAVEDADES, ESTADOS, nuevaEmpleada, nuevoMerito } from '@/lib/expediente-empleada';
import type { FaltaEmpleada, EmpleadaPerfil, MeritoEmpleada } from '@/lib/expediente-empleada';
import { toast } from 'sonner';
import CapturaRostro from '@/components/Biometria/CapturaRostro';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TAREAS_DEFAULT, getCompletadasLocal } from '@/lib/checklists';
import { fechaLocalHoy } from '@/lib/finanzas-personales';
import { CheckSquare, DollarSign, Sun, Moon, AlertCircle, Sparkles, Activity, ShieldCheck } from 'lucide-react';
import { enviarTelemetria } from '@/lib/telemetria-nexus';

export default function ExpedientesPage() {
  const [faltas, setFaltas] = useState<FaltaEmpleada[]>([]);
  const [meritos, setMeritos] = useState<MeritoEmpleada[]>([]);
  const [empleadas, setEmpleadas] = useState<EmpleadaPerfil[]>([]);
  const [empleadaIdFiltro, setEmpleadaIdFiltro] = useState<string>('all');
  const [empleadaCaptura, setEmpleadaCaptura] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ventasHoy, setVentasHoy] = useState<any[]>([]);
  const [sesionesCajaHoy, setSesionesCajaHoy] = useState<any[]>([]);

  // Formulario para Nuevo Mérito Manual
  const [mostrarFormMerito, setMostrarFormMerito] = useState(false);
  const [nuevoMeritoData, setNuevoMeritoData] = useState({ titulo: '', puntos: 10, tipo: 'otros' as MeritoEmpleada['tipo'], descripcion: '' });

  const cargarDatos = async () => {
    try {
      const emps = await db.getAllEmpleadasPerfil();
      const fs = await db.getAllFaltasEmpleada();
      const ms = await db.getAllMeritosEmpleada?.() || [];
      
      // Filtrar mocks antiguos ('María González' / 'Laura Martínez') y cargar personal oficial
      const limpias = emps.filter(e => e.nombre !== 'María González' && e.nombre !== 'Laura Martínez');
      if (limpias.length === 0) {
        const p1 = nuevaEmpleada('Vendedor Mañana', 'Vendedora Mostrador');
        const p2 = nuevaEmpleada('Vendedor Tarde', 'Vendedora Mostrador');
        const p3 = nuevaEmpleada('Panadero', 'Jefe de Horno');
        const p4 = nuevaEmpleada('Gerente', 'Administración');
        await Promise.all([
          db.saveEmpleadaPerfil(p1),
          db.saveEmpleadaPerfil(p2),
          db.saveEmpleadaPerfil(p3),
          db.saveEmpleadaPerfil(p4)
        ]);
        setEmpleadas([p1, p2, p3, p4]);
      } else {
        setEmpleadas(limpias);
      }
      
      try {
        const allV = await db.getAllVentas?.() || [];
        const allC = await db.getAllSesionesCaja?.() || [];
        const hoy = fechaLocalHoy();
        setVentasHoy(allV.filter((v: any) => (v.fecha || v.fechaVenta || '').startsWith(hoy)));
        setSesionesCajaHoy(allC.filter((c: any) => (c.fecha || c.fechaApertura || '').startsWith(hoy)));
      } catch (_) {}
      
      setFaltas(fs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setMeritos(ms.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
      toast.error('Error cargando expedientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const marcarComoRevisado = async (id: string) => {
    try {
      const falta = faltas.find(f => f.id === id);
      if (!falta) return;
      
      falta.estado = 'revisado';
      await db.updateFaltaEmpleada(falta);
      setFaltas([...faltas]);
      toast.success('Falta marcada como revisada');
    } catch (err) {
      toast.error('Error actualizando estado');
    }
  };

  const handleCapturarRostro = async (descriptor: number[], fotoBase64: string) => {
    if (!empleadaCaptura) return;
    try {
      const emp = empleadas.find(e => e.id === empleadaCaptura);
      if (emp) {
        emp.faceDescriptor = descriptor;
        emp.fotoPerfil = fotoBase64;
        await db.saveEmpleadaPerfil(emp);
        setEmpleadas([...empleadas]);
        toast.success(`Rostro guardado para ${emp.nombre}`);
      }
    } catch (err) {
      toast.error('Error guardando rostro');
    } finally {
      setEmpleadaCaptura(null);
    }
  };

  const guardarMeritoManual = async () => {
    if (empleadaIdFiltro === 'all' || empleadaIdFiltro === 'sin_identificar') {
      toast.error('Selecciona una empleada específica arriba para asignarle el mérito');
      return;
    }
    if (!nuevoMeritoData.titulo) {
      toast.error('Debes ingresar un título');
      return;
    }

    try {
      const merito = nuevoMerito({
        empleadaId: empleadaIdFiltro,
        titulo: nuevoMeritoData.titulo,
        descripcion: nuevoMeritoData.descripcion,
        puntos: nuevoMeritoData.puntos,
        tipo: nuevoMeritoData.tipo
      });
      await db.saveMeritoEmpleada(merito);
      
      // Actualizar puntos de la empleada
      const emp = empleadas.find(e => e.id === empleadaIdFiltro);
      if (emp) {
        emp.puntos = (emp.puntos || 0) + merito.puntos;
        await db.saveEmpleadaPerfil(emp);
      }
      
      toast.success(`¡Mérito otorgado! +${merito.puntos} puntos`);
      setMostrarFormMerito(false);
      setNuevoMeritoData({ titulo: '', puntos: 10, tipo: 'otros', descripcion: '' });
      cargarDatos();
    } catch (err) {
      toast.error('Error guardando el mérito');
    }
  };

  const getNombreEmpleada = (id: string) => {
    if (id === 'sin_identificar') return 'Sin Identificar (Auto)';
    return empleadas.find(e => e.id === id)?.nombre || 'Desconocida';
  };

  const faltasFiltradas = empleadaIdFiltro === 'all' 
    ? faltas 
    : faltas.filter(f => f.empleadaId === empleadaIdFiltro);
    
  const meritosFiltrados = empleadaIdFiltro === 'all' 
    ? meritos 
    : meritos.filter(m => m.empleadaId === empleadaIdFiltro);

  // Calcular ranking
  const empleadasRanking = [...empleadas].sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

  // Separación y resumen de turnos (Mañana vs. Tarde)
  const hoyStr = fechaLocalHoy();
  const completadasHoy = getCompletadasLocal().filter(c => c.fecha === hoyStr);

  const tareasManana = TAREAS_DEFAULT.filter(t => t.momento === 'apertura' || t.momento === 'todo_el_dia');
  const cumplidasManana = tareasManana.filter(t => completadasHoy.some(c => c.tareaId === t.id));
  const faltantesManana = tareasManana.filter(t => !completadasHoy.some(c => c.tareaId === t.id));
  const pctManana = tareasManana.length > 0 ? Math.round((cumplidasManana.length / tareasManana.length) * 100) : 0;

  const tareasTarde = TAREAS_DEFAULT.filter(t => t.momento === 'cierre' || t.momento === 'todo_el_dia');
  const cumplidasTarde = tareasTarde.filter(t => completadasHoy.some(c => c.tareaId === t.id));
  const faltantesTarde = tareasTarde.filter(t => !completadasHoy.some(c => c.tareaId === t.id));
  const pctTarde = tareasTarde.length > 0 ? Math.round((cumplidasTarde.length / tareasTarde.length) * 100) : 0;

  const esTurnoManana = (horaStr?: string, timestamp?: number) => {
    if (timestamp) {
      return new Date(timestamp).getHours() < 14;
    }
    if (horaStr) {
      const h = parseInt(horaStr.split(':')[0], 10);
      return !isNaN(h) ? h < 14 : true;
    }
    return true;
  };

  const ventasManana = ventasHoy.filter(v => esTurnoManana(v.hora, v.timestamp || v.createdAt));
  const totalVentasManana = ventasManana.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
  
  const ventasTarde = ventasHoy.filter(v => !esTurnoManana(v.hora, v.timestamp || v.createdAt));
  const totalVentasTarde = ventasTarde.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

  const faltasManana = faltas.filter(f => esTurnoManana(f.hora));
  const faltasTarde = faltas.filter(f => !esTurnoManana(f.hora));

  const sesionManana = sesionesCajaHoy.find(s => esTurnoManana(s.horaApertura || s.hora, s.timestampApertura));
  const sesionTarde = sesionesCajaHoy.find(s => !esTurnoManana(s.horaApertura || s.hora, s.timestampApertura));

  const probarSensorNexus = () => {
    enviarTelemetria('TEST_SISTEMA', 'Prueba manual de sensor desde pantalla de Expedientes', 'Director');
    toast.success('📡 Impulso de telemetría emitido a Nexus (puerto 3005)');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-indigo-500" />
              Desempeño y Conducta
            </h1>
            <p className="text-slate-500 font-medium">Alertas Anti-Fraude, Checklists y Puntos de Desempeño</p>
          </div>
          
          <div className="flex items-center gap-3">
            {empleadaIdFiltro !== 'all' && empleadaIdFiltro !== 'sin_identificar' && (
              <Button onClick={() => setEmpleadaCaptura(empleadaIdFiltro)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold h-10">
                📷 Registrar Rostro
              </Button>
            )}
            <select
              value={empleadaIdFiltro}
              onChange={e => setEmpleadaIdFiltro(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">Todo el personal</option>
              <option value="sin_identificar">Alertas sin identificar</option>
              {empleadas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} {e.faceDescriptor ? '(Biometría OK)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Banner de Sensor de Auditoría en Tiempo Real */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> Sensor de Auditoría Digital Nexus: Activo (Puerto 3005)
              </p>
              <p className="text-xs text-slate-400">
                Monitoreo continuo de clics, checklists de apertura/cierre, cuadres de dinero y errores.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={probarSensorNexus}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 shrink-0"
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Enviar Impulso al Chat
          </Button>
        </div>

        {empleadaCaptura && <CapturaRostro onCapture={handleCapturarRostro} onCancel={() => setEmpleadaCaptura(null)} />}

        <Tabs defaultValue="turnos" className="w-full">
          <TabsList className="bg-slate-200/50 p-1 mb-6 rounded-xl flex flex-wrap gap-1">
            <TabsTrigger value="turnos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm font-bold flex items-center gap-2">
              📊 Resumen Diario de Turnos (Mañana vs. Tarde)
            </TabsTrigger>
            <TabsTrigger value="ranking" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm font-bold flex items-center gap-2">
              🌟 Ranking y Méritos
            </TabsTrigger>
            <TabsTrigger value="alertas" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm font-bold flex items-center gap-2">
              🔴 Faltas y Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ranking" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Leaderboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {empleadasRanking.slice(0, 3).map((emp, index) => {
                const isGold = index === 0;
                const isSilver = index === 1;
                const isBronze = index === 2;
                
                return (
                  <div key={emp.id} className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col items-center text-center
                    ${isGold ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200' : 
                      isSilver ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200' : 
                      'bg-gradient-to-br from-orange-50 to-orange-100/30 border-orange-200'}`}
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-20">
                      <Trophy className={`w-24 h-24 ${isGold ? 'text-amber-500' : isSilver ? 'text-slate-500' : 'text-orange-500'}`} />
                    </div>
                    
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 z-10 shadow-inner
                      ${isGold ? 'bg-amber-100 text-amber-600' : isSilver ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-600'}`}>
                      <Medal className="w-8 h-8" />
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-800 z-10">{emp.nombre}</h3>
                    <p className="text-sm font-bold text-slate-500 mb-4 z-10">{emp.rol}</p>
                    
                    <div className="mt-auto z-10 bg-white/60 px-4 py-2 rounded-full font-black text-lg flex items-center gap-2">
                      <Star className={`w-5 h-5 ${isGold ? 'text-amber-500 fill-amber-500' : isSilver ? 'text-slate-400 fill-slate-400' : 'text-orange-400 fill-orange-400'}`} />
                      {emp.puntos || 0} PTS
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Historial de Méritos {empleadaIdFiltro !== 'all' ? `de ${getNombreEmpleada(empleadaIdFiltro)}` : ''}
              </h3>
              {empleadaIdFiltro !== 'all' && empleadaIdFiltro !== 'sin_identificar' && (
                <Button onClick={() => setMostrarFormMerito(!mostrarFormMerito)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <Plus className="w-4 h-4 mr-2" />
                  Otorgar Mérito
                </Button>
              )}
            </div>

            {mostrarFormMerito && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm mb-6 animate-in slide-in-from-top-2">
                <h4 className="font-bold text-emerald-800 mb-4">Otorgar puntos a {getNombreEmpleada(empleadaIdFiltro)}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Motivo / Título</label>
                    <Input 
                      value={nuevoMeritoData.titulo} 
                      onChange={e => setNuevoMeritoData({...nuevoMeritoData, titulo: e.target.value})} 
                      placeholder="Ej. Cumplió meta de ventas"
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Puntos</label>
                    <Input 
                      type="number"
                      value={nuevoMeritoData.puntos} 
                      onChange={e => setNuevoMeritoData({...nuevoMeritoData, puntos: parseInt(e.target.value) || 0})} 
                      className="bg-white"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Descripción (opcional)</label>
                  <Textarea 
                    value={nuevoMeritoData.descripcion} 
                    onChange={e => setNuevoMeritoData({...nuevoMeritoData, descripcion: e.target.value})}
                    placeholder="Detalles adicionales..."
                    className="bg-white resize-none h-20"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setMostrarFormMerito(false)}>Cancelar</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={guardarMeritoManual}>Guardar Mérito</Button>
                </div>
              </div>
            )}

            {/* Lista de Meritos */}
            <div className="space-y-3">
              {meritosFiltrados.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No hay méritos registrados aún.</p>
                </div>
              ) : (
                meritosFiltrados.map(merito => (
                  <div key={merito.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          +{merito.puntos} PTS
                        </span>
                        <h4 className="font-bold text-slate-800">{merito.titulo}</h4>
                      </div>
                      <p className="text-sm text-slate-600">{merito.descripcion}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-slate-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {getNombreEmpleada(merito.empleadaId)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {merito.fecha} {merito.hora}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="alertas" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800">{faltas.filter(f => f.gravedad === 'critica').length}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Críticas</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800">{faltas.filter(f => f.estado === 'pendiente').length}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pendientes</p>
                </div>
              </div>
            </div>

            {/* Main List Alertas */}
            {loading ? (
              <div className="text-center py-20"><p className="text-slate-400 font-bold">Cargando alertas...</p></div>
            ) : faltasFiltradas.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Todo en orden</h3>
                <p className="text-slate-500 mt-2">No hay alertas conductuales registradas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {faltasFiltradas.map(falta => {
                  const grav = GRAVEDADES[falta.gravedad];
                  const est = ESTADOS[falta.estado];
                  
                  return (
                    <div key={falta.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                      {/* Evidence image */}
                      <div className="w-full md:w-64 h-48 bg-slate-900 relative shrink-0">
                        {falta.evidenciaFrame ? (
                          <img src={falta.evidenciaFrame} alt="Evidencia" className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                            <Eye className="w-8 h-8 mb-2" />
                            <span className="text-xs font-bold">Sin Imagen</span>
                          </div>
                        )}
                        <div className={`absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${grav.badge}`}>
                          {grav.label}
                        </div>
                      </div>
                      
                      {/* Details */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-black text-slate-900">{falta.titulo}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${est.color} bg-slate-50`}>
                              {est.label}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-4">
                            <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {getNombreEmpleada(falta.empleadaId)}</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {falta.fecha} - {falta.hora}</span>
                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md text-slate-700">{falta.cameraNombre}</span>
                          </div>
                          
                          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium">
                            <span className="font-bold text-slate-900 block mb-1">Reporte Odysseus:</span>
                            {falta.descripcion}
                          </p>
                        </div>
                        
                        <div className="mt-4 flex gap-2 justify-end">
                          {falta.estado === 'pendiente' && (
                            <Button onClick={() => marcarComoRevisado(falta.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-9">
                              Marcar Revisado
                            </Button>
                          )}
                          <Button variant="outline" className="border-slate-300 text-slate-700 font-bold h-9">
                            <FileDown className="w-4 h-4 mr-2" /> Expediente
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab de Resumen de Turnos (Mañana vs Tarde) */}
          <TabsContent value="turnos" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header explicativo */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-amber-900 text-lg flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-600" /> Control Integral de Turnos — {hoyStr}
                </h3>
                <p className="text-amber-700 text-xs font-medium">
                  Auditoría automática de tareas de apertura y cierre, cruce de ventas en tiempo real y arqueos de caja.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="bg-amber-200 text-amber-900 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
                  ☀️ Mañana: {pctManana}% cumplido
                </span>
                <span className="bg-indigo-100 text-indigo-900 text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
                  🌙 Tarde: {pctTarde}% cumplido
                </span>
              </div>
            </div>

            {/* Grid Turno Mañana vs Turno Tarde */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* TURNO MAÑANA */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-5 text-white">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Sun className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                          06:00 AM — 02:00 PM
                        </span>
                        <h3 className="text-xl font-black mt-1">Turno Mañana (Apertura)</h3>
                        <p className="text-xs text-amber-100 font-semibold">Responsable: Vendedor Mañana</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black">{pctManana}%</span>
                      <p className="text-[10px] font-bold text-amber-100 uppercase">Checklist</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                  {/* KPIs Mañana */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">${totalVentasManana.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{ventasManana.length} Ventas</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <CheckSquare className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">{cumplidasManana.length} / {tareasManana.length}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Checklists</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">{faltasManana.length}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Alertas</p>
                    </div>
                  </div>

                  {/* Estado de Caja Mañana */}
                  <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100 text-xs space-y-2">
                    <p className="font-black text-amber-900 flex items-center justify-between">
                      <span>💵 Arqueo y Caja del Turno</span>
                      <span className={sesionManana ? 'text-emerald-700 font-bold' : 'text-slate-500 font-normal'}>
                        {sesionManana ? 'Sesión Registrada' : 'Sin entrega cerrada'}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>Base Inicial: <span className="font-bold">${Number(sesionManana?.montoInicial || 0).toLocaleString()}</span></div>
                      <div>Recaudado: <span className="font-bold">${totalVentasManana.toLocaleString()}</span></div>
                      <div>Entrega Turno: <span className="font-bold">${Number(sesionManana?.montoCierre || sesionManana?.totalEfectivo || 0).toLocaleString()}</span></div>
                      <div>
                        Diferencia: <span className={`font-black ${Number(sesionManana?.diferencia || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          ${Number(sesionManana?.diferencia || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Tareas y Cumplimiento Mañana */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                      <span>Auditoría de Checklist (Apertura)</span>
                      <span>{cumplidasManana.length} de {tareasManana.length} OK</span>
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {tareasManana.map(t => {
                        const cumplida = completadasHoy.some(c => c.tareaId === t.id);
                        return (
                          <div
                            key={t.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                              cumplida 
                                ? 'bg-emerald-50/50 border-emerald-200 text-slate-800' 
                                : 'bg-red-50/30 border-red-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{t.icono}</span>
                              <span className="font-semibold">{t.texto}</span>
                            </div>
                            <div>
                              {cumplida ? (
                                <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> CUMPLIDO
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px]">
                                  <AlertCircle className="w-3 h-3 text-red-500" /> PENDIENTE
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* TURNO TARDE */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-indigo-700 to-slate-900 p-5 text-white">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <Moon className="w-7 h-7 text-indigo-300" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                          02:00 PM — 10:00 PM
                        </span>
                        <h3 className="text-xl font-black mt-1">Turno Tarde (Cierre)</h3>
                        <p className="text-xs text-indigo-200 font-semibold">Responsable: Vendedor Tarde</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black">{pctTarde}%</span>
                      <p className="text-[10px] font-bold text-indigo-200 uppercase">Checklist</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                  {/* KPIs Tarde */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">${totalVentasTarde.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{ventasTarde.length} Ventas</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <CheckSquare className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">{cumplidasTarde.length} / {tareasTarde.length}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Checklists</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                      <p className="text-lg font-black text-slate-900">{faltasTarde.length}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Alertas</p>
                    </div>
                  </div>

                  {/* Estado de Caja Tarde */}
                  <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 text-xs space-y-2">
                    <p className="font-black text-indigo-900 flex items-center justify-between">
                      <span>💵 Cierre de Caja y Entrega Final</span>
                      <span className={sesionTarde ? 'text-emerald-700 font-bold' : 'text-slate-500 font-normal'}>
                        {sesionTarde ? 'Cierre Guardado' : 'En curso'}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>Recaudado Tarde: <span className="font-bold">${totalVentasTarde.toLocaleString()}</span></div>
                      <div>Total Día: <span className="font-bold">${(totalVentasManana + totalVentasTarde).toLocaleString()}</span></div>
                      <div>Entregado Bóveda: <span className="font-bold">${Number(sesionTarde?.montoCierre || sesionTarde?.totalEfectivo || 0).toLocaleString()}</span></div>
                      <div>
                        Diferencia Final: <span className={`font-black ${Number(sesionTarde?.diferencia || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          ${Number(sesionTarde?.diferencia || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Tareas y Cumplimiento Tarde */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                      <span>Auditoría de Checklist (Cierre)</span>
                      <span>{cumplidasTarde.length} de {tareasTarde.length} OK</span>
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {tareasTarde.map(t => {
                        const cumplida = completadasHoy.some(c => c.tareaId === t.id);
                        return (
                          <div
                            key={t.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                              cumplida 
                                ? 'bg-emerald-50/50 border-emerald-200 text-slate-800' 
                                : 'bg-red-50/30 border-red-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{t.icono}</span>
                              <span className="font-semibold">{t.texto}</span>
                            </div>
                            <div>
                              {cumplida ? (
                                <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> CUMPLIDO
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px]">
                                  <AlertCircle className="w-3 h-3 text-red-500" /> PENDIENTE
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
