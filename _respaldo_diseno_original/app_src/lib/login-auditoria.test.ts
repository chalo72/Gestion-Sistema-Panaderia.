import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEventosLoginAuditoria,
  registrarEventoLogin,
  limpiarEventosLoginAntiguos,
  etiquetaTipoEventoLogin,
} from './login-auditoria';

describe('login-auditoria', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('registra y lee eventos de login', () => {
    registrarEventoLogin({
      tipo: 'login_ok',
      email: 'admin@dulceplacer.com',
      exito: true,
      nombre: 'Admin',
      rol: 'ADMIN',
    });

    const eventos = getEventosLoginAuditoria();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].email).toBe('admin@dulceplacer.com');
    expect(eventos[0].tipo).toBe('login_ok');
    expect(eventos[0].deviceId).toBeTruthy();
  });

  it('etiqueta tipos de evento en español', () => {
    expect(etiquetaTipoEventoLogin('login_ok')).toBe('Ingreso exitoso');
    expect(etiquetaTipoEventoLogin('login_fallo')).toBe('PIN incorrecto');
  });

  it('limpia eventos más viejos que N días', () => {
    const viejo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      'dp_login_auditoria',
      JSON.stringify([
        {
          id: '1',
          tipo: 'login_ok',
          email: 'a@b.com',
          exito: true,
          fecha: viejo,
          deviceId: 'dev',
          userAgent: 'test',
        },
      ])
    );

    const removidos = limpiarEventosLoginAntiguos(90);
    expect(removidos).toBe(1);
    expect(getEventosLoginAuditoria()).toHaveLength(0);
  });
});
