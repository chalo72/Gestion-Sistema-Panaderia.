const uuidv4 = () => crypto.randomUUID();

export type EmpleadaPerfil = {
  id: string;
  nombre: string;
  rol: string;
  fechaIngreso: string;
  fotoPerfil?: string;
  faceDescriptor?: number[];
  puntos: number;
};

export type FaltaEmpleada = {
  id: string;
  empleadaId: string;
  camaraId: string;
  cameraNombre: string;
  tipo: 'alerta_general' | 'pago_bolsillo' | 'devolucion_excesiva' | 'pago_celular' | 'cobro_sin_registrar' | 'cliente_sin_pagar' | 'cliente_mal_atendido' | 'atencion_distraida' | 'entrega_sin_cobro' | 'regalo_no_autorizado' | 'visita_familiar' | 'sustraccion_producto' | 'consumo_no_autorizado';
  titulo: string;
  descripcion: string;
  gravedad: 'normal' | 'alta' | 'critica';
  evidenciaFrame: string | null; 
  fecha: string;
  hora: string;
  estado: 'pendiente' | 'revisado' | 'descartado';
  createdAt: string;
};

export type MeritoEmpleada = {
  id: string;
  empleadaId: string;
  titulo: string;
  descripcion: string;
  puntos: number;
  tipo: 'checklist' | 'ventas' | 'produccion' | 'atencion' | 'otros';
  fecha: string;
  hora: string;
  createdAt: string;
};

export const GRAVEDADES = {
  normal: { label: 'Normal', color: 'text-slate-500', badge: 'bg-slate-100 text-slate-700' },
  alta: { label: 'Alta', color: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
  critica: { label: 'Crítica', color: 'text-red-500', badge: 'bg-red-500 text-white' },
};

export const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'text-amber-600' },
  revisado: { label: 'Revisado', color: 'text-emerald-600' },
  descartado: { label: 'Descartado', color: 'text-slate-400' },
};

export function nuevaEmpleada(nombre: string, rol: string): EmpleadaPerfil {
  return {
    id: uuidv4(),
    nombre,
    rol,
    fechaIngreso: new Date().toISOString(),
    puntos: 0
  };
}

export function nuevaFalta(data: Partial<FaltaEmpleada> & { empleadaId: string, titulo: string, descripcion: string, gravedad: FaltaEmpleada['gravedad'] }): FaltaEmpleada {
  const d = new Date();
  return {
    id: uuidv4(),
    empleadaId: data.empleadaId,
    camaraId: data.camaraId || 'desconocida',
    cameraNombre: data.cameraNombre || 'Cámara Desconocida',
    tipo: data.tipo || 'alerta_general',
    titulo: data.titulo,
    descripcion: data.descripcion,
    gravedad: data.gravedad,
    evidenciaFrame: data.evidenciaFrame || null,
    fecha: d.toLocaleDateString('es-CO'),
    hora: d.toLocaleTimeString('es-CO'),
    estado: 'pendiente',
    createdAt: d.toISOString(),
    ...data
  };
}

export function nuevoMerito(data: Partial<MeritoEmpleada> & { empleadaId: string, titulo: string, puntos: number, tipo: MeritoEmpleada['tipo'] }): MeritoEmpleada {
  const d = new Date();
  return {
    id: uuidv4(),
    empleadaId: data.empleadaId,
    titulo: data.titulo,
    descripcion: data.descripcion || '',
    puntos: data.puntos,
    tipo: data.tipo,
    fecha: d.toLocaleDateString('es-CO'),
    hora: d.toLocaleTimeString('es-CO'),
    createdAt: d.toISOString(),
    ...data
  };
}
