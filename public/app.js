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
  powerCountdown: 30,
  customActions: [],
  notifications: [],
  soundEnabled: localStorage.getItem('tabdeck_sound') !== 'false',
  hapticEnabled: localStorage.getItem('tabdeck_haptic') !== 'false',
  theme: localStorage.getItem('tabdeck_theme') || 'theme-obsidian',
  lang: localStorage.getItem('tabdeck_lang') || 'en'
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

// Notifications & Custom Action Elements
const notifBanner = document.getElementById('notification-banner');
const notifTitle = document.getElementById('notif-title');
const notifMsg = document.getElementById('notif-msg');
const notifCloseBtn = document.getElementById('notif-close-btn');
const notifBellBtn = document.getElementById('notif-bell-btn');
const notifBadge = document.getElementById('notif-badge');
const notifDrawer = document.getElementById('notif-drawer');
const notifDrawerBackdrop = document.getElementById('notif-drawer-backdrop');
const notifHistoryList = document.getElementById('notif-history-list');
const btnClearNotifs = document.getElementById('btn-clear-notifs');
const btnCloseNotifDrawer = document.getElementById('btn-close-notif-drawer');

// Modal Elements
const actionModal = document.getElementById('action-modal');
const btnCancelAction = document.getElementById('btn-cancel-action');
const btnSaveAction = document.getElementById('btn-save-action');
const actionFormLabel = document.getElementById('action-form-label');
const actionFormType = document.getElementById('action-form-type');
const actionFormVal = document.getElementById('action-form-val');
const actionValLabel = document.getElementById('action-val-label');
const actionFormColor = document.getElementById('action-form-color');

// ==========================================================================
// Web Audio API Synthesizer (Click & Notification Chimes)
// ==========================================================================
const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playClickSound() {
  if (!state.soundEnabled || !audioCtx) return;
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

function playNotificationChime() {
  if (!state.soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.3);
    });
  } catch (e) {}
}

function triggerHaptic() {
  if (state.hapticEnabled && navigator.vibrate) {
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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================================================
// Themes Management (8 Glassmorphic Themes)
// ==========================================================================
function applyTheme(themeName) {
  document.body.classList.remove('theme-obsidian', 'theme-midnight', 'theme-ocean', 'theme-ember', 'theme-forest', 'theme-rose', 'theme-frost', 'theme-gold');
  document.body.classList.add(themeName);
  state.theme = themeName;
  localStorage.setItem('tabdeck_theme', themeName);
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-theme') === themeName);
  });
}
applyTheme(state.theme);

document.querySelectorAll('.theme-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    triggerHaptic();
    applyTheme(chip.getAttribute('data-theme'));
    showToast(`Theme switched to ${chip.querySelector('span').textContent}`);
  });
});

// ==========================================================================
// Multi-Language Support (i18n: Arabic, Français, English)
// ==========================================================================
const I18N = {
  en: {
    navDeck: 'Stream Deck',
    navTrackpad: 'Trackpad',
    navNumpad: 'Numpad',
    navConfig: 'Config',
    navPairing: 'Connect & QR',
    customActionsTitle: 'Custom Actions & Macros',
    themeTitle: 'Themes & Appearance',
    langTitle: 'Language & Feedback',
    langLabel: 'Interface Language',
    soundLabel: 'Notification Sound',
    hapticLabel: 'Haptic Vibration',
    notifTestTitle: 'PC Notifications Hub',
    manageActionsTitle: 'Manage Custom Deck Buttons'
  },
  fr: {
    navDeck: 'Stream Deck',
    navTrackpad: 'Pavé Tactile',
    navNumpad: 'Pavé Numérique',
    navConfig: 'Configuration',
    navPairing: 'Connexion & QR',
    customActionsTitle: 'Actions & Macros Personnalisées',
    themeTitle: 'Thèmes & Apparence',
    langTitle: 'Langue & Audio',
    langLabel: 'Langue de l\'Interface',
    soundLabel: 'Son de Notification',
    hapticLabel: 'Vibration Haptique',
    notifTestTitle: 'Hub de Notifications PC',
    manageActionsTitle: 'Gérer les Boutons Personnalisés'
  },
  ar: {
    navDeck: 'لوحة التحكم',
    navTrackpad: 'لوحة اللمس',
    navNumpad: 'لوحة الأرقام',
    navConfig: 'الإعدادات',
    navPairing: 'الربط والرمز',
    customActionsTitle: 'أزرار واختصارات مخصصة',
    themeTitle: 'المظهر والسمات',
    langTitle: 'اللغة والتنبيهات',
    langLabel: 'لغة الواجهة',
    soundLabel: 'صوت التنبيهات',
    hapticLabel: 'الاهتزاز اللمسي',
    notifTestTitle: 'مركز إشعارات الكمبيوتر',
    manageActionsTitle: 'إدارة الأزرار المخصصة'
  }
};

function applyLanguage(lang) {
  if (lang !== 'en' && lang !== 'fr' && lang !== 'ar') {
    lang = 'en';
  }
  state.lang = lang;
  localStorage.setItem('tabdeck_lang', lang);

  if (lang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }

  const dict = I18N[lang] || I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}
applyLanguage(state.lang);

document.querySelectorAll('.btn-lang').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    applyLanguage(btn.getAttribute('data-lang'));
  });
});

// Sound and Haptic toggles
const toggleSound = document.getElementById('toggle-sound');
if (toggleSound) {
  toggleSound.checked = state.soundEnabled;
  toggleSound.addEventListener('change', () => {
    state.soundEnabled = toggleSound.checked;
    localStorage.setItem('tabdeck_sound', String(state.soundEnabled));
  });
}

const toggleHaptic = document.getElementById('toggle-haptic');
if (toggleHaptic) {
  toggleHaptic.checked = state.hapticEnabled;
  toggleHaptic.addEventListener('change', () => {
    state.hapticEnabled = toggleHaptic.checked;
    localStorage.setItem('tabdeck_haptic', String(state.hapticEnabled));
  });
}

// Clock updates
function updateClock() {
  const now = new Date();
  clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================================================
// Screen WakeLock (NoSleep engine for Android Tablets)
// ==========================================================================
let noSleepInstance = null;
state.wakeLockActive = false;

function getNoSleep() {
  if (!noSleepInstance && typeof NoSleep !== 'undefined') {
    noSleepInstance = new NoSleep();
  }
  return noSleepInstance;
}

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
    btn.style.color = '';
    btn.style.boxShadow = '';
    if (state.wakeLock) {
      try { await state.wakeLock.release(); } catch (e) {}
      state.wakeLock = null;
    }
    const ns = getNoSleep();
    if (ns) {
      try { ns.disable(); } catch(e) {}
    }
    showToast('Keep-Awake Deactivated');
    return;
  }

  state.wakeLockActive = true;
  btn.style.color = 'var(--neon-cyan)';
  btn.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.4)';

  if ('wakeLock' in navigator && window.isSecureContext) {
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      showToast('Galaxy Tab Screen will stay awake!');
      return;
    } catch (e) {}
  }

  const ns = getNoSleep();
  if (ns) {
    try {
      ns.enable();
      showToast('Galaxy Tab Screen will stay awake!');
      return;
    } catch(e) {}
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

// ==========================================================================
// WebSocket Connection & Real-Time Sync
// ==========================================================================
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
      } else if (msg.event === 'custom-actions') {
        state.customActions = msg.data || [];
        renderCustomActions(state.customActions);
      } else if (msg.event === 'notification') {
        showNotification(msg.data);
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

// ==========================================================================
// Real-Time PC Notifications (From PC to Tablet)
// ==========================================================================
function showNotification(notif) {
  notifTitle.textContent = notif.title || 'TabDeck Alert';
  notifMsg.textContent = notif.message || '';
  notifBanner.className = `notification-banner show level-${notif.level || 'info'}`;
  playNotificationChime();

  state.notifications.unshift(notif);
  if (state.notifications.length > 30) state.notifications.pop();
  updateNotificationDrawer();

  clearTimeout(notifBanner._timer);
  notifBanner._timer = setTimeout(() => {
    notifBanner.classList.remove('show');
  }, 5000);
}

notifCloseBtn.addEventListener('click', () => {
  notifBanner.classList.remove('show');
});

function updateNotificationDrawer() {
  if (!notifHistoryList) return;
  if (state.notifications.length > 0) {
    notifBadge.style.display = 'flex';
    notifBadge.textContent = String(state.notifications.length);
  } else {
    notifBadge.style.display = 'none';
  }

  if (state.notifications.length === 0) {
    notifHistoryList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 40px 0;">No notifications yet</div>';
    return;
  }

  notifHistoryList.innerHTML = '';
  state.notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = 'config-action-item';
    item.style.borderColor = n.level === 'success' ? '#10B981' : n.level === 'error' ? '#EF4444' : n.level === 'warning' ? '#F59E0B' : 'var(--border-glass)';
    item.innerHTML = `
      <div>
        <div style="font-weight: 700; color: #fff; font-size: 0.85rem;">${escapeHtml(n.title)}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(n.message)}</div>
      </div>
      <span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">${new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    notifHistoryList.appendChild(item);
  });
}

notifBellBtn.addEventListener('click', () => {
  triggerHaptic();
  notifDrawer.classList.add('show');
  notifDrawerBackdrop.classList.add('show');
});

function closeNotifDrawer() {
  notifDrawer.classList.remove('show');
  notifDrawerBackdrop.classList.remove('show');
}
btnCloseNotifDrawer.addEventListener('click', closeNotifDrawer);
notifDrawerBackdrop.addEventListener('click', closeNotifDrawer);

btnClearNotifs.addEventListener('click', () => {
  state.notifications = [];
  updateNotificationDrawer();
  showToast('Notifications Cleared');
});

// Test Notification Buttons
document.getElementById('test-notif-success').addEventListener('click', () => {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Build Successful', message: 'Production assets compiled in 1.4s', level: 'success' })
  });
});

document.getElementById('test-notif-warning').addEventListener('click', () => {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'High CPU Load', message: 'PC CPU usage reached 92%', level: 'warning' })
  });
});

document.getElementById('test-notif-error').addEventListener('click', () => {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Deployment Failed', message: 'Process exited with error code 1', level: 'error' })
  });
});

// ==========================================================================
// Custom Actions Rendering & Builder
// ==========================================================================
function getActionIconSvg(iconName) {
  switch (iconName) {
    case 'globe':
    case 'url':
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
    case 'key':
    case 'copy':
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    case 'terminal':
    case 'command':
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
    case 'music':
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  }
}

function renderCustomActions(actions) {
  const grid = document.getElementById('custom-actions-grid');
  const configList = document.getElementById('config-actions-list');
  if (!grid) return;

  grid.innerHTML = '';
  if (configList) configList.innerHTML = '';

  if (actions.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;">No custom buttons yet. Tap "+ Add Action" to configure one!</div>';
    if (configList) configList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px;">No custom actions configured.</div>';
    return;
  }

  actions.forEach(action => {
    const tile = document.createElement('div');
    tile.className = 'custom-action-tile';
    tile.style.setProperty('--action-color', action.color || 'var(--neon-cyan)');
    
    const iconSvg = getActionIconSvg(action.icon || action.type);
    tile.innerHTML = `
      <div class="custom-action-icon">${iconSvg}</div>
      <div class="custom-action-title">${escapeHtml(action.label)}</div>
      <div class="custom-action-type">${action.type}</div>
    `;

    tile.addEventListener('click', () => {
      triggerHaptic();
      if (action.type === 'url') {
        sendAction({ type: 'url', url: action.payload.url });
        showToast(`Opened: ${action.label}`);
      } else if (action.type === 'copy') {
        sendAction({ type: 'copy', text: action.payload.text });
        showToast(`Copied to PC: ${action.label}`);
      } else if (action.type === 'command') {
        sendAction({ type: 'command', command: action.payload.command });
        showToast(`Executed: ${action.label}`);
      } else if (action.type === 'app') {
        sendAction({ type: 'app', action: action.id });
        showToast(`Launching: ${action.label}`);
      }
    });
    grid.appendChild(tile);

    if (configList) {
      const row = document.createElement('div');
      row.className = 'config-action-item';
      row.innerHTML = `
        <div class="config-action-info">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${action.color || '#00f0ff'};"></div>
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">${escapeHtml(action.label)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${action.type.toUpperCase()}: ${escapeHtml(action.payload.url || action.payload.text || action.payload.command || '')}</div>
          </div>
        </div>
        <div class="config-action-btns">
          <button class="btn-action-test" data-id="${action.id}">Test</button>
          <button class="btn-action-del" data-id="${action.id}">Delete</button>
        </div>
      `;
      row.querySelector('.btn-action-test').addEventListener('click', () => {
        tile.click();
      });
      row.querySelector('.btn-action-del').addEventListener('click', async () => {
        if (confirm(`Delete "${action.label}"?`)) {
          await fetch(`/api/custom-actions?id=${action.id}`, { method: 'DELETE' });
        }
      });
      configList.appendChild(row);
    }
  });
}

// Action Creator Modal Handling
function openActionModal() {
  triggerHaptic();
  actionFormLabel.value = '';
  actionFormVal.value = '';
  actionFormType.value = 'url';
  actionValLabel.textContent = 'Target URL';
  actionFormVal.placeholder = 'https://...';
  actionModal.classList.add('show');
}

function closeActionModal() {
  actionModal.classList.remove('show');
}

const btnQuickAdd = document.getElementById('btn-quick-add-action');
if (btnQuickAdd) btnQuickAdd.addEventListener('click', openActionModal);

const btnOpenCreate = document.getElementById('btn-open-create-modal');
if (btnOpenCreate) btnOpenCreate.addEventListener('click', openActionModal);

btnCancelAction.addEventListener('click', closeActionModal);

actionFormType.addEventListener('change', () => {
  const val = actionFormType.value;
  if (val === 'url') {
    actionValLabel.textContent = 'Target URL';
    actionFormVal.placeholder = 'https://...';
  } else if (val === 'copy') {
    actionValLabel.textContent = 'Text to Copy to PC Clipboard';
    actionFormVal.placeholder = 'e.g. MySecretToken123';
  } else if (val === 'command') {
    actionValLabel.textContent = 'Terminal Command';
    actionFormVal.placeholder = 'e.g. git pull || wt.exe';
  }
});

document.querySelectorAll('.color-pick').forEach(btn => {
  btn.addEventListener('click', () => {
    actionFormColor.value = btn.getAttribute('data-color');
  });
});

btnSaveAction.addEventListener('click', async () => {
  const label = actionFormLabel.value.trim();
  const type = actionFormType.value;
  const val = actionFormVal.value.trim();
  const color = actionFormColor.value;

  if (!label || !val) {
    showToast('Please fill all fields');
    return;
  }

  const payload = {};
  if (type === 'url') payload.url = val;
  if (type === 'copy') payload.text = val;
  if (type === 'command') payload.command = val;

  const newAction = {
    id: 'act-' + Date.now(),
    label,
    type,
    color,
    icon: type,
    payload
  };

  try {
    await fetch('/api/custom-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAction)
    });
    closeActionModal();
    showToast(`Added "${label}" to Deck!`);
  } catch (e) {
    showToast('Error saving action');
  }
});

// Load Initial Custom Actions
fetch('/api/custom-actions')
  .then(res => res.json())
  .then(actions => {
    state.customActions = actions;
    renderCustomActions(actions);
  })
  .catch(() => {});

// ==========================================================================
// Master Volume & Media
// ==========================================================================
let volDebounce = null;
volumeSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  volumeBadge.textContent = `${val}%`;
  clearTimeout(volDebounce);
  volDebounce = setTimeout(() => {
    sendAction({ type: 'volume', action: 'set', value: val });
  }, 40);
});

muteBtn.addEventListener('click', () => {
  const next = !state.muted;
  sendAction({ type: 'volume', action: 'mute', value: next ? 1 : 0 });
});

document.querySelectorAll('[data-vol]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-vol'), 10);
    volumeSlider.value = val;
    volumeBadge.textContent = `${val}%`;
    sendAction({ type: 'volume', action: 'set', value: val });
    showToast(`Volume set to ${val}%`);
  });
});

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

// ==========================================================================
// Brightness & Dell Lighting
// ==========================================================================
let brightDebounce = null;
brightnessSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  brightnessBadge.textContent = `${val}%`;
  clearTimeout(brightDebounce);
  brightDebounce = setTimeout(() => {
    sendAction({ type: 'brightness', action: 'set', value: val });
  }, 40);
});

document.querySelectorAll('[data-bright]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-bright'), 10);
    brightnessSlider.value = val;
    brightnessBadge.textContent = `${val}%`;
    sendAction({ type: 'brightness', action: 'set', value: val });
    showToast(`Brightness set to ${val}%`);
  });
});

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

// Windows Controls
document.querySelectorAll('[data-win]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-win');
    sendAction({ type: 'window', action });
    if (action === 'switch') showToast('Alt + Tab (App Switcher)');
    if (action === 'taskview') showToast('Task View');
    if (action === 'desktop') showToast('Toggled Desktop');
    if (action === 'screenshot') showToast('Windows Snipping Tool opened');
    if (action === 'close') showToast('Closed Active Window');
  });
});

// Power Actions with Safety Countdown
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
      showToast('PC going to Sleep...');
      return;
    }
    triggerHaptic();
    state.activePowerAction = action;
    state.powerCountdown = 30;
    modalTitle.textContent = action === 'shutdown' ? 'Confirm Shutdown' : 'Confirm Restart';
    modalSeconds.textContent = '30';
    safetyModal.classList.add('show');

    clearInterval(state.powerTimer);
    state.powerTimer = setInterval(() => {
      state.powerCountdown--;
      modalSeconds.textContent = String(state.powerCountdown);
      if (state.powerCountdown <= 0) {
        clearInterval(state.powerTimer);
        safetyModal.classList.remove('show');
        sendAction({ type: 'system', action: state.activePowerAction });
      }
    }, 1000);
  });
});

btnAbortPower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('show');
  sendAction({ type: 'system', action: 'abort' });
  showToast('Shutdown Aborted!');
});

btnForcePower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('show');
  sendAction({ type: 'system', action: state.activePowerAction });
});

// ==========================================================================
// Wireless Trackpad Mode
// ==========================================================================
const trackpadArea = document.getElementById('trackpad-area');
let lastTouchX = null;
let lastTouchY = null;
let isTwoFinger = false;
let lastTwoDist = null;

trackpadArea.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    isTwoFinger = false;
  } else if (e.touches.length === 2) {
    isTwoFinger = true;
    lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });

trackpadArea.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && !isTwoFinger) {
    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    if (lastTouchX !== null && lastTouchY !== null) {
      const dx = Math.round((curX - lastTouchX) * 1.8);
      const dy = Math.round((curY - lastTouchY) * 1.8);
      if (dx !== 0 || dy !== 0) {
        sendAction({ type: 'mouse', action: 'move', dx, dy });
      }
    }
    lastTouchX = curX;
    lastTouchY = curY;
  } else if (e.touches.length === 2) {
    const curY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    if (lastTouchY !== null) {
      const scrollDy = Math.round((curY - lastTouchY) * 1.5);
      if (scrollDy !== 0) {
        sendAction({ type: 'mouse', action: 'scroll', dy: scrollDy });
      }
    }
    lastTouchY = curY;
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
    if (data.customActions) {
      state.customActions = data.customActions;
      renderCustomActions(data.customActions);
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
