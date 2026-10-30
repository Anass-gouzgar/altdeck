/* ==========================================================================
   AltDeck Showcase Landing Page Interactive Script
   Includes Web Audio Tactile Synthesizer, Theme Switcher, and Mode Simulators
   ========================================================================== */

// --- 1. Web Audio Synthesizer (Zero-Asset Tactile Haptic Audio) ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playClickSound(freq = 600, duration = 0.04, type = 'sine') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playChimeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.08, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.25);
    });
  } catch (e) {}
}

// Global click feedback on interactive buttons
document.addEventListener('click', (e) => {
  const target = e.target.closest('button, .demo-app-tile, .toggle-tile, .mode-tab, .theme-opt, .demo-drop-zone');
  if (target) {
    playClickSound(580, 0.035, 'triangle');
  }
});

// --- 2. Live Theme Switcher ---
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');
const themeNameLabel = document.getElementById('current-theme-name');
const themeOpts = document.querySelectorAll('.theme-opt');

if (themeBtn && themeDropdown) {
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    themeDropdown.classList.remove('open');
  });

  themeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const selected = opt.getAttribute('data-theme');
      document.body.setAttribute('data-theme', selected);
      themeOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      themeNameLabel.textContent = opt.textContent.trim();
      themeDropdown.classList.remove('open');
      triggerToast(`🎨 Theme switched to ${opt.textContent.trim()}`);
      playClickSound(880, 0.08, 'sine');
    });
  });
}

// --- 3. Interactive Mode Switcher Tabs ---
const modeTabs = document.querySelectorAll('.mode-tab');
const modePanels = document.querySelectorAll('.sandbox-panel');

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const targetMode = tab.getAttribute('data-mode');

    modePanels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `panel-${targetMode}`) {
        panel.classList.add('active');
      }
    });

    playClickSound(750, 0.05, 'triangle');
  });
});

// --- 4. Stream Deck Master Volume & Mic Simulator ---
const volSlider = document.getElementById('demo-vol-slider');
const volBadge = document.getElementById('demo-vol-val');

if (volSlider && volBadge) {
  volSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    volBadge.textContent = `${val}%`;
  });
}

function setDemoVol(val) {
  if (volSlider && volBadge) {
    volSlider.value = val;
    volBadge.textContent = `${val}%`;
    triggerToast(`🔊 PC Master Volume set to ${val}%`);
  }
}

let micIsLive = true;
function toggleDemoMic() {
  micIsLive = !micIsLive;
  const micIcon = document.getElementById('demo-mic-icon');
  const micTitle = document.getElementById('demo-mic-title');
  const micBtn = document.getElementById('demo-mic-toggle');

  if (micIsLive) {
    micIcon.className = 'mic-icon-circle on-air';
    micTitle.textContent = '🔴 LIVE ON AIR';
    micTitle.style.color = '#fff';
    micBtn.className = 'btn-toggle-mic live';
    micBtn.textContent = 'MUTE MIC';
    triggerToast('🎙️ CoreAudio: Microphone Unmuted (ON AIR)');
    playClickSound(800, 0.05, 'sine');
  } else {
    micIcon.className = 'mic-icon-circle';
    micTitle.textContent = '🔇 MIC MUTED';
    micTitle.style.color = '#10b981';
    micBtn.className = 'btn-toggle-mic muted';
    micBtn.textContent = 'UNMUTE MIC';
    triggerToast('🔇 CoreAudio: Microphone Muted');
    playClickSound(400, 0.05, 'sawtooth');
  }
}

// --- 5. Interactive Trackpad Pro Simulation ---
const trackpadArea = document.getElementById('demo-trackpad-surface');
const cursorPointer = document.getElementById('demo-cursor');

if (trackpadArea && cursorPointer) {
  const updateCursor = (x, y) => {
    const rect = trackpadArea.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;
    cursorPointer.style.display = 'block';
    cursorPointer.style.left = `${relX}px`;
    cursorPointer.style.top = `${relY}px`;
  };

  trackpadArea.addEventListener('mousemove', (e) => {
    updateCursor(e.clientX, e.clientY);
  });

  trackpadArea.addEventListener('mouseleave', () => {
    cursorPointer.style.display = 'none';
  });

  trackpadArea.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      updateCursor(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  trackpadArea.addEventListener('click', () => {
    triggerToast('🖱️ Precision Touchpad Tap: Left Click');
    playClickSound(950, 0.03, 'triangle');
  });
}

function setSpeed(btn, label) {
  document.querySelectorAll('#panel-trackpad .demo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  triggerToast(`⚡ Mouse sensitivity preset set to: ${label}`);
}

// --- 6. Numpad Calculator Simulator ---
let numpadBuffer = '0';
const numpadScreen = document.getElementById('numpad-screen-val');

function pressNum(key) {
  playClickSound(700, 0.03, 'triangle');
  if (key === 'C') {
    numpadBuffer = '0';
  } else if (key === 'BS') {
    numpadBuffer = numpadBuffer.length > 1 ? numpadBuffer.slice(0, -1) : '0';
  } else if (key === 'ENT') {
    try {
      numpadBuffer = String(eval(numpadBuffer.replace(/×/g, '*').replace(/÷/g, '/')));
    } catch (e) {
      numpadBuffer = 'Error';
    }
  } else {
    if (numpadBuffer === '0' || numpadBuffer === 'Error') {
      numpadBuffer = key;
    } else {
      numpadBuffer += key;
    }
  }
  if (numpadScreen) numpadScreen.textContent = numpadBuffer;
}

function sendDemoType() {
  const input = document.getElementById('demo-type-input');
  if (input && input.value.trim()) {
    triggerToast(`⌨️ Injected text into PC: "${input.value.trim()}"`);
    input.value = '';
    playClickSound(1100, 0.04, 'sine');
  }
}

// --- 7. AirDrop Beam Simulator ---
let isUploading = false;
function simulateDrop() {
  if (isUploading) return;
  isUploading = true;
  const progressWrap = document.getElementById('demo-drop-progress');
  const progressFill = document.getElementById('demo-drop-fill');
  const transfersList = document.getElementById('demo-transfers-list');

  progressWrap.style.display = 'block';
  progressFill.style.width = '0%';

  let percent = 0;
  const interval = setInterval(() => {
    percent += 10;
    progressFill.style.width = `${percent}%`;

    if (percent >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        progressWrap.style.display = 'none';
        isUploading = false;
        playChimeSound();
        triggerToast('📂 File Received! Saved to Desktop/AltDeck Transfers');

        const newRow = document.createElement('div');
        newRow.className = 'transfer-row';
        newRow.innerHTML = `<span>📷 Photo_${Date.now().toString().slice(-4)}.jpg</span><span class="file-size">3.6 MB</span>`;
        if (transfersList) {
          transfersList.prepend(newRow);
        }
      }, 300);
    }
  }, 70);
}

// --- 8. Power & Safety Countdown Modal Simulation ---
let modalCountdownInterval = null;
function startSafetyModal(action) {
  const modal = document.getElementById('safety-modal');
  const title = document.getElementById('modal-title');
  const timer = document.getElementById('modal-timer');

  title.textContent = `${action} System`;
  modal.style.display = 'flex';
  playClickSound(300, 0.1, 'sawtooth');

  let seconds = 30;
  timer.textContent = `${seconds}s`;

  if (modalCountdownInterval) clearInterval(modalCountdownInterval);
  modalCountdownInterval = setInterval(() => {
    seconds--;
    timer.textContent = `${seconds}s`;
    if (seconds <= 0) {
      clearInterval(modalCountdownInterval);
      closeSafetyModal();
      triggerToast(`⚠️ Live mode would now execute: ${action}`);
    }
  }, 1000);
}

function closeSafetyModal() {
  const modal = document.getElementById('safety-modal');
  if (modal) modal.style.display = 'none';
  if (modalCountdownInterval) clearInterval(modalCountdownInterval);
}

function abortCountdownDemo() {
  closeSafetyModal();
  triggerToast('🛑 Emergency Override: shutdown /a sent. Action cancelled!');
  playClickSound(880, 0.08, 'sine');
}

// --- 9. Toast Notification Engine ---
let toastTimeout = null;
function triggerToast(msg) {
  const toast = document.getElementById('landing-toast');
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// --- 10. Copy Quick Start Code Snippet ---
function copyCodeSnippet() {
  const snippet = document.getElementById('code-snippet');
  const copyText = document.getElementById('copy-text');
  if (!snippet) return;

  navigator.clipboard.writeText(snippet.textContent.trim()).then(() => {
    copyText.textContent = 'Copied!';
    triggerToast('📋 Terminal commands copied to clipboard');
    playClickSound(900, 0.05, 'sine');
    setTimeout(() => {
      copyText.textContent = 'Copy Code';
    }, 2500);
  });
}

function switchCodeTab() {
  const snippet = document.getElementById('code-snippet');
  if (snippet) {
    snippet.textContent = `# Windows 1-Click Batch Quick Start
# 1. Download Repository ZIP from GitHub
# 2. Extract to any folder on your PC
# 3. Double-click:
start-controller.bat

# AltDeck will auto-compile the native C# helper
# and display your tablet connection address!`;
  }
}

// --- 11. Fetch Live GitHub Star Count ---
async function fetchStars() {
  const starBadge = document.getElementById('github-stars');
  if (!starBadge) return;
  try {
    const res = await fetch('https://api.github.com/repos/Anass-gouzgar/altdeck');
    if (res.ok) {
      const data = await res.json();
      if (typeof data.stargazers_count === 'number') {
        starBadge.textContent = `★ ${data.stargazers_count}`;
      }
    }
  } catch (e) {
    starBadge.textContent = '★ Star';
  }
}
fetchStars();
