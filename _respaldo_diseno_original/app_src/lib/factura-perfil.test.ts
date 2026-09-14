import { describe, it, expect } from 'vitest';
import {
  construirPerfilFacturaProveedor,
  etiquetaTipoFactura,
  inferirZonasFactura,
  proveedorTienePerfilFactura,
} from '@/lib/factura-perfil';
import type { ResultadoForense } from '@/lib/ocr-service';

const resultadoBase: ResultadoForense = {
  tipoFactura: 'tipo5_tiquete',
  proveedor: {
    razonSocial: 'TIENDA D,UNO',
    nit: '900123456-1',
    rubro: 'Distribuidora',
    asesor: '',
    telefono: '3001234567',
    email: '',
    direccion: 'Canalete',
    confianza: 90,
  },
  productos: [],
  numeroFactura: 'FV-100',
  fechaFactura: '31/08/2026',
  totalFactura: 26050,
  calidadOCR: 78,
  errores: [],
  textoOriginal: 'TIENDA D,UNO\nNIT 900123456\nFECHA 31/08/2026\n\n2 HARINA 50000\n1 AZUCAR 15000\n\nTOTAL 65000',
};

describe('factura-perfil', () => {
  it('etiqueta tipo legible', () => {
    expect(etiquetaTipoFactura('tipo4_dian')).toContain('DIAN');
  });

  it('infiere tres zonas', () => {
    const zonas = inferirZonasFactura(resultadoBase.textoOriginal);
    expect(zonas).toHaveLength(3);
    expect(zonas[0].id).toBe('cabecera');
    expect(zonas[1].id).toBe('tabla');
    expect(zonas[2].id).toBe('pie');
  });

  it('construye perfil sin productos en catálogo', () => {
    const perfil = construirPerfilFacturaProveedor(resultadoBase, 'data:image/jpeg;base64,abc');
    expect(perfil.activo).toBe(true);
    expect(perfil.tipoFactura).toBe('tipo5_tiquete');
    expect(perfil.nitDetectado).toBe('900123456-1');
    expect(perfil.columnas.length).toBeGreaterThan(0);
    expect(perfil.reglasLectura.length).toBeGreaterThan(0);
    expect(perfil.imagenReferencia).toContain('data:image');
  });

  it('detecta perfil activo', () => {
    const perfil = construirPerfilFacturaProveedor(resultadoBase, 'data:x');
    expect(proveedorTienePerfilFactura(perfil)).toBe(true);
    expect(proveedorTienePerfilFactura(undefined)).toBe(false);
  });
});
