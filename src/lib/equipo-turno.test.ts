import { describe, it, expect, beforeEach } from 'vitest';
import {
    nombreEquipo, opcionesVendedoras, equipoVigente, guardarEquipo, leerEquipoLocal,
    turnoPorHora, fechaHoy, nombreResponsable, sincronizarEquipoDesdeNube, type EquipoTurno,
} from './equipo-turno';

const base = (o: Partial<EquipoTurno> = {}): EquipoTurno => ({
    fecha: fechaHoy(), turno: 'Tarde', modo: 'conjunta',
    integrantes: [{ id: 'm', nombre: 'María' }, { id: 'j', nombre: 'Jessica' }],
    actualizadoEn: 1, ...o,
});

describe('equipo-turno', () => {
    beforeEach(() => localStorage.clear());

    it('nombreEquipo une nombres', () => {
        expect(nombreEquipo(['A'])).toBe('A');
        expect(nombreEquipo(['A', 'B'])).toBe('A y B');
        expect(nombreEquipo(['A', 'B', 'C'])).toBe('A, B y C');
    });

    it('Tarde conjunta = una sola opción "María y Jessica"', () => {
        const o = opcionesVendedoras(base());
        expect(o).toHaveLength(1);
        expect(o[0].nombre).toBe('María y Jessica');
        expect(o[0].equipo).toBe(true);
    });

    it('individual = una opción por persona', () => {
        const o = opcionesVendedoras(base({ modo: 'individual', turno: 'Mañana', integrantes: [{ id: 'a', nombre: 'Andrea' }] }));
        expect(o.map(x => x.nombre)).toEqual(['Andrea']);
        expect(nombreResponsable(base({ modo: 'individual' }))).toBe('María y Jessica');
    });

    it('vigencia: hoy sí, ayer no (salvo madrugada)', () => {
        const ayer = fechaHoy(new Date(Date.now() - 86400000));
        const tarde = new Date(); tarde.setHours(15, 0, 0, 0);
        expect(equipoVigente(base(), tarde)).not.toBeNull();
        expect(equipoVigente(base({ fecha: ayer }), tarde)).toBeNull();
        const madrugada = new Date(); madrugada.setHours(3, 0, 0, 0);
        const ayerMadr = fechaHoy(new Date(madrugada.getTime() - 86400000));
        expect(equipoVigente(base({ fecha: ayerMadr }), madrugada)).not.toBeNull();
        expect(equipoVigente(null)).toBeNull();
    });

    it('turnoPorHora', () => {
        const h = (n: number) => { const d = new Date(); d.setHours(n); return d; };
        expect(turnoPorHora(h(8))).toBe('Mañana');
        expect(turnoPorHora(h(14))).toBe('Tarde');
        expect(turnoPorHora(h(20))).toBe('Noche');
    });

    it('guardar → leer y respaldo en nube; sincroniza el más nuevo', async () => {
        const store: Record<string, any> = {};
        const dbx = {
            getBackup: async (k: string) => store[k],
            saveBackup: async (k: string, v: any) => { store[k] = v; },
        };
        guardarEquipo(base(), dbx);
        expect(leerEquipoLocal()?.integrantes).toHaveLength(2);
        expect(store['equipo_turno'][0].turno).toBe('Tarde');

        store['equipo_turno'] = [{ ...base({ turno: 'Mañana', modo: 'individual', integrantes: [{ id: 'a', nombre: 'Andrea' }] }), actualizadoEn: Date.now() + 10000 }];
        const e = await sincronizarEquipoDesdeNube(dbx);
        expect(e?.integrantes[0].nombre).toBe('Andrea');
        expect(leerEquipoLocal()?.turno).toBe('Mañana');
    });
});
