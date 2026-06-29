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

const DEFAULT_WORKSPACES = [
  {
    id: 'workspace_default',
    name: 'DevDash',
    description: 'Abre este proyecto con editor, terminal y explorador.',
    items: [
      { id: 'ws_item_vscode', type: 'app', name: 'VS Code', command: 'code', args: ['.'], cwd: process.cwd(), icon: 'vscode' },
      { id: 'ws_item_terminal', type: 'terminal', name: 'PowerShell', command: 'powershell', args: [], cwd: process.cwd(), icon: 'terminal' },
      { id: 'ws_item_explorer', type: 'app', name: 'Explorador', command: 'explorer', args: ['.'], cwd: process.cwd(), icon: 'folder' }
    ]
  }
];

const defaultConfig = {
  profiles: [
    {
      id: 'default_1',
      name: 'SPRM Proyectos',
      repos: [
        'd:\\DESARROLLO\\UTL\\SPRM\\frontend',
        'd:\\DESARROLLO\\UTL\\SPRM\\backend'
      ],
      jira: { baseUrl: '', email: '', token: '' }
    }
  ],
  editors: DEFAULT_EDITORS,
  repoEditors: {},   // { "repoPath": "editorId" }
  workspaces: DEFAULT_WORKSPACES,
  appIconPath: ''
};

function normalizeConfig(cfg = {}) {
  const merged = {
    ...defaultConfig,
    ...cfg,
    profiles: Array.isArray(cfg.profiles) ? cfg.profiles : defaultConfig.profiles,
    editors: Array.isArray(cfg.editors) ? cfg.editors : DEFAULT_EDITORS,
    repoEditors: cfg.repoEditors && typeof cfg.repoEditors === 'object' ? cfg.repoEditors : {},
    workspaces: Array.isArray(cfg.workspaces) ? cfg.workspaces : DEFAULT_WORKSPACES,
    appIconPath: cfg.appIconPath || ''
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
  DEFAULT_EDITORS,
  DEFAULT_WORKSPACES
};
