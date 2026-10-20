// PreToolUse (Bash|PowerShell): frena despliegues a producción.
// - Bloquea (deny) si se intenta desplegar desde app/ (ver app/NO_DESPLEGAR_DESDE_AQUI.txt).
// - Bloquea (deny) si se intenta desplegar desde una rama que no sea `main` o desde un worktree
//   (.claude/worktrees/): producción solo se publica desde main, mezclando un PR en GitHub.
//   (2026-10-19: producción pasó de la rama feat, base local v9, a main, v8, y la app dejó de abrir.)
// - Pide confirmación (ask) si estás en main pero con cambios sin guardar o atrasada respecto a origin/main.
// - Pide confirmación (ask) para cualquier otro despliegue a producción.
// - Si git falla o no hay repo, no bloquea: cae al `ask` normal (el hook nunca debe romper nada).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DEPLOY = /vercel\b[^\n;&|]*--prod\b|npm\s+run\s+deploy\b|PUBLICAR_A_PRODUCCION/i;
const CD_APP = /\b(cd|set-location|pushd)\s+(\/d\s+)?["']?(\.[\\/])?app["'\\/]?(\s|$|;|&)/i;

// Ejecuta git en `cwd`; devuelve null si falla (sin repo, sin origin/main, etc.). Sin red.
const git = (cwd, ...args) => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const responder = (permissionDecision, permissionDecisionReason) => {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason },
  }));
  process.exit(0);
};

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = input.tool_input?.command || '';
  if (!DEPLOY.test(command)) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const desdeApp =
    existsSync(path.join(cwd, 'NO_DESPLEGAR_DESDE_AQUI.txt')) ||
    CD_APP.test(command) ||
    /--cwd[= ]["']?(\.[\\/])?app\b/i.test(command);

  if (desdeApp) {
    responder('deny',
      '🚫 Despliegue desde app/ bloqueado: esa copia sobrescribe producción con código viejo. ' +
      'Leé app/NO_DESPLEGAR_DESDE_AQUI.txt y desplegá desde la raíz con PUBLICAR_A_PRODUCCION.bat.');
  }

  if (/[\\/]\.claude[\\/]worktrees[\\/]/.test(path.resolve(cwd) + path.sep)) {
    responder('deny',
      '🚫 Estás en una carpeta de trabajo temporal (worktree), no en la carpeta oficial. ' +
      'Desde aquí no se publica a producción. Se publica solo desde main, mezclando el PR en GitHub.');
  }

  const rama = git(cwd, 'branch', '--show-current');
  if (rama !== null && rama !== 'main') {
    responder('deny',
      `🚫 Estás en la rama "${rama || '(ninguna, HEAD suelto)'}". A producción solo se publica desde main ` +
      '(mezclando un PR en GitHub). Publicar desde otra rama deja la app inservible para quien ya usó ' +
      'la versión de la base local más nueva.');
  }

  if (rama === 'main') {
    const avisos = [];
    const sucio = git(cwd, 'status', '--porcelain');
    if (sucio) {
      avisos.push('hay cambios sin guardar en la carpeta: se publicaría lo que hay aquí, no lo que está en GitHub');
    }
    const atrasados = parseInt(git(cwd, 'rev-list', '--count', 'HEAD..origin/main') || '0', 10);
    if (atrasados > 0) {
      avisos.push(`tu main local está atrasada ${atrasados} cambio(s) respecto a origin/main (revisión sin red; puede estar aún más atrasada)`);
    }
    if (avisos.length) {
      responder('ask',
        '⚠️ Estás en main pero: ' + avisos.join('; ') + '. ' +
        'Lo normal es publicar mezclando el PR en GitHub. ¿Seguro que quieres publicar desde esta carpeta?');
    }
  }

  responder('ask',
    '🚀 Despliegue a PRODUCCIÓN (Vercel). Antes de aprobar: ¿comparaste `vercel ls` y CORE_MEMORY.md ' +
    'para confirmar que esta copia tiene el trabajo más reciente?');
} catch {
  process.exit(0);
}
