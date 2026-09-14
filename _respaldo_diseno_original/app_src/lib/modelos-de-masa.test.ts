import { describe, expect, it } from 'vitest';
import { idsMasasEquivalentes, resolverModelosDeMasa } from './modelos-de-masa';

const masaPc = { id: 'masa-pc', nombre: 'Masa de Dulce Especial' };
const masaCel = { id: 'masa-cel', nombre: 'Masa de Dulce Especial' };
const coco = { id: 'coco', nombre: 'Pan de Coco 100g', formulacionId: 'masa-cel', activo: true };
const rollo = { id: 'rollo', nombre: 'Rollo de Canela', formulacionId: 'masa-pc', activo: true };
const trenZa = { id: 'trenza', nombre: 'Trenza', formulacionId: 'otra', activo: true, };
const mixItem = { id: 'moño', nombre: 'Moño de Dulce', formulacionId: 'x', activo: true };

describe('resolverModelosDeMasa (PC vs celular)', () => {
  it('une panes de la misma masa aunque el UUID de la PC y el del celular sean distintos', () => {
    const { modelos } = resolverModelosDeMasa(masaCel, [coco, rollo, trenZa], [masaPc, masaCel]);
    expect(modelos.map((m) => m.nombre).sort()).toEqual(['Pan de Coco 100g', 'Rollo de Canela']);
  });

  it('no se queda en un solo pan si hay más en mixProduccion', () => {
    const form = {
      id: 'masa-cel',
      nombre: 'Masa de Dulce Especial',
      mixProduccion: [{ modeloPanId: 'moño' }],
    };
    const { modelos } = resolverModelosDeMasa(form, [coco, mixItem], [form]);
    expect(modelos.map((m) => m.id).sort()).toEqual(['coco', 'moño']);
  });

  it('si no hay ningún lazo, muestra todos los activos (no lista vacía)', () => {
    const form = { id: 'masa-nueva', nombre: 'Masa Nueva' };
    const { modelos, origen } = resolverModelosDeMasa(form, [coco, rollo], [form]);
    expect(origen).toBe('todos');
    expect(modelos).toHaveLength(2);
  });

  it('idsMasasEquivalentes ignora tildes y mayúsculas', () => {
    const ids = idsMasasEquivalentes('a', [
      { id: 'a', nombre: 'Masa de Dulce Especial' },
      { id: 'b', nombre: 'masa de dulce especial' },
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});
