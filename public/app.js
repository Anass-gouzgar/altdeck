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
    manageActionsTitle: 'Manage Custom Deck Buttons',
    pwaInstallTitle: 'Fullscreen Tablet App (PWA)',
    pwaInstallBtn: '📱 Install as Fullscreen App',
    pwaFullscreenBtn: '⛶ Switch to Fullscreen Mode',
    detectedAppsTitle: 'Auto-Detected Installed PC Apps',
    detectedAppsRefresh: 'Refresh',
    browseDetectedApps: '🔍 Browse Auto-Detected PC Apps...',
    appAddedToDeck: 'App added to your Stream Deck!'
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
    manageActionsTitle: 'Gérer les Boutons Personnalisés',
    pwaInstallTitle: 'Application Tablette Plein Écran (PWA)',
    pwaInstallBtn: '📱 Installer en application plein écran',
    pwaFullscreenBtn: '⛶ Passer en plein écran',
    detectedAppsTitle: 'Applications PC Détectées',
    detectedAppsRefresh: 'Actualiser',
    browseDetectedApps: '🔍 Parcourir les applications PC détectées...',
    appAddedToDeck: 'Application ajoutée à votre Stream Deck !'
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
    manageActionsTitle: 'إدارة الأزرار المخصصة',
    pwaInstallTitle: 'تطبيق التابلت ملء الشاشة (PWA)',
    pwaInstallBtn: '📱 تثبيت كتطبيق ملء الشاشة',
    pwaFullscreenBtn: '⛶ التبديل إلى وضع ملء الشاشة',
    detectedAppsTitle: 'تطبيقات الكمبيوتر المكتشفة تلقائياً',
    detectedAppsRefresh: 'تحديث',
    browseDetectedApps: '🔍 تصفح تطبيقات الكمبيوتر المكتشفة...',
    appAddedToDeck: 'تمت إضافة التطبيق إلى لوحة التحكم بنجاح!'
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
// Multi-Layer Resilient Screen Keep-Awake Engine for Tablets
// ==========================================================================
const keepAwakeVideo = document.getElementById('keep-awake-video');
let keepAwakeWatchdog = null;
let lastVideoTime = -1;
state.wakeLockActive = true; // Auto-enabled by default for dedicated tablet controller

async function activateKeepAwake(quiet = false) {
  const btn = document.getElementById('wakelock-btn');
  state.wakeLockActive = true;
  if (btn) {
    btn.classList.add('active');
  }

  // Layer 1: Native Screen WakeLock API (if HTTPS / supported)
  if ('wakeLock' in navigator && window.isSecureContext) {
    try {
      if (!state.wakeLock) {
        state.wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLock.addEventListener('release', () => {
          state.wakeLock = null;
        });
      }
    } catch (e) {}
  }

  // Layer 2: Dedicated Video Media Stream (Android OS FLAG_KEEP_SCREEN_ON)
  if (keepAwakeVideo) {
    try {
      keepAwakeVideo.muted = true;
      if (keepAwakeVideo.paused) {
        const p = keepAwakeVideo.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {}
  }

  // Layer 3: Heartbeat Audio Pipeline (prevents Android browser sleep)
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }

  // Start active watchdog if not running
  if (!keepAwakeWatchdog) {
    keepAwakeWatchdog = setInterval(() => {
      if (!state.wakeLockActive) return;

      // Re-trigger video playback if paused or stalled
      if (keepAwakeVideo) {
        if (keepAwakeVideo.paused || keepAwakeVideo.ended) {
          keepAwakeVideo.play().catch(() => {});
        } else if (keepAwakeVideo.currentTime === lastVideoTime) {
          keepAwakeVideo.currentTime = 0;
          keepAwakeVideo.play().catch(() => {});
        }
        lastVideoTime = keepAwakeVideo.currentTime;
      }

      // Re-acquire native wakelock if released
      if ('wakeLock' in navigator && window.isSecureContext && !state.wakeLock) {
        navigator.wakeLock.request('screen').then(lock => {
          state.wakeLock = lock;
        }).catch(() => {});
      }
    }, 2500);
  }

  if (!quiet) {
    showToast(state.lang === 'ar' ? 'تم تفعيل إبقاء الشاشة مضاءة دائماً!' : 'Screen will stay awake indefinitely!');
  }
}

function deactivateKeepAwake() {
  const btn = document.getElementById('wakelock-btn');
  state.wakeLockActive = false;
  if (btn) {
    btn.classList.remove('active');
  }
  if (state.wakeLock) {
    try { state.wakeLock.release(); } catch (e) {}
    state.wakeLock = null;
  }
  if (keepAwakeVideo) {
    try { keepAwakeVideo.pause(); } catch (e) {}
  }
  if (keepAwakeWatchdog) {
    clearInterval(keepAwakeWatchdog);
    keepAwakeWatchdog = null;
  }
  showToast(state.lang === 'ar' ? 'تم إيقاف إبقاء الشاشة مضاءة' : 'Keep-Awake Deactivated');
}

function toggleWakeLock() {
  triggerHaptic();
  if (state.wakeLockActive) {
    deactivateKeepAwake();
  } else {
    activateKeepAwake(false);
  }
}
document.getElementById('wakelock-btn').addEventListener('click', toggleWakeLock);

// Automatically engage on ANY first user touch or tap
['click', 'touchstart', 'pointerdown'].forEach(evt => {
  document.addEventListener(evt, () => {
    if (state.wakeLockActive) {
      activateKeepAwake(true);
    }
  }, { passive: true });
});

// Re-arm immediately when returning from sleep or switching tabs
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.wakeLockActive) {
    activateKeepAwake(true);
  }
});
window.addEventListener('focus', () => {
  if (state.wakeLockActive) activateKeepAwake(true);
});

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
    case 'app':
    case 'rocket':
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.45-1.47 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.47-1.45 2-4.5 2-4.5"/></svg>';
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
        const targetApp = (action.payload && action.payload.appId) ? action.payload.appId : (action.action || action.id);
        sendAction({ type: 'app', action: targetApp, target: targetApp });
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
const actionAppSelectGroup = document.getElementById('action-app-select-group');
const actionFormAppSelect = document.getElementById('action-form-app-select');

function openActionModal() {
  triggerHaptic();
  actionFormLabel.value = '';
  actionFormVal.value = '';
  actionFormType.value = 'app';
  if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'block';
  if (actionFormAppSelect) actionFormAppSelect.value = '';
  actionValLabel.textContent = 'App ID / Executable Path';
  actionFormVal.placeholder = 'Choose from list or enter AppID';
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
  if (val === 'app') {
    if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'block';
    actionValLabel.textContent = 'App ID / Executable Path';
    actionFormVal.placeholder = 'e.g. Microsoft.WindowsCalculator_8wekyb3d8bbwe!App';
  } else {
    if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'none';
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
  }
});

if (actionFormAppSelect) {
  actionFormAppSelect.addEventListener('change', () => {
    const selectedOpt = actionFormAppSelect.options[actionFormAppSelect.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
      actionFormLabel.value = selectedOpt.dataset.name || selectedOpt.textContent;
      actionFormVal.value = selectedOpt.value;
      actionFormColor.value = getRandomColor(selectedOpt.dataset.name || selectedOpt.value);
    }
  });
}

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
  if (type === 'app') payload.appId = val;

  const newAction = {
    id: 'act-' + Date.now(),
    label,
    type,
    color,
    icon: type === 'app' ? 'rocket' : type,
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
    if (data.hostname && pcHostname) {
      pcHostname.textContent = `${data.hostname} • Windows`;
    }
  } catch (e) {}
  // Pre-load detected PC apps
  fetchDetectedApps();
}
loadInfo();

// ==========================================================================
// PWA Service Worker & Fullscreen Install Engine
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[TabDeck PWA] Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('[TabDeck PWA] Service Worker registration failed:', err);
      });
  });
}

let deferredPrompt = null;
const btnInstallPwa = document.getElementById('btn-install-pwa');
const pairingInstallBtn = document.getElementById('pairing-install-btn');
const pairingFullscreenBtn = document.getElementById('pairing-fullscreen-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnInstallPwa) {
    btnInstallPwa.style.display = 'inline-flex';
  }
});

async function triggerPwaInstall() {
  triggerHaptic();
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast(state.lang === 'ar' ? 'جاري تثبيت TabDeck...' : 'Installing TabDeck as Fullscreen App...');
    }
    deferredPrompt = null;
    if (btnInstallPwa) btnInstallPwa.style.display = 'none';
  } else {
    // If running in browser or prompt not available
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.matchMedia('(display-mode: fullscreen)').matches ||
                         window.navigator.standalone === true;
    if (isStandalone) {
      showToast(state.lang === 'ar' ? 'التطبيق مثبت ويعمل بملء الشاشة بالفعل!' : 'TabDeck is running in Fullscreen App mode!');
    } else {
      const msg = state.lang === 'ar'
        ? '📱 لتثبيت التطبيق بملء الشاشة على تابلت سامسونج / أندرويد:\n1. اضغط على القائمة (⋮) أعلى متصفح Chrome.\n2. اختر "تثبيت التطبيق" أو "الإضافة إلى الشاشة الرئيسية".\n3. افتح TabDeck من شاشة جهازك ليعمل بملء الشاشة بدون أي أشرطة!'
        : (state.lang === 'fr'
          ? '📱 Pour installer TabDeck en plein écran sur votre tablette:\n1. Ouvrez le menu (⋮) de Google Chrome.\n2. Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".\n3. Lancez TabDeck depuis l\'écran d\'accueil sans barre d\'adresse !'
          : '📱 To install TabDeck as a Fullscreen App on your tablet:\n1. Tap the Chrome menu (⋮) in the top-right corner.\n2. Tap "Install app" or "Add to Home screen".\n3. Open TabDeck from your home screen to enjoy 100% borderless fullscreen!');
      alert(msg);
    }
  }
}

if (btnInstallPwa) btnInstallPwa.addEventListener('click', triggerPwaInstall);
if (pairingInstallBtn) pairingInstallBtn.addEventListener('click', triggerPwaInstall);

if (pairingFullscreenBtn) {
  pairingFullscreenBtn.addEventListener('click', () => {
    triggerHaptic();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      showToast(state.lang === 'ar' ? 'تم تفعيل ملء الشاشة' : 'Entered Fullscreen Mode');
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

window.addEventListener('appinstalled', () => {
  showToast(state.lang === 'ar' ? 'تم تثبيت TabDeck بنجاح!' : 'TabDeck installed successfully!');
  deferredPrompt = null;
  if (btnInstallPwa) btnInstallPwa.style.display = 'none';
});

// ==========================================================================
// Auto-Detected Installed PC Apps Engine
// ==========================================================================
state.detectedApps = [];

const detectedAppsContainer = document.getElementById('detected-apps-container');
const detectedAppsCount = document.getElementById('detected-apps-count');
const detectedAppsSearch = document.getElementById('detected-apps-search');
const btnRefreshDetectedApps = document.getElementById('btn-refresh-detected-apps');
const btnBrowseDetected = document.getElementById('btn-browse-detected');

function getRandomColor(str) {
  const colors = ['#00F0FF', '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#38BDF8'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function renderDetectedApps(apps) {
  if (!detectedAppsContainer) return;
  detectedAppsContainer.innerHTML = '';

  if (apps.length === 0) {
    detectedAppsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px 0;">${
      state.lang === 'ar' ? 'لا توجد تطبيقات مطابقة' : 'No matching applications found'
    }</div>`;
    return;
  }

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'detected-app-card';
    const color = getRandomColor(app.name);
    const initial = (app.name || 'A').trim().charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="detected-app-icon" style="background: linear-gradient(135deg, ${color}22, ${color}55); border-color: ${color}; color: ${color};">${initial}</div>
      <div class="detected-app-info">
        <div class="detected-app-name" title="${escapeHtml(app.name)}">${escapeHtml(app.name)}</div>
        <div class="detected-app-id" title="${escapeHtml(app.appId)}">${escapeHtml(app.appId)}</div>
      </div>
      <div class="detected-app-actions">
        <button class="btn-app-launch" title="Launch on PC">🚀</button>
        <button class="btn-app-add" title="Add to Stream Deck">+ Deck</button>
      </div>
    `;

    // Launch on PC
    card.querySelector('.btn-app-launch').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      sendAction({ type: 'app', action: app.appId, target: app.appId });
      showToast(state.lang === 'ar' ? `جاري تشغيل ${app.name} على الكمبيوتر...` : `Launching ${app.name} on PC...`);
    });

    // Add directly to Deck
    card.querySelector('.btn-app-add').addEventListener('click', async (e) => {
      e.stopPropagation();
      triggerHaptic();
      const newAction = {
        id: 'app-' + Date.now(),
        label: app.name,
        type: 'app',
        color: color,
        icon: 'rocket',
        payload: {
          appId: app.appId
        }
      };

      try {
        const res = await fetch('/api/custom-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAction)
        });
        const data = await res.json();
        if (data.status === 'ok') {
          state.customActions = data.actions;
          renderCustomActions(data.actions);
          showToast(state.lang === 'ar' ? 'تمت إضافة التطبيق إلى لوحة التحكم!' : `Added "${app.name}" to Stream Deck!`);
        }
      } catch (err) {
        showToast('Error adding action');
      }
    });

    detectedAppsContainer.appendChild(card);
  });
}

function updateAppSelectDropdown(apps) {
  const select = document.getElementById('action-form-app-select');
  if (!select) return;
  select.innerHTML = '<option value="">-- Choose Installed PC App --</option>';
  apps.forEach(app => {
    const opt = document.createElement('option');
    opt.value = app.appId;
    opt.textContent = `${app.name} (${app.appId.length > 30 ? app.appId.slice(0, 27) + '...' : app.appId})`;
    opt.dataset.name = app.name;
    select.appendChild(opt);
  });
}

async function fetchDetectedApps(forceRefresh = false) {
  if (detectedAppsCount) {
    detectedAppsCount.textContent = state.lang === 'ar' ? 'جاري الفحص...' : 'Scanning PC...';
  }
  try {
    const res = await fetch(`/api/detected-apps${forceRefresh ? '?refresh=1' : ''}`);
    const data = await res.json();
    if (data.status === 'ok' && Array.isArray(data.apps)) {
      state.detectedApps = data.apps;
      if (detectedAppsCount) {
        detectedAppsCount.textContent = state.lang === 'ar'
          ? `${data.apps.length} تطبيق مكتشف`
          : `${data.apps.length} Apps Detected`;
      }
      renderDetectedApps(state.detectedApps);
      updateAppSelectDropdown(state.detectedApps);
    }
  } catch (err) {
    if (detectedAppsCount) detectedAppsCount.textContent = 'Scan Error';
  }
}

if (btnRefreshDetectedApps) {
  btnRefreshDetectedApps.addEventListener('click', () => {
    triggerHaptic();
    fetchDetectedApps(true);
    showToast(state.lang === 'ar' ? 'جاري تحديث تطبيقات الكمبيوتر...' : 'Refreshing detected PC apps...');
  });
}

if (detectedAppsSearch) {
  detectedAppsSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderDetectedApps(state.detectedApps);
      return;
    }
    const filtered = state.detectedApps.filter(app => 
      (app.name && app.name.toLowerCase().includes(q)) || 
      (app.appId && app.appId.toLowerCase().includes(q))
    );
    renderDetectedApps(filtered);
  });
}

if (btnBrowseDetected) {
  btnBrowseDetected.addEventListener('click', () => {
    triggerHaptic();
    // Switch to tab-config
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const cfgTab = document.querySelector('[data-tab="tab-config"]');
    if (cfgTab) cfgTab.classList.add('active');
    const cfgContent = document.getElementById('tab-config');
    if (cfgContent) cfgContent.classList.add('active');
    const card = document.getElementById('detected-apps-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth' });
    }
    if (detectedAppsSearch) {
      setTimeout(() => detectedAppsSearch.focus(), 300);
    }
  });
}


