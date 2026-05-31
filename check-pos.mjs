import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5200';
const OUT = 'f:/Gestion Panaderia DUlce PLacer ORIGINAL/app/screenshots-pos';
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`📸 ${name}`);
}

const ctx = await browser.newContext({ viewport: MOBILE });
const page = await ctx.newPage();

// ── Login con espera real de la app ─────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(3000);

// Llenar y enviar login
await page.locator('input[type="text"], input[type="email"]').first().fill('Chalo8321@gmail.com');
await page.locator('input[type="password"]').first().fill('admin20267');
await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();

// Esperar a que la pantalla de login desaparezca (máx 10s)
try {
  await page.waitForSelector('input[type="password"]', { state: 'hidden', timeout: 10000 });
} catch {}
await page.waitForTimeout(3000);

// Esperar splash
try { await page.waitForSelector('text=SINCRONIZANDO', { state: 'hidden', timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

await shot(page, '01-logged-in');

// ── Navegar a Ventas/POS via botón directo del dashboard ────────────────────
// El dashboard tiene el botón "Nueva Venta / POS" visible sin abrir sidebar
const posBtn = page.getByText('Nueva Venta', { exact: false }).first();
if (await posBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await posBtn.click();
} else {
  // Abrir sidebar y hacer click
  await page.mouse.click(35, 28);
  await page.waitForTimeout(600);
  await shot(page, '01b-sidebar');
  await page.getByText('Ventas', { exact: false }).first().click();
}
await page.waitForTimeout(2500);
await shot(page, '02-pos-vista-completa');

// Captura del header superior (botones principales)
await shot(page, '03-pos-header');

// Scroll para ver la barra inferior del carrito
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await shot(page, '04-pos-bottom');

// Volver al tope
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);

// Listar todos los botones
const botones = await page.locator('button').allInnerTexts();
console.log('\n── Botones en POS ──');
botones.filter(t => t.trim()).forEach(t => console.log(' ·', t.trim().substring(0, 60)));

// HTML del area superior para diagnóstico
const header = await page.locator('header, [class*="header"], [class*="pos-header"], nav').first().innerHTML().catch(() => 'no header');
console.log('\nHeader HTML (primeros 500 chars):', header.substring(0, 500));

await ctx.close();
await browser.close();
console.log('\n✅ Screenshots en:', OUT);
