/**
 * Rutas de reparto (ventas al mayor / tiendas).
 *
 * Modelo (2026-10-08):
 *  - Ruta: lista ordenada de tiendas (paradas) + días + horario + vendedor habitual.
 *  - Despacho: una salida concreta de un vendedor (qué carga, a quién deja, cuánto recoge,
 *    cuánto cobra, cuánto trae de regreso).
 *  - Parada: lo que pasó en una tienda en ese despacho (dejó / recogió / cobró / hora / quién recibió).
 *
 * Reglas de dinero:
 *  - Valor neto de una parada = dejado × precio − recogido × precio.
 *  - Lo que no se cobra en el momento (neto − cobrado) pasa a Créditos Clientes.
 *  - Recogido 'sobrante' vuelve al stock; 'cambio' y 'danado' son pérdida (se acredita a la tienda
 *    pero el costo del pan NO se recupera).
 *
 * Todo lo de este archivo es lógica pura (sin React) salvo el almacenamiento al final.
 */

export type ZonaRuta = 'ciudad' | 'municipio' | 'corregimiento';
export type MotivoRecogida = 'sobrante' | 'cambio' | 'danado';
export type MetodoCobro = 'efectivo' | 'nequi' | 'transferencia';
export type EstadoDespacho = 'cargado' | 'en_ruta' | 'liquidado';

export interface ParadaRuta {
    clienteId: string;
    clienteNombre: string;
    horario?: string; // 'HH:MM' en que normalmente se visita
}

export interface RutaReparto {
    id: string;
    nombre: string;
    zona: ZonaRuta;
    vendedor?: string;
    dias: number[]; // 0 = domingo … 6 = sábado
    horaSalida?: string; // 'HH:MM'
    paradas: ParadaRuta[];
    notas?: string;
    actualizadoEn: number;
}

export interface LineaCarga {
    productoId: string;
    nombre: string;
    cantidad: number;
    precioUnit: number;
    costoUnit: number;
}

export interface LineaParada {
    productoId: string;
    nombre: string;
    dejado: number;
    recogido: number;
    motivo: MotivoRecogida;
    precioUnit: number;
    costoUnit: number;
}

export interface ParadaDespacho {
    clienteId: string;
    clienteNombre: string;
    visitada: boolean;
    hora?: string; // 'HH:MM' en que realmente se dejó
    lineas: LineaParada[];
    cobrado: number;
    metodoCobro: MetodoCobro;
    recibidoPor?: string;
    nota?: string;
}

export interface LineaRegreso {
    productoId: string;
    buenos: number;
    danados: number;
}

export interface Despacho {
    id: string;
    fecha: string; // YYYY-MM-DD (local)
    vendedor: string;
    rutaId?: string;
    rutaNombre: string;
    estado: EstadoDespacho;
    horaSalida?: string;
    horaRegreso?: string;
    carga: LineaCarga[];
    paradas: ParadaDespacho[];
    regreso: LineaRegreso[];
    efectivoRecibido?: number;
    stockSalidaAplicado?: boolean;
    stockRegresoAplicado?: boolean;
    creditosRegistrados?: boolean;
    notas?: string;
    actualizadoEn: number;
}

export interface CatalogoLinea {
    productoId: string;
    nombre: string;
    categoria?: string;
    costo: number;
    precioMayorista: number;
    pvp: number;
}

export interface ClienteRef {
    id: string;
    nombre: string;
    margenPersonalizado?: number;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
}

export interface ConfigMargenes {
    margenNegocio: number;
    margenRevendedor: number;
}

const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};
const redondear = (v: number) => Math.round(v * 100) / 100;

export function fechaLocal(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export function horaLocal(d: Date = new Date()): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function diasEntre(a: string, b: string): number {
    const da = new Date(a + 'T00:00:00').getTime();
    const db = new Date(b + 'T00:00:00').getTime();
    return Math.round((db - da) / 86400000);
}

export const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─────────────────────────────────────────────────────────────────────────────
// Resumen de UN despacho (conteo, cuadre de pan y de plata)
// ─────────────────────────────────────────────────────────────────────────────

export interface FilaCuadre {
    productoId: string;
    nombre: string;
    cargado: number;
    dejado: number;
    recogido: number;
    esperadoRegreso: number; // cargado − dejado + recogido
    reportado: number; // buenos + dañados
    diferencia: number; // esperado − reportado (>0 = falta pan)
    precioUnit: number;
    costoUnit: number;
}

export interface ResumenDespacho {
    filas: FilaCuadre[];
    totalCargado: number;
    totalDejado: number;
    totalRecogido: number;
    totalEsperadoRegreso: number;
    totalReportado: number;
    faltanteUnidades: number;
    sobranteUnidades: number;
    faltanteValor: number; // a precio de venta
    valorCargado: number;
    ventaBruta: number;
    devolucionesValor: number;
    ventaNeta: number;
    cobradoEfectivo: number;
    cobradoOtros: number;
    porCobrarCredito: number;
    efectivoDiferencia: number | null; // recibido − esperado (null si aún no se contó)
    tiendasVisitadas: number;
    tiendasTotal: number;
    sinEntregar: number; // pan que sigue sin dejarse (cargado − dejado)
}

export function netoParada(p: ParadaDespacho): number {
    return p.lineas.reduce((s, l) => s + (n(l.dejado) - n(l.recogido)) * n(l.precioUnit), 0);
}

export function creditoParada(p: ParadaDespacho): number {
    return Math.max(0, redondear(netoParada(p) - n(p.cobrado)));
}

/** Tope duro de devolución al liquidar: recogido ≤ 15% de lo dejado (por tienda/parada del despacho). */
export const TOPE_DEVOLUCION_PCT = 15;

export interface InfraccionTopeDevolucion {
    clienteId: string;
    clienteNombre: string;
    dejado: number;
    recogido: number;
    pct: number;
    maxRecogido: number;
}

/** Unidades dejadas / recogidas de una parada. */
export function unidadesParada(p: ParadaDespacho): { dejado: number; recogido: number } {
    let dejado = 0;
    let recogido = 0;
    for (const l of p.lineas) {
        dejado += n(l.dejado);
        recogido += n(l.recogido);
    }
    return { dejado, recogido };
}

/** Máximo de unidades que se pueden recoger sin pasar el tope (piso entero). */
export function maxRecogidoPermitido(dejado: number, topePct = TOPE_DEVOLUCION_PCT): number {
    if (dejado <= 0) return 0;
    return Math.floor((dejado * topePct) / 100);
}

/**
 * Tiendas del despacho que superan el tope de devolución.
 * Criterio: por parada (tienda), % = unidades recogidas / unidades dejadas.
 * Coherente con `analizarTienda.pctDevolucion` (no usa la carga total del camión).
 */
export function infraccionesTopeDevolucion(d: Despacho, topePct = TOPE_DEVOLUCION_PCT): InfraccionTopeDevolucion[] {
    const out: InfraccionTopeDevolucion[] = [];
    for (const p of d.paradas) {
        const { dejado, recogido } = unidadesParada(p);
        if (dejado <= 0 && recogido <= 0) continue;
        const maxRecogido = maxRecogidoPermitido(dejado, topePct);
        if (recogido <= maxRecogido) continue;
        const pct = dejado > 0 ? (recogido / dejado) * 100 : 100;
        out.push({
            clienteId: p.clienteId,
            clienteNombre: p.clienteNombre || 'Tienda',
            dejado,
            recogido,
            pct,
            maxRecogido,
        });
    }
    return out;
}

/** Mensaje corto en español si hay infracciones; null si todo ok. */
export function mensajeTopeDevolucion(infracciones: InfraccionTopeDevolucion[], topePct = TOPE_DEVOLUCION_PCT): string | null {
    if (infracciones.length === 0) return null;
    const detalle = infracciones
        .slice(0, 3)
        .map(i => `${i.clienteNombre}: ${i.recogido} de ${i.dejado} (${i.pct.toFixed(0)}%, máx. ${i.maxRecogido})`)
        .join(' · ');
    const mas = infracciones.length > 3 ? ` · y ${infracciones.length - 3} más` : '';
    return `No se puede liquidar: la devolución no puede pasar del ${topePct}% de lo dejado por tienda. ${detalle}${mas}. Baja lo recogido o deja más pan.`;
}

export function resumenDespacho(d: Despacho): ResumenDespacho {
    const mapa = new Map<string, FilaCuadre>();
    const fila = (id: string, nombre: string, precio: number, costo: number): FilaCuadre => {
        let f = mapa.get(id);
        if (!f) {
            f = {
                productoId: id, nombre, cargado: 0, dejado: 0, recogido: 0, esperadoRegreso: 0,
                reportado: 0, diferencia: 0, precioUnit: precio, costoUnit: costo,
            };
            mapa.set(id, f);
        }
        return f;
    };

    for (const c of d.carga) {
        const f = fila(c.productoId, c.nombre, n(c.precioUnit), n(c.costoUnit));
        f.cargado += n(c.cantidad);
        f.precioUnit = n(c.precioUnit);
        f.costoUnit = n(c.costoUnit);
    }
    for (const p of d.paradas) {
        for (const l of p.lineas) {
            const f = fila(l.productoId, l.nombre, n(l.precioUnit), n(l.costoUnit));
            f.dejado += n(l.dejado);
            f.recogido += n(l.recogido);
        }
    }
    for (const r of d.regreso) {
        const f = mapa.get(r.productoId);
        if (f) f.reportado += n(r.buenos) + n(r.danados);
    }

    const filas = Array.from(mapa.values()).map(f => {
        const esperado = f.cargado - f.dejado + f.recogido;
        return { ...f, esperadoRegreso: esperado, diferencia: esperado - f.reportado };
    });

    const regresoContado = d.regreso.length > 0;
    let faltanteUnidades = 0;
    let sobranteUnidades = 0;
    let faltanteValor = 0;
    if (regresoContado) {
        for (const f of filas) {
            if (f.diferencia > 0) {
                faltanteUnidades += f.diferencia;
                faltanteValor += f.diferencia * f.precioUnit;
            } else if (f.diferencia < 0) {
                sobranteUnidades += -f.diferencia;
            }
        }
    }

    let ventaBruta = 0;
    let devolucionesValor = 0;
    let cobradoEfectivo = 0;
    let cobradoOtros = 0;
    let porCobrarCredito = 0;
    for (const p of d.paradas) {
        for (const l of p.lineas) {
            ventaBruta += n(l.dejado) * n(l.precioUnit);
            devolucionesValor += n(l.recogido) * n(l.precioUnit);
        }
        if (p.metodoCobro === 'efectivo') cobradoEfectivo += n(p.cobrado);
        else cobradoOtros += n(p.cobrado);
        porCobrarCredito += creditoParada(p);
    }

    const totalCargado = filas.reduce((s, f) => s + f.cargado, 0);
    const totalDejado = filas.reduce((s, f) => s + f.dejado, 0);
    const totalRecogido = filas.reduce((s, f) => s + f.recogido, 0);
    const totalEsperadoRegreso = filas.reduce((s, f) => s + f.esperadoRegreso, 0);
    const totalReportado = filas.reduce((s, f) => s + f.reportado, 0);

    return {
        filas,
        totalCargado,
        totalDejado,
        totalRecogido,
        totalEsperadoRegreso,
        totalReportado,
        faltanteUnidades,
        sobranteUnidades,
        faltanteValor: redondear(faltanteValor),
        valorCargado: redondear(d.carga.reduce((s, c) => s + n(c.cantidad) * n(c.precioUnit), 0)),
        ventaBruta: redondear(ventaBruta),
        devolucionesValor: redondear(devolucionesValor),
        ventaNeta: redondear(ventaBruta - devolucionesValor),
        cobradoEfectivo: redondear(cobradoEfectivo),
        cobradoOtros: redondear(cobradoOtros),
        porCobrarCredito: redondear(porCobrarCredito),
        efectivoDiferencia: d.efectivoRecibido === undefined ? null : redondear(n(d.efectivoRecibido) - cobradoEfectivo),
        tiendasVisitadas: d.paradas.filter(p => p.visitada).length,
        tiendasTotal: d.paradas.length,
        sinEntregar: totalCargado - totalDejado,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis por tienda
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductoTienda {
    productoId: string;
    nombre: string;
    dejado: number;
    recogido: number;
    neto: number;
    pctDevolucion: number;
}

export interface AnalisisTienda {
    clienteId: string;
    nombre: string;
    visitas: number;
    ultimaVisita?: string;
    diasSinVisita?: number;
    intervaloPromedioDias?: number;
    unidadesDejadas: number;
    unidadesRecogidas: number;
    unidadesVendidas: number;
    pctDevolucion: number;
    ventaBruta: number;
    devolucionesValor: number;
    ventaNeta: number;
    utilidadNegocio: number;
    margenNegocioPct: number; // utilidad / venta neta
    perdidaPorCambiosYDanos: number; // costo del pan que no se recupera
    margenTiendaPct: number; // % de ganancia sobre lo que paga (markup de reventa)
    gananciaTienda: number;
    rendimientoTiendaPct: number; // ganancia real de la tienda / lo que invirtió en pan dejado
    deudaPendiente: number;
    tendencia: 'sube' | 'baja' | 'estable' | 'nueva';
    cambioTendenciaPct: number;
    productos: ProductoTienda[];
    semaforo: 'verde' | 'amarillo' | 'rojo';
    estrategias: string[];
}

export interface OpcionesAnalisis {
    hoy?: string;
    config: ConfigMargenes;
    deudas?: Record<string, number>;
}

interface Visita {
    fecha: string;
    neto: number;
    lineas: LineaParada[];
}

function recogerVisitas(despachos: Despacho[]): Map<string, { nombre: string; visitas: Visita[] }> {
    const porCliente = new Map<string, { nombre: string; visitas: Visita[] }>();
    const ordenados = [...despachos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const d of ordenados) {
        for (const p of d.paradas) {
            if (!p.visitada) continue;
            const e = porCliente.get(p.clienteId) || { nombre: p.clienteNombre, visitas: [] };
            e.nombre = p.clienteNombre || e.nombre;
            e.visitas.push({ fecha: d.fecha, neto: netoParada(p), lineas: p.lineas });
            porCliente.set(p.clienteId, e);
        }
    }
    return porCliente;
}

export function analizarTienda(
    clienteId: string,
    nombre: string,
    visitas: Visita[],
    cliente: ClienteRef | undefined,
    opts: OpcionesAnalisis,
): AnalisisTienda {
    const hoy = opts.hoy || fechaLocal();
    const mr = n(cliente?.margenPersonalizado ?? opts.config.margenRevendedor);

    let dejadas = 0, recogidas = 0, bruta = 0, devValor = 0, costoDejado = 0, costoRecuperado = 0, perdida = 0;
    let invertido = 0;
    const porProducto = new Map<string, ProductoTienda>();

    for (const v of visitas) {
        for (const l of v.lineas) {
            const d = n(l.dejado), r = n(l.recogido), pu = n(l.precioUnit), cu = n(l.costoUnit);
            dejadas += d; recogidas += r;
            bruta += d * pu; devValor += r * pu;
            costoDejado += d * cu;
            if (l.motivo === 'sobrante') costoRecuperado += r * cu;
            else perdida += r * cu;
            invertido += d * pu;
            const pr = porProducto.get(l.productoId) || { productoId: l.productoId, nombre: l.nombre, dejado: 0, recogido: 0, neto: 0, pctDevolucion: 0 };
            pr.dejado += d; pr.recogido += r;
            porProducto.set(l.productoId, pr);
        }
    }
    for (const pr of porProducto.values()) {
        pr.neto = Math.max(0, pr.dejado - pr.recogido);
        pr.pctDevolucion = pr.dejado > 0 ? (pr.recogido / pr.dejado) * 100 : 0;
    }
    const ventaNeta = bruta - devValor;
    // ganancia de la tienda: lo que realmente vendió × su margen sobre lo que pagó
    const gananciaTienda = Math.max(0, ventaNeta) * (mr / 100);

    const costoNeto = costoDejado - costoRecuperado;
    const utilidad = ventaNeta - costoNeto;
    const margenNegocio = ventaNeta > 0 ? (utilidad / ventaNeta) * 100 : 0;
    const pctDev = dejadas > 0 ? (recogidas / dejadas) * 100 : 0;
    const rendimiento = invertido > 0 ? (gananciaTienda / invertido) * 100 : 0;

    // fechas / frecuencia
    const fechas = Array.from(new Set(visitas.map(v => v.fecha))).sort();
    const ultima = fechas[fechas.length - 1];
    let intervalo: number | undefined;
    if (fechas.length >= 2) {
        let suma = 0;
        for (let i = 1; i < fechas.length; i++) suma += diasEntre(fechas[i - 1], fechas[i]);
        intervalo = suma / (fechas.length - 1);
    }
    const diasSin = ultima ? diasEntre(ultima, hoy) : undefined;

    // tendencia: últimas 2 visitas vs 2 anteriores (por valor neto)
    let tendencia: AnalisisTienda['tendencia'] = 'nueva';
    let cambio = 0;
    if (visitas.length >= 3) {
        const netos = visitas.map(v => v.neto);
        const ult = netos.slice(-2);
        const prev = netos.slice(Math.max(0, netos.length - 4), netos.length - 2);
        const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
        const aU = avg(ult), aP = avg(prev);
        if (aP > 0) {
            cambio = ((aU - aP) / aP) * 100;
            tendencia = cambio >= 10 ? 'sube' : cambio <= -10 ? 'baja' : 'estable';
        } else tendencia = 'estable';
    }

    const deuda = n(opts.deudas?.[clienteId]);
    const productos = Array.from(porProducto.values()).sort((a, b) => b.neto - a.neto);

    // ── Estrategias ────────────────────────────────────────────────────────
    const est: string[] = [];
    let puntos = 0; // sube con cada alerta
    if (visitas.length === 0) {
        est.push('Aún no hay visitas registradas. Haz el primer despacho a esta tienda para empezar a medir.');
    } else {
        if (pctDev >= 25) {
            est.push(`Devuelven ${pctDev.toFixed(0)}% de lo que se deja: baja la carga ~${Math.min(40, Math.round(pctDev * 0.8))}% y deja solo lo que rota.`);
            puntos += 2;
        } else if (pctDev >= 12) {
            est.push(`Devolución moderada (${pctDev.toFixed(0)}%). Ajusta las cantidades de los productos que más regresan.`);
            puntos += 1;
        } else if (visitas.length >= 2 && pctDev <= 3) {
            est.push('Casi no devuelven nada: probablemente se queda sin pan. Sube la carga ~15% o visítalos más seguido.');
        }
        if (ventaNeta > 0 && margenNegocio < 12) {
            est.push(`Al negocio le queda solo ${margenNegocio.toFixed(1)}% de utilidad en esta tienda. Revisa precio o reduce cambios/daños.`);
            puntos += 2;
        } else if (utilidad < 0) {
            est.push('En esta tienda se está perdiendo plata (cambios y daños se comen la utilidad). Corrige antes de seguir dejando.');
            puntos += 3;
        }
        if (mr < 15) {
            est.push(`La tienda gana solo ${mr.toFixed(0)}% sobre lo que paga: riesgo de que deje de comprar. Mira si puedes darle 15–25% sin perder.`);
            puntos += 1;
        } else if (mr > 35 && margenNegocio < 20) {
            est.push(`La tienda gana ${mr.toFixed(0)}% y a ti te queda poco (${margenNegocio.toFixed(0)}%). Estás cediendo demasiado margen.`);
            puntos += 1;
        }
        if (perdida > 0 && costoDejado > 0 && perdida / costoDejado > 0.08) {
            est.push(`Cambios y daños cuestan ${Math.round((perdida / costoDejado) * 100)}% de lo producido para esta tienda. Entrega más fresco y menos cantidad.`);
            puntos += 1;
        }
        if (intervalo !== undefined && diasSin !== undefined && diasSin > Math.max(2, intervalo * 1.5)) {
            est.push(`Llevas ${diasSin} días sin visitarla (lo normal es cada ${intervalo.toFixed(1)}). Visítala pronto o se enfría.`);
            puntos += 1;
        } else if (intervalo === undefined && diasSin !== undefined && diasSin >= 7) {
            est.push(`Hace ${diasSin} días no se visita esta tienda.`);
            puntos += 1;
        }
        if (tendencia === 'baja') {
            est.push(`Las ventas netas bajaron ${Math.abs(cambio).toFixed(0)}%. Pregunta qué pasó: ¿competencia, producto, atención?`);
            puntos += 1;
        } else if (tendencia === 'sube') {
            est.push(`Las ventas subieron ${cambio.toFixed(0)}%. Buen momento para ofrecer un producto nuevo.`);
        }
        if (deuda > 0) {
            est.push(`Debe ${Math.round(deuda).toLocaleString('es-CO')} en Créditos: cobra antes de dejar más.`);
            puntos += deuda > ventaNeta * 0.5 && ventaNeta > 0 ? 2 : 1;
        }
        const estrella = productos.find(p => p.dejado >= 5 && p.pctDevolucion <= 5);
        if (estrella) est.push(`Producto fuerte: ${estrella.nombre} casi no regresa. Ofrece más de ese.`);
        const problema = [...productos].filter(p => p.dejado >= 5 && p.pctDevolucion >= 30).sort((a, b) => b.pctDevolucion - a.pctDevolucion)[0];
        if (problema) est.push(`${problema.nombre} regresa ${problema.pctDevolucion.toFixed(0)}%: deja menos o cámbialo por otro.`);
        if (est.length === 0) est.push('Tienda sana: mantén la carga y la frecuencia. Prueba ofrecer un producto nuevo para crecer.');
    }

    const semaforo: AnalisisTienda['semaforo'] = puntos >= 3 ? 'rojo' : puntos >= 1 ? 'amarillo' : 'verde';

    return {
        clienteId,
        nombre,
        visitas: visitas.length,
        ultimaVisita: ultima,
        diasSinVisita: diasSin,
        intervaloPromedioDias: intervalo,
        unidadesDejadas: dejadas,
        unidadesRecogidas: recogidas,
        unidadesVendidas: Math.max(0, dejadas - recogidas),
        pctDevolucion: pctDev,
        ventaBruta: redondear(bruta),
        devolucionesValor: redondear(devValor),
        ventaNeta: redondear(ventaNeta),
        utilidadNegocio: redondear(utilidad),
        margenNegocioPct: margenNegocio,
        perdidaPorCambiosYDanos: redondear(perdida),
        margenTiendaPct: mr,
        gananciaTienda: redondear(gananciaTienda),
        rendimientoTiendaPct: rendimiento,
        deudaPendiente: deuda,
        tendencia,
        cambioTendenciaPct: cambio,
        productos,
        semaforo,
        estrategias: est,
    };
}

export function analizarTiendas(despachos: Despacho[], clientes: ClienteRef[], opts: OpcionesAnalisis): AnalisisTienda[] {
    const mapa = recogerVisitas(despachos);
    const porId = new Map(clientes.map(c => [c.id, c]));
    const out: AnalisisTienda[] = [];
    for (const [id, e] of mapa.entries()) {
        out.push(analizarTienda(id, porId.get(id)?.nombre || e.nombre, e.visitas, porId.get(id), opts));
    }
    return out.sort((a, b) => b.utilidadNegocio - a.utilidadNegocio);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sugerencia de carga por rotación
// ─────────────────────────────────────────────────────────────────────────────

export interface SugerenciaCarga {
    productoId: string;
    nombre: string;
    cantidad: number;
    motivo: string;
}

/**
 * Para cada producto que ya se le ha dejado a la tienda, sugiere cuánto llevar según lo que
 * realmente rotó en las últimas visitas (promedio de ventas netas por visita).
 *  - devuelve mucho (≥25%): sugiere el promedio vendido, sin colchón.
 *  - casi no devuelve (≤5%): promedio + 15% (se queda sin pan).
 *  - normal: promedio + 5%.
 */
export function sugerirCargaTienda(despachos: Despacho[], clienteId: string, ultimasVisitas = 3): SugerenciaCarga[] {
    const visitas = recogerVisitas(despachos).get(clienteId)?.visitas.slice(-ultimasVisitas) || [];
    if (visitas.length === 0) return [];
    const acum = new Map<string, { nombre: string; dejado: number; recogido: number }>();
    for (const v of visitas) {
        for (const l of v.lineas) {
            const a = acum.get(l.productoId) || { nombre: l.nombre, dejado: 0, recogido: 0 };
            a.dejado += n(l.dejado);
            a.recogido += n(l.recogido);
            acum.set(l.productoId, a);
        }
    }
    const out: SugerenciaCarga[] = [];
    for (const [productoId, a] of acum.entries()) {
        const vendidoPromedio = Math.max(0, a.dejado - a.recogido) / visitas.length;
        const pct = a.dejado > 0 ? (a.recogido / a.dejado) * 100 : 0;
        let factor = 1.05;
        let motivo = 'según lo que rota';
        if (pct >= 25) { factor = 1; motivo = `devuelven ${pct.toFixed(0)}%: sin colchón`; }
        else if (pct <= 5 && a.dejado > 0) { factor = 1.15; motivo = 'casi no devuelven: sube 15%'; }
        const cantidad = Math.ceil(vendidoPromedio * factor);
        if (cantidad > 0) out.push({ productoId, nombre: a.nombre, cantidad, motivo });
    }
    return out.sort((x, y) => y.cantidad - x.cantidad);
}

// ─────────────────────────────────────────────────────────────────────────────
// Control del vendedor
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalisisVendedor {
    vendedor: string;
    despachos: number;
    liquidados: number;
    unidadesCargadas: number;
    unidadesDejadas: number;
    unidadesFaltantes: number;
    valorFaltante: number;
    descuadreEfectivo: number; // suma de (recibido − esperado); negativo = faltó plata
    tiendasVisitadas: number;
    alertas: string[];
}

export function analizarVendedores(despachos: Despacho[]): AnalisisVendedor[] {
    const mapa = new Map<string, AnalisisVendedor>();
    for (const d of despachos) {
        const key = (d.vendedor || 'Sin vendedor').trim() || 'Sin vendedor';
        const a = mapa.get(key) || {
            vendedor: key, despachos: 0, liquidados: 0, unidadesCargadas: 0, unidadesDejadas: 0,
            unidadesFaltantes: 0, valorFaltante: 0, descuadreEfectivo: 0, tiendasVisitadas: 0, alertas: [],
        };
        const r = resumenDespacho(d);
        a.despachos += 1;
        if (d.estado === 'liquidado') {
            a.liquidados += 1;
            a.unidadesFaltantes += r.faltanteUnidades;
            a.valorFaltante += r.faltanteValor;
            if (r.efectivoDiferencia !== null) a.descuadreEfectivo += r.efectivoDiferencia;
        }
        a.unidadesCargadas += r.totalCargado;
        a.unidadesDejadas += r.totalDejado;
        a.tiendasVisitadas += r.tiendasVisitadas;
        mapa.set(key, a);
    }
    for (const a of mapa.values()) {
        a.valorFaltante = redondear(a.valorFaltante);
        a.descuadreEfectivo = redondear(a.descuadreEfectivo);
        if (a.unidadesFaltantes > 0) a.alertas.push(`Faltaron ${a.unidadesFaltantes} unidades (${Math.round(a.valorFaltante).toLocaleString('es-CO')}) en los conteos de regreso.`);
        if (a.descuadreEfectivo < 0) a.alertas.push(`Entregó ${Math.round(-a.descuadreEfectivo).toLocaleString('es-CO')} menos de lo cobrado.`);
    }
    return Array.from(mapa.values()).sort((x, y) => y.unidadesDejadas - x.unidadesDejadas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapa: enlace de Google Maps con las paradas en orden
// ─────────────────────────────────────────────────────────────────────────────

export function enlaceRutaMaps(clientes: ClienteRef[]): string | null {
    const puntos = clientes
        .map(c => [c.direccion, c.ciudad].filter(Boolean).join(', ').trim() || '')
        .filter(Boolean);
    if (puntos.length === 0) return null;
    return 'https://www.google.com/maps/dir/' + puntos.map(p => encodeURIComponent(p)).join('/');
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de despacho a partir de una ruta
// ─────────────────────────────────────────────────────────────────────────────

export function nuevoParada(c: { id: string; nombre: string }): ParadaDespacho {
    return { clienteId: c.id, clienteNombre: c.nombre, visitada: false, lineas: [], cobrado: 0, metodoCobro: 'efectivo' };
}

/** Pone en las paradas una línea por cada producto cargado (para llenar rápido dejado/recogido). */
export function sincronizarLineasConCarga(d: Despacho): Despacho {
    const paradas = d.paradas.map(p => {
        const lineas = [...p.lineas];
        for (const c of d.carga) {
            if (!lineas.some(l => l.productoId === c.productoId)) {
                lineas.push({
                    productoId: c.productoId, nombre: c.nombre, dejado: 0, recogido: 0, motivo: 'sobrante',
                    precioUnit: c.precioUnit, costoUnit: c.costoUnit,
                });
            }
        }
        return { ...p, lineas };
    });
    return { ...d, paradas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Almacenamiento (localStorage + respaldo en la nube vía db.saveBackup)
// ─────────────────────────────────────────────────────────────────────────────

const LS_RUTAS = 'dp_rutas_reparto';
const LS_DESPACHOS = 'dp_despachos_reparto';
const CLOUD_RUTAS = 'rutas_reparto_rutas';
const CLOUD_DESPACHOS = 'rutas_reparto_despachos';

function leerLS<T>(key: string): T[] {
    try {
        const v = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

export function mezclarPorId<T extends { id: string; actualizadoEn?: number }>(a: T[], b: T[]): T[] {
    const m = new Map<string, T>();
    for (const x of [...a, ...b]) {
        if (!x || !x.id) continue;
        const prev = m.get(x.id);
        if (!prev || n(x.actualizadoEn) >= n(prev.actualizadoEn)) m.set(x.id, x);
    }
    return Array.from(m.values());
}

export const cargarRutasLocal = (): RutaReparto[] => leerLS<RutaReparto>(LS_RUTAS);
export const cargarDespachosLocal = (): Despacho[] => leerLS<Despacho>(LS_DESPACHOS);

export interface DbRespaldo {
    getBackup(key: string): Promise<any>;
    saveBackup(key: string, val: any): Promise<void>;
}

export async function cargarDesdeNube(dbx: DbRespaldo): Promise<{ rutas: RutaReparto[]; despachos: Despacho[] }> {
    let rutas = cargarRutasLocal();
    let despachos = cargarDespachosLocal();
    try {
        const r = await dbx.getBackup(CLOUD_RUTAS);
        if (Array.isArray(r)) rutas = mezclarPorId(rutas, r);
    } catch { /* sin nube */ }
    try {
        const d = await dbx.getBackup(CLOUD_DESPACHOS);
        if (Array.isArray(d)) despachos = mezclarPorId(despachos, d);
    } catch { /* sin nube */ }
    try { localStorage.setItem(LS_RUTAS, JSON.stringify(rutas)); } catch { /* lleno */ }
    try { localStorage.setItem(LS_DESPACHOS, JSON.stringify(despachos)); } catch { /* lleno */ }
    return { rutas, despachos };
}

export function guardarRutas(dbx: DbRespaldo | null, rutas: RutaReparto[]) {
    try { localStorage.setItem(LS_RUTAS, JSON.stringify(rutas)); } catch { /* lleno */ }
    if (dbx && rutas.length > 0) dbx.saveBackup(CLOUD_RUTAS, rutas).catch(() => {});
}

export function guardarDespachos(dbx: DbRespaldo | null, despachos: Despacho[]) {
    try { localStorage.setItem(LS_DESPACHOS, JSON.stringify(despachos)); } catch { /* lleno */ }
    if (dbx && despachos.length > 0) dbx.saveBackup(CLOUD_DESPACHOS, despachos).catch(() => {});
}
