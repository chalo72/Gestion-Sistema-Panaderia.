/**
 * Análisis operativo con datos reales ya cargados:
 * ventas/gastos semanal · quincenal · mensual,
 * promedio por proveedor, patrones periódicos,
 * capital de trabajo (mínimo para funcionar) y punto de equilibrio.
 *
 * No inventa cifras: si faltan datos, lo deja explícito.
 */

import { compromisoAMensual, esCompromisoYaEnNomina } from '@/lib/finanzas-personales';
import type { CompromisoFijo, Gasto, GastoCategoria, VentaDiaria } from '@/types';

const toYMD = (f: string | undefined | null): string => {
  if (!f) return '';
  const m = String(f).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

const enRango = (fecha: string, inicio: string, fin: string) =>
  fecha >= inicio && fecha <= fin;

/** Lunes de la semana ISO-local (YYYY-MM-DD) */
export function lunesDeSemana(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function sumarDiasYMD(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export interface TotalesPeriodo {
  label: string;
  inicio: string;
  fin: string;
  ventas: number;
  gastos: number;
  saldo: number;
  diasConVenta: number;
  diasConGasto: number;
}

export interface PromedioProveedor {
  proveedorId: string;
  nombre: string;
  total: number;
  nPagos: number;
  promedioPorPago: number;
  /** Estimado semanal si hay ≥7 días de historia */
  promedioSemanal: number;
}

export interface PatronGastoPeriodico {
  clave: string;
  label: string;
  categoria: string;
  total: number;
  nVeces: number;
  diasDelMes: number[];
  diaTipico: number | null;
  frecuenciaSugerida: 'semanal' | 'quincenal' | 'mensual' | 'irregular';
}

export interface LineaCajaResumen {
  clave: string;
  label: string;
  ventas: number;
  pctSobreTotal: number;
}

export interface PuntoEquilibrio {
  /** Compromisos fijos mensuales (negocio, sin dueños) */
  fijosMensuales: number;
  /** Gasto operativo recurrente estimado (servicios+arriendo+nómina ya en compromisos + promedio insumos) */
  operativosMensualesEstimados: number;
  /** Capital mínimo a proteger: fijos + insumos tipicos de 2 semanas */
  capitalTrabajoMinimo: number;
  /** Ventas necesarias al mes para cubrir fijos + operativos tipicos */
  ventasEquilibrioMensual: number;
  ventasEquilibrioSemanal: number;
  ventasEquilibrioQuincenal: number;
  /** Ventas reales del periodo analizado (mes si hay) */
  ventasRealesMensualApprox: number;
  /** Ganancia por encima del equilibrio (negativo = debajo) */
  sobreEquilibrio: number;
  /** Datos insuficientes para estimar */
  avisoDatos: string | null;
}

export interface AnalisisOperativo {
  rangoDatos: { primeraFecha: string; ultimaFecha: string; diasCubiertos: number };
  semanal: TotalesPeriodo[];
  quincenal: TotalesPeriodo[];
  mensual: TotalesPeriodo[];
  proveedores: PromedioProveedor[];
  totalProveedores: number;
  patrones: PatronGastoPeriodico[];
  lineasCaja: LineaCajaResumen[];
  equilibrio: PuntoEquilibrio;
  bovedas: { id: string; nombre: string; saldoSistema: number }[];
  contextoAgente: string;
}

type GastoLite = Pick<Gasto, 'fecha' | 'monto' | 'categoria' | 'proveedorId' | 'descripcion' | 'estado'> & {
  proveedorNombre?: string;
};

type VentaLite = { fecha: string; total: number };

function ventasUnificadas(
  ventasPOS: VentaLite[],
  ventasDiarias: VentaDiaria[]
): { fecha: string; total: number; cajas?: Record<string, number> }[] {
  const porDia = new Map<string, { total: number; cajas?: Record<string, number> }>();
  for (const v of ventasPOS) {
    const f = toYMD(v.fecha);
    if (!f) continue;
    const cur = porDia.get(f) || { total: 0 };
    cur.total += Number(v.total) || 0;
    porDia.set(f, cur);
  }
  for (const v of ventasDiarias || []) {
    const f = toYMD(v.fecha);
    if (!f) continue;
    if (porDia.has(f) && (porDia.get(f)!.total || 0) > 0) {
      // LOCAL: si ya hay POS ese día, no duplicar total; sí enriquecer cajas si faltan
      const cur = porDia.get(f)!;
      if (!cur.cajas && v.cajas) cur.cajas = { ...v.cajas };
      continue;
    }
    porDia.set(f, {
      total: Number(v.total) || 0,
      cajas: v.cajas ? { ...v.cajas } : undefined,
    });
  }
  return [...porDia.entries()]
    .map(([fecha, d]) => ({ fecha, total: d.total, cajas: d.cajas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function gastosActivos(gastos: GastoLite[]): GastoLite[] {
  return (gastos || []).filter((g) => g.estado !== 'anulado' && toYMD(g.fecha));
}

function totalesEnRango(
  label: string,
  inicio: string,
  fin: string,
  ventas: { fecha: string; total: number }[],
  gastos: GastoLite[]
): TotalesPeriodo {
  const v = ventas.filter((x) => enRango(x.fecha, inicio, fin));
  const g = gastos.filter((x) => enRango(toYMD(x.fecha), inicio, fin));
  const ventasSum = v.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const gastosSum = g.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  return {
    label,
    inicio,
    fin,
    ventas: Math.round(ventasSum),
    gastos: Math.round(gastosSum),
    saldo: Math.round(ventasSum - gastosSum),
    diasConVenta: new Set(v.map((x) => x.fecha)).size,
    diasConGasto: new Set(g.map((x) => toYMD(x.fecha))).size,
  };
}

function clasificarLineaCaja(nombre: string): string {
  const n = nombre.toLowerCase();
  if (/torta|pastel/.test(n)) return 'Tortas';
  if (/helado|paleta|cono/.test(n)) return 'Helados';
  if (/gaseosa|bebida|jugo|refresco/.test(n)) return 'Gaseosas / bebidas';
  if (/principal|general|fondo|comun|común/.test(n)) return 'Caja principal / fondo';
  return nombre.trim() || 'Otras cajas';
}

function detectarPatrones(gastos: GastoLite[]): PatronGastoPeriodico[] {
  const grupos = new Map<string, { label: string; lista: GastoLite[] }>();
  for (const g of gastos) {
    const cat = String(g.categoria || 'Otros');
    const desc = (g.descripcion || '').toLowerCase();
    let clave = cat;
    let label = cat;
    if (/arriendo|alquiler/.test(desc) || cat === 'Arriendo') {
      clave = 'arriendo';
      label = 'Arriendo';
    } else if (/luz|energia|energía|electric/.test(desc)) {
      clave = 'luz';
      label = 'Luz / energía';
    } else if (/agua|acueducto/.test(desc)) {
      clave = 'agua';
      label = 'Agua';
    } else if (/\bgas\b|gasodom/.test(desc)) {
      clave = 'gas';
      label = 'Gas';
    } else if (/internet|wifi|claro|movistar/.test(desc)) {
      clave = 'internet';
      label = 'Internet';
    } else if (/banco|credito|crédito|cuota|prestamo|préstamo/.test(desc)) {
      clave = 'banco';
      label = 'Banco / créditos';
    } else if (cat === 'Servicios') {
      clave = `servicios:${(g.descripcion || 'servicio').slice(0, 24)}`;
      label = g.descripcion || 'Servicios';
    } else if (cat === 'Nómina') {
      clave = 'nomina';
      label = 'Nómina';
    } else if (cat === 'Familia') {
      clave = 'familia';
      label = 'Familia / retiros';
    } else {
      continue; // solo patrones de gastos periódicos típicos
    }
    const cur = grupos.get(clave) || { label, lista: [] };
    cur.lista.push(g);
    grupos.set(clave, cur);
  }

  const out: PatronGastoPeriodico[] = [];
  for (const [clave, { label, lista }] of grupos) {
    if (lista.length < 1) continue;
    const dias = lista
      .map((g) => Number(toYMD(g.fecha).slice(8, 10)))
      .filter((d) => d >= 1 && d <= 31)
      .sort((a, b) => a - b);
    const total = lista.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const uniqDias = [...new Set(dias)];
    const diaTipico =
      uniqDias.length === 0
        ? null
        : uniqDias.sort(
            (a, b) =>
              dias.filter((d) => d === b).length - dias.filter((d) => d === a).length
          )[0];

    let frecuenciaSugerida: PatronGastoPeriodico['frecuenciaSugerida'] = 'irregular';
    if (lista.length >= 2) {
      const fechas = lista.map((g) => toYMD(g.fecha)).sort();
      const gaps: number[] = [];
      for (let i = 1; i < fechas.length; i++) {
        const a = new Date(fechas[i - 1] + 'T12:00:00');
        const b = new Date(fechas[i] + 'T12:00:00');
        gaps.push(Math.round((b.getTime() - a.getTime()) / 86400000));
      }
      const gapMed = gaps.reduce((s, x) => s + x, 0) / gaps.length;
      if (gapMed <= 10) frecuenciaSugerida = 'semanal';
      else if (gapMed <= 20) frecuenciaSugerida = 'quincenal';
      else if (gapMed <= 40) frecuenciaSugerida = 'mensual';
    }

    out.push({
      clave,
      label,
      categoria: String(lista[0].categoria || 'Otros'),
      total: Math.round(total),
      nVeces: lista.length,
      diasDelMes: uniqDias,
      diaTipico,
      frecuenciaSugerida,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function calcularAnalisisOperativo(params: {
  ventas: VentaLite[];
  ventasDiarias: VentaDiaria[];
  gastos: GastoLite[];
  compromisos: CompromisoFijo[];
  proveedores?: { id: string; nombre: string }[];
  bovedas?: { id: string; nombre: string; saldo: number }[];
  /** Ancla: última fecha a considerar (default: hoy local vía datos) */
  hasta?: string;
}): AnalisisOperativo {
  const gastos = gastosActivos(params.gastos);
  const ventas = ventasUnificadas(params.ventas || [], params.ventasDiarias || []);
  const fechas = [
    ...ventas.map((v) => v.fecha),
    ...gastos.map((g) => toYMD(g.fecha)),
  ].filter(Boolean).sort();

  const primeraFecha = fechas[0] || '';
  const ultimaFecha = params.hasta || fechas[fechas.length - 1] || '';
  let diasCubiertos = 0;
  if (primeraFecha && ultimaFecha) {
    const a = new Date(primeraFecha + 'T12:00:00');
    const b = new Date(ultimaFecha + 'T12:00:00');
    diasCubiertos = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  }

  // Semanas (lunes–domingo) dentro del rango
  const semanal: TotalesPeriodo[] = [];
  if (primeraFecha && ultimaFecha) {
    let lunes = lunesDeSemana(primeraFecha);
    while (lunes <= ultimaFecha) {
      const domingo = sumarDiasYMD(lunes, 6);
      const fin = domingo > ultimaFecha ? ultimaFecha : domingo;
      const ini = lunes < primeraFecha ? primeraFecha : lunes;
      if (ini <= fin) {
        semanal.push(totalesEnRango(`Sem ${ini.slice(5)}`, ini, fin, ventas, gastos));
      }
      lunes = sumarDiasYMD(lunes, 7);
    }
  }

  // Quincenas por mes presente en el rango
  const quincenal: TotalesPeriodo[] = [];
  const mensual: TotalesPeriodo[] = [];
  if (primeraFecha && ultimaFecha) {
    const meses = new Set<string>();
    let cursor = primeraFecha.slice(0, 7) + '-01';
    while (cursor.slice(0, 7) <= ultimaFecha.slice(0, 7)) {
      meses.add(cursor.slice(0, 7));
      const [y, m] = cursor.split('-').map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      cursor = next;
    }
    for (const ym of [...meses].sort()) {
      const [y, m] = ym.split('-').map(Number);
      const q1i = `${ym}-01`;
      const q1f = `${ym}-15`;
      const q2i = `${ym}-16`;
      const last = new Date(y, m, 0).getDate();
      const q2f = `${ym}-${String(last).padStart(2, '0')}`;
      const mesIni = q1i < primeraFecha ? primeraFecha : q1i;
      const mesFin = q2f > ultimaFecha ? ultimaFecha : q2f;
      if (mesIni <= mesFin) {
        mensual.push(totalesEnRango(ym, mesIni, mesFin, ventas, gastos));
      }
      if (q1f >= primeraFecha && q1i <= ultimaFecha) {
        quincenal.push(
          totalesEnRango(
            `${ym} Q1`,
            q1i < primeraFecha ? primeraFecha : q1i,
            q1f > ultimaFecha ? ultimaFecha : q1f,
            ventas,
            gastos
          )
        );
      }
      if (q2f >= primeraFecha && q2i <= ultimaFecha) {
        quincenal.push(
          totalesEnRango(
            `${ym} Q2`,
            q2i < primeraFecha ? primeraFecha : q2i,
            q2f > ultimaFecha ? ultimaFecha : q2f,
            ventas,
            gastos
          )
        );
      }
    }
  }

  // Proveedores
  const nombreProv = new Map((params.proveedores || []).map((p) => [p.id, p.nombre]));
  const porProv = new Map<string, { total: number; n: number; nombre: string }>();
  for (const g of gastos) {
    if (!g.proveedorId && g.categoria !== 'Materia Prima') continue;
    const id = g.proveedorId || '_sin_proveedor';
    const nombre =
      g.proveedorNombre ||
      nombreProv.get(g.proveedorId || '') ||
      (id === '_sin_proveedor' ? 'Sin proveedor (materia prima)' : id);
    const cur = porProv.get(id) || { total: 0, n: 0, nombre };
    cur.total += Number(g.monto) || 0;
    cur.n += 1;
    porProv.set(id, cur);
  }
  const semanas = Math.max(1, diasCubiertos / 7);
  const proveedores: PromedioProveedor[] = [...porProv.entries()]
    .map(([proveedorId, v]) => ({
      proveedorId,
      nombre: v.nombre,
      total: Math.round(v.total),
      nPagos: v.n,
      promedioPorPago: Math.round(v.total / Math.max(1, v.n)),
      promedioSemanal: Math.round(v.total / semanas),
    }))
    .sort((a, b) => b.total - a.total);
  const totalProveedores = proveedores.reduce((s, p) => s + p.total, 0);

  const patrones = detectarPatrones(gastos);

  // Líneas de caja (tortas, helados, gaseosas…)
  const lineasMap = new Map<string, number>();
  let totalLineas = 0;
  for (const v of ventas) {
    if (!v.cajas) continue;
    for (const [k, val] of Object.entries(v.cajas)) {
      const linea = clasificarLineaCaja(k);
      const monto = Number(val) || 0;
      lineasMap.set(linea, (lineasMap.get(linea) || 0) + monto);
      totalLineas += monto;
    }
  }
  const lineasCaja: LineaCajaResumen[] = [...lineasMap.entries()]
    .map(([label, ventasSum]) => ({
      clave: label.toLowerCase(),
      label,
      ventas: Math.round(ventasSum),
      pctSobreTotal: totalLineas > 0 ? Math.round((ventasSum / totalLineas) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.ventas - a.ventas);

  // Equilibrio / capital de trabajo
  const fijos = (params.compromisos || []).filter(
    (c) => c.activo && !esCompromisoYaEnNomina(c) && !c.esPropietario
  );
  const fijosMensuales = Math.round(
    fijos.reduce((s, c) => s + compromisoAMensual(c), 0)
  );

  const insumosTotal = gastos
    .filter((g) => g.categoria === 'Materia Prima' || !!g.proveedorId)
    .reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const insumosMensualApprox =
    diasCubiertos >= 7 ? Math.round((insumosTotal / diasCubiertos) * 30) : Math.round(insumosTotal);

  const nominaYServPagados = gastos
    .filter((g) =>
      (['Nómina', 'Servicios', 'Arriendo'] as GastoCategoria[]).includes(g.categoria as GastoCategoria)
    )
    .reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const operativosDeGastos =
    diasCubiertos >= 7
      ? Math.round((nominaYServPagados / diasCubiertos) * 30)
      : Math.round(nominaYServPagados);

  const operativosMensualesEstimados = Math.max(fijosMensuales, operativosDeGastos) + insumosMensualApprox;
  const capitalTrabajoMinimo = Math.round(fijosMensuales + insumosMensualApprox / 2); // 2 semanas de insumos
  const ventasEquilibrioMensual = operativosMensualesEstimados;
  const ventasEquilibrioSemanal = Math.round(ventasEquilibrioMensual / 4.3);
  const ventasEquilibrioQuincenal = Math.round(ventasEquilibrioMensual / 2);

  const mesActual = mensual[mensual.length - 1];
  const ventasRealesMensualApprox = mesActual?.ventas
    ?? (diasCubiertos >= 7
      ? Math.round((ventas.reduce((s, v) => s + v.total, 0) / diasCubiertos) * 30)
      : Math.round(ventas.reduce((s, v) => s + v.total, 0)));

  const sobreEquilibrio = ventasRealesMensualApprox - ventasEquilibrioMensual;

  let avisoDatos: string | null = null;
  if (!primeraFecha) {
    avisoDatos = 'Aún no hay ventas ni gastos con fecha para analizar. Sigue registrando cuadres y gastos.';
  } else if (diasCubiertos < 7) {
    avisoDatos = `Solo hay ~${diasCubiertos} día(s) de historia. Los promedios semanales/mensuales son tentativos hasta completar al menos una semana.`;
  } else if (diasCubiertos < 15) {
    avisoDatos = `Hay ${diasCubiertos} días de datos (arranque del sistema). Los patrones mejoran con cada quincena registrada.`;
  }

  const bovedas = (params.bovedas || []).map((b) => ({
    id: b.id,
    nombre: b.nombre,
    saldoSistema: Math.round(Number(b.saldo) || 0),
  }));

  const contextoAgente = [
    `ANÁLISIS OPERATIVO ${primeraFecha || '?'} → ${ultimaFecha || '?'} (${diasCubiertos} días)`,
    avisoDatos ? `AVISO: ${avisoDatos}` : 'Datos suficientes para lectura semanal/quincenal.',
    `Ventas mensuales approx: $${ventasRealesMensualApprox.toLocaleString('es-CO')}`,
    `Gastos proveedores total periodo: $${totalProveedores.toLocaleString('es-CO')}`,
    proveedores.slice(0, 8).map((p) => `  · ${p.nombre}: $${p.total.toLocaleString('es-CO')} (≈$${p.promedioSemanal.toLocaleString('es-CO')}/sem)`).join('\n') || '  · sin proveedores',
    `Fijos mensuales (compromisos): $${fijosMensuales.toLocaleString('es-CO')}`,
    `Capital trabajo mínimo sugerido: $${capitalTrabajoMinimo.toLocaleString('es-CO')}`,
    `Punto equilibrio mensual: $${ventasEquilibrioMensual.toLocaleString('es-CO')} · semanal $${ventasEquilibrioSemanal.toLocaleString('es-CO')} · Q $${ventasEquilibrioQuincenal.toLocaleString('es-CO')}`,
    `Sobre/bajo equilibrio: $${sobreEquilibrio.toLocaleString('es-CO')}`,
    lineasCaja.length
      ? `Líneas caja: ${lineasCaja.map((l) => `${l.label}=$${l.ventas.toLocaleString('es-CO')} (${l.pctSobreTotal}%)`).join(', ')}`
      : 'Líneas caja: sin desglose en cuadres (cajas torta/helado/gaseosa)',
    bovedas.length
      ? `Bóvedas (saldo en sistema, puede NO ser el físico): ${bovedas.map((b) => `${b.nombre}=$${b.saldoSistema.toLocaleString('es-CO')}`).join(', ')}`
      : 'Bóvedas: ninguna',
    patrones.slice(0, 6).map((p) => `Patrón ${p.label}: ${p.nVeces}× · tipico día ${p.diaTipico ?? '?'} · ${p.frecuenciaSugerida}`).join('\n'),
  ].filter(Boolean).join('\n');

  return {
    rangoDatos: { primeraFecha, ultimaFecha, diasCubiertos },
    semanal,
    quincenal,
    mensual,
    proveedores,
    totalProveedores: Math.round(totalProveedores),
    patrones,
    lineasCaja,
    equilibrio: {
      fijosMensuales,
      operativosMensualesEstimados: Math.round(operativosMensualesEstimados),
      capitalTrabajoMinimo,
      ventasEquilibrioMensual: Math.round(ventasEquilibrioMensual),
      ventasEquilibrioSemanal,
      ventasEquilibrioQuincenal,
      ventasRealesMensualApprox,
      sobreEquilibrio: Math.round(sobreEquilibrio),
      avisoDatos,
    },
    bovedas,
    contextoAgente,
  };
}
