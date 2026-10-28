# Contributing to TabDeck PC Controller 🚀

Thank you for your interest in contributing to **TabDeck**! TabDeck transforms any tablet, iPad, or smartphone into a low-latency, hardware-accelerated Stream Deck and PC companion.

We welcome all contributions: new features, UI enhancements, platform support, bug fixes, and documentation improvements!

---

## 🛠️ Architecture Overview

TabDeck is designed to be **lightweight, dependency-minimal, and lightning-fast (<10ms action response)**:

```
┌─────────────────────────────────┐           WebSocket (0-latency)
│   Tablet / Phone / iPad         │ ◄─────────────────────────────────────► ┌─────────────────────────────────┐
│   (Any Browser or PWA)          │              HTTP / REST                │   TabDeck Node.js Server        │
│   • Cyber-Glassmorphic Touch UI │ ──────────────────────────────────────► │   (0.0.0.0:3000)                │
│   • Trackpad, Numpad, Deck      │                                         └──────────────┬──────────────────┘
└─────────────────────────────────┘                                                        │
                                                                           Fast Inter-Process Communication
                                                                                           ▼
                                                                            ┌─────────────────────────────────┐
                                                                            │   pc-control.exe (Native C#)    │
                                                                            │   • Windows CoreAudio COM API   │
                                                                            │   • WMI Display Brightness      │
                                                                            │   • Hardware SendInput ScanCodes│
                                                                            └─────────────────────────────────┘
```

- **`server.js`**: Core HTTP server & WebSocket relay. Handles real-time bi-directional synchronization, device discovery, QR generation, and action dispatching.
- **`app-launcher.js`**: Dynamic application launcher resolving environment variables (`LOCALAPPDATA`, `APPDATA`, `ProgramFiles`, PATH) and loading custom app definitions from `config.json`.
- **`native/pc-control.cs`**: Windows native C# helper compiled with the built-in Windows .NET Framework `csc.exe`. Directly calls Windows CoreAudio COM (`IAudioEndpointVolume`), WMI brightness APIs, and hardware keyboard scan codes.
- **`public/`**: Zero-framework, responsive client interface:
  - `index.html`: Semantic markup with 4 touch views (Stream Deck, Trackpad, Numpad, QR Connect).
  - `style.css`: Obsidian glassmorphism design system with responsive layouts for 7" to 12" displays.
  - `app.js`: Touch gesture handling, WebSocket state sync, synthetic audio click feedback, and NoSleep keep-awake engine.

---

## 🚀 Getting Started

### Prerequisites
- **Operating System**: Windows 10 or Windows 11
- **Node.js**: v16.0.0 or later (`node -v`)
- **.NET Framework**: v4.0 or later (included by default on Windows 10/11)

### Setup Instructions

1. **Fork and Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/tabdeck-pc-controller.git
   cd tabdeck-pc-controller
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Compile Native Windows Controller** (Optional - compiles automatically on start):
   ```bash
   npm run build:helper
   ```

4. **Start the Development Server**:
   ```bash
   npm start
   # or
   npm run dev
   ```

5. **Test in Browser**:
   - PC: Open `http://localhost:3000`
   - Tablet / Mobile: Connect to the same Wi-Fi network and open the displayed IP (e.g., `http://192.168.x.x:3000`) or scan the QR code.

---

## 🧩 How to Add New Features

### 1. Adding a New Pre-Configured App
Edit `app-launcher.js` and add an entry to `DEFAULT_APPS`:
```javascript
myApp: {
  name: 'My Application',
  icon: 'myApp',
  category: 'Productivity',
  color: '#3B82F6',
  launch: () => {
    // Dynamic path resolution or URI protocol
    exec('start myapp:');
  }
}
```
Then add the corresponding SVG tile to `public/index.html`.

### 2. Adding a Native Windows Command
If your feature requires low-level Windows APIs:
1. Open `native/pc-control.cs`.
2. Add the command routing in `Main(string[] args)`.
3. Recompile using `npm run build:helper`.
4. Route the command in `server.js` (`runNative(['your_command', ...])`).

### 3. Adding Themes or UI Views
- All design tokens (glow effects, glass backgrounds, colors) are defined as CSS variables at the top of `public/style.css`.
- New modes can be added as tabs in `.nav-tab-bar` inside `public/index.html`.

---

## 📝 Commit Convention

We adhere to [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new feature or capability
- `fix:` A bug fix or hardware compatibility patch
- `docs:` Documentation changes
- `style:` Visual UI tweaks or CSS refinements
- `refactor:` Code changes that neither fix a bug nor add a feature
- `perf:` Performance improvements (latency reduction)
- `chore:` Dependency updates, build script adjustments

**Examples**:
```bash
git commit -m "feat(media): add Spotify album art and track metadata sync"
git commit -m "fix(audio): resolve mute state toggle desync on reconnect"
git commit -m "docs: add Android 9 tablet setup tips to README"
```

---

## 🤝 Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/awesome-feature
   ```
2. Commit your changes with meaningful commit messages.
3. Push to your fork:
   ```bash
   git push origin feature/awesome-feature
   ```
4. Open a Pull Request against `main`.
5. Clearly describe the motivation, changes made, and test devices (e.g., Samsung Galaxy Tab A, iPad, etc.).

Thank you for helping make TabDeck the best open-source tablet PC controller! 🌟
