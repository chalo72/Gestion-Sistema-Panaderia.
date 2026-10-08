// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): pide confirmación antes de tocar
// cualquier archivo listado en LOCKED_RESOURCES.md (protocolo "AUTORIZO").
import { readFileSync } from 'node:fs';
import path from 'node:path';

const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const filePath = input.tool_input?.file_path || input.tool_input?.notebook_path;
  if (!filePath) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const locked = readFileSync(path.join(root, 'LOCKED_RESOURCES.md'), 'utf8')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('- '))
    .flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((m) => norm(m[1])));

  const rel = norm(path.relative(root, path.resolve(root, filePath)));
  if (!locked.includes(rel)) process.exit(0);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `🔒 ${rel} está en LOCKED_RESOURCES.md. Solo aprobá si escribiste "AUTORIZO" para este cambio.`,
    },
  }));
} catch {
  // Si el hook falla (p. ej. falta LOCKED_RESOURCES.md) no bloquea el trabajo.
  process.exit(0);
}
