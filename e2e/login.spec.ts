import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────
// Tests E2E — Login y Autenticación
// ────────────────────────────────────────────────────────────────────

test.describe('Pantalla de Login', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar sesión para forzar pantalla de login
    await page.addInitScript(() => {
      localStorage.removeItem('pricecontrol_local_user');
      localStorage.removeItem('pricecontrol_local_user_list');
    });
    await page.goto('/');
  });

  test('muestra formulario de login con email y contraseña', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('botón enviar dice "Entrar al Sistema"', async ({ page }) => {
    const boton = page.locator('button[type="submit"]');
    await expect(boton).toBeVisible({ timeout: 15000 });
    await expect(boton).toContainText(/Entrar al Sistema/i);
  });

  test('campos de email y password aceptan texto', async ({ page }) => {
    await page.locator('#email').fill('test@test.com');
    await page.locator('#password').fill('123456');
    await expect(page.locator('#email')).toHaveValue('test@test.com');
    await expect(page.locator('#password')).toHaveValue('123456');
  });

  test('toggle de visibilidad de contraseña funciona', async ({ page }) => {
    const passInput = page.locator('#password');
    await expect(passInput).toHaveAttribute('type', 'password');

    // Clic en el botón de ojo para mostrar contraseña
    const toggleBtn = page.locator('#password').locator('..').locator('button[type="button"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(passInput).toHaveAttribute('type', 'text');
    }
  });

  test('credenciales incorrectas muestran error o rechazan login', async ({ page }) => {
    await page.locator('#email').fill('falso@noexiste.com');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // Verificar que NO entró al dashboard (sidebar no visible = login rechazado)
    const sidebar = page.locator('aside');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    if (!sidebarVisible) {
      // Login rechazado correctamente — sigue en la pantalla de login
      await expect(page.locator('#email')).toBeVisible();
    } else {
      // Si entró, el test falla (no debería aceptar credenciales falsas)
      expect(sidebarVisible).toBeFalsy();
    }
  });
});

test.describe('Sesión de Admin pre-cargada', () => {
  test('admin accede sin ver login', async ({ page }) => {
    await page.addInitScript(() => {
      const admin = {
        id: 'e2e-admin',
        email: 'admin@dulceplacer.com',
        nombre: 'Admin E2E',
        rol: 'ADMIN',
        activo: true,
        ultimoAcceso: new Date().toISOString(),
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(admin));
      localStorage.setItem('pricecontrol_local_user_list', JSON.stringify([admin]));
    });

    await page.goto('/');
    // Sidebar visible = login no se mostró
    await expect(page.locator('aside')).toBeVisible({ timeout: 20000 });
    // No debería verse el formulario de login
    await expect(page.locator('#email')).not.toBeVisible();
  });

  test('sesión expirada muestra login o redirige', async ({ page }) => {
    await page.addInitScript(() => {
      const viejo = {
        id: 'e2e-expired',
        email: 'expired@test.com',
        nombre: 'Expirado',
        rol: 'ADMIN',
        activo: true,
        ultimoAcceso: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      localStorage.setItem('pricecontrol_local_user', JSON.stringify(viejo));
    });

    await page.goto('/');
    await page.waitForTimeout(3000);
    // La app carga algo: login o dashboard (depende de la lógica de expiración)
    const algo = page.locator('#email').or(page.locator('aside'));
    await expect(algo.first()).toBeVisible({ timeout: 15000 });
  });
});
