import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { VitePWA } from 'vite-plugin-pwa'
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar TODAS las variables de .env (sin prefijo) para inyectarlas en process.env
  // Esto permite que api/agente.ts acceda a ANTHROPIC_API_KEY en modo dev
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    base: "/",
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React core — chunk estable, hash no cambia hasta que React cambie de versión
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react/jsx-runtime')) {
              return 'vendor-react';
            }
            // Supabase
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            // Firebase
            if (id.includes('node_modules/firebase/')) {
              return 'vendor-firebase';
            }
            // Gráficos — lazy, solo en Reportes
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
              return 'vendor-charts';
            }
            // Excel — lazy, solo en exportaciones
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-excel';
            }
            // OCR — lazy, solo en escaneo de facturas
            if (id.includes('node_modules/tesseract')) {
              return 'vendor-ocr';
            }
            // UI primitivos Radix + utilidades — estables
            if (
              id.includes('node_modules/@radix-ui/') ||
              id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/sonner')
            ) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
    plugins: [
      react(),
      // ── Plugin dev: sirve /api/agente sin necesitar Vercel local ──────────
      {
        name: 'vite-api-agente',
        configureServer(server) {
          server.middlewares.use('/api/agente', async (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.writeHead(405);
              return res.end('Method not allowed');
            }
            try {
              // Leer body del request
              const chunks: Buffer[] = [];
              await new Promise<void>((resolve, reject) => {
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', resolve);
                req.on('error', reject);
              });
              const body = Buffer.concat(chunks).toString();

              // Crear Request compatible con el Edge handler
              const request = new Request('http://localhost/api/agente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
              });

              // Cargar y ejecutar el handler via SSR (soporta TypeScript)
              const mod = await server.ssrLoadModule('/api/agente.ts');
              const response = await (mod.default as (r: Request) => Promise<Response>)(request);

              res.writeHead(response.status, {
                'Content-Type': response.headers.get('Content-Type') || 'text/plain; charset=utf-8',
              });

              if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(Buffer.from(value));
                }
              }
              res.end();
            } catch (e: any) {
              console.error('[api-agente dev]', e?.message || e);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: e?.message || 'Internal server error' }));
            }
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        // Iron-Clad: desactivado para que el SW no se suicide y limpie caches/IndexedDB
        selfDestroying: false,
        includeAssets: ['favicon.ico', 'logo.png', 'logo2.png', 'logo_panaderia.png'],
        manifest: {
          name: 'Dulce Placer - GESTIÓN',
          short_name: 'DP Gestión',
          description: 'Sistema de Gestión Panadería',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          // Excluir chunks pesados que solo se usan bajo demanda (Reportes, Exportar, OCR)
          globIgnores: ['**/vendor-charts*', '**/vendor-excel*', '**/vendor-ocr*'],
          globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
          skipWaiting: true,       // Nuevo SW toma control sin esperar
          clientsClaim: true,      // Nuevo SW reclama todos los clientes inmediatamente
          // Limpiar caches viejos al activar nuevo SW
          cleanupOutdatedCaches: true,
          // Navigation preload desactivado → evita advertencia "preloadResponse cancelled"
          navigationPreload: false,
          runtimeCaching: [
            {
              // version.json: siempre desde red para detectar nuevas versiones
              urlPattern: /\/version\.json$/i,
              handler: 'NetworkOnly',
            },
            {
              // Supabase API: siempre desde red (datos en tiempo real)
              urlPattern: /supabase\.co/i,
              handler: 'NetworkOnly',
            },
            {
              // Imágenes y fuentes: cache largo con revalidación
              urlPattern: /\.(png|jpg|jpeg|webp|gif|svg|woff2|ico)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-media-v5',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Navegación principal: Red primero, fallback a cache
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-shell-v5',
                networkTimeoutSeconds: 2,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: false,
          type: 'module'
        }
      })
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/lib/**', 'src/hooks/**'],
        exclude: ['src/**/*.test.*', 'src/lib/seed-data.ts'],
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false,
      open: false,
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false,
    },
  };
});
