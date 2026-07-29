const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const text = fs.readFileSync(envPath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  });
  return env;
}

const env = loadEnv();
const CLOUD_NAME = env.CLOUD_NAME;
const CLOUDINARY_API_KEY = env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = env.CLOUDINARY_API_SECRET;
const PORT = process.env.PORT || 3000;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filepath) {
  const ext = path.extname(filepath).slice(1);
  const mimeTypes = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    json: 'application/json',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function deleteCloudinaryImage(publicId) {
  if (!CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are not configured.');
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
  const form = new URLSearchParams();
  form.append('public_id', publicId);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('api_secret', CLOUDINARY_API_SECRET);

  const response = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary delete failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (data.result !== 'ok' && data.result !== 'not found') {
    throw new Error(`Cloudinary delete returned unexpected result: ${JSON.stringify(data)}`);
  }
  return data;
}

const publicDir = __dirname;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/delete-image') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const publicId = payload.public_id;
        if (!publicId) {
          sendJson(res, 400, { error: 'public_id is required' });
          return;
        }
        const result = await deleteCloudinaryImage(publicId);
        sendJson(res, 200, { success: true, result });
      } catch (error) {
        console.error('Delete image error:', error);
        sendJson(res, 500, { error: error.message || 'Delete failed' });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fullPath = path.join(publicDir, requestedPath);
    sendFile(res, fullPath);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
