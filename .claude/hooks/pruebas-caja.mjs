#!/usr/bin/env node
/**
 * HOOK — Pruebas de caja (Dulce Placer)
 * Creado 2026-11-07 por Claude a pedido de Gonzalo, después de que el PC reabriera
 * cajas ya cerradas y una caja se cerrara en todos los equipos a la vez.
 *
 * QUÉ HACE
 *   Después de que un agente edita un archivo que toca la caja o la sincronización,
 *   corre las pruebas de caja de esa misma carpeta (sirve también en worktrees).
 *   Si alguna falla, le avisa al agente (código 2) para que lo arregle antes de seguir.
 *
 * CÓMO SE ACTIVA (en .claude/settings.json, dentro de "PostToolUse"):
 *   { "matcher": "Edit|Write|MultiEdit", "hooks": [ { "type": "command",
 *     "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/pruebas-caja.mjs\"", "timeout": 180 } ] }
 *
 * NUNCA modifica código. Si no hay node_modules, no hay pruebas o algo falla,
 * se queda callado y deja trabajar.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ARCHIVOS_CAJA = /(useVentas|useRealtimeSync|usePriceControl|sync-merge-local-gana|supabase-db|database|ControlCaja|Gastos|AperturaCajaModal|CierreCajaModal)\.(ts|tsx)$/;
const PRUEBAS = [
  'src/lib/caja-cierre-gana.test.ts',
  'src/hooks/useVentas.test.tsx',
  'src/lib/sync-merge-local-gana.test.ts',
];

function leerStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function raizDelProyecto(archivo) {
  let dir = dirname(resolve(archivo));
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src'))) return dir;
    const arriba = dirname(dir);
    if (arriba === dir) break;
    dir = arriba;
  }
  return null;
}

try {
  const entrada = JSON.parse(leerStdin() || '{}');
  const archivo = String(entrada?.tool_input?.file_path || '').replace(/\\/g, '/');
  if (!archivo || !ARCHIVOS_CAJA.test(archivo) || /\.test\.(ts|tsx)$/.test(archivo)) process.exit(0);

  const raiz = raizDelProyecto(archivo);
  if (!raiz || !existsSync(join(raiz, 'node_modules', 'vitest'))) process.exit(0);

  const pruebas = PRUEBAS.filter((p) => existsSync(join(raiz, p)));
  if (pruebas.length === 0) process.exit(0);

  const r = spawnSync('npx', ['vitest', 'run', ...pruebas], {
    cwd: raiz, encoding: 'utf8', shell: true, timeout: 170_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (r.error || r.status === null) process.exit(0); // tiempo agotado u otro problema: no molestar
  if (r.status !== 0) {
    const salida = `${r.stdout || ''}\n${r.stderr || ''}`;
    const fallos = salida.split(/\r?\n/).filter((l) => /FAIL|×|AssertionError|Error:/.test(l)).slice(0, 15).join('\n');
    process.stderr.write(
      `🔒 Pruebas de caja FALLARON después de editar ${archivo}.\n` +
      `Reglas: una caja cerrada nunca se reabre; cada equipo usa su propia caja; la nube trae updatedAt.\n` +
      `Ver skill "caja-cerrada-no-se-reabre-dulce-placer". Fallos:\n${fallos}\n`,
    );
    process.exit(2);
  }
  process.exit(0);
} catch {
  process.exit(0);
}
