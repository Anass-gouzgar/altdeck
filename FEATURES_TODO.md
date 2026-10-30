# 📋 AltDeck PC Controller — Features & Roadmap TODO List

This document tracks all completed features, active improvements, and upcoming roadmap items for the **AltDeck PC Controller** (running on your Dell Latitude 7400 and Samsung Galaxy Tablet).

---

## 🟢 1. Completed & Verified Features

- [x] **Master Volume & Playback Controls**
  - Master volume slider (0-100%) with real-time two-way synchronization.
  - Preset volume jumps (**25%**, **50%**, **75%**, **100%**).
  - Instant Master Audio Mute toggle.
  - Media keys: **Previous Track**, **Play / Pause**, **Next Track**.

- [x] **Display & Brightness Controls**
  - Smooth display brightness slider (0-100%) communicating with Windows WMI.
  - One-tap brightness preset buttons (**20%**, **50%**, **80%**, **100%**).
  - Streamlined Card 2 layout (removed redundant/non-functional OEM toggles).

- [x] **Global Microphone Mute with Live "ON-AIR" Glow** *(Feature #2)*
  - Low-level Windows CoreAudio endpoint capture toggle (`native/pc-control.cs`).
  - Real-time `micMuted` state broadcast over WebSocket.
  - Pulsing red live badge (`🔴 ON AIR`) when microphone is live.
  - Grey muted badge (`MUTED`) with "UNMUTE MIC" button when mic is cut off.

- [x] **Functional Numpad Keystroke Injection & Remote PC Typing** *(Feature #1)*
  - Real-time Win32 `keybd_event` and `VkKeyScan` keystroke injection (bypassing Windows UIPI access denied issues).
  - Full arithmetic operator row (`÷`, `×`, `−`, `+`), numbers `0-9`, `Enter`, `Backspace`, `Tab`, `Esc`.
  - **Remote PC Typing bar**: Type sentences on the tablet and stream them straight into the PC's focused window.

- [x] **Live PC Hardware Telemetry Gauges** *(Feature #3)*
  - **CPU Processor**: Real-time load % with dynamic color shift (Cyan `<60%` → Amber → Red `>85%`) and core count (`8 Cores Active`).
  - **RAM Memory**: Real-time memory usage breakdown (`14.6 GB / 31.8 GB • 17.2 GB Free`) with progress gauge.
  - **Power & Battery**: Live state detection (`⚡ AC Plugged In` vs `🔋 Running on Battery`) and battery % level.
  - **Header Live Stat Pills**: CPU %, RAM %, and Battery % always visible in the top navigation bar.
  - **Task Manager Launcher**: One-tap button on the telemetry card to launch Windows Task Manager on PC.
  - **Zero-Lag Engine**: Sub-millisecond calculation with periodic 2-second WebSocket heartbeat.

- [x] **Strict 24-Hour Military Time & Timezone Offset Correction**
  - Clock in top bar formatted in strict 24-hour format (`HH:mm`, e.g. `23:30`) bypassing browser locale overrides.
  - Auto-synchronization with PC hardware timezone offset (`pcTzOffset`).
  - Dedicated interactive offset adjuster in Config tab (`[-1h]`, `[PC Sync]`, `[+1h]`) saved to tablet storage.

- [x] **Multi-Touch Trackpad & Virtual Mouse**
  - Smooth cursor tracking with acceleration.
  - Dedicated Left Click and Right Click areas.
  - Two-finger smooth vertical scrolling.

- [x] **Windows Quick Action Controls**
  - App Switcher (`Alt + Tab`).
  - Task View (`Win + Tab`).
  - Toggle Desktop (`Win + D`).
  - Windows Snipping Tool (`Win + Shift + S`).
  - Close Active Window (`Alt + F4`).

- [x] **Safe Power Control Hub**
  - 30-second abortable countdown modal for **Shutdown** and **Restart**.
  - Emergency **"Cancel Now"** button calling `shutdown /a`.
  - Instant **Lock Workstation** (`Win + L`) and **System Sleep**.

- [x] **Application Launchpad Deck**
  - One-tap launch tiles: Discord, Claude, YouTube, Spotify, Terminal, VS Code, Browser, Settings.

- [x] **Auto-Detected Installed PC Apps**
  - PowerShell registry scanner discovering installed PC apps.
  - Live search filter and one-tap **"+ Add to Stream Deck"** action.

- [x] **Custom Actions & Macros Studio**
  - Create and manage custom Stream Deck buttons.
  - Actions supported: Launch URLs, Hotkey Combos, PowerShell/Cmd scripts, Text Copy.
  - Color picker, custom labels, and persistent JSON storage.

- [x] **PC Notification Hub**
  - Tablet notification banner with synthesized audio chimes.
  - Notification history drawer with unread counter badge.
  - Send alerts from PC using `npm run notify -- "Title" "Message" success` or `POST /api/notify`.

- [x] **14 Luxury Cyber Themes & Multi-Language Audit**
  - **14 Cyberpunk/Glassmorphic Themes**: Obsidian Dark, Midnight Blue, Ocean Deep, Ember Orange, Emerald Forest, Cyber Rose, Frost Aurora, Royal Gold, Cyberpunk 2077, Matrix Code, Synthwave 80s, Dracula Purple, Crimson Red, Nord Arctic — each with distinct radial glows, high-contrast borders, and interactive preview chips in Config tab.
  - **Trilingual Language Audit (100% Dynamic Translation)**: English, Français, and Arabic (`العربية`) across every card, badge, button, placeholder, countdown modal, and real-time toast notification.
  - **Native Arabic RTL & Typography**: Full `[dir="rtl"]` layout reversal, Segoe UI / Cairo typography stack, mirrored flex cards and pills, while strictly preserving LTR numeric timestamps and telemetry percentages.
  - **Tablet & Mobile Fluid Responsiveness**: Adaptive media queries (`minmax(min(100%, 310px), 1fr)`) tuned for Samsung Galaxy Tab in both landscape and portrait, touch targets >= 44px, and clean wrapping on small screens.

- [x] **Windows Snap Layouts & Multi-Monitor Window Management** *(Feature #4 - Verified & Completed)*
  - **Snap Layouts (4 Tiles)**: Snap active window to Left Half (`Win + Left`), Right Half (`Win + Right`), Maximize (`Win + Up`), Minimize (`Win + Down`).
  - **Displays & Monitors**: Move active window across physical screens: Screen Left (`Win + Shift + Left`) & Screen Right (`Win + Shift + Right`).
  - **Virtual Desktops**: Smooth desktop switching: Desk Left (`Win + Ctrl + Left`), Desk Right (`Win + Ctrl + Right`), and Create New Desk (`Win + Ctrl + D`).
  - **Direct Win32 Window Snapping & Extended Key Events**: Work area monitor positioning (`SetWindowPos`, `ShowWindow`) and hardware extended key flags (`KEYEVENTF_EXTENDEDKEY`) in `pc-control.cs`.
  - **Multilingual Toasts & Touch Feedback**: Arabic, French, and English dynamic feedback toasts.

- [x] **Media Player Now-Playing Art & Track Progress Bar** *(Feature #5 - Verified & Completed)*
  - **WinRT SMTC Integration**: Windows System Media Transport Controls real-time session tracking (`scripts/media-monitor.ps1`).
  - **Live Metadata Sync**: Real-time track title, artist name, and album title from Spotify, YouTube (Chrome/Edge), and media players.
  - **Spinning Vinyl Disc & Audio Equalizer**: Dynamic CSS-animated spinning vinyl disc and 4-bar equalizer that dance while media is playing.
  - **Interactive Touch Timeline**: Draggable & clickable scrub timeline bar with live elapsed time (`01:23 / 03:45`) and seek control.
  - **Synchronized Play/Pause**: Button icon dynamically switches between Pause (`⏸️`) and Play (`▶️`).

- [x] **Multi-Layer Tablet Keep-Awake Engine & PWA**
  - Native Screen WakeLock API + hidden looping video stream for persistent Android display on.
  - Fullscreen PWA manifest and installation prompt for borderless tablet display.
  - Top header **🔄 (Refresh)** button with cache-busting for Samsung Internet.

- [x] **Screen Off Mode (Without Sleep)**
  - Win32 `SendMessage(HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, 2)` to immediately turn off Dell laptop display while keeping background tasks, downloads, and renders running.
  - Added dedicated **"Screen Off"** tile to Power Management grid and Card 2 (Display).
  - Floating high-contrast status banner (`🖥️ PC Displays are OFF`) with an instant **[WAKE SCREENS]** button.
  - Automatic display wake when touching the wireless trackpad or clicking wake.

- [x] **Quick File Drop — AltDeck Beam (AirDrop for PC)** *(Feature #9 - Verified & Completed)*
  - One-tap file picker & drag-and-drop zone on tablet to beam photos, screenshots, and documents straight to PC over local Wi-Fi.
  - Target directory automatically created on PC: `C:\Users\Anass\Desktop\AltDeck Transfers\`.
  - Real-time upload progress bar with % and file transfer speed.
  - Instant PC notification banner with sound chime on arrival (`📂 File Received!`).
  - **"📂 Open Folder on PC"** button calling Windows File Explorer to open the transfers folder with one tap.

- [x] **Top Process Killer & Real-Time Waveform Sparklines (Task Manager Deck)**
  - Live 60-second animated SVG load waveforms for CPU (Cyan) and RAM (Purple) inside the Telemetry card.
  - Real-time Top 5 resource-consuming apps scanner (`chrome.exe`, `Code.exe`, etc.) displaying active RAM usage in MB.
  - Instant red **[KILL]** button to terminate hung or memory-heavy apps directly from the tablet without opening Windows Task Manager.

---

## 🟡 2. Upcoming Features Roadmap (To Build Step-by-Step)

- [ ] **Feature #6: Quick Text Snippets & Clipboard Deck (Paste Hub)**
  - Pre-saved text blocks, email templates, frequently used code snippets, and emojis.
  - Tap any tile to automatically type/paste the text into the currently active PC window.

- [ ] **Feature #7: Discord & Gaming Voice Quick Deck**
  - Dedicated Discord shortcuts: Deafen toggle, Mute toggle, Push-to-Talk, Screen Share toggle, Overlay toggle.

- [ ] **Feature #8: OBS Studio & Streaming Controls**
  - OBS WebSocket v5 integration: Start/Stop Stream, Start/Stop Recording, Switch Scenes, Mute/Unmute audio sources.

- [ ] **Feature #11: Per-App Volume Mixer & Audio Output Switcher**
  - Windows CoreAudio session mixer & playback device switcher (Speakers ↔ Bluetooth ↔ HDMI).

- [ ] **Feature #10: Per-App Dynamic Adaptive Profiles**
  - Tablet Stream Deck layout automatically switches based on the focused PC app (e.g. VS Code layout, Gaming layout, Browser layout).

---

> **Workflow Rule**: Each feature is developed, tested, and confirmed by you step-by-step before checking it off and proceeding to the next!
