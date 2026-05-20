import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

await ctx.addInitScript(() => {
  const user = { id: 'owner-local-id', email: 'Chalo8321@gmail.com', nombre: 'Chalo', apellido: 'Dueño', rol: 'ADMIN', activo: true, createdAt: new Date().toISOString(), sessionExpiry: Date.now() + 86400000 };
  localStorage.setItem('pricecontrol_local_user_list', JSON.stringify([user]));
  localStorage.setItem('pricecontrol_local_user', JSON.stringify(user));
});

const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => !document.body.innerText.includes('SINCRONIZANDO'), { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(2500);

const passInput = await page.$('input[type="password"]');
if (passInput) {
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) await emailInput.fill('Chalo8321@gmail.com');
  await passInput.fill('admin2026');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
}

await page.screenshot({ path: 'ss_01_dashboard.png' });
console.log('SS1: dashboard');

// Click Ventas al Mayor
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const t = all.find(el => el.children.length === 0 && el.textContent && el.textContent.trim() === 'Ventas al Mayor');
  if (t) t.click();
});
await page.waitForTimeout(2500);

await page.screenshot({ path: 'ss_02_mayoristas.png' });
console.log('SS2: mayoristas');

const content = await page.evaluate(() => document.body.innerText.slice(0, 800));
console.log('CONTENIDO:\n', content);

await browser.close();
