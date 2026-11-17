// PreToolUse (Bash|PowerShell): frena despliegues a producción.
// - Bloquea (deny) si se intenta desplegar desde app/ (ver app/NO_DESPLEGAR_DESDE_AQUI.txt).
// - Pide confirmación (ask) para cualquier otro despliegue a producción.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DEPLOY = /vercel\b[^\n;&|]*--prod\b|npm\s+run\s+deploy\b|PUBLICAR_A_PRODUCCION/i;
const CD_APP = /\b(cd|set-location|pushd)\s+(\/d\s+)?["']?(\.[\\/])?app["'\\/]?(\s|$|;|&)/i;

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

  responder('ask',
    '🚀 Despliegue a PRODUCCIÓN (Vercel). Antes de aprobar: ¿comparaste `vercel ls` y CORE_MEMORY.md ' +
    'para confirmar que esta copia tiene el trabajo más reciente?');
} catch {
  process.exit(0);
}
