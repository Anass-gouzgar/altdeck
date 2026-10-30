const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming');
const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

const DEFAULT_APPS = {
  discord: {
    name: 'Discord',
    icon: 'discord',
    category: 'Communication',
    color: '#5865F2',
    launch: () => {
      exec('start discord: || start https://discord.com/app');
    }
  },
  claude: {
    name: 'Claude AI',
    icon: 'claude',
    category: 'AI Assistant',
    color: '#D97706',
    launch: () => {
      exec('start "" "shell:AppsFolder\\AnthropicPBC.Claude_fnn82j28hfe8t!Claude" || start https://claude.ai');
    }
  },
  threeutools: {
    name: '3uTools',
    icon: 'threeutools',
    category: 'Utilities',
    color: '#06B6D4',
    launch: () => {
      const p1 = path.join(programFiles, '3uTools9', '3uTools.exe');
      const p2 = path.join(programFilesX86, '3uTools9', '3uTools.exe');
      if (fs.existsSync(p1)) {
        exec(`start "" "${p1}"`);
      } else if (fs.existsSync(p2)) {
        exec(`start "" "${p2}"`);
      } else {
        exec('start 3uTools.exe');
      }
    }
  },
  chrome: {
    name: 'Google Chrome',
    icon: 'chrome',
    category: 'Browsers',
    color: '#EA4335',
    launch: () => {
      const p = path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe');
      if (fs.existsSync(p)) {
        exec(`start "" "${p}"`);
      } else {
        exec('start chrome');
      }
    }
  },
  edge: {
    name: 'Microsoft Edge',
    icon: 'edge',
    category: 'Browsers',
    color: '#0078D7',
    launch: () => {
      const p = path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
      if (fs.existsSync(p)) {
        exec(`start "" "${p}"`);
      } else {
        exec('start msedge');
      }
    }
  },
  vscode: {
    name: 'VS Code',
    icon: 'vscode',
    category: 'Development',
    color: '#007ACC',
    launch: () => {
      const p1 = path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe');
      const p2 = path.join(programFiles, 'Microsoft VS Code', 'Code.exe');
      if (fs.existsSync(p1)) {
        exec(`start "" "${p1}"`);
      } else if (fs.existsSync(p2)) {
        exec(`start "" "${p2}"`);
      } else {
        exec('code');
      }
    }
  },
  antigravity: {
    name: 'Antigravity IDE',
    icon: 'antigravity',
    category: 'Development',
    color: '#8B5CF6',
    launch: () => {
      const p = path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe');
      const lnk = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Antigravity IDE.lnk');
      if (fs.existsSync(p)) {
        exec(`start "" "${p}"`);
      } else if (fs.existsSync(lnk)) {
        exec(`start "" "${lnk}"`);
      } else {
        exec('start "Antigravity IDE"');
      }
    }
  },
  explorer: {
    name: 'File Explorer',
    icon: 'folder',
    category: 'System',
    color: '#F59E0B',
    launch: () => {
      exec('explorer.exe');
    }
  },
  stickynotes: {
    name: 'Sticky Notes',
    icon: 'stickynotes',
    category: 'Classic',
    color: '#FFE033',
    launch: () => {
      // Launch classic standalone Sticky Notes (Microsoft.Notes.exe)
      exec('powershell -NoProfile -Command "Start-Process \'shell:AppsFolder\\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App\'"');
    }
  },
  settings: {
    name: 'Settings',
    icon: 'settings',
    category: 'System',
    color: '#10B981',
    launch: () => {
      exec('start ms-settings:');
    }
  },
  word: {
    name: 'Word',
    icon: 'word',
    category: 'Office',
    color: '#2B579A',
    launch: () => {
      exec('start winword || start word');
    }
  },
  excel: {
    name: 'Excel',
    icon: 'excel',
    category: 'Office',
    color: '#217346',
    launch: () => {
      exec('start excel');
    }
  },
  powerpoint: {
    name: 'PowerPoint',
    icon: 'powerpoint',
    category: 'Office',
    color: '#D24726',
    launch: () => {
      exec('start powerpnt');
    }
  },
  outlook: {
    name: 'Outlook',
    icon: 'outlook',
    category: 'Office',
    color: '#0078D4',
    launch: () => {
      exec('start outlook');
    }
  },
  paint: {
    name: 'Paint',
    icon: 'paint',
    category: 'Graphics',
    color: '#00A4EF',
    launch: () => {
      exec('start mspaint');
    }
  },
  terminal: {
    name: 'Terminal',
    icon: 'terminal',
    category: 'Development',
    color: '#4D4D4D',
    launch: () => {
      exec('start wt.exe || start cmd');
    }
  }
};

// Allow custom app additions and overrides from config.json
let APPS = { ...DEFAULT_APPS };
const configPath = path.join(__dirname, 'config.json');

if (fs.existsSync(configPath)) {
  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (userConfig.customApps && typeof userConfig.customApps === 'object') {
      for (const [key, app] of Object.entries(userConfig.customApps)) {
        APPS[key] = {
          name: app.name || key,
          icon: app.icon || 'folder',
          category: app.category || 'Custom',
          color: app.color || '#38BDF8',
          launch: () => {
            if (app.command) {
              exec(app.command);
            } else if (app.path) {
              exec(`start "" "${app.path}"`);
            } else if (app.url) {
              exec(`start "" "${app.url}"`);
            }
          }
        };
      }
    }
  } catch (err) {
    console.warn('[Config] Error parsing config.json:', err.message);
  }
}

function launchApp(appId, customAppId) {
  const targetId = customAppId || appId;
  const app = APPS[targetId] || APPS[appId];
  if (app && app.launch) {
    app.launch();
    return { status: 'ok', app: app.name };
  }
  // Support direct Windows AppID / shell launch (e.g. from Auto-Detected PC Apps)
  if (targetId) {
    const target = targetId.startsWith('shell:') ? targetId : `shell:AppsFolder\\${targetId}`;
    const escaped = target.replace(/'/g, "''");
    exec(`powershell -NoProfile -Command "Start-Process '${escaped}'"`, (err) => {
      if (err) console.error('Failed to launch detected app:', err.message);
    });
    return { status: 'ok', app: targetId };
  }
  return { status: 'error', message: 'App not found: ' + appId };
}

module.exports = { APPS, launchApp };
