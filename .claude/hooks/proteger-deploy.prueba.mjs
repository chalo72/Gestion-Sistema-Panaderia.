// Prueba de .claude/hooks/proteger-deploy.mjs — uso: node .claude/hooks/proteger-deploy.prueba.mjs
// Crea repos temporales (no toca el repo real ni la red) y alimenta el hook por stdin.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'proteger-deploy.mjs');
const base = mkdtempSync(path.join(tmpdir(), 'hook-deploy-'));
const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', cwd, ...a], { stdio: 'pipe' });

// "origin" local sin red + un clon en main con un commit
const origen = path.join(base, 'origen.git');
mkdirSync(origen);
g(origen, 'init', '--bare', '-b', 'main');
const nuevoClon = (nombre) => {
  const d = path.join(base, nombre);
  execFileSync('git', ['clone', '-q', origen, d], { stdio: 'pipe' });
  return d;
};
const semilla = nuevoClon('semilla');
g(semilla, 'checkout', '-q', '-b', 'main');
writeFileSync(path.join(semilla, 'a.txt'), 'a');
g(semilla, 'add', '.');
g(semilla, 'commit', '-q', '-m', 'inicio');
g(semilla, 'push', '-q', 'origin', 'main');

const clon = (nombre) => { const d = nuevoClon(nombre); g(d, 'checkout', '-q', 'main'); return d; };

const limpia = clon('main-limpia');
const sucia = clon('main-sucia');
writeFileSync(path.join(sucia, 'cambio.txt'), 'sin guardar');
const atrasada = clon('main-atrasada');
writeFileSync(path.join(semilla, 'b.txt'), 'b');
g(semilla, 'add', '.');
g(semilla, 'commit', '-q', '-m', 'otro');
g(semilla, 'push', '-q', 'origin', 'main');
g(atrasada, 'fetch', '-q'); // el hook NO hace fetch: aquí lo hacemos nosotros para simular "se sabe que hay más"
const otraRama = clon('rama-feat');
g(otraRama, 'checkout', '-q', '-b', 'feat/marketing-studio-y-ajustes');
const enWorktree = path.join(base, '.claude', 'worktrees', 'wt1');
mkdirSync(path.dirname(enWorktree), { recursive: true });
execFileSync('git', ['clone', '-q', origen, enWorktree], { stdio: 'pipe' });
const sinRepo = path.join(base, 'sin-repo');
mkdirSync(sinRepo);

const correr = (command, cwd) => {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command }, cwd }), encoding: 'utf8' });
  const salida = r.stdout.trim();
  return { code: r.status, decision: salida ? JSON.parse(salida).hookSpecificOutput.permissionDecision : null, razon: salida ? JSON.parse(salida).hookSpecificOutput.permissionDecisionReason : '' };
};

const casos = [
  ['rama que no es main', 'npx vercel --prod', otraRama, 'deny', /feat\/marketing-studio-y-ajustes/],
  ['main con cambios sin guardar', 'npx vercel --prod', sucia, 'ask', /cambios sin guardar/],
  ['main atrasada', 'npx vercel --prod', atrasada, 'ask', /atrasada/],
  ['main limpia (aquí main local ya está atrasada del "otro" commit del origen: se usa un clon al día)', 'npx vercel --prod', null, 'ask', /PRODUCCIÓN/],
  ['dentro de .claude/worktrees', 'npx vercel --prod', enWorktree, 'deny', /worktree/],
  ['desde app/', 'cd app && vercel --prod', limpia, 'deny', /app\//],
  ['sin repo git: no bloquea, cae al ask normal', 'npx vercel --prod', sinRepo, 'ask', /PRODUCCIÓN/],
  ['comando normal', 'git status', otraRama, null, /./],
];
// "main limpia y al día": clon nuevo hecho DESPUÉS del último push
casos[3][2] = clon('main-al-dia');

let fallos = 0;
for (const [nombre, cmd, cwd, esperado, patron] of casos) {
  const r = correr(cmd, cwd);
  const ok = r.code === 0 && r.decision === esperado && (esperado === null || patron.test(r.razon));
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}\n      -> ${r.decision ?? '(sin respuesta)'}${r.razon ? ': ' + r.razon : ''}`);
}
rmSync(base, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodos los casos pasaron');
process.exit(fallos ? 1 : 0);
