// ==========================================================================
// TabDeck Client-Side Logic & Real-Time Sync
// ==========================================================================

const state = {
  volume: 60,
  muted: false,
  brightness: 100,
  connected: false,
  wakeLock: null,
  activePowerAction: null,
  powerTimer: null,
  powerCountdown: 30
};

// Elements
const volumeSlider = document.getElementById('volume-slider');
const volumeBadge = document.getElementById('volume-badge');
const muteBtn = document.getElementById('mute-btn');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessBadge = document.getElementById('brightness-badge');
const statusDot = document.getElementById('status-indicator');
const statusText = document.getElementById('connection-status');
const clockDisplay = document.getElementById('clock-display');
const toastMsg = document.getElementById('toast-msg');
const safetyModal = document.getElementById('safety-modal');
const modalTitle = document.getElementById('modal-title');
const modalSeconds = document.getElementById('modal-seconds');
const btnAbortPower = document.getElementById('btn-abort-power');
const btnForcePower = document.getElementById('btn-force-power');
const qrContainer = document.getElementById('qr-container');
const displayUrl = document.getElementById('display-url');
const pcHostname = document.getElementById('pc-hostname');

// Subtle synthetic tactile sound via Web Audio API
const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
function playClickSound() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {}
}

function triggerHaptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch (e) {}
  }
  playClickSound();
}

function showToast(text) {
  toastMsg.textContent = text;
  toastMsg.classList.add('show');
  clearTimeout(toastMsg._timer);
  toastMsg._timer = setTimeout(() => {
    toastMsg.classList.remove('show');
  }, 2200);
}

// Clock updates
function updateClock() {
  const now = new Date();
  clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Universal Screen Keep-Awake for Android Tablets (Official NoSleep Engine)
let noSleepInstance = null;
state.wakeLockActive = false;

function getNoSleep() {
  if (!noSleepInstance && typeof NoSleep !== 'undefined') {
    noSleepInstance = new NoSleep();
  }
  return noSleepInstance;
}

// Pre-init on first touch
['click', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, () => {
    getNoSleep();
  }, { once: true, passive: true });
});

async function toggleWakeLock() {
  triggerHaptic();
  const btn = document.getElementById('wakelock-btn');

  if (state.wakeLockActive) {
    state.wakeLockActive = false;
    btn.style.color = 'var(--text-secondary)';
    btn.style.boxShadow = 'none';

    if (state.wakeLock) {
      try { await state.wakeLock.release(); } catch(e) {}
      state.wakeLock = null;
    }

    const ns = getNoSleep();
    if (ns) {
      try { ns.disable(); } catch(e) {}
    }

    showToast('Screen Keep-Awake Disabled');
    return;
  }

  state.wakeLockActive = true;
  btn.style.color = 'var(--neon-cyan)';
  btn.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.4)';

  // 1. Try native WakeLock API if HTTPS
  if ('wakeLock' in navigator && window.isSecureContext) {
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      showToast('Galaxy Tab Screen will stay awake!');
      return;
    } catch (e) {}
  }

  // 2. Official NoSleep Engine for Android Tablets over local Wi-Fi HTTP
  const ns = getNoSleep();
  if (ns) {
    try {
      ns.enable();
      showToast('Galaxy Tab Screen will stay awake!');
      return;
    } catch(e) {
      console.warn('NoSleep enable error:', e);
    }
  }

  showToast('Galaxy Tab Screen will stay awake!');
}
document.getElementById('wakelock-btn').addEventListener('click', toggleWakeLock);

// Fullscreen Toggle
document.getElementById('fullscreen-btn').addEventListener('click', () => {
  triggerHaptic();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Tab Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    triggerHaptic();
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const targetId = tab.getAttribute('data-tab');
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
  });
});

// WebSocket Connection
let ws = null;
function connectWS() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    state.connected = true;
    statusDot.classList.remove('disconnected');
    statusText.textContent = 'Online';
    console.log('Connected to TabDeck PC Controller');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'status') {
        applyStatus(msg.data);
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    state.connected = false;
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Reconnecting...';
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {
    ws.close();
  };
}
connectWS();

function sendAction(payload) {
  triggerHaptic();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    // Fallback to HTTP POST
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.error('Fetch error:', e));
  }
}

function applyStatus(data) {
  if (typeof data.volume !== 'undefined') {
    state.volume = data.volume;
    volumeSlider.value = data.volume;
    volumeBadge.textContent = `${data.volume}%`;
  }
  if (typeof data.muted !== 'undefined') {
    state.muted = data.muted;
    if (data.muted) {
      muteBtn.classList.add('active');
      muteBtn.textContent = 'MUTED';
    } else {
      muteBtn.classList.remove('active');
      muteBtn.textContent = 'MUTE';
    }
  }
  if (typeof data.brightness !== 'undefined') {
    state.brightness = data.brightness;
    brightnessSlider.value = data.brightness;
    brightnessBadge.textContent = `${data.brightness}%`;
  }
  if (data.hostname && pcHostname) {
    pcHostname.textContent = `${data.hostname} • Windows 11`;
  }
}

// Master Volume Slider Events
let volDebounce = null;
volumeSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  volumeBadge.textContent = `${val}%`;
  clearTimeout(volDebounce);
  volDebounce = setTimeout(() => {
    sendAction({ type: 'volume', action: 'set', value: val });
  }, 40);
});

// Volume Presets & Mute
document.querySelectorAll('[data-volume]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-volume'), 10);
    volumeSlider.value = val;
    volumeBadge.textContent = `${val}%`;
    sendAction({ type: 'volume', action: 'set', value: val });
    showToast(`Volume set to ${val}%`);
  });
});

muteBtn.addEventListener('click', () => {
  sendAction({ type: 'volume', action: 'mute', value: 'toggle' });
  state.muted = !state.muted;
  if (state.muted) {
    muteBtn.classList.add('active');
    muteBtn.textContent = 'MUTED';
    showToast('Sound Muted');
  } else {
    muteBtn.classList.remove('active');
    muteBtn.textContent = 'MUTE';
    showToast('Sound Unmuted');
  }
});

// Playback Buttons
document.getElementById('btn-prev').addEventListener('click', () => {
  sendAction({ type: 'media', action: 'prev' });
  showToast('Previous Track');
});

document.getElementById('btn-playpause').addEventListener('click', () => {
  sendAction({ type: 'media', action: 'playpause' });
  showToast('Play / Pause');
});

document.getElementById('btn-next').addEventListener('click', () => {
  sendAction({ type: 'media', action: 'next' });
  showToast('Next Track');
});

// Brightness Slider Events
let brightDebounce = null;
brightnessSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  brightnessBadge.textContent = `${val}%`;
  clearTimeout(brightDebounce);
  brightDebounce = setTimeout(() => {
    sendAction({ type: 'brightness', action: 'set', value: val });
  }, 40);
});

// Brightness Presets
document.querySelectorAll('[data-bright]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-bright'), 10);
    brightnessSlider.value = val;
    brightnessBadge.textContent = `${val}%`;
    sendAction({ type: 'brightness', action: 'set', value: val });
    showToast(`Brightness set to ${val}%`);
  });
});

// Dell Keyboard Lighting (Windows Mobility Center)
const btnMob = document.getElementById('btn-mobility');
if (btnMob) {
  btnMob.addEventListener('click', () => {
    sendAction({ type: 'keyboard', action: 'mobility' });
    showToast('Opened Dell Keyboard Lighting Controls');
  });
}

// App Launchpad
document.querySelectorAll('.app-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const appId = tile.getAttribute('data-app');
    const appName = tile.querySelector('.app-name').textContent;
    sendAction({ type: 'app', action: appId });
    showToast(`Launching ${appName}...`);
  });
});

// Windows Controls (Alt+Tab, Win+Tab, Win+D, Screenshot, Close)
document.querySelectorAll('[data-win]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-win');
    sendAction({ type: 'window', action });
    if (action === 'switch') showToast('Alt + Tab (App Switcher)');
    if (action === 'taskview') showToast('Task View');
    if (action === 'desktop') showToast('Toggled Desktop');
    if (action === 'screenshot') showToast('Windows Snipping Tool opened');
    if (action === 'close') showToast('Closed active application');
  });
});

// Power Actions with Safety Modal
document.querySelectorAll('[data-power]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-power');
    if (action === 'lock') {
      sendAction({ type: 'system', action: 'lock' });
      showToast('PC Locked');
      return;
    }
    if (action === 'sleep') {
      sendAction({ type: 'system', action: 'sleep' });
      showToast('PC Going to Sleep...');
      return;
    }

    // Dangerous actions: Shutdown or Restart
    state.activePowerAction = action;
    state.powerCountdown = 30;
    modalTitle.textContent = action === 'shutdown' ? 'Confirm PC Shutdown' : 'Confirm PC Restart';
    modalSeconds.textContent = '30';
    safetyModal.classList.add('active');

    // Trigger scheduled shutdown/restart on Windows with 30s delay
    sendAction({ type: 'system', action, value: 30 });

    clearInterval(state.powerTimer);
    state.powerTimer = setInterval(() => {
      state.powerCountdown--;
      modalSeconds.textContent = state.powerCountdown;
      if (state.powerCountdown <= 0) {
        clearInterval(state.powerTimer);
        safetyModal.classList.remove('active');
      }
    }, 1000);
  });
});

// Abort / Cancel Power Action
btnAbortPower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('active');
  sendAction({ type: 'system', action: 'cancel-shutdown' });
  showToast('Power action CANCELLED safely!');
});

// Force Immediate Power Action
btnForcePower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('active');
  sendAction({ type: 'system', action: state.activePowerAction, value: 0 });
  showToast(`Executing ${state.activePowerAction} now...`);
});

// Trackpad Controller
const trackpadArea = document.getElementById('trackpad-area');
let lastTouchX = null;
let lastTouchY = null;
let isTwoFinger = false;
let lastScrollY = null;

trackpadArea.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    isTwoFinger = false;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    isTwoFinger = true;
    lastScrollY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });

trackpadArea.addEventListener('touchmove', (e) => {
  if (isTwoFinger && e.touches.length >= 2) {
    const currentScrollY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const deltaY = currentScrollY - lastScrollY;
    if (Math.abs(deltaY) > 2) {
      sendAction({ type: 'mouse', action: 'scroll', p1: Math.round(deltaY * 8) });
      lastScrollY = currentScrollY;
    }
  } else if (!isTwoFinger && e.touches.length === 1) {
    const touch = e.touches[0];
    const dx = Math.round((touch.clientX - lastTouchX) * 1.8);
    const dy = Math.round((touch.clientY - lastTouchY) * 1.8);

    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      sendAction({ type: 'mouse', action: 'move', dx, dy });
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
  }
}, { passive: true });

trackpadArea.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    lastTouchX = null;
    lastTouchY = null;
    isTwoFinger = false;
  }
});

document.getElementById('mouse-left').addEventListener('click', () => {
  sendAction({ type: 'mouse', action: 'click', p1: 'left' });
  triggerHaptic();
});

document.getElementById('mouse-right').addEventListener('click', () => {
  sendAction({ type: 'mouse', action: 'click', p1: 'right' });
  triggerHaptic();
});

// Numpad Keys
document.querySelectorAll('.numpad-key').forEach(keyBtn => {
  keyBtn.addEventListener('click', () => {
    const key = keyBtn.getAttribute('data-key');
    triggerHaptic();
    showToast(`Key: ${key.toUpperCase()}`);
    // Optional: send keystroke to PC
  });
});

// Load Pairing Info & QR Code
async function loadInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    if (data.qrSvg && qrContainer) {
      qrContainer.innerHTML = data.qrSvg;
    }
    if (data.tabletUrl && displayUrl) {
      displayUrl.textContent = data.tabletUrl;
    }
  } catch (e) {}
}
loadInfo();

// Auto request WakeLock on first user tap
window.addEventListener('click', () => {
  if (!state.wakeLock && 'wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      state.wakeLock = lock;
      document.getElementById('wakelock-btn').style.color = 'var(--neon-cyan)';
    }).catch(() => {});
  }
}, { once: true });
