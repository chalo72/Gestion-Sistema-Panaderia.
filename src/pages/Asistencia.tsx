import { useState, useMemo } from 'react';
import { Clock, CheckCircle2, LogOut, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { Trabajador, RegistroAsistencia } from '@/types';

interface AsistenciaProps {
  trabajadores: Trabajador[];
  asistencia: RegistroAsistencia[];
  onAddRegistro: (r: Omit<RegistroAsistencia, 'id' | 'createdAt'>) => Promise<RegistroAsistencia>;
}

function horaActual() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}
function horaISO() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function Asistencia({ trabajadores, asistencia, onAddRegistro }: AsistenciaProps) {
  const [seleccionado, setSeleccionado] = useState<Trabajador | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [exito, setExito] = useState<{ tipo: 'entrada' | 'salida'; hora: string } | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  const hoy = fechaHoy();

  const registrosHoy = useMemo(
    () => asistencia.filter(r => r.fecha === hoy).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [asistencia, hoy]
  );

  const ultimoRegistroPorTrabajador = useMemo(() => {
    const map = new Map<string, RegistroAsistencia>();
    for (const r of asistencia.filter(x => x.fecha === hoy)) {
      const prev = map.get(r.trabajadorId);
      if (!prev || r.createdAt > prev.createdAt) map.set(r.trabajadorId, r);
    }
    return map;
  }, [asistencia, hoy]);

  const trabajadoresActivos = trabajadores.filter(t => t.estado === 'activo');

  async function registrar(tipo: 'entrada' | 'salida') {
    if (!seleccionado) return;
    setConfirmando(true);
    try {
      const hora = horaISO();
      await onAddRegistro({
        trabajadorId: seleccionado.id,
        trabajadorNombre: seleccionado.nombre,
        tipo,
        fecha: hoy,
        hora,
      });
      setExito({ tipo, hora: horaActual() });
      toast.success(tipo === 'entrada'
        ? `¡Bienvenida, ${seleccionado.nombre.split(' ')[0]}! 🎉`
        : `¡Hasta luego, ${seleccionado.nombre.split(' ')[0]}! 👋`
      );
      setTimeout(() => {
        setExito(null);
        setSeleccionado(null);
      }, 3000);
    } catch {
      toast.error('Error al registrar asistencia');
    } finally {
      setConfirmando(false);
    }
  }

  // Pantalla de éxito
  if (exito) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
        <CheckCircle2 className="w-32 h-32 text-white mb-6 animate-bounce" />
        <p className="text-4xl font-bold text-white mb-2">
          {exito.tipo === 'entrada' ? '¡Ya llegué!' : '¡Ya me voy!'}
        </p>
        <p className="text-2xl text-white/90 mb-1">{seleccionado?.nombre}</p>
        <p className="text-xl text-white/80">{exito.hora}</p>
      </div>
    );
  }

  // Modal de confirmación
  if (seleccionado) {
    const ultimoRegistro = ultimoRegistroPorTrabajador.get(seleccionado.id);
    const sigueTipo: 'entrada' | 'salida' = ultimoRegistro?.tipo === 'entrada' ? 'salida' : 'entrada';

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4 text-4xl font-bold text-amber-700 dark:text-amber-400">
            {seleccionado.nombre.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{seleccionado.nombre}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">{horaActual()}</p>

          {/* Botones de acción */}
          <div className="flex flex-col gap-3">
            {sigueTipo === 'entrada' ? (
              <button
                onClick={() => registrar('entrada')}
                disabled={confirmando}
                className="w-full py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xl font-bold transition-all shadow-lg disabled:opacity-50"
              >
                ✅ Ya llegué
              </button>
            ) : (
              <button
                onClick={() => registrar('salida')}
                disabled={confirmando}
                className="w-full py-5 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xl font-bold transition-all shadow-lg disabled:opacity-50"
              >
                👋 Ya me voy
              </button>
            )}
            {/* Permitir marcar el otro tipo si es necesario */}
            <button
              onClick={() => registrar(sigueTipo === 'entrada' ? 'salida' : 'entrada')}
              disabled={confirmando}
              className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {sigueTipo === 'entrada' ? 'Registrar salida' : 'Registrar entrada'}
            </button>
            <button
              onClick={() => setSeleccionado(null)}
              className="w-full py-3 rounded-2xl text-gray-400 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla principal — kiosko
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
      {/* Header */}
      <div className="text-center mb-8 pt-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Control de Asistencia</h1>
        </div>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Toca tu nombre para registrar tu llegada o salida
        </p>
        <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-1">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Grid de trabajadoras */}
      {trabajadoresActivos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay trabajadoras activas registradas</p>
          <p className="text-sm mt-1">Ve al módulo Trabajadores para agregar personal</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {trabajadoresActivos.map(t => {
            const ultimo = ultimoRegistroPorTrabajador.get(t.id);
            const estaAdentro = ultimo?.tipo === 'entrada';
            return (
              <button
                key={t.id}
                onClick={() => setSeleccionado(t)}
                className="flex flex-col items-center p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl active:scale-95 transition-all border-2 border-transparent hover:border-amber-400 dark:hover:border-amber-500"
              >
                {/* Avatar */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${
                  estaAdentro
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-2 ring-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {t.nombre.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-center leading-tight">
                  {t.nombre.split(' ').slice(0, 2).join(' ')}
                </p>
                {ultimo ? (
                  <span className={`mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                    estaAdentro
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {estaAdentro ? `Llegó ${ultimo.hora}` : `Salió ${ultimo.hora}`}
                  </span>
                ) : (
                  <span className="mt-2 text-xs text-gray-400 dark:text-gray-500">Sin registro hoy</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Historial del día */}
      {registrosHoy.length > 0 && (
        <div className="max-w-4xl mx-auto mt-8">
          <button
            onClick={() => setVerHistorial(v => !v)}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-medium mx-auto"
          >
            {verHistorial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {verHistorial ? 'Ocultar' : 'Ver'} registros de hoy ({registrosHoy.length})
          </button>

          {verHistorial && (
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {registrosHoy.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      r.tipo === 'entrada'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {r.tipo === 'entrada' ? '✅' : <LogOut className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.trabajadorNombre}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium ${
                      r.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                    }`}>
                      {r.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{r.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
