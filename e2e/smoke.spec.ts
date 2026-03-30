import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────
// Smoke Tests — Panadería Dulce Placer
// ────────────────────────────────────────────────────────────────────

/**
 * Inyecta una sesión de administrador en localStorage ANTES de que React cargue.
 * AuthContext.tsx lee `pricecontrol_local_user` en initializeAuth() y omite el login.
 * Esto es necesario porque la app usa autenticación LOCAL (no Supabase).
 */
async function iniciarSesion(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const testUser = {
      id: 'e2e-admin-user',
      email: 'e2e@test.local',
      nombre: 'E2E Admin',
      rol: 'ADMIN',
      activo: true,
      ultimoAcceso: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    localStorage.setItem('pricecontrol_local_user', JSON.stringify(testUser));
    localStorage.setItem('pricecontrol_local_user_list', JSON.stringify([testUser]));
  });

  await page.goto('/');
  // La sesión pre-cargada omite el formulario de login → sidebar visible directamente
  await page.waitForSelector('aside', { state: 'visible', timeout: 20000 });
}

/** Navegar a una sección del sidebar */
async function irA(page: import('@playwright/test').Page, label: string) {
  const btn = page.locator(`button[title="${label}"]`)
    .or(page.locator('button').filter({ hasText: label }));
  await btn.first().click();
  await page.waitForTimeout(700);
}

// ════════════════════════════════════════════════════════════════════

test.describe('Carga inicial de la aplicación', () => {
  test('el título de la página es correcto', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dulce Placer|Gestión|DP/i);
  });

  test('la app carga y muestra el sidebar tras login', async ({ page }) => {
    await iniciarSesion(page);
    await expect(page.locator('aside')).toBeVisible();
  });
});

test.describe('Navegación entre páginas principales', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
  });

  test('página Productos carga', async ({ page }) => {
    await irA(page, 'Productos');
    await expect(page.locator('h1, h2, table, [role="list"]').first())
      .toBeVisible({ timeout: 10000 });
  });

  test('página Proveedores carga', async ({ page }) => {
    await irA(page, 'Gestión de Proveedores');
    await expect(page.locator('h1, h2, table, [role="list"]').first())
      .toBeVisible({ timeout: 10000 });
  });

  test('página Ventas carga', async ({ page }) => {
    await irA(page, 'Ventas / POS');
    await expect(page.locator('h1, h2, button, input').first())
      .toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sin errores críticos en consola', () => {
  test('no hay errores de JavaScript al cargar', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (err) => {
      if (!err.message.includes('Failed to fetch') &&
          !err.message.includes('NetworkError') &&
          !err.message.includes('ResizeObserver') &&
          !err.message.includes('supabase')) {
        errores.push(err.message);
      }
    });
    await iniciarSesion(page);
    await page.waitForTimeout(1500);
    expect(errores, `Errores JS: ${errores.join(' | ')}`).toHaveLength(0);
  });
});
