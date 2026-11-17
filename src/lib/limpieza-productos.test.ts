import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/database', () => ({ db: {} }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { esProductoBasura } from './limpieza-productos';

// Nombres tomados de la nube el 2026-11-06
const basura: [string, string, number][] = [
  ['E A OA', 'General', 0],
  ['un Di', 'General', 0],
  ['_- ANT', 'General', 0],
  ['0 A edi CERIDE NI GUY SANDIA', 'General', 0],
  ['Lo enT00 GALLCTARITZ TACO', 'General', 0],
  ['NN uu. o ANDA AUN EGB Dia', 'General', 1000],
  ['e o)', 'Pool', 0],
  ['OLSERVACIONES: | 5 SUB-TOTAL', 'Pool', 0],
  ['ESTA FACTURA DE VENTA SEM NO ACEPTAMOS SUS EFECTOS LEGALES A', 'Pool', 0],
  ['zsc<zxv<zcxv<', 'Electrónica', 18783416.6],
  ['pananaderia', 'Harinas', 99999999],
  ['brev brave', 'Harinas', 7222200],
  ['PPPPPapapappapa', 'Harinas', 7236700],
  ['gogleeee', 'Harinas', 8600],
  ['panananana', 'Harinas', 57800],
];

const buenos: [string, string, number][] = [
  ['Pan 1000', 'Panes', 1000],
  ['Pan2000', 'Panes', 2000],
  ['Esencia De Banano Sabrimax 510', 'INS: Panadería', 27529],
  ['Agua Pool 300ml', 'Pool', 1000],
  ['Jugo Pool ( Naraja ,Sapicon)250ml', 'Pool', 1200],
  ['Buballooo', 'Dulces(golosina)', 330],
  ['Paleta BBB', 'Helado Empaque', 2500],
  ['BIG-1 ltro 1000', 'Big Cola', 3500],
  ['Leche semidescremada 1000ml', 'INS: Panadería', 34100],
  ['Harina de trigo 50 kg', 'Harinas', 160000],
  ['Té', 'Bebidas', 1500],
];

describe('esProductoBasura', () => {
  it.each(basura)('marca "%s" como basura', (nombre, categoria, precioVenta) => {
    expect(esProductoBasura({ nombre, categoria, precioVenta })).toBe(true);
  });
  it.each(buenos)('NO marca "%s"', (nombre, categoria, precioVenta) => {
    expect(esProductoBasura({ nombre, categoria, precioVenta })).toBe(false);
  });
});
