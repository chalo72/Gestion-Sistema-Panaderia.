import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from 'vite-plugin-pwa'
/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cargado primero, cacheado siempre
          'vendor-react': ['react', 'react-dom'],
          // UI primitivos Radix — estables, raramente cambian
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            'lucide-react',
          ],
          // Gráficos — solo se necesitan en Reportes/Dashboard
          'vendor-charts': ['recharts'],
          // Utilidades pesadas — solo cuando se usan
          'vendor-ocr': ['tesseract.js'],
          'vendor-excel': ['xlsx'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
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
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        skipWaiting: true,       // Nuevo SW toma control sin esperar
        clientsClaim: true,      // Nuevo SW reclama todos los clientes inmediatamente
        // Limpiar caches viejos al activar nuevo SW
        cleanupOutdatedCaches: true,
        // Navigation preload → acelera carga tras activar nuevo SW
        navigationPreload: true,
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
            // Assets con hash (JS/CSS de build): el precache se encarga,
            // NO cachear con runtimeCaching para evitar versiones fantasma
            urlPattern: /\/assets\/.*\.[a-f0-9]+\.(js|css)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'v4-assets-hashed',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año (hash cambia = nuevo archivo)
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Imágenes y fuentes: cache largo con revalidación
            urlPattern: /\.(png|jpg|jpeg|webp|gif|svg|woff2|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'v4-media-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Todo lo demás: red primero, fallback a cache
            urlPattern: /.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'v4-app-cache',
              networkTimeoutSeconds: 5, // Si no responde en 5s, usa cache
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
              },
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
});
