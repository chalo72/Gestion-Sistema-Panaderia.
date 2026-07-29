/**
 * finanzas-personales.ts — Lógica de compromisos fijos, ventas diarias manuales
 * y consejero IA financiero. Persistencia en localStorage.
 */
import { generateUUID } from '@/lib/safe-utils';
import type { CompromisoFijo, VentaDiaria, GastoCategoria } from '@/types';

const KEY_COMPROMISOS = 'dp_compromisos_fijos';
const KEY_VENTAS_DIARIAS = 'dp_ventas_diarias';

// ── Compromisos Fijos ─────────────────────────────────────────
export function getCompromisos(): CompromisoFijo[] {
  try {
    const raw = localStorage.getItem(KEY_COMPROMISOS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCompromisos(list: CompromisoFijo[]): void {
  localStorage.setItem(KEY_COMPROMISOS, JSON.stringify(list));
}

export function addCompromiso(data: Omit<CompromisoFijo, 'id'>): CompromisoFijo {
  const nuevo: CompromisoFijo = { ...data, id: generateUUID() };
  saveCompromisos([...getCompromisos(), nuevo]);
  return nuevo;
}

export function updateCompromiso(id: string, data: Partial<CompromisoFijo>): void {
  saveCompromisos(getCompromisos().map(c => c.id === id ? { ...c, ...data } : c));
}

export function deleteCompromiso(id: string): void {
  saveCompromisos(getCompromisos().filter(c => c.id !== id));
}

// ── Ventas Diarias (registro manual mientras arranca el POS) ──
export function getVentasDiarias(): VentaDiaria[] {
  try {
    const raw = localStorage.getItem(KEY_VENTAS_DIARIAS);
    if (!raw) return [];
    const list = JSON.parse(raw) as VentaDiaria[];
    // Ordenar por fecha descendente (las más recientes primero)
    return list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  } catch { return []; }
}

export function saveVentasDiarias(list: VentaDiaria[]): void {
  // Mantener últimas 365 entradas
  localStorage.setItem(KEY_VENTAS_DIARIAS, JSON.stringify(list.slice(0, 365)));
}

export function addVentaDiaria(data: Omit<VentaDiaria, 'id' | 'total'> & { id?: string }): VentaDiaria {
  // Asegurar numéricos
  const tEfe = Number(data.totalEfectivo) || 0;
  const tNeq = Number(data.totalNequi) || 0;
  const tTra = Number(data.totalTransferencia) || 0;
  const tCre = Number(data.totalCredito) || 0;

  // El total puede ser calculado usando cajas o métodos de pago
  let total = tEfe + tNeq + tTra + tCre;
  
  if (data.cajas && typeof data.cajas === 'object') {
    const totalCajas = Object.entries(data.cajas).reduce((sum, [key, val]) => {
      const v = Number(val) || 0;
      if (key === 'Gastos/Salidas') return sum - v;
      return sum + v;
    }, 0);
    // Si hay valores en cajas (incluyendo salidas), recalculamos el total de efectivo/venta
    if (Object.keys(data.cajas).length > 0) {
      total = totalCajas + tNeq + tTra + tCre;
    }
  }

  const nueva: VentaDiaria = { ...data, id: data.id || generateUUID(), total };
  const existentes = getVentasDiarias();
  
  // Si viene con ID, actualizamos ese registro específico.
  // Si no viene con ID (nuevo), verificamos si ya existe uno con misma fecha Y turno para reemplazarlo (evitar duplicados del mismo turno).
  let actualizados;
  if (data.id) {
    actualizados = existentes.map(v => v.id === data.id ? nueva : v);
    // Si por alguna razón no existía, lo agregamos
    if (!existentes.some(v => v.id === data.id)) actualizados.unshift(nueva);
  } else {
    const sinDuplicados = existentes.filter(v => !(v.fecha === data.fecha && v.turno === data.turno));
    actualizados = [nueva, ...sinDuplicados];
  }
  
  saveVentasDiarias(actualizados);
  return nueva;
}

export function deleteVentaDiaria(id: string): void {
  saveVentasDiarias(getVentasDiarias().filter(v => v.id !== id));
}

// ── Proyección de Quincena ────────────────────────────────────

/** Fecha local YYYY-MM-DD (evita el desfase UTC de toISOString en Colombia). */
const toLocalYMD = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseLocalYMD = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export function calcularProyeccionQuincena(params: {
  ventas: { fecha: string; total: number; metodoPago?: string }[];    // ventas del POS
  ventasDiarias: VentaDiaria[];                   // ventas manuales
  gastos: { fecha: string; monto: number; categoria: GastoCategoria }[];
  compromisos: CompromisoFijo[];
  margenCostoVariable?: number; // Ej. 0.5 (50% intocable para compras)
  temporadaBaja?: boolean;      // Si es temporada baja
  /** Si se pasa, usa este periodo (filtro UI) en vez de la quincena del calendario de hoy. */
  periodo?: { inicioStr: string; finStr: string; quincena: '1' | '2' | 'mes' };
}): {
  ingresosTotales: number;
  ventasCredito: number;
  efectivoReal: number;
  utilidadBruta: number;
  ingresoEsperado: number;
  utilidadBrutaEsperada: number;
  totalCompromisos: number;
  totalSalarios: number;
  saldoProyectado: number;
  diasRestantes: number;
  promedioVentaDiaria: number;
  alcanza: boolean;
  deficit: number;
  cuotaDiariaAhorro: number;
} {
  const hoy = new Date();
  const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const margen = params.margenCostoVariable ?? 0.5; // Por defecto 50% de costo de reposición

  let inicioCadena: string;
  let finCadena: string;
  let quincenaFiltro: '1' | '2' | 'mes';

  if (params.periodo?.inicioStr && params.periodo?.finStr) {
    inicioCadena = params.periodo.inicioStr;
    finCadena = params.periodo.finStr;
    quincenaFiltro = params.periodo.quincena;
  } else {
    const dia = hoy.getDate();
    const inicioQuincena = dia <= 15
      ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 16);
    const finQuincena = dia <= 15
      ? new Date(hoy.getFullYear(), hoy.getMonth(), 15)
      : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    inicioCadena = toLocalYMD(inicioQuincena);
    finCadena = toLocalYMD(finQuincena);
    quincenaFiltro = dia <= 15 ? '1' : '2';
  }

  const inicioDate = parseLocalYMD(inicioCadena);
  const finDate = parseLocalYMD(finCadena);
  const diasQuincena = Math.round((finDate.getTime() - inicioDate.getTime()) / 86400000) + 1;

  let diasTranscurridos: number;
  let diasRestantes: number;
  if (hoyDate < inicioDate) {
    diasTranscurridos = 0;
    diasRestantes = diasQuincena;
  } else if (hoyDate > finDate) {
    diasTranscurridos = diasQuincena;
    diasRestantes = 0;
  } else {
    diasTranscurridos = Math.max(1, Math.round((hoyDate.getTime() - inicioDate.getTime()) / 86400000) + 1);
    diasRestantes = Math.max(0, diasQuincena - diasTranscurridos);
  }

  // Separar ventas efectivas de créditos (POS gana: no sumar cierre manual el mismo día)
  const ventasPeriodo = params.ventas.filter(v => v.fecha >= inicioCadena && v.fecha <= finCadena);
  const fechasConPOS = new Set(ventasPeriodo.map(v => v.fecha.slice(0, 10)));
  const ventasPOSCredito = ventasPeriodo.filter(v => v.metodoPago === 'credito').reduce((s, v) => s + (Number(v.total) || 0), 0);
  const ventasPOSEfectivo = ventasPeriodo.filter(v => v.metodoPago !== 'credito').reduce((s, v) => s + (Number(v.total) || 0), 0);

  const ventasManualesPeriodo = params.ventasDiarias.filter(v =>
    v.fecha >= inicioCadena && v.fecha <= finCadena && !fechasConPOS.has(v.fecha)
  );
  const ventasManualesCredito = ventasManualesPeriodo.reduce((s, v) => s + (Number(v.totalCredito) || 0), 0);
  const ventasManualesEfectivo = ventasManualesPeriodo.reduce((s, v) => s + ((Number(v.total) || 0) - (Number(v.totalCredito) || 0)), 0);

  const ingresosTotales = ventasPOSEfectivo + ventasPOSCredito + ventasManualesEfectivo + ventasManualesCredito;
  const ventasCredito = ventasPOSCredito + ventasManualesCredito;
  const efectivoReal = ventasPOSEfectivo + ventasManualesEfectivo;

  // Promedio sobre TODO el ingreso para proyectar la meta (ajustado por temporada baja)
  let promedioVentaDiaria = diasTranscurridos > 0 ? ingresosTotales / diasTranscurridos : 0;
  if (params.temporadaBaja) promedioVentaDiaria *= 0.8; // Reduce expectativa en 20%

  const ingresoEsperado = ingresosTotales + (promedioVentaDiaria * diasRestantes);
  
  // Calcular Utilidad Bruta (dinero libre después de reponer insumos)
  const utilidadBruta = efectivoReal * (1 - margen);
  const utilidadBrutaEsperada = ingresoEsperado * (1 - margen);

  // Compromisos activos que caen en este periodo
  const compromisosQuincena = params.compromisos
    .filter(c => c.activo)
    .filter(c => {
      if (quincenaFiltro === 'mes') return true;
      if (c.frecuencia === 'quincenal') return true;
      if (c.frecuencia === 'solo_q1') return quincenaFiltro === '1';
      if (c.frecuencia === 'solo_q2') return quincenaFiltro === '2';
      if (c.frecuencia === 'mensual') {
        const d = typeof c.diaDeCobro === 'number' ? c.diaDeCobro : parseInt(c.diaDeCobro as string) || 1;
        return quincenaFiltro === '1' ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
      }
      const d = typeof c.diaDeCobro === 'number' ? c.diaDeCobro : parseInt(c.diaDeCobro as string) || 1;
      return quincenaFiltro === '1' ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
    });

  const totalCompromisos = compromisosQuincena.filter(c => !c.esPropietario).reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const totalSalarios = compromisosQuincena.filter(c => c.esPropietario).reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const totalObligaciones = totalCompromisos + totalSalarios;

  // Cuánto hay que ahorrar diariamente para cubrir los compromisos sin sufrir
  const cuotaDiariaAhorro = diasQuincena > 0 ? (totalObligaciones / diasQuincena) : 0;

  // El saldo proyectado ahora se calcula sobre la UTILIDAD BRUTA ESPERADA
  const saldoProyectado = utilidadBrutaEsperada - totalObligaciones;

  return {
    ingresosTotales: Math.round(ingresosTotales),
    ventasCredito: Math.round(ventasCredito),
    efectivoReal: Math.round(efectivoReal),
    utilidadBruta: Math.round(utilidadBruta),
    ingresoEsperado: Math.round(ingresoEsperado),
    utilidadBrutaEsperada: Math.round(utilidadBrutaEsperada),
    totalCompromisos,
    totalSalarios,
    saldoProyectado: Math.round(saldoProyectado),
    diasRestantes,
    promedioVentaDiaria: Math.round(promedioVentaDiaria),
    alcanza: saldoProyectado >= 0,
    deficit: saldoProyectado < 0 ? Math.abs(Math.round(saldoProyectado)) : 0,
    cuotaDiariaAhorro: Math.round(cuotaDiariaAhorro)
  };
}

// ── Consejero IA Financiero ───────────────────────────────────
export function generarConsejo(params: {
  ventas: { fecha: string; total: number; metodoPago?: string }[];
  ventasDiarias: VentaDiaria[];
  gastos: { fecha: string; monto: number; categoria: GastoCategoria; descripcion: string }[];
  compromisos: CompromisoFijo[];
  margenCostoVariable?: number;
  temporadaBaja?: boolean;
  periodo?: { inicioStr: string; finStr: string; quincena: '1' | '2' | 'mes' };
}): { titulo: string; nivel: 'ok' | 'alerta' | 'critico'; puntos: string[] } {
  const proyeccion = calcularProyeccionQuincena(params);
  const puntos: string[] = [];
  let nivel: 'ok' | 'alerta' | 'critico' = 'ok';

  // ── Temporada Baja
  if (params.temporadaBaja) {
    puntos.push(`🧊 Modo Temporada Baja activo: la IA ha reducido las expectativas de venta diaria futura en un 20% para ser conservadores.`);
  }

  // ── Análisis Cartera
  if (proyeccion.ventasCredito > 0) {
    puntos.push(`📝 Tienes $${proyeccion.ventasCredito.toLocaleString('es-CO')} atrapados en ventas a crédito que NO están en caja para pagar los gastos de esta quincena.`);
    if (proyeccion.ventasCredito > proyeccion.efectivoReal * 0.3) nivel = 'alerta';
  }

  // ── Proyección de quincena
  if (!proyeccion.alcanza) {
    nivel = proyeccion.deficit > 200000 ? 'critico' : 'alerta';
    puntos.push(`⚠️ Proyección: te faltarían $${proyeccion.deficit.toLocaleString('es-CO')} para cubrir todos los compromisos de esta quincena.`);
  } else {
    puntos.push(`✅ Proyección OK: con el ritmo actual, quedaría un excedente de $${proyeccion.saldoProyectado.toLocaleString('es-CO')} al final de la quincena.`);
  }

  // ── Promedio de ventas
  if (proyeccion.promedioVentaDiaria > 0) {
    puntos.push(`📈 Estás vendiendo en promedio $${proyeccion.promedioVentaDiaria.toLocaleString('es-CO')} al día.`);
  }

  // ── Análisis de gastos por categoría (último mes)
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const gastosMes = params.gastos.filter(g => (g.fecha || '').slice(0, 7) === mesActual);
  const porCategoria: Record<string, number> = {};
  gastosMes.forEach(g => { porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.monto; });

  const totalGastosMes = Object.values(porCategoria).reduce((s, v) => s + v, 0);
  const ventasTotalMes = [
    ...params.ventas.filter(v => v.fecha.slice(0, 7) === mesActual),
    ...params.ventasDiarias.filter(v => v.fecha.slice(0, 7) === mesActual),
  ].reduce((s, v) => s + v.total, 0);

  if (ventasTotalMes > 0) {
    const ratioGastos = (totalGastosMes / ventasTotalMes) * 100;
    if (ratioGastos > 70) {
      if (nivel === 'ok') nivel = 'alerta';
      puntos.push(`🚨 Los gastos del mes ($${totalGastosMes.toLocaleString('es-CO')}) representan el ${ratioGastos.toFixed(0)}% de las ventas. Muy alto — lo ideal es por debajo del 60%.`);
    } else if (ratioGastos > 50) {
      puntos.push(`⚠️ Los gastos son el ${ratioGastos.toFixed(0)}% de las ventas. Controlable, pero vigila que no suban más.`);
    } else if (ratioGastos > 0) {
      puntos.push(`✅ Los gastos representan el ${ratioGastos.toFixed(0)}% de las ventas este mes. Bien manejado.`);
    }
  }

  // ── Categoría con más gasto
  const catMayor = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
  if (catMayor && catMayor[1] > 0) {
    puntos.push(`💸 La categoría con más gasto este mes es "${catMayor[0]}": $${catMayor[1].toLocaleString('es-CO')}.`);
  }

  // ── Compromisos sin día de cobro definido
  const sinFecha = params.compromisos.filter(c => c.activo && (c.diaDeCobro < 1 || c.diaDeCobro > 31));
  if (sinFecha.length > 0) {
    puntos.push(`📅 Tienes ${sinFecha.length} compromiso(s) sin día de cobro definido — esto dificulta la proyección. Completa esa información.`);
  }

  // ── Salarios del dueño
  const salarios = params.compromisos.filter(c => c.activo && c.esPropietario);
  if (salarios.length === 0) {
    puntos.push(`👤 No tienes registrado tu salario ni el de tu esposa como compromiso fijo. Agrégalos para que la proyección sea precisa.`);
    if (nivel === 'ok') nivel = 'alerta';
  } else {
    const totalSal = salarios.reduce((s, c) => s + c.monto, 0);
    puntos.push(`👥 Salarios de propietarios registrados: $${totalSal.toLocaleString('es-CO')} por quincena.`);
  }

  const titulo = nivel === 'critico'
    ? '🔴 Situación crítica — acción urgente'
    : nivel === 'alerta'
    ? '🟡 Hay puntos a mejorar esta quincena'
    : '🟢 Las finanzas están en orden';

  return { titulo, nivel, puntos };
}

// ── Registro de Producción Diaria ────────────────────────────
export interface HornadaDia {
  tipoPan: string;       // Ej: "Pan dulce", "Hojaldrado"
  bandejas: number;      // Nº de bandejas
  panesPorBandeja: number;
  totalPanes: number;    // calculado: bandejas * panesPorBandeja
  masaId?: string;       // ID de la masa origen
}

export interface MasaPreparadaDia {
  id: string;
  nombre: string;
  cantidadArrobas: number;
}

export interface RegistroProduccion {
  id: string;
  fecha: string;          // YYYY-MM-DD
  // Masas dinámicas
  masas?: MasaPreparadaDia[];
  // Masas preparadas en arrobas (legado, opcionales para no romper)
  masaDulce?: number;
  masaHojaldrado?: number;
  masaBatidoTorta?: number;
  masaBatidoGalleta?: number;
  // Hornadas del día
  hornadas: HornadaDia[];
  notas?: string;
}

const KEY_PRODUCCIONES = 'dp_producciones_diarias';

/** Fecha de hoy en calendario LOCAL (evita el salto de día de toISOString/UTC en Colombia). */
export const fechaLocalHoy = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Normaliza a YYYY-MM-DD sin cambiar el día por zona horaria.
 * Si viene ISO con hora, toma solo los primeros 10 caracteres (el día que se eligió).
 */
export const normalizarFechaYYYYMMDD = (fecha: string | undefined | null): string => {
  if (!fecha || typeof fecha !== 'string') return fechaLocalHoy();
  const m = fecha.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return fechaLocalHoy();
};

export function getProducciones(): RegistroProduccion[] {
  try {
    const raw = localStorage.getItem(KEY_PRODUCCIONES);
    if (!raw) return [];
    const list = JSON.parse(raw) as RegistroProduccion[];
    let dirty = false;
    const normalizados = list.map((p) => {
      const fecha = normalizarFechaYYYYMMDD(p.fecha);
      if (fecha !== p.fecha) dirty = true;
      return { ...p, fecha };
    });
    // Reordenar por fecha texto (YYYY-MM-DD) — no usar new Date('YYYY-MM-DD') (UTC)
    normalizados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (dirty) {
      try { localStorage.setItem(KEY_PRODUCCIONES, JSON.stringify(normalizados.slice(0, 365))); } catch { /* ignore */ }
    }
    return normalizados;
  } catch { return []; }
}

export function saveProducciones(list: RegistroProduccion[]): void {
  const normalizados = list.map((p) => ({ ...p, fecha: normalizarFechaYYYYMMDD(p.fecha) }));
  normalizados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  localStorage.setItem(KEY_PRODUCCIONES, JSON.stringify(normalizados.slice(0, 365)));
}

export function addProduccion(data: Omit<RegistroProduccion, 'id'>): RegistroProduccion {
  const nuevo: RegistroProduccion = {
    ...data,
    fecha: normalizarFechaYYYYMMDD(data.fecha),
    id: generateUUID(),
  };
  const existentes = getProducciones();
  // Se remueve el filtro de fecha única para permitir múltiples lotes/auditorías por día
  saveProducciones([nuevo, ...existentes]);
  return nuevo;
}

export function deleteProduccion(id: string): void {
  saveProducciones(getProducciones().filter(p => p.id !== id));
}
