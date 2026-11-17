import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Trabajador } from '@/types';
import {
  CLAVE_ANCLA,
  CLAVE_CAMBIOS,
  CLAVE_PERSONAS,
  PERSONAS_BASE,
  RESPALDOS_HORARIO,
  balanceCiclo,
  coberturaCompleta,
  cuadroDeSemana,
  fechasDeSemana,
  guardarAncla,
  guardarCambios,
  guardarEnlace,
  leerAncla,
  leerCambios,
  leerEnlace,
  lunesDe,
  proponerCobertura,
  resolverPersonas,
  semanaDeFecha,
  sumarDias,
  TEXTO_MOTIVO,
  tituloSemana,
  type AnclaHorario,
  type CambioHorario,
  type EnlacePersonas,
  type MotivoCambio,
  type PuestoTurno,
  type SemanaRotacion,
} from '@/lib/horario-tienda';
import { fechaLocalHoy } from '@/lib/horario-trabajo';
import { crearAvisosDeCambio, notificarCambioTurnoWhatsApp } from '@/lib/avisos-turno';
import { db } from '@/lib/database';

function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function HorarioSiEnferma({ trabajadores, soloLectura = false }: { trabajadores: Trabajador[]; soloLectura?: boolean }) {
  const hoy = fechaLocalHoy();
  const [ancla, setAncla] = useState<AnclaHorario>(() => {
    const guardada = leerAncla();
    return guardada ?? { lunes: lunesDe(hoy), semana: 1 };
  });
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const [cambios, setCambios] = useState<CambioHorario[]>(() => leerCambios());
  const [enlace, setEnlace] = useState<EnlacePersonas | null>(() => leerEnlace());
  const [elegido, setElegido] = useState<{ dow: number; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState<MotivoCambio>('cita');
  const [nota, setNota] = useState('');

  const guardarRespaldo = (clave: string, dato: unknown) => {
    void db.saveBackup(clave, dato).catch(() => {
      toast.message('El cambio quedó guardado en este dispositivo; no se pudo sincronizar con los demás.');
    });
  };

  useEffect(() => {
    let vivo = true;
    const hidratarFaltantes = async () => {
      const tareas: Array<{ claveLocal: string; claveNube: string; aplicar: (valor: unknown) => void }> = [
        { claveLocal: CLAVE_CAMBIOS, claveNube: RESPALDOS_HORARIO.cambios, aplicar: valor => setCambios(Array.isArray(valor) ? valor as CambioHorario[] : []) },
        { claveLocal: CLAVE_PERSONAS, claveNube: RESPALDOS_HORARIO.personas, aplicar: valor => setEnlace(valor && typeof valor === 'object' ? valor as EnlacePersonas : null) },
        { claveLocal: CLAVE_ANCLA, claveNube: RESPALDOS_HORARIO.ancla, aplicar: valor => {
          if (valor && typeof valor === 'object' && 'lunes' in valor && 'semana' in valor) setAncla(valor as AnclaHorario);
        } },
      ];
      await Promise.all(tareas.map(async tarea => {
        if (localStorage.getItem(tarea.claveLocal) !== null) return;
        const remoto = await db.getBackup(tarea.claveNube).catch(() => null);
        if (!vivo || remoto == null) return;
        try {
          localStorage.setItem(tarea.claveLocal, JSON.stringify(remoto));
          tarea.aplicar(remoto);
        } catch {
          toast.error('No se pudo guardar localmente el horario sincronizado.');
        }
      }));

      // Crear el ancla por defecto solo después de intentar recuperar la compartida.
      if (vivo && localStorage.getItem(CLAVE_ANCLA) === null) {
        const predeterminada = leerAncla() ?? { lunes: lunesDe(hoy), semana: 1 as SemanaRotacion };
        try {
          guardarAncla(predeterminada);
          guardarRespaldo(RESPALDOS_HORARIO.ancla, predeterminada);
          setAncla(predeterminada);
        } catch {
          toast.error('No se pudo guardar el inicio del ciclo en este dispositivo.');
        }
      }
    };

    const alCambiarEnNube = (evento: Event) => {
      const tabla = (evento as CustomEvent<{ table?: string }>).detail?.table;
      const tareas: Array<{ claveLocal: string; claveNube: string; aplicar: (valor: unknown) => void }> = [
        { claveLocal: CLAVE_CAMBIOS, claveNube: RESPALDOS_HORARIO.cambios, aplicar: valor => setCambios(Array.isArray(valor) ? valor as CambioHorario[] : []) },
        { claveLocal: CLAVE_PERSONAS, claveNube: RESPALDOS_HORARIO.personas, aplicar: valor => setEnlace(valor && typeof valor === 'object' ? valor as EnlacePersonas : null) },
        { claveLocal: CLAVE_ANCLA, claveNube: RESPALDOS_HORARIO.ancla, aplicar: valor => {
          if (valor && typeof valor === 'object' && 'lunes' in valor && 'semana' in valor) setAncla(valor as AnclaHorario);
        } },
      ];
      const tarea = tareas.find(item => item.claveNube === tabla);
      if (!tarea) return;
      void db.getBackup(tarea.claveNube).then(remoto => {
        if (remoto == null || !vivo) return;
        localStorage.setItem(tarea.claveLocal, JSON.stringify(remoto));
        tarea.aplicar(remoto);
      }).catch(() => toast.error('No se pudo cargar el cambio de horario compartido.'));
    };

    void hidratarFaltantes();
    window.addEventListener('nexus-realtime-change', alCambiarEnNube);
    return () => {
      vivo = false;
      window.removeEventListener('nexus-realtime-change', alCambiarEnNube);
    };
  }, [hoy]);

  const equipo = useMemo(
    () => trabajadores.map(t => ({ id: t.id, nombre: t.nombre, estado: t.estado })),
    [trabajadores],
  );
  const { personas, ids, avisos } = useMemo(() => resolverPersonas(equipo, enlace), [equipo, enlace]);
  const semana = semanaDeFecha(lunes, ancla);
  const semanaMostrada = lunes === ancla.lunes ? ancla.semana : semana;
  const filas = useMemo(
    () => cuadroDeSemana(lunes, ancla, personas, cambios, equipo),
    [lunes, ancla, personas, cambios, equipo],
  );
  const balance = balanceCiclo(personas);
  const puesto = elegido ? filas.find(f => f.dow === elegido.dow) : null;
  const donde: PuestoTurno | null = puesto && elegido
    ? (puesto.manana.includes(elegido.nombre) ? 'mañana' : puesto.tarde.includes(elegido.nombre) ? 'tarde' : null)
    : null;
  const propuesta = puesto && elegido && donde ? proponerCobertura(puesto, elegido.nombre, personas) : null;
  const domingo = fechasDeSemana(lunes).get(0) ?? sumarDias(lunes, 6);
  const puestosIds = [ids.mananaId, ids.tardeAId, ids.tardeBId, ids.findeId].filter(Boolean) as string[];
  const hayRepetida = puestosIds.length !== new Set(puestosIds).size;

  const fijarSemana = (n: SemanaRotacion) => {
    const siguiente = { lunes, semana: n };
    try {
      guardarAncla(siguiente);
      guardarRespaldo(RESPALDOS_HORARIO.ancla, siguiente);
    } catch {
      toast.error('No se pudo guardar la semana seleccionada.');
      return;
    }
    setAncla(siguiente);
    setElegido(null);
  };

  const moverSemana = (delta: number) => {
    setLunes(sumarDias(lunes, delta * 7));
    setElegido(null);
  };

  const asignar = (rol: 'mananaId' | 'tardeAId' | 'tardeBId' | 'findeId', valor: string) => {
    const siguiente: EnlacePersonas = { ...ids, [rol]: valor || null };
    try {
      guardarEnlace(siguiente);
      guardarRespaldo(RESPALDOS_HORARIO.personas, siguiente);
      setEnlace(siguiente);
    } catch {
      toast.error('No se pudo guardar la persona asignada.');
    }
  };

  const idDe = (nombre: string): string | null => equipo.find(t => t.nombre === nombre)?.id ?? null;

  const telefonosPorPersona = (): Record<string, string | null> => {
    const map: Record<string, string | null> = {};
    for (const t of trabajadores) {
      map[t.id] = t.telefono ?? null;
      map[t.nombre] = t.telefono ?? null;
    }
    return map;
  };

  const cubrir = async (cubre: string | null) => {
    if (!elegido || !puesto || !donde) return;
    const fecha = puesto.fecha;
    if (!fecha) return;
    const porque = cubre && propuesta?.nombre === cubre
      ? propuesta.porque
      : cubre
        ? `${cubre} entra en el puesto de ${elegido.nombre}.`
        : '';
    const nuevo: CambioHorario = {
      fecha,
      semana,
      dow: elegido.dow,
      enfermo: elegido.nombre,
      enfermoId: idDe(elegido.nombre),
      cubre,
      cubreId: cubre ? idDe(cubre) : null,
      motivo,
      nota: nota.trim(),
      porque,
      puesto: donde,
    };
    const sinEste = cambios.filter(c => !(c.fecha === fecha && (c.enfermo === elegido.nombre || c.enfermoId === nuevo.enfermoId)));
    const lista = [...sinEste, nuevo];
    try {
      guardarCambios(lista);
    } catch {
      toast.error('No se pudo guardar el cambio de turno en este dispositivo.');
      return;
    }
    setCambios(lista);
    guardarRespaldo(RESPALDOS_HORARIO.cambios, lista);
    crearAvisosDeCambio(nuevo);
    setElegido(null);
    setNota('');

    const wa = await notificarCambioTurnoWhatsApp(nuevo, telefonosPorPersona());
    if (wa.abiertos.length > 0) {
      toast.success(
        `Aviso en la app. WhatsApp abierto para: ${wa.abiertos.join(', ')}.${wa.admin ? ' También al teléfono del negocio.' : ''}`,
      );
    } else if (wa.sinTelefono.length > 0) {
      toast.message(
        `Aviso en la app (se cierra con «Ya lo leí»). Falta teléfono en Trabajadores para: ${wa.sinTelefono.join(', ')}.`,
      );
    } else {
      toast.success('Aviso guardado en la app. Se cierra con «Ya lo leí».');
    }
  };

  const volver = () => {
    if (!elegido || !puesto?.fecha) return;
    const lista = cambios.filter(c => !(c.fecha === puesto.fecha && c.enfermo === elegido.nombre));
    try {
      guardarCambios(lista);
    } catch {
      toast.error('No se pudo guardar la reversión del cambio.');
      return;
    }
    setCambios(lista);
    guardarRespaldo(RESPALDOS_HORARIO.cambios, lista);
    setElegido(null);
  };

  const activos = equipo.filter(t => t.estado !== 'inactivo');
  const opciones = activos.length > 0 ? activos : [];
  const historial = [...cambios].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 space-y-3">
        <p className="font-black text-gray-900 dark:text-white text-lg">
          {semanaMostrada === 4 ? 'Semana 4 del calendario (repite la semana 1)' : `Semana ${semanaMostrada} del ciclo`}
        </p>
        {soloLectura && (
          <p className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Solo consulta — para cambiar el turno habla con la encargada
          </p>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300">{tituloSemana(semana, personas)}</p>
        <p className="text-xs text-gray-500">
          Lunes a viernes: {personas.manana} en la mañana, {personas.tardeA} y {personas.tardeB} en la tarde.
          {personas.finde} entra sábado y domingo para que las tres descansen un fin de semana cada una.
          {balance.equitativo ? ' El descanso del fin de semana está parejo.' : ' Revisa los nombres: el descanso del fin de semana no está parejo.'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => moverSemana(-1)} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-black">Anterior</button>
          <p className="text-sm font-black text-gray-900 dark:text-white text-center">{fechaCorta(lunes)} – {fechaCorta(domingo)}</p>
          <button type="button" onClick={() => moverSemana(1)} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-black">Siguiente</button>
        </div>
        {!soloLectura && (
          <>
            <div className="flex flex-wrap gap-2">
              {([1, 2, 3, 4] as SemanaRotacion[]).map(n => (
                <button key={n} type="button" onClick={() => fijarSemana(n)}
                  className={`px-3 py-2 rounded-xl text-sm font-black ${semanaMostrada === n ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
                  {n === 4 ? 'Semana 4 (repite la 1)' : `Esta es la ${n}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Si esta semana del calendario no es la 1, márcala. Las siguientes siguen solas. La semana 4 del esquema es otra vez la 1.</p>
          </>
        )}
      </div>

      {!soloLectura && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 space-y-3">
        <p className="font-black text-gray-900 dark:text-white">Nombres de la nómina</p>
        <p className="text-xs text-gray-500">Salen de Trabajadores. Si corriges un nombre allá, aquí cambia. Aquí eliges quién hace cada puesto.</p>
        {avisos.map(a => <p key={a} className="text-xs font-semibold text-amber-700 dark:text-amber-300">{a}</p>)}
        {hayRepetida && <p className="text-xs font-semibold text-rose-600">Hay una persona en dos puestos. Elige una distinta en cada lista.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Selector label="Mañana, lunes a viernes" value={ids.mananaId} opciones={opciones} onChange={v => asignar('mananaId', v)} />
          <Selector label="Tarde" value={ids.tardeAId} opciones={opciones} onChange={v => asignar('tardeAId', v)} />
          <Selector label="Tarde, domingo de iglesia" value={ids.tardeBId} opciones={opciones} onChange={v => asignar('tardeBId', v)} />
          <Selector label="Apoyo de sábado y domingo" value={ids.findeId} opciones={opciones} onChange={v => asignar('findeId', v)} />
        </div>
      </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
              <th className="px-3 py-3">Día</th>
              <th className="px-3 py-3">Mañana (1)</th>
              <th className="px-3 py-3">Tarde (2)</th>
              <th className="px-3 py-3">Quién descansa</th>
              <th className="px-3 py-3">Turno de {personas.finde.split(' ')[0] || PERSONAS_BASE.finde}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.dia} className="border-b border-gray-100 dark:border-gray-800 align-top">
                <td className="px-3 py-3 font-black text-gray-900 dark:text-white">
                  {f.dia}
                  {f.fecha && <span className="block text-[11px] font-semibold text-gray-400">{fechaCorta(f.fecha)}</span>}
                </td>
                <td className="px-3 py-3"><Nombres nombres={f.manana} dow={f.dow} onElegir={soloLectura ? () => {} : setElegido} activo={elegido} /></td>
                <td className="px-3 py-3"><Nombres nombres={f.tarde} dow={f.dow} onElegir={soloLectura ? () => {} : setElegido} activo={elegido} /></td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  {f.descansa ? `${f.descansa}${f.notaDescanso ? ` (${f.notaDescanso})` : ''}` : '—'}
                  {f.manana.length !== 1 || f.tarde.length !== 2 ? <span className="block text-[11px] font-bold text-amber-600">Falta gente: tienen que quedar 1 y 2.</span> : null}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{f.turnoApoyo ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 space-y-2">
        <p className="font-black text-gray-900 dark:text-white">Días de esta semana</p>
        {[personas.manana, personas.tardeA, personas.tardeB, personas.finde].filter((n, i, arr) => arr.indexOf(n) === i).map(nombre => {
          const trabaja = filas.filter(f => f.manana.includes(nombre) || f.tarde.includes(nombre));
          const libre = filas.filter(f => !f.manana.includes(nombre) && !f.tarde.includes(nombre));
          return (
            <p key={nombre} className="text-sm text-gray-700 dark:text-gray-300">
              <b>{nombre}.</b> Trabaja: {trabaja.length === 0 ? '—' : trabaja.map(f => f.dia).join(', ')}.
              {' '}Libre: {libre.length === 0 ? '—' : libre.map(f => f.notaDescanso && (f.descansa === nombre || f.descansa?.startsWith(`${nombre} `)) ? `${f.dia} (${f.notaDescanso})` : f.dia).join(', ')}.
            </p>
          );
        })}
      </div>

      {elegido && donde && puesto && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-2xl p-4 space-y-3">
          <p className="font-black text-gray-900 dark:text-white">
            {elegido.nombre} no puede venir el {puesto.dia}{puesto.fecha ? ` (${fechaCorta(puesto.fecha)})` : ''}, en la {donde}.
          </p>
          <div className="flex flex-wrap gap-1">
            {(['cita', 'enfermo', 'permiso', 'iglesia', 'favor', 'otro'] as MotivoCambio[]).map(m => (
              <button key={m} type="button" onClick={() => setMotivo(m)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black ${motivo === m ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
                {TEXTO_MOTIVO[m]}
              </button>
            ))}
          </div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Por qué no vino y por qué se cambia el turno
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
              placeholder="Ejemplo: cita con el médico a las 9. Shirley entra a la mañana."
              className="mt-1 w-full rounded-xl border border-rose-200 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100" />
          </label>
          {propuesta && (
            <p className="text-sm text-gray-700 dark:text-gray-300">Propuesta: <b>{propuesta.nombre}</b>. {propuesta.porque}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {propuesta && (
              <button type="button" onClick={() => cubrir(propuesta.nombre)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black">
                Cubre {propuesta.nombre}
              </button>
            )}
            {opciones.filter(n => n.nombre !== elegido.nombre && n.nombre !== propuesta?.nombre).map(n => (
              <button key={n.id} type="button" onClick={() => cubrir(n.nombre)} className="px-3 py-2 rounded-xl bg-emerald-700/80 text-white text-sm font-black">
                Cubre {n.nombre}
              </button>
            ))}
            {opciones.length === 0 && [personas.manana, personas.tardeA, personas.tardeB, personas.finde]
              .filter(n => n !== elegido.nombre && n !== propuesta?.nombre)
              .map(n => (
                <button key={n} type="button" onClick={() => cubrir(n)} className="px-3 py-2 rounded-xl bg-emerald-700/80 text-white text-sm font-black">
                  Cubre {n}
                </button>
              ))}
            <button type="button" onClick={() => cubrir(null)} className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-black">Dejar el hueco</button>
            <button type="button" onClick={volver} className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-sm font-black">Volver al cuadro</button>
          </div>
          {!coberturaCompleta({ ...puesto, manana: puesto.manana.filter(n => n !== elegido.nombre), tarde: puesto.tarde }) && propuesta == null && (
            <p className="text-xs text-amber-700">Si nadie cubre, ese turno se queda en uno solo. Conviene anotar quién entra.</p>
          )}
        </div>
      )}

      {elegido && !donde && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{elegido.nombre} ese día ya está libre. No hay que mover el turno.</p>
          <button type="button" onClick={() => setElegido(null)} className="mt-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-sm font-black">Cerrar</button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 space-y-2">
        <p className="font-black text-gray-900 dark:text-white">Historial de cambios</p>
        <p className="text-xs text-gray-500">
          Queda anotado el día, por qué no vino y por qué se movió el turno. Al guardar se crea un aviso en la app (se cierra con «Ya lo leí»)
          y se abre WhatsApp a quien cambió y a quien cubre, si tienen teléfono en Trabajadores.
        </p>
        {historial.length === 0 && <p className="text-sm text-gray-500">Todavía no hay cambios. El cuadro de arriba es el horario normal.</p>}
        {historial.map(c => (
          <p key={`${c.fecha}-${c.enfermo}`} className="text-sm text-gray-700 dark:text-gray-300">
            <b>{fechaCorta(c.fecha)}.</b> {textoCorto(c)}
          </p>
        ))}
      </div>
    </div>
  );
}

function textoCorto(c: CambioHorario): string {
  const base = `${c.enfermo} no vino (${TEXTO_MOTIVO[c.motivo]})`;
  const detalle = c.nota.trim() ? `: ${c.nota.trim()}` : '';
  if (!c.cubre) return `${base}${detalle}. El turno quedó sin cubrir.`;
  return `${base}${detalle}. El turno lo tomó ${c.cubre}.`;
}

function Selector({
  label, value, opciones, onChange,
}: {
  label: string;
  value: string | null;
  opciones: { id: string; nombre: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
      {label}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
        <option value="">Elige…</option>
        {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </label>
  );
}

function Nombres({
  nombres, dow, onElegir, activo,
}: {
  nombres: string[];
  dow: number;
  onElegir: (v: { dow: number; nombre: string }) => void;
  activo: { dow: number; nombre: string } | null;
}) {
  if (nombres.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {nombres.map((n, i) => (
        <button key={`${dow}-${n}`} type="button" onClick={() => onElegir({ dow, nombre: n })}
          className={`font-semibold underline-offset-2 hover:underline ${activo?.dow === dow && activo.nombre === n ? 'text-rose-600' : 'text-gray-800 dark:text-gray-100'}`}>
          {i > 0 && nombres.length > 1 && i === nombres.length - 1 ? 'y ' : ''}{n}
        </button>
      ))}
    </span>
  );
}
