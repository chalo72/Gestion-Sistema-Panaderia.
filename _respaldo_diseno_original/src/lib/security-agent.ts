/**
 * security-agent.ts — Agente IA de Seguridad Anti-Fraude
 * Detecta patrones sospechosos y genera alertas para el admin.
 */

import { generateUUID } from '@/lib/safe-utils';
import type { AlertaSeguridad, CuadreTurno, ConfigSeguridad, NivelAlerta, TipoAlerta, ExpedienteDeudor, IncidenteVendedor, LogActividad } from '@/types';

const STORAGE_KEY_ALERTAS = 'dp_security_alertas';
const STORAGE_KEY_CUADRES = 'dp_security_cuadres';
const STORAGE_KEY_CONFIG = 'dp_security_config';
const STORAGE_KEY_DEUDORES = 'dp_security_deudores';
const STORAGE_KEY_INCIDENTES = 'dp_security_incidentes';
const STORAGE_KEY_LOGS_ACTIVIDAD = 'dp_security_logs';

// ── Config por defecto ────────────────────────────────────────────
/** PIN de fábrica: vacío a propósito (antes era '1234' — candado de juguete).
 *  Si el aparato ya tiene un PIN guardado (incluso 1234), se respeta: no se pisa.
 *  El login del Director a la app NO usa este PIN. */
export const PIN_FABRICA_INSEGURO = '1234';

export const CONFIG_SEGURIDAD_DEFAULT: ConfigSeguridad = {
  toleranciaFaltanteCaja: 5000,        // $5.000 COP de tolerancia
  descuentoMaxSinPin: 10,              // 10% máximo sin PIN
  precioMinimoVenta: 0,                // 0 = desactivado
  alertarPatronBajoVentas: true,
  horasParaAlertaTurnoAbierto: 12,
  whatsappAdmin: '',
  pinGerente: '',                      // sin PIN débil por defecto en instalaciones nuevas
  activado: true,
  geolocalizacionHabilitada: false,
  horariosRestringidos: false,
  horaInicioPermitida: '06:00',
  horaFinPermitida: '22:00',
  apiType: 'local',
  apiKeyCloud: '',
  ollamaUrl: 'http://localhost:11434',
  modeloOllamaTexto: 'llama3.2',
};

// ── Persistencia local ────────────────────────────────────────────
export function getConfigSeguridad(): ConfigSeguridad {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    return raw ? { ...CONFIG_SEGURIDAD_DEFAULT, ...JSON.parse(raw) } : CONFIG_SEGURIDAD_DEFAULT;
  } catch { return CONFIG_SEGURIDAD_DEFAULT; }
}

export function saveConfigSeguridad(config: ConfigSeguridad): void {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

export function getAlertas(): AlertaSeguridad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTAS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAlertas(alertas: AlertaSeguridad[]): void {
  // Mantener solo las últimas 200 alertas
  const trimmed = alertas.slice(0, 200);
  localStorage.setItem(STORAGE_KEY_ALERTAS, JSON.stringify(trimmed));
}

export function getCuadres(): CuadreTurno[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUADRES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCuadres(cuadres: CuadreTurno[]): void {
  const trimmed = cuadres.slice(0, 100);
  localStorage.setItem(STORAGE_KEY_CUADRES, JSON.stringify(trimmed));
}

// ── Crear alerta ──────────────────────────────────────────────────
export function crearAlerta(
  tipo: TipoAlerta,
  nivel: NivelAlerta,
  titulo: string,
  descripcion: string,
  vendedora?: string,
  datos?: Record<string, any>
): AlertaSeguridad {
  const alerta: AlertaSeguridad = {
    id: generateUUID(),
    tipo,
    nivel,
    titulo,
    descripcion,
    fecha: new Date().toISOString(),
    vendedora,
    leida: false,
    datos,
  };
  const actuales = getAlertas();
  saveAlertas([alerta, ...actuales]);
  return alerta;
}

export function marcarAlertaLeida(id: string): void {
  const alertas = getAlertas().map(a => a.id === id ? { ...a, leida: true } : a);
  saveAlertas(alertas);
}

export function marcarTodasLeidas(): void {
  const alertas = getAlertas().map(a => ({ ...a, leida: true }));
  saveAlertas(alertas);
}

export function getAlertasNoLeidas(): number {
  return getAlertas().filter(a => !a.leida).length;
}

// ── Cuadre de turno ───────────────────────────────────────────────
export function procesarCuadreTurno(params: {
  usuarioId: string;
  usuarioNombre: string;
  fechaApertura: string;
  montoApertura: number;
  montoDeclarado: number;
  ventasEfectivo: number;
  ventasNequi: number;
  ventasTransferencia: number;
  ventasCredito: number;
}): CuadreTurno {
  const config = getConfigSeguridad();
  const montoEsperado = params.montoApertura + params.ventasEfectivo;
  const diferencia = params.montoDeclarado - montoEsperado;
  const totalVentas = params.ventasEfectivo + params.ventasNequi + params.ventasTransferencia + params.ventasCredito;

  const cuadre: CuadreTurno = {
    id: generateUUID(),
    usuarioId: params.usuarioId,
    usuarioNombre: params.usuarioNombre,
    fechaApertura: params.fechaApertura,
    fechaCierre: new Date().toISOString(),
    montoApertura: params.montoApertura,
    montoDeclarado: params.montoDeclarado,
    montoEsperado,
    diferencia,
    ventasEfectivo: params.ventasEfectivo,
    ventasNequi: params.ventasNequi,
    ventasTransferencia: params.ventasTransferencia,
    ventasCredito: params.ventasCredito,
    totalVentas,
    alertaGenerada: false,
  };

  // Detectar faltante
  if (config.activado && diferencia < -config.toleranciaFaltanteCaja) {
    const faltante = Math.abs(diferencia);
    crearAlerta(
      'faltante_caja',
      faltante > 50000 ? 'critica' : faltante > 20000 ? 'alta' : 'media',
      `⚠️ Faltante en caja — ${params.usuarioNombre}`,
      `Al cerrar turno, ${params.usuarioNombre} declaró $${faltante.toLocaleString('es-CO')} menos de lo esperado. Esperado: $${montoEsperado.toLocaleString('es-CO')} — Declarado: $${params.montoDeclarado.toLocaleString('es-CO')}`,
      params.usuarioNombre,
      { faltante, montoEsperado, montoDeclarado: params.montoDeclarado }
    );
    cuadre.alertaGenerada = true;
  }

  // Detectar sobrante sospechoso (vendió sin registrar y devuelve más)
  if (config.activado && diferencia > config.toleranciaFaltanteCaja * 2) {
    crearAlerta(
      'patron_ventas_bajo',
      'media',
      `🔍 Sobrante inusual — ${params.usuarioNombre}`,
      `${params.usuarioNombre} tiene $${diferencia.toLocaleString('es-CO')} más de lo esperado. Posible venta no registrada o error de apertura.`,
      params.usuarioNombre,
      { sobrante: diferencia }
    );
    cuadre.alertaGenerada = true;
  }

  const cuadres = getCuadres();
  saveCuadres([cuadre, ...cuadres]);
  return cuadre;
}

// ── Analizar venta antes de guardar ──────────────────────────────
export function analizarVenta(params: {
  precio: number;
  precioBase: number;
  vendedora: string;
  nombreProducto: string;
  clienteNombre?: string;
}): { bloqueada: boolean; razon?: string; requierePin: boolean } {
  const config = getConfigSeguridad();
  if (!config.activado) return { bloqueada: false, requierePin: false };

  if (params.precioBase > 0 && params.precio < params.precioBase) {
    const descuento = ((params.precioBase - params.precio) / params.precioBase) * 100;
    if (descuento > config.descuentoMaxSinPin) {
      return {
        bloqueada: false,
        requierePin: true,
        razon: `Descuento del ${descuento.toFixed(0)}% supera el límite de ${config.descuentoMaxSinPin}% — requiere PIN de gerente`,
      };
    }
  }
  return { bloqueada: false, requierePin: false };
}

// ── Verificar PIN de gerente ──────────────────────────────────────
export function verificarPinGerente(pin: string): boolean {
  const config = getConfigSeguridad();
  const esperado = (config.pinGerente || '').trim();
  const ingresado = (pin || '').trim();
  // Sin PIN configurado: nadie pasa (hay que definirlo en Seguridad)
  if (!esperado) return false;
  return ingresado === esperado;
}

/** true si el PIN guardado es el débil de fábrica o está vacío */
export function pinGerenteEsInseguro(config?: ConfigSeguridad): boolean {
  const pin = (config ?? getConfigSeguridad()).pinGerente?.trim() ?? '';
  return !pin || pin === PIN_FABRICA_INSEGURO;
}

// ── Análisis diario (llamar al iniciar sesión admin) ──────────────
export function analizarPatronesDiarios(ventas: any[], usuariosActivos: string[]): void {
  const config = getConfigSeguridad();
  if (!config.activado) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const ventasHoy = ventas.filter(v => new Date(v.fecha || v.fechaVenta || 0) >= hoy);

  // Detectar vendedoras con muy pocas ventas registradas hoy
  const ventasPorUsuario: Record<string, number> = {};
  ventasHoy.forEach(v => {
    const uid = v.usuarioId || v.vendedora || 'desconocido';
    ventasPorUsuario[uid] = (ventasPorUsuario[uid] || 0) + 1;
  });

  // Detectar turno abierto por demasiadas horas (posible olvido de cierre)
  const cajaAbierta = localStorage.getItem('dp_caja_apertura_ts');
  if (cajaAbierta) {
    const apertura = new Date(cajaAbierta);
    const horasAbiertas = (Date.now() - apertura.getTime()) / 3600000;
    if (horasAbiertas > config.horasParaAlertaTurnoAbierto) {
      const alertasExistentes = getAlertas();
      const yaAlertado = alertasExistentes.some(
        a => a.tipo === 'turno_sin_cerrar' && new Date(a.fecha) >= hoy
      );
      if (!yaAlertado) {
        crearAlerta(
          'turno_sin_cerrar',
          'alta',
          '⏰ Turno sin cerrar',
          `La caja lleva ${Math.floor(horasAbiertas)} horas abierta sin cuadre. Verifica que la vendedora haya cerrado su turno correctamente.`,
          undefined,
          { horasAbiertas: Math.floor(horasAbiertas) }
        );
      }
    }
  }
}

// ── Mensaje del agente IA (análisis en lenguaje natural) ──────────
export function generarMensajeAgente(alertas: AlertaSeguridad[], cuadres: CuadreTurno[]): string {
  const criticas = alertas.filter(a => !a.leida && a.nivel === 'critica').length;
  const altas = alertas.filter(a => !a.leida && a.nivel === 'alta').length;
  const ultimoCuadre = cuadres[0];

  if (criticas > 0) {
    return `🚨 ATENCIÓN INMEDIATA: Hay ${criticas} alerta${criticas > 1 ? 's' : ''} crítica${criticas > 1 ? 's' : ''} sin revisar. Revisa el canal de seguridad ahora.`;
  }
  if (altas > 0) {
    return `⚠️ Hay ${altas} alerta${altas > 1 ? 's' : ''} importantes pendiente${altas > 1 ? 's' : ''} de revisión.`;
  }
  if (ultimoCuadre && ultimoCuadre.diferencia < -1000) {
    return `💰 El último cuadre de ${ultimoCuadre.usuarioNombre} tuvo un faltante de $${Math.abs(ultimoCuadre.diferencia).toLocaleString('es-CO')}.`;
  }
  return '✅ Todo en orden. Sin anomalías detectadas en las últimas 24 horas.';
}

// ── Gestión de Deudores Fugitivos ──────────────────────────────────
export function getDeudores(): ExpedienteDeudor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEUDORES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveDeudores(deudores: ExpedienteDeudor[]): void {
  localStorage.setItem(STORAGE_KEY_DEUDORES, JSON.stringify(deudores));
}

export function registrarDeudorFugitivo(deudor: Omit<ExpedienteDeudor, 'id' | 'fechaRegistro' | 'estado'>): ExpedienteDeudor {
  const nuevo: ExpedienteDeudor = {
    ...deudor,
    id: generateUUID(),
    fechaRegistro: new Date().toISOString(),
    estado: 'pendiente'
  };
  const todos = getDeudores();
  saveDeudores([nuevo, ...todos]);

  // Alerta en el canal
  crearAlerta(
    'deudor_retornado',
    'alta',
    `🚨 Nuevo expediente de fuga deudor: ${deudor.clienteNombre}`,
    `Se retiró sin pagar un monto de $${deudor.montoDeuda.toLocaleString('es-CO')}. Descripción: ${deudor.descripcionFisica}`,
    undefined,
    { idExpediente: nuevo.id, monto: deudor.montoDeuda }
  );

  return nuevo;
}

export function marcarDeudorRecuperado(id: string): void {
  const deudores = getDeudores().map(d => {
    if (d.id === id) {
      return { ...d, estado: 'recuperado' as const, fechaRecuperacion: new Date().toISOString() };
    }
    return d;
  });
  saveDeudores(deudores);
}

// ── Gestión de Incidentes de Personal (Fraude) ──────────────────────
export function getIncidentes(): IncidenteVendedor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INCIDENTES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveIncidentes(incidentes: IncidenteVendedor[]): void {
  localStorage.setItem(STORAGE_KEY_INCIDENTES, JSON.stringify(incidentes));
}

export function registrarIncidente(incidente: Omit<IncidenteVendedor, 'id' | 'fecha' | 'revisado'>): IncidenteVendedor {
  const nuevo: IncidenteVendedor = {
    ...incidente,
    id: generateUUID(),
    fecha: new Date().toISOString(),
    revisado: false
  };
  const todos = getIncidentes();
  saveIncidentes([nuevo, ...todos]);

  // Generar alerta crítica para el dueño
  crearAlerta(
    'fraude_empleado',
    'critica',
    `⚠️ Incidente de personal sospechoso — ${incidente.vendedorNombre}`,
    `${incidente.vendedorNombre} asociado a posible: ${incidente.tipoIncidente}. Detalle: ${incidente.descripcion}`,
    incidente.vendedorNombre,
    { idIncidente: nuevo.id, tipoIncidente: incidente.tipoIncidente }
  );

  return nuevo;
}

// ── Gestión de Logs de Actividad ───────────────────────────────────
export function getLogsActividad(): LogActividad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS_ACTIVIDAD);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveLogsActividad(logs: LogActividad[]): void {
  // Mantener solo los últimos 500 logs para evitar saturar el almacenamiento
  const trimmed = logs.slice(0, 500);
  localStorage.setItem(STORAGE_KEY_LOGS_ACTIVIDAD, JSON.stringify(trimmed));
}

export function registrarLogActividad(
  usuarioId: string,
  usuarioNombre: string,
  pantalla: string,
  accion: string,
  detalles?: string
): void {
  const nuevo: LogActividad = {
    id: generateUUID(),
    usuarioId,
    usuarioNombre,
    fecha: new Date().toISOString(),
    pantalla,
    accion,
    detalles
  };
  const todos = getLogsActividad();
  saveLogsActividad([nuevo, ...todos]);

  // Si es una acción crítica, evaluar posibles fraudes
  if (accion.includes('cancelar_orden') || accion.includes('eliminar_item')) {
    evaluarActividadSospechosa(usuarioId, usuarioNombre, accion, detalles);
  }
}

// ── Reglas Avanzadas de Auditoría y Control ─────────────────────────
export function verificarHorarioAcceso(): boolean {
  const config = getConfigSeguridad();
  if (!config.activado || !config.horariosRestringidos) return true;

  const ahora = new Date();
  const hora = ahora.getHours();
  const min = ahora.getMinutes();
  
  const parsearHora = (hStr: string) => {
    const parts = hStr.split(':');
    return { h: Number(parts[0] || 0), m: Number(parts[1] || 0) };
  };

  const inicio = parsearHora(config.horaInicioPermitida);
  const fin = parsearHora(config.horaFinPermitida);

  const minutosAhora = hora * 60 + min;
  const minutosInicio = inicio.h * 60 + inicio.m;
  const minutosFin = fin.h * 60 + fin.m;

  return minutosAhora >= minutosInicio && minutosAhora <= minutosFin;
}

export function evaluarActividadSospechosa(
  vendedorId: string,
  vendedorNombre: string,
  accion: string,
  detalles?: string
): void {
  const config = getConfigSeguridad();
  if (!config.activado) return;

  const logs = getLogsActividad();
  
  // Buscar cancelaciones sospechosas: 3 cancelaciones seguidas en menos de 10 minutos
  if (accion.includes('cancelar_orden')) {
    const diezMinutos = 10 * 60 * 1000;
    const ahora = Date.now();
    const cancelacionesRecientes = logs.filter(l => 
      l.usuarioId === vendedorId &&
      l.accion.includes('cancelar_orden') &&
      (ahora - new Date(l.fecha).getTime()) < diezMinutos
    );

    if (cancelacionesRecientes.length >= 3) {
      // Registrar incidente de forma automática
      const yaRegistrado = getIncidentes().some(i => 
        i.vendedorId === vendedorId &&
        i.tipoIncidente === 'cancelacion_sospechosa' &&
        (ahora - new Date(i.fecha).getTime()) < (60 * 60 * 1000) // una alerta por hora max
      );

      if (!yaRegistrado) {
        registrarIncidente({
          vendedorId,
          vendedorNombre,
          tipoIncidente: 'cancelacion_sospechosa',
          descripcion: `Se detectaron ${cancelacionesRecientes.length} órdenes canceladas consecutivamente en menos de 10 minutos. Posible despacho de productos sin facturar. Detalles: ${detalles || 'Sin detalles'}`
        });
      }
    }
  }
}

