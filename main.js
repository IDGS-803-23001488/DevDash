const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, Notification, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const todoService = require('./todoService');
const configManager = require('./configManager');
const gitService = require('./gitService');
const jiraService = require('./jiraService');
const aiService = require('./aiService');
const joplinService = require('./joplinService');
const keepassService = require('./keepassService');

let mainWindow;
let tray = null;
let isQuitting = false;
let appIcon = null;

function getConfiguredIcon() {
  const configuredPath = configManager.getAppIconPath();
  if (configuredPath && fs.existsSync(configuredPath)) {
    const icon = nativeImage.createFromPath(configuredPath);
    if (!icon.isEmpty()) return icon;
  }
  const iconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAcElEQVR42mNgoBJgRFIMDBSBiBwA8Q4g/g/Ef0D4PxA/AOLnQMzEgCp4H4g/APF/IP4PxM+AmIUBVfA/EP8H4v9A/B+InwMxCwOq4H8g/g/E/4H4PxA/B2IWBjSA8X8g/g/E/4H4PxA/B2IWBlSAAQCOi1N5t5pGSAAAAABJRU5ErkJggg==';
  return nativeImage.createFromDataURL(iconBase64);
}

function applyConfiguredIcon() {
  appIcon = getConfiguredIcon();
  if (mainWindow && appIcon && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }
  if (tray && appIcon && !appIcon.isEmpty()) {
    tray.setImage(appIcon.resize({ width: 16, height: 16 }));
  }
}

function createWindow() {
  appIcon = getConfiguredIcon();
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // Transparente para esquinas redondeadas si es necesario
    icon: appIcon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  mainWindow.loadFile('index.html');

  // Prevenir que se cierre con la X
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray((appIcon || getConfiguredIcon()).resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar DevDash', click: () => {
        setDashboardMode();
        mainWindow.show();
      }
    },
    { type: 'separator' },
    { label: 'Configuración...', click: () => {
        setDashboardMode();
        mainWindow.show();
        mainWindow.webContents.send('open-settings');
      }
    },
    { label: 'Forzar Recarga', click: () => {
        if (mainWindow) mainWindow.reload();
      }
    },
    { type: 'separator' },
    { label: 'Salir', click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('DevDash');
  tray.setContextMenu(contextMenu);
  
  // Al hacer doble clic en el icono de la bandeja
  tray.on('double-click', () => {
    setDashboardMode();
    mainWindow.show();
  });
}

let currentMode = 'dashboard';

function setSpotlightMode() {
  currentMode = 'spotlight';
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setSize(780, 560);
    mainWindow.center();
    mainWindow.webContents.send('set-view-mode', 'spotlight');
    mainWindow.show();
    mainWindow.focus();
  }
}

function setDashboardMode() {
  currentMode = 'dashboard';
  if (mainWindow) {
    mainWindow.webContents.send('set-view-mode', 'dashboard');
    mainWindow.show();
    mainWindow.maximize();
    mainWindow.focus();
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  
ipcMain.handle('save-todo-media', async (event, buffer, extension) => {
  try {
    const mediaDir = path.join(app.getPath('userData'), 'todo-media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    const filename = 'img_' + Date.now() + (extension || '.png');
    const filepath = path.join(mediaDir, filename);
    fs.writeFileSync(filepath, Buffer.from(buffer));
    
    // Devolvemos el path estandarizado a file:/// con slashes adelante para todas las plataformas
    let fileUrl = 'file:///' + filepath.replace(/\\/g, '/');
    return fileUrl;
  } catch (err) {
    console.error('Error saving media:', err);
    return null;
  }
});
app.whenReady().then(() => {
    todoService.initDB(app.getPath('userData'));
    createWindow();
    createTray();

    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow.isVisible() && currentMode === 'spotlight') {
        mainWindow.hide();
      } else {
        setSpotlightMode();
      }
    });

    globalShortcut.register('CommandOrControl+Alt+Space', () => {
      if (mainWindow.isVisible() && currentMode === 'dashboard') {
        mainWindow.hide();
      } else {
        setDashboardMode();
      }
    });

    mainWindow.once('ready-to-show', () => {
      setDashboardMode();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// --- IPC HANDLERS ---
ipcMain.on('close-app', () => {
  mainWindow.hide();
});

ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

const { dialog: _dialog } = require('electron'); // already imported above
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-file', async (e, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || []
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-save-file', async (e, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle('import-jira-env', (e, envPath) => {
  try {
    if (!envPath || !fs.existsSync(envPath)) {
      return { success: false, error: 'Archivo .env no encontrado.' };
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const values = {};
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      values[key] = value;
    });

    return {
      success: true,
      jira: {
        baseUrl: values.JIRA_BASE_URL || '',
        email: values.JIRA_EMAIL || '',
        token: values.JIRA_API_TOKEN || ''
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-directories', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });
  return result.filePaths;
});

ipcMain.handle('scan-repositories', async (event, config) => {
  // config: { paths: string[], searchSubfolders: boolean, excludes: string[] }
  let scannedCount = 0;
  
  const onProgress = (repoPath) => {
    scannedCount++;
    if (mainWindow) {
      mainWindow.webContents.send('scan-progress', { found: scannedCount, newRepo: repoPath });
    }
  };

  const excludeSet = new Set((config?.excludes || []).map(e => e.toLowerCase().trim()));
  const maxDepth = config?.searchSubfolders ? 6 : 1;
  let allRepos = [];

  const paths = (config && config.paths && config.paths.length > 0) ? config.paths : [require('os').homedir()];

  for (const dir of paths) {
    const repos = await gitService.scanForGitRepos(dir, onProgress, maxDepth, 0, excludeSet);
    allRepos = allRepos.concat(repos);
  }
  
  // Deduplicate
  return [...new Set(allRepos)];
});

ipcMain.handle('clone-repository', async (event, url, targetPath) => {
  return await gitService.cloneRepo(url, targetPath);
});

ipcMain.handle('get-profiles', () => {
  return configManager.getProfiles();
});

ipcMain.handle('get-config', () => {
  return configManager.loadConfig();
});

ipcMain.handle('save-config', (e, config) => {
  configManager.saveConfig(config);
});

ipcMain.handle('get-integrations', () => {
  return configManager.getIntegrations();
});

ipcMain.handle('save-integrations', (e, integrations) => {
  configManager.saveIntegrations(integrations || {});
  return { success: true };
});

ipcMain.handle('git-status', async (e, repoPath) => {
  return await gitService.getRepoStatus(repoPath);
});

ipcMain.handle('git-pull', async (e, repoPath) => {
  return await gitService.pullRepo(repoPath);
});

ipcMain.handle('git-branches', async (e, repoPath) => {
  return await gitService.getBranches(repoPath);
});

ipcMain.handle('git-checkout', async (e, repoPath, branchName) => {
  return await gitService.checkoutBranch(repoPath, branchName);
});

ipcMain.handle('git-commits', async (e, repoPath, count) => {
  return await gitService.getRecentCommits(repoPath, count || 20);
});

ipcMain.handle('git-commit-diff', async (e, repoPath, hash) => {
  return await gitService.getCommitDiff(repoPath, hash);
});

ipcMain.handle('git-push', async (e, repoPath) => {
  return await gitService.pushRepo(repoPath);
});

ipcMain.handle('git-changed-files', async (e, repoPath) => {
  return await gitService.getChangedFiles(repoPath);
});

ipcMain.handle('git-open-explorer', async (e, repoPath) => {
  return await gitService.openInExplorer(repoPath);
});

ipcMain.handle('git-open-vscode', async (e, repoPath) => {
  return await gitService.openInVSCode(repoPath);
});

// ─── Editor Configuration ─────────────────────────────────────────────────────
ipcMain.handle('get-editors', () => {
  return configManager.getEditors();
});

ipcMain.handle('save-editors', (e, editors) => {
  configManager.saveEditors(editors);
  return { success: true };
});

ipcMain.handle('get-repo-editors', () => {
  return configManager.getRepoEditors();
});

ipcMain.handle('set-repo-editor', (e, repoPath, editorId) => {
  configManager.setRepoEditor(repoPath, editorId);
  return { success: true };
});

ipcMain.handle('open-with-app', async (e, repoPath, command, args) => {
  return await gitService.openWithApp(repoPath, command, args || []);
});

ipcMain.handle('jira-tickets', async (e, config) => {
  return await jiraService.getMyTickets(config);
});

ipcMain.handle('jira-test-connection', async (e, config) => {
  return await jiraService.testConnection(config);
});

ipcMain.handle('jira-all-tickets', async (e, config) => {
  return await jiraService.getAllTickets(config);
});

ipcMain.handle('jira-issue-details', async (e, config, issueKey) => {
  return await jiraService.getIssueDetails(config, issueKey);
});

ipcMain.handle('jira-issue-transitions', async (e, config, issueKey) => {
  return await jiraService.getIssueTransitions(config, issueKey);
});

ipcMain.handle('jira-transition-issue', async (e, config, issueKey, transitionId) => {
  return await jiraService.transitionIssue(config, issueKey, transitionId);
});

ipcMain.handle('jira-add-comment', async (e, config, issueKey, text) => {
  return await jiraService.addComment(config, issueKey, text);
});

ipcMain.handle('jira-get-users', async (e, config) => {
  return await jiraService.getAssignableUsers(config);
});

ipcMain.handle('jira-create-issue', async (e, config, issueData) => {
  return await jiraService.createIssue(config, issueData);
});

// ─── AI / Notes / Passwords ─────────────────────────────────────────────────
ipcMain.handle('ai-ask', async (e, question, context) => {
  const integrations = configManager.getIntegrations();
  return await aiService.askGemini(integrations.gemini, question, context || {});
});

ipcMain.handle('ai-list-models', async (e, config) => {
  const integrations = configManager.getIntegrations();
  return await aiService.listModels(config || integrations.gemini);
});

ipcMain.handle('joplin-test', async (e, config) => {
  return await joplinService.testConnection(config || configManager.getIntegrations().joplin);
});

ipcMain.handle('joplin-search', async (e, query) => {
  return await joplinService.searchNotes(configManager.getIntegrations().joplin, query);
});

ipcMain.handle('joplin-get-note', async (e, noteId) => {
  return await joplinService.getNote(configManager.getIntegrations().joplin, noteId);
});

ipcMain.handle('joplin-save-note', async (e, note) => {
  return await joplinService.saveNote(configManager.getIntegrations().joplin, note);
});

ipcMain.handle('joplin-delete-note', async (e, noteId) => {
  return await joplinService.deleteNote(configManager.getIntegrations().joplin, noteId);
});

ipcMain.handle('keepass-search', async (e, query, masterPassword) => {
  return await keepassService.searchEntries(configManager.getIntegrations().keepass, query, masterPassword);
});

ipcMain.handle('keepass-get-password', async (e, entryPath, masterPassword) => {
  return await keepassService.getEntryPassword(configManager.getIntegrations().keepass, entryPath, masterPassword);
});

// ─── App Icon ────────────────────────────────────────────────────────────────
ipcMain.handle('get-app-icon', () => {
  return configManager.getAppIconPath();
});

ipcMain.handle('set-app-icon', (e, iconPath) => {
  configManager.setAppIconPath(iconPath || '');
  applyConfiguredIcon();
  return { success: true };
});

// ─── Workspaces ──────────────────────────────────────────────────────────────
ipcMain.handle('get-workspaces', () => {
  return configManager.getWorkspaces();
});

ipcMain.handle('save-workspaces', (e, workspaces) => {
  configManager.saveWorkspaces(workspaces || []);
  return { success: true };
});

ipcMain.handle('open-workspace', async (e, workspace) => {
  const results = [];
  for (const item of workspace.items || []) {
    if (item.type === 'url') {
      const targetUrl = item.url || item.command || '';
      if (!targetUrl) {
        results.push({ success: false, name: item.name, error: 'URL vacia.' });
        continue;
      }
      await shell.openExternal(targetUrl);
      results.push({ success: true, name: item.name });
    } else if (item.type === 'file') {
      const targetPath = item.command || '';
      if (!targetPath) {
        results.push({ success: false, name: item.name, error: 'Ruta de archivo vacia.' });
        continue;
      }
      const errorMsg = await shell.openPath(targetPath);
      if (errorMsg) {
        results.push({ success: false, name: item.name, error: errorMsg });
      } else {
        results.push({ success: true, name: item.name });
      }
    } else {
      const res = await gitService.openWorkspaceAction(item);
      results.push({ ...res, name: item.name });
    }
  }
  const failed = results.filter(r => !r.success);
  return {
    success: failed.length === 0,
    results,
    error: failed.map(f => `${f.name}: ${f.error}`).join('\n')
  };
});

ipcMain.handle('remove-repo', (e, profileIndex, repoPath) => {
  const config = configManager.loadConfig();
  if (config.profiles[profileIndex]) {
    config.profiles[profileIndex].repos = config.profiles[profileIndex].repos.filter(r => r !== repoPath);
    configManager.saveConfig(config);
  }
  return { success: true };
});

ipcMain.on('notify', (e, { title, body, type }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'DevDash',
      body: body || '',
      silent: type === 'info'
    }).show();
  }
});
// --- TODO ACTION HANDLER ---
ipcMain.handle('todo-action', async (event, action, payload) => {
  try {
    switch (action) {
      case 'get': return await todoService.getTodos(payload.profileId);
      case 'add': return await todoService.addTodo(payload.profileId, payload.title);
      case 'toggle': return await todoService.toggleTodo(payload.id, payload.completed);
      case 'delete': return await todoService.deleteTodo(payload.id);
      case 'clear': return await todoService.clearCompleted(payload.profileId);
      case 'start': return await todoService.startTimer(payload.id);
      case 'stop': return await todoService.stopTimer(payload.id);
      
      case 'updateDescription': return await todoService.updateTodoDescription(payload.id, payload.description, payload.title);
      case 'updateStatus': return await todoService.updateTodoStatus(payload.id, payload.status);
      case 'getColumns': return await todoService.getColumns();
      case 'addColumn': return await todoService.addColumn(payload.colName);
      case 'deleteColumn': return await todoService.deleteColumn(payload.colName);
      case 'addDuration': return await todoService.addTodoDuration(payload.id, payload.duration);
      default: return null;
    }
  } catch (err) {
    console.error('Todo Error:', err);
    return { error: err.message };
  }
});
