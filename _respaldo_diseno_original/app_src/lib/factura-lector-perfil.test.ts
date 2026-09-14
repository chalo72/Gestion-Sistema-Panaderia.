import { describe, it, expect } from 'vitest';
import {
  corregirDescripcionOCR,
  esLineaBasura,
  extraerLineasConPerfil,
  normalizarPrecioFactura,
  parsearLineaTablaDistribuidora,
} from '@/lib/factura-lector-perfil';
import { construirPerfilFacturaProveedor, inferirZonasFactura } from '@/lib/factura-perfil';
import type { ResultadoForense } from '@/lib/ocr-service';

const textoCamercar = `CAMERCAR MULTIMARCAS SAS
NIT 900123456-1
FECHA 01/09/2026

| 10510 GASEOSA POOL COLA 400ML X24 o 12 12 25,800 19 0
| 10511 GASEOSA POOL MANZANA 400ML X24 o 12 12 25,800 19 0
[casrosa POOL UVA 400ML X 24 y UD e 12| 25,800 19 Oj
.GASEOSA POOL COLA 400ML X24 o| 12 | 12| 25,800 19 o| -- 1
3 HARINA PAN 40*30*3.8g 166667

ESTA FACTURA DE VENTA NO ACEPTAMOS SUS EFECTOS LEGALES
OLSERVACIONES: | 5 SUB-TOTAL 85361
TOTAL 100000`;

const resultadoCamercar: ResultadoForense = {
  tipoFactura: 'tipo7_superficie',
  proveedor: {
    razonSocial: 'CAMERCAR MULTIMARCAS SAS',
    nit: '900123456-1',
    rubro: 'Distribuidora',
    asesor: '',
    telefono: '',
    email: '',
    direccion: '',
    confianza: 80,
  },
  productos: [],
  numeroFactura: 'FV-1',
  fechaFactura: '01/09/2026',
  totalFactura: 100000,
  calidadOCR: 70,
  errores: [],
  textoOriginal: textoCamercar,
};

describe('factura-lector-perfil', () => {
  it('normaliza precios colombianos', () => {
    expect(normalizarPrecioFactura('25,800')).toBe(25800);
    expect(normalizarPrecioFactura('1.500,00')).toBe(1500);
  });

  it('corrige OCR cascarrosa → GASEOSA cuando hay POOL', () => {
    expect(corregirDescripcionOCR('casrosa POOL UVA 400ML X 24')).toContain('GASEOSA');
    expect(corregirDescripcionOCR('casrosa POOL UVA 400ML X 24')).toContain('X24');
  });

  it('detecta líneas basura (legal, observaciones, subtotal)', () => {
    expect(esLineaBasura('ESTA FACTURA DE VENTA NO ACEPTAMOS SUS EFECTOS LEGALES', [])).toBe(true);
    expect(esLineaBasura('OLSERVACIONES: | 5 SUB-TOTAL 85361', [])).toBe(true);
    expect(esLineaBasura('e o)', [])).toBe(true);
  });

  it('parsea línea tabla distribuidora CAMERCAR', () => {
    const r = parsearLineaTablaDistribuidora('| 10510 GASEOSA POOL COLA 400ML X24 o 12 12 25,800 19 0');
    expect(r).not.toBeNull();
    expect(r!.descripcion).toContain('GASEOSA POOL COLA');
    expect(r!.descripcion).not.toMatch(/25[,.]?800/);
    expect(r!.cantidad).toBe(12);
    expect(r!.valorTotal).toBe(25800);
  });

  it('parsea línea OCR sucia con pipes', () => {
    const r = parsearLineaTablaDistribuidora('.GASEOSA POOL COLA 400ML X24 o| 12 | 12| 25,800 19 o| -- 1');
    expect(r).not.toBeNull();
    expect(r!.descripcion).toContain('GASEOSA');
    expect(r!.valorTotal).toBe(25800);
  });

  it('infiere pie antes de observaciones/subtotal', () => {
    const zonas = inferirZonasFactura(textoCamercar);
    const tabla = zonas.find((z) => z.id === 'tabla');
    const pie = zonas.find((z) => z.id === 'pie');
    expect(tabla).toBeDefined();
    expect(pie).toBeDefined();
    expect(tabla!.lineaFin).toBeLessThan(pie!.lineaInicio);
  });

  it('extrae líneas limpias con perfil CAMERCAR', () => {
    const perfil = construirPerfilFacturaProveedor(resultadoCamercar, 'data:image/jpeg;base64,x');
    const lineas = extraerLineasConPerfil(textoCamercar, perfil);

    expect(lineas.length).toBeGreaterThanOrEqual(3);
    const gaseosas = lineas.filter((l) => l.descripcion.toUpperCase().includes('GASEOSA'));
    expect(gaseosas.length).toBeGreaterThanOrEqual(2);

    for (const g of gaseosas) {
      expect(g.descripcion).not.toMatch(/OBSERV/i);
      expect(g.descripcion).not.toMatch(/EFECTOS LEGALES/i);
      expect(g.descripcion).not.toMatch(/\|\s*12\s*\|/);
      expect(g.valorTotal).toBe(25800);
    }

    const harina = lineas.find((l) => l.descripcion.includes('HARINA'));
    expect(harina).toBeDefined();
    expect(harina!.cantidad).toBe(3);
    expect(harina!.valorTotal).toBe(166667);
  });

  it('tipo1 dimensiones extrae cantidad y precio', () => {
    const texto = `DISTRIBUIDORA\n2 CHICLE BUBBALOO FRESA 40*30*3.8g 166667\nTOTAL 200000`;
    const resultado: ResultadoForense = {
      ...resultadoCamercar,
      tipoFactura: 'tipo1_dimensiones',
      textoOriginal: texto,
    };
    const perfil = construirPerfilFacturaProveedor(resultado, 'data:image/jpeg;base64,x');
    const lineas = extraerLineasConPerfil(texto, perfil);
    expect(lineas.length).toBe(1);
    expect(lineas[0].descripcion).toContain('BUBBALOO');
    expect(lineas[0].cantidad).toBe(2);
    expect(lineas[0].valorTotal).toBe(166667);
  });
});
