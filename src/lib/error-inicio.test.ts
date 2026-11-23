import { describe, it, expect } from 'vitest';
import { describirErrorInicio, AVISO_NO_BORRAR_DATOS } from './error-inicio';

describe('describirErrorInicio', () => {
  it('base ocupada por otra pestaña: muestra la causa real y manda a cerrar pestañas', () => {
    const r = describirErrorInicio(new Error('IndexedDB no respondió en 15s (¿otra pestaña de la app abierta?)'));
    expect(r.causa).toContain('no respondió en 15s');
    expect(r.consejo.toLowerCase()).toContain('ciérralas');
    expect(r.consejo.toLowerCase()).toContain('pestaña');
  });

  it('sin espacio: pide liberar espacio', () => {
    const e = Object.assign(new Error('The quota has been exceeded'), { name: 'QuotaExceededError' });
    expect(describirErrorInicio(e).consejo.toLowerCase()).toContain('espacio');
  });

  it('modo privado / acceso denegado: pide abrir en ventana normal', () => {
    const e = Object.assign(new Error('Access to the IndexedDB API is denied in this context'), { name: 'SecurityError' });
    expect(describirErrorInicio(e).consejo.toLowerCase()).toContain('ventana normal');
  });

  it('error desconocido: conserva el mensaje y da el consejo general', () => {
    const r = describirErrorInicio(new Error('algo raro'));
    expect(r.causa).toBe('algo raro');
    expect(r.consejo.toLowerCase()).toContain('reintentar');
  });

  it('no revienta con valores que no son Error', () => {
    expect(describirErrorInicio(undefined).causa).toBe('Error desconocido');
    expect(describirErrorInicio(null).causa).toBe('Error desconocido');
    expect(describirErrorInicio('texto suelto').causa).toBe('texto suelto');
  });

  it('el aviso advierte no borrar los datos del sitio', () => {
    expect(AVISO_NO_BORRAR_DATOS.toLowerCase()).toContain('no borres');
  });
});
