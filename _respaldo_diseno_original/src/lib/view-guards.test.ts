import { describe, it, expect } from 'vitest';
import { puedeAccederVista, VISTA_PERMISO } from './view-guards';
import type { Permission } from '@/types';

describe('puedeAccederVista', () => {
  const checkAll = (_p: Permission) => true;
  const checkNone = (_p: Permission) => false;
  const puedeVerSi = (_rol: string, _id: string) => true;
  const puedeVerNo = (_rol: string, _id: string) => false;

  it('ADMIN siempre entra', () => {
    expect(
      puedeAccederVista('configuracion', {
        isAdmin: true,
        role: 'ADMIN',
        check: checkNone,
        puedeVer: puedeVerNo,
      })
    ).toBe(true);
  });

  it('login siempre permitido', () => {
    expect(
      puedeAccederVista('login', {
        isAdmin: false,
        role: 'VENDEDOR',
        check: checkNone,
        puedeVer: puedeVerNo,
      })
    ).toBe(true);
  });

  it('vendedor sin VER_FINANZAS no entra a reportes', () => {
    expect(
      puedeAccederVista('reportes', {
        isAdmin: false,
        role: 'VENDEDOR',
        check: (p) => p === 'VER_VENTAS',
        puedeVer: puedeVerSi,
      })
    ).toBe(false);
  });

  it('vendedor con permiso y puedeVer entra a ventas', () => {
    expect(
      puedeAccederVista('ventas', {
        isAdmin: false,
        role: 'VENDEDOR',
        check: (p) => p === 'VER_VENTAS',
        puedeVer: puedeVerSi,
      })
    ).toBe(true);
  });

  it('mapa Sidebar incluye ventas y caja', () => {
    expect(VISTA_PERMISO.ventas).toBe('VER_VENTAS');
    expect(VISTA_PERMISO.caja).toBe('ABRIR_CERRAR_CAJA');
  });

  it('checkAll pero sin puedeVer → bloquea', () => {
    expect(
      puedeAccederVista('productos', {
        isAdmin: false,
        role: 'VENDEDOR',
        check: checkAll,
        puedeVer: puedeVerNo,
      })
    ).toBe(false);
  });
});
