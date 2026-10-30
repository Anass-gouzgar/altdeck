const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');
const readline = require('readline');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const { APPS, launchApp } = require('./app-launcher');

let wss = null;

// ==========================================================================
// WinRT SMTC Real-Time Media Session Monitor (Feature #5 - Live Stream v2.91)
// ==========================================================================
let cachedMedia = {
  status: 'idle',
  hasMedia: false,
  title: '',
  artist: '',
  album: '',
  playbackStatus: 'Stopped',
  position: 0,
  duration: 0
};

let mediaWorker = null;

function startMediaWorker() {
  const scriptPath = path.join(__dirname, 'scripts', 'media-monitor.ps1');
  if (!fs.existsSync(scriptPath)) return;

  try {
    mediaWorker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (mediaWorker.stdout) {
      mediaWorker.stdout.setEncoding('utf8');
    }

    const rl = readline.createInterface({ input: mediaWorker.stdout });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) return;
      try {
        const data = JSON.parse(trimmed);
        if (data && (data.status === 'ok' || data.status === 'idle')) {
          cachedMedia = data;
          broadcastMedia();
        }
      } catch (e) {}
    });

    mediaWorker.on('error', (err) => {
      console.warn('[AltDeck Media] Worker error:', err.message);
    });

    mediaWorker.on('exit', () => {
      mediaWorker = null;
      setTimeout(startMediaWorker, 3000);
    });
  } catch (err) {
    console.warn('[AltDeck Media] Failed to start media worker:', err.message);
  }
}

function broadcastMedia() {
  if (!wss || wss.clients.size === 0) return;
  const msg = JSON.stringify({ event: 'media', data: cachedMedia });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

function seekMedia(sec) {
  if (mediaWorker && mediaWorker.stdin && !mediaWorker.killed) {
    try {
      mediaWorker.stdin.write(`seek ${sec}\n`);
      return;
    } catch (e) {}
  }
  execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'scripts', 'media-monitor.ps1'), '-SeekTo', String(sec)], { windowsHide: true });
}

function fetchMediaFallback() {
  const scriptPath = path.join(__dirname, 'scripts', 'media-monitor.ps1');
  execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Mode', 'oneshot'], { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
    if (!err && stdout) {
      try {
        const data = JSON.parse(stdout.trim());
        if (data && (data.status === 'ok' || data.status === 'idle')) {
          cachedMedia = data;
          broadcastMedia();
        }
      } catch (e) {}
    }
  });
}

startMediaWorker();
fetchMediaFallback();

let config = {};
try {
  const cfgPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(cfgPath)) {
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {}

const PORT = process.env.PORT || config.port || 3000;
const BIN_PATH = fs.existsSync(path.join(__dirname, 'bin', 'pc-control.exe'))
  ? path.join(__dirname, 'bin', 'pc-control.exe')
  : path.join(__dirname, 'bin', 'altdeck-core.exe');

// Quick File Drop (AltDeck Beam) storage directory on PC Desktop
const TRANSFERS_DIR = path.join(os.homedir(), 'Desktop', 'AltDeck Transfers');
if (!fs.existsSync(TRANSFERS_DIR)) {
  try { fs.mkdirSync(TRANSFERS_DIR, { recursive: true }); } catch (e) {}
}

// Auto-compile native helper if missing on first run
function ensureNativeBinary() {
  if (!fs.existsSync(BIN_PATH)) {
    console.log('[AltDeck] Native hardware controller missing. Auto-compiling via csc.exe...');
    try {
      const { execSync } = require('child_process');
      execSync('powershell -ExecutionPolicy Bypass -File build-helper.ps1', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
      console.warn('[AltDeck] Auto-compile failed. Run "npm run build:helper" manually.');
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

// Hardware Telemetry Engine (CPU, RAM, Battery)
let lastCpuTimes = null;
function getCpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  if (!lastCpuTimes) {
    lastCpuTimes = { idle, total };
    return 10;
  }
  const idleDiff = idle - lastCpuTimes.idle;
  const totalDiff = total - lastCpuTimes.total;
  lastCpuTimes = { idle, total };
  if (totalDiff <= 0) return 0;
  const usage = Math.round((1 - idleDiff / totalDiff) * 100);
  return Math.max(0, Math.min(100, usage));
}

function getRamStats() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const totalGb = parseFloat((totalBytes / (1024 ** 3)).toFixed(1));
  const usedGb = parseFloat((usedBytes / (1024 ** 3)).toFixed(1));
  const percent = Math.round((usedBytes / totalBytes) * 100);
  return {
    totalGb,
    usedGb,
    freeGb: parseFloat((freeBytes / (1024 ** 3)).toFixed(1)),
    percent
  };
}

let cachedBattery = { percent: 100, isCharging: true, powerLine: 'Online', chargeStatus: '' };
let lastBatteryFetch = 0;
async function getBatteryStats() {
  const now = Date.now();
  if (now - lastBatteryFetch < 4000) return cachedBattery;
  try {
    const res = await runNative(['battery']);
    if (res && res.status === 'ok') {
      cachedBattery = {
        percent: typeof res.batteryPercent === 'number' ? res.batteryPercent : 100,
        isCharging: !!res.isCharging,
        powerLine: res.powerLine || 'Online',
        chargeStatus: res.chargeStatus || ''
      };
      lastBatteryFetch = now;
    }
  } catch (e) {}
  return cachedBattery;
}

const cpuHistory = [];
const ramHistory = [];
const MAX_HISTORY = 20;

let cachedProcesses = [];
let lastProcessesFetch = 0;
async function getTopProcesses(force = false) {
  const now = Date.now();
  if (!force && now - lastProcessesFetch < 3000 && cachedProcesses.length > 0) {
    return cachedProcesses;
  }
  try {
    const res = await runNative(['processes', 'list']);
    if (res && res.status === 'ok' && Array.isArray(res.processes)) {
      cachedProcesses = res.processes;
      lastProcessesFetch = now;
    }
  } catch (e) {}
  return cachedProcesses;
}

async function getTelemetryData() {
  const cpu = getCpuPercent();
  const ram = getRamStats();
  const battery = await getBatteryStats();
  const cores = os.cpus().length;

  cpuHistory.push(cpu);
  if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();

  ramHistory.push(ram.percent);
  if (ramHistory.length > MAX_HISTORY) ramHistory.shift();

  const topProcesses = await getTopProcesses();

  return { cpu, ram, battery, cores, cpuHistory, ramHistory, topProcesses };
}

function getSystemHostInfo() {
  let username = process.env.USERNAME || process.env.USER || 'User';
  try {
    const u = os.userInfo();
    if (u && u.username) username = u.username;
  } catch (e) {}
  const osRelease = os.release() || '';
  const winBuild = parseInt(osRelease.split('.')[2] || '0', 10);
  const osName = os.platform() === 'win32'
    ? (winBuild >= 22000 ? 'Windows 11' : (winBuild >= 10240 ? 'Windows 10' : 'Windows'))
    : (os.type() || 'PC');
  return {
    hostname: os.hostname(),
    username,
    osName,
    platform: os.platform()
  };
}

// Get system state (volume, mute, brightness, telemetry)
async function getFullStatus() {
  let volume = 50;
  let muted = false;
  let micMuted = false;
  let micVolume = 100;
  let brightness = 100;

  try {
    const volRes = await runNative(['volume', 'get']);
    if (volRes && typeof volRes.volume !== 'undefined') {
      volume = volRes.volume;
      muted = !!volRes.muted;
    }
  } catch (e) {}

  try {
    const micRes = await runNative(['mic', 'get']);
    if (micRes && typeof micRes.micMuted !== 'undefined') {
      micMuted = !!micRes.micMuted;
      micVolume = micRes.micVolume || 100;
    }
  } catch (e) {}

  try {
    const brightRes = await runNative(['brightness', 'get']);
    if (brightRes && typeof brightRes.brightness !== 'undefined') {
      brightness = brightRes.brightness;
    }
  } catch (e) {}

  const now = new Date();
  const pcHours = String(now.getHours()).padStart(2, '0');
  const pcMinutes = String(now.getMinutes()).padStart(2, '0');
  const pcSeconds = String(now.getSeconds()).padStart(2, '0');
  const pcTzOffset = now.getTimezoneOffset(); // minutes offset from UTC
  const telemetry = await getTelemetryData();

  const hostInfo = getSystemHostInfo();

  return {
    volume,
    muted,
    micMuted,
    micVolume,
    brightness,
    telemetry,
    media: cachedMedia,
    hostname: hostInfo.hostname,
    username: hostInfo.username,
    osName: hostInfo.osName,
    platform: hostInfo.platform,
    localIp: LOCAL_IP,
    port: PORT,
    timestamp: Date.now(),
    pcHours,
    pcMinutes,
    pcSeconds,
    pcTzOffset,
    pcTime: `${pcHours}:${pcMinutes}`
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
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
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

let detectedAppsCache = null;
let detectedAppsCacheTime = 0;

function getDetectedApps(forceRefresh = false) {
  return new Promise((resolve) => {
    const now = Date.now();
    if (!forceRefresh && detectedAppsCache && (now - detectedAppsCacheTime < 10 * 60 * 1000)) {
      return resolve({ apps: detectedAppsCache, cached: true });
    }
    const scriptPath = path.join(__dirname, 'scripts', 'get-apps.ps1');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('Error detecting apps:', err.message);
        return resolve({ apps: detectedAppsCache || [], error: err.message, cached: !!detectedAppsCache });
      }
      try {
        const apps = JSON.parse(stdout.trim());
        detectedAppsCache = apps;
        detectedAppsCacheTime = Date.now();
        resolve({ apps, cached: false });
      } catch (e) {
        console.error('Failed to parse detected apps output:', e.message);
        resolve({ apps: detectedAppsCache || [], error: e.message, cached: !!detectedAppsCache });
      }
    });
  });
}

async function executeAction(payload) {
  const { type, action, value } = payload;
  let result = { status: 'ok' };

  if (type === 'app') {
    result = launchApp(action, payload.appId || payload.target);
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
  } else if (type === 'mic') {
    if (action === 'set') {
      result = await runNative(['mic', 'set', String(value)]);
    } else {
      result = await runNative(['mic', 'mute', String(value !== undefined ? value : '')]);
    }
    broadcastState();
  } else if (type === 'brightness') {
    result = await runNative(['brightness', 'set', String(value)]);
    broadcastState();
  } else if (type === 'media') {
    if (action === 'seek') {
      const sec = parseFloat(value !== undefined ? value : (payload.seconds || payload.position || 0));
      seekMedia(sec);
      result = { status: 'ok', action: 'seek', position: sec };
    } else {
      result = await runNative(['media', action]);
    }
  } else if (type === 'window') {
    result = await runNative(['window', action]);
  } else if (type === 'keyboard') {
    const keyOrText = payload.key || payload.value || payload.text || payload.param || '';
    result = await runNative(['keyboard', action, String(keyOrText)]);
  } else if (type === 'system') {
    if (action === 'taskmgr') {
      exec('start taskmgr');
      result = { status: 'ok', action: 'taskmgr' };
    } else if (action === 'abort' || action === 'cancel' || action === 'cancel-shutdown') {
      exec('shutdown /a', (err) => {
        if (err && !err.message.includes('1116')) { // Error 1116 means no shutdown was in progress, which is fine
          console.log('[AltDeck Power] shutdown /a notice:', err.message);
        }
      });
      result = await runNative(['system', 'abort', '']);
    } else {
      result = await runNative(['system', action, String(value !== undefined ? value : '')]);
    }
  } else if (type === 'process') {
    if (action === 'kill') {
      const pid = payload.pid || value;
      result = await runNative(['processes', 'kill', String(pid)]);
      cachedProcesses = cachedProcesses.filter(p => p.pid !== parseInt(pid, 10));
    } else {
      result = await runNative(['processes', action || 'list']);
    }
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
    const hostInfo = getSystemHostInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      hostname: hostInfo.hostname,
      username: hostInfo.username,
      osName: hostInfo.osName,
      platform: hostInfo.platform,
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

  // Auto-Detected Installed PC Apps API
  if (url.pathname === '/api/detected-apps' && req.method === 'GET') {
    const refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
    const data = await getDetectedApps(refresh);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', count: data.apps.length, cached: data.cached, apps: data.apps }));
  }

  // Dynamic Official App Icon Extractor & Resolver API
  if (url.pathname === '/api/app-icon' && req.method === 'GET') {
    const rawName = (url.searchParams.get('name') || '').toLowerCase().trim();
    const rawAppId = (url.searchParams.get('appId') || '').toLowerCase().trim();

    // 1. Match against official icons in public/icons/
    const officialIconMap = {
      github: 'github.svg',
      ssh: 'ssh.svg',
      copyssh: 'ssh.svg',
      'copy ssh key': 'ssh.svg',
      ytmusic: 'ytmusic.svg',
      'youtube music': 'ytmusic.svg',
      'music.youtube': 'ytmusic.svg',
      camera: 'camera.png',
      windowscamera: 'camera.png',
      excel: 'excel.png',
      access: 'access.png',
      msaccess: 'access.png',
      publisher: 'publisher.png',
      mspub: 'publisher.png',
      teams: 'teams.png',
      msteams: 'teams.png',
      outlook: 'outlook.png',
      sadp: 'sadp.png',
      sadptool: 'sadp.png',
      word: 'word.png',
      winword: 'word.png',
      powerpoint: 'powerpoint.png',
      powerpnt: 'powerpoint.png',
      onenote: 'onenote.png',
      paint: 'paint.png',
      snippingtool: 'snippingtool.png',
      screensketch: 'snippingtool.png',
      photos: 'photos.png',
      mediaplayer: 'mediaplayer.png',
      zunemusic: 'mediaplayer.png',
      xbox: 'xbox.png',
      gamingapp: 'xbox.png',
      store: 'store.png',
      windowsstore: 'store.png',
      clipchamp: 'clipchamp.png',
      weather: 'weather.png',
      bingweather: 'weather.png',
      cmd: 'cmd.png',
      commandprompt: 'cmd.png',
      powershell: 'powershell.png',
      git: 'git.png',
      gitbash: 'git.png',
      gitgui: 'git.png',
      ollama: 'ollama.png',
      discord: 'discord.png',
      claude: 'claude.png',
      '3utools': '3utools.png',
      '3u': '3utools.png',
      chrome: 'chrome.png',
      googlechrome: 'chrome.png',
      edge: 'edge.png',
      msedge: 'edge.png',
      vscode: 'vscode.png',
      code: 'vscode.png',
      antigravity: 'antigravity.png',
      explorer: 'explorer.png',
      stickynotes: 'stickynotes.png',
      sticky: 'stickynotes.png',
      settings: 'settings.png',
      calculator: 'calculator.png',
      calc: 'calculator.png',
      notepad: 'notepad.png',
      terminal: 'terminal.png',
      taskmgr: 'taskmgr.png',
      taskmanager: 'taskmgr.png',
      spotify: 'spotify.svg'
    };

    let matchedFile = null;
    for (const [key, iconFile] of Object.entries(officialIconMap)) {
      if (rawName === key || rawName.includes(key) || rawAppId.includes(key)) {
        matchedFile = iconFile;
        break;
      }
    }

    if (matchedFile) {
      const fullPath = path.join(__dirname, 'public', 'icons', matchedFile);
      if (fs.existsSync(fullPath)) {
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': ext === '.svg' ? 'image/svg+xml' : 'image/png',
          'Cache-Control': 'public, max-age=86400'
        });
        return fs.createReadStream(fullPath).pipe(res);
      }
    }

    // 2. Check cached extracted icons
    const cacheDir = path.join(__dirname, 'public', 'icons', 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const safeHash = Buffer.from(rawAppId || rawName).toString('hex').slice(0, 32);
    const cachedFile = path.join(cacheDir, `${safeHash}.png`);

    if (fs.existsSync(cachedFile)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      return fs.createReadStream(cachedFile).pipe(res);
    }

    // 3. Extract on demand if target is an executable, GUID path, or UWP Appx
    const origAppId = url.searchParams.get('appId') || '';
    if (origAppId) {
      const script = path.join(__dirname, 'scripts', 'extract-icon.ps1');
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-SourcePath', origAppId, '-TargetPath', cachedFile, '-Size', '128'], (err) => {
        if (!err && fs.existsSync(cachedFile)) {
          res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
          return fs.createReadStream(cachedFile).pipe(res);
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Icon not available' }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Icon not found' }));
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
          title: payload.title || 'AltDeck Notification',
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

  // Quick File Drop Upload (POST /api/upload)
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    const rawFileName = url.searchParams.get('filename') || req.headers['x-filename'] || `file-${Date.now()}.bin`;
    const sanitized = path.basename(decodeURIComponent(rawFileName)).replace(/[^a-zA-Z0-9._\- \(\)]/g, '_');
    let destPath = path.join(TRANSFERS_DIR, sanitized);
    let counter = 1;
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    while (fs.existsSync(destPath)) {
      destPath = path.join(TRANSFERS_DIR, `${base}_${counter}${ext}`);
      counter++;
    }

    const fileStream = fs.createWriteStream(destPath);
    req.pipe(fileStream);

    fileStream.on('finish', () => {
      const stats = fs.statSync(destPath);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      const finalName = path.basename(destPath);

      broadcastNotification({
        id: 'transfer-' + Date.now(),
        title: '📂 File Received!',
        message: `${finalName} (${sizeMb} MB) saved to Desktop`,
        level: 'success',
        timestamp: Date.now()
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', filename: finalName, sizeMb, fullPath: destPath }));
    });

    fileStream.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    });
    return;
  }

  // Open Transfers Folder on PC (POST /api/open-transfers)
  if (url.pathname === '/api/open-transfers' && req.method === 'POST') {
    exec(`explorer.exe "${TRANSFERS_DIR}"`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', dir: TRANSFERS_DIR }));
  }

  // Transfers History (GET /api/transfers-history)
  if (url.pathname === '/api/transfers-history' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(TRANSFERS_DIR)
        .map(name => {
          try {
            const stat = fs.statSync(path.join(TRANSFERS_DIR, name));
            return {
              name,
              sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
              mtime: stat.mtimeMs
            };
          } catch (e) { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', transfers: files, dir: TRANSFERS_DIR }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', transfers: [], dir: TRANSFERS_DIR }));
    }
  }

  // Top Processes API (GET /api/top-processes)
  if (url.pathname === '/api/top-processes' && req.method === 'GET') {
    const procs = await getTopProcesses(true);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', processes: procs }));
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
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      if (url.pathname === '/sw.js') {
        headers['Service-Worker-Allowed'] = '/';
      }
      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

// Setup WebSocket server for 0-latency live tablet control
wss = new WebSocketServer({ server });

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

// Live hardware telemetry & media broadcast every 2000ms
setInterval(async () => {
  if (!wss || wss.clients.size === 0) return;
  try {
    const telemetry = await getTelemetryData();
    const msg = JSON.stringify({ event: 'telemetry', data: telemetry });
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
    broadcastMedia();
    if (!cachedMedia.hasMedia) {
      fetchMediaFallback();
    }
  } catch (e) {}
}, 2000);

wss.on('connection', async (ws) => {
  // Send current status and custom actions immediately upon connection
  const status = await getFullStatus();
  ws.send(JSON.stringify({ event: 'status', data: status }));
  ws.send(JSON.stringify({ event: 'media', data: cachedMedia }));
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
    console.error(`Close the previous terminal running AltDeck, or run:`);
    console.error(`  npx kill-port ${PORT}\n`);
  } else {
    console.error('Server error:', err);
  }
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  const url = `http://${LOCAL_IP}:${PORT}`;
  console.log('====================================================');
  console.log('  🚀 AltDeck PC Controller is RUNNING!');
  console.log('====================================================');
  console.log(`  PC Access:      http://localhost:${PORT}`);
  console.log(`  Tablet Access:  ${url}`);
  console.log('----------------------------------------------------');
  console.log('  👉 Scan the QR Code on the PC screen or open:');
  console.log(`     ${url}`);
  console.log('     in your Android Tablet browser (Chrome / Edge).');
  console.log('====================================================\n');
});
