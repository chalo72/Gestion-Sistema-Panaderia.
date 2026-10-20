import { describe, it, expect } from 'vitest';
import {
    analizarTiendas, analizarVendedores, resumenDespacho, sugerirCargaTienda, enlaceRutaMaps,
    creditoParada, mezclarPorId, infraccionesTopeDevolucion, mensajeTopeDevolucion, maxRecogidoPermitido,
    TOPE_DEVOLUCION_PCT, type Despacho, type ParadaDespacho,
} from './rutas-reparto';

const CONFIG = { margenNegocio: 20, margenRevendedor: 25 };

function parada(clienteId: string, dejado: number, recogido: number, motivo: 'sobrante' | 'cambio' | 'danado' = 'sobrante', cobrado = 0): ParadaDespacho {
    return {
        clienteId, clienteNombre: 'Tienda ' + clienteId, visitada: true, cobrado, metodoCobro: 'efectivo',
        lineas: [{ productoId: 'p1', nombre: 'Pan sal', dejado, recogido, motivo, precioUnit: 1000, costoUnit: 700 }],
    };
}

function despacho(fecha: string, paradas: ParadaDespacho[], extra: Partial<Despacho> = {}): Despacho {
    return {
        id: 'd' + fecha, fecha, vendedor: 'Luis', rutaNombre: 'Ruta A', estado: 'liquidado',
        carga: [{ productoId: 'p1', nombre: 'Pan sal', cantidad: 100, precioUnit: 1000, costoUnit: 700 }],
        paradas, regreso: [], actualizadoEn: 1, ...extra,
    };
}

describe('resumenDespacho', () => {
    it('cuadra pan y plata', () => {
        const d = despacho('2026-10-01', [parada('a', 40, 5, 'sobrante', 20000), parada('b', 30, 0, 'sobrante', 30000)], {
            regreso: [{ productoId: 'p1', buenos: 20, danados: 3 }],
            efectivoRecibido: 48000,
        });
        const r = resumenDespacho(d);
        expect(r.totalCargado).toBe(100);
        expect(r.totalDejado).toBe(70);
        expect(r.totalRecogido).toBe(5);
        expect(r.totalEsperadoRegreso).toBe(35); // 100 - 70 + 5
        expect(r.totalReportado).toBe(23);
        expect(r.faltanteUnidades).toBe(12);
        expect(r.faltanteValor).toBe(12000);
        expect(r.ventaBruta).toBe(70000);
        expect(r.devolucionesValor).toBe(5000);
        expect(r.ventaNeta).toBe(65000);
        expect(r.cobradoEfectivo).toBe(50000);
        expect(r.porCobrarCredito).toBe(15000);
        expect(r.efectivoDiferencia).toBe(-2000);
    });

    it('sin conteo de regreso no inventa faltantes', () => {
        const r = resumenDespacho(despacho('2026-10-01', [parada('a', 10, 0)]));
        expect(r.faltanteUnidades).toBe(0);
        expect(r.efectivoDiferencia).toBeNull();
    });

    it('crédito de parada nunca es negativo', () => {
        expect(creditoParada(parada('a', 1, 5, 'sobrante', 0))).toBe(0);
    });
});

describe('analizarTiendas', () => {
    it('calcula devolución y utilidad; cambios/daños no recuperan costo', () => {
        const ds = [
            despacho('2026-10-01', [parada('a', 50, 0)]),
            despacho('2026-10-04', [parada('a', 50, 20, 'cambio')]),
        ];
        const [t] = analizarTiendas(ds, [{ id: 'a', nombre: 'Tienda a' }], { config: CONFIG, hoy: '2026-10-08' });
        expect(t.unidadesDejadas).toBe(100);
        expect(t.unidadesRecogidas).toBe(20);
        expect(t.pctDevolucion).toBe(20);
        expect(t.ventaNeta).toBe(80000);
        // costo dejado 70000, no se recupera nada (cambio) → utilidad 10000
        expect(t.utilidadNegocio).toBe(10000);
        expect(t.perdidaPorCambiosYDanos).toBe(14000);
        expect(t.diasSinVisita).toBe(4);
    });

    it('sobrante sí recupera costo', () => {
        const ds = [despacho('2026-10-01', [parada('a', 50, 10, 'sobrante')])];
        const [t] = analizarTiendas(ds, [{ id: 'a', nombre: 'Tienda a' }], { config: CONFIG, hoy: '2026-10-02' });
        expect(t.ventaNeta).toBe(40000);
        expect(t.utilidadNegocio).toBe(12000); // 40000 - (35000-7000)=40000-28000
    });

    it('usa el margen personalizado de la tienda', () => {
        const ds = [despacho('2026-10-01', [parada('a', 10, 0)])];
        const [t] = analizarTiendas(ds, [{ id: 'a', nombre: 'A', margenPersonalizado: 10 }], { config: CONFIG, hoy: '2026-10-02' });
        expect(t.margenTiendaPct).toBe(10);
        expect(t.gananciaTienda).toBe(1000);
        expect(t.estrategias.join(' ')).toMatch(/gana solo 10%/);
    });

    it('alerta devolución alta, deuda y visita atrasada', () => {
        const ds = [
            despacho('2026-09-01', [parada('a', 40, 20)]),
            despacho('2026-09-03', [parada('a', 40, 20)]),
        ];
        const [t] = analizarTiendas(ds, [{ id: 'a', nombre: 'A' }], { config: CONFIG, hoy: '2026-10-08', deudas: { a: 50000 } });
        const txt = t.estrategias.join(' | ');
        expect(txt).toMatch(/Devuelven 50%/);
        expect(txt).toMatch(/Debe/);
        expect(txt).toMatch(/sin visitarla/);
        expect(t.semaforo).toBe('rojo');
    });

    it('detecta tendencia a la baja', () => {
        const ds = [
            despacho('2026-10-01', [parada('a', 50, 0)]),
            despacho('2026-10-02', [parada('a', 50, 0)]),
            despacho('2026-10-03', [parada('a', 20, 0)]),
            despacho('2026-10-04', [parada('a', 20, 0)]),
        ];
        const [t] = analizarTiendas(ds, [{ id: 'a', nombre: 'A' }], { config: CONFIG, hoy: '2026-10-05' });
        expect(t.tendencia).toBe('baja');
    });
});

describe('sugerirCargaTienda', () => {
    it('sube 15% si casi no devuelven y no pone colchón si devuelven mucho', () => {
        const ds = [despacho('2026-10-01', [parada('a', 20, 0)]), despacho('2026-10-04', [parada('a', 20, 0)])];
        expect(sugerirCargaTienda(ds, 'a')[0].cantidad).toBe(23); // 20 × 1.15

        const ds2 = [despacho('2026-10-01', [parada('a', 20, 10)]), despacho('2026-10-04', [parada('a', 20, 10)])];
        expect(sugerirCargaTienda(ds2, 'a')[0].cantidad).toBe(10);
    });

    it('sin historial no sugiere nada', () => {
        expect(sugerirCargaTienda([], 'a')).toEqual([]);
    });
});

describe('analizarVendedores', () => {
    it('suma faltantes y descuadre de efectivo', () => {
        const d = despacho('2026-10-01', [parada('a', 70, 0, 'sobrante', 70000)], {
            regreso: [{ productoId: 'p1', buenos: 20, danados: 0 }],
            efectivoRecibido: 60000,
        });
        const [v] = analizarVendedores([d]);
        expect(v.unidadesFaltantes).toBe(10);
        expect(v.descuadreEfectivo).toBe(-10000);
        expect(v.alertas.length).toBe(2);
    });
});

describe('tope devolución 15%', () => {
    it('permite hasta el piso del 15% por tienda', () => {
        expect(maxRecogidoPermitido(100)).toBe(15);
        expect(maxRecogidoPermitido(10)).toBe(1);
        expect(TOPE_DEVOLUCION_PCT).toBe(15);
        // 15 de 100 = 15% → ok; 16 → infracción
        const ok = despacho('2026-10-01', [parada('a', 100, 15)]);
        expect(infraccionesTopeDevolucion(ok)).toHaveLength(0);
        expect(mensajeTopeDevolucion([])).toBeNull();
        const malo = despacho('2026-10-01', [parada('a', 100, 16)]);
        const inf = infraccionesTopeDevolucion(malo);
        expect(inf).toHaveLength(1);
        expect(inf[0].maxRecogido).toBe(15);
        expect(mensajeTopeDevolucion(inf)).toMatch(/15%/);
        expect(mensajeTopeDevolucion(inf)).toMatch(/No se puede liquidar/);
    });

    it('evalúa por tienda, no promedia el despacho', () => {
        // Tienda a ok (10%), tienda b pasa (20%) → bloquea por b aunque el total sea 15%
        const d = despacho('2026-10-01', [parada('a', 100, 10), parada('b', 100, 20)]);
        const inf = infraccionesTopeDevolucion(d);
        expect(inf).toHaveLength(1);
        expect(inf[0].clienteId).toBe('b');
    });

    it('sin dejado no permite recoger', () => {
        const d = despacho('2026-10-01', [parada('a', 0, 1)]);
        expect(infraccionesTopeDevolucion(d)[0].maxRecogido).toBe(0);
    });
});

describe('utilidades', () => {
    it('enlace de Maps solo con direcciones', () => {
        expect(enlaceRutaMaps([{ id: 'a', nombre: 'A' }])).toBeNull();
        expect(enlaceRutaMaps([{ id: 'a', nombre: 'A', direccion: 'Cra 5 #3', ciudad: 'Pitalito' }])).toContain('google.com/maps/dir/');
    });

    it('mezcla por id gana el más reciente', () => {
        const r = mezclarPorId([{ id: '1', actualizadoEn: 5, v: 'a' }], [{ id: '1', actualizadoEn: 9, v: 'b' }]);
        expect(r).toHaveLength(1);
        expect(r[0].v).toBe('b');
    });
});
