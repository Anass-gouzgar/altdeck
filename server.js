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

const ACTIONS_FILE = path.join(__dirname, 'custom-actions.json');

function loadCustomActions() {
  try {
    if (fs.existsSync(ACTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading custom actions:', e.message);
  }
  return [];
}

function saveCustomActions(actions) {
  try {
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actions, null, 2), 'utf8');
    broadcastCustomActions();
    return true;
  } catch (e) {
    console.error('Error saving custom actions:', e.message);
    return false;
  }
}

function broadcastCustomActions() {
  if (!wss || wss.clients.size === 0) return;
  const actions = loadCustomActions();
  const msg = JSON.stringify({ event: 'custom-actions', data: actions });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function broadcastNotification(notification) {
  if (!wss || wss.clients.size === 0) return;
  const msg = JSON.stringify({ event: 'notification', data: notification });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

async function executeAction(payload) {
  const { type, action, value } = payload;
  let result = { status: 'ok' };

  if (type === 'app') {
    result = launchApp(action);
  } else if (type === 'url') {
    const url = payload.url || value || '';
    if (url) exec(`start "" "${url}"`);
    result = { status: 'ok', url };
  } else if (type === 'copy') {
    const text = payload.text || value || '';
    if (text) {
      const child = exec('powershell -NoProfile -Command "$input | Set-Clipboard"');
      child.stdin.write(text);
      child.stdin.end();
    }
    result = { status: 'ok', copied: text.slice(0, 50) };
  } else if (type === 'command') {
    const cmd = payload.command || value || '';
    if (cmd) {
      exec(cmd, (err) => {
        if (err) console.error('Exec error:', err.message);
      });
    }
    result = { status: 'ok', command: cmd };
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

  return result;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      })),
      customActions: loadCustomActions()
    }));
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    const status = await getFullStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(status));
  }

  // Custom Actions API
  if (url.pathname === '/api/custom-actions') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(loadCustomActions()));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const action = JSON.parse(body || '{}');
          if (!action.label) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Action label is required' }));
          }
          const actions = loadCustomActions();
          const existingIdx = actions.findIndex(a => a.id === action.id);
          if (existingIdx >= 0) {
            actions[existingIdx] = action;
          } else {
            action.id = action.id || 'act-' + Date.now();
            actions.push(action);
          }
          saveCustomActions(actions);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', actions }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const id = url.searchParams.get('id') || (body ? JSON.parse(body).id : null);
          let actions = loadCustomActions();
          actions = actions.filter(a => a.id !== id);
          saveCustomActions(actions);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', actions }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // Real-Time Notification API (POST /api/notify or POST /notify)
  if ((url.pathname === '/api/notify' || url.pathname === '/notify') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const notification = {
          id: 'notif-' + Date.now(),
          title: payload.title || 'TabDeck Notification',
          message: payload.message || '',
          level: payload.level || 'info', // 'success', 'warning', 'error', 'info'
          timestamp: Date.now()
        };
        broadcastNotification(notification);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', notification, deliveredTo: (wss ? wss.clients.size : 0) }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Unified Action API
  if (url.pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await executeAction(payload);
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
  // Send current status and custom actions immediately upon connection
  const status = await getFullStatus();
  ws.send(JSON.stringify({ event: 'status', data: status }));
  ws.send(JSON.stringify({ event: 'custom-actions', data: loadCustomActions() }));

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message.toString());
      await executeAction(payload);
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
