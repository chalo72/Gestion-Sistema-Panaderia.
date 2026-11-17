/**
 * Vigía de cuadres. Compara el último día cerrado con el mismo día de la semana
 * y dice si la baja es de ese día, si falta un cierre, o si una caja se cayó sola.
 */
import { ymdLocal, hoyLocal } from '@/lib/fecha-local';

export type NivelVigia = 'ok' | 'ojo' | 'bajon';

export type CajaVigia = {
    nombre: string;
    monto: number;
    referencia: number;
    muestras: number;
};

export type InformeVigia = {
    nivel: NivelVigia;
    titulo: string;
    detalle: string;
    dia: string;
    nombreDia: string;
    total: number;
    referencia: number;
    muestras: number;
    cajas: CajaVigia[];
    textoParaAgente: string;
};

type SesionCaja = {
    fechaApertura?: string;
    cajaNombre?: string;
    estado?: string;
    totalVentas?: number;
    montoCierre?: number | null;
    montoApertura?: number;
    movimientos?: { tipo?: string; monto?: number }[];
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const plataDeCuadre = (s: SesionCaja): number => {
    const anotado = Number(s?.totalVentas) || 0;
    if (anotado > 0) return anotado;
    if (s?.estado !== 'cerrada' || s?.montoCierre == null) return 0;
    const movs = Array.isArray(s.movimientos) ? s.movimientos : [];
    const entradas = movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const salidas = movs.filter(m => m.tipo === 'salida').reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const delta = Math.round((Number(s.montoCierre) || 0) - (Number(s.montoApertura) || 0) - entradas + salidas);
    return delta > 0 ? delta : 0;
};

const mediana = (nums: number[]): number => {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const diaDe = (fecha: string) => new Date(`${fecha}T12:00:00`).getDay();

const pesos = (n: number) => Math.round(n).toLocaleString('es-CO');

export function vigilarCuadres(sesiones: SesionCaja[] | null | undefined, hoy = hoyLocal()): InformeVigia {
    const vacio: InformeVigia = {
        nivel: 'ojo',
        titulo: 'Todavía no hay cuadres para vigilar',
        detalle: 'Cuando cierres las cajas, aquí se compara ese día con los mismos días de las semanas pasadas.',
        dia: hoy,
        nombreDia: DIAS[diaDe(hoy)],
        total: 0,
        referencia: 0,
        muestras: 0,
        cajas: [],
        textoParaAgente: 'No hay cuadres cerrados para comparar.',
    };

    const desde = new Date(`${hoy}T12:00:00`);
    desde.setDate(desde.getDate() - 56);
    const desdeStr = ymdLocal(desde);

    type Dia = { fecha: string; total: number; cajas: Map<string, number>; abiertas: number; cerradas: number };
    const porFecha = new Map<string, Dia>();
    (Array.isArray(sesiones) ? sesiones : []).forEach(s => {
        const fecha = ymdLocal(s?.fechaApertura);
        if (!fecha || fecha < desdeStr || fecha > hoy) return;
        const dia = porFecha.get(fecha) || { fecha, total: 0, cajas: new Map(), abiertas: 0, cerradas: 0 };
        const monto = plataDeCuadre(s);
        const nombre = (s?.cajaNombre || 'Caja').trim() || 'Caja';
        if (s?.estado === 'cerrada') dia.cerradas += 1;
        else dia.abiertas += 1;
        if (monto > 0) {
            dia.total += monto;
            dia.cajas.set(nombre, (dia.cajas.get(nombre) || 0) + monto);
        }
        porFecha.set(fecha, dia);
    });

    const dias = Array.from(porFecha.values()).filter(d => d.total > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!dias.length) return vacio;

    const hoyDia = porFecha.get(hoy);
    const juzgarHoy = !!hoyDia && hoyDia.total > 0;
    const dia = juzgarHoy ? hoyDia! : [...dias].reverse().find(d => d.fecha < hoy) || dias[dias.length - 1];
    const nombreDia = DIAS[diaDe(dia.fecha)];
    const otrosMismoDia = dias
        .filter(d => d.fecha < dia.fecha && diaDe(d.fecha) === diaDe(dia.fecha))
        .slice(-4);
    const referencia = mediana(otrosMismoDia.map(d => d.total));
    const muestras = otrosMismoDia.length;
    const todosRecientes = dias.filter(d => d.fecha < dia.fecha).slice(-21);
    const medianaGeneral = mediana(todosRecientes.map(d => d.total));
    const cajasTipicas = mediana(otrosMismoDia.map(d => d.cajas.size));

    const cajas: CajaVigia[] = Array.from(dia.cajas.entries()).map(([nombre, monto]) => {
        const refs = otrosMismoDia.map(d => d.cajas.get(nombre) || 0).filter(n => n > 0);
        return { nombre, monto, referencia: mediana(refs), muestras: refs.length };
    }).sort((a, b) => b.monto - a.monto);

    const faltanCajas = muestras >= 2 && cajasTipicas >= 2 && dia.cajas.size <= cajasTipicas - 1;
    const diaSueleSerBajo = muestras >= 2 && medianaGeneral > 0 && referencia < medianaGeneral * 0.82;
    const cayo = muestras >= 2 && referencia > 0 && dia.total < referencia * 0.72;
    const cajasCaidas = cajas.filter(c => c.muestras >= 2 && c.referencia > 0 && c.monto < c.referencia * 0.65);
    const cajasFirmes = cajas.filter(c => c.muestras >= 2 && c.referencia > 0 && c.monto >= c.referencia * 0.85);

    let nivel: NivelVigia = 'ok';
    let titulo = `El ${nombreDia} va parecido a los otros`;
    let detalle = `Este ${nombreDia} va en ${pesos(dia.total)}. Los ${nombreDia} recientes andaban por ${pesos(referencia)}.`;

    if (muestras < 2) {
        nivel = 'ojo';
        titulo = 'Todavía hay pocos días para comparar';
        detalle = `Este ${nombreDia} va en ${pesos(dia.total)}. Hacen falta más ${nombreDia} cerrados para saber si una baja es normal.`;
    } else if ((dia.abiertas > 0 || faltanCajas) && dia.total < referencia * 0.9) {
        nivel = 'ojo';
        titulo = 'Falta cierre. Todavía no es un bajón';
        detalle = dia.abiertas > 0
            ? `Hay caja abierta. Lo vendido hasta el último cuadre es ${pesos(dia.total)}. Cuando cierres la noche, se vuelve a mirar.`
            : `Cerraron ${dia.cajas.size} cajas y un ${nombreDia} suele traer cerca de ${Math.round(cajasTipicas)}. Puede faltar un cuadre, no que se haya vendido menos.`;
    } else if (cayo && cajasCaidas.length === 1 && cajasFirmes.length >= 1) {
        nivel = 'bajon';
        titulo = `Bajó ${cajasCaidas[0].nombre}. Las otras aguantaron`;
        detalle = `${cajasCaidas[0].nombre} va en ${pesos(cajasCaidas[0].monto)} y en otros ${nombreDia} andaba por ${pesos(cajasCaidas[0].referencia)}. Revisa si esa caja no abrió o si de verdad se vendió menos ahí.`;
    } else if (cayo) {
        nivel = 'bajon';
        titulo = `Bajón del local en este ${nombreDia}`;
        detalle = `Van ${pesos(dia.total)} y los otros ${nombreDia} andaban por ${pesos(referencia)}. Bajó el local entero, no una sola caja. Mira si faltó pan, si llovió o si el barrio estuvo quieto.`;
    } else if (diaSueleSerBajo) {
        nivel = 'ok';
        titulo = `El ${nombreDia} suele vender menos, y hoy está en ese rango`;
        detalle = `Van ${pesos(dia.total)}. Un ${nombreDia} anda por ${pesos(referencia)}, por debajo de otros días.`;
    }

    if (!juzgarHoy && nivel !== 'ojo') {
        detalle += ` El día que se miró es ${dia.fecha}, porque hoy todavía no tiene cuadre con ventas.`;
    }

    const lineasCaja = cajas.map(c =>
        `${c.nombre}: ${pesos(c.monto)}${c.muestras >= 2 ? ` (otros ${nombreDia}: ${pesos(c.referencia)})` : ''}`
    ).join('. ');
    const textoParaAgente = [
        `Día mirado: ${dia.fecha} (${nombreDia}).`,
        `Ventas de los cuadres: ${pesos(dia.total)}.`,
        `Referencia de otros ${nombreDia}: ${pesos(referencia)} con ${muestras} muestras.`,
        `Cajas cerradas con venta: ${dia.cajas.size}. Cajas todavía abiertas ese día: ${dia.abiertas}.`,
        `Lectura ya hecha: ${titulo}. ${detalle}`,
        `Detalle por caja: ${lineasCaja || 'sin cajas'}.`,
        'Di si esto es normal o si está pasando algo. No inventes otras cifras.',
    ].join(' ');

    return { nivel, titulo, detalle, dia: dia.fecha, nombreDia, total: dia.total, referencia, muestras, cajas, textoParaAgente };
}

export type TurnoCaja = 'Mañana' | 'Tarde' | 'Noche';

export type CajaMonto = { nombre: string; monto: number };

export type TurnoDia = { turno: TurnoCaja; monto: number; cajas: CajaMonto[] };

export type DiaEscalera = {
    fecha: string;
    etiqueta: string;
    nombreDia: string;
    total: number;
    abierta: boolean;
    turnos: TurnoDia[];
    cajas: CajaMonto[];
};

export type QuincenaEscalera = {
    clave: string;
    etiqueta: string;
    total: number;
    dias: number;
    promedio: number;
};

export type ComparativaCajas = {
    recientes: DiaEscalera[];
    porCaja: { nombre: string; hoy: number; ayer: number; anteayer: number }[];
    quincenas: QuincenaEscalera[];
    diasBajos: { fecha: string; nombreDia: string; monto: number }[];
    turnosBajos: { fecha: string; nombreDia: string; turno: TurnoCaja; monto: number }[];
    turnoTipico: { turno: TurnoCaja; mediana: number }[];
    bajones: string[];
};

const TURNOS: TurnoCaja[] = ['Mañana', 'Tarde', 'Noche'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const sumarDias = (fecha: string, dias: number) => {
    const d = new Date(`${fecha}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return ymdLocal(d);
};

const turnoDe = (s: { turno?: string; fechaApertura?: string }): TurnoCaja => {
    const t = (s.turno || '').toLowerCase();
    if (t.includes('mañana') || t.includes('manana')) return 'Mañana';
    if (t === 'tarde') return 'Tarde';
    if (t === 'noche') return 'Noche';
    const d = s.fechaApertura ? new Date(s.fechaApertura) : null;
    const h = d && Number.isFinite(d.getTime()) ? d.getHours() : 12;
    if (t.includes('tarde')) return h >= 19 ? 'Noche' : 'Tarde';
    if (h < 12) return 'Mañana';
    if (h < 19) return 'Tarde';
    return 'Noche';
};

const etiquetaQuincena = (fecha: string) => {
    const dia = Number(fecha.slice(8, 10));
    const mes = MESES[Number(fecha.slice(5, 7)) - 1] || fecha.slice(0, 7);
    const anio = fecha.slice(0, 4);
    return `${dia <= 15 ? '1ª' : '2ª'} quincena de ${mes} ${anio}`;
};

const claveQuincena = (fecha: string) => `${fecha.slice(0, 7)}-${Number(fecha.slice(8, 10)) <= 15 ? 'q1' : 'q2'}`;

/** Hoy, ayer y anteayer, por turno y por caja, más quincenas, días bajos y bajones. */
export function compararEscalera(sesiones: { fechaApertura?: string; cajaNombre?: string; estado?: string; turno?: string; totalVentas?: number; montoCierre?: number | null; montoApertura?: number; movimientos?: { tipo?: string; monto?: number }[] }[] | null | undefined, hoy = hoyLocal()): ComparativaCajas {
    const vacio: ComparativaCajas = {
        recientes: [], porCaja: [], quincenas: [], diasBajos: [], turnosBajos: [], turnoTipico: [], bajones: [],
    };
    const desde = sumarDias(hoy, -120);
    type Acc = {
        fecha: string;
        total: number;
        abierta: boolean;
        turnos: Record<TurnoCaja, Map<string, number>>;
        cajas: Map<string, number>;
    };
    const porFecha = new Map<string, Acc>();
    const asegurar = (fecha: string): Acc => {
        let acc = porFecha.get(fecha);
        if (!acc) {
            acc = {
                fecha,
                total: 0,
                abierta: false,
                turnos: { Mañana: new Map(), Tarde: new Map(), Noche: new Map() },
                cajas: new Map(),
            };
            porFecha.set(fecha, acc);
        }
        return acc;
    };

    (Array.isArray(sesiones) ? sesiones : []).forEach(s => {
        const fecha = ymdLocal(s?.fechaApertura);
        if (!fecha || fecha < desde || fecha > hoy) return;
        const acc = asegurar(fecha);
        if (s?.estado !== 'cerrada') acc.abierta = true;
        const monto = plataDeCuadre(s);
        if (monto <= 0) return;
        const caja = (s?.cajaNombre || 'Caja').trim() || 'Caja';
        const turno = turnoDe(s);
        acc.total += monto;
        acc.cajas.set(caja, (acc.cajas.get(caja) || 0) + monto);
        const mapa = acc.turnos[turno];
        mapa.set(caja, (mapa.get(caja) || 0) + monto);
    });

    const aCajas = (mapa: Map<string, number>): CajaMonto[] =>
        Array.from(mapa.entries()).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto);

    const armarDia = (fecha: string, etiqueta: string): DiaEscalera => {
        const acc = porFecha.get(fecha);
        const nombreDia = DIAS[diaDe(fecha)];
        if (!acc) return { fecha, etiqueta, nombreDia, total: 0, abierta: false, turnos: [], cajas: [] };
        const turnos = TURNOS.map(turno => {
            const cajas = aCajas(acc.turnos[turno]);
            return { turno, monto: cajas.reduce((s, c) => s + c.monto, 0), cajas };
        }).filter(t => t.monto > 0 || acc.abierta);
        return { fecha, etiqueta, nombreDia, total: acc.total, abierta: acc.abierta, turnos, cajas: aCajas(acc.cajas) };
    };

    const recientes = [
        armarDia(hoy, 'Hoy'),
        armarDia(sumarDias(hoy, -1), 'Ayer'),
        armarDia(sumarDias(hoy, -2), 'Anteayer'),
    ];

    const nombres = new Set<string>();
    recientes.forEach(d => d.cajas.forEach(c => nombres.add(c.nombre)));
    const montoEn = (dia: DiaEscalera, nombre: string) => dia.cajas.find(c => c.nombre === nombre)?.monto || 0;
    const porCaja = Array.from(nombres).map(nombre => ({
        nombre,
        hoy: montoEn(recientes[0], nombre),
        ayer: montoEn(recientes[1], nombre),
        anteayer: montoEn(recientes[2], nombre),
    })).sort((a, b) => (b.hoy + b.ayer + b.anteayer) - (a.hoy + a.ayer + a.anteayer));

    const porQ = new Map<string, { etiqueta: string; total: number; dias: number }>();
    porFecha.forEach(acc => {
        if (acc.total <= 0) return;
        const clave = claveQuincena(acc.fecha);
        const cur = porQ.get(clave) || { etiqueta: etiquetaQuincena(acc.fecha), total: 0, dias: 0 };
        cur.total += acc.total;
        cur.dias += 1;
        porQ.set(clave, cur);
    });
    const quincenas = Array.from(porQ.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 8)
        .map(([clave, q]) => ({ clave, etiqueta: q.etiqueta, total: q.total, dias: q.dias, promedio: q.dias ? Math.round(q.total / q.dias) : 0 }));

    const diasConVenta = Array.from(porFecha.values()).filter(d => d.total > 0 && d.fecha >= sumarDias(hoy, -45));
    const diasBajos = [...diasConVenta]
        .sort((a, b) => a.total - b.total)
        .slice(0, 5)
        .map(d => ({ fecha: d.fecha, nombreDia: DIAS[diaDe(d.fecha)], monto: d.total }));

    const instancias: { fecha: string; turno: TurnoCaja; monto: number }[] = [];
    const porTurno: Record<TurnoCaja, number[]> = { Mañana: [], Tarde: [], Noche: [] };
    diasConVenta.forEach(d => {
        TURNOS.forEach(turno => {
            const monto = Array.from(d.turnos[turno].values()).reduce((s, n) => s + n, 0);
            if (monto <= 0) return;
            instancias.push({ fecha: d.fecha, turno, monto });
            porTurno[turno].push(monto);
        });
    });
    const turnoTipico = TURNOS.map(turno => ({ turno, mediana: mediana(porTurno[turno]) }))
        .filter(t => t.mediana > 0)
        .sort((a, b) => a.mediana - b.mediana);
    const turnosBajos = [...instancias]
        .sort((a, b) => a.monto - b.monto)
        .slice(0, 6)
        .map(t => ({ ...t, nombreDia: DIAS[diaDe(t.fecha)] }));

    const bajones: string[] = [];
    const recientesConDatos = recientes.filter(d => d.total > 0);
    recientesConDatos.forEach(dia => {
        dia.turnos.forEach(turno => {
            const otros = instancias.filter(x => x.turno === turno.turno && x.fecha !== dia.fecha).map(x => x.monto);
            const ref = mediana(otros);
            if (otros.length < 3 || ref <= 0 || turno.monto >= ref * 0.65) return;
            const cajaCaida = turno.cajas.find(c => {
                const hist: number[] = [];
                porFecha.forEach(acc => {
                    if (acc.fecha === dia.fecha) return;
                    const n = acc.turnos[turno.turno].get(c.nombre) || 0;
                    if (n > 0) hist.push(n);
                });
                const med = mediana(hist);
                return hist.length >= 2 && med > 0 && c.monto < med * 0.55;
            });
            bajones.push(
                cajaCaida
                    ? `${dia.etiqueta} en la ${turno.turno.toLowerCase()} bajó ${cajaCaida.nombre}: ${pesos(cajaCaida.monto)}. Ese turno suele andar por ${pesos(ref)}.`
                    : `${dia.etiqueta} en la ${turno.turno.toLowerCase()} vendió ${pesos(turno.monto)}. Ese turno suele andar por ${pesos(ref)}.`
            );
        });
    });

    if (!recientes.some(d => d.total > 0) && quincenas.length === 0) return vacio;
    return { recientes, porCaja, quincenas, diasBajos, turnosBajos, turnoTipico, bajones: bajones.slice(0, 8) };
}
