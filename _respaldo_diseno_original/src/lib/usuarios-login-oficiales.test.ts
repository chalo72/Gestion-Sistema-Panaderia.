import { describe, expect, it } from 'vitest';
import {
  normalizarUsuariosLogin,
  esUsuarioLoginOficial,
  ordenarUsuariosLogin,
} from '@/lib/usuarios-login-oficiales';
import type { Usuario } from '@/types';

const base = (partial: Partial<Usuario> & Pick<Usuario, 'id' | 'email' | 'nombre' | 'rol'>): Usuario => ({
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...partial,
});

describe('usuarios-login-oficiales', () => {
  it('inactiva Dilias, Gabriela y Johanna y deja oficiales activos', () => {
    const lista: Usuario[] = [
      base({ id: '1', email: 'Chalo8321@gmail.com', nombre: 'Chalo', rol: 'ADMIN' }),
      base({ id: '2', email: 'a@x.com', nombre: 'Dilia María', rol: 'VENDEDOR' }),
      base({ id: '3', email: 'b@x.com', nombre: 'Dilia Johanna', rol: 'VENDEDOR' }),
      base({ id: '4', email: 'c@x.com', nombre: 'Gabriela', apellido: 'Postventa', rol: 'VENDEDOR' }),
      base({ id: '5', email: 'd@x.com', nombre: 'Johanna', rol: 'VENDEDOR' }),
    ];

    const out = normalizarUsuariosLogin(lista);
    const porEmail = Object.fromEntries(out.map((u) => [u.email.toLowerCase(), u]));

    expect(porEmail['a@x.com']?.activo).toBe(false);
    expect(porEmail['b@x.com']?.activo).toBe(false);
    expect(porEmail['c@x.com']?.activo).toBe(false);
    expect(porEmail['d@x.com']?.activo).toBe(false);

    expect(porEmail['gerente@dulceplacer.com']?.activo).toBe(true);
    expect(porEmail['panadero@dulceplacer.com']?.rol).toBe('PANADERO');
    expect(porEmail['vendedor.manana@dulceplacer.com']?.nombre).toContain('Mañana');
    expect(porEmail['vendedor.tarde@dulceplacer.com']?.nombre).toContain('Tarde');
    expect(porEmail['vendedor.noche@dulceplacer.com']?.nombre).toContain('Noche');
  });

  it('filtra solo oficiales activos para el login', () => {
    const out = normalizarUsuariosLogin([
      base({ id: '1', email: 'Chalo8321@gmail.com', nombre: 'Admin', rol: 'ADMIN' }),
      base({ id: '2', email: 'oculta@x.com', nombre: 'Otra', rol: 'VENDEDOR', activo: true }),
    ]);
    const visibles = ordenarUsuariosLogin(out.filter(esUsuarioLoginOficial));
    expect(visibles.every((u) => esUsuarioLoginOficial(u))).toBe(true);
    expect(visibles.some((u) => u.email.toLowerCase() === 'oculta@x.com')).toBe(false);
    expect(visibles.length).toBe(6);
  });
});
