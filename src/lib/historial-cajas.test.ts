import { describe, it, expect } from 'vitest';
import { resumenCajasDelDia, resumenDiaTexto } from './historial-cajas';

// Caso real del 9 oct 2026 (horas de Colombia)
const s = (id: string, nombre: string, turno: string, ap: string, ci: string | null, base: number, cierre: number, vend: string) => ({
    id, cajaNombre: nombre, turno, fechaApertura: `2026-10-09T${ap}`, fechaCierre: ci ? `2026-10-09T${ci}` : undefined,
    montoApertura: base, montoCierre: cierre, estado: ci ? 'cerrada' : 'abierta', vendedoraNombre: vend, totalVentas: 0,
});
const sesiones = [
    s('a', 'Caja Principal', 'Mañana', '08:52:00', '14:31:10', 100000, 501000, 'Erika'),
    s('b', 'Helados', 'Mañana', '08:52:03', '14:39:02', 0, 0, 'Erika'),
    s('c', 'Caja Principal', 'Tarde', '14:31:14', '14:38:37', 100000, 100000, 'Daniela y Shirley'),
    s('d', 'Caja Principal', 'Noche', '14:38:40', null, 100000, 0, 'Daniela, Shirley '),
    { ...s('x', 'Caja Principal', 'Mañana', '08:00:00', '14:00:00', 0, 0, 'Otra'), fechaApertura: '2026-10-08T08:00:00', fechaCierre: '2026-10-08T14:00:00' },
];
const bov = [
    { fecha: '2026-10-09T14:19:46', monto: 501000, motivo: 'Entrega de Turno: Caja Principal (Erika)' },
    { fecha: '2026-10-09T14:26:06', monto: 601000, motivo: 'Entrega de Turno: Caja Principal (Erika)' },
    { fecha: '2026-10-09T14:20:26', monto: 58000, motivo: 'Entrega de Turno: Helados (Erika)' },
    { fecha: '2026-10-09T14:38:40', monto: 100000, motivo: 'Cierre automático (turno nuevo): Caja Principal (Daniela y Shirley)' },
];

describe('historial de cajas por día', () => {
    const r = resumenCajasDelDia(sesiones, bov, '2026-10-09');
    it('solo trae las cajas de esa fecha, agrupadas por turno en orden', () => {
        expect(r.nCajas).toBe(4);
        expect(r.turnos.map(t => t.turno)).toEqual(['Mañana', 'Tarde', 'Noche']);
        expect(r.turnos[0].cajas[0].nombre).toBe('Caja Principal');
    });
    it('marca lo que no cuadra', () => {
        const [principal, helados] = r.turnos[0].cajas;
        expect(principal.alertas).toContain('Entregada 2 veces');
        expect(helados.alertas).toContain('Cierre ≠ entrega');
        expect(helados.entregado).toBe(58000);
        const tarde = r.turnos[1].cajas[0];
        expect(tarde.alertas).toContain('Se cerró sola al abrir otro turno');
        expect(tarde.alertas.some(a => a.startsWith('Solo'))).toBe(true);
    });
    it('une nombres y suma bien', () => {
        expect(r.turnos[2].responsables).toBe('Daniela y Shirley');
        expect(r.nAbiertas).toBe(1);
        expect(r.totalBase).toBe(300000);
        expect(r.movimientosBoveda).toHaveLength(4);
        expect(resumenDiaTexto(r)).toContain('*Mañana*');
    });
    it('día sin cajas', () => {
        expect(resumenCajasDelDia(sesiones, bov, '2026-10-01').nCajas).toBe(0);
    });
    it('separa mañana y tarde aunque ambas quedaron guardadas como Mañana', () => {
        const mix = [
            { ...s('am', 'Caja Principal', 'Mañana', '06:59:00', '14:18:00', 0, 364000, 'Shirley'), fechaApertura: '2026-10-17T06:59:00', fechaCierre: '2026-10-17T14:18:00' },
            { ...s('pm', 'Caja Principal', 'Mañana', '18:58:00', '22:07:00', 0, 576000, 'ANDREA, Erika'), fechaApertura: '2026-10-17T18:58:00', fechaCierre: '2026-10-17T22:07:00' },
        ];
        const dia = resumenCajasDelDia(mix, [], '2026-10-17');
        expect(dia.turnos.map(t => t.turno)).toEqual(['Mañana', 'Tarde']);
        expect(dia.turnos[0].cajas[0].responsable).toContain('Shirley');
        expect(dia.turnos[1].cajas[0].cierre).toBe(576000);
    });
});
