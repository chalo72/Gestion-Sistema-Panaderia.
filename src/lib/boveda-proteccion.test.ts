import { describe, it, expect } from 'vitest';
import {
  BOVEDA_FORMULACIONES,
  BOVEDA_MODELOS_PAN,
  MASAS_CRITICAS_MAP,
  blindarYRepararFormulaciones,
  blindarYRepararModelos,
  puedeEliminarFormulacion,
  validarBackupNube,
  contarIngredientesSeguro,
} from './boveda-produccion-inmutable';

describe('Bóveda Inmutable de Producción - Blindaje de Datos', () => {
  it('contiene exactamente las 5 masas maestras completas', () => {
    expect(BOVEDA_FORMULACIONES.length).toBe(5);
    const nombres = BOVEDA_FORMULACIONES.map(f => f.nombre);
    expect(nombres).toContain('Masa de Sal Mixta');
    expect(nombres).toContain('Masa de Dulce');
    expect(nombres).toContain('Masa de Hojaldre Mixta');
    expect(nombres).toContain('Batido de Tortas Maestro');
    expect(nombres).toContain('Vatido Galleta');
  });

  it('cada masa maestra contiene todos sus insumos originales intactos', () => {
    const salMixta = BOVEDA_FORMULACIONES.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51');
    expect(salMixta).toBeDefined();
    expect(salMixta?.ingredientes?.length).toBe(11);

    const dulce = BOVEDA_FORMULACIONES.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52');
    expect(dulce).toBeDefined();
    expect(dulce?.ingredientes?.length).toBe(11);

    const hojaldre = BOVEDA_FORMULACIONES.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53');
    expect(hojaldre).toBeDefined();
    expect(hojaldre?.ingredientes?.length).toBe(8);

    const tortas = BOVEDA_FORMULACIONES.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54');
    expect(tortas).toBeDefined();
    expect(tortas?.ingredientes?.length).toBe(11);

    const galleta = BOVEDA_FORMULACIONES.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55');
    expect(galleta).toBeDefined();
    expect(galleta?.ingredientes?.length).toBe(8);
  });

  it('contiene exactamente los 35 modelos de pan de la panadería', () => {
    expect(BOVEDA_MODELOS_PAN.length).toBe(35);
    const conFormulacion = BOVEDA_MODELOS_PAN.filter(m => !!m.formulacionId);
    expect(conFormulacion.length).toBe(35);
  });

  it('blindarYRepararFormulaciones detecta y restaura una masa podada a 2 ingredientes', () => {
    // Simulamos un estado corrupto con solo 2 ingredientes
    const corruptas = [
      {
        id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51',
        nombre: 'Masa de Sal Mixta',
        categoria: 'panes' as const,
        rendimientoBaseKg: 23.45,
        costoTotalArroba: 76000,
        activo: true,
        ingredientes: [
          { id: '1', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51', productoId: 'p1', cantidadPorArroba: 24, unidad: 'lb' },
          { id: '2', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51', productoId: 'p2', cantidadPorArroba: 8, unidad: 'und' },
        ],
      },
    ];

    const { resultado, reparadas } = blindarYRepararFormulaciones(corruptas);
    expect(reparadas).toBeGreaterThan(0);
    const reparada = resultado.find(f => f.id === '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51');
    expect(reparada?.ingredientes?.length).toBe(11);
    // Además reinyecta las 4 masas faltantes
    expect(resultado.length).toBe(5);
  });

  it('blindarYRepararModelos reinyecta modelos faltantes', () => {
    const incompletos = BOVEDA_MODELOS_PAN.slice(0, 10);
    const { resultado, reparados } = blindarYRepararModelos(incompletos);
    expect(reparados).toBe(25);
    expect(resultado.length).toBe(35);
  });

  it('puedeEliminarFormulacion prohíbe eliminar las masas maestras', () => {
    const res = puedeEliminarFormulacion('7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51');
    expect(res.permitido).toBe(false);
    expect(res.error).toContain('Masa de Sal Mixta');
  });

  it('validarBackupNube bloquea subidas con datos degradados', () => {
    const corrupto = [
      { id: '1', ingredientes: [{ id: 'a' }] },
      { id: '2', ingredientes: [{ id: 'b' }] },
    ];
    const res = validarBackupNube('formulaciones_data', corrupto);
    expect(res.permitido).toBe(false);

    const valido = BOVEDA_FORMULACIONES;
    const resValido = validarBackupNube('formulaciones_data', valido);
    expect(resValido.permitido).toBe(true);
  });
});
