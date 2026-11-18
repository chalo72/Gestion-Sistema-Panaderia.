import { describe, it, expect } from 'vitest';
import {
    guionVideo, promptExplicarVideo,
    ejecutarAuditoria, ventaEnCinta, clipCercano, contextoParaIA, resumenWhatsApp, encadenar, verificarCadena, RE_SENSIBLE,
    type DatosAuditoria, type SesionMeta,
} from './auditoria-profunda';

const vacio: DatosAuditoria = { ventas: [], sesionesCaja: [], gastos: [], movimientos: [], productos: [], inventario: [], sesionesGrabadas: [] };
const op = { desde: '2026-10-01', hasta: '2026-10-08', ahora: new Date('2026-10-08T20:00:00').getTime() };
const venta = (id: string, fecha: string, total: number, extra: any = {}) => ({ id, fecha, total, metodoPago: 'efectivo', items: [{ productoId: 'p1', cantidad: 1 }], vendedoraNombre: 'Ana', ...extra });

describe('auditoría profunda', () => {
    it('sin datos: sin hallazgos y riesgo 0', () => {
        const r = ejecutarAuditoria(vacio, op);
        expect(r.hallazgos).toHaveLength(0);
        expect(r.score).toBe(0);
        expect(r.nivel).toBe('verde');
    });

    it('detecta faltante de caja', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            ventas: [venta('v1', '2026-10-05T10:00:00', 50000)],
            sesionesCaja: [{ id: 'c1', estado: 'cerrada', fechaApertura: '2026-10-05T06:00:00', fechaCierre: '2026-10-05T20:00:00', montoApertura: 100000, montoCierre: 90000, ventasIds: ['v1'], movimientos: [], cajaNombre: 'Caja 1', vendedoraNombre: 'Ana' }],
        }, op);
        const h = r.hallazgos.find(x => x.regla === 'descuadre_caja');
        expect(h).toBeTruthy();
        expect(h!.monto).toBe(-60000);
        expect(h!.severidad).toBe('alta');
        expect(r.kpis.descuadreNeto).toBe(-60000);
    });

    it('caja que cuadra no genera hallazgo', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            ventas: [venta('v1', '2026-10-05T10:00:00', 50000)],
            sesionesCaja: [{ id: 'c1', estado: 'cerrada', fechaApertura: '2026-10-05T06:00:00', fechaCierre: '2026-10-05T20:00:00', montoApertura: 100000, montoCierre: 150000, ventasIds: ['v1'], movimientos: [] }],
        }, op);
        expect(r.hallazgos.find(x => x.regla === 'descuadre_caja')).toBeUndefined();
        expect(r.kpis.cajasAuditadas).toBe(1);
    });

    it('detecta venta duplicada y fuera de horario', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            ventas: [venta('a', '2026-10-05T10:00:00', 12000), venta('b', '2026-10-05T10:01:00', 12000), venta('c', '2026-10-06T23:30:00', 8000)],
        }, op);
        expect(r.hallazgos.some(h => h.regla === 'venta_duplicada')).toBe(true);
        expect(r.hallazgos.some(h => h.regla === 'venta_fuera_horario')).toBe(true);
    });

    it('detecta crédito sin cliente', () => {
        const r = ejecutarAuditoria({ ...vacio, ventas: [venta('a', '2026-10-05T10:00:00', 30000, { metodoPago: 'credito', cliente: '' })] }, op);
        expect(r.hallazgos.find(h => h.regla === 'credito_sin_cliente')?.severidad).toBe('alta');
    });

    it('ignora ventas fuera del periodo', () => {
        const r = ejecutarAuditoria({ ...vacio, ventas: [venta('a', '2026-09-01T23:50:00', 0)] }, op);
        expect(r.hallazgos).toHaveLength(0);
        expect(r.kpis.nVentas).toBe(0);
    });

    it('resumen de WhatsApp y contexto de IA incluyen lo importante', () => {
        const r = ejecutarAuditoria({ ...vacio, ventas: [venta('a', '2026-10-05T10:00:00', 30000, { metodoPago: 'credito', cliente: '' })] }, op);
        expect(resumenWhatsApp(r, op)).toContain('AUDITORÍA DULCE PLACER');
        const ctx = contextoParaIA(r, op, []);
        expect(ctx).toContain('PERIODO: 2026-10-01 a 2026-10-08');
        expect(ctx).toContain('crédito sin cliente');
        expect(ctx.length).toBeLessThanOrEqual(7000);
    });

    it('RE_SENSIBLE reconoce acciones delicadas', () => {
        expect(RE_SENSIBLE.test('Anular venta')).toBe(true);
        expect(RE_SENSIBLE.test('Aplicar descuento')).toBe(true);
        expect(RE_SENSIBLE.test('Ir a inicio')).toBe(false);
    });
});

describe('video', () => {
    const clip = (id: string, fecha: string, extra: any = {}) => ({ id, camara_id: 'c', camara_nombre: 'Caja', capturado_en: fecha, url_clip: 'a.webm', ...extra });

    it('alerta de cámara sin venta registrada → hallazgo alto con responsable de la caja', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            ventas: [venta('v1', '2026-10-05T15:30:00', 5000)],
            sesionesCaja: [{ id: 'c1', estado: 'cerrada', fechaApertura: '2026-10-05T06:00:00', fechaCierre: '2026-10-05T20:00:00', vendedoraNombre: 'Ana', montoApertura: 0, ventasIds: [] }],
            clips: [clip('k1', '2026-10-05T14:00:00', { alerta: true, categorias_detectadas: ['consumo_no_registrado'], descripcion_ia: 'Come pan' })],
        }, op);
        const h = r.hallazgos.find(x => x.regla === 'video_alerta');
        expect(h?.severidad).toBe('alta');
        expect(h?.responsable).toBe('Ana');
        expect(h?.detalle).toContain('NO hay ninguna venta');
        expect(r.kpis.clipsAlerta).toBe(1);
    });

    it('robo detectado es crítico y enlaza ventas cercanas', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            ventas: [venta('v1', '2026-10-05T14:01:00', 5000)],
            clips: [clip('k1', '2026-10-05T14:00:00', { categorias_detectadas: ['robo'] })],
        }, op);
        const h = r.hallazgos.find(x => x.regla === 'video_alerta')!;
        expect(h.severidad).toBe('critica');
        expect(h.refs.some(x => x.tipo === 'venta')).toBe(true);
    });

    it('caja de 6 h sin clips (habiendo otros) → sin cobertura', () => {
        const r = ejecutarAuditoria({
            ...vacio,
            sesionesCaja: [{ id: 'c1', estado: 'cerrada', fechaApertura: '2026-10-05T08:00:00', fechaCierre: '2026-10-05T14:00:00', vendedoraNombre: 'Ana' }],
            clips: [clip('k1', '2026-10-06T10:00:00')],
        }, op);
        expect(r.hallazgos.some(x => x.regla === 'video_sin_cobertura' && x.id === 'video-hueco-c1')).toBe(true);
    });

    it('clipCercano elige el clip más próximo', () => {
        const cs = [clip('a', '2026-10-05T14:00:00'), clip('b', '2026-10-05T14:10:00')];
        expect(clipCercano('2026-10-05T14:00:08', cs)?.id).toBe('a');
        expect(clipCercano('2026-10-05T16:00:00', cs)).toBeNull();
    });
});

describe('cintas', () => {
    const ses = (id: string, inicio: number, fin: number): SesionMeta => ({ id, inicio, fin, eventos: 0, clics: 0, entradas: 0, vistas: [], sensibles: [], acciones: [], chunks: [] });

    it('ubica una venta dentro de la cinta correcta', () => {
        const t0 = new Date('2026-10-05T09:00:00').getTime();
        const r = ventaEnCinta('2026-10-05T10:00:00', [ses('s1', t0, t0 + 3 * 3600000)]);
        expect(r?.sesionId).toBe('s1');
        expect(r?.offsetMs).toBe(3600000);
        expect(ventaEnCinta('2026-10-05T15:00:00', [ses('s1', t0, t0 + 3 * 3600000)])).toBeNull();
    });

    it('la cadena de huellas detecta manipulación', async () => {
        const c1 = [{ type: 2, n: 1 }, { type: 3, n: 2 }];
        const c2 = [{ type: 3, n: 3 }];
        const h1 = await encadenar('génesis', c1);
        const h2 = await encadenar(h1, c2);
        const meta = { semilla: 'génesis', chunks: [{ n: 2, hash: h1 }, { n: 1, hash: h2 }], hashFinal: h2 };

        expect((await verificarCadena(meta, [...c1, ...c2])).ok).toBe(true);
        const alterada = [...c1, { type: 3, n: 999 }];
        expect((await verificarCadena(meta, alterada)).ok).toBe(false);
        expect((await verificarCadena(meta, c1)).ok).toBe(false); // cinta recortada
    });
});

describe('caja ↔ Bóveda (2026-10-09)', () => {
    const cajas = [
        { id: 'p9m', fechaApertura: '2026-10-09T08:52:00', fechaCierre: '2026-10-09T14:31:10', montoApertura: 100000, montoCierre: 501000, estado: 'cerrada', cajaNombre: 'Caja Principal', turno: 'Mañana', vendedoraNombre: 'Erika' },
        { id: 'h9m', fechaApertura: '2026-10-09T08:52:03', fechaCierre: '2026-10-09T14:39:02', montoApertura: 0, montoCierre: 0, estado: 'cerrada', cajaNombre: 'Helados', turno: 'Mañana', vendedoraNombre: 'Erika' },
        { id: 'p9t', fechaApertura: '2026-10-09T14:31:14', fechaCierre: '2026-10-09T14:38:37', montoApertura: 100000, montoCierre: 100000, estado: 'cerrada', cajaNombre: 'Caja Principal', turno: 'Tarde', vendedoraNombre: 'Daniela y Shirley' },
        { id: 'p9n', fechaApertura: '2026-10-09T14:38:40', estado: 'abierta', montoApertura: 100000, cajaNombre: 'Caja Principal', turno: 'Noche', vendedoraNombre: 'Daniela, Shirley ' },
    ];
    const bovedaMovs = [
        { fecha: '2026-10-09T14:19:46', monto: 501000, motivo: 'Entrega de Turno: Caja Principal (Erika)' },
        { fecha: '2026-10-09T14:26:06', monto: 601000, motivo: 'Entrega de Turno: Caja Principal (Erika)' },
        { fecha: '2026-10-09T14:20:26', monto: 58000, motivo: 'Entrega de Turno: Helados (Erika)' },
        { fecha: '2026-10-09T14:31:14', monto: 100000, motivo: 'Cierre automático (turno nuevo): Caja Principal (Erika)' },
    ];
    const r = ejecutarAuditoria({ ...vacio, sesionesCaja: cajas, bovedaMovs }, { desde: '2026-10-09', hasta: '2026-10-09', ahora: new Date('2026-10-09T21:00:00').getTime() });
    const reglas = r.hallazgos.map(h => h.regla);
    it('detecta entrega duplicada, cierre que no cuadra, cierre automático, caja corta y turno equivocado', () => {
        expect(reglas).toContain('entrega_duplicada');
        expect(reglas).toContain('cierre_no_cuadra_entrega'); // Helados: cierre 0, entrega 58.000
        expect(reglas).toContain('cierre_automatico');
        expect(reglas).toContain('caja_abierta_corta');
        expect(reglas).toContain('turno_no_cuadra'); // "Noche" a las 2:38 pm
        expect(r.kpis.cajasCruzadas).toBe(2); // Principal mañana y Helados
        expect(r.kpis.sinVentasPOS).toBe(true);
    });
    it('une los nombres del mismo equipo', () => {
        expect(r.personas.map(p => p.nombre)).not.toContain('Daniela, Shirley ');
    });
});

describe('guion de video para la IA', () => {
    const t0 = new Date('2026-10-09T14:30:00').getTime();
    const s: SesionMeta = {
        id: 'sesion_1', inicio: t0, fin: t0 + 600000, usuario: 'Erika', turno: 'Mañana', dispositivo: 'Celular · Chrome',
        eventos: 10, clics: 3, entradas: 1, vistas: [], chunks: [],
        acciones: [{ t: t0 + 60000, texto: 'Confirmar Entrega' }, { t: t0 + 500000, texto: 'Fuera del tramo' }],
        sensibles: [{ t: t0 + 60000, texto: 'Confirmar Entrega' }],
        modulos: [{ vista: 'caja', entra: t0, critico: true }],
        momentos: [{ t: t0 + 60000, motivo: '⚠ Confirmar Entrega', vista: 'caja' }],
    };
    const eventos = [
        { type: 3, timestamp: t0 + 50000, data: { source: 5, id: 7, text: '501000' } },
        { type: 3, timestamp: t0 + 55000, data: { source: 5, id: 8, text: '****' } },
        { type: 3, timestamp: t0 + 60000, data: { source: 2, type: 2, id: 9 } },
    ];
    it('cuenta solo lo del tramo, con valores escritos y módulo crítico', () => {
        const g = guionVideo(s, t0, t0 + 120000, { eventos });
        expect(g).toContain('Erika');
        expect(g).toContain('caja (crítico)');
        expect(g).toContain('⚠ Confirmar Entrega');
        expect(g).not.toContain('Fuera del tramo');
        expect(g).toContain('«501000»');
        expect(g).toContain('CLICS: 1');
    });
    it('el pedido a la IA trae las 4 partes', () => {
        const p = promptExplicarVideo('momento');
        for (const k of ['Qué pasó', 'Qué está pasando', 'Qué puede pasar', 'Veredicto']) expect(p).toContain(k);
    });
});
