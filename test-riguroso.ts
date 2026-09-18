import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

async function checkApp() {
  console.log('Starting preview server...');
  const child = spawn('npm', ['run', 'preview'], { cwd: './app', shell: true });
  
  // Wait a bit for server to start
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Launching puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 30000 });
  
  console.log('Errors found:');
  console.log(errors);

  await browser.close();
  child.kill();
  process.exit(0);
}

checkApp().catch(e => {
  console.error(e);
  process.exit(1);
});
