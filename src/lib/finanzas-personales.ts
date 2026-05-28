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
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveVentasDiarias(list: VentaDiaria[]): void {
  // Mantener últimas 365 entradas
  localStorage.setItem(KEY_VENTAS_DIARIAS, JSON.stringify(list.slice(0, 365)));
}

export function addVentaDiaria(data: Omit<VentaDiaria, 'id' | 'total'>): VentaDiaria {
  const total = data.totalEfectivo + data.totalNequi + data.totalTransferencia + data.totalCredito;
  const nueva: VentaDiaria = { ...data, id: generateUUID(), total };
  const existentes = getVentasDiarias();
  // Si ya hay una para esa fecha, reemplazar
  const sinEsaDia = existentes.filter(v => v.fecha !== data.fecha);
  saveVentasDiarias([nueva, ...sinEsaDia]);
  return nueva;
}

export function deleteVentaDiaria(id: string): void {
  saveVentasDiarias(getVentasDiarias().filter(v => v.id !== id));
}

// ── Proyección de Quincena ────────────────────────────────────
export function calcularProyeccionQuincena(params: {
  ventas: { fecha: string; total: number }[];    // ventas del POS
  ventasDiarias: VentaDiaria[];                   // ventas manuales
  gastos: { fecha: string; monto: number; categoria: GastoCategoria }[];
  compromisos: CompromisoFijo[];
}): {
  ingresoEsperado: number;
  totalCompromisos: number;
  totalSalarios: number;
  saldoProyectado: number;
  diasRestantes: number;
  promedioVentaDiaria: number;
  alcanza: boolean;
  deficit: number;
} {
  const hoy = new Date();
  const dia = hoy.getDate();
  // Determinar quincena actual
  const inicioQuincena = dia <= 15
    ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 16);
  const finQuincena = dia <= 15
    ? new Date(hoy.getFullYear(), hoy.getMonth(), 15)
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  const diasQuincena = Math.round((finQuincena.getTime() - inicioQuincena.getTime()) / 86400000) + 1;
  const diasTranscurridos = Math.max(1, dia <= 15 ? dia : dia - 15);
  const diasRestantes = diasQuincena - diasTranscurridos;

  // Ingresos reales en la quincena actual
  const inicioCadena = inicioQuincena.toISOString().slice(0, 10);
  const finCadena = finQuincena.toISOString().slice(0, 10);

  const ventasPOS = params.ventas
    .filter(v => v.fecha >= inicioCadena && v.fecha <= finCadena)
    .reduce((s, v) => s + v.total, 0);

  const ventasManuales = params.ventasDiarias
    .filter(v => v.fecha >= inicioCadena && v.fecha <= finCadena)
    .reduce((s, v) => s + v.total, 0);

  const ingresosActuales = ventasPOS + ventasManuales;
  const promedioVentaDiaria = diasTranscurridos > 0 ? ingresosActuales / diasTranscurridos : 0;
  const ingresoEsperado = ingresosActuales + promedioVentaDiaria * diasRestantes;

  // Compromisos activos que caen en esta quincena
  const totalCompromisos = params.compromisos
    .filter(c => c.activo && !c.esPropietario)
    .filter(c => {
      const d = c.diaDeCobro;
      return dia <= 15 ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
    })
    .reduce((s, c) => s + c.monto, 0);

  const totalSalarios = params.compromisos
    .filter(c => c.activo && c.esPropietario)
    .filter(c => {
      const d = c.diaDeCobro;
      return dia <= 15 ? d >= 1 && d <= 15 : d >= 16 && d <= 31;
    })
    .reduce((s, c) => s + c.monto, 0);

  const totalObligaciones = totalCompromisos + totalSalarios;
  const saldoProyectado = ingresoEsperado - totalObligaciones;

  return {
    ingresoEsperado: Math.round(ingresoEsperado),
    totalCompromisos,
    totalSalarios,
    saldoProyectado: Math.round(saldoProyectado),
    diasRestantes,
    promedioVentaDiaria: Math.round(promedioVentaDiaria),
    alcanza: saldoProyectado >= 0,
    deficit: saldoProyectado < 0 ? Math.abs(Math.round(saldoProyectado)) : 0,
  };
}

// ── Consejero IA Financiero ───────────────────────────────────
export function generarConsejo(params: {
  ventas: { fecha: string; total: number }[];
  ventasDiarias: VentaDiaria[];
  gastos: { fecha: string; monto: number; categoria: GastoCategoria; descripcion: string }[];
  compromisos: CompromisoFijo[];
}): { titulo: string; nivel: 'ok' | 'alerta' | 'critico'; puntos: string[] } {
  const proyeccion = calcularProyeccionQuincena(params);
  const puntos: string[] = [];
  let nivel: 'ok' | 'alerta' | 'critico' = 'ok';

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
