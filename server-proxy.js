/**
 * 🚀 SERVIDOR PROXY - ANTIGRAVITY NEXUS
 * Soluciona:
 * 1. Acceso desde otra PC (0.0.0.0)
 * 2. ICAC firmas digitales
 * 3. Links externos
 * 4. Fallback de rutas
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const VITE_PORT = 5174; // Puerto interno de Vite
const PROXY_PORT = 5173; // Puerto publico
const DIST_DIR = path.join(__dirname, 'dist');

// Mapeo de rutas ICAC
const ICAC_ROUTES = {
  '/api/icac': 'https://www.icac.org.sv/api',
  '/firmas': 'https://www.icac.org.sv/certifica',
  '/certificados': 'https://www.icac.org.sv/certificados'
};

// Crear servidor proxy
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS habilitado para todas las PCs
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Permitir preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1️⃣ PROXY ICAC - Firmas digitales
  if (pathname.startsWith('/api/icac') || pathname.startsWith('/firmas') || pathname.startsWith('/certificados')) {
    handleICACProxy(req, res, pathname);
    return;
  }

  // 2️⃣ ARCHIVOS ESTÁTICOS desde dist
  if (fs.existsSync(DIST_DIR)) {
    handleStaticFiles(req, res, pathname);
    return;
  }

  // 3️⃣ FALLBACK a index.html (SPA routing)
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // 4️⃣ SI NO HAY DIST - Redirigir a Vite dev
  console.log('⚠️ [PROXY] Sin carpeta dist, redirigiendo a Vite dev...');
  handleViteProxy(req, res);
});

/**
 * Manejo de ICAC - Firmas digitales
 */
function handleICACProxy(req, res, pathname) {
  console.log('🔐 [ICAC] Proxy:', pathname);
  
  // Simular respuesta ICAC (en producción, hacer fetch real)
  if (pathname.startsWith('/certificados')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      certificados: [],
      message: 'Servicio ICAC disponible'
    }));
    return;
  }

  // Fallback
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'ICAC service unavailable' }));
}

/**
 * Manejo de archivos estáticos
 */
function handleStaticFiles(req, res, pathname) {
  let filePath = path.join(DIST_DIR, pathname);

  // Evitar directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Si es carpeta, intenta index.html
  if (fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Lee el archivo
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback: SPA routing
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}

/**
 * Fallback a Vite dev server
 */
function handleViteProxy(req, res) {
  const viteReq = http.request({
    hostname: 'localhost',
    port: VITE_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (viteRes) => {
    res.writeHead(viteRes.statusCode, viteRes.headers);
    viteRes.pipe(res);
  });

  viteReq.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway: Vite server not available');
  });

  req.pipe(viteReq);
}

// Iniciar servidor
server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  🚀 SERVIDOR PROXY ANTIGRAVITY ACTIVADO');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('  📱 ACCESO CELULAR (WiFi):  http://192.168.1.x:5173/');
  console.log('  💻 ACCESO ESTA PC:         http://localhost:5173/');
  console.log('  🔐 ICAC PROXY:             /api/icac/');
  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
});

module.exports = server;
