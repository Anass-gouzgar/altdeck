# TabDeck PC Controller 🎛️⚡

<p align="center">
  <img src="public/icon.svg" width="120" height="120" alt="TabDeck Logo" />
</p>

<p align="center">
  <strong>Transform any Android tablet, iPad, or smartphone into a zero-latency, hardware-accelerated Stream Deck & PC Controller.</strong>
</p>

<p align="center">
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://microsoft.com/windows"><img src="https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D6.svg" alt="Windows 10/11"></a>
  <img src="https://img.shields.io/badge/latency-%3C10ms-neon?color=00F0FF" alt="Sub-10ms Latency">
  <img src="https://img.shields.io/badge/client-Zero--Install%20(PWA)-purple?color=8B5CF6" alt="PWA Ready">
</p>

---

## 🌟 Why TabDeck?

Most Stream Deck alternatives either require installing proprietary APKs on your tablet, have sluggish HTTP lag, or cannot control low-level Windows hardware settings (like true master audio endpoints and monitor brightness).

**TabDeck** takes an entirely different approach:
- **Zero App Installation on Tablet**: Works instantly inside any modern mobile browser (Chrome, Samsung Internet, Edge, Safari). Add to Home Screen as a standalone PWA.
- **Sub-10ms Hardware Latency**: Communicates over binary/JSON WebSockets directly with a high-performance native C# companion that taps into Windows CoreAudio COM (`IAudioEndpointVolume`) and WMI.
- **Universal Tablet Keep-Awake**: Built-in `NoSleep.js` fallback keeps your tablet screen awake 24/7 on local Wi-Fi without requiring HTTPS certificates.
- **4-in-1 Workspace**: Stream Deck + Wireless Touchpad + PC Numpad + Safe Power Center.

---

## 📸 Features at a Glance

### 1. 🎛️ Stream Deck Mode
- **Master Audio Endpoint**: 0-100% smooth slider, one-tap instant mute with neon status indicator, and quick presets (25%, 50%, 75%, 100%).
- **Media Controls**: Previous, Play/Pause, and Next track using hardware extended scan codes.
- **Hardware Display Brightness**: Direct WMI screen brightness slider (0-100%) and quick presets.
- **Dell & Laptop Lighting**: Quick launcher for Windows Mobility Center backlight controls.
- **One-Tap App Launchpad**: Launch your favorite tools with official vector branding (Discord, Claude, 3uTools, Chrome, Edge, VS Code, Antigravity IDE, File Explorer, classic Sticky Notes, Windows Settings).
- **Windows Navigation**: Alt+Tab app switcher, Task View (Win+Tab), Desktop toggle (Win+D), Snipping Tool (Win+Shift+S), and Active Window Close (Alt+F4).

### 2. 🖱️ Wireless Trackpad Mode
- Converts your tablet into a multi-touch PC touchpad.
- Left-click, right-click, smooth mouse pointer motion, and two-finger vertical scrolling.

### 3. 🔢 Wireless PC Numpad Mode
- Full numeric keypad with arithmetic operators, Enter, Backspace, and Clear.
- Ideal for compact 60% / 65% / tenkeyless laptop keyboards.

### 4. ⚡ Safe Power Management
- Lock workstation (`Win + L`) and low-power Sleep.
- Safe Restart & Shutdown with a **30-second emergency countdown modal** and an instant **CANCEL** button to prevent accidental clicks.

---

## 🚀 Quick Start

### 1. Clone & Run on PC
```bash
# Clone the repository
git clone https://github.com/<your-username>/tabdeck-pc-controller.git
cd tabdeck-pc-controller

# Install dependencies
npm install

# Start TabDeck
npm start
```
*(Windows users can also simply double-click **`start-controller.bat`**)*

TabDeck will automatically compile the native Windows hardware controller (`bin/pc-control.exe`) on its very first launch—no manual compiler setup required!

### 2. Connect Your Tablet
1. Make sure your tablet is connected to the same Wi-Fi network as your PC.
2. Open Chrome, Edge, or Samsung Internet on the tablet and enter the address shown in your terminal:
   ```text
   http://<YOUR-PC-IP>:3000
   ```
   *(Or scan the QR code displayed on your PC screen at `http://localhost:3000`)*

### 3. Install as a Fullscreen App (PWA)
On Android (Chrome / Samsung Internet):
1. Tap the **three dots menu (⋮)** in the browser.
2. Select **"Add to Home screen"** or **"Install app"**.
3. Launch TabDeck from your home screen for a borderless, native desktop-feel experience!

---

## ⚙️ Configuration & Custom Apps

You can easily customize ports or add your own custom app buttons without editing code!

1. Copy `config.example.json` to `config.json`:
   ```bash
   cp config.example.json config.json
   ```

2. Add custom apps, commands, or websites:
   ```json
   {
     "port": 3000,
     "customApps": {
       "spotify": {
         "name": "Spotify",
         "category": "Media",
         "color": "#1DB954",
         "command": "start spotify:"
       },
       "terminal": {
         "name": "Windows Terminal",
         "category": "Development",
         "color": "#4D4D4D",
         "command": "start wt.exe"
       },
       "github": {
         "name": "GitHub",
         "category": "Web",
         "color": "#F0F6FC",
         "url": "https://github.com"
       }
     }
   }
   ```

---

## 🏗️ Technical Architecture

```text
┌──────────────────────────────────────────────┐
│  Android Tablet / iPad / Phone               │
│  - Obsidian Cyber-Glassmorphism UI           │
│  - NoSleep.js WakeLock Engine                │
│  - Touchpad Multi-touch Listeners            │
└──────────────────────┬───────────────────────┘
                       │ WebSocket (port 3000)
                       ▼
┌──────────────────────────────────────────────┐
│  Node.js Server (server.js)                  │
│  - HTTP static server & REST API             │
│  - WebSocket client broadcaster              │
│  - Dynamic app launcher (app-launcher.js)    │
└──────────────────────┬───────────────────────┘
                       │ Fast Subprocess Execution (<10ms)
                       ▼
┌──────────────────────────────────────────────┐
│  Native C# Core (bin/pc-control.exe)         │
│  - IAudioEndpointVolume (CoreAudio COM)      │
│  - WmiMonitorBrightness Methods              │
│  - SendInput Hardware ScanCodes (user32.dll) │
└──────────────────────────────────────────────┘
```

---

## 🤝 Contributing

We love contributions! Whether you want to add support for OBS Studio, Spotify Web API now-playing metadata, new themes, or Linux/macOS companion agents, please check out our [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<p align="center">
  Crafted with ❤️ for makers, gamers, and productivity power users.
</p>
