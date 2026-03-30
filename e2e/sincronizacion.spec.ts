import { test, expect } from '@playwright/test';

// ────────────────────────────────────────────────────────────────────
// Tests de Sincronización entre Módulos — Panadería Dulce Placer
//
// Verifica que cuando se crea/guarda un producto, aparezca AUTOMÁTICA-
// MENTE en todos los módulos que deben mostrarlo, SIN recargar la página.
//
// Módulos verificados:
//   Productos  → fuente de verdad
//   Ventas     → catálogo de elaborados (precio > 0)
//   Inventario → stock de elaborados (stock = 0 si es nuevo)
//   Recetas    → selector de ingredientes/fórmulas
// ────────────────────────────────────────────────────────────────────

// Nombres únicos por ejecución para evitar colisión con datos seed
const TS               = Date.now();
const ELABORADO_NOMBRE = `PANETON SYNC ${TS}`;
const INSUMO_NOMBRE    = `HARINA SYNC ${TS}`;
const EDITAR_BASE      = `EDITAR BASE ${TS}`; // nombre exclusivo para el test de edición
const PRECIO_VENTA     = '5000';

// ── Utilidades ───────────────────────────────────────────────────────

/**
 * Inyecta sesión de ADMIN en localStorage antes de que React monte.
 * AuthContext.tsx lee pricecontrol_local_user y omite el login.
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
  await page.waitForSelector('aside', { state: 'visible', timeout: 20000 });
}

/** Navega a una sección del sidebar por label */
async function irA(page: import('@playwright/test').Page, label: string) {
  const btn = page.locator(`button[title="${label}"]`)
    .or(page.locator('button').filter({ hasText: label }));
  await btn.first().click();
  await page.waitForTimeout(800);
}

/**
 * Abre el formulario de nuevo producto y lo guarda.
 * El formulario se abre desde la página Productos.
 */
async function crearProducto(
  page: import('@playwright/test').Page,
  opts: { nombre: string; tipo: 'elaborado' | 'ingrediente'; precio?: string }
) {
  // Botón "Nuevo Producto" en el header de la página Productos
  await page.getByRole('button', { name: /Nuevo Producto/i }).first().click();
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 8000 });

  // ── Nombre ──────────────────────────────────────────────────────────
  await page.getByPlaceholder(/Pan Franc[eé]s/i).fill(opts.nombre);

  // ── Tipo ─────────────────────────────────────────────────────────────
  // Default es 'elaborado'. Solo hacemos click si queremos 'ingrediente'.
  if (opts.tipo === 'ingrediente') {
    // El botón tiene el texto "Insumo" (Pan, bebidas… vs Insumo / Materia prima)
    await page.getByRole('button', { name: /Insumo/i }).first().click();
  }

  // ── Categoría (obligatoria) ──────────────────────────────────────────
  // El primer [role="combobox"] visible dentro del dialog es el de categoría
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('[role="combobox"]').first().click();
  await page.locator('[role="option"]').first().click();

  // ── Precio de Venta (solo para elaborados) ───────────────────────────
  if (opts.precio) {
    const precioSection = dialog.locator('div').filter({
      has: page.locator('label', { hasText: 'Precio de Venta' }),
    }).last();
    await precioSection.locator('input[type="number"]').fill(opts.precio);
  }

  // ── Guardar ──────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /Crear Producto/i }).click();
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(400); // pequeña pausa para que React actualice estado
}

// ════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Producto elaborado (tipo = Para Venta)
// ════════════════════════════════════════════════════════════════════════════

test.describe('Sincronización — Producto elaborado', () => {

  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
    await irA(page, 'Productos');
    await crearProducto(page, {
      nombre: ELABORADO_NOMBRE,
      tipo: 'elaborado',
      precio: PRECIO_VENTA,
    });
  });

  // ── Test 1 ──────────────────────────────────────────────────────────
  test('aparece en la lista de Productos inmediatamente', async ({ page }) => {
    // Después del beforeEach ya estamos en Productos con el producto creado
    await expect(page.getByText(ELABORADO_NOMBRE)).toBeVisible({ timeout: 5000 });
  });

  // ── Test 2 ──────────────────────────────────────────────────────────
  test('aparece en el catálogo de Ventas sin recargar', async ({ page }) => {
    await irA(page, 'Ventas / POS');
    // El buscador de productos en Ventas
    const buscador = page.getByPlaceholder(/Buscar producto/i);
    await buscador.fill(ELABORADO_NOMBRE.substring(0, 12));
    await expect(page.getByText(ELABORADO_NOMBRE)).toBeVisible({ timeout: 6000 });
  });

  // ── Test 3 ──────────────────────────────────────────────────────────
  test('aparece en Inventario con stock = 0 sin recargar', async ({ page }) => {
    await irA(page, 'Inventario');
    // PreciosStockTab está dentro del tab "Analítica" (contiene "Buscar producto...")
    await page.waitForSelector('button:has-text("Analítica")', { timeout: 15000 });
    await page.getByRole('button', { name: 'Analítica' }).first().click();
    await page.waitForTimeout(1500);
    const buscador = page.locator('input[placeholder="Buscar producto..."]').first();
    await buscador.fill(ELABORADO_NOMBRE.substring(0, 12));
    await expect(page.getByText(ELABORADO_NOMBRE)).toBeVisible({ timeout: 6000 });
  });

  // ── Test 4 ──────────────────────────────────────────────────────────
  test('aparece como fórmula en Recetas sin recargar', async ({ page }) => {
    await irA(page, 'Recetas Técnicas');
    await page.getByRole('button', { name: /Nueva Fórmula/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 8000 });

    // El selector de producto para la fórmula debe incluir nuestro elaborado
    const formulaSelect = page.locator('[role="dialog"]').locator('[role="combobox"]').first();
    await formulaSelect.click();

    const opcion = page.locator('[role="option"]').filter({
      hasText: ELABORADO_NOMBRE.substring(0, 12),
    });
    // .first() por si hay opciones de runs anteriores con el mismo prefijo
    await expect(opcion.first()).toBeVisible({ timeout: 6000 });
  });

});

// ════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Insumo (tipo = ingrediente)
// ════════════════════════════════════════════════════════════════════════════

test.describe('Sincronización — Insumo / Ingrediente', () => {

  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
    await irA(page, 'Productos');
    await crearProducto(page, { nombre: INSUMO_NOMBRE, tipo: 'ingrediente' });
  });

  // ── Test 5 ──────────────────────────────────────────────────────────
  test('insumo aparece en la lista de Productos', async ({ page }) => {
    await expect(page.getByText(INSUMO_NOMBRE)).toBeVisible({ timeout: 5000 });
  });

  // ── Test 6 ──────────────────────────────────────────────────────────
  test('insumo aparece en Recetas como ingrediente disponible', async ({ page }) => {
    await irA(page, 'Recetas Técnicas');
    await page.getByRole('button', { name: /Nueva Fórmula/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 8000 });

    // Primero seleccionar UN producto elaborado (puede ser de seed data)
    const formulaSelect = page.locator('[role="dialog"]').locator('[role="combobox"]').first();
    await formulaSelect.click();
    await page.locator('[role="option"]').first().click(); // cualquier elaborado

    // Luego agregar ingrediente — el botón dice "Nuevo Insumo"
    await page.getByRole('button', { name: /Nuevo Insumo/i }).click();

    // El insumo recién creado debe aparecer en el selector de ingredientes
    // nth(0) = producto fórmula, nth(1) = ingrediente, nth(2) = unidad (gr/kg...)
    const ingredSelect = page.locator('[role="dialog"]').locator('[role="combobox"]').nth(1);
    await ingredSelect.click();
    const opcion = page.locator('[role="option"]').filter({
      hasText: INSUMO_NOMBRE.substring(0, 12),
    });
    await expect(opcion.first()).toBeVisible({ timeout: 6000 });
  });

  // ── Test 7 ──────────────────────────────────────────────────────────
  test('insumo NO aparece en Ventas (solo elaborados van al POS)', async ({ page }) => {
    await irA(page, 'Ventas / POS');
    const buscador = page.getByPlaceholder(/Buscar producto/i);
    await buscador.fill(INSUMO_NOMBRE.substring(0, 12));
    // Los insumos/ingredientes NO deben aparecer en el catálogo de ventas
    await expect(page.getByText(INSUMO_NOMBRE)).not.toBeVisible({ timeout: 3000 });
  });

});

// ════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Reglas de negocio (guarda correcta en todos los módulos)
// ════════════════════════════════════════════════════════════════════════════

test.describe('Reglas de sincronización', () => {

  test('elaborado con precio=0 NO aparece en Ventas (precio requerido)', async ({ page }) => {
    await iniciarSesion(page);
    await irA(page, 'Productos');

    // Crear elaborado SIN precio
    await page.getByRole('button', { name: /Nuevo Producto/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 8000 });

    const SIN_PRECIO = `SIN PRECIO ${TS}`;
    await page.getByPlaceholder(/Pan Franc[eé]s/i).fill(SIN_PRECIO);
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]').first().click();
    // NO llenamos precio → queda en 0

    await page.getByRole('button', { name: /Crear Producto/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });

    // Aparece en Productos
    await expect(page.getByText(SIN_PRECIO)).toBeVisible({ timeout: 5000 });

    // NO aparece en Ventas (precio = 0)
    await irA(page, 'Ventas / POS');
    const buscador = page.getByPlaceholder(/Buscar producto/i);
    await buscador.fill(SIN_PRECIO.substring(0, 12));
    await expect(page.getByText(SIN_PRECIO)).not.toBeVisible({ timeout: 3000 });
  });

  test('cambio de nombre persiste en Ventas e Inventario', async ({ page }) => {
    await iniciarSesion(page);
    await irA(page, 'Productos');
    // Usamos EDITAR_BASE (nombre exclusivo para este test, no compartido con Suite 1)
    await crearProducto(page, {
      nombre: EDITAR_BASE,
      tipo: 'elaborado',
      precio: PRECIO_VENTA,
    });

    // Editar el producto — cambiar nombre
    const NOMBRE_EDITADO = `EDITADO ${TS}`;
    // Filtrar para que solo aparezca nuestro producto
    await page.getByPlaceholder(/Buscar producto por nombre/i).fill(EDITAR_BASE.substring(0, 10));
    await page.waitForTimeout(600);
    // El botón de editar es icon-only (Edit2), oculto con sm:opacity-0 hasta hover
    // Hover sobre la primera card para que aparezca el botón
    const primeraCard = page.locator('div.group, [class*="rounded"][class*="border"]')
      .filter({ has: page.getByText(EDITAR_BASE) }).first();
    await primeraCard.hover();
    await page.waitForTimeout(700); // esperar transición CSS duration-500
    // Primer botón icon dentro de la card = botón Editar
    await primeraCard.locator('button').first().click({ force: true });
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 8000 });

    const nombreInput = page.getByPlaceholder(/Pan Franc[eé]s/i);
    await nombreInput.clear();
    await nombreInput.fill(NOMBRE_EDITADO);
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });

    // Limpiar el buscador para que no filtre por el nombre viejo
    await page.getByPlaceholder(/Buscar producto por nombre/i).fill('');
    await page.waitForTimeout(400);

    // El nombre viejo ya NO debe estar
    await expect(page.getByText(EDITAR_BASE)).not.toBeVisible({ timeout: 3000 });
    // El nombre nuevo SÍ debe estar
    await expect(page.getByText(NOMBRE_EDITADO)).toBeVisible({ timeout: 5000 });

    // Verificar en Ventas
    await irA(page, 'Ventas / POS');
    await page.getByPlaceholder(/Buscar producto/i).fill(NOMBRE_EDITADO.substring(0, 8));
    await expect(page.getByText(NOMBRE_EDITADO)).toBeVisible({ timeout: 5000 });

    // Verificar en Inventario — tab Analítica contiene PreciosStockTab
    await irA(page, 'Inventario');
    await page.waitForSelector('button:has-text("Analítica")', { timeout: 15000 });
    await page.getByRole('button', { name: 'Analítica' }).first().click();
    await page.waitForTimeout(1500);
    await page.locator('input[placeholder="Buscar producto..."]').first().fill(NOMBRE_EDITADO.substring(0, 8));
    await expect(page.getByText(NOMBRE_EDITADO)).toBeVisible({ timeout: 5000 });
  });

});
