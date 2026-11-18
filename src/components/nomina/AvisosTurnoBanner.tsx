import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  EVENTO_AVISOS_TURNO,
  avisosNoLeidos,
  avisosVisiblesPara,
  leerAvisosTurno,
  marcarAvisoLeido,
  marcarTodosLeidos,
  type AvisoTurno,
} from '@/lib/avisos-turno';

function esAdminOGerente(rol?: string): boolean {
  const r = String(rol || '').toUpperCase();
  return r === 'ADMIN' || r === 'GERENTE';
}

export default function AvisosTurnoBanner() {
  const { usuario } = useAuth();
  const [avisos, setAvisos] = useState<AvisoTurno[]>([]);

  const refrescar = () => {
    const verTodos = esAdminOGerente(usuario?.rol);
    setAvisos(avisosNoLeidos(avisosVisiblesPara(leerAvisosTurno(), {
      nombre: usuario?.nombre,
      verTodos,
    })));
  };

  useEffect(() => {
    refrescar();
    const onEvt = () => refrescar();
    window.addEventListener(EVENTO_AVISOS_TURNO, onEvt);
    window.addEventListener('storage', onEvt);
    return () => {
      window.removeEventListener(EVENTO_AVISOS_TURNO, onEvt);
      window.removeEventListener('storage', onEvt);
    };
  }, [usuario?.id, usuario?.nombre, usuario?.rol]);

  if (avisos.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[99990] px-3 pt-2 pointer-events-none"
      style={{ top: 0 }}
      role="region"
      aria-label="Avisos de cambio de turno"
    >
      <div className="max-w-xl mx-auto space-y-2 pointer-events-auto">
        {avisos.slice(0, 4).map(a => (
          <div
            key={a.id}
            className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/90 dark:border-amber-700 shadow-lg px-3 py-2.5 text-amber-950 dark:text-amber-50"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {a.rol === 'cubre' ? 'Te toca cubrir' : 'Cambio de turno'}
                </p>
                <p className="text-sm font-black leading-snug">{a.titulo}</p>
                <p className="text-xs mt-0.5 text-amber-900/90 dark:text-amber-100/90">{a.texto}</p>
              </div>
              <button
                type="button"
                onClick={() => { marcarAvisoLeido(a.id); refrescar(); }}
                className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black active:scale-95"
              >
                Ya lo leí
              </button>
            </div>
          </div>
        ))}
        {avisos.length > 1 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { marcarTodosLeidos(avisos.map(a => a.id)); refrescar(); }}
              className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-gray-900/90 border border-amber-300 text-amber-800 dark:text-amber-200 text-[11px] font-black shadow"
            >
              Marcar todos leídos ({avisos.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
