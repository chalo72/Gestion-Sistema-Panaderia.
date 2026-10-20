/**
 * CONFIGURACIÓN PARA TRABAJAR EN EL PC — Dulce Placer
 * Creada 2026-09-19.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * 1) `vercel dev` no sirve en este proyecto: vercel.json tiene la regla
 *    { "source": "/(.*)", "destination": "/index.html" }, correcta en producción
 *    (hace funcionar las rutas de la app) pero que en desarrollo se traga TODO
 *    —hasta los archivos internos de Vite— y devuelve error 500.
 *
 * 2) `vite.config.ts` trae un plugin de desarrollo ("vite-api-agente") que
 *    intenta ejecutar la IA dentro del PC. En este equipo falla y devuelve
 *    "No hay proveedores de IA disponibles". Aquí ese plugin se desactiva y las
 *    llamadas a /api se reenvían al sitio publicado, que sí tiene las llaves y
 *    está verificado funcionando.
 *
 * No se modifica vercel.json ni vite.config.ts (ambos protegidos).
 *
 * RESULTADO: la app corre en tu PC —así puede hablarle a N8N en localhost sin
 * que el navegador bloquee nada— y la IA y la publicación directa siguen
 * funcionando contra el servidor publicado.
 *
 * CÓMO SE USA:
 *     npx vite --config vite.config.local.ts
 */
import { defineConfig, mergeConfig, type Plugin, type UserConfig, type UserConfigFnObject } from 'vite';
import configuracionBase from './vite.config';

const API_REMOTA = 'https://app-eight-sigma-13.vercel.app';

/**
 * 2026-10-09 (AUTORIZO Gonzalo) — Puente de cámaras: /__camara?u=http://192.168.x.x/...
 * El navegador no deja GRABAR imágenes de otro origen; pidiéndolas por aquí quedan "del mismo sitio"
 * y la Bitácora Visual sí puede hacer los micro-videos. Solo acepta IPs de la red del local
 * (no es un proxy abierto). Usuario:clave en la URL se envía como autenticación básica.
 * Ojo: cámaras que solo aceptan autenticación "digest" (algunas Hikvision) pueden responder 401.
 */
function puenteCamaras(): Plugin {
  const RE_PRIVADA = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  return {
    name: 'dp-puente-camaras',
    configureServer(server) {
      server.middlewares.use('/__camara', async (req, res) => {
        try {
          const u = new URL(req.url || '', 'http://local').searchParams.get('u') || '';
          const destino = new URL(u);
          if (destino.protocol !== 'http:' || !RE_PRIVADA.test(destino.hostname)) {
            res.statusCode = 400; res.end('Solo cámaras de la red local'); return;
          }
          const http = await import('node:http');
          const auth = destino.username ? `${decodeURIComponent(destino.username)}:${decodeURIComponent(destino.password)}` : undefined;
          destino.username = ''; destino.password = '';
          const pet = http.get(destino, { auth, timeout: 8000 }, (r) => {
            res.statusCode = r.statusCode || 502;
            if (r.headers['content-type']) res.setHeader('Content-Type', r.headers['content-type']);
            res.setHeader('Cache-Control', 'no-store');
            r.pipe(res);
            req.on('close', () => r.destroy());
          });
          pet.on('timeout', () => pet.destroy(new Error('tiempo agotado')));
          pet.on('error', () => { if (!res.headersSent) res.statusCode = 502; res.end(); });
        } catch {
          res.statusCode = 400; res.end('URL inválida');
        }
      });
    },
  };
}
const PLUGIN_A_DESACTIVAR = 'vite-api-agente';

/** Quita el plugin que atiende /api dentro del PC, para que mande al servidor. */
function sinPluginDeApiLocal(plugins: UserConfig['plugins']): UserConfig['plugins'] {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.filter((p) => {
    const nombre = (p as Plugin | undefined)?.name;
    return nombre !== PLUGIN_A_DESACTIVAR;
  });
}

export default defineConfig(async (entorno) => {
  const base = (await (configuracionBase as UserConfigFnObject)(entorno)) as UserConfig;

  const baseSinApiLocal: UserConfig = {
    ...base,
    plugins: sinPluginDeApiLocal(base.plugins),
  };

  return mergeConfig(baseSinApiLocal, {
    plugins: [puenteCamaras()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: false,
      proxy: {
        // Todo /api (la IA y la publicación directa) se atiende en el sitio publicado.
        '/api': {
          target: API_REMOTA,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  } satisfies UserConfig);
});
