import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Cargar credenciales E2E desde .env.e2e (no se sube al repositorio)
config({ path: '.env.e2e', override: false });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 90_000,           // cada test tiene máximo 90s (login Supabase tarda)
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Levanta el servidor dev automáticamente antes de los tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,   // si ya está corriendo, no lo mata
    timeout: 30_000,
  },
});
