// ==========================================================================
// AltDeck Client-Side Logic & Real-Time Sync
// ==========================================================================

const OLD_THEME_MAP = {
  'theme-obsidian': 'theme-instagram',
  'theme-midnight': 'theme-x',
  'theme-ocean': 'theme-facebook',
  'theme-ember': 'theme-claude',
  'theme-forest': 'theme-duolingo',
  'theme-rose': 'theme-instagram',
  'theme-frost': 'theme-canva',
  'theme-gold': 'theme-gmail',
  'theme-cyberpunk': 'theme-tiktok',
  'theme-matrix': 'theme-spotify',
  'theme-synthwave': 'theme-instagram',
  'theme-dracula': 'theme-twitch',
  'theme-crimson': 'theme-netflix',
  'theme-nord': 'theme-linkedin'
};

const state = {
  volume: 60,
  muted: false,
  micMuted: false,
  brightness: 100,
  connected: false,
  wakeLock: null,
  activePowerAction: null,
  powerTimer: null,
  powerCountdown: 30,
  customActions: [],
  notifications: [],
  soundEnabled: (localStorage.getItem('altdeck_sound') || localStorage.getItem('tabdeck_sound')) !== 'false',
  hapticEnabled: (localStorage.getItem('altdeck_haptic') || localStorage.getItem('tabdeck_haptic')) !== 'false',
  theme: (() => {
    const t = localStorage.getItem('altdeck_theme') || localStorage.getItem('tabdeck_theme') || 'theme-x';
    const ALL = ['theme-instagram','theme-facebook','theme-youtube','theme-canva','theme-gmail','theme-claude','theme-linkedin','theme-duolingo','theme-spotify','theme-discord','theme-netflix','theme-tiktok','theme-twitch','theme-x'];
    return ALL.includes(t) ? t : (OLD_THEME_MAP[t] || 'theme-x');
  })(),
  lang: localStorage.getItem('altdeck_lang') || localStorage.getItem('tabdeck_lang') || 'en',
  serverTzOffset: null,
  timeOffsetHours: parseInt((localStorage.getItem('altdeck_time_offset') !== null ? localStorage.getItem('altdeck_time_offset') : localStorage.getItem('tabdeck_time_offset')) || '-1', 10),
  hostInfo: null,
  badgeMode: 'host'
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
const brandBadge = document.getElementById('brand-badge');
const brandLogoWrap = document.getElementById('brand-logo-wrap');

function updateDynamicHost(data) {
  if (!data) return;
  const host = data.hostname || (state.hostInfo && state.hostInfo.host) || 'PC DECK';
  const user = data.username || (state.hostInfo && state.hostInfo.user) || '';
  const osName = data.osName || (state.hostInfo && state.hostInfo.osName) || 'Windows 11';
  const ip = data.localIp || (state.hostInfo && state.hostInfo.ip) || window.location.hostname || '';

  state.hostInfo = { host, user, osName, ip };

  if (brandBadge) {
    if (state.badgeMode === 'user' && user) {
      brandBadge.textContent = user.toUpperCase();
      brandBadge.setAttribute('title', `Active User: ${user} (Tap to show PC Name)`);
    } else {
      brandBadge.textContent = host;
      brandBadge.setAttribute('title', `Host PC: ${host} (Tap to show Username)`);
    }
  }

  if (pcHostname) {
    if (user && user !== host) {
      pcHostname.textContent = `${user} @ ${host} • ${osName}`;
    } else {
      pcHostname.textContent = `${host} • ${osName}`;
    }
    pcHostname.setAttribute('title', `Tap to copy: http://${ip || window.location.host}`);
  }
}

if (brandBadge) {
  brandBadge.addEventListener('click', () => {
    triggerHaptic();
    state.badgeMode = state.badgeMode === 'user' ? 'host' : 'user';
    if (state.hostInfo) {
      updateDynamicHost(state.hostInfo);
      const label = state.badgeMode === 'user'
        ? (state.lang === 'ar' ? `المستخدم: ${state.hostInfo.user}` : `User: ${state.hostInfo.user}`)
        : (state.lang === 'ar' ? `اسم الحاسوب: ${state.hostInfo.host}` : `PC: ${state.hostInfo.host}`);
      showToast(label);
    }
  });
}

if (brandLogoWrap) {
  brandLogoWrap.addEventListener('click', () => {
    triggerHaptic();
    brandLogoWrap.classList.remove('spin-anim');
    void brandLogoWrap.offsetWidth;
    brandLogoWrap.classList.add('spin-anim');
    setTimeout(() => brandLogoWrap.classList.remove('spin-anim'), 600);
  });
}

if (pcHostname) {
  pcHostname.addEventListener('click', () => {
    triggerHaptic();
    const url = window.location.origin;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast(state.lang === 'ar' ? 'تم نسخ رابط الاتصال!' : (state.lang === 'fr' ? 'URL de connexion copiée !' : `Copied: ${url}`));
      }).catch(() => {});
    }
  });
}

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
// Themes Management (14 Ultra-Premium Glassmorphic Themes)
// ==========================================================================
const ALL_THEMES = [
  'theme-instagram', 'theme-facebook', 'theme-youtube', 'theme-canva',
  'theme-gmail', 'theme-claude', 'theme-linkedin', 'theme-duolingo',
  'theme-spotify', 'theme-discord', 'theme-netflix', 'theme-tiktok',
  'theme-twitch', 'theme-x'
];

function applyTheme(themeName) {
  document.body.classList.remove(...ALL_THEMES);
  document.body.classList.add(themeName);
  state.theme = themeName;
  localStorage.setItem('altdeck_theme', themeName);
  localStorage.setItem('tabdeck_theme', themeName);
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-theme') === themeName);
  });
}
applyTheme(state.theme);

document.querySelectorAll('.theme-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    triggerHaptic();
    const themeName = chip.getAttribute('data-theme');
    applyTheme(themeName);
    const chipLabel = chip.querySelector('span') ? chip.querySelector('span').textContent : themeName;
    const msg = state.lang === 'ar' ? `تم تفعيل مظهر: ${chipLabel}` : (state.lang === 'fr' ? `Thème activé : ${chipLabel}` : `Theme switched to ${chipLabel}`);
    showToast(msg);
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
    cardTitleVolume: 'Master Volume & Media',
    btnMute: 'MUTE',
    micTitle: 'Microphone',
    micBadgeOnAir: '🔴 ON AIR',
    micBadgeMuted: 'MUTED',
    micStatusSub: 'Default Communications Capture',
    btnMuteMic: 'MUTE MIC',
    btnUnmuteMic: 'UNMUTE MIC',
    nowPlayingBadgeIdle: 'IDLE',
    nowPlayingBadgePlaying: 'PLAYING',
    nowPlayingBadgePaused: 'PAUSED',
    nowPlayingNoMedia: 'No Media Active',
    nowPlayingWaiting: 'Waiting for Spotify, YouTube, or Edge...',
    btnPrev: 'Prev',
    btnPlayPause: 'Play / Pause',
    btnNext: 'Next',
    cardTitleBrightness: 'Display & Screen Brightness',
    cardTitleTelemetry: 'PC Hardware Telemetry',
    btnTaskmgr: 'Task Manager',
    cpuName: 'CPU Processor',
    ramName: 'RAM Memory',
    powerName: 'Power & Battery',
    cardTitleApps: 'Application Launchpad',
    appsSubtitle: 'One-Tap Instant Launch',
    browseDetectedApps: '🔍 Browse Auto-Detected PC Apps...',
    appAddedToDeck: 'App added to your Stream Deck!',
    customActionsTitle: 'Custom Actions & Macros',
    btnAddAction: '+ Add Action',
    cardTitleSnap: 'Windows Snap & Multi-Screen',
    snapBadge: 'Win 11 Layouts',
    groupSnapLayouts: 'Snap Layouts',
    snapLeft: 'Left 50%',
    maximize: 'Maximize',
    minimize: 'Minimize',
    snapRight: 'Right 50%',
    groupDisplays: 'Displays & Desktops',
    screenLeft: 'Screen ←',
    screenRight: 'Screen →',
    deskLeft: 'Desk ←',
    deskRight: 'Desk →',
    groupShortcuts: 'System Shortcuts',
    taskView: 'Task View',
    desktop: 'Desktop',
    screenshot: 'Screenshot',
    newDesk: '+ New Desk',
    closeApp: 'Close App',
    cardTitlePower: 'Power Management',
    powerSubtitle: 'With Safe Countdown',
    powerLock: 'Lock PC',
    powerScreenOff: 'Screen Off',
    turnDisplaysOff: 'Turn Displays Off (Keep PC Running)',
    screenOffBanner: 'PC Displays are OFF (Dell is Running)',
    btnWakeScreens: 'WAKE SCREENS',
    fileBeamTitle: 'Quick File Drop (AirDrop for PC)',
    btnOpenFolder: '📂 Open Folder on PC',
    dropFilesPrompt: 'Tap to Pick Files or Drop Photos',
    dropFilesSub: 'Sends instantly over Wi-Fi to Desktop / AltDeck Transfers',
    liveHistory: 'Real-Time Load Waveform (Last 60s)',
    topProcesses: 'Top Resource Apps',
    topProcSub: 'RAM Active • Instant Kill',
    powerSleep: 'Sleep',
    powerRestart: 'Restart',
    powerShutdown: 'Shutdown',
    keepPcRunning: 'Keep PC Awake',
    quickProject: 'Project Display',
    quickTogglesTitle: 'Windows Quick Toggles',
    quickNightLight: 'Night Light',
    quickBluetooth: 'Bluetooth',
    quickWifi: 'Wi-Fi',
    quickCalc: 'Calculator',
    quickGameBar: 'Game Bar',
    quickSettings: 'Settings',
    powerRestartExplorer: 'Restart Explorer',
    powerRestartAudio: 'Restart Audio Driver',
    powerAbortCountdown: 'Abort Countdown',
    mouseControlsTitle: 'Mouse & Gesture Controls',
    mouseControlsBadge: 'Hardware Pro',
    pointerSpeedTitle: 'Pointer Sensitivity',
    mouseQuickActions: 'Quick Mouse Actions',
    mouseDoubleClick: 'Double Click',
    mouseDragLock: 'Drag Lock: OFF',
    mouseScrollUp: 'Scroll Up',
    mouseScrollDown: 'Scroll Down',
    trackpadMiddleClick: 'MIDDLE',
    gestureGuideTitle: 'Precision Gesture Guide',
    navKeysTitle: 'Navigation & Function Keys',
    catOffice: 'Office',
    catGraphics: 'Graphics',
    catTerminal: 'Terminal',
    trackpadTitle: 'Wireless Precision Touchpad',
    trackpadSub: 'Drag finger to move mouse',
    trackpadHint: 'Touch & Glide • Tap for Left Click • 2 Fingers to Scroll',
    trackpadLeftClick: 'LEFT CLICK',
    trackpadRightClick: 'RIGHT CLICK',
    numpadTitle: 'Quick Number Pad',
    numpadSub: 'Live Windows Input',
    remoteTypeTitle: 'Remote PC Typing',
    remoteTypeDirect: 'Direct to Focused Window',
    remoteTypeDesc: 'Type with your tablet keyboard or speech-to-text and inject it directly into any active PC window (browser, code, Discord, terminal).',
    remoteTypePlaceholder: 'Type text, search query, or link...',
    btnSend: 'Send',
    pairingDesc: 'Scan this QR code with your Android tablet camera or type this URL into Google Chrome:',
    pwaInstallTitle: 'Fullscreen Tablet App (PWA)',
    pwaInstallBtn: '📱 Install as Fullscreen App',
    pwaFullscreenBtn: '⛶ Switch to Fullscreen Mode',
    pwaDesc: 'Transform your Galaxy Tab or Android tablet into a dedicated, borderless Stream Deck hardware display without browser address bars!',
    pwaStep1: 'Tap the Install App button below, or tap Chrome menu ⋮ → "Install app" / "Add to Home screen".',
    pwaStep2: 'Launch from your tablet home screen. It automatically runs in 100% borderless fullscreen mode.',
    pwaStep3: 'Keep Screen Awake (sun icon) is automatically active to ensure your display never sleeps!',
    themeTitle: 'Themes & Appearance',
    themeCount: '14 Brand Color Charts',
    themeInstagram: 'Instagram',
    themeFacebook: 'Facebook / Meta',
    themeYoutube: 'YouTube',
    themeCanva: 'Canva',
    themeGmail: 'Gmail / Google',
    themeClaude: 'Claude AI',
    themeLinkedin: 'LinkedIn',
    themeDuolingo: 'Duolingo',
    themeSpotify: 'Spotify',
    themeDiscord: 'Discord',
    themeNetflix: 'Netflix',
    themeTiktok: 'TikTok',
    themeTwitch: 'Twitch',
    themeX: 'X (Twitter)',
    langTitle: 'Language & Feedback',
    langLabel: 'Interface Language',
    soundLabel: 'Notification Sound',
    soundSub: 'Synth chime when PC sends alert',
    hapticLabel: 'Haptic Vibration',
    hapticSub: 'Tactile motor feedback on touch',
    timeOffsetTitle: 'Time Offset & 24hr Mode',
    timeOffsetSub: 'Strict 24hr format • Adjust timezone offset if needed',
    notifTestTitle: 'PC Notifications Hub',
    notifTestDesc: 'Send alerts from your PC using npm run notify or POST to /api/notify.',
    testSuccess: 'Test Success',
    testWarning: 'Test Warning',
    testError: 'Test Error',
    manageActionsTitle: 'Manage Custom Deck Buttons',
    btnCreateAction: '+ Create Custom Button',
    modalShutdownTitle: 'Confirm Shutdown',
    modalShutdownDesc: 'Your PC will power down in:',
    modalCancelNow: 'CANCEL NOW',
    modalExecuteNow: 'EXECUTE NOW',
    detectedAppsTitle: 'Auto-Detected Installed PC Apps',
    detectedAppsRefresh: 'Refresh',
    detectedAppsDesc: 'Automatically detected from Windows Start Menu and Apps. Click Launch to test on PC, or + Add to Deck to place an instant shortcut button on your Stream Deck!',
    detectedAppsPlaceholder: 'Search installed PC apps (e.g. Spotify, Discord, Steam, VS Code, Photoshop)...',
    scanningPC: 'Scanning PC...',
    scanningPCDesc: 'Scanning installed apps on PC...',
    coresActive: '8 Cores Active',
    badgeMoveDisp: 'Move Disp',
    badgeVirtualDesk: 'Virtual Desk',
    shortcutAltTab: 'Alt + Tab',
    catVoiceChat: 'Voice & Chat',
    catAnthropic: 'Anthropic',
    catIOSManager: 'iOS Manager',
    catBrowser: 'Browser',
    catCodeEditor: 'Code Editor',
    catAIIDE: 'AI IDE',
    catFiles: 'Files',
    catClassic: 'Classic',
    catControl: 'Control',
    modalCreateActionTitle: 'Create Custom Button',
    modalFieldLabel: 'Button Label / Name',
    modalFieldType: 'Action Type',
    modalFieldApp: 'Select Detected App',
    modalFieldUrl: 'Target URL',
    modalFieldColor: 'Button Accent Color',
    btnCancel: 'Cancel',
    btnSaveAction: 'Save Action',
    notifHistoryTitle: 'Notifications History',
    btnClearNotifs: 'Clear All Notifications',
    notifEmpty: 'No notifications yet',
    btnMuteActive: 'MUTED',
    btnMuteInactive: 'MUTE',
    statusOnline: 'Online',
    statusReconnecting: 'Reconnecting...',
    pillCpu: 'CPU',
    pillRam: 'RAM',
    optLaunchApp: 'Launch Installed PC App',
    optOpenUrl: 'Open URL (Browser)',
    optCopyText: 'Copy Text to PC Clipboard',
    optRunCommand: 'Run Terminal Command (PC)',
    optChooseApp: '-- Choose Installed PC App --',
    colorCyan: 'Cyan',
    colorEmerald: 'Emerald',
    colorPink: 'Pink',
    colorAmber: 'Amber',
    colorPurple: 'Purple',
    btnTimeSync: 'PC Sync',
    toastActionExecuted: 'Action Executed',
    guideLaunch: 'Launch',
    guideAddToDeck: '+ Add to Deck'
  },
  fr: {
    navDeck: 'Stream Deck',
    navTrackpad: 'Pavé Tactile',
    navNumpad: 'Pavé Numérique',
    navConfig: 'Configuration',
    navPairing: 'Connexion & QR',
    cardTitleVolume: 'Volume Principal & Média',
    btnMute: 'MUET',
    micTitle: 'Microphone',
    micBadgeOnAir: '🔴 EN DIRECT',
    micBadgeMuted: 'COUPE',
    micStatusSub: 'Périphérique de Communication Principal',
    btnMuteMic: 'COUPER MIC',
    btnUnmuteMic: 'RÉACTIVER MIC',
    nowPlayingBadgeIdle: 'ARRÊTÉ',
    nowPlayingBadgePlaying: 'EN LECTURE',
    nowPlayingBadgePaused: 'EN PAUSE',
    nowPlayingNoMedia: 'Aucun média actif',
    nowPlayingWaiting: 'En attente de Spotify, YouTube ou Edge...',
    btnPrev: 'Préc',
    btnPlayPause: 'Lecture / Pause',
    btnNext: 'Suiv',
    cardTitleBrightness: 'Luminosité de l\'Écran',
    cardTitleTelemetry: 'Télémétrie Matérielle PC',
    btnTaskmgr: 'Gestionnaire',
    cpuName: 'Processeur CPU',
    ramName: 'Mémoire RAM',
    powerName: 'Alimentation & Batterie',
    cardTitleApps: 'Lanceur d\'Applications',
    appsSubtitle: 'Lancement instantané en 1 touche',
    browseDetectedApps: '🔍 Parcourir les applications PC détectées...',
    appAddedToDeck: 'Application ajoutée à votre Stream Deck !',
    customActionsTitle: 'Actions & Macros Personnalisées',
    btnAddAction: '+ Ajouter Action',
    cardTitleSnap: 'Ancrage & Multi-Écrans Windows',
    snapBadge: 'Dispositions Win 11',
    groupSnapLayouts: 'Ancrage de Fenêtres',
    snapLeft: 'Gauche 50%',
    maximize: 'Agrandir',
    minimize: 'Réduire',
    snapRight: 'Droite 50%',
    groupDisplays: 'Écrans & Bureaux',
    screenLeft: 'Écran ←',
    screenRight: 'Écran →',
    deskLeft: 'Bureau ←',
    deskRight: 'Bureau →',
    groupShortcuts: 'Raccourcis Système',
    taskView: 'Vue Tâches',
    desktop: 'Bureau',
    screenshot: 'Capture d\'écran',
    newDesk: '+ Nouveau Bureau',
    closeApp: 'Fermer App',
    cardTitlePower: 'Gestion de l\'Alimentation',
    powerSubtitle: 'Avec Compte à Rebours Sécurisé',
    powerLock: 'Verrouiller',
    powerScreenOff: 'Écran Éteint',
    turnDisplaysOff: 'Éteindre les écrans (garder le PC actif)',
    screenOffBanner: 'Écrans PC éteints (le PC reste actif)',
    btnWakeScreens: 'RÉVEILLER L’ÉCRAN',
    fileBeamTitle: 'Transfert Rapide (AirDrop pour PC)',
    btnOpenFolder: '📂 Ouvrir le dossier sur PC',
    dropFilesPrompt: 'Appuyez pour choisir ou glissez des photos',
    dropFilesSub: 'Envoi instantané par Wi-Fi sur le bureau / AltDeck Transfers',
    liveHistory: 'Courbe de charge en direct (60s)',
    topProcesses: 'Applications Gourmandes',
    topProcSub: 'RAM Active • Arrêt Instantané',
    powerSleep: 'Veille',
    powerRestart: 'Redémarrer',
    powerShutdown: 'Éteindre',
    keepPcRunning: 'Garder le PC actif',
    quickProject: 'Projeter l’écran',
    quickTogglesTitle: 'Basculeurs Rapides Windows',
    quickNightLight: 'Éclairage nocturne',
    quickBluetooth: 'Bluetooth',
    quickWifi: 'Wi-Fi',
    quickCalc: 'Calculatrice',
    quickGameBar: 'Barre de jeu',
    quickSettings: 'Paramètres',
    powerRestartExplorer: 'Redémarrer Explorer',
    powerRestartAudio: 'Redémarrer Audio',
    powerAbortCountdown: 'Annuler le compte',
    mouseControlsTitle: 'Contrôles Souris & Gestes',
    mouseControlsBadge: 'Matériel Pro',
    pointerSpeedTitle: 'Sensibilité du curseur',
    mouseQuickActions: 'Actions Rapides Souris',
    mouseDoubleClick: 'Double Clic',
    mouseDragLock: 'Glisser: OFF',
    mouseScrollUp: 'Défilement Haut',
    mouseScrollDown: 'Défilement Bas',
    trackpadMiddleClick: 'MILIEU',
    gestureGuideTitle: 'Guide des Gestes de Précision',
    navKeysTitle: 'Touches Navigation & Fonctions',
    catOffice: 'Bureautique',
    catGraphics: 'Graphisme',
    catTerminal: 'Terminal',
    trackpadTitle: 'Pavé Tactile Sans Fil de Précision',
    trackpadSub: 'Glissez pour déplacer la souris',
    trackpadHint: 'Glisser pour déplacer • Taper pour clic gauche • 2 doigts pour défiler',
    trackpadLeftClick: 'CLIC GAUCHE',
    trackpadRightClick: 'CLIC DROIT',
    numpadTitle: 'Pavé Numérique Rapide',
    numpadSub: 'Saisie directe dans Windows',
    remoteTypeTitle: 'Saisie Texte à Distance',
    remoteTypeDirect: 'Directement vers la fenêtre active',
    remoteTypeDesc: 'Tapez au clavier ou dictez à la voix sur la tablette pour injecter le texte dans la fenêtre active sur le PC.',
    remoteTypePlaceholder: 'Tapez du texte, une recherche ou un lien...',
    btnSend: 'Envoyer',
    pairingDesc: 'Scannez ce QR code avec l\'appareil photo de votre tablette Android ou ouvrez cette URL dans Chrome :',
    pwaInstallTitle: 'Application Tablette Plein Écran (PWA)',
    pwaInstallBtn: '📱 Installer en application plein écran',
    pwaFullscreenBtn: '⛶ Passer en plein écran',
    pwaDesc: 'Transformez votre Galaxy Tab ou tablette Android en véritable Stream Deck plein écran sans barre d\'adresse !',
    pwaStep1: 'Appuyez sur le bouton Installer ci-dessous, ou appuyez sur le menu Chrome ⋮ → "Installer l\'application".',
    pwaStep2: 'Lancez depuis l\'écran d\'accueil de votre tablette. L\'application s\'ouvre en plein écran borderless.',
    pwaStep3: 'Le maintien de l\'écran allumé (icône soleil) s\'active automatiquement.',
    themeTitle: 'Thèmes & Apparence',
    themeCount: '14 Chartes Graphiques',
    themeInstagram: 'Instagram',
    themeFacebook: 'Facebook / Meta',
    themeYoutube: 'YouTube',
    themeCanva: 'Canva',
    themeGmail: 'Gmail / Google',
    themeClaude: 'Claude AI',
    themeLinkedin: 'LinkedIn',
    themeDuolingo: 'Duolingo',
    themeSpotify: 'Spotify',
    themeDiscord: 'Discord',
    themeNetflix: 'Netflix',
    themeTiktok: 'TikTok',
    themeTwitch: 'Twitch',
    themeX: 'X (Twitter)',
    langTitle: 'Langue & Audio',
    langLabel: 'Langue de l\'Interface',
    soundLabel: 'Son de Notification',
    soundSub: 'Carillon synthétisé lors d\'une alerte PC',
    hapticLabel: 'Vibration Haptique',
    hapticSub: 'Retour tactile vibratoire à chaque touche',
    timeOffsetTitle: 'Décalage Horaire & Mode 24h',
    timeOffsetSub: 'Format 24h strict • Ajustez le fuseau si nécessaire',
    notifTestTitle: 'Hub de Notifications PC',
    notifTestDesc: 'Envoyez des alertes depuis votre PC avec npm run notify ou par l\'API POST /api/notify.',
    testSuccess: 'Test Succès',
    testWarning: 'Test Alerte',
    testError: 'Test Erreur',
    manageActionsTitle: 'Gérer les Boutons Personnalisés',
    btnCreateAction: '+ Créer un Bouton Personnalisé',
    modalShutdownTitle: 'Confirmer l\'Arrêt du PC',
    modalShutdownDesc: 'Votre PC va s\'éteindre dans :',
    modalCancelNow: 'ANNULER MAINTENANT',
    modalExecuteNow: 'ÉTEINDRE MAINTENANT',
    detectedAppsTitle: 'Applications PC Détectées Automatiquement',
    detectedAppsRefresh: 'Actualiser',
    detectedAppsDesc: 'Détecté automatiquement depuis le menu Démarrer de Windows. Cliquez sur Lancer pour tester sur PC, ou + Ajouter au Deck pour créer un raccourci instantané !',
    detectedAppsPlaceholder: 'Rechercher des applications installées (ex. Spotify, Discord, Steam, VS Code)...',
    scanningPC: 'Recherche sur le PC...',
    scanningPCDesc: 'Recherche des applications installées sur le PC...',
    coresActive: '8 cœurs actifs',
    badgeMoveDisp: 'Écran',
    badgeVirtualDesk: 'Bureau virtuel',
    shortcutAltTab: 'Alt + Tab',
    catVoiceChat: 'Voix & Chat',
    catAnthropic: 'Anthropic',
    catIOSManager: 'Gestionnaire iOS',
    catBrowser: 'Navigateur',
    catCodeEditor: 'Éditeur de Code',
    catAIIDE: 'IDE IA',
    catFiles: 'Fichiers',
    catClassic: 'Classique',
    catControl: 'Contrôle',
    modalCreateActionTitle: 'Créer un Bouton Personnalisé',
    modalFieldLabel: 'Nom / Étiquette du Bouton',
    modalFieldType: 'Type d\'Action',
    modalFieldApp: 'Sélectionner l\'Application Détectée',
    modalFieldUrl: 'URL Cible',
    modalFieldColor: 'Couleur d\'Accentuation',
    btnCancel: 'Annuler',
    btnSaveAction: 'Enregistrer l\'Action',
    notifHistoryTitle: 'Historique des Notifications',
    btnClearNotifs: 'Effacer Toutes les Notifications',
    notifEmpty: 'Aucune notification pour le moment',
    btnMuteActive: 'MUTÉ',
    btnMuteInactive: 'MUET',
    statusOnline: 'En ligne',
    statusReconnecting: 'Reconnexion...',
    pillCpu: 'CPU',
    pillRam: 'RAM',
    optLaunchApp: 'Lancer une application PC',
    optOpenUrl: 'Ouvrir une URL (Navigateur)',
    optCopyText: 'Copier dans le presse-papier PC',
    optRunCommand: 'Exécuter une commande (PC)',
    optChooseApp: '-- Choisir une application --',
    colorCyan: 'Cyan',
    colorEmerald: 'Émeraude',
    colorPink: 'Rose',
    colorAmber: 'Ambre',
    colorPurple: 'Violet',
    btnTimeSync: 'Synchro PC',
    toastActionExecuted: 'Action exécutée',
    guideLaunch: 'Lancer',
    guideAddToDeck: '+ Deck'
  },
  ar: {
    navDeck: 'لوحة التحكم',
    navTrackpad: 'لوحة اللمس',
    navNumpad: 'لوحة الأرقام',
    navConfig: 'الإعدادات',
    navPairing: 'الربط والرمز',
    cardTitleVolume: 'مستوى الصوت والوسائط',
    btnMute: 'كتم الصوت',
    micTitle: 'الميكروفون',
    micBadgeOnAir: '🔴 قيد البث',
    micBadgeMuted: 'مكتوم',
    micStatusSub: 'جهاز الاتصال الصوتي الافتراضي',
    btnMuteMic: 'كتم الميكروفون',
    btnUnmuteMic: 'تشغيل الميكروفون',
    nowPlayingBadgeIdle: 'متوقف',
    nowPlayingBadgePlaying: 'قيد التشغيل',
    nowPlayingBadgePaused: 'مؤقت',
    nowPlayingNoMedia: 'لا يوجد وسائط قيد التشغيل',
    nowPlayingWaiting: 'بانتظار Spotify أو YouTube أو Edge...',
    btnPrev: 'السابق',
    btnPlayPause: 'تشغيل / إيقاف',
    btnNext: 'التالي',
    cardTitleBrightness: 'سطوع الشاشة',
    cardTitleTelemetry: 'مراقبة عتاد الكمبيوتر',
    btnTaskmgr: 'إدارة المهام',
    cpuName: 'المعالج CPU',
    ramName: 'ذاكرة الرام RAM',
    powerName: 'الطاقة والبطارية',
    cardTitleApps: 'لوحة إطلاق التطبيقات',
    appsSubtitle: 'تشغيل فوري بلمسة واحدة',
    browseDetectedApps: '🔍 تصفح تطبيقات الكمبيوتر المكتشفة...',
    appAddedToDeck: 'تمت إضافة التطبيق إلى لوحة التحكم بنجاح!',
    customActionsTitle: 'أزرار واختصارات مخصصة',
    btnAddAction: '+ إضافة زر',
    cardTitleSnap: 'محاذاة النوافذ والشاشات',
    snapBadge: 'تنسيقات ويندوز 11',
    groupSnapLayouts: 'محاذاة وتقسيم الشاشة',
    snapLeft: 'يسار 50%',
    maximize: 'تكبير',
    minimize: 'تصغير',
    snapRight: 'يمين 50%',
    groupDisplays: 'الشاشات وأسطح المكتب',
    screenLeft: 'الشاشة ←',
    screenRight: 'الشاشة →',
    deskLeft: 'سطح مكتب ←',
    deskRight: 'سطح مكتب →',
    groupShortcuts: 'اختصارات النظام',
    taskView: 'عرض المهام',
    desktop: 'سطح المكتب',
    screenshot: 'لقطة شاشة',
    newDesk: '+ سطح جديد',
    closeApp: 'إغلاق النافذة',
    cardTitlePower: 'التحكم بالطاقة',
    powerSubtitle: 'مع مؤقت أمان للإلغاء',
    powerLock: 'قفل الكمبيوتر',
    powerScreenOff: 'إطفاء الشاشة',
    turnDisplaysOff: 'إطفاء الشاشات (مع بقاء الكمبيوتر يعمل)',
    screenOffBanner: 'الشاشات مطفأة (الكمبيوتر يعمل)',
    btnWakeScreens: 'إيقاظ الشاشات',
    fileBeamTitle: 'الإرسال السريع للملفات (AirDrop للكمبيوتر)',
    btnOpenFolder: '📂 فتح المجلد على الكمبيوتر',
    dropFilesPrompt: 'اضغط لاختيار ملفات أو صور',
    dropFilesSub: 'إرسال فوري عبر الواي فاي إلى سطح المكتب / AltDeck Transfers',
    liveHistory: 'مخطط الاستهلاك المباشر (آخر 60 ثانية)',
    topProcesses: 'أكثر التطبيقات استهلاكاً',
    topProcSub: 'الذاكرة النشطة • إنهاء فوري',
    powerSleep: 'سكون',
    powerRestart: 'إعادة تشغيل',
    powerShutdown: 'إيقاف التشغيل',
    keepPcRunning: 'مع إبقاء الكمبيوتر يعمل',
    quickProject: 'عرض / مشاركة الشاشة',
    quickTogglesTitle: 'اختصارات ويندوز السريعة',
    quickNightLight: 'إضاءة ليلية',
    quickBluetooth: 'بلوتوث',
    quickWifi: 'واي فاي',
    quickCalc: 'الآلة الحاسبة',
    quickGameBar: 'شريط الألعاب',
    quickSettings: 'الإعدادات',
    powerRestartExplorer: 'إعادة تشغيل إكسبلورر',
    powerRestartAudio: 'إعادة تشغيل درايفر الصوت',
    powerAbortCountdown: 'إلغاء المؤقت',
    mouseControlsTitle: 'إعدادات وإيماءات الماوس',
    mouseControlsBadge: 'عتاد احترافي',
    pointerSpeedTitle: 'حساسية مؤشر الماوس',
    mouseQuickActions: 'إجراءات الماوس السريعة',
    mouseDoubleClick: 'نقرة مزدوجة',
    mouseDragLock: 'سحب مستمر: معطّل',
    mouseScrollUp: 'تمرير للأعلى',
    mouseScrollDown: 'تمرير للأسفل',
    trackpadMiddleClick: 'وسط',
    gestureGuideTitle: 'دليل إيماءات اللمس الدقيقة',
    navKeysTitle: 'مفاتيح التنقل والوظائف',
    catOffice: 'أوفيس',
    catGraphics: 'تصميم',
    catTerminal: 'طرفية',
    trackpadTitle: 'لوحة لمس لاسلكية دقيقة',
    trackpadSub: 'مرر إصبعك لتحريك مؤشر الماوس',
    trackpadHint: 'المس وحرك المؤشر • نقرة للنقر الأيسر • إصبعان للتمرير',
    trackpadLeftClick: 'نقرة يسار',
    trackpadRightClick: 'نقرة يمين',
    numpadTitle: 'لوحة الأرقام السريعة',
    numpadSub: 'إدخال فوري في نظام ويندوز',
    remoteTypeTitle: 'الكتابة عن بعد على الكمبيوتر',
    remoteTypeDirect: 'مباشرة في النافذة النشطة',
    remoteTypeDesc: 'اكتب بلوحة مفاتيح التابلت أو أملِ صوتياً ليتم إدخال النص مباشرة في النافذة المفتوحة على الكمبيوتر.',
    remoteTypePlaceholder: 'اكتب نصاً، أو بحثاً، أو رابطاً...',
    btnSend: 'إرسال',
    pairingDesc: 'امسح رمز QR بكاميرا التابلت أو افتح هذا الرابط في متصفح كروم:',
    pwaInstallTitle: 'تطبيق التابلت ملء الشاشة (PWA)',
    pwaInstallBtn: '📱 تثبيت كتطبيق ملء الشاشة',
    pwaFullscreenBtn: '⛶ التبديل إلى وضع ملء الشاشة',
    pwaDesc: 'حول جهاز التابلت إلى لوحة ستريم ديك حقيقية بملء الشاشة وبدون أشرطة متصفح!',
    pwaStep1: 'انقر على زر تثبيت التطبيق أدناه أو من قائمة كروم ⋮ اختر "تثبيت التطبيق".',
    pwaStep2: 'شغل التطبيق من شاشة التابلت الرئيسية ليعمل تلقائياً بكامل الشاشة.',
    pwaStep3: 'خاصية إبقاء الشاشة مضاءة (أيقونة الشمس) تعمل تلقائياً لمنع قفل التابلت.',
    themeTitle: 'المظهر والسمات',
    themeCount: '14 سمة لأشهر المنصات',
    themeInstagram: 'إنستغرام',
    themeFacebook: 'فيسبوك / ميتا',
    themeYoutube: 'يوتيوب',
    themeCanva: 'كانفا',
    themeGmail: 'جيميل / جوجل',
    themeClaude: 'كلود AI',
    themeLinkedin: 'لينكد إن',
    themeDuolingo: 'دولينجو',
    themeSpotify: 'سبوتيفاي',
    themeDiscord: 'ديسكورد',
    themeNetflix: 'نتفليكس',
    themeTiktok: 'تيك توك',
    themeTwitch: 'تويتش',
    themeX: 'إكس (تويتر)',
    langTitle: 'اللغة والتنبيهات',
    langLabel: 'لغة الواجهة',
    soundLabel: 'صوت التنبيهات',
    soundSub: 'رنين نغمة عند تلقي إشعار من الكمبيوتر',
    hapticLabel: 'الاهتزاز اللمسي',
    hapticSub: 'اهتزاز لمسي تفاعلي عند النقر',
    timeOffsetTitle: 'فرق التوقيت ونظام 24 ساعة',
    timeOffsetSub: 'نظام 24 ساعة دقيق • يمكنك ضبط فارق الساعات',
    notifTestTitle: 'مركز إشعارات الكمبيوتر',
    notifTestDesc: 'أرسل تنبيهات من الكمبيوتر عبر أمر npm run notify أو عبر طلب POST /api/notify.',
    testSuccess: 'تجربة نجاح',
    testWarning: 'تجربة تحذير',
    testError: 'تجربة خطأ',
    manageActionsTitle: 'إدارة الأزرار المخصصة',
    btnCreateAction: '+ إنشاء زر مخصص جديد',
    modalShutdownTitle: 'تأكيد إيقاف تشغيل الكمبيوتر',
    modalShutdownDesc: 'سيتم إيقاف تشغيل الكمبيوتر خلال:',
    modalCancelNow: 'إلغاء الآن',
    modalExecuteNow: 'تنفيذ الآن',
    detectedAppsTitle: 'تطبيقات الكمبيوتر المكتشفة تلقائياً',
    detectedAppsRefresh: 'تحديث',
    detectedAppsDesc: 'تم اكتشافها تلقائياً من قائمة ابدأ وتطبيقات Windows. انقر على تشغيل للتجربة على الكمبيوتر، أو + إضافة للوحة لوضع زر اختصار فوري!',
    detectedAppsPlaceholder: 'البحث في تطبيقات الكمبيوتر (مثل Spotify, Discord, Steam, VS Code)...',
    scanningPC: 'جاري الفحص...',
    scanningPCDesc: 'جاري فحص التطبيقات المثبتة على الكمبيوتر...',
    coresActive: '8 أنوية نشطة',
    badgeMoveDisp: 'نقل للشاشة',
    badgeVirtualDesk: 'سطح مكتب',
    shortcutAltTab: 'Alt + Tab',
    catVoiceChat: 'صوت ومحادثة',
    catAnthropic: 'أنثروبيك',
    catIOSManager: 'إدارة أجهزة iOS',
    catBrowser: 'متصفح',
    catCodeEditor: 'محرر أكواد',
    catAIIDE: 'بيئة ذكاء اصطناعي',
    catFiles: 'الملفات',
    catClassic: 'كلاسيكي',
    catControl: 'لوحة التحكم',
    modalCreateActionTitle: 'إنشاء زر مخصص جديد',
    modalFieldLabel: 'اسم الزر / التسمية',
    modalFieldType: 'نوع الإجراء',
    modalFieldApp: 'اختر التطبيق المكتشف',
    modalFieldUrl: 'الرابط المستهدف',
    modalFieldColor: 'لون تمييز الزر',
    btnCancel: 'إلغاء',
    btnSaveAction: 'حفظ الإجراء',
    notifHistoryTitle: 'سجل الإشعارات',
    btnClearNotifs: 'مسح جميع الإشعارات',
    notifEmpty: 'لا توجد إشعارات حتى الآن',
    btnMuteActive: 'مكتوم',
    btnMuteInactive: 'كتم',
    statusOnline: 'متصل',
    statusReconnecting: 'إعادة الاتصال...',
    pillCpu: 'المعالج',
    pillRam: 'الذاكرة',
    optLaunchApp: 'تشغيل تطبيق مثبت على الحاسوب',
    optOpenUrl: 'فتح رابط إنترنت (المتصفح)',
    optCopyText: 'نسخ النص إلى حافظة الحاسوب',
    optRunCommand: 'تنفيذ أمر موجه الأوامر (PC)',
    optChooseApp: '-- اختر تطبيقاً مثبتاً --',
    colorCyan: 'سماوي',
    colorEmerald: 'زمردي',
    colorPink: 'وردي',
    colorAmber: 'كهرماني',
    colorPurple: 'بنفسجي',
    btnTimeSync: 'مزامنة الحاسوب',
    toastActionExecuted: 'تم تنفيذ الإجراء',
    guideLaunch: 'تشغيل',
    guideAddToDeck: '+ للوحة'
  }
};

function applyLanguage(lang) {
  if (lang !== 'en' && lang !== 'fr' && lang !== 'ar') {
    lang = 'en';
  }
  state.lang = lang;
  localStorage.setItem('altdeck_lang', lang);
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
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // Enforce universal LTR on physical hardware controls
  document.querySelectorAll('.slider-container, .range-slider, .preset-buttons, .track-progress-section, .track-timeline-bar, .track-progress-fill, .track-time-labels, .playback-controls, .trackpad-buttons, .numpad-container, .numpad-operators, .lang-selector').forEach(el => {
    el.setAttribute('dir', 'ltr');
    el.style.direction = 'ltr';
  });

  // Re-apply dynamic states in current language safely
  try {
    if (typeof updateMicUI === 'function') {
      updateMicUI(state.micMuted);
    }
  } catch (e) {}

  try {
    if (typeof applyMedia === 'function' && state.media) {
      applyMedia(state.media);
    }
  } catch (e) {}

  try {
    const mb = document.getElementById('mute-btn');
    if (mb) {
      mb.textContent = state.muted ? (dict.btnMuteActive || 'MUTED') : (dict.btnMuteInactive || 'MUTE');
    }
  } catch (e) {}

  try {
    const st = document.getElementById('connection-status');
    if (st) {
      if (state.connected) {
        st.textContent = dict.statusOnline || 'Online';
      } else {
        st.textContent = dict.statusReconnecting || 'Reconnecting...';
      }
    }
  } catch (e) {}

  try {
    if (typeof applyTelemetry === 'function' && state.lastTelemetry) {
      applyTelemetry(state.lastTelemetry);
    }
  } catch (e) {}

  try {
    if (typeof renderCustomActions === 'function' && state.customActions) {
      renderCustomActions(state.customActions);
    }
  } catch (e) {}

  try {
    if (typeof updateNotificationDrawer === 'function') {
      updateNotificationDrawer();
    }
  } catch (e) {}

  try {
    if (typeof updateActionModalLabels === 'function') {
      updateActionModalLabels();
    }
  } catch (e) {}

  try {
    if (typeof renderDetectedApps === 'function' && state.detectedApps) {
      renderDetectedApps(state.detectedApps);
      updateAppSelectDropdown(state.detectedApps);
    }
  } catch (e) {}
}
applyLanguage(state.lang);

document.querySelectorAll('.btn-lang').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    const newLang = btn.getAttribute('data-lang');
    applyLanguage(newLang);
    const langNames = { en: 'English', fr: 'Français', ar: 'العربية' };
    showToast(newLang === 'ar' ? 'تم تغيير اللغة إلى العربية' : (newLang === 'fr' ? 'Langue changée en Français' : 'Language switched to English'));
  });
});

// Sound and Haptic toggles
const toggleSound = document.getElementById('toggle-sound');
if (toggleSound) {
  toggleSound.checked = state.soundEnabled;
  toggleSound.addEventListener('change', () => {
    state.soundEnabled = toggleSound.checked;
    localStorage.setItem('altdeck_sound', String(state.soundEnabled));
    localStorage.setItem('tabdeck_sound', String(state.soundEnabled));
  });
}

const toggleHaptic = document.getElementById('toggle-haptic');
if (toggleHaptic) {
  toggleHaptic.checked = state.hapticEnabled;
  toggleHaptic.addEventListener('change', () => {
    state.hapticEnabled = toggleHaptic.checked;
    localStorage.setItem('altdeck_haptic', String(state.hapticEnabled));
    localStorage.setItem('tabdeck_haptic', String(state.hapticEnabled));
  });
}

const btnTimeMinus1 = document.getElementById('btn-time-minus1');
const btnTimeSync = document.getElementById('btn-time-sync');
const btnTimePlus1 = document.getElementById('btn-time-plus1');

function updateTimeOffsetUI() {
  const off = state.timeOffsetHours || 0;
  if (btnTimeMinus1) btnTimeMinus1.classList.toggle('active', off === -1);
  if (btnTimeSync) btnTimeSync.classList.toggle('active', off === 0);
  if (btnTimePlus1) btnTimePlus1.classList.toggle('active', off === 1);
}

if (btnTimeMinus1) {
  btnTimeMinus1.addEventListener('click', () => {
    triggerHaptic();
    state.timeOffsetHours = -1;
    localStorage.setItem('altdeck_time_offset', '-1');
    localStorage.setItem('tabdeck_time_offset', '-1');
    updateTimeOffsetUI();
    updateClock();
    const msg = state.lang === 'ar' ? 'تم ضبط فارق الوقت: -1 ساعة (تنسيق 24 ساعة)' : (state.lang === 'fr' ? 'Décalage horaire défini à -1 heure (format 24h)' : 'Time offset set to -1 hour (24hr format)');
    showToast(msg);
  });
}

if (btnTimeSync) {
  btnTimeSync.addEventListener('click', () => {
    triggerHaptic();
    state.timeOffsetHours = 0;
    localStorage.setItem('altdeck_time_offset', '0');
    localStorage.setItem('tabdeck_time_offset', '0');
    updateTimeOffsetUI();
    updateClock();
    const msg = state.lang === 'ar' ? 'تمت مزامنة الوقت مع ساعة الحاسوب (24 ساعة)' : (state.lang === 'fr' ? 'Heure synchronisée avec l\'horloge du PC (24h)' : 'Time synced to PC Clock (24hr format)');
    showToast(msg);
  });
}

if (btnTimePlus1) {
  btnTimePlus1.addEventListener('click', () => {
    triggerHaptic();
    state.timeOffsetHours = 1;
    localStorage.setItem('altdeck_time_offset', '1');
    localStorage.setItem('tabdeck_time_offset', '1');
    updateTimeOffsetUI();
    updateClock();
    const msg = state.lang === 'ar' ? 'تم ضبط فارق الوقت: +1 ساعة (تنسيق 24 ساعة)' : (state.lang === 'fr' ? 'Décalage horaire défini à +1 heure (format 24h)' : 'Time offset set to +1 hour (24hr format)');
    showToast(msg);
  });
}

updateTimeOffsetUI();

// Clock updates (Strict 24-Hour Military Format & Auto PC Timezone Sync)
function updateClock() {
  if (!clockDisplay) return;
  const now = new Date();
  let hours, minutes;

  if (typeof state.serverTzOffset === 'number') {
    // Exact PC local time via UTC calculation
    // pcMs = UTC milliseconds - (serverTzOffset in minutes * 60000)
    const pcMs = Date.now() - (state.serverTzOffset * 60000);
    const pcDate = new Date(pcMs);
    hours = pcDate.getUTCHours();
    minutes = pcDate.getUTCMinutes();
  } else {
    hours = now.getHours();
    minutes = now.getMinutes();
  }

  // Apply user manual offset if active (e.g. -1 or +1)
  if (state.timeOffsetHours) {
    hours = (hours + state.timeOffsetHours + 24) % 24;
  }

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  clockDisplay.textContent = `${hStr}:${mStr}`;
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
    showToast(state.lang === 'ar' ? 'تم تفعيل إبقاء الشاشة مضاءة دائماً!' : (state.lang === 'fr' ? 'L\'écran restera allumé indéfiniment !' : 'Screen will stay awake indefinitely!'));
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
  showToast(state.lang === 'ar' ? 'تم إيقاف إبقاء الشاشة مضاءة' : (state.lang === 'fr' ? 'Maintien de l\'écran désactivé' : 'Keep-Awake Deactivated'));
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

// Quick Tablet Refresh Button (Wipes stale tablet cache & reloads fresh assets)
const btnRefreshApp = document.getElementById('btn-refresh-app');
if (btnRefreshApp) {
  btnRefreshApp.addEventListener('click', () => {
    triggerHaptic();
    btnRefreshApp.classList.add('spin-anim');
    showToast(state.lang === 'ar' ? 'جاري تحديث لوحة التحكم...' : (state.lang === 'fr' ? 'Actualisation de AltDeck...' : 'Refreshing AltDeck...'));

    if ('caches' in window) {
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).catch(() => {});
    }

    setTimeout(() => {
      window.location.reload();
    }, 300);
  });
}

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
    statusText.textContent = state.lang === 'ar' ? 'متصل' : (state.lang === 'fr' ? 'En ligne' : 'Online');
    console.log('Connected to AltDeck PC Controller');
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
      } else if (msg.event === 'telemetry') {
        applyTelemetry(msg.data);
      } else if (msg.event === 'media') {
        applyMedia(msg.data);
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    state.connected = false;
    statusDot.classList.add('disconnected');
    statusText.textContent = state.lang === 'ar' ? 'إعادة الاتصال...' : (state.lang === 'fr' ? 'Reconnexion...' : 'Reconnecting...');
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
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    if (data.muted) {
      muteBtn.classList.add('active');
      muteBtn.textContent = isAr ? 'مكتوم' : (isFr ? 'MUTÉ' : 'MUTED');
    } else {
      muteBtn.classList.remove('active');
      muteBtn.textContent = isAr ? 'كتم' : (isFr ? 'MUET' : 'MUTE');
    }
  }
  if (typeof data.brightness !== 'undefined') {
    state.brightness = data.brightness;
    brightnessSlider.value = data.brightness;
    brightnessBadge.textContent = `${data.brightness}%`;
  }
  if (typeof data.micMuted !== 'undefined') {
    state.micMuted = !!data.micMuted;
    updateMicUI(state.micMuted);
  }
  if (typeof data.pcTzOffset !== 'undefined') {
    state.serverTzOffset = data.pcTzOffset;
  }
  updateClock();
  if (data.telemetry) {
    applyTelemetry(data.telemetry);
  }
  if (data.media) {
    applyMedia(data.media);
  }
  if (data.hostname || data.username) {
    updateDynamicHost(data);
  }
}

// ==========================================================================
// Real-Time PC Notifications (From PC to Tablet)
// ==========================================================================
function showNotification(notif) {
  notifTitle.textContent = notif.title || 'AltDeck Alert';
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
    const emptyMsg = state.lang === 'ar'
      ? 'لا توجد إشعارات حتى الآن'
      : (state.lang === 'fr'
        ? 'Aucune notification pour le moment'
        : 'No notifications yet');
    notifHistoryList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 40px 0;">${emptyMsg}</div>`;
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
  const msg = state.lang === 'ar' ? 'تم مسح الإشعارات' : (state.lang === 'fr' ? 'Notifications effacées' : 'Notifications Cleared');
  showToast(msg);
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
    const emptyDeck = state.lang === 'ar'
      ? 'لا توجد أزرار مخصصة حتى الآن. انقر على "+ إضافة زر" لإنشاء زر!'
      : (state.lang === 'fr'
        ? 'Aucun bouton personnalisé. Touchez "+ Ajouter une action" pour en créer un !'
        : 'No custom buttons yet. Tap "+ Add Action" to configure one!');
    const emptyCfg = state.lang === 'ar'
      ? 'لا توجد إجراءات مخصصة مُهيأة.'
      : (state.lang === 'fr'
        ? 'Aucune action personnalisée configurée.'
        : 'No custom actions configured.');
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;">${emptyDeck}</div>`;
    if (configList) configList.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px;">${emptyCfg}</div>`;
    return;
  }

  actions.forEach(action => {
    const tile = document.createElement('div');
    tile.className = 'custom-action-tile';
    tile.style.setProperty('--action-color', action.color || 'var(--neon-cyan)');
    
    const iconSvg = getActionIconSvg(action.icon || action.type);
    const fallbackImage = `/api/app-icon?name=${encodeURIComponent(action.label || '')}&appId=${encodeURIComponent((action.payload && action.payload.appId) || action.action || '')}`;
    const iconSrc = action.iconImage || fallbackImage;

    tile.innerHTML = `
      <div class="custom-action-icon">
        <img src="${iconSrc}" alt="${escapeHtml(action.label)}" class="custom-action-img" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
        <div class="custom-action-svg-fallback" style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${iconSvg}</div>
      </div>
      <div class="custom-action-title">${escapeHtml(action.label)}</div>
      <div class="custom-action-type">${action.type}</div>
    `;

    tile.addEventListener('click', () => {
      triggerHaptic();
      const isAr = state.lang === 'ar';
      const isFr = state.lang === 'fr';
      if (action.type === 'url') {
        sendAction({ type: 'url', url: action.payload.url });
        showToast(isAr ? `تم الفتح: ${action.label}` : (isFr ? `Ouvert : ${action.label}` : `Opened: ${action.label}`));
      } else if (action.type === 'copy') {
        sendAction({ type: 'copy', text: action.payload.text });
        showToast(isAr ? `تم النسخ إلى الحاسوب: ${action.label}` : (isFr ? `Copié sur le PC : ${action.label}` : `Copied to PC: ${action.label}`));
      } else if (action.type === 'command') {
        sendAction({ type: 'command', command: action.payload.command });
        showToast(isAr ? `تم التنفيذ: ${action.label}` : (isFr ? `Exécuté : ${action.label}` : `Executed: ${action.label}`));
      } else if (action.type === 'app') {
        const targetApp = (action.payload && action.payload.appId) ? action.payload.appId : (action.action || action.id);
        sendAction({ type: 'app', action: targetApp, target: targetApp });
        showToast(isAr ? `جاري تشغيل: ${action.label}` : (isFr ? `Lancement de : ${action.label}` : `Launching: ${action.label}`));
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

function updateActionModalLabels() {
  if (!actionValLabel || !actionFormType) return;
  const val = actionFormType.value;
  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';

  if (val === 'app') {
    if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'block';
    actionValLabel.textContent = isAr ? 'معرف التطبيق / مسار البرنامج' : (isFr ? 'ID de l\'application / Chemin exécutable' : 'App ID / Executable Path');
    actionFormVal.placeholder = isAr ? 'اختر من القائمة أو أدخل معرف التطبيق' : (isFr ? 'Choisir dans la liste ou saisir l\'AppID' : 'Choose from list or enter AppID');
  } else {
    if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'none';
    if (val === 'url') {
      actionValLabel.textContent = isAr ? 'رابط الويب المستهدف' : (isFr ? 'URL de destination' : 'Target URL');
      actionFormVal.placeholder = 'https://...';
    } else if (val === 'copy') {
      actionValLabel.textContent = isAr ? 'النص لنسخه إلى حافظة الحاسوب' : (isFr ? 'Texte à copier sur le PC' : 'Text to Copy to PC Clipboard');
      actionFormVal.placeholder = isAr ? 'مثال: رمز سري أو نص متكرر' : (isFr ? 'ex: MonSecretToken123' : 'e.g. MySecretToken123');
    } else if (val === 'command') {
      actionValLabel.textContent = isAr ? 'أمر موجه الأوامر / الطرفية' : (isFr ? 'Commande de terminal' : 'Terminal Command');
      actionFormVal.placeholder = 'e.g. git pull || wt.exe';
    }
  }
}

function openActionModal() {
  triggerHaptic();
  actionFormLabel.value = '';
  actionFormVal.value = '';
  actionFormType.value = 'app';
  if (actionAppSelectGroup) actionAppSelectGroup.style.display = 'block';
  if (actionFormAppSelect) actionFormAppSelect.value = '';
  updateActionModalLabels();
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

actionFormType.addEventListener('change', updateActionModalLabels);

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
    const msg = state.lang === 'ar' ? 'يرجى ملء جميع الحقول' : (state.lang === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
    showToast(msg);
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
    const msg = state.lang === 'ar' ? `تمت إضافة "${label}" إلى لوحة التحكم!` : (state.lang === 'fr' ? `Ajouté "${label}" au Deck !` : `Added "${label}" to Deck!`);
    showToast(msg);
  } catch (e) {
    const msg = state.lang === 'ar' ? 'خطأ أثناء حفظ الإجراء' : (state.lang === 'fr' ? 'Erreur lors de l\'enregistrement' : 'Error saving action');
    showToast(msg);
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

// ==========================================================================
// Global Microphone Control & ON-AIR Indicator
// ==========================================================================
const micBadge = document.getElementById('mic-badge');
const btnMicToggle = document.getElementById('btn-mic-toggle');
const micStatusIcon = document.getElementById('mic-status-icon');
const micIconSvg = document.getElementById('mic-icon-svg');
const micStatusSub = document.getElementById('mic-status-sub');

function updateMicUI(isMuted) {
  if (!micBadge || !btnMicToggle) return;
  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';

  if (isMuted) {
    micBadge.className = 'mic-badge muted';
    micBadge.textContent = isAr ? 'مكتوم' : (isFr ? 'MUTÉ' : 'MUTED');
    btnMicToggle.className = 'btn-mic-toggle muted';
    btnMicToggle.textContent = isAr ? 'تفعيل المايك' : (isFr ? 'ACTIVER LE MICRO' : 'UNMUTE MIC');
    if (micStatusIcon) {
      micStatusIcon.style.background = 'rgba(148, 163, 184, 0.12)';
      micStatusIcon.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      micStatusIcon.style.color = 'var(--text-muted)';
    }
    if (micIconSvg) {
      micIconSvg.innerHTML = `
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M19 10v2a7 7 0 0 1-1.23 3.9M5.07 10.57A7 7 0 0 0 12 19"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      `;
    }
    if (micStatusSub) micStatusSub.textContent = isAr ? 'الميكروفون مغلق تماماً' : (isFr ? 'Microphone désactivé' : 'Microphone is Muted');
  } else {
    micBadge.className = 'mic-badge live';
    micBadge.textContent = isAr ? 'مباشر • قيد البث' : (isFr ? 'EN DIRECT • LIVE' : '🔴 ON AIR');
    btnMicToggle.className = 'btn-mic-toggle live';
    btnMicToggle.textContent = isAr ? 'كتم المايك' : (isFr ? 'COUPER LE MICRO' : 'MUTE MIC');
    if (micStatusIcon) {
      micStatusIcon.style.background = 'rgba(239, 68, 68, 0.18)';
      micStatusIcon.style.borderColor = 'rgba(239, 68, 68, 0.6)';
      micStatusIcon.style.color = '#EF4444';
    }
    if (micIconSvg) {
      micIconSvg.innerHTML = `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      `;
    }
    if (micStatusSub) micStatusSub.textContent = isAr ? 'المايك يعمل وينقل الصوت' : (isFr ? 'Microphone actif' : 'Microphone is Live');
  }
}

if (btnMicToggle) {
  btnMicToggle.addEventListener('click', () => {
    triggerHaptic();
    const nextMuted = !state.micMuted;
    state.micMuted = nextMuted;
    updateMicUI(nextMuted);
    sendAction({ type: 'mic', action: 'mute', value: nextMuted ? 1 : 0 });
    const toast = nextMuted
      ? (state.lang === 'ar' ? 'تم كتم الميكروفون' : (state.lang === 'fr' ? 'Microphone coupé' : 'Microphone Muted'))
      : (state.lang === 'ar' ? 'الميكروفون قيد البث (مباشر)' : (state.lang === 'fr' ? 'Microphone actif (EN DIRECT)' : 'Microphone is Live (ON AIR)'));
    showToast(toast);
  });
}

document.querySelectorAll('[data-vol], [data-volume]').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    const raw = btn.getAttribute('data-volume') || btn.getAttribute('data-vol');
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      volumeSlider.value = val;
      volumeBadge.textContent = `${val}%`;
      sendAction({ type: 'volume', action: 'set', value: val });
      const msg = state.lang === 'ar' ? `تم ضبط الصوت على ${val}%` : (state.lang === 'fr' ? `Volume réglé à ${val}%` : `Volume set to ${val}%`);
      showToast(msg);
    }
  });
});

// ==========================================================================
// Media Player Now-Playing Art & Track Progress Bar (Feature #5)
// ==========================================================================
const nowPlayingDeck = document.getElementById('now-playing-deck');
const nowPlayingTitle = document.getElementById('now-playing-title');
const nowPlayingArtist = document.getElementById('now-playing-artist');
const nowPlayingBadge = document.getElementById('now-playing-badge');
const trackTimelineBar = document.getElementById('track-timeline-bar');
const trackProgressFill = document.getElementById('track-progress-fill');
const trackTimeCurrent = document.getElementById('track-time-current');
const trackTimeTotal = document.getElementById('track-time-total');
const btnPlayPause = document.getElementById('btn-playpause');

state.media = {
  title: '',
  artist: '',
  playbackStatus: 'Stopped',
  position: 0,
  duration: 0,
  lastUpdate: Date.now()
};

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

let isUserScrubbing = false;
let scrubSec = 0;

function applyMedia(media) {
  if (!media || !nowPlayingDeck) return;
  const statusStr = String(media.playbackStatus || '').trim().toLowerCase();
  const isPlaying = statusStr === 'playing' || statusStr === '4';
  const isPaused = statusStr === 'paused' || statusStr === '5';

  state.media = {
    ...state.media,
    ...media,
    playbackStatus: isPlaying ? 'Playing' : (isPaused ? 'Paused' : 'Stopped'),
    isPlaying: isPlaying,
    lastUpdate: Date.now()
  };

  nowPlayingDeck.classList.toggle('playing', isPlaying);
  nowPlayingDeck.classList.toggle('paused', isPaused);

  if (media.title) {
    nowPlayingTitle.textContent = media.title;
    nowPlayingArtist.textContent = media.artist || (media.album || 'Windows Media');
  } else {
    nowPlayingTitle.textContent = state.lang === 'ar' ? 'لا يوجد وسائط قيد التشغيل' : (state.lang === 'fr' ? 'Aucun média actif' : 'No Media Active');
    nowPlayingArtist.textContent = state.lang === 'ar' ? 'بانتظار Spotify أو YouTube أو Edge...' : (state.lang === 'fr' ? 'En attente de Spotify, YouTube...' : 'Waiting for Spotify, YouTube, or Edge...');
  }

  if (nowPlayingBadge) {
    if (isPlaying) {
      nowPlayingBadge.textContent = state.lang === 'ar' ? 'قيد التشغيل' : (state.lang === 'fr' ? 'EN LECTURE' : 'PLAYING');
    } else if (isPaused) {
      nowPlayingBadge.textContent = state.lang === 'ar' ? 'مؤقت' : (state.lang === 'fr' ? 'EN PAUSE' : 'PAUSED');
    } else {
      nowPlayingBadge.textContent = state.lang === 'ar' ? 'متوقف' : (state.lang === 'fr' ? 'ARRÊTÉ' : 'IDLE');
    }
  }

  // Update Play/Pause button icon & label
  if (btnPlayPause) {
    const playText = state.lang === 'ar' ? 'تشغيل' : (state.lang === 'fr' ? 'Lecture' : 'Play');
    const pauseText = state.lang === 'ar' ? 'إيقاف مؤقت' : (state.lang === 'fr' ? 'Pause' : 'Pause');
    if (isPlaying) {
      btnPlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
        <span>${pauseText}</span>
      `;
    } else {
      btnPlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>${playText}</span>
      `;
    }
  }

  if (!isUserScrubbing) {
    updateMediaTimelineUI();
  }
}

function updateMediaTimelineUI() {
  if (!trackProgressFill || !trackTimeCurrent || !trackTimeTotal || isUserScrubbing) return;
  const dur = Number(state.media.duration) || 0;
  let pos = Number(state.media.position) || 0;

  // Interpolate position smoothly if currently playing
  if (state.media.isPlaying && state.media.lastUpdate) {
    const elapsed = (Date.now() - state.media.lastUpdate) / 1000;
    pos = dur > 0 ? Math.min(dur, pos + elapsed) : (pos + elapsed);
  }

  const pct = dur > 0 ? Math.min(100, Math.max(0, (pos / dur) * 100)) : 0;
  trackProgressFill.style.width = `${pct}%`;
  trackTimeCurrent.textContent = formatTime(pos);
  trackTimeTotal.textContent = formatTime(dur);
}

// Local tick timer for butter-smooth progress bar movement every 500ms
setInterval(() => {
  if (state.media && state.media.isPlaying && !isUserScrubbing) {
    updateMediaTimelineUI();
  }
}, 500);

// Seek interaction & touch scrubbing on timeline bar
if (trackTimelineBar) {
  function getScrubTarget(e) {
    if (!state.media || !state.media.duration || state.media.duration <= 0) return 0;
    const rect = trackTimelineBar.getBoundingClientRect();
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * state.media.duration);
  }

  function startScrub(e) {
    if (!state.media || !state.media.duration || state.media.duration <= 0) return;
    isUserScrubbing = true;
    scrubSec = getScrubTarget(e);
    const dur = state.media.duration;
    const pct = (scrubSec / dur) * 100;
    trackProgressFill.style.width = `${pct}%`;
    trackTimeCurrent.textContent = formatTime(scrubSec);
  }

  function moveScrub(e) {
    if (!isUserScrubbing) return;
    scrubSec = getScrubTarget(e);
    const dur = state.media.duration;
    const pct = (scrubSec / dur) * 100;
    trackProgressFill.style.width = `${pct}%`;
    trackTimeCurrent.textContent = formatTime(scrubSec);
  }

  function endScrub() {
    if (!isUserScrubbing) return;
    isUserScrubbing = false;
    state.media.position = scrubSec;
    state.media.lastUpdate = Date.now();
    updateMediaTimelineUI();
    sendAction({ type: 'media', action: 'seek', value: scrubSec });
    const seekMsg = state.lang === 'ar' ? `الانتقال إلى ${formatTime(scrubSec)}` : (state.lang === 'fr' ? `Positionné à ${formatTime(scrubSec)}` : `Seeked to ${formatTime(scrubSec)}`);
    showToast(seekMsg);
  }

  trackTimelineBar.addEventListener('mousedown', (e) => {
    startScrub(e);
    const onMove = (ev) => moveScrub(ev);
    const onUp = () => {
      endScrub();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  trackTimelineBar.addEventListener('touchstart', (e) => {
    startScrub(e);
  }, { passive: true });

  trackTimelineBar.addEventListener('touchmove', (e) => {
    moveScrub(e);
  }, { passive: true });

  trackTimelineBar.addEventListener('touchend', () => {
    endScrub();
  });
}

document.getElementById('btn-prev').addEventListener('click', () => {
  sendAction({ type: 'media', action: 'prev' });
  const msg = state.lang === 'ar' ? 'المقطع السابق' : (state.lang === 'fr' ? 'Piste précédente' : 'Previous Track');
  showToast(msg);
});

if (btnPlayPause) {
  btnPlayPause.addEventListener('click', () => {
    sendAction({ type: 'media', action: 'playpause' });
    const msg = state.lang === 'ar' ? 'تشغيل / إيقاف مؤقت' : (state.lang === 'fr' ? 'Lecture / Pause' : 'Play / Pause');
    showToast(msg);
  });
}

document.getElementById('btn-next').addEventListener('click', () => {
  sendAction({ type: 'media', action: 'next' });
  const msg = state.lang === 'ar' ? 'المقطع التالي' : (state.lang === 'fr' ? 'Piste suivante' : 'Next Track');
  showToast(msg);
});

// ==========================================================================
// Brightness & Dell Controls
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
    triggerHaptic();
    const val = parseInt(btn.getAttribute('data-bright'), 10);
    brightnessSlider.value = val;
    brightnessBadge.textContent = `${val}%`;
    sendAction({ type: 'brightness', action: 'set', value: val });
    const msg = state.lang === 'ar' ? `تم ضبط السطوع على ${val}%` : (state.lang === 'fr' ? `Luminosité réglée à ${val}%` : `Brightness set to ${val}%`);
    showToast(msg);
  });
});

const btnOpenTaskmgr = document.getElementById('btn-open-taskmgr');
if (btnOpenTaskmgr) {
  btnOpenTaskmgr.addEventListener('click', () => {
    triggerHaptic();
    sendAction({ type: 'system', action: 'taskmgr' });
    const msg = state.lang === 'ar' ? 'تم فتح إدارة المهام على الحاسوب' : (state.lang === 'fr' ? 'Gestionnaire des tâches lancé sur le PC' : 'Launched Windows Task Manager on PC');
    showToast(msg);
  });
}

// ==========================================================================
// Hardware Telemetry Real-Time Synchronizer
// ==========================================================================
function applyTelemetry(t) {
  if (!t) return;
  state.lastTelemetry = t;
  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';

  // 1. CPU Processor
  if (typeof t.cpu === 'number') {
    const cpuVal = `${t.cpu}%`;
    const pillCpu = document.getElementById('pill-cpu-val');
    const badgeCpu = document.getElementById('cpu-percent-badge');
    const barCpu = document.getElementById('cpu-progress-bar');
    if (pillCpu) pillCpu.textContent = cpuVal;
    if (badgeCpu) badgeCpu.textContent = cpuVal;
    if (barCpu) {
      barCpu.style.width = `${Math.min(100, Math.max(0, t.cpu))}%`;
      if (t.cpu > 85) {
        barCpu.style.background = '#ef4444';
        if (badgeCpu) badgeCpu.style.color = '#ef4444';
      } else if (t.cpu > 60) {
        barCpu.style.background = '#f59e0b';
        if (badgeCpu) badgeCpu.style.color = '#f59e0b';
      } else {
        barCpu.style.background = '#38bdf8';
        if (badgeCpu) badgeCpu.style.color = 'var(--neon-cyan)';
      }
    }
    if (t.cores) {
      const coresText = document.getElementById('cpu-cores-text');
      if (coresText) {
        coresText.textContent = isAr ? `${t.cores} أنوية نشطة` : (isFr ? `${t.cores} cœurs actifs` : `${t.cores} Cores Active`);
      }
    }
  }

  // 2. RAM Memory
  if (t.ram) {
    const ramPct = `${t.ram.percent}%`;
    const pillRam = document.getElementById('pill-ram-val');
    const badgeRam = document.getElementById('ram-percent-badge');
    const barRam = document.getElementById('ram-progress-bar');
    const textRam = document.getElementById('ram-usage-text');
    if (pillRam) pillRam.textContent = ramPct;
    if (badgeRam) badgeRam.textContent = ramPct;
    if (barRam) barRam.style.width = `${Math.min(100, Math.max(0, t.ram.percent))}%`;
    if (textRam && typeof t.ram.usedGb !== 'undefined') {
      textRam.textContent = isAr
        ? `${t.ram.usedGb} جيجابايت / ${t.ram.totalGb} جيجابايت (${t.ram.freeGb} جيجابايت متاح)`
        : (isFr
          ? `${t.ram.usedGb} Go / ${t.ram.totalGb} Go (${t.ram.freeGb} Go libre)`
          : `${t.ram.usedGb} GB / ${t.ram.totalGb} GB (${t.ram.freeGb} GB Free)`);
    }
  }

  // 3. Battery & Power
  if (t.battery) {
    const batPct = `${t.battery.percent}%`;
    const pillBatVal = document.getElementById('pill-bat-val');
    const pillBatIcon = document.getElementById('pill-bat-icon');
    const badgeBat = document.getElementById('battery-percent-badge');
    const barBat = document.getElementById('battery-progress-bar');
    const subBat = document.getElementById('battery-sub-text');
    const batSvg = document.getElementById('battery-status-icon');

    if (pillBatVal) pillBatVal.textContent = batPct;
    if (badgeBat) badgeBat.textContent = batPct;
    if (barBat) barBat.style.width = `${Math.min(100, Math.max(0, t.battery.percent))}%`;

    const isPlugged = !!t.battery.isCharging || t.battery.powerLine === 'Online';
    if (pillBatIcon) pillBatIcon.textContent = isPlugged ? '⚡' : '🔋';
    if (subBat) {
      subBat.textContent = isPlugged
        ? (isAr ? '⚡ متصل بالشاحن (تيار مستمر)' : (isFr ? '⚡ Branché sur secteur' : '⚡ Plugged In (AC Power)'))
        : (isAr ? '🔋 يعمل على البطارية' : (isFr ? '🔋 Sur batterie' : '🔋 Running on Battery'));
    }
    if (batSvg) {
      if (isPlugged) {
        batSvg.style.color = '#10B981';
      } else if (t.battery.percent <= 20) {
        batSvg.style.color = '#EF4444';
      } else {
        batSvg.style.color = 'var(--neon-cyan)';
      }
    }
  }

  // 4. Waveform Sparkline
  if (t.cpuHistory && t.ramHistory) {
    updateSparkline(t.cpuHistory, t.ramHistory);
  }

  // 5. Top Resource Processes
  if (t.topProcesses) {
    updateTopProcesses(t.topProcesses);
  }
}

function updateSparkline(cpuHist, ramHist) {
  if (!cpuHist || !ramHist || cpuHist.length === 0) return;
  const cpuLine = document.getElementById('sparkline-cpu-line');
  const cpuArea = document.getElementById('sparkline-cpu-area');
  const ramLine = document.getElementById('sparkline-ram-line');
  const ramArea = document.getElementById('sparkline-ram-area');
  if (!cpuLine || !ramLine) return;

  const w = 300;
  const h = 48;
  const maxPoints = Math.max(cpuHist.length, ramHist.length, 2);
  const stepX = w / (maxPoints - 1);

  function makePath(data, closeArea = false) {
    if (!data || data.length === 0) return '';
    let d = '';
    for (let i = 0; i < data.length; i++) {
      const x = (i * stepX).toFixed(1);
      const val = Math.max(0, Math.min(100, data[i]));
      const y = (h - (val / 100) * (h - 6) - 3).toFixed(1);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    if (closeArea) {
      const lastX = ((data.length - 1) * stepX).toFixed(1);
      d += ` L ${lastX} ${h} L 0 ${h} Z`;
    }
    return d;
  }

  cpuLine.setAttribute('d', makePath(cpuHist, false));
  if (cpuArea) cpuArea.setAttribute('d', makePath(cpuHist, true));
  ramLine.setAttribute('d', makePath(ramHist, false));
  if (ramArea) ramArea.setAttribute('d', makePath(ramHist, true));
}

function updateTopProcesses(processes) {
  const container = document.getElementById('top-processes-list');
  if (!container || !Array.isArray(processes)) return;
  if (processes.length === 0) {
    container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px;">No active high-resource apps</div>';
    return;
  }

  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';
  const killText = isAr ? 'إنهاء' : (isFr ? 'Arrêter' : 'Kill');

  container.innerHTML = processes.map(p => `
    <div class="proc-row" data-pid="${p.pid}">
      <div class="proc-info">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--neon-cyan); flex-shrink: 0;"><rect x="2" y="2" width="20" height="20" rx="3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <span class="proc-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
      </div>
      <div style="display: flex; align-items: center;">
        <span class="proc-ram-badge">${p.ramMb} MB</span>
        <button class="btn-kill-proc" data-pid="${p.pid}" data-name="${escapeHtml(p.name)}" title="End process immediately">${killText}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-kill-proc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      const pid = btn.getAttribute('data-pid');
      const name = btn.getAttribute('data-name');
      sendAction({ type: 'process', action: 'kill', pid });
      const toastMsg = isAr ? `تم إنهاء ${name}` : (isFr ? `${name} arrêté` : `Terminated ${name}`);
      showToast(toastMsg);
      const row = container.querySelector(`[data-pid="${pid}"]`);
      if (row) row.remove();
    });
  });
}

// App Launchpad
document.querySelectorAll('.app-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    const appId = tile.getAttribute('data-app');
    const appName = tile.querySelector('.app-name').textContent;
    sendAction({ type: 'app', action: appId });
    const msg = state.lang === 'ar' ? `جاري تشغيل ${appName}...` : (state.lang === 'fr' ? `Lancement de ${appName}...` : `Launching ${appName}...`);
    showToast(msg);
  });
});

// Windows Controls & Snap Management (Feature #4)
document.querySelectorAll('[data-win]').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    const action = btn.getAttribute('data-win');
    sendAction({ type: 'window', action });
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';

    const winToasts = {
      'snap-left': isAr ? 'محاذاة النافذة إلى اليسار 50%' : (isFr ? 'Aligner à gauche 50%' : 'Snapped Window Left (50%)'),
      'snap-right': isAr ? 'محاذاة النافذة إلى اليمين 50%' : (isFr ? 'Aligner à droite 50%' : 'Snapped Window Right (50%)'),
      'maximize': isAr ? 'تكبير النافذة' : (isFr ? 'Agrandir la fenêtre' : 'Window Maximized'),
      'minimize': isAr ? 'تصغير النافذة' : (isFr ? 'Réduire la fenêtre' : 'Window Minimized'),
      'monitor-prev': isAr ? 'نقل النافذة إلى الشاشة السابقة' : (isFr ? 'Déplacer vers l’écran précédent' : 'Moved Window to Prev Monitor'),
      'monitor-next': isAr ? 'نقل النافذة إلى الشاشة التالية' : (isFr ? 'Déplacer vers l’écran suivant' : 'Moved Window to Next Monitor'),
      'vdesk-left': isAr ? 'سطح المكتب الافتراضي السابق' : (isFr ? 'Bureau virtuel précédent' : 'Switched to Left Virtual Desktop'),
      'vdesk-right': isAr ? 'سطح المكتب الافتراضي التالي' : (isFr ? 'Bureau virtuel suivant' : 'Switched to Right Virtual Desktop'),
      'vdesk-new': isAr ? 'تم إنشاء سطح مكتب افتراضي جديد' : (isFr ? 'Nouveau bureau virtuel créé' : 'Created New Virtual Desktop'),
      'vdesk-close': isAr ? 'تم إغلاق سطح المكتب الافتراضي' : (isFr ? 'Bureau virtuel fermé' : 'Closed Virtual Desktop'),
      'switch': isAr ? 'التبديل بين النوافذ (Alt+Tab)' : (isFr ? 'Basculer d’application (Alt+Tab)' : 'Alt + Tab (App Switcher)'),
      'taskview': isAr ? 'عرض المهام (Win+Tab)' : (isFr ? 'Affichage des tâches (Win+Tab)' : 'Task View (Win + Tab)'),
      'desktop': isAr ? 'عرض سطح المكتب' : (isFr ? 'Afficher le bureau' : 'Toggled Desktop (Win + D)'),
      'screenshot': isAr ? 'أداة التقاط الشاشة' : (isFr ? 'Outil Capture d’écran' : 'Windows Snipping Tool (Win+Shift+S)'),
      'close': isAr ? 'إغلاق النافذة النشطة' : (isFr ? 'Fermer la fenêtre active' : 'Closed Active Window (Alt+F4)')
    };

    if (winToasts[action]) {
      showToast(winToasts[action]);
    }
  });
});


// Windows System Quick Toggles (Action Center)
document.querySelectorAll('[data-quick]').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    const action = btn.getAttribute('data-quick');
    sendAction({ type: 'quick-toggle', action });
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    const quickToasts = {
      'project': isAr ? 'قائمة مشاركة الشاشة (Win + P)' : (isFr ? 'Projection d’écran (Win + P)' : 'Project Display (Win + P)'),
      'nightlight': isAr ? 'إعدادات الإضاءة الليلية' : (isFr ? 'Éclairage nocturne' : 'Night Light Settings'),
      'bluetooth': isAr ? 'إعدادات البلوتوث' : (isFr ? 'Paramètres Bluetooth' : 'Bluetooth Settings'),
      'wifi': isAr ? 'إعدادات الشبكة والواي فاي' : (isFr ? 'Paramètres Réseau & Wi-Fi' : 'Wi-Fi & Network Settings'),
      'calc': isAr ? 'الآلة الحاسبة' : (isFr ? 'Calculatrice' : 'Windows Calculator'),
      'gamebar': isAr ? 'شريط ألعاب إكس بوكس (Win + G)' : (isFr ? 'Barre de jeu Xbox (Win + G)' : 'Xbox Game Bar (Win + G)'),
      'settings': isAr ? 'إعدادات ويندوز (Win + I)' : (isFr ? 'Paramètres Windows (Win + I)' : 'Windows Settings (Win + I)'),
      'restart-explorer': isAr ? 'تمت إعادة تشغيل مستكشف ويندوز وشريط المهام' : (isFr ? 'Explorateur Windows redémarré' : 'Restarted Windows Explorer & Taskbar'),
      'restart-audio': isAr ? 'تمت إعادة تشغيل خدمة الصوت بنجاح' : (isFr ? 'Service audio Windows redémarré' : 'Restarted Windows Audio Service')
    };
    if (quickToasts[action]) {
      showToast(quickToasts[action]);
    }
  });
});

// Power Actions with Safety Countdown
document.querySelectorAll('[data-power]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-power');
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    if (action === 'lock') {
      sendAction({ type: 'system', action: 'lock' });
      showToast(isAr ? 'تم قفل الحاسوب' : (isFr ? 'PC Verrouillé' : 'PC Locked'));
      return;
    }
    if (action === 'sleep') {
      sendAction({ type: 'system', action: 'sleep' });
      showToast(isAr ? 'الحاسوب ينتقل لوضع السكون...' : (isFr ? 'PC en veille...' : 'PC going to Sleep...'));
      return;
    }
    if (action === 'screen-off') {
      triggerHaptic();
      sendAction({ type: 'system', action: 'screen-off' });
      const banner = document.getElementById('screen-off-banner');
      if (banner) banner.style.display = 'block';
      showToast(isAr ? 'تم إطفاء الشاشات (الحاسوب يعمل)' : (isFr ? 'Écrans éteints (PC actif)' : 'PC Displays Turned Off'));
      return;
    }
    if (action === 'abort') {
      triggerHaptic();
      clearInterval(state.powerTimer);
      safetyModal.classList.remove('show');
      sendAction({ type: 'system', action: 'abort' });
      showToast(isAr ? 'تم إلغاء مؤقت إيقاف التشغيل' : (isFr ? 'Compte à rebours annulé' : 'Scheduled Shutdown Aborted'));
      return;
    }
    triggerHaptic();
    state.activePowerAction = action;
    state.powerCountdown = 30;
    if (action === 'shutdown') {
      modalTitle.textContent = isAr ? 'تأكيد إيقاف التشغيل' : (isFr ? 'Confirmer l\'arrêt' : 'Confirm Shutdown');
    } else {
      modalTitle.textContent = isAr ? 'تأكيد إعادة التشغيل' : (isFr ? 'Confirmer le redémarrage' : 'Confirm Restart');
    }
    modalSeconds.textContent = '30';
    safetyModal.classList.add('show');

    clearInterval(state.powerTimer);
    state.powerTimer = setInterval(() => {
      state.powerCountdown--;
      modalSeconds.textContent = String(state.powerCountdown);
      if (state.powerCountdown <= 0) {
        clearInterval(state.powerTimer);
        safetyModal.classList.remove('show');
        sendAction({ type: 'system', action: state.activePowerAction, value: 0 });
      }
    }, 1000);
  });
});

btnAbortPower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('show');
  sendAction({ type: 'system', action: 'abort' });
  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';
  showToast(isAr ? 'تم إلغاء إيقاف التشغيل!' : (isFr ? 'Arrêt annulé !' : 'Shutdown Aborted!'));
});

btnForcePower.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(state.powerTimer);
  safetyModal.classList.remove('show');
  sendAction({ type: 'system', action: state.activePowerAction, value: 0 });
});

// ==========================================================================
// Screen Off Mode (Without Sleep)
// ==========================================================================
function initScreenOffControls() {
  const btnDispOff = document.getElementById('btn-display-screen-off');
  const banner = document.getElementById('screen-off-banner');
  const btnWake = document.getElementById('btn-wake-screen');

  function wakeDisplays() {
    triggerHaptic();
    sendAction({ type: 'system', action: 'screen-on' });
    if (banner) banner.style.display = 'none';
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    showToast(isAr ? 'تم إيقاظ الشاشات' : (isFr ? 'Écrans réveillés' : 'PC Displays Awakened'));
  }

  if (btnDispOff) {
    btnDispOff.addEventListener('click', () => {
      triggerHaptic();
      sendAction({ type: 'system', action: 'screen-off' });
      if (banner) banner.style.display = 'block';
      const isAr = state.lang === 'ar';
      const isFr = state.lang === 'fr';
      showToast(isAr ? 'تم إطفاء الشاشات (الحاسوب يعمل)' : (isFr ? 'Écrans éteints (PC actif)' : 'PC Displays Turned Off'));
    });
  }

  if (btnWake) {
    btnWake.addEventListener('click', (e) => {
      e.stopPropagation();
      wakeDisplays();
    });
  }

  if (banner) {
    banner.addEventListener('click', () => {
      wakeDisplays();
    });
  }
}

// ==========================================================================
// Quick File Drop (AltDeck Beam - AirDrop for PC)
// ==========================================================================
function initFileDrop() {
  const dropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('file-beam-input');
  const progressWrap = document.getElementById('file-upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');
  const btnOpenFolder = document.getElementById('btn-open-transfers-folder');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFiles(fileInput.files);
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  });

  if (btnOpenFolder) {
    btnOpenFolder.addEventListener('click', () => {
      triggerHaptic();
      fetch('/api/open-transfers', { method: 'POST' });
      const isAr = state.lang === 'ar';
      const isFr = state.lang === 'fr';
      showToast(isAr ? 'تم فتح مجلد التحويلات على الحاسوب' : (isFr ? 'Dossier ouvert sur le PC' : 'Transfers folder opened on PC'));
    });
  }

  function uploadFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    progressWrap.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = `Uploading 1 / ${files.length}... 0%`;

    let currentIndex = 0;

    function uploadNext() {
      if (currentIndex >= files.length) {
        progressWrap.style.display = 'none';
        fileInput.value = '';
        triggerHaptic();
        loadTransfersHistory();
        const isAr = state.lang === 'ar';
        const isFr = state.lang === 'fr';
        showToast(isAr ? 'تم حفظ الملفات على سطح المكتب بنجاح!' : (isFr ? 'Fichiers enregistrés sur le bureau !' : 'Files saved to PC Desktop!'));
        return;
      }

      const file = files[currentIndex];
      const xhr = new XMLHttpRequest();
      const encName = encodeURIComponent(file.name);
      xhr.open('POST', `/api/upload?filename=${encName}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const filePct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = `${filePct}%`;
          progressText.textContent = `Uploading ${currentIndex + 1}/${files.length} (${file.name}): ${filePct}%`;
        }
      };

      xhr.onload = () => {
        currentIndex++;
        uploadNext();
      };

      xhr.onerror = () => {
        currentIndex++;
        uploadNext();
      };

      xhr.send(file);
    }

    uploadNext();
  }

  loadTransfersHistory();
}

async function loadTransfersHistory() {
  const container = document.getElementById('transfers-recent-list');
  if (!container) return;
  try {
    const res = await fetch('/api/transfers-history');
    const data = await res.json();
    if (data && Array.isArray(data.transfers) && data.transfers.length > 0) {
      container.innerHTML = data.transfers.map(f => `
        <div class="transfer-chip" title="${escapeHtml(f.name)}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          <span>${escapeHtml(f.name)} (${f.sizeMb} MB)</span>
        </div>
      `).join('');
    } else {
      container.innerHTML = '';
    }
  } catch (e) {}
}

// ==========================================================================
// Wireless Trackpad Mode
// ==========================================================================
const trackpadArea = document.getElementById('trackpad-area');
let lastTouchX = null;
let lastTouchY = null;
let isTwoFinger = false;
let lastTwoDist = null;

trackpadArea.addEventListener('touchstart', (e) => {
  const banner = document.getElementById('screen-off-banner');
  if (banner && banner.style.display !== 'none') {
    sendAction({ type: 'system', action: 'screen-on' });
    banner.style.display = 'none';
  }
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
      const mult = (state.mouseSensitivity || 1.0) * 1.8;
      const dx = Math.round((curX - lastTouchX) * mult);
      const dy = Math.round((curY - lastTouchY) * mult);
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

const mouseMiddle = document.getElementById('mouse-middle');
if (mouseMiddle) {
  mouseMiddle.addEventListener('click', () => {
    sendAction({ type: 'mouse', action: 'click', p1: 'middle' });
    triggerHaptic();
  });
}

document.getElementById('mouse-right').addEventListener('click', () => {
  sendAction({ type: 'mouse', action: 'click', p1: 'right' });
  triggerHaptic();
});

// Touchpad Pointer Sensitivity & Hardware Pro Companion
state.mouseSensitivity = 1.0;
document.querySelectorAll('.trackpad-speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    triggerHaptic();
    document.querySelectorAll('.trackpad-speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mouseSensitivity = parseFloat(btn.getAttribute('data-speed')) || 1.0;
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    showToast(isAr ? `تم ضبط سرعة الماوس: ${btn.textContent}` : (isFr ? `Sensibilité souris : ${btn.textContent}` : `Mouse Speed: ${btn.textContent}`));
  });
});

const btnMouseDbl = document.getElementById('btn-mouse-doubleclick');
if (btnMouseDbl) {
  btnMouseDbl.addEventListener('click', () => {
    triggerHaptic();
    sendAction({ type: 'mouse', action: 'click', p1: 'left' });
    setTimeout(() => {
      sendAction({ type: 'mouse', action: 'click', p1: 'left' });
    }, 80);
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    showToast(isAr ? 'نقرة مزدوجة' : (isFr ? 'Double clic' : 'Double Click Sent'));
  });
}

let isDragLocked = false;
const btnMouseDragLock = document.getElementById('btn-mouse-draglock');
const dragLockText = document.getElementById('draglock-text');
if (btnMouseDragLock) {
  btnMouseDragLock.addEventListener('click', () => {
    triggerHaptic();
    isDragLocked = !isDragLocked;
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    if (isDragLocked) {
      sendAction({ type: 'mouse', action: 'down', p1: 'left' });
      btnMouseDragLock.style.borderColor = '#EF4444';
      btnMouseDragLock.style.color = '#EF4444';
      if (dragLockText) dragLockText.textContent = isAr ? 'سحب مستمر: مفعّل' : (isFr ? 'Glisser: ON' : 'Drag Lock: ON');
      showToast(isAr ? 'تم تفعيل قفل السحب (الزر الأيسر مضغوط)' : (isFr ? 'Glisser verrouillé activé' : 'Drag Lock Engaged'));
    } else {
      sendAction({ type: 'mouse', action: 'up', p1: 'left' });
      btnMouseDragLock.style.borderColor = '';
      btnMouseDragLock.style.color = '';
      if (dragLockText) dragLockText.textContent = isAr ? 'سحب مستمر: معطّل' : (isFr ? 'Glisser: OFF' : 'Drag Lock: OFF');
      showToast(isAr ? 'تم إيقاف قفل السحب' : (isFr ? 'Glisser verrouillé désactivé' : 'Drag Lock Released'));
    }
  });
}

const btnMouseScrollUp = document.getElementById('btn-mouse-scrollup');
if (btnMouseScrollUp) {
  btnMouseScrollUp.addEventListener('click', () => {
    triggerHaptic();
    sendAction({ type: 'mouse', action: 'scroll', dy: -120 });
  });
}

const btnMouseScrollDown = document.getElementById('btn-mouse-scrolldown');
if (btnMouseScrollDown) {
  btnMouseScrollDown.addEventListener('click', () => {
    triggerHaptic();
    sendAction({ type: 'mouse', action: 'scroll', dy: 120 });
  });
}

// ==========================================================================
// Numpad & Remote PC Typing (Live Keystroke Injection)
// ==========================================================================
document.querySelectorAll('.numpad-key').forEach(keyBtn => {
  keyBtn.addEventListener('click', () => {
    const key = keyBtn.getAttribute('data-key');
    triggerHaptic();
    sendAction({ type: 'keyboard', action: 'press', key: key });
    const isAr = state.lang === 'ar';
    const isFr = state.lang === 'fr';
    showToast(isAr ? `مفتاح: ${key.toUpperCase()}` : (isFr ? `Touche : ${key.toUpperCase()}` : `Key: ${key.toUpperCase()}`));
  });
});

const remoteTextInput = document.getElementById('remote-text-input');
const btnSendRemoteText = document.getElementById('btn-send-remote-text');

function sendRemoteText() {
  if (!remoteTextInput) return;
  const text = remoteTextInput.value;
  if (!text) return;
  triggerHaptic();
  sendAction({ type: 'keyboard', action: 'type', text: text });
  const preview = text.length > 25 ? text.slice(0, 22) + '...' : text;
  const msg = state.lang === 'ar' ? `تم إرسال: "${preview}"` : (state.lang === 'fr' ? `Saisi sur le PC : "${preview}"` : `Typed to PC: "${preview}"`);
  showToast(msg);
  remoteTextInput.value = '';
}

if (btnSendRemoteText) {
  btnSendRemoteText.addEventListener('click', sendRemoteText);
}

if (remoteTextInput) {
  remoteTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendRemoteText();
    }
  });
}

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
    if (data.hostname || data.username) {
      updateDynamicHost(data);
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
        console.log('[AltDeck PWA] Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('[AltDeck PWA] Service Worker registration failed:', err);
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
      showToast(state.lang === 'ar' ? 'جاري تثبيت AltDeck...' : (state.lang === 'fr' ? 'Installation de AltDeck...' : 'Installing AltDeck as Fullscreen App...'));
    }
    deferredPrompt = null;
    if (btnInstallPwa) btnInstallPwa.style.display = 'none';
  } else {
    // If running in browser or prompt not available
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.matchMedia('(display-mode: fullscreen)').matches ||
                         window.navigator.standalone === true;
    if (isStandalone) {
      showToast(state.lang === 'ar' ? 'التطبيق مثبت ويعمل بملء الشاشة بالفعل!' : (state.lang === 'fr' ? 'AltDeck fonctionne déjà en mode plein écran !' : 'AltDeck is running in Fullscreen App mode!'));
    } else {
      const msg = state.lang === 'ar'
        ? '📱 لتثبيت التطبيق بملء الشاشة على تابلت سامسونج / أندرويد:\n1. اضغط على القائمة (⋮) أعلى متصفح Chrome.\n2. اختر "تثبيت التطبيق" أو "الإضافة إلى الشاشة الرئيسية".\n3. افتح AltDeck من شاشة جهازك ليعمل بملء الشاشة بدون أي أشرطة!'
        : (state.lang === 'fr'
          ? '📱 Pour installer AltDeck en plein écran sur votre tablette:\n1. Ouvrez le menu (⋮) de Google Chrome.\n2. Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".\n3. Lancez AltDeck depuis l\'écran d\'accueil sans barre d\'adresse !'
          : '📱 To install AltDeck as a Fullscreen App on your tablet:\n1. Tap the Chrome menu (⋮) in the top-right corner.\n2. Tap "Install app" or "Add to Home screen".\n3. Open AltDeck from your home screen to enjoy 100% borderless fullscreen!');
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
      showToast(state.lang === 'ar' ? 'تم تفعيل ملء الشاشة' : (state.lang === 'fr' ? 'Mode plein écran activé' : 'Entered Fullscreen Mode'));
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

window.addEventListener('appinstalled', () => {
  showToast(state.lang === 'ar' ? 'تم تثبيت AltDeck بنجاح!' : (state.lang === 'fr' ? 'AltDeck installé avec succès !' : 'AltDeck installed successfully!'));
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
      state.lang === 'ar' ? 'لا توجد تطبيقات مطابقة' : (state.lang === 'fr' ? 'Aucune application trouvée' : 'No matching applications found')
    }</div>`;
    return;
  }

  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'detected-app-card';
    const color = getRandomColor(app.name);
    const initial = (app.name || 'A').trim().charAt(0).toUpperCase();
    const iconUrl = `/api/app-icon?name=${encodeURIComponent(app.name)}&appId=${encodeURIComponent(app.appId)}`;

    card.innerHTML = `
      <div class="detected-app-icon" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); color: ${color};">
        <img src="${iconUrl}" alt="${escapeHtml(app.name)}" class="detected-app-img" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='inline-block';" />
        <span class="detected-app-fallback" style="display: none; color: ${color}; font-weight: 800;">${initial}</span>
      </div>
      <div class="detected-app-info">
        <div class="detected-app-name" title="${escapeHtml(app.name)}">${escapeHtml(app.name)}</div>
        <div class="detected-app-id" title="${escapeHtml(app.appId)}">${escapeHtml(app.appId)}</div>
      </div>
      <div class="detected-app-actions" dir="ltr">
        <button class="btn-app-launch" title="${isAr ? 'تشغيل على الحاسوب' : (isFr ? 'Lancer sur le PC' : 'Launch on PC')}">🚀</button>
        <button class="btn-app-add" title="${isAr ? 'إضافة إلى لوحة التحكم' : (isFr ? 'Ajouter au Stream Deck' : 'Add to Stream Deck')}">${isAr ? '+ للوحة' : '+ Deck'}</button>
      </div>
    `;

    // Launch on PC
    card.querySelector('.btn-app-launch').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic();
      sendAction({ type: 'app', action: app.appId, target: app.appId });
      const msg = state.lang === 'ar' ? `جاري تشغيل ${app.name} على الحاسوب...` : (state.lang === 'fr' ? `Lancement de ${app.name} sur le PC...` : `Launching ${app.name} on PC...`);
      showToast(msg);
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
        iconImage: iconUrl,
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
          const msg = state.lang === 'ar' ? `تمت إضافة "${app.name}" إلى لوحة التحكم!` : (state.lang === 'fr' ? `Ajouté "${app.name}" au Stream Deck !` : `Added "${app.name}" to Stream Deck!`);
          showToast(msg);
        }
      } catch (err) {
        const msg = state.lang === 'ar' ? 'خطأ في إضافة الإجراء' : (state.lang === 'fr' ? 'Erreur lors de l\'ajout' : 'Error adding action');
        showToast(msg);
      }
    });

    detectedAppsContainer.appendChild(card);
  });
}

function updateAppSelectDropdown(apps) {
  const select = document.getElementById('action-form-app-select');
  if (!select) return;
  const isAr = state.lang === 'ar';
  const isFr = state.lang === 'fr';
  const chooseText = isAr ? '-- اختر تطبيقاً مثبتاً --' : (isFr ? '-- Choisir une application --' : '-- Choose Installed PC App --');
  select.innerHTML = `<option value="">${chooseText}</option>`;
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
    detectedAppsCount.textContent = state.lang === 'ar' ? 'جاري الفحص...' : (state.lang === 'fr' ? 'Recherche sur le PC...' : 'Scanning PC...');
  }
  try {
    const res = await fetch(`/api/detected-apps${forceRefresh ? '?refresh=1' : ''}`);
    const data = await res.json();
    if (data.status === 'ok' && Array.isArray(data.apps)) {
      state.detectedApps = data.apps;
      if (detectedAppsCount) {
        detectedAppsCount.textContent = state.lang === 'ar'
          ? `${data.apps.length} تطبيق مكتشف`
          : (state.lang === 'fr' ? `${data.apps.length} applications détectées` : `${data.apps.length} Apps Detected`);
      }
      renderDetectedApps(state.detectedApps);
      updateAppSelectDropdown(state.detectedApps);
    }
  } catch (err) {
    if (detectedAppsCount) detectedAppsCount.textContent = state.lang === 'ar' ? 'خطأ في الفحص' : (state.lang === 'fr' ? 'Erreur d\'analyse' : 'Scan Error');
  }
}

if (btnRefreshDetectedApps) {
  btnRefreshDetectedApps.addEventListener('click', () => {
    triggerHaptic();
    fetchDetectedApps(true);
    const msg = state.lang === 'ar' ? 'جاري تحديث تطبيقات الحاسوب...' : (state.lang === 'fr' ? 'Actualisation des applications du PC...' : 'Refreshing detected PC apps...');
    showToast(msg);
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

// Final initial synchronization
initScreenOffControls();
initFileDrop();
applyLanguage(state.lang);


