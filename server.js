const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const { APPS, launchApp } = require('./app-launcher');

let config = {};
try {
  const cfgPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(cfgPath)) {
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {}

const PORT = process.env.PORT || config.port || 3000;
const BIN_PATH = path.join(__dirname, 'bin', 'pc-control.exe');

// Auto-compile native helper if missing on first run
function ensureNativeBinary() {
  if (!fs.existsSync(BIN_PATH)) {
    console.log('[TabDeck] Native hardware controller missing. Auto-compiling via csc.exe...');
    try {
      const { execSync } = require('child_process');
      execSync('powershell -ExecutionPolicy Bypass -File build-helper.ps1', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
      console.warn('[TabDeck] Auto-compile failed. Run "npm run build:helper" manually.');
    }
  }
}
ensureNativeBinary();

// Detect local IPv4 address (prioritize Wi-Fi or active Ethernet)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let wifiIp = null;
  let fallbackIp = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (/wi-?fi|wlan/i.test(name)) {
          return iface.address;
        }
        if (!/vmware|virtual|loopback/i.test(name) && !wifiIp) {
          wifiIp = iface.address;
        }
        fallbackIp = iface.address;
      }
    }
  }
  return wifiIp || fallbackIp;
}

const LOCAL_IP = getLocalIp();

// Execute native binary command safely
function runNative(args) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(BIN_PATH)) {
      return reject(new Error('pc-control.exe not compiled yet. Run npm run build:helper'));
    }
    execFile(BIN_PATH, args, (err, stdout, stderr) => {
      if (err) {
        try {
          return resolve(JSON.parse(stdout));
        } catch (e) {
          return reject(err);
        }
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (e) {
        resolve({ status: 'ok', raw: stdout.trim() });
      }
    });
  });
}

// Get system state (volume, mute, brightness)
async function getFullStatus() {
  let volume = 50;
  let muted = false;
  let brightness = 100;

  try {
    const volRes = await runNative(['volume', 'get']);
    if (volRes && typeof volRes.volume !== 'undefined') {
      volume = volRes.volume;
      muted = !!volRes.muted;
    }
  } catch (e) {}

  try {
    const brightRes = await runNative(['brightness', 'get']);
    if (brightRes && typeof brightRes.brightness !== 'undefined') {
      brightness = brightRes.brightness;
    }
  } catch (e) {}

  return {
    volume,
    muted,
    brightness,
    hostname: os.hostname(),
    platform: os.platform(),
    localIp: LOCAL_IP,
    port: PORT,
    timestamp: Date.now()
  };
}

// Static MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API Endpoints
  if (url.pathname === '/api/info') {
    const tabletUrl = `http://${LOCAL_IP}:${PORT}`;
    const qrSvg = await QRCode.toString(tabletUrl, { type: 'svg', margin: 2 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      hostname: os.hostname(),
      localIp: LOCAL_IP,
      port: PORT,
      tabletUrl,
      qrSvg,
      apps: Object.keys(APPS).map(k => ({
        id: k,
        name: APPS[k].name,
        category: APPS[k].category,
        color: APPS[k].color
      }))
    }));
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    const status = await getFullStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(status));
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { type, action, value } = payload;
        let result = { status: 'ok' };

        if (type === 'app') {
          result = launchApp(action);
        } else if (type === 'volume') {
          if (action === 'set') {
            result = await runNative(['volume', 'set', String(value)]);
          } else if (action === 'mute') {
            result = await runNative(['volume', 'mute', String(value)]);
          } else if (action === 'up' || action === 'down') {
            result = await runNative(['volume', action, String(value || 5)]);
          }
          broadcastState();
        } else if (type === 'brightness') {
          result = await runNative(['brightness', 'set', String(value)]);
          broadcastState();
        } else if (type === 'media') {
          result = await runNative(['media', action]);
        } else if (type === 'window') {
          result = await runNative(['window', action]);
        } else if (type === 'keyboard') {
          result = await runNative(['keyboard', action]);
        } else if (type === 'system') {
          result = await runNative(['system', action, String(value || '')]);
        } else if (type === 'mouse') {
          result = await runNative(['mouse', action, String(payload.dx || payload.p1 || 0), String(payload.dy || payload.p2 || 0)]);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  // Static file serving from public/
  let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);

  // Security: avoid path traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing if needed
      filePath = path.join(__dirname, 'public', 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// Setup WebSocket server for 0-latency live tablet control
const wss = new WebSocketServer({ server });

async function broadcastState() {
  if (wss.clients.size === 0) return;
  const status = await getFullStatus();
  const msg = JSON.stringify({ event: 'status', data: status });
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

wss.on('connection', async (ws) => {
  // Send current status immediately upon connection
  const status = await getFullStatus();
  ws.send(JSON.stringify({ event: 'status', data: status }));

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message.toString());
      const { type, action, value } = payload;

      if (type === 'app') {
        launchApp(action);
      } else if (type === 'volume') {
        if (action === 'set') {
          await runNative(['volume', 'set', String(value)]);
        } else if (action === 'mute') {
          await runNative(['volume', 'mute', String(value)]);
        } else if (action === 'up' || action === 'down') {
          await runNative(['volume', action, String(value || 5)]);
        }
        broadcastState();
      } else if (type === 'brightness') {
        await runNative(['brightness', 'set', String(value)]);
        broadcastState();
      } else if (type === 'media') {
        await runNative(['media', action]);
      } else if (type === 'window') {
        await runNative(['window', action]);
      } else if (type === 'keyboard') {
        await runNative(['keyboard', action]);
      } else if (type === 'system') {
        await runNative(['system', action, String(value || '')]);
      } else if (type === 'mouse') {
        await runNative(['mouse', action, String(payload.dx || payload.p1 || 0), String(payload.dy || payload.p2 || 0)]);
      }
    } catch (e) {
      console.error('WS error:', e.message);
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ Port ${PORT} is already in use by another instance!`);
    console.error(`Close the previous terminal running TabDeck, or run:`);
    console.error(`  npx kill-port ${PORT}\n`);
  } else {
    console.error('Server error:', err);
  }
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  const url = `http://${LOCAL_IP}:${PORT}`;
  console.log('====================================================');
  console.log('  🚀 TabDeck PC Controller is RUNNING!');
  console.log('====================================================');
  console.log(`  PC Access:      http://localhost:${PORT}`);
  console.log(`  Tablet Access:  ${url}`);
  console.log('----------------------------------------------------');
  console.log('  👉 Scan the QR Code on the PC screen or open:');
  console.log(`     ${url}`);
  console.log('     in your Android Tablet browser (Chrome / Edge).');
  console.log('====================================================\n');
});
