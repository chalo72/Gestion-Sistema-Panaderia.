import { describe, it, expect } from 'vitest';
import { detectarPersonaFamiliaEnTexto, UMBRAL_FAMILIA_PCT_VENTAS } from '@/lib/familia-duenos';
import { calcularPanoramaSupervivencia } from '@/lib/finanzas-personales';
import { inferirCategoriaGasto } from '@/lib/gasto-categoria-inferencia';

describe('familia + supervivencia', () => {
  it('detecta nombres de familia en texto', () => {
    expect(detectarPersonaFamiliaEnTexto('retiro Emiliano')?.nombre).toBe('Emiliano');
    expect(detectarPersonaFamiliaEnTexto('plata para Andrea Rosales')?.nombre).toBe('Andrea Rosales');
  });

  it('infiera categoría Familia por nombre', () => {
    const r = inferirCategoriaGasto('Retiro Gonzalo Iván 200000', [], [], undefined);
    expect(r.categoria).toBe('Familia');
  });

  it('marca alerta si familia supera umbral de ventas', () => {
    const r = calcularPanoramaSupervivencia({
      ventas: [{ fecha: '2026-10-05', total: 1000000 }],
      ventasDiarias: [],
      gastos: [
        {
          fecha: '2026-10-06',
          monto: 200000,
          categoria: 'Familia',
          personaFamilia: 'Emiliano',
          descripcion: 'Retiro Emiliano',
        },
      ],
      compromisos: [],
      nominaMesEstimada: 0,
      periodo: { inicioStr: '2026-10-01', finStr: '2026-10-15', quincena: '1' },
      umbralFamiliaPct: UMBRAL_FAMILIA_PCT_VENTAS,
    });
    expect(r.pctFamiliaSobreVentas).toBe(20);
    expect(r.nivel === 'alerta' || r.nivel === 'critico').toBe(true);
    expect(r.rankingFamilia[0]?.persona).toBe('Emiliano');
  });
});
