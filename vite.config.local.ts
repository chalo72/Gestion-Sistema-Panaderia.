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
