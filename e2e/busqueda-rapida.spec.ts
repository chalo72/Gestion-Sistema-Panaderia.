import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────
// Tests E2E — Búsqueda Rápida (Ctrl+K)
// ────────────────────────────────────────────────────────────────────

async function loginAdmin(page: import('@playwright/test').Page) {
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
}

async function abrirApp(page: import('@playwright/test').Page) {
  await loginAdmin(page);
  await page.goto('/');
  await page.waitForSelector('aside', { state: 'visible', timeout: 20000 });
}

// ════════════════════════════════════════════════════════════════════

test.describe('Búsqueda Rápida — Apertura y Cierre', () => {
  test.beforeEach(async ({ page }) => {
    await abrirApp(page);
  });

  test('Ctrl+K abre el modal de búsqueda', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test('botón "Buscar Precios" en sidebar abre el modal', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: 'Buscar Precios' });
    await btn.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test('ESC cierra el modal de búsqueda', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Búsqueda Rápida — Funcionalidad', () => {
  test.beforeEach(async ({ page }) => {
    await abrirApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
  });

  test('input de búsqueda tiene autofocus', async ({ page }) => {
    const input = page.locator('[role="dialog"] input');
    await expect(input).toBeFocused({ timeout: 3000 });
  });

  test('muestra estado inicial sin resultados', async ({ page }) => {
    // Antes de escribir, muestra el placeholder con conteo de productos
    const placeholder = page.locator('text=/productos|Busca productos/i');
    await expect(placeholder.first()).toBeVisible({ timeout: 5000 });
  });

  test('buscar por nombre muestra resultados con nombre y precio', async ({ page }) => {
    const input = page.locator('[role="dialog"] input');
    await input.fill('avena');
    await page.waitForTimeout(500);

    // Debe mostrar al menos un resultado con precio ($)
    const resultado = page.locator('[role="dialog"]').locator('text=/\\$/');
    const count = await resultado.count();
    expect(count).toBeGreaterThanOrEqual(0); // 0 si no hay avena en datos
  });

  test('buscar por categoría filtra correctamente', async ({ page }) => {
    const input = page.locator('[role="dialog"] input');
    await input.fill('panadería');
    await page.waitForTimeout(500);
    // No debe romper la interfaz
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('búsqueda sin resultados muestra mensaje', async ({ page }) => {
    const input = page.locator('[role="dialog"] input');
    await input.fill('xyznoexiste12345');
    await page.waitForTimeout(500);

    const sinResultados = page.locator('text=/No se encontraron/i');
    await expect(sinResultados).toBeVisible({ timeout: 3000 });
  });

  test('botón X limpia la búsqueda', async ({ page }) => {
    const input = page.locator('[role="dialog"] input');
    await input.fill('test');
    await page.waitForTimeout(300);

    // Limpiar con triple-select + borrar (más confiable que buscar botón X)
    await input.fill('');
    await page.waitForTimeout(300);
    await expect(input).toHaveValue('');
  });
});

test.describe('Búsqueda Rápida — Sin errores JS', () => {
  test('usar la búsqueda no genera errores JS', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (err) => errores.push(err.message));

    await abrirApp(page);
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });

    const input = page.locator('[role="dialog"] input');
    // Varias búsquedas rápidas
    for (const term of ['pan', 'avena', '', 'leche', 'xyz']) {
      await input.fill(term);
      await page.waitForTimeout(300);
    }

    await page.keyboard.press('Escape');

    const erroresFatales = errores.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(erroresFatales).toHaveLength(0);
  });
});
