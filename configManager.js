const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'devdash-config.json');

const DEFAULT_EDITORS = [
  { id: 'vscode',      name: 'VS Code',             command: 'code',            args: ['.'], icon: 'vscode'   },
  { id: 'vscommunity', name: 'Visual Studio',        command: 'devenv',          args: ['.'], icon: 'vs'       },
  { id: 'android',     name: 'Android Studio',       command: 'studio64',        args: ['.'], icon: 'android'  },
  { id: 'webstorm',    name: 'WebStorm',             command: 'webstorm64',      args: ['.'], icon: 'webstorm' },
  { id: 'notepad',     name: 'Bloc de notas',        command: 'notepad',         args: ['.'], icon: 'notepad'  },
  { id: 'explorer',    name: 'Explorador de Windows',command: 'explorer',        args: ['.'], icon: 'folder'   },
  { id: 'terminal',    name: 'Terminal (CMD)',        command: 'cmd',             args: ['/k', 'cd /d'], icon: 'terminal' },
  { id: 'powershell',  name: 'PowerShell',           command: 'powershell',      args: ['-NoExit', '-Command', 'cd'], icon: 'terminal' },
];

function getDefaultTerminal() {
  if (process.platform === 'win32') return { name: 'PowerShell', command: 'powershell', args: [] };
  if (process.platform === 'darwin') return { name: 'Terminal', command: 'open', args: ['-a', 'Terminal', '.'] };
  return { name: 'Terminal', command: 'x-terminal-emulator', args: ['-e', process.env.SHELL || 'bash'] };
}

function getDefaultFileManager() {
  if (process.platform === 'win32') return { name: 'Explorador', command: 'explorer', args: ['.'] };
  if (process.platform === 'darwin') return { name: 'Finder', command: 'open', args: ['.'] };
  return { name: 'Archivos', command: 'xdg-open', args: ['.'] };
}

const defaultTerminal = getDefaultTerminal();
const defaultFileManager = getDefaultFileManager();

const DEFAULT_WORKSPACES = [
  {
    id: 'workspace_default',
    name: 'DevDash',
    description: 'Abre este proyecto con editor, terminal y explorador.',
    items: [
      { id: 'ws_item_vscode', type: 'app', name: 'VS Code', command: 'code', args: ['.'], cwd: process.cwd(), icon: 'vscode' },
      { id: 'ws_item_terminal', type: 'terminal', name: defaultTerminal.name, command: defaultTerminal.command, args: defaultTerminal.args, cwd: process.cwd(), icon: 'terminal' },
      { id: 'ws_item_files', type: 'app', name: defaultFileManager.name, command: defaultFileManager.command, args: defaultFileManager.args, cwd: process.cwd(), icon: 'folder' }
    ]
  }
];

const defaultConfig = {
  profiles: [
    {
      id: 'default_1',
      name: 'Default',
      repos: [],
      jira: { baseUrl: '', email: '', token: '' },
      tools: { gemini: true, joplin: true, keepass: true }
    }
  ],
  editors: DEFAULT_EDITORS,
  repoEditors: {},   // { "repoPath": "editorId" }
  workspaces: DEFAULT_WORKSPACES,
  appIconPath: '',
  integrations: {
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
    joplin: { baseUrl: 'http://127.0.0.1:41184', token: '' },
    keepass: { databasePath: '', keyFile: '', cliPath: '' }
  }
};

function normalizeConfig(cfg = {}) {
  const merged = {
    ...defaultConfig,
    ...cfg,
    profiles: Array.isArray(cfg.profiles) ? cfg.profiles : defaultConfig.profiles,
    editors: Array.isArray(cfg.editors) ? cfg.editors : DEFAULT_EDITORS,
    repoEditors: cfg.repoEditors && typeof cfg.repoEditors === 'object' ? cfg.repoEditors : {},
    workspaces: Array.isArray(cfg.workspaces) ? cfg.workspaces : DEFAULT_WORKSPACES,
    appIconPath: cfg.appIconPath || '',
    integrations: {
      gemini: {
        apiKey: cfg.integrations?.gemini?.apiKey || '',
        model: cfg.integrations?.gemini?.model || 'gemini-2.5-flash'
      },
      joplin: {
        baseUrl: cfg.integrations?.joplin?.baseUrl || 'http://127.0.0.1:41184',
        token: cfg.integrations?.joplin?.token || ''
      },
      keepass: {
        databasePath: cfg.integrations?.keepass?.databasePath || '',
        keyFile: cfg.integrations?.keepass?.keyFile || '',
        cliPath: cfg.integrations?.keepass?.cliPath || ''
      }
    }
  };

  merged.profiles = merged.profiles.map(profile => ({
    id: profile.id || `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: profile.name || 'Perfil',
    repos: Array.isArray(profile.repos) ? profile.repos : [],
    jira: {
      baseUrl: profile.jira?.baseUrl || profile.jira?.url || '',
      email: profile.jira?.email || '',
      token: profile.jira?.token || '',
      projectKey: profile.jira?.projectKey || ''
    },
    tools: {
      gemini: profile.tools?.gemini !== false,
      joplin: profile.tools?.joplin !== false,
      keepass: profile.tools?.keepass !== false
    }
  }));

  return merged;
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const cfg = normalizeConfig(JSON.parse(data));
      saveConfig(cfg);
      return cfg;
    }
  } catch (err) {
    console.error('Error loading config', err);
  }
  saveConfig(defaultConfig);
  return defaultConfig;
}

function saveConfig(config) {
  try {
    const current = fs.existsSync(configPath)
      ? normalizeConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')))
      : defaultConfig;
    const next = normalizeConfig({ ...current, ...config });
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config', err);
  }
}

function getProfiles() {
  return loadConfig().profiles;
}

function getEditors() {
  return loadConfig().editors;
}

function getRepoEditors() {
  return loadConfig().repoEditors;
}

function setRepoEditor(repoPath, editorId) {
  const cfg = loadConfig();
  cfg.repoEditors[repoPath] = editorId;
  saveConfig(cfg);
}

function saveEditors(editors) {
  const cfg = loadConfig();
  cfg.editors = editors;
  saveConfig(cfg);
}

function getWorkspaces() {
  return loadConfig().workspaces;
}

function saveWorkspaces(workspaces) {
  const cfg = loadConfig();
  cfg.workspaces = workspaces;
  saveConfig(cfg);
}

function getAppIconPath() {
  return loadConfig().appIconPath || '';
}

function setAppIconPath(appIconPath) {
  const cfg = loadConfig();
  cfg.appIconPath = appIconPath || '';
  saveConfig(cfg);
}

function getIntegrations() {
  return loadConfig().integrations;
}

function saveIntegrations(integrations) {
  const cfg = loadConfig();
  cfg.integrations = integrations;
  saveConfig(cfg);
}

module.exports = {
  loadConfig,
  saveConfig,
  getProfiles,
  getEditors,
  getRepoEditors,
  setRepoEditor,
  saveEditors,
  getWorkspaces,
  saveWorkspaces,
  getAppIconPath,
  setAppIconPath,
  getIntegrations,
  saveIntegrations,
  DEFAULT_EDITORS,
  DEFAULT_WORKSPACES
};
