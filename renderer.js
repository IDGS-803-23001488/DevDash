
window.addEventListener('error', function(event) {
  const fs = require('fs');
  fs.appendFileSync('./renderer-error.log', new Date().toISOString() + '\n' + event.error.stack + '\n\n');
});
window.addEventListener('unhandledrejection', function(event) {
  const fs = require('fs');
  fs.appendFileSync('./renderer-error.log', new Date().toISOString() + ' (Promise)\n' + (event.reason ? event.reason.stack : event.reason) + '\n\n');
});
const { ipcRenderer } = require('electron');
const { createRepoCard } = require('./components/RepoCard.js');
const { createJiraCard } = require('./components/JiraCard.js');
const { createWorkspaceCard } = require('./components/WorkspaceCard.js');

// ─── UI References ────────────────────────────────────────────────────────────
const repoList = document.getElementById('repo-list');
const jiraList = document.getElementById('jira-tickets');
const profileNameEl = document.getElementById('current-profile-name');
const avatarInitialsEl = document.getElementById('avatar-initials');
const clockTime = document.getElementById('clock-time');
const clockDate = document.getElementById('clock-date');
const mainDashboard = document.getElementById('main-dashboard');
const metricRepos = document.getElementById('metric-repos');
const metricDirty = document.getElementById('metric-dirty');
const metricTasksActive = document.getElementById('metric-tasks-active');
const metricTasksTotal = document.getElementById('metric-tasks-total');
const footerRepoCount = document.getElementById('footer-repo-count');
const footerJiraCount = document.getElementById('footer-jira-count');
const spotlightWrapper = document.getElementById('spotlight-wrapper');
const spotlightInput = document.getElementById('spotlight-input');
const progressBar = document.getElementById('progress-bar');

function escapeHtml(value) {
  return `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsString(value) {
  return JSON.stringify(`${value ?? ''}`);
}

function getStatusClass(status) {
  const s = `${status || ''}`.toUpperCase();
  if (s.includes('PROGRESO') || s.includes('PROGRESS')) return 'status-progreso';
  if (s.includes('REVISIÓN') || s.includes('REVISION') || s.includes('REVIEW')) return 'status-revision';
  if (s.includes('HECHO') || s.includes('DONE') || s.includes('LISTO')) return 'status-hecho';
  return 'status-default';
}

// ─── State ────────────────────────────────────────────────────────────────────
let profiles = [];
let activeProfileIndex = 0;
let cursorZone = 'repos';
let cursorIndex = 0;
let loadedReposCount = 0;
let myTickets = [];
let allOpenTickets = [];
let loadedJiraCount = 0;
let allTickets = [];
let allCommits = [];
let allRepos = [];
let workspaces = [];
let appIconPath = '';
let isProfileLoading = false;
let currentRenderId = 0;
let currentMode = 'dashboard';

// ─── Toasts & Notifications ───────────────────────────────────────────────────
function createToast(title, body, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return null;

  const id = 'toast_' + Date.now() + Math.random().toString(36).substring(2);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;

  let iconSvg = '';
  if (type === 'success') iconSvg = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  else if (type === 'error') iconSvg = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  else if (type === 'progress') iconSvg = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
  else iconSvg = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `
    <div class="toast-header">
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-title">${title}</div>
    </div>
    ${body ? `<div class="toast-body">${body}</div>` : ''}
    ${type === 'progress' ? `
      <div class="toast-progress-track">
        <div class="toast-progress-bar" id="${id}-bar"></div>
      </div>
    ` : ''}
  `;

  container.appendChild(toast);
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove if not progress
  if (type !== 'progress' && duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }

  return id;
}

function removeToast(id) {
  const toast = document.getElementById(id);
  if (toast) {
    toast.classList.remove('show');
    setTimeout(() => { if(toast.parentElement) toast.remove(); }, 400);
  }
}

function notify(title, body, type = 'info') {
  createToast(title, body, type);
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
let progressTimer = null;
let currentProgressToastId = null;

function showProgress(pct) {
  if (!currentProgressToastId) {
    currentProgressToastId = createToast('Operación en progreso...', '', 'progress', 0);
  }
  
  const bar = document.getElementById(currentProgressToastId + '-bar');
  if (bar) bar.style.width = pct + '%';
  
  if (progressBar) {
    progressBar.style.width = pct + '%';
    progressBar.style.opacity = '1';
  }
}

function finishProgress() {
  showProgress(100);
  
  if (currentProgressToastId) {
    const toast = document.getElementById(currentProgressToastId);
    if (toast) {
      toast.classList.remove('progress');
      toast.classList.add('success');
      const titleEl = toast.querySelector('.toast-title');
      const iconEl = toast.querySelector('.toast-icon');
      if (titleEl) titleEl.textContent = 'Completado';
      if (iconEl) iconEl.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      
      const tId = currentProgressToastId;
      setTimeout(() => removeToast(tId), 2500);
    }
    currentProgressToastId = null;
  }

  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    if (progressBar) {
      progressBar.style.opacity = '0';
      setTimeout(() => { if (progressBar) { progressBar.style.width = '0%'; progressBar.style.opacity = '1'; } }, 400);
    }
  }, 300);
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  clockTime.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  clockDate.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// ─── Keyboard Focus ───────────────────────────────────────────────────────────
function renderFocus() {
  renderCharts();
  document.querySelectorAll('.kb-focus').forEach(el => el.classList.remove('kb-focus'));
  if (cursorZone === 'repos' && repoList && repoList.children[cursorIndex]) {
    repoList.children[cursorIndex].classList.add('kb-focus');
  } else if (cursorZone === 'jira' && jiraList && jiraList.children[cursorIndex]) {
    jiraList.children[cursorIndex].classList.add('kb-focus');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  showProgress(10);
  lucide.createIcons();
  const config = await ipcRenderer.invoke('get-config');
  profiles = config.profiles || [];
  workspaces = config.workspaces || [];
  appIconPath = config.appIconPath || '';
  if (profiles && profiles.length > 0) {
    await selectProfile(0);
    renderProfilesConfig();
    renderWorkspacesTab();
    initDashboardDND();
  } else {
    profileNameEl.textContent = 'Sin perfil';
    finishProgress();
  }
}

async function selectProfile(index) {
  if (isProfileLoading) return;
  isProfileLoading = true;
  showProgress(20);

  try {
    activeProfileIndex = index;
    const profile = profiles[index];
    profileNameEl.textContent = profile.name;
    avatarInitialsEl.textContent = profile.name.substring(0, 2).toUpperCase();
    applyProfileCustomization(profile);

    if (repoList) repoList.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center; font-size:13px;">Cargando repositorios...</div>';
    if (jiraList) jiraList.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center; font-size:13px;">Cargando tareas...</div>';

    currentRenderId++;
    const renderId = currentRenderId;

    showProgress(35);
    await loadGitRepos(profile.repos, renderId);
    showProgress(60);
    await loadJiraTickets(profile.jira, renderId);
    showProgress(80);
    await loadActivityFeed(profile.repos, renderId);
    showProgress(95);

    if (renderId === currentRenderId) {
      renderFocus();
      finishProgress();
    }
  } finally {
    isProfileLoading = false;
  }
}

// ─── Profile Management ───────────────────────────────────────────────────────
function renderProfilesConfig() {
  const container = document.getElementById('profiles-list');
  const popupList = document.getElementById('profile-popup-list');
  
  if (container) {
    container.innerHTML = profiles.map((p, i) => {
      const isActive = i === activeProfileIndex;
      const activeBadge = isActive ? `<span style="background:var(--accent-color); color:white; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold;">Activo</span>` : '';
      const switchBtn = !isActive ? `<button class="btn-refresh" onclick="switchActiveProfile(${i})" style="font-size:12px; padding:4px 8px;"><i data-lucide="check-circle" style="width:14px;height:14px;"></i> Usar</button>` : '';
      const delBtn = profiles.length > 1 ? `<button class="btn-refresh" onclick="deleteProfile(${i})" style="font-size:12px; padding:4px 8px; color:#ef4444; border-color:#ef4444;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Borrar</button>` : '';
      
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid var(--border-light); border-radius:8px; background:var(--bg-panel);">
          <div style="display:flex; align-items:center; gap:10px;">
            <i data-lucide="user" style="width:18px;height:18px; color:var(--text-muted);"></i>
            <span style="font-weight:600; font-size:14px;">${p.name}</span>
            ${activeBadge}
          </div>
          <div style="display:flex; gap:8px;">
            ${switchBtn}
            ${delBtn}
          </div>
        </div>
      `;
    }).join('');
  }
  
  if (popupList) {
    popupList.innerHTML = profiles.map((p, i) => {
      const isActive = i === activeProfileIndex;
      const bg = isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
      const color = isActive ? 'var(--accent)' : 'var(--text-main)';
      const weight = isActive ? '600' : '400';
      
      return `
        <div onclick="switchActiveProfile(${i}); document.getElementById('profile-popup').classList.add('hidden');" 
             style="padding:10px 16px; cursor:pointer; background:${bg}; color:${color}; font-weight:${weight}; font-size:14px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border-light);">
          <i data-lucide="${isActive ? 'check' : 'user'}" style="width:14px;height:14px;"></i>
          ${p.name}
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}
window.renderProfilesConfig = renderProfilesConfig;

function toggleProfilePopup(event) {
  event.stopPropagation();
  const popup = document.getElementById('profile-popup');
  if (popup) {
    popup.classList.toggle('hidden');
  }
}
window.toggleProfilePopup = toggleProfilePopup;

// Cierra el popup si se hace click fuera
document.addEventListener('click', (e) => {
  const popup = document.getElementById('profile-popup');
  const userProfile = document.querySelector('.user-profile');
  if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target) && (!userProfile || !userProfile.contains(e.target))) {
    popup.classList.add('hidden');
  }
});

function showPrompt(title, text, callback) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = title;
  
  modalBody.innerHTML = `
    <div style="margin-bottom:15px; color:var(--text-muted); font-size:14px;">${text}</div>
    <input type="text" id="prompt-input" style="width:100%; padding:10px; border:1px solid var(--border-light); border-radius:6px; background:var(--bg-app); color:var(--text-main); outline:none;" autocomplete="off" />
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
      <button class="btn-refresh" onclick="closeModal()" style="border-color:transparent;">Cancelar</button>
      <button class="btn-refresh" id="prompt-confirm" style="background:var(--accent); color:white; border-color:var(--accent);">Aceptar</button>
    </div>
  `;
  
  modal.classList.remove('hidden');
  
  const input = document.getElementById('prompt-input');
  setTimeout(() => input.focus(), 100);
  
  const confirmBtn = document.getElementById('prompt-confirm');
  
  const finish = () => {
    closeModal();
    if (callback) callback(input.value);
  };
  
  confirmBtn.onclick = finish;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') closeModal();
  };
}
window.showPrompt = showPrompt;

function createNewProfile() {
  showPrompt('Nuevo Perfil', 'Nombre del nuevo perfil (ej. Personal, Trabajo):', async (name) => {
    if (!name || name.trim() === '') return;
    
    const newProfile = {
      id: 'profile_' + Date.now(),
      name: name.trim(),
      repos: [],
      jira: { baseUrl: '', email: '', token: '', projectKey: '' }
    };
    
    profiles.push(newProfile);
    await ipcRenderer.invoke('save-config', { profiles });
    notify('Perfil creado', name, 'success');
    renderProfilesConfig();
  });
}
window.createNewProfile = createNewProfile;

async function switchActiveProfile(index) {
  if (index === activeProfileIndex) return;
  
  await selectProfile(index);
  renderProfilesConfig();
  switchTabByName('resumen'); // Go back to dashboard
  notify('Perfil cambiado', profiles[index].name, 'info');
}
window.switchActiveProfile = switchActiveProfile;

async function deleteProfile(index) {
  if (profiles.length <= 1) {
    alert('No puedes eliminar el único perfil existente.');
    return;
  }
  
  const pName = profiles[index].name;
  if (!confirm(`¿Estás seguro de eliminar el perfil "${pName}"?`)) return;
  
  profiles.splice(index, 1);
  if (activeProfileIndex === index) {
    activeProfileIndex = 0;
    await selectProfile(0);
  } else if (activeProfileIndex > index) {
    activeProfileIndex--;
  }
  
  await ipcRenderer.invoke('save-config', { profiles });
  notify('Perfil eliminado', pName, 'info');
  renderProfilesConfig();
}
window.deleteProfile = deleteProfile;

// ─── Git Repos (Dashboard Panel) ──────────────────────────────────────────────
const REPO_COLORS = ['icon-green', 'icon-blue', 'icon-orange', 'icon-purple'];

async function loadGitRepos(repoPaths, renderId) {
  if (!repoPaths || repoPaths.length === 0) {
    if (renderId === currentRenderId) {
      loadedReposCount = 0; allRepos = [];
      updateFooterCounts();
      updateGitChart(0, 0, 0);
    }
    return;
  }

  if (renderId === currentRenderId) {
    loadedReposCount = repoPaths.length;
    allRepos = [];
  }

  let dirtyCount = 0;
  let cleanCount = 0;
  let syncCount = 0; // ahead or behind
  let tempRepos = [];

  for (let i = 0; i < repoPaths.length; i++) {
    const rPath = repoPaths[i];
    const status = await ipcRenderer.invoke('git-status', rPath);
    tempRepos.push(status);
    
    if (status.isDirty) {
      dirtyCount++;
    } else if (status.ahead > 0 || status.behind > 0) {
      syncCount++;
    } else {
      cleanCount++;
    }
  }

  if (renderId === currentRenderId) {
    allRepos = tempRepos;
    metricRepos.textContent = loadedReposCount;
    metricDirty.textContent = dirtyCount;
    updateFooterCounts();
    lucide.createIcons();
    updateGitChart(cleanCount, dirtyCount, syncCount);
  }
}

function updateGitChart(clean, dirty, sync) {
  const total = clean + dirty + sync;
  if (total === 0) return;
  
  const pClean = (clean / total) * 100;
  const pDirty = (dirty / total) * 100;
  const pSync = (sync / total) * 100;
  
  const elClean = document.getElementById('git-clean-bar');
  const elDirty = document.getElementById('git-dirty-bar');
  const elSync = document.getElementById('git-sync-bar');
  
  if (elClean) elClean.style.width = pClean + '%';
  if (elDirty) elDirty.style.width = pDirty + '%';
  if (elSync) elSync.style.width = pSync + '%';
  
  const valClean = document.getElementById('git-clean-val');
  const valDirty = document.getElementById('git-dirty-val');
  const valSync = document.getElementById('git-sync-val');
  
  if (valClean) valClean.textContent = clean;
  if (valDirty) valDirty.textContent = dirty;
  if (valSync) valSync.textContent = sync;
}

// ─── Repo Search Filter ───────────────────────────────────────────────────────
function filterRepos(query) {
  const q = query.toLowerCase().trim();
  Array.from(repoList.children).forEach(item => {
    const name = item.querySelector('.repo-name')?.textContent.toLowerCase() || '';
    const path = item.querySelector('.repo-path')?.textContent.toLowerCase() || '';
    item.style.display = (!q || name.includes(q) || path.includes(q)) ? '' : 'none';
  });
}
window.filterRepos = filterRepos;

function updateFooterCounts() {
  if (footerRepoCount) footerRepoCount.textContent = loadedReposCount;
  if (footerJiraCount) footerJiraCount.textContent = loadedJiraCount;
}

// ─── Add / Remove Repo ────────────────────────────────────────────────────────
let scannedReposStore = [];

async function addRepo() {
  if (!profiles[activeProfileIndex]) return;

  const modal = document.getElementById('modal-scanner');
  const prevList = document.getElementById('scanner-prev-list');
  const newList = document.getElementById('scanner-new-list');
  const saveBtn = document.getElementById('scanner-save-btn');
  const spinner = document.getElementById('scanner-spinner');
  
  if (!modal) return;

  scannedReposStore = [];
  modal.classList.remove('hidden');
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.5';
  saveBtn.style.cursor = 'not-allowed';
  spinner.style.display = 'block';

  const currentRepos = profiles[activeProfileIndex].repos;
  
  if (currentRepos.length > 0) {
    prevList.innerHTML = currentRepos.map(r => `<div>📁 ${r}</div>`).join('');
  } else {
    prevList.innerHTML = '<div>No tienes repositorios guardados.</div>';
  }
  newList.innerHTML = '';

  try {
    await ipcRenderer.invoke('scan-repositories');
    spinner.style.display = 'none';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.style.cursor = 'pointer';
    if (scannedReposStore.length === 0) {
      newList.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">No se encontraron repositorios nuevos.</div>';
    }
  } catch (error) {
    spinner.style.display = 'none';
    newList.innerHTML = `<div style="color:var(--text-error); font-size:13px;">Error al escanear: ${error.message}</div>`;
  }
}
window.addRepo = addRepo;

function closeScannerModal() {
  const modal = document.getElementById('modal-scanner');
  if (modal) modal.classList.add('hidden');
}
window.closeScannerModal = closeScannerModal;

async function saveScannedRepos() {
  if (!profiles[activeProfileIndex]) return;
  
  const checkboxes = document.querySelectorAll('.scanner-checkbox:checked');
  let addedCount = 0;
  
  checkboxes.forEach(cb => {
    const r = cb.value;
    if (!profiles[activeProfileIndex].repos.includes(r)) {
      profiles[activeProfileIndex].repos.push(r);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    await ipcRenderer.invoke('save-config', { profiles });
    isProfileLoading = false;
    await selectProfile(activeProfileIndex);
    notify('Repositorios guardados', `Se añadieron ${addedCount} repositorios al perfil.`, 'success');
  }
  closeScannerModal();
}
window.saveScannedRepos = saveScannedRepos;

ipcRenderer.on('scan-progress', (e, data) => {
  if (data.newRepo) {
    const currentRepos = profiles[activeProfileIndex].repos;
    if (!currentRepos.includes(data.newRepo) && !scannedReposStore.includes(data.newRepo)) {
      scannedReposStore.push(data.newRepo);
      const newList = document.getElementById('scanner-new-list');
      const escaped = data.newRepo.replace(/"/g, '&quot;');
      const html = `
        <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:4px 0;">
          <input type="checkbox" class="scanner-checkbox" value="${escaped}" checked>
          <span>📁 ${data.newRepo}</span>
        </label>
      `;
      newList.insertAdjacentHTML('beforeend', html);
    }
  }
});

async function removeRepo(rPath) {
  if (!confirm(`¿Eliminar "${rPath.replace(/\\/g, '/').split('/').pop()}" del perfil?`)) return;
  await ipcRenderer.invoke('remove-repo', activeProfileIndex, rPath);
  profiles[activeProfileIndex].repos = profiles[activeProfileIndex].repos.filter(r => r !== rPath);
  notify('Repo eliminado', rPath.replace(/\\/g, '/').split('/').pop(), 'info');
  isProfileLoading = false;
  await selectProfile(activeProfileIndex);
}
window.removeRepo = removeRepo;

// ─── Pull / Push / Open ───────────────────────────────────────────────────────
async function pullRepo(rPath) {
  const name = rPath.replace(/\\/g, '/').split('/').pop();
  showProgress(20);
  notify('Pull en progreso...', name, 'info');
  const res = await ipcRenderer.invoke('git-pull', rPath);
  finishProgress();
  if (res.success) {
    notify('✅ Pull exitoso', name + ': ' + (res.output || 'Ya estaba actualizado'));
  } else {
    notify('❌ Error en Pull', name + ': ' + res.error);
  }
  isProfileLoading = false;
  await selectProfile(activeProfileIndex);
}
window.pullRepo = pullRepo;

async function pushRepo(rPath) {
  const name = rPath.replace(/\\/g, '/').split('/').pop();
  showProgress(20);
  notify('Push en progreso...', name, 'info');
  const res = await ipcRenderer.invoke('git-push', rPath);
  finishProgress();
  if (res.success) {
    notify('✅ Push exitoso', name + ': cambios subidos correctamente');
  } else {
    notify('❌ Error en Push', name + ': ' + res.error);
  }
  isProfileLoading = false;
  await selectProfile(activeProfileIndex);
}
window.pushRepo = pushRepo;

async function openExplorer(rPath) {
  await ipcRenderer.invoke('git-open-explorer', rPath);
}
window.openExplorer = openExplorer;

async function openVSCode(rPath) {
  await ipcRenderer.invoke('git-open-vscode', rPath);
  notify('Abriendo en VS Code', rPath.replace(/\\/g, '/').split('/').pop(), 'info');
}
window.openVSCode = openVSCode;

async function showChangedFiles(rPath) {
  showProgress(40);
  const res = await ipcRenderer.invoke('git-changed-files', rPath);
  finishProgress();
  if (!res.success || res.files.length === 0) {
    alert('No hay archivos modificados en este repositorio.');
    return;
  }
  const list = res.files.map(f => `[${f.status}] ${f.file}`).join('\n');
  alert(`Archivos modificados en ${rPath.replace(/\\/g, '/').split('/').pop()}:\n\n${list}`);
}
window.showChangedFiles = showChangedFiles;

async function checkoutBranchUI(rPath, repoName) {
  // We reuse the modal for the branch selector
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  
  overlay.classList.remove('hidden');
  title.textContent = `Ramas: ${repoName}`;
  body.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Cargando ramas...</div>`;
  
  const bRes = await ipcRenderer.invoke('git-branches', rPath);
  if (!bRes.success || bRes.branches.length === 0) {
    body.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">No se pudieron leer las ramas.</div>`;
    return;
  }
  
  const escaped = rPath.replace(/\\/g, '\\\\');
  let html = `<div style="display:flex; flex-direction:column; gap:6px; max-height:350px; overflow-y:auto; padding-right:5px;">`;
  
  bRes.branches.forEach(b => {
    const isCur = b.isCurrent;
    html += `
      <button class="btn-refresh" 
              onclick="performCheckout('${escaped}', '${b.name}', '${repoName}')"
              style="justify-content:flex-start; padding:10px 14px; font-size:13px; 
                     ${isCur ? 'background:var(--accent-green-bg); color:var(--accent-green-text);' : ''}">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px;"><path d="M6 3v12"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 01-9 9"></path></svg>
        ${b.name}
        ${isCur ? '<span style="margin-left:auto; font-size:10px; font-weight:700; letter-spacing:0.5px;">ACTUAL</span>' : ''}
      </button>
    `;
  });
  html += `</div>`;
  body.innerHTML = html;
}
window.checkoutBranchUI = checkoutBranchUI;

async function performCheckout(rPath, targetBranch, repoName) {
  closeModal();
  showProgress(40);
  const cRes = await ipcRenderer.invoke('git-checkout', rPath, targetBranch);
  finishProgress();
  if (cRes.success) {
    notify('✅ Rama cambiada', `${repoName} → ${targetBranch}`);
    isProfileLoading = false;
    await selectProfile(activeProfileIndex);
  } else {
    notify('❌ Error checkout', cRes.error);
  }
}
window.performCheckout = performCheckout;

// ─── Jira Loading ─────────────────────────────────────────────────────────────
async function loadJiraTickets(jiraConfig, renderId) {
  const [resMy, resAll] = await Promise.all([
    ipcRenderer.invoke('jira-tickets', jiraConfig),
    ipcRenderer.invoke('jira-all-tickets', jiraConfig)
  ]);
  
  if (renderId !== currentRenderId) return;

  if (!resMy.success) {
    loadedJiraCount = 0; myTickets = []; allOpenTickets = [];
    updateFooterCounts();
    updateJiraDonut(0, 0, 0);
    return;
  }

  myTickets = resMy.issues;
  allOpenTickets = resAll.success ? resAll.issues : [];
  loadedJiraCount = myTickets.length;
  
  let todoCount = 0;
  let progCount = 0;
  let doneCount = 0;

  myTickets.forEach(issue => {
    const s = issue.status.toUpperCase();
    if (s.includes('PROGRESO') || s.includes('PROGRESS')) progCount++;
    else if (s.includes('REVISIÓN') || s.includes('REVIEW')) progCount++;
    else if (s.includes('HECHO') || s.includes('DONE')) doneCount++;
    else todoCount++;
  });

  metricTasksTotal.textContent = loadedJiraCount;
  metricTasksActive.textContent = progCount;
  updateFooterCounts();
  updateJiraDonut(todoCount, progCount, doneCount);
}

function updateJiraDonut(todo, prog, done) {
  const total = todo + prog + done;
  const donut = document.getElementById('jira-donut');
  const tTodo = document.getElementById('j-todo');
  const tProg = document.getElementById('j-prog');
  const tDone = document.getElementById('j-done');
  const tTotal = document.getElementById('jira-total-text');
  
  if (tTodo) tTodo.textContent = todo;
  if (tProg) tProg.textContent = prog;
  if (tDone) tDone.textContent = done;
  if (tTotal) tTotal.textContent = total;
  
  if (total === 0 && donut) {
    donut.style.setProperty('--p-todo', '0%');
    donut.style.setProperty('--p-prog', '0%');
    donut.style.setProperty('--p-done', '0%');
    return;
  }
  
  if (donut) {
    const pTodo = (todo / total) * 100;
    const pProg = (prog / total) * 100;
    const pDone = (done / total) * 100;
    
    donut.style.setProperty('--p-todo', pTodo + '%');
    donut.style.setProperty('--p-prog', pProg + '%');
    donut.style.setProperty('--p-done', pDone + '%');
  }
}

// ─── Activity Feed (Dashboard) ────────────────────────────────────────────────
async function loadActivityFeed(repoPaths, renderId) {
  if (!repoPaths || repoPaths.length === 0) {
    if (renderId === currentRenderId) updateActivityChart([]);
    return;
  }

  let tempCommits = [];
  for (const rPath of repoPaths) {
    const res = await ipcRenderer.invoke('git-commits', rPath, 30);
    if (res.success && res.commits) {
      const folderName = rPath.replace(/\\/g, '/').split('/').pop();
      res.commits.forEach(c => tempCommits.push({ repo: folderName, path: rPath, ...c }));
    }
  }

  if (renderId !== currentRenderId) return;
  allCommits = tempCommits;
  updateActivityChart(allCommits);
}

function updateActivityChart(commits) {
  const chartEl = document.getElementById('activity-chart');
  if (!chartEl) return;
  
  if (commits.length === 0) {
    chartEl.innerHTML = '<div style="color:var(--text-muted); font-size:13px; width:100%; text-align:center;">No hay actividad reciente.</div>';
    return;
  }
  
  // Group commits by day for the last 7 days
  const now = new Date();
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    d.setHours(0,0,0,0);
    return { 
      date: d, 
      label: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()],
      count: 0 
    };
  });
  
  commits.forEach(c => {
    // c.date contains the date string from git log
    // We try to parse it
    const cd = new Date(c.date);
    if (!isNaN(cd.getTime())) {
      const cDate = new Date(cd);
      cDate.setHours(0,0,0,0);
      const diffTime = Math.abs(now.setHours(0,0,0,0) - cDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays < 7) {
        const dayObj = days[6 - diffDays];
        if (dayObj) dayObj.count++;
      }
    }
  });
  
  const maxCount = Math.max(...days.map(d => d.count), 1);
  
  chartEl.innerHTML = days.map(d => {
    const p = (d.count / maxCount) * 100;
    return `
      <div class="v-bar-wrap">
        <div class="v-bar-track">
          <div class="v-bar-fill" style="height:${p}%;"></div>
          <div class="v-bar-tooltip" style="--val:${p}%">${d.count} commits</div>
        </div>
        <div class="v-bar-label">${d.label}</div>
      </div>
    `;
  }).join('');
}

// ─── Git Tab View (Full) ──────────────────────────────────────────────────────
function showRepoModal(index) {
  const r = allRepos[index];
  if (!r) return;
  const escaped = r.path.replace(/\\/g, '\\\\');
  
  document.getElementById('modal-title').textContent = r.name;
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">${r.path}</div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button class="btn-refresh" onclick="closeModal(); openExplorer('${escaped}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path></svg>
        <span style="margin-left:8px;">Abrir carpeta en el Explorador</span>
      </button>
      <button class="btn-refresh" onclick="closeModal(); pullRepo('${escaped}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path></svg>
        <span style="margin-left:8px;">Git Pull</span>
      </button>
      <button class="btn-refresh" onclick="closeModal(); pushRepo('${escaped}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px; color:#22c55e;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        <span style="margin-left:8px;">Git Push</span>
      </button>
      <button class="btn-refresh" onclick="closeModal(); checkoutBranchUI('${escaped}', '${r.name}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 3v12"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 01-9 9"></path></svg>
        <span style="margin-left:8px;">Cambiar rama</span>
      </button>
      ${r.isDirty ? `<button class="btn-refresh" onclick="closeModal(); showChangedFiles('${escaped}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px; color:#f59e0b;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line></svg>
        <span style="margin-left:8px;">Ver archivos modificados</span>
      </button>` : ''}
      <button class="btn-refresh" onclick="closeModal(); removeRepo('${escaped}')" style="justify-content:flex-start; padding:10px 14px; font-size:14px; color:#ef4444; margin-top:10px; border-top:1px solid var(--border-light); border-radius:0;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
        <span style="margin-left:8px;">Eliminar del perfil</span>
      </button>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function renderGitTab() {
  const container = document.getElementById('git-tab-list');
  if (!container) return;
  if (allRepos.length === 0) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay repositorios. Haz clic en "Agregar Repositorio".</div>';
    return;
  }
  container.replaceChildren(...allRepos.map((r, i) => createRepoCard(r, i, REPO_COLORS, buildOpenWithDropdown, showRepoModal)));
  
  renderProjectCharts('project-charts-container-2');
  lucide.createIcons();
}

// ─── Jira Tab View ────────────────────────────────────────────────────────────
function renderJiraTab(filter = 'mis') {
  const container = document.getElementById('jira-tab-list');
  if (!container) return;
  const issues = filter === 'todas' ? allOpenTickets : myTickets;

  if (issues.length === 0) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay tickets disponibles. Configura Jira en Configuración.</div>';
    return;
  }
  container.replaceChildren(...issues.map(issue => createJiraCard(issue, showJiraDetails, openJiraQuickStatus)));
  lucide.createIcons();
}
window.filterJira = function(filter, el) {
  document.querySelectorAll('#tab-jira .tab-item').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderJiraTab(filter);
};

// ─── Jira Details Modal ───────────────────────────────────────────────────────
async function showJiraDetails(issueKey) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  
  overlay.classList.remove('hidden');
  title.textContent = `Ticket: ${issueKey}`;
  body.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Cargando detalles...</div>`;
  
  const jiraConfig = profiles[activeProfileIndex]?.jira;
  const [detRes, tranRes] = await Promise.all([
    ipcRenderer.invoke('jira-issue-details', jiraConfig, issueKey),
    ipcRenderer.invoke('jira-issue-transitions', jiraConfig, issueKey)
  ]);
  
  if (!detRes.success) {
    body.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Error: ${detRes.error}</div>`;
    return;
  }
  
  const issue = detRes.issue;
  const transitions = tranRes.success ? tranRes.transitions : [];
  
  let transOptions = transitions.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (-> ${escapeHtml(t.to)})</option>`).join('');
  let transButtons = transitions.map(t => `
    <button class="jira-transition-chip" onclick="applyJiraTransition(${jsString(issueKey)}, ${jsString(t.id)})">
      <span>${escapeHtml(t.to)}</span>
      <small>${escapeHtml(t.name)}</small>
    </button>
  `).join('');
  let transHtml = transOptions ? `
    <div style="margin-bottom:15px;">
      <div class="jira-transition-grid">${transButtons}</div>
      <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
      <select id="jira-transition-sel" class="settings-input" style="flex:1; padding:8px;">
        <option value="" disabled selected>Mover a...</option>
        ${transOptions}
      </select>
      <button class="update-btn" onclick="applyJiraTransition(${jsString(issueKey)})" style="padding:8px 12px; margin:0;">Aplicar</button>
      </div>
    </div>
  ` : '';

  let commentsHtml = issue.comments.map(c => `
    <div style="background:var(--bg-app); border-radius:6px; padding:10px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-bottom:4px;">
        <strong>${escapeHtml(c.author)}</strong>
        <span>${new Date(c.created).toLocaleString()}</span>
      </div>
      <div style="font-size:13px; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(c.body)}</div>
    </div>
  `).join('');
  if (!commentsHtml) commentsHtml = '<div style="color:var(--text-muted); font-size:13px;">Sin comentarios.</div>';
  const issueUrl = `${(jiraConfig.baseUrl || '').replace(/\/+$/, '')}/browse/${issueKey}`;

  body.innerHTML = `
    <div style="max-height:60vh; overflow-y:auto; padding-right:5px; font-size:13px; color:var(--text-main); user-select:text;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0; font-size:16px;">${escapeHtml(issue.summary)}</h3>
        <button class="btn-text text-green" onclick="require('electron').shell.openExternal(${jsString(issueUrl)})" style="display:flex; align-items:center; gap:4px; padding:4px 8px; font-size:12px;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          Abrir en Jira
        </button>
      </div>
      
      <div style="display:flex; flex-wrap:wrap; gap:15px; margin-bottom:15px; font-size:12px; color:var(--text-muted);">
        <div><strong>Estado:</strong> ${escapeHtml(issue.status)}</div>
        <div><strong>Asignado:</strong> ${escapeHtml(issue.assignee)}</div>
        <div><strong>Reporta:</strong> ${escapeHtml(issue.reporter)}</div>
        <div><strong>Tipo:</strong> ${escapeHtml(issue.type)}</div>
      </div>
      
      ${transHtml}
      
      <div style="margin-bottom:20px;">
        <div style="font-weight:600; margin-bottom:6px;">Descripción:</div>
        <div style="background:var(--bg-app); padding:10px; border-radius:6px; white-space:pre-wrap;">${escapeHtml(issue.description)}</div>
      </div>
      
      <div style="margin-bottom:15px;">
        <div style="font-weight:600; margin-bottom:6px;">Comentarios (${issue.comments.length}):</div>
        ${commentsHtml}
      </div>
      
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        <textarea id="jira-comment-text" class="settings-input" placeholder="Escribe un comentario..." style="height:60px; resize:vertical; padding:10px;"></textarea>
        <button class="update-btn" onclick="addJiraComment(${jsString(issueKey)})" style="align-self:flex-start;">Enviar Comentario</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}


window.applyJiraTransition = async function(issueKey, transitionId = null) {
  const sel = document.getElementById('jira-transition-sel');
  const tId = transitionId || sel?.value;
  if (!tId) return;
  showProgress(30);
  const res = await ipcRenderer.invoke('jira-transition-issue', profiles[activeProfileIndex].jira, issueKey, tId);
  finishProgress();
  if (res.success) {
    notify('✅ Estado cambiado', `El ticket ${issueKey} ha sido actualizado.`);
    if (!document.getElementById('modal-overlay')?.classList.contains('hidden')) showJiraDetails(issueKey);
    loadJiraTickets(profiles[activeProfileIndex].jira, currentRenderId);
    renderJiraTab('mis');
  } else {
    notify('❌ Error', res.error, 'error');
  }
};

window.addJiraComment = async function(issueKey) {
  const ta = document.getElementById('jira-comment-text');
  if (!ta || !ta.value.trim()) return;
  showProgress(30);
  const res = await ipcRenderer.invoke('jira-add-comment', profiles[activeProfileIndex].jira, issueKey, ta.value.trim());
  finishProgress();
  if (res.success) {
    notify('✅ Comentario añadido', `Se comentó en ${issueKey}.`);
    showJiraDetails(issueKey);
  } else {
    notify('❌ Error', res.error, 'error');
  }
};

async function openJiraQuickStatus(issueKey) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  overlay.classList.remove('hidden');
  title.textContent = `Cambiar estado: ${issueKey}`;
  body.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Consultando transiciones disponibles...</div>`;

  const res = await ipcRenderer.invoke('jira-issue-transitions', profiles[activeProfileIndex]?.jira, issueKey);
  if (!res.success) {
    body.innerHTML = `<div style="color:#ef4444; padding:12px;">${escapeHtml(res.error)}</div>`;
    return;
  }
  if (!res.transitions.length) {
    body.innerHTML = '<div style="color:var(--text-muted); padding:12px;">Este ticket no tiene transiciones disponibles para tu usuario.</div>';
    return;
  }

  body.innerHTML = `
    <div class="jira-transition-grid">
      ${res.transitions.map(t => `
        <button class="jira-transition-chip" onclick="applyJiraTransition(${jsString(issueKey)}, ${jsString(t.id)}); closeModal();">
          <span>${escapeHtml(t.to)}</span>
          <small>${escapeHtml(t.name)}</small>
        </button>
      `).join('')}
    </div>
  `;
};

// ─── Activity Tab View ────────────────────────────────────────────────────────
function renderActivityTab() {
  const container = document.getElementById('activity-tab-list');
  if (!container) return;
  if (allCommits.length === 0) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay actividad reciente.</div>';
    return;
  }
  const repoColorMap = {};
  let colorIdx = 0;
  container.innerHTML = allCommits.map(c => {
    if (!repoColorMap[c.repo]) repoColorMap[c.repo] = REPO_COLORS[colorIdx++ % REPO_COLORS.length];
    const cls = repoColorMap[c.repo];
    const escapedPath = c.path ? c.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
    return `
      <div class="commit-item-wrapper" style="border:none; margin-bottom:8px;">
        <div class="activity-item commit-modal-item" style="border:1px solid var(--border-light); border-radius:10px; padding:12px 16px; background:var(--bg-panel);" onclick="toggleCommitDiff(this, '${escapedPath}', '${c.hash}')">
          <div class="repo-icon ${cls}" style="width:32px; height:32px; flex-shrink:0;">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          </div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.message}</div>
            <div style="font-size:11px; color:var(--text-muted);">${c.repo} • ${c.author || 'Anónimo'}</div>
          </div>
          <div class="act-hash">${c.hash}</div>
          <div class="act-time">${c.timeAgo}</div>
        </div>
        <div class="commit-diff-container" style="border-radius:10px; margin-top: -8px; border-top-left-radius:0; border-top-right-radius:0;">
          <div style="color:var(--text-muted); font-size:12px; text-align:center;">Cargando cambios...</div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Calendar Tab View (Real Dates) ──────────────────────────────────────────
function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Group commits by day using real ISO date
  const commitsByDay = {};
  allCommits.forEach(c => {
    if (!c.isoDate) return;
    const d = new Date(c.isoDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!commitsByDay[day]) commitsByDay[day] = [];
      commitsByDay[day].push(c);
    }
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const calCells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const isToday = day === now.getDate();
    const commits = commitsByDay[day];
    const count = commits ? commits.length : 0;
    const tooltip = commits ? commits.slice(0, 3).map(c => c.message).join('\n') : '';
    const bgColor = isToday ? '#3b82f6' : count > 3 ? '#16a34a' : count > 0 ? 'var(--accent-green-bg)' : 'transparent';
    const fgColor = isToday ? 'white' : count > 3 ? 'white' : count > 0 ? 'var(--accent-green-text)' : 'var(--text-main)';
    const border = isToday ? '#3b82f6' : count > 0 ? '#86efac' : 'var(--border-light)';

    return `
      <div class="calendar-day" ${count > 0 ? `onclick="openCommitsModal(${year}, ${month}, ${day})"` : ''} title="${count > 0 ? count + ' commits, click para ver' : 'Sin commits'}" style="
        padding:10px 4px; border-radius:8px; font-size:13px; font-weight:${isToday ? '700' : '400'};
        background:${bgColor}; color:${fgColor};
        border: 1px solid ${border};
        cursor: ${count > 0 ? 'pointer' : 'default'};
        text-align:center; position:relative;
      ">
        ${day}
        ${count > 0 ? `<div style="font-size:9px; margin-top:2px; font-weight:700;">${count}c</div>` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="max-width:720px;">
      <h2 style="font-size:18px; font-weight:700; margin-bottom:16px; text-transform:capitalize;">${monthName}</h2>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:6px; text-align:center;">
        ${dayNames.map(d => `<div style="font-size:11px; font-weight:600; color:var(--text-muted); padding:6px 0;">${d}</div>`).join('')}
        ${Array(firstDay).fill('<div></div>').join('')}
        ${calCells}
      </div>
      <div style="display:flex; gap:16px; margin-top:20px; font-size:12px; color:var(--text-muted); align-items:center; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px;height:12px;border-radius:3px;background:#3b82f6;"></div> Hoy</div>
        <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px;height:12px;border-radius:3px;background:var(--accent-green-bg);border:1px solid #86efac;"></div> 1–3 commits</div>
        <div style="display:flex; align-items:center; gap:6px;"><div style="width:12px;height:12px;border-radius:3px;background:#16a34a;"></div> 4+ commits</div>
        <div style="color:var(--text-muted); margin-left:auto; font-size:11px;">Hover sobre un día para ver commits</div>
      </div>
    </div>
  `;

  // --- ANALYTICS CHARTS ---
  const authorCounts = {};
  let totalCommits = 0;
  allCommits.forEach(c => {
    if (c.author) {
      authorCounts[c.author] = (authorCounts[c.author] || 0) + 1;
      totalCommits++;
    }
  });

  const sortedAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
  const chartsContainer = document.getElementById('author-charts-container');
  
  if (chartsContainer) {
    if (sortedAuthors.length === 0) {
      chartsContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No hay datos de autores</div>';
    } else {
      const maxCount = sortedAuthors[0][1];
      chartsContainer.innerHTML = sortedAuthors.slice(0, 5).map(([author, count]) => {
        const percentage = ((count / maxCount) * 100).toFixed(1);
        return `
          <div class="chart-item">
            <div class="chart-label-row">
              <span class="chart-author">${author}</span>
              <span class="chart-count">${count} commits</span>
            </div>
            <div class="chart-bar-bg">
              <div class="chart-bar-fill" style="width: 0%;" data-target="${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
      
      // Animate bars
      setTimeout(() => {
        chartsContainer.querySelectorAll('.chart-bar-fill').forEach(bar => {
          bar.style.width = bar.getAttribute('data-target');
        });
      }, 100);
    }
  }

  renderProjectCharts('project-charts-container');
}

function renderProjectCharts(containerId) {
  const projectCounts = {};
  allCommits.forEach(c => {
    if (c.repo) {
      projectCounts[c.repo] = (projectCounts[c.repo] || 0) + 1;
    }
  });

  const sortedProjects = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);
  const projContainer = document.getElementById(containerId);
  
  if (projContainer) {
    if (sortedProjects.length === 0) {
      projContainer.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No hay datos de proyectos</div>';
    } else {
      const maxProjCount = sortedProjects[0][1];
      projContainer.innerHTML = sortedProjects.slice(0, 5).map(([repo, count]) => {
        const percentage = ((count / maxProjCount) * 100).toFixed(1);
        return `
          <div class="chart-item">
            <div class="chart-label-row">
              <span class="chart-author">${repo}</span>
              <span class="chart-count">${count} commits</span>
            </div>
            <div class="chart-bar-bg">
              <div class="chart-bar-fill" style="width: 0%; background-color: #10b981;" data-target="${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
      
      // Animate bars
      setTimeout(() => {
        projContainer.querySelectorAll('.chart-bar-fill').forEach(bar => {
          bar.style.width = bar.getAttribute('data-target');
        });
      }, 100);
    }
  }
}

// ─── Spotlight ────────────────────────────────────────────────────────────────
const spotlightResultsContainer = document.getElementById('spotlight-results');
let spotlightSuggestions = [];
let spotlightSelectedIndex = 0;

ipcRenderer.on('set-view-mode', (e, mode) => {
  currentMode = mode;
  if (mode === 'spotlight') {
    mainDashboard.classList.add('hidden');
    spotlightWrapper.classList.remove('hidden');
    spotlightInput.value = '';
    spotlightResultsContainer.innerHTML = '';
    spotlightInput.focus();
  } else {
    mainDashboard.classList.remove('hidden');
    spotlightWrapper.classList.add('hidden');
    renderFocus();
  }
});

function renderSpotlightSuggestions() {
  spotlightResultsContainer.innerHTML = '';
  if (spotlightSuggestions.length === 0) {
    spotlightResultsContainer.innerHTML = '<div style="padding:20px 24px; color:#64748b; font-size:13px;">Sin resultados.</div>';
    return;
  }
  spotlightSuggestions.forEach((sug, index) => {
    const div = document.createElement('div');
    div.className = 'spotlight-result-item';
    if (index === spotlightSelectedIndex) div.classList.add('selected');
    div.onclick = () => executeSpotlightAction(sug);

    const icons = {
      pull: '<i data-lucide="download-cloud" style="width:20px;height:20px;"></i>',
      push: '<i data-lucide="upload-cloud" style="width:20px;height:20px;"></i>',
      checkout: '<i data-lucide="git-branch" style="width:20px;height:20px;"></i>',
      jira: '<i data-lucide="check-square" style="width:20px;height:20px;"></i>',
      changes: '<i data-lucide="file-edit" style="width:20px;height:20px;"></i>',
      vscode: '<i data-lucide="code" style="width:20px;height:20px;"></i>',
    };

    div.innerHTML = `
      <div class="result-icon">${icons[sug.action] || icons.pull}</div>
      <div style="flex:1;">
        <div class="result-text">${sug.text}</div>
        <div class="result-subtext">${sug.subtext}</div>
      </div>
    `;
    spotlightResultsContainer.appendChild(div);
  });
  lucide.createIcons();
}

async function executeSpotlightAction(sug) {
  if (sug.action === 'pull') {
    if (confirm(`¿Hacer PULL en: ${sug.data.name}?`)) {
      ipcRenderer.send('hide-window');
      await pullRepo(sug.data.path);
    }
  } else if (sug.action === 'push') {
    if (confirm(`¿Hacer PUSH en: ${sug.data.name}?`)) {
      ipcRenderer.send('hide-window');
      await pushRepo(sug.data.path);
    }
  } else if (sug.action === 'checkout') {
    await checkoutBranchUI(sug.data.path, sug.data.name);
    if (currentMode === 'spotlight') ipcRenderer.send('hide-window');
  } else if (sug.action === 'changes') {
    await showChangedFiles(sug.data.path);
  } else if (sug.action === 'vscode') {
    await openVSCode(sug.data.path);
    ipcRenderer.send('hide-window');
  } else if (sug.action === 'jira') {
    alert(`Ticket: ${sug.data.key}\n\nResumen: ${sug.data.summary}\nEstado: ${sug.data.status}`);
    ipcRenderer.send('hide-window');
  }
}

spotlightInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  spotlightSuggestions = [];
  spotlightSelectedIndex = 0;

  if (!query) { renderSpotlightSuggestions(); return; }

  // Acciones por keywords
  const isPull = query.includes('baj') || query.includes('pul') || query.includes('act');
  const isPush = query.includes('sub') || query.includes('pus') || query.includes('subi');
  const isCheckout = query.includes('cam') || query.includes('ram') || query.includes('che');
  const isChanges = query.includes('camb') || query.includes('modif') || query.includes('dif');
  const isCode = query.includes('cod') || query.includes('vsc');

  allRepos.forEach(r => {
    const nameMatch = r.name.toLowerCase().includes(query);
    if (isPull || nameMatch) spotlightSuggestions.push({ text: `Pull en ${r.name}`, subtext: r.path, action: 'pull', data: r });
    if (isPush) spotlightSuggestions.push({ text: `Push en ${r.name}`, subtext: `Rama: ${r.branch}`, action: 'push', data: r });
    if (isCheckout) spotlightSuggestions.push({ text: `Cambiar rama en ${r.name}`, subtext: `Actual: ${r.branch}`, action: 'checkout', data: r });
    if (isChanges && r.isDirty) spotlightSuggestions.push({ text: `Ver cambios en ${r.name}`, subtext: `${r.changedFiles} archivo(s) modificados`, action: 'changes', data: r });
    if (isCode) spotlightSuggestions.push({ text: `Abrir ${r.name} en VS Code`, subtext: r.path, action: 'vscode', data: r });
  });

  // Búsqueda en tickets
  allTickets.forEach(t => {
    if (t.key.toLowerCase().includes(query) || t.summary.toLowerCase().includes(query)) {
      spotlightSuggestions.push({ text: `Ticket: ${t.summary}`, subtext: `${t.key} — ${t.status}`, action: 'jira', data: t });
    }
  });

  renderSpotlightSuggestions();
});

spotlightInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (spotlightSelectedIndex < spotlightSuggestions.length - 1) spotlightSelectedIndex++;
    renderSpotlightSuggestions();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (spotlightSelectedIndex > 0) spotlightSelectedIndex--;
    renderSpotlightSuggestions();
  } else if (e.key === 'Enter' && spotlightSuggestions.length > 0) {
    executeSpotlightAction(spotlightSuggestions[spotlightSelectedIndex]);
  }
});

// ─── Global Keyboard Navigation ───────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (currentMode !== 'dashboard') return;
  if (e.key === 'Tab') {
    e.preventDefault();
    if (cursorZone === 'repos' && loadedJiraCount > 0) { cursorZone = 'jira'; cursorIndex = 0; }
    else if (cursorZone === 'jira' && loadedReposCount > 0) { cursorZone = 'repos'; cursorIndex = 0; }
    renderFocus();
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    if (cursorZone === 'repos') {
      const next = cursorIndex + dir;
      if (next >= 0 && next < loadedReposCount) { cursorIndex = next; renderFocus(); }
    } else if (cursorZone === 'jira') {
      const next = cursorIndex + dir;
      if (next >= 0 && next < loadedJiraCount) { cursorIndex = next; renderFocus(); }
    }
  }
  if (e.key === 'Enter' && cursorZone === 'repos' && loadedReposCount > 0 && repoList) {
    repoList.children[cursorIndex]?.click();
  }
});

// ─── Window Controls ──────────────────────────────────────────────────────────
document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('close-app'));
document.getElementById('btn-hide').addEventListener('click', () => ipcRenderer.send('hide-window'));
document.getElementById('btn-maximize').addEventListener('click', () => ipcRenderer.send('maximize-window'));

// ─── Tab Switching ────────────────────────────────────────────────────────────
const ALL_TABS = ['resumen', 'proyectos', 'jira', 'workspaces', 'actividad', 'calendario', 'configuracion', 'gemini', 'joplin', 'keepass'];

function switchTab(tabId, el) {
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    const target = document.querySelector(`.nav-item[onclick*="'${tabId}'"]`);
    if (target) target.classList.add('active');
  }

  ALL_TABS.forEach(id => {
    const t = document.getElementById('tab-' + id);
    if (t) t.classList.add('hidden');
  });
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.remove('hidden');

  // Lazy render on open
  if (tabId === 'proyectos') renderGitTab();
  if (tabId === 'jira') renderJiraTab('mis');
  if (tabId === 'workspaces') renderWorkspacesTab();
  if (tabId === 'actividad') renderActivityTab();
  if (tabId === 'calendario') renderCalendar();
  if (tabId === 'todo') renderTodoTab();
  if (tabId === 'configuracion') {
    if (profiles[activeProfileIndex]) {
      const jira = profiles[activeProfileIndex].jira || {};
      document.getElementById('jira-url').value = jira.baseUrl || '';
      document.getElementById('jira-email').value = jira.email || '';
      document.getElementById('jira-token').value = jira.token || '';
      const projectInput = document.getElementById('jira-project-key');
      if (projectInput) projectInput.value = jira.projectKey || '';
    }
    renderEditorsList();
    renderRepoEditorList();
    renderAppIconSettings();
    renderWorkspacesSettings();
  }
}
window.switchTab = switchTab;

// Helper: switch by name, auto-find nav-item
function switchTabByName(tabId) {
  const navItem = document.querySelector(`.nav-item[onclick*="'${tabId}'"]`);
  switchTab(tabId, navItem || null);
}
window.switchTabByName = switchTabByName;

// Config Tabs Switcher
function switchConfigTab(tabName) {
  // Update buttons
  const buttons = document.querySelectorAll('.config-tab-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick').includes(tabName)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update contents
  const contents = document.querySelectorAll('.config-tab-content');
  contents.forEach(content => {
    if (content.id === 'config-tab-' + tabName) {
      content.classList.remove('hidden');
      content.classList.add('active');
    } else {
      content.classList.add('hidden');
      content.classList.remove('active');
    }
  });
}
window.switchConfigTab = switchConfigTab;

// Dashboard Jira filter tabs
function dashJiraFilter(filter, el) {
  document.querySelectorAll('#dash-jira-tab-mis, #dash-jira-tab-equipo, #dash-jira-tab-todas')
    .forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  // Re-render dashboard Jira list with filter
  renderDashJiraList(filter);
}
window.dashJiraFilter = dashJiraFilter;

function renderDashJiraList(filter) {
  const issues = filter === 'todas' ? allOpenTickets : myTickets;
  if (!jiraList) return;

  if (issues.length === 0) {
    jiraList.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center; font-size:13px;">No hay tickets cargados.</div>';
    return;
  }
  jiraList.replaceChildren(...issues.map(issue => createJiraCard(issue, showJiraDetails, openJiraQuickStatus)));
}


// ─── Save Jira Config ─────────────────────────────────────────────────────────
async function saveJiraConfig() {
  if (!profiles[activeProfileIndex]) return;
  if (!profiles[activeProfileIndex].jira) profiles[activeProfileIndex].jira = {};
  const jira = profiles[activeProfileIndex].jira;
  jira.baseUrl = document.getElementById('jira-url').value.trim();
  jira.email = document.getElementById('jira-email').value.trim();
  jira.token = document.getElementById('jira-token').value.trim();
  jira.projectKey = document.getElementById('jira-project-key')?.value.trim() || '';

  showProgress(50);
  await ipcRenderer.invoke('save-config', { profiles });
  finishProgress();
  notify('✅ Configuración guardada', 'Credenciales de Jira guardadas.', 'info');
  switchTab('resumen', document.querySelector('.nav-item'));
  isProfileLoading = false;
  await selectProfile(activeProfileIndex);
}
window.saveJiraConfig = saveJiraConfig;

async function testJiraConfig() {
  if (!profiles[activeProfileIndex]) return;
  const jira = {
    baseUrl: document.getElementById('jira-url').value.trim(),
    email: document.getElementById('jira-email').value.trim(),
    token: document.getElementById('jira-token').value.trim(),
    projectKey: document.getElementById('jira-project-key')?.value.trim() || ''
  };

  showProgress(35);
  const res = await ipcRenderer.invoke('jira-test-connection', jira);
  finishProgress();
  if (res.success) {
    notify('API Jira conectada', `${res.user.displayName} - ${res.statuses.length} estados visibles`, 'success');
  } else {
    notify('Error Jira', res.error, 'error');
  }
}
window.testJiraConfig = testJiraConfig;

async function importJiraEnv() {
  const envPath = await ipcRenderer.invoke('select-file', {
    filters: [
      { name: 'Env', extensions: ['env'] },
      { name: 'Todos', extensions: ['*'] }
    ]
  });
  if (!envPath) return;
  const res = await ipcRenderer.invoke('import-jira-env', envPath);
  if (!res.success) {
    notify('No se pudo importar Jira', res.error, 'error');
    return;
  }
  document.getElementById('jira-url').value = res.jira.baseUrl || '';
  document.getElementById('jira-email').value = res.jira.email || '';
  document.getElementById('jira-token').value = res.jira.token || '';
  const projectInput = document.getElementById('jira-project-key');
  if (projectInput && !projectInput.value.trim()) projectInput.value = 'KAN';
  notify('Credenciales importadas', 'Revisa el Project Key y guarda la configuracion.', 'success');
}
window.importJiraEnv = importJiraEnv;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── APP ICON & WORKSPACES ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderAppIconSettings() {
  const preview = document.getElementById('app-icon-preview');
  const label = document.getElementById('app-icon-path');
  if (!preview || !label) return;
  appIconPath = appIconPath || '';
  preview.innerHTML = appIconPath
    ? `<img src="file:///${appIconPath.replace(/\\/g, '/')}" alt="Icono de la app">`
    : '<i data-lucide="app-window" style="width:32px;height:32px;"></i>';
  label.textContent = appIconPath || 'Sin icono personalizado';
  lucide.createIcons();
}

async function chooseAppIcon() {
  const selected = await ipcRenderer.invoke('select-file', {
    filters: [
      { name: 'Imagenes', extensions: ['png', 'jpg', 'jpeg', 'ico'] }
    ]
  });
  if (!selected) return;
  appIconPath = selected;
  await ipcRenderer.invoke('set-app-icon', appIconPath);
  renderAppIconSettings();
  notify('Icono actualizado', 'La vista previa y la bandeja se actualizaron.', 'success');
}
window.chooseAppIcon = chooseAppIcon;

async function clearAppIcon() {
  appIconPath = '';
  await ipcRenderer.invoke('set-app-icon', '');
  renderAppIconSettings();
  notify('Icono restaurado', 'DevDash usa el icono por defecto.', 'info');
}
window.clearAppIcon = clearAppIcon;

function workspaceIcon(type) {
  if (type === 'terminal') return 'terminal';
  if (type === 'url') return 'globe';
  return 'app-window';
}

function normalizeWorkspaceItem(item = {}) {
  return {
    id: item.id || 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type: item.type || 'app',
    name: item.name || 'Accion',
    command: item.command || '',
    args: Array.isArray(item.args) ? item.args : (item.args ? `${item.args}`.split(' ') : []),
    cwd: item.cwd || '',
    url: item.url || '',
    icon: item.icon || workspaceIcon(item.type || 'app')
  };
}

function renderWorkspacesTab() {
  const container = document.getElementById('workspace-list');
  if (!container) return;
  if (!workspaces.length) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay espacios de trabajo. Crea uno en Configuracion.</div>';
    return;
  }

  container.replaceChildren(...workspaces.map((ws, index) => createWorkspaceCard(ws, index, openWorkspace, null, null)));
  lucide.createIcons();
}

async function openWorkspace(index) {
  const workspace = workspaces[index];
  if (!workspace) return;
  showProgress(35);
  const res = await ipcRenderer.invoke('open-workspace', workspace);
  finishProgress();
  if (res.success) {
    notify('Workspace abierto', workspace.name, 'success');
  } else {
    notify('Workspace con errores', res.error || 'Revisa los comandos configurados.', 'error');
  }
}
window.openWorkspace = openWorkspace;

function renderWorkspacesSettings() {
  const container = document.getElementById('workspaces-config-list');
  if (!container) return;
  if (!workspaces.length) {
    container.innerHTML = '<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No hay workspaces configurados.</div>';
    return;
  }

  container.replaceChildren(...workspaces.map((ws, index) => {
    const row = document.createElement('div');
    row.className = 'workspace-config-row';
    
    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '0';
    
    const nameStr = document.createElement('div');
    nameStr.style.fontSize = '14px';
    nameStr.style.fontWeight = '700';
    nameStr.textContent = ws.name || '';
    
    const descStr = document.createElement('div');
    descStr.style.fontSize = '12px';
    descStr.style.color = 'var(--text-muted)';
    descStr.textContent = (ws.items?.length || 0) + ' acciones';
    
    info.appendChild(nameStr);
    info.appendChild(descStr);
    
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-refresh';
    btnEdit.innerHTML = '<i data-lucide="pencil" style="width:14px;height:14px;"></i> Editar';
    btnEdit.addEventListener('click', () => editWorkspace(index));
    
    const btnPlay = document.createElement('button');
    btnPlay.className = 'btn-refresh';
    btnPlay.innerHTML = '<i data-lucide="play" style="width:14px;height:14px;"></i> Probar';
    btnPlay.addEventListener('click', () => openWorkspace(index));
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-refresh danger';
    btnDel.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDel.addEventListener('click', () => deleteWorkspace(index));
    
    row.appendChild(info);
    row.appendChild(btnEdit);
    row.appendChild(btnPlay);
    row.appendChild(btnDel);
    
    return row;
  }));
  lucide.createIcons();
}

async function persistWorkspaces() {
  await ipcRenderer.invoke('save-workspaces', workspaces);
  renderWorkspacesTab();
  renderWorkspacesSettings();
}

function addWorkspace() {
  const workspace = {
    id: 'workspace_' + Date.now(),
    name: 'Nuevo workspace',
    description: '',
    items: []
  };
  workspaces.push(workspace);
  editWorkspace(workspaces.length - 1);
}
window.addWorkspace = addWorkspace;

function closeWorkspaceModal() {
  document.getElementById('modal-workspace-config').classList.add('hidden');
}
window.closeWorkspaceModal = closeWorkspaceModal;

function editWorkspace(index) {
  const workspace = workspaces[index];
  if (!workspace) return;
  const modal = document.getElementById('modal-workspace-config');
  const body = document.getElementById('workspace-config-body');
  
  body.innerHTML = `
    <div style="display:flex; flex-direction:column; margin-bottom: 20px;">
      <label style="font-weight: 600; color: #374151; margin-bottom: 8px; font-size:14px;">Nombre del workspace</label>
      <div style="position:relative;">
        <i data-lucide="edit-2" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#10b981; width:16px;"></i>
        <input id="workspace-name-input" value="${escapeHtml(workspace.name)}" style="width:100%; box-sizing:border-box; padding:10px 12px 10px 36px; border:1px solid #10b981; border-radius:8px; color:#111827; outline:none; font-size:14px;">
        <i data-lucide="check-circle-2" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#10b981; width:18px;"></i>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; margin-bottom: 24px;">
      <label style="font-weight: 600; color: #374151; margin-bottom: 8px; font-size:14px;">Descripción <span style="color:#9ca3af; font-weight:normal;">(opcional)</span></label>
      <div style="position:relative;">
        <i data-lucide="message-square" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; width:16px;"></i>
        <input id="workspace-desc-input" value="${escapeHtml(workspace.description || '')}" style="width:100%; box-sizing:border-box; padding:10px 60px 10px 36px; border:1px solid #e5e7eb; border-radius:8px; color:#111827; outline:none; font-size:14px;" placeholder="Ej. Backend + frontend + terminales">
        <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#9ca3af; font-size:12px;">0/120</span>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
      <h3 style="margin:0; font-size:16px; color:#111827;">Acciones</h3>
      <button onclick="openWorkspaceAddActionModal(${index})" style="background:none; border:none; color:#10b981; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:14px;">
        <i data-lucide="plus" style="width:16px;height:16px;"></i> Agregar acción
      </button>
    </div>

    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      ${workspace.items && workspace.items.length > 0 ? `
        <div style="display:grid; grid-template-columns: 120px 1fr 1.5fr 1fr 32px; gap: 12px; margin-bottom: 8px; padding:0 4px;">
          <div style="font-size:12px; font-weight:600; color:#6b7280;">Tipo</div>
          <div style="font-size:12px; font-weight:600; color:#6b7280;">Nombre</div>
          <div style="font-size:12px; font-weight:600; color:#6b7280;">Comando / Ruta</div>
          <div style="font-size:12px; font-weight:600; color:#6b7280;">Argumentos</div>
          <div></div>
        </div>
      ` : ''}
      <div id="workspace-items-editor">
        ${renderWorkspaceItemsEditor(workspace, index)}
      </div>
      
      <button onclick="openWorkspaceAddActionModal(${index})" style="width:100%; margin-top:12px; border: 1px dashed #d1d5db; border-radius: 6px; padding: 12px; background: none; color: #10b981; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size:14px; transition: background 0.2s;" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='none'">
        <i data-lucide="plus" style="width:16px;height:16px;"></i> Agregar otra acción
      </button>
    </div>

    <div style="background: #eff6ff; border-radius: 8px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 12px; margin-bottom: 24px;">
      <i data-lucide="info" style="color: #3b82f6; width: 18px; height: 18px; margin-top: 2px;"></i>
      <div style="color: #4b5563; font-size: 13px;">Las acciones te permiten ejecutar comandos o abrir carpetas rápidamente desde tu workspace.</div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center;">
      <button onclick="closeWorkspaceModal()" style="border:1px solid #e5e7eb; background:#fff; padding:10px 16px; border-radius:8px; color:#374151; font-weight:600; cursor:pointer; font-size:14px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#fff'">Cancelar</button>
      <button onclick="saveWorkspaceFromModal(${index})" style="background:#10b981; border:none; padding:10px 16px; border-radius:8px; color:#fff; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:14px; transition: background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
        <i data-lucide="save" style="width:16px;height:16px;"></i> Guardar workspace
      </button>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();
}
window.editWorkspace = editWorkspace;

function renderWorkspaceItemsEditor(workspace, workspaceIndex) {
  if (!workspace.items || workspace.items.length === 0) {
    return '';
  }
  return workspace.items.map((item, itemIndex) => {
    let typeIcon = 'layout-grid';
    if (item.type === 'app') typeIcon = 'folder';
    if (item.type === 'terminal') typeIcon = 'terminal';
    if (item.type === 'url') typeIcon = 'link';
    if (item.type === 'file') typeIcon = 'file';

    const inputStyle = "width:100%; box-sizing:border-box; padding:8px 8px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; font-size:13px; outline:none; color:#111827;";

    return `
      <div class="workspace-item-editor" data-item-index="${itemIndex}" style="display:grid; grid-template-columns: 120px 1fr 1.5fr 1fr 32px; gap: 12px; margin-bottom: 8px; align-items:center;">
        
        <div style="position:relative;">
          <i data-lucide="${typeIcon}" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); color:#10b981; width:14px; pointer-events:none;"></i>
          <select class="ws-item-type" style="${inputStyle} padding-left:28px; appearance:none; cursor:pointer;" onchange="collectWorkspaceModal(${workspaceIndex}); editWorkspace(${workspaceIndex});">
            <option value="app" ${item.type === 'app' ? 'selected' : ''}>App</option>
            <option value="terminal" ${item.type === 'terminal' ? 'selected' : ''}>Terminal</option>
            <option value="url" ${item.type === 'url' ? 'selected' : ''}>URL</option>
            <option value="file" ${item.type === 'file' ? 'selected' : ''}>Archivo/Doc</option>
          </select>
          <i data-lucide="chevron-down" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); color:#9ca3af; width:14px; pointer-events:none;"></i>
        </div>

        <div>
          <input class="ws-item-name" style="${inputStyle}" value="${escapeHtml(item.name)}" placeholder="Nombre">
        </div>

        <div style="position:relative;">
          <input class="ws-item-command" style="${inputStyle} padding-right:${item.type === 'url' ? '8px' : '32px'}" value="${escapeHtml(item.type === 'url' ? item.url : item.command)}">
          ${item.type === 'file' ? `<button onclick="pickWorkspaceItemFile(${workspaceIndex}, ${itemIndex})" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); background:none; border:none; color:#6b7280; cursor:pointer; padding:4px; display:flex; align-items:center;"><i data-lucide="file-search" style="width:14px;height:14px;"></i></button>` : ''}
          ${item.type === 'app' || item.type === 'terminal' ? `<button onclick="pickWorkspaceItemCwd(${workspaceIndex}, ${itemIndex})" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); background:none; border:none; color:#6b7280; cursor:pointer; padding:4px; display:flex; align-items:center;"><i data-lucide="folder-open" style="width:14px;height:14px;"></i></button>` : ''}
        </div>

        <div>
          <input class="ws-item-args" style="${inputStyle} ${item.type === 'file' || item.type === 'url' ? 'display: none;' : ''}" value="${escapeHtml((item.args || []).join(' '))}" placeholder="--args">
        </div>

        <div style="display:flex; justify-content:center;">
          <button onclick="removeWorkspaceItem(${workspaceIndex}, ${itemIndex})" style="background:none; border:none; cursor:pointer; color:#ef4444; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:background 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">
            <i data-lucide="trash-2" style="width:18px;height:18px;"></i>
          </button>
        </div>

        <input class="ws-item-cwd" style="display:none;" value="${escapeHtml(item.cwd || '')}">

      </div>
    `;
  }).join('');
}

let currentWorkspaceAddIndex = -1;

function openWorkspaceAddActionModal(index) {
  collectWorkspaceModal(index);
  currentWorkspaceAddIndex = index;
  document.getElementById('ws-add-type').value = 'app';
  document.getElementById('ws-add-name').value = '';
  document.getElementById('ws-add-command').value = '';
  document.getElementById('ws-add-args').value = '';
  document.getElementById('ws-add-cwd').value = profiles[activeProfileIndex]?.repos?.[0] || '';
  updateWorkspaceAddActionForm();
  document.getElementById('modal-workspace-add-action').classList.remove('hidden');
  lucide.createIcons();
}
window.openWorkspaceAddActionModal = openWorkspaceAddActionModal;

function closeWorkspaceAddActionModal() {
  document.getElementById('modal-workspace-add-action').classList.add('hidden');
}
window.closeWorkspaceAddActionModal = closeWorkspaceAddActionModal;

function updateWorkspaceAddActionForm() {
  const type = document.getElementById('ws-add-type').value;
  const commandLabel = document.getElementById('ws-add-command-label');
  const browseIcon = document.getElementById('ws-add-browse-icon');
  const argsContainer = document.getElementById('ws-add-args-container');
  const cwdContainer = document.getElementById('ws-add-cwd-container');
  const browseBtn = document.getElementById('ws-add-browse-btn');

  commandLabel.textContent = type === 'url' ? 'URL' : (type === 'file' ? 'Ruta del archivo' : 'Comando / Ruta');
  
  if (type === 'file' || type === 'url') {
    argsContainer.style.display = 'none';
    cwdContainer.style.display = 'none';
  } else {
    argsContainer.style.display = 'block';
    cwdContainer.style.display = 'block';
  }

  if (type === 'url') {
    browseBtn.style.display = 'none';
    document.getElementById('ws-add-command').style.paddingRight = '10px';
  } else {
    browseBtn.style.display = 'flex';
    document.getElementById('ws-add-command').style.paddingRight = '36px';
    if (type === 'file') {
      browseIcon.setAttribute('data-lucide', 'file-search');
    } else {
      browseIcon.setAttribute('data-lucide', 'folder-open');
    }
  }
  lucide.createIcons();
}
window.updateWorkspaceAddActionForm = updateWorkspaceAddActionForm;

async function browseWorkspaceAddAction() {
  const type = document.getElementById('ws-add-type').value;
  if (type === 'file') {
    const selected = await ipcRenderer.invoke('select-file', {
      filters: [
        { name: 'Documentos y Ejecutables', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'exe', 'bat', 'cmd', 'ps1', 'png', 'jpg', 'md'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    });
    if (selected) document.getElementById('ws-add-command').value = selected;
  } else {
    const selected = await ipcRenderer.invoke('select-directory');
    if (selected) document.getElementById('ws-add-command').value = selected;
  }
}
window.browseWorkspaceAddAction = browseWorkspaceAddAction;

function submitWorkspaceAddAction() {
  if (currentWorkspaceAddIndex === -1) return;
  const type = document.getElementById('ws-add-type').value;
  const name = document.getElementById('ws-add-name').value.trim();
  const commandValue = document.getElementById('ws-add-command').value.trim();
  const args = document.getElementById('ws-add-args').value.trim().split(/\s+/).filter(Boolean);
  const cwd = document.getElementById('ws-add-cwd').value.trim();

  workspaces[currentWorkspaceAddIndex].items.push(normalizeWorkspaceItem({
    type,
    name: name || commandValue || type,
    command: type === 'url' ? '' : commandValue,
    url: type === 'url' ? commandValue : '',
    args,
    cwd
  }));

  closeWorkspaceAddActionModal();
  editWorkspace(currentWorkspaceAddIndex);
}
window.submitWorkspaceAddAction = submitWorkspaceAddAction;


function removeWorkspaceItem(workspaceIndex, itemIndex) {
  collectWorkspaceModal(workspaceIndex);
  workspaces[workspaceIndex].items.splice(itemIndex, 1);
  editWorkspace(workspaceIndex);
}
window.removeWorkspaceItem = removeWorkspaceItem;

async function pickWorkspaceItemCwd(workspaceIndex, itemIndex) {
  collectWorkspaceModal(workspaceIndex);
  const selected = await ipcRenderer.invoke('select-directory');
  if (!selected) return;
  workspaces[workspaceIndex].items[itemIndex].cwd = selected;
  editWorkspace(workspaceIndex);
}
window.pickWorkspaceItemCwd = pickWorkspaceItemCwd;

async function deleteWorkspace(index) {
  const workspace = workspaces[index];
  if (!workspace || !confirm(`Eliminar workspace "${workspace.name}"?`)) return;
  workspaces.splice(index, 1);
  await persistWorkspaces();
  notify('Workspace eliminado', workspace.name, 'info');
}
window.deleteWorkspace = deleteWorkspace;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EDITOR MANAGEMENT ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let editors = [];
let repoEditors = {};  // { repoPath: editorId }

const EDITOR_ICONS = {
  vscode:      `<i data-lucide="code" style="width:18px;height:18px;"></i>`,
  vs:          `<i data-lucide="monitor" style="width:18px;height:18px;"></i>`,
  android:     `<i data-lucide="smartphone" style="width:18px;height:18px;"></i>`,
  webstorm:    `<i data-lucide="terminal-square" style="width:18px;height:18px;"></i>`,
  notepad:     `<i data-lucide="file-edit" style="width:18px;height:18px;"></i>`,
  folder:      `<i data-lucide="folder" style="width:18px;height:18px;"></i>`,
  terminal:    `<i data-lucide="terminal" style="width:18px;height:18px;"></i>`,
  custom:      `<i data-lucide="settings" style="width:18px;height:18px;"></i>`,
};

// Load editors from config
async function loadEditors() {
  editors = await ipcRenderer.invoke('get-editors');
  repoEditors = await ipcRenderer.invoke('get-repo-editors');
}

// Get the editor assigned to a repo (or first available editor)
function getRepoEditor(repoPath) {
  const editorId = repoEditors[repoPath];
  if (editorId && editors.find(e => e.id === editorId)) {
    return editors.find(e => e.id === editorId);
  }
  return editors[0] || null;
}

// Open a repo with its assigned editor
async function openWithEditor(repoPath) {
  const editor = getRepoEditor(repoPath);
  if (!editor) { notify('Sin editor', 'No hay editores configurados. Ve a Configuración.', 'error'); return; }
  const res = await ipcRenderer.invoke('open-with-app', repoPath, editor.command, editor.args || []);
  if (res.success) {
    notify(`Abriendo en ${editor.name}`, repoPath.replace(/\\/g, '/').split('/').pop(), 'info');
  } else {
    notify(`Error al abrir con ${editor.name}`, res.error || 'Verifica que el programa esté instalado.');
  }
}
window.openWithEditor = openWithEditor;

// Open repo with a specific editor (not the assigned one)
async function openWithSpecificEditor(repoPath, editorId) {
  const editor = editors.find(e => e.id === editorId);
  if (!editor) return;
  const res = await ipcRenderer.invoke('open-with-app', repoPath, editor.command, editor.args || []);
  if (res.success) {
    notify(`Abriendo en ${editor.name}`, repoPath.replace(/\\/g, '/').split('/').pop(), 'info');
  } else {
    notify(`Error`, `No se pudo abrir con ${editor.name}: ${res.error}`);
  }
}
window.openWithSpecificEditor = openWithSpecificEditor;

// Change assigned editor for a repo
async function setEditorForRepo(repoPath, editorId) {
  await ipcRenderer.invoke('set-repo-editor', repoPath, editorId);
  repoEditors[repoPath] = editorId;
  notify('Editor asignado', editors.find(e => e.id === editorId)?.name + ' → ' + repoPath.replace(/\\/g, '/').split('/').pop(), 'info');
  renderRepoEditorList();
  renderGitTab(); // refresh git tab to show new editor button
}
window.setEditorForRepo = setEditorForRepo;

// Build the "Open With" dropdown HTML for a repo
// Uses data-path attribute to avoid escaping issues in onclick strings
function buildOpenWithDropdown(repoPath) {
  if (!editors || editors.length === 0) return '';

  const assigned = getRepoEditor(repoPath);
  const assignedIcon = EDITOR_ICONS[assigned?.icon] || EDITOR_ICONS.custom;
  const safeId = 'dd_' + Math.random().toString(36).slice(2, 8);

  const editorOptions = editors.map(ed => {
    const icon = EDITOR_ICONS[ed.icon] || EDITOR_ICONS.custom;
    const isAssigned = assigned?.id === ed.id;
    return `
      <div class="editor-option" data-editorid="${ed.id}" data-repopath="${encodeURIComponent(repoPath)}"
           style="display:flex; align-items:center; gap:10px; padding:8px 14px; cursor:pointer;
                  background:${isAssigned ? 'var(--accent-green-bg)' : 'transparent'};
                  color:${isAssigned ? 'var(--accent-green-text)' : 'var(--text-main)'};
                  font-size:13px; white-space:nowrap;">
        ${icon}
        <span>${ed.name}</span>
        ${isAssigned ? '<span style="margin-left:auto; font-size:10px; font-weight:700;">✓</span>' : ''}
      </div>
    `;
  }).join('');

  const assignOptions = editors.map(ed => {
    const isAssigned = assigned?.id === ed.id;
    return `<option value="${ed.id}" ${isAssigned ? 'selected' : ''}>${ed.name}</option>`;
  }).join('');

  return `
    <div class="open-with-wrapper" style="position:relative; display:inline-block;" id="${safeId}">
      <button class="btn-refresh"
              onclick="event.stopPropagation(); openEditorDropdown('${safeId}')"
              style="font-size:12px; padding:6px 10px; display:flex; align-items:center; gap:5px;"
              title="Abrir con ${assigned?.name || 'editor'}">
        ${assignedIcon}
        Abrir
        <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="editor-dropdown hidden" style="
        position:absolute; top:100%; right:0; z-index:1000; min-width:210px;
        background:var(--bg-panel); border:1px solid var(--border-light);
        border-radius:10px; box-shadow: 0 8px 24px rgba(0,0,0,0.14);
        overflow-y:auto; max-height:220px; margin-top:4px;
      ">
        <div style="padding:8px 14px; font-size:10px; font-weight:700; color:var(--text-muted); border-bottom:1px solid var(--border-light); letter-spacing:.06em;">ABRIR CON</div>
        <div class="editor-options-list" data-repopath="${encodeURIComponent(repoPath)}">${editorOptions}</div>
        <div style="border-top:1px solid var(--border-light); padding:10px 14px;">
          <div style="font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:6px; letter-spacing:.06em;">PREDETERMINADO</div>
          <select class="repo-editor-select" data-repopath="${encodeURIComponent(repoPath)}"
                  onclick="event.stopPropagation()"
                  style="width:100%; padding:6px 8px; border:1px solid var(--border-light); border-radius:6px; font-size:12px; background:var(--bg-app); cursor:pointer;">
            ${assignOptions}
          </select>
        </div>
      </div>
    </div>
  `;
}

function openEditorDropdown(wrapperId) {
  // Reset z-index on all repo items to prevent overlap issues
  document.querySelectorAll('.repo-item').forEach(el => {
    el.style.zIndex = '';
    el.style.position = '';
  });

  // Close all other open dropdowns
  document.querySelectorAll('.open-with-wrapper .editor-dropdown').forEach(d => {
    if (d.closest('.open-with-wrapper')?.id !== wrapperId) d.classList.add('hidden');
  });
  
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const dropdown = wrapper.querySelector('.editor-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
    // Elevate the parent row if it's now open
    if (!dropdown.classList.contains('hidden')) {
      const repoItem = wrapper.closest('.repo-item');
      if (repoItem) {
        repoItem.style.position = 'relative';
        repoItem.style.zIndex = '9999';
      }
    }
  }
}
window.openEditorDropdown = openEditorDropdown;

function toggleEditorDropdown(repoPath, btn) {
  // Kept for backward compat, no-op
}
window.toggleEditorDropdown = toggleEditorDropdown;

// Delegated click handler for editor-option items
document.addEventListener('click', (e) => {
  // Close any open editor dropdowns
  const clickedOption = e.target.closest('.editor-option');
  if (clickedOption) {
    const editorId = clickedOption.dataset.editorid;
    const repoPath = decodeURIComponent(clickedOption.closest('.editor-options-list')?.dataset.repopath || clickedOption.dataset.repopath || '');
    if (editorId && repoPath) {
      openWithSpecificEditor(repoPath, editorId);
    }
    document.querySelectorAll('.editor-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.repo-item').forEach(el => { el.style.zIndex = ''; el.style.position = ''; });
    return;
  }

  // Close all dropdowns when clicking outside
  if (!e.target.closest('.open-with-wrapper')) {
    document.querySelectorAll('.editor-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.repo-item').forEach(el => { el.style.zIndex = ''; el.style.position = ''; });
  }
});

// Delegated change handler for repo editor select
document.addEventListener('change', (e) => {
  const sel = e.target.closest('.repo-editor-select');
  if (sel) {
    const repoPath = decodeURIComponent(sel.dataset.repopath || '');
    if (repoPath) {
      setEditorForRepo(repoPath, sel.value);
    }
    document.querySelectorAll('.editor-dropdown').forEach(d => d.classList.add('hidden'));
  }
});

// ─── Settings: Editors List ───────────────────────────────────────────────────
function renderEditorsList() {
  const container = document.getElementById('editors-list');
  if (!container) return;

  if (editors.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No hay editores configurados.</div>';
    return;
  }

  container.innerHTML = editors.map((ed, i) => {
    const icon = EDITOR_ICONS[ed.icon] || EDITOR_ICONS.custom;
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid var(--border-light); border-radius:10px; background:var(--bg-panel);">
        <div style="width:36px; height:36px; background:var(--bg-app); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
          ${icon}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600;">${ed.name}</div>
          <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">${ed.command} ${(ed.args || []).join(' ')}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn-refresh" onclick="editEditor(${i})" style="font-size:12px; padding:6px 10px;">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Editar
          </button>
          <button class="btn-refresh" onclick="deleteEditor(${i})" style="font-size:12px; padding:6px 10px; color:#ef4444;">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Settings: Per-Repo Editor Assignment ─────────────────────────────────────
function renderRepoEditorList() {
  const container = document.getElementById('repo-editor-list');
  if (!container) return;
  if (allRepos.length === 0) {
    container.innerHTML = '<div style="color:#64748b; font-size:13px; padding:20px; text-align:center;">No hay repositorios cargados.</div>';
    return;
  }

  const REPO_COLORS = ['icon-green', 'icon-blue', 'icon-orange', 'icon-purple'];
  container.innerHTML = allRepos.map((r, i) => {
    const cls = REPO_COLORS[i % REPO_COLORS.length];
    const escaped = r.path.replace(/\\/g, '\\\\');
    const assignedId = repoEditors[r.path];
    const assignedEditor = editors.find(e => e.id === assignedId) || editors[0];

    const editorOptions = editors.map(ed =>
      `<option value="${ed.id}" ${ed.id === assignedEditor?.id ? 'selected' : ''}>${ed.name}</option>`
    ).join('');

    return `
      <div style="display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid var(--border-light); border-radius:10px; background:var(--bg-panel);">
        <div class="repo-icon ${cls}">
          <i data-lucide="folder" style="width:18px;height:18px;"></i>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600;">${r.name}</div>
          <div style="font-size:11px; color:var(--text-muted);">${r.path}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <select onchange="setEditorForRepo('${escaped}', this.value)"
                  style="padding:8px 12px; border:1px solid var(--border-light); border-radius:8px; font-size:13px; background:var(--bg-app); cursor:pointer; min-width:180px;">
            ${editorOptions}
          </select>
          <button class="btn-refresh" onclick="openWithEditor('${escaped}')"
                  style="font-size:12px; padding:8px 12px; white-space:nowrap;">
            ${EDITOR_ICONS[assignedEditor?.icon] || EDITOR_ICONS.custom}
            Probar
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

// ─── Add / Edit / Delete Editor ───────────────────────────────────────────────
function addEditor() {
  const name = prompt('Nombre del editor (ej. "IntelliJ IDEA"):');
  if (!name) return;
  const command = prompt('Comando para abrirlo (ej. "idea64", "code", "devenv"):');
  if (!command) return;

  const iconOptions = Object.keys(EDITOR_ICONS).join(', ');
  const icon = prompt(`Ícono (${iconOptions}):`, 'custom') || 'custom';

  const newEditor = {
    id: 'custom_' + Date.now(),
    name: name.trim(),
    command: command.trim(),
    args: ['.'],
    icon: EDITOR_ICONS[icon] ? icon : 'custom'
  };

  editors.push(newEditor);
  ipcRenderer.invoke('save-editors', editors).then(() => {
    notify('Editor agregado', name, 'info');
    renderEditorsList();
    renderRepoEditorList();
    renderGitTab();
  });
}
window.addEditor = addEditor;

function editEditor(index) {
  const ed = editors[index];
  const name = prompt('Nombre del editor:', ed.name);
  if (!name) return;
  const command = prompt('Comando:', ed.command);
  if (!command) return;
  const iconOptions = Object.keys(EDITOR_ICONS).join(', ');
  const icon = prompt(`Ícono (${iconOptions}):`, ed.icon) || ed.icon;

  editors[index] = { ...ed, name: name.trim(), command: command.trim(), icon: EDITOR_ICONS[icon] ? icon : ed.icon };
  ipcRenderer.invoke('save-editors', editors).then(() => {
    notify('Editor actualizado', name, 'info');
    renderEditorsList();
    renderRepoEditorList();
    renderGitTab();
  });
}
window.editEditor = editEditor;

function deleteEditor(index) {
  const ed = editors[index];
  if (!confirm(`¿Eliminar "${ed.name}" de la lista de editores?`)) return;
  editors.splice(index, 1);
  ipcRenderer.invoke('save-editors', editors).then(() => {
    notify('Editor eliminado', ed.name, 'info');
    renderEditorsList();
    renderRepoEditorList();
    renderGitTab();
  });
}
window.deleteEditor = deleteEditor;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.init = init;

// Load editors before init
loadEditors().then(() => {
  init();
});
// ─── Modal Management ───────────────────────────────────────────────────────────
function openCommitsModal(year, month, day) {
  const modal = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (!modal || !title || !body) return;

  const dateObj = new Date(year, month, day);
  title.textContent = `Commits - ${dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  
  // Find commits for this specific day
  const commitsForDay = allCommits.filter(c => {
    if (!c.isoDate) return false;
    const d = new Date(c.isoDate);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });

  if (commitsForDay.length === 0) {
    body.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">No hay commits este día.</div>';
  } else {
    body.innerHTML = commitsForDay.map(c => {
      // Escape for safe HTML
      const escapedRepoPath = c.repoPath ? c.repoPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
      return `
      <div class="commit-item-wrapper">
        <div class="commit-modal-item" onclick="toggleCommitDiff(this, '${escapedRepoPath}', '${c.hash}')">
          <div class="commit-modal-repo">${c.repoName || 'Repositorio'}</div>
          <div class="commit-modal-msg">${c.message}</div>
          <div class="commit-modal-meta">
            <span>${c.author || 'Desconocido'}</span> &bull; 
            <span>${c.hash ? c.hash.substring(0, 7) : ''}</span> &bull;
            <span>${new Date(c.isoDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div class="commit-diff-container" id="diff-${c.hash}">
          <div style="color:var(--text-muted); font-size:12px; text-align:center;">Cargando cambios...</div>
        </div>
      </div>
    `;
    }).join('');
  }

  modal.classList.remove('hidden');
}
window.openCommitsModal = openCommitsModal;

function closeModal(event) {
  if (event && event.type === 'click') {
    // If it's a click, only close if clicking the overlay itself (handled in HTML by stopPropagation on content)
    // Actually the HTML passes event directly, we just need to hide it
  }
  const modal = document.getElementById('modal-overlay');
  if (modal) {
    modal.classList.add('hidden');
  }
}
window.closeModal = closeModal;

function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
}
window.toggleSidebar = toggleSidebar;

async function toggleCommitDiff(element, repoPath, hash) {
  const wrapper = element.closest('.commit-item-wrapper');
  if (!wrapper) return;
  const container = wrapper.querySelector('.commit-diff-container');
  if (!container) return;

  if (container.classList.contains('show')) {
    container.classList.remove('show');
    return;
  }

  // Hide others
  document.querySelectorAll('.commit-diff-container').forEach(c => c.classList.remove('show'));
  container.classList.add('show');

  if (container.getAttribute('data-loaded') === 'true') return;

  if (!repoPath) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Ruta de repositorio no disponible.</div>';
    return;
  }

  try {
    const res = await ipcRenderer.invoke('git-commit-diff', repoPath, hash);
    if (res.success && res.files && res.files.length > 0) {
      container.innerHTML = res.files.map(f => {
        const statusClass = f.status.charAt(0);
        return `
          <div class="diff-file-item" title="${f.path}">
            <div class="diff-status ${statusClass}">${statusClass}</div>
            <div class="diff-path">${f.path}</div>
          </div>
        `;
      }).join('');
      container.setAttribute('data-loaded', 'true');
    } else {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Sin archivos modificados o diff vacío.</div>';
    }
  } catch (err) {
    container.innerHTML = `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">Error al cargar cambios.</div>`;
  }
}


window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal-workspace-add-action') && !document.getElementById('modal-workspace-add-action').classList.contains('hidden')) {
      if (typeof closeWorkspaceAddActionModal === 'function') closeWorkspaceAddActionModal();
      return;
    }
    if (document.getElementById('modal-workspace-config') && !document.getElementById('modal-workspace-config').classList.contains('hidden')) {
      if (typeof closeWorkspaceModal === 'function') closeWorkspaceModal();
      return;
    }
    if (document.getElementById('modal-create-jira') && !document.getElementById('modal-create-jira').classList.contains('hidden')) {
      if (typeof closeCreateJiraModal === 'function') closeCreateJiraModal();
      return;
    }
    if (document.getElementById('modal-scanner') && !document.getElementById('modal-scanner').classList.contains('hidden')) {
      if (typeof closeScannerModal === 'function') closeScannerModal();
      return;
    }
    if (document.getElementById('modal-overlay') && !document.getElementById('modal-overlay').classList.contains('hidden')) {
      if (typeof closeModal === 'function') closeModal();
      return;
    }
  }
});


// --- Profile Customization Engine ---

function applyProfileCustomization(profile) {
  if (!profile) return;
  const cust = profile.customization || {};
  const theme = cust.themeMode || 'light';
  
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }
  
  
  const paletteId = cust.colorPalette || 'emerald';
  currentSelectedPalette = paletteId;
  const pal = COLOR_PALETTES[paletteId] || COLOR_PALETTES['emerald'];

  document.documentElement.style.setProperty('--accent-green-bg', pal.primary + '20');
  document.documentElement.style.setProperty('--accent-green-text', pal.primary);
  
  document.documentElement.style.setProperty('--accent-blue-bg', pal.info + '20');
  document.documentElement.style.setProperty('--accent-blue-text', pal.info);

  document.documentElement.style.setProperty('--accent-orange-bg', pal.warning + '20');
  document.documentElement.style.setProperty('--accent-orange-text', pal.warning);

  document.documentElement.style.setProperty('--accent-purple-bg', pal.secondary + '20');
  document.documentElement.style.setProperty('--accent-purple-text', pal.secondary);
  
  // Sync palette UI
  const btns = document.querySelectorAll('.palette-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.palette === paletteId));

  
  if (cust.bgImage) {
    document.body.classList.add('has-custom-bg');
    document.documentElement.style.setProperty('--user-bg-image', 'url(' + cust.bgImage + ')');
  } else {
    document.body.classList.remove('has-custom-bg');
    document.documentElement.style.removeProperty('--user-bg-image');
  }
  
  
  // Widgets Visibility
  const w = cust.widgets || {};
  const kpiEl = document.getElementById('widget-kpi');
  const jiraEl = document.getElementById('widget-jira');
  const gitEl = document.getElementById('widget-git');
  const activityEl = document.getElementById('widget-activity');

  // Reorder nodes before applying visibility
  const order = cust.widgetOrder || ['widget-kpi', 'widget-jira', 'widget-git', 'widget-activity'];
  const dndContainer = document.getElementById('dashboard-widgets-container');
  if (dndContainer) {
    order.forEach(id => {
      const el = document.getElementById(id);
      if (el) dndContainer.appendChild(el);
    });
  }

  
  if (kpiEl) kpiEl.style.display = w.kpi !== false ? '' : 'none';
  if (jiraEl) jiraEl.style.display = w.jiraDonut !== false ? '' : 'none';
  if (gitEl) gitEl.style.display = w.gitHealth !== false ? '' : 'none';
  if (activityEl) activityEl.style.display = w.activity !== false ? '' : 'none';

  // Sync inputs if in config view
  const thEl = document.getElementById('profile-theme-mode');
  
  
  const bgEl = document.getElementById('profile-bg-image');
  
  const wkpi = document.getElementById('widget-visible-kpi');
  const wjira = document.getElementById('widget-visible-jira');
  const wgit = document.getElementById('widget-visible-git');
  const wact = document.getElementById('widget-visible-activity');

  if (thEl) thEl.value = theme;
  
  
  if (bgEl) bgEl.value = cust.bgImage || '';
  
  if (wkpi) wkpi.checked = w.kpi !== false;
  if (wjira) wjira.checked = w.jiraDonut !== false;
  if (wgit) wgit.checked = w.gitHealth !== false;
  if (wact) wact.checked = w.activity !== false;
}

async function saveAppearanceConfig() {
  const profile = profiles[activeProfileIndex];
  if (!profile) return;
  
  if (!profile.customization) profile.customization = {};
  
  const thEl = document.getElementById('profile-theme-mode');
  const clEl = document.getElementById('profile-accent-color');
  const bgEl = document.getElementById('profile-bg-image');
  
  const wkpi = document.getElementById('widget-visible-kpi');
  const wjira = document.getElementById('widget-visible-jira');
  const wgit = document.getElementById('widget-visible-git');
  const wact = document.getElementById('widget-visible-activity');

  if (thEl) profile.customization.themeMode = thEl.value;
  profile.customization.colorPalette = currentSelectedPalette;
  if (bgEl) profile.customization.bgImage = bgEl.value;
  
  if (!profile.customization.widgets) profile.customization.widgets = {};
  if (wkpi) profile.customization.widgets.kpi = wkpi.checked;
  if (wjira) profile.customization.widgets.jiraDonut = wjira.checked;
  if (wgit) profile.customization.widgets.gitHealth = wgit.checked;
  if (wact) profile.customization.widgets.activity = wact.checked;

  await ipcRenderer.invoke('save-config', { profiles });
  applyProfileCustomization(profile);
  
  // Refrescar el pie de los cards de resumen para reposicionar
  renderProjectCharts('project-charts-container'); 
}
window.saveAppearanceConfig = saveAppearanceConfig;


// --- Drag and Drop Logic ---
function initDashboardDND() {
  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;
  const widgets = container.querySelectorAll('.dashboard-widget');
  
  let draggedEl = null;

  widgets.forEach(widget => {
    // Evitar multiples listeners si se llama varias veces (usando un flag custom)
    if (widget.dataset.dndInit) return;
    widget.dataset.dndInit = "true";

    widget.addEventListener('dragstart', (e) => {
      // Evitar que inputs o selects activen el drag
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') {
        e.preventDefault();
        return;
      }
      draggedEl = widget;
      setTimeout(() => widget.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', widget.id);
    });

    widget.addEventListener('dragend', () => {
      widget.classList.remove('dragging');
      draggedEl = null;
      saveWidgetOrder(); 
    });

    widget.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    });

    widget.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (draggedEl && widget !== draggedEl) {
        widget.classList.add('drag-over');
      }
    });

    widget.addEventListener('dragleave', () => {
      widget.classList.remove('drag-over');
    });

    widget.addEventListener('drop', (e) => {
      e.stopPropagation();
      e.preventDefault();
      widget.classList.remove('drag-over');

      if (draggedEl && draggedEl !== widget) {
        const all = Array.from(container.children);
        const draggedIndex = all.indexOf(draggedEl);
        const targetIndex = all.indexOf(widget);

        if (draggedIndex < targetIndex) {
          container.insertBefore(draggedEl, widget.nextSibling);
        } else {
          container.insertBefore(draggedEl, widget);
        }
      }
      return false;
    });
  });
}

async function saveWidgetOrder() {
  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;
  
  const order = Array.from(container.children)
                     .filter(el => el.classList.contains('dashboard-widget'))
                     .map(el => el.id)
                     .filter(id => id); 
  
  const profile = profiles[activeProfileIndex];
  if (profile) {
    if (!profile.customization) profile.customization = {};
    profile.customization.widgetOrder = order;
    await ipcRenderer.invoke('save-config', { profiles });
  }
}

const COLOR_PALETTES = {
  emerald: { primary: '#10b981', info: '#3b82f6', warning: '#f59e0b', secondary: '#8b5cf6' },
  ocean: { primary: '#0ea5e9', info: '#6366f1', warning: '#eab308', secondary: '#14b8a6' },
  sunset: { primary: '#f43f5e', info: '#8b5cf6', warning: '#f97316', secondary: '#db2777' },
  dracula: { primary: '#bd93f9', info: '#8be9fd', warning: '#f1fa8c', secondary: '#ff79c6' },
  monochrome: { primary: '#64748b', info: '#94a3b8', warning: '#cbd5e1', secondary: '#475569' }
};

let currentSelectedPalette = 'emerald';

function selectPalette(id) {
  currentSelectedPalette = id;
  const btns = document.querySelectorAll('.palette-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.palette === id));
  saveAppearanceConfig();
}
window.selectPalette = selectPalette;

// --- TODO LIST LOGIC ---\n
function formatDuration(ms) {
  let seconds = Math.floor(ms / 1000);
  let hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}



let currentTodoFilter = 'all';

function setTodoFilter(filter) {
  currentTodoFilter = filter;
  // Update UI Pills
  document.querySelectorAll('.todo-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text-muted)';
  });
  const activeBtn = document.getElementById('todo-filter-' + filter);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--accent)';
    activeBtn.style.color = '#fff';
  }
  renderTodoTab();
}

function buildTodoItemHTML(t, isQuick = false) {
  const el = document.createElement('div');
  el.className = 'repo-item';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '10px';
  el.style.opacity = t.completed ? '0.5' : '1';
  el.style.padding = isQuick ? '8px 12px' : '12px 18px';
  el.style.marginBottom = '8px';
  el.style.borderRadius = '8px';
  el.style.background = t.isRunning ? 'rgba(16, 185, 129, 0.08)' : (t.completed ? 'rgba(0,0,0,0.1)' : 'var(--bg-panel)');
  el.style.border = t.isRunning ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)';
  el.style.transition = 'all 0.2s ease';
  
  // Efecto hover
  el.onmouseover = () => el.style.borderColor = 'var(--text-muted)';
  el.onmouseout = () => el.style.borderColor = t.isRunning ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)';
  
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = t.completed === 1;
  chk.style.cursor = 'pointer';
  chk.style.width = '16px';
  chk.style.height = '16px';
  chk.style.accentColor = 'var(--accent)';
  chk.onchange = () => window.toggleTodoItem(t.id, chk.checked);
  
  const txt = document.createElement('span');
  txt.textContent = t.title;
  txt.style.flex = '1';
  txt.style.fontSize = isQuick ? '13px' : '14px';
  txt.style.textDecoration = t.completed ? 'line-through' : 'none';
  txt.style.color = t.completed ? 'var(--text-muted)' : (t.isRunning ? 'var(--accent)' : 'var(--text-main)');
  txt.style.fontWeight = t.isRunning ? '500' : '400';
  txt.style.whiteSpace = 'nowrap';
  txt.style.overflow = 'hidden';
  txt.style.textOverflow = 'ellipsis';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = '6px';

  let currentMs = t.totalDuration || 0;
  if (t.isRunning && t.startTime) {
    currentMs += (Date.now() - t.startTime);
  }

  if (!t.completed) {
    if (currentMs > 0 || t.isRunning) {
      const badge = document.createElement('span');
      badge.className = 'todo-timer-badge';
      badge.dataset.id = t.id;
      badge.dataset.start = t.startTime || '';
      badge.dataset.duration = t.totalDuration || 0;
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '600';
      badge.style.letterSpacing = '0.5px';
      badge.style.padding = '3px 8px';
      badge.style.borderRadius = '12px';
      badge.style.background = t.isRunning ? 'var(--accent)' : 'rgba(0,0,0,0.2)';
      badge.style.color = t.isRunning ? '#fff' : 'var(--text-muted)';
      badge.style.border = '1px solid ' + (t.isRunning ? 'transparent' : 'var(--border-light)');
      badge.style.marginRight = '4px';
      badge.style.boxShadow = t.isRunning ? '0 0 10px rgba(16,185,129,0.3)' : 'none';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }

    if (t.isRunning) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn-refresh danger';
      stopBtn.innerHTML = '<i data-lucide="square" style="width:14px;height:14px;"></i>';
      stopBtn.onclick = () => window.stopTodoTimer(t.id);
      stopBtn.title = 'Pausar Timer';
      stopBtn.style.background = 'rgba(239, 68, 68, 0.1)';
      stopBtn.style.color = '#ef4444';
      controls.appendChild(stopBtn);
    } else {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn-refresh';
      playBtn.innerHTML = '<i data-lucide="play" style="width:14px;height:14px; fill:currentColor;"></i>';
      playBtn.onclick = () => window.startTodoTimer(t.id);
      const focusBtn = document.createElement('button');
      focusBtn.className = 'todo-action-btn focus-btn';
      focusBtn.innerHTML = '<i data-lucide="crosshair"></i>';
      focusBtn.title = 'Modo Enfoque';
      focusBtn.onclick = () => window.openFocusMode(t.id, t.title);
      playBtn.title = 'Iniciar Timer';
      playBtn.style.color = '#10b981';
      playBtn.style.background = 'rgba(16, 185, 129, 0.1)';
      controls.appendChild(playBtn);
    }
  } else {
    if (currentMs > 0) {
      const badge = document.createElement('span');
      badge.style.fontSize = '12px';
      badge.style.color = 'var(--text-muted)';
      badge.style.marginRight = '4px';
      badge.style.fontFamily = 'monospace';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-refresh danger';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
  delBtn.onclick = () => window.deleteTodoItem(t.id);
  delBtn.title = 'Eliminar';
  controls.appendChild(delBtn);

  el.appendChild(chk);
  el.appendChild(txt);
  el.appendChild(controls);

  return el;
}



// DRAG & DROP STATE
let draggedTodoId = null;
let currentDraggedEl = null;

window.dragStartTodo = (event, id) => {
  draggedTodoId = id;
  currentDraggedEl = event.currentTarget;
  currentDraggedEl.style.opacity = '0.4';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
};

window.dragEndTodo = (event) => {
  if (currentDraggedEl) currentDraggedEl.style.opacity = '1';
  draggedTodoId = null;
  currentDraggedEl = null;
};

window.dragOverCol = (event) => {
  event.preventDefault();
  event.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
};

window.dragLeaveCol = (event) => {
  event.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
};

window.dropCol = async (event, newStatus) => {
  event.preventDefault();
  event.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
  if (draggedTodoId) {
    await ipcRenderer.invoke('todo-action', 'updateStatus', { id: parseInt(draggedTodoId), status: newStatus });
    renderTodoTab();
  }
};

window.addNewColumn = async () => {
  const name = prompt('Nombre de la nueva columna:');
  if (name && name.trim()) {
    await ipcRenderer.invoke('todo-action', 'addColumn', { colName: name.trim() });
    renderTodoTab();
  }
};

window.deleteColumn = async (name) => {
  if (confirm(`¿Eliminar la columna "${name}"? (Sus tareas se moverán a la primera columna)`)) {
    await ipcRenderer.invoke('todo-action', 'deleteColumn', { colName: name });
    renderTodoTab();
  }
};

function formatDuration(ms) {
  let seconds = Math.floor(ms / 1000);
  let hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function buildKanbanCardHTML(t) {
  const isDone = t.status === 'Completado' || t.status.toLowerCase().includes('done') || t.completed === 1;

  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.draggable = true;
  card.ondragstart = (e) => window.dragStartTodo(e, t.id);
  card.ondragend = (e) => window.dragEndTodo(e);
  
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '10px';
  card.style.padding = '14px 16px';
  card.style.marginBottom = '12px';
  card.style.borderRadius = '4px';
  card.style.background = t.isRunning ? 'rgba(16, 185, 129, 0.1)' : (isDone ? 'rgba(0,0,0,0.2)' : 'rgba(30, 41, 59, 0.8)');
  card.style.border = t.isRunning ? '1px solid rgba(16, 185, 129, 0.4)' : (isDone ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(255, 255, 255, 0.08)');
  card.style.boxShadow = t.isRunning ? '0 4px 15px rgba(16,185,129,0.2)' : '0 4px 6px rgba(0,0,0,0.3)';
  card.style.cursor = 'grab';
  card.style.transition = 'transform 0.1s, box-shadow 0.2s';
  
  card.onmouseover = () => {
    if (!t.isRunning && !isDone) {
      card.style.borderColor = 'rgba(255,255,255,0.2)';
      card.style.transform = 'translateY(-2px)';
    }
  };
  card.onmouseout = () => {
    if (!t.isRunning && !isDone) {
      card.style.borderColor = 'rgba(255,255,255,0.08)';
      card.style.transform = 'translateY(0)';
    }
  };

  // Header card
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';
  header.style.gap = '8px';
  
  const title = document.createElement('div');
  title.textContent = t.title;
  title.style.fontSize = '14px';
  title.style.fontWeight = '500';
  title.style.color = isDone ? 'rgba(255,255,255,0.4)' : '#fff';
  title.style.textDecoration = isDone ? 'line-through' : 'none';
  title.style.lineHeight = '1.4';
  title.style.wordBreak = 'break-word';
  
  const delBtn = document.createElement('button');
  delBtn.innerHTML = '<i data-lucide="x" style="width:14px; height:14px;"></i>';
  delBtn.style.background = 'transparent';
  delBtn.style.border = 'none';
  delBtn.style.color = 'rgba(255,255,255,0.3)';
  delBtn.style.cursor = 'pointer';
  delBtn.style.padding = '0';
  delBtn.onclick = () => window.deleteTodoItem(t.id);
  delBtn.onmouseover = () => delBtn.style.color = '#ef4444';
  delBtn.onmouseout = () => delBtn.style.color = 'rgba(255,255,255,0.3)';

  header.appendChild(title);
  
  const editBtn = document.createElement('button');
  editBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px; height:14px;"></i>';
  editBtn.style.background = 'transparent';
  editBtn.style.border = 'none';
  editBtn.style.color = 'rgba(255,255,255,0.3)';
  editBtn.style.cursor = 'pointer';
  editBtn.style.padding = '0';
  editBtn.style.marginRight = '8px';
  editBtn.onclick = () => window.openTodoEditor(t.id, t.title, t.description);
  editBtn.onmouseover = () => editBtn.style.color = 'var(--accent)';
  editBtn.onmouseout = () => editBtn.style.color = 'rgba(255,255,255,0.3)';
  
  const actionsBox = document.createElement('div');
  actionsBox.style.display = 'flex';
  actionsBox.appendChild(editBtn);
  actionsBox.appendChild(delBtn);
  header.appendChild(actionsBox);
  
  // Footer card (Timers)
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.marginTop = '4px';

  let currentMs = t.totalDuration || 0;
  if (t.isRunning && t.startTime) {
    currentMs += (Date.now() - t.startTime);
  }

  const badgeBox = document.createElement('div');
  if (currentMs > 0 || t.isRunning) {
    const badge = document.createElement('span');
    badge.className = 'todo-timer-badge';
    badge.dataset.id = t.id;
    badge.dataset.start = t.startTime || '';
    badge.dataset.duration = t.totalDuration || 0;
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '600';
    badge.style.fontFamily = 'monospace';
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '2px';
    badge.style.background = t.isRunning ? 'var(--accent)' : 'rgba(0,0,0,0.3)';
    badge.style.color = t.isRunning ? '#fff' : 'rgba(255,255,255,0.5)';
    badge.textContent = formatDuration(currentMs);
    badgeBox.appendChild(badge);
  }
  footer.appendChild(badgeBox);

  // Botones play/stop
  if (!isDone) {
    if (t.isRunning) {
      const stopBtn = document.createElement('button');
      stopBtn.innerHTML = '<i data-lucide="square" style="width:12px;height:12px;"></i>';
      stopBtn.title = 'Pausar Timer';
      stopBtn.style.background = 'rgba(239, 68, 68, 0.2)';
      stopBtn.style.color = '#ef4444';
      stopBtn.style.border = 'none';
      stopBtn.style.borderRadius = '2px';
      stopBtn.style.padding = '4px 8px';
      stopBtn.style.cursor = 'pointer';
      stopBtn.onclick = () => window.stopTodoTimer(t.id);
      footer.appendChild(stopBtn);
    } else {
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i data-lucide="play" style="width:12px;height:12px; fill:currentColor;"></i>';
      playBtn.title = 'Iniciar Timer';
      playBtn.style.background = 'rgba(16, 185, 129, 0.15)';
      playBtn.style.color = 'var(--accent)';
      playBtn.style.border = 'none';
      playBtn.style.borderRadius = '2px';
      playBtn.style.padding = '4px 8px';
      playBtn.style.cursor = 'pointer';
      playBtn.onclick = () => window.startTodoTimer(t.id);
      const focusBtn = document.createElement('button');
      focusBtn.className = 'todo-action-btn focus-btn';
      focusBtn.innerHTML = '<i data-lucide="crosshair"></i>';
      focusBtn.title = 'Modo Enfoque';
      focusBtn.onclick = () => window.openFocusMode(t.id, t.title);
      footer.appendChild(playBtn);
    }
  }

  card.appendChild(header);
  card.appendChild(footer);
  return card;
}

async function renderTodoTab() {
  const container = document.getElementById('kanban-board-container');
  if (!container) return; // Puede que estemos renderizando el quick widget en el resumen
  
  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    const columns = await ipcRenderer.invoke('todo-action', 'getColumns');
    
    container.innerHTML = '';
    
    columns.forEach(col => {
      const colDiv = document.createElement('div');
      colDiv.style.flex = '0 0 300px';
      colDiv.style.background = 'rgba(0, 0, 0, 0.2)';
      colDiv.style.borderRadius = '4px';
      colDiv.style.display = 'flex';
      colDiv.style.flexDirection = 'column';
      colDiv.style.maxHeight = '100%';
      colDiv.style.border = '1px solid rgba(255,255,255,0.03)';
      
      // DnD Listeners
      colDiv.ondragover = window.dragOverCol;
      colDiv.ondragleave = window.dragLeaveCol;
      colDiv.ondrop = (e) => window.dropCol(e, col);

      // Header de columna
      const colHeader = document.createElement('div');
      colHeader.style.padding = '16px';
      colHeader.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      colHeader.style.display = 'flex';
      colHeader.style.justifyContent = 'space-between';
      colHeader.style.alignItems = 'center';

      const title = document.createElement('h3');
      title.textContent = col;
      title.style.margin = '0';
      title.style.fontSize = '14px';
      title.style.color = 'rgba(255,255,255,0.8)';
      title.style.fontWeight = '600';
      title.style.letterSpacing = '0.5px';
      title.style.textTransform = 'uppercase';

      // Delete Col button
      if (columns.length > 1) {
        const delColBtn = document.createElement('button');
        delColBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px; height:14px;"></i>';
        delColBtn.style.background = 'none';
        delColBtn.style.border = 'none';
        delColBtn.style.color = 'rgba(255,255,255,0.2)';
        delColBtn.style.cursor = 'pointer';
        delColBtn.onclick = () => window.deleteColumn(col);
        colHeader.appendChild(title);
        colHeader.appendChild(delColBtn);
      } else {
        colHeader.appendChild(title);
      }

      colDiv.appendChild(colHeader);

      // Tarjetas Container
      const cardsContainer = document.createElement('div');
      cardsContainer.style.padding = '16px';
      cardsContainer.style.overflowY = 'auto';
      cardsContainer.style.flex = '1';
      cardsContainer.style.pointerEvents = 'none'; // Para que el div padre capture el DnD
      
      const colTodos = todos.filter(t => t.status === col);
      if (colTodos.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'Soltar aquí';
        empty.style.textAlign = 'center';
        empty.style.color = 'rgba(255,255,255,0.1)';
        empty.style.fontSize = '12px';
        empty.style.marginTop = '20px';
        empty.style.border = '2px dashed rgba(255,255,255,0.05)';
        empty.style.padding = '20px';
        empty.style.borderRadius = '8px';
        cardsContainer.appendChild(empty);
      } else {
        colTodos.forEach(t => {
          const card = buildKanbanCardHTML(t);
          card.style.pointerEvents = 'auto'; // Las tarjetas deben ser interactivas
          cardsContainer.appendChild(card);
        });
      }

      colDiv.appendChild(cardsContainer);
      container.appendChild(colDiv);
    });

    // Add Column Button
    const addColBtn = document.createElement('button');
    addColBtn.style.flex = '0 0 300px';
    addColBtn.style.background = 'rgba(255,255,255,0.02)';
    addColBtn.style.border = '1px dashed rgba(255,255,255,0.1)';
    addColBtn.style.borderRadius = '4px';
    addColBtn.style.color = 'rgba(255,255,255,0.4)';
    addColBtn.style.cursor = 'pointer';
    addColBtn.style.fontSize = '14px';
    addColBtn.style.fontWeight = '500';
    addColBtn.style.display = 'flex';
    addColBtn.style.alignItems = 'center';
    addColBtn.style.justifyContent = 'center';
    addColBtn.style.gap = '8px';
    addColBtn.style.transition = 'all 0.2s';
    addColBtn.innerHTML = '<i data-lucide="plus"></i> Nueva Columna';
    addColBtn.onmouseover = () => addColBtn.style.background = 'rgba(255,255,255,0.05)';
    addColBtn.onmouseout = () => addColBtn.style.background = 'rgba(255,255,255,0.02)';
    addColBtn.onclick = () => window.addNewColumn();

    container.appendChild(addColBtn);

    lucide.createIcons();
    renderQuickTodoTab(todos);
  } catch (err) {
    console.error(err);
  }
}


async function renderQuickTodoTab(preloadedTodos = null) {
  const container = document.getElementById('quick-todo-list');
  if (!container) return; // widget desactivado o no presente
  
  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    let todos = preloadedTodos;
    if (!todos) {
      todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    }
    container.innerHTML = '';
    // Mostrar solo las pendientes, o si no hay, al menos las 3 mas recientes
    let pending = todos.filter(t => !t.completed);
    if (pending.length === 0) pending = todos.slice(0, 3);
    else pending = pending.slice(0, 4); // top 4

    if (pending.length === 0) {
      container.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); opacity:0.6;"><i data-lucide="coffee" style="width:32px; height:32px; margin-bottom:10px;"></i><span style="font-size:13px; font-weight:500;">Todo al día. Tómate un café.</span></div>';
    } else {
      pending.forEach(t => container.appendChild(buildTodoItemHTML(t, true)));
      lucide.createIcons();
    }
  } catch (err) {}
}

async function submitQuickTodo() {
  const input = document.getElementById('todo-quick-input');
  const title = input.value.trim();
  if (!title) return;

  const profileId = profiles[activeProfileIndex]?.id;
  if (profileId) {
    await ipcRenderer.invoke('todo-action', 'add', { profileId, title });
    input.value = '';
    renderTodoTab(); // re render both
  }
}

async function startTodoTimer(id) {
  await ipcRenderer.invoke('todo-action', 'start', { id });
  renderTodoTab();
}

async function stopTodoTimer(id) {
  await ipcRenderer.invoke('todo-action', 'stop', { id });
  renderTodoTab();
}

// Timer global
setInterval(() => {
  const badges = document.querySelectorAll('.todo-timer-badge');
  badges.forEach(badge => {
    const start = parseInt(badge.dataset.start);
    if (start && start > 0) {
      const dur = parseInt(badge.dataset.duration) || 0;
      const currentMs = dur + (Date.now() - start);
      badge.textContent = formatDuration(currentMs);
    }
  });
}, 1000);


async function submitTodo() {
  const input = document.getElementById('todo-input-text');
  const title = input.value.trim();
  if (!title) return;
  const profileId = profiles[activeProfileIndex]?.id;
  if (profileId) {
    await ipcRenderer.invoke('todo-action', 'add', { profileId, title });
    input.value = '';
    renderTodoTab();
  }
}
async function toggleTodoItem(id, completed) {
  await ipcRenderer.invoke('todo-action', 'toggle', { id, completed });
  renderTodoTab();
}
async function deleteTodoItem(id) {
  await ipcRenderer.invoke('todo-action', 'delete', { id });
  renderTodoTab();
}
async function clearCompletedTodos() {
  const profileId = profiles[activeProfileIndex]?.id;
  if (profileId) {
    await ipcRenderer.invoke('todo-action', 'clear', { profileId });
    renderTodoTab();
  }
}
// EXPORT GLOBALS FOR HTML
// EXPORT GLOBALS FOR HTML
window.switchTodoTab = window.switchTodoTab;
window.openTodoEditor = window.openTodoEditor;
window.submitTodo = submitTodo;
window.submitQuickTodo = submitQuickTodo;
window.toggleTodoItem = toggleTodoItem;
window.deleteTodoItem = deleteTodoItem;
window.clearCompletedTodos = clearCompletedTodos;
window.startTodoTimer = startTodoTimer;
window.stopTodoTimer = stopTodoTimer;
window.setTodoFilter = setTodoFilter;
window.submitQuickTodo = submitQuickTodo;
window.toggleTodoItem = toggleTodoItem;
window.deleteTodoItem = deleteTodoItem;
window.clearCompletedTodos = clearCompletedTodos;
window.startTodoTimer = startTodoTimer;
window.stopTodoTimer = stopTodoTimer;

// Ctrl+K Shortcut
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    // switch to todo tab
    const tabs = document.querySelectorAll('.sidebar-nav li');
    tabs.forEach(tab => {
      if (tab.onclick.toString().includes("'todo'")) {
        tab.click();
      }
    });
    // focus input
    setTimeout(() => {
      const input = document.getElementById('todo-input-text');
      if (input) input.focus();
    }, 100);
  }
});

// --- CHARTS LOGIC ---
let chartInstances = {};

async function renderCharts() {
  // Esperar a que cargue Chart.js
  if (typeof Chart === 'undefined') {
    setTimeout(renderCharts, 100);
    return;
  }
  
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter, sans-serif';

  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    const columns = await ipcRenderer.invoke('todo-action', 'getColumns');

    // 1. Kanban Donut Chart
    const ctxKanban = document.getElementById('chart-kanban');
    if (ctxKanban) {
      if (chartInstances['kanban']) chartInstances['kanban'].destroy();
      
      const counts = columns.map(col => todos.filter(t => t.status === col).length);
      const bgColors = ['rgba(148, 163, 184, 0.6)', 'rgba(56, 189, 248, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(168, 85, 247, 0.6)', 'rgba(244, 63, 94, 0.6)'];
      const borderColors = ['rgba(148, 163, 184, 1)', 'rgba(56, 189, 248, 1)', 'rgba(16, 185, 129, 1)', 'rgba(168, 85, 247, 1)', 'rgba(244, 63, 94, 1)'];

      chartInstances['kanban'] = new Chart(ctxKanban, {
        type: 'doughnut',
        data: {
          labels: columns,
          datasets: [{
            data: counts,
            backgroundColor: bgColors.slice(0, columns.length),
            borderColor: borderColors.slice(0, columns.length),
            borderWidth: 1,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }

    // 2. Productivity Bar Chart (Time Tracking)
    const ctxTime = document.getElementById('chart-time');
    if (ctxTime) {
      if (chartInstances['time']) chartInstances['time'].destroy();
      
      const trackedTodos = todos.filter(t => t.totalDuration > 0).sort((a,b) => b.totalDuration - a.totalDuration).slice(0, 5);
      const labels = trackedTodos.length > 0 ? trackedTodos.map(t => t.title.substring(0, 15) + '...') : ['Sin tareas'];
      const dataMins = trackedTodos.length > 0 ? trackedTodos.map(t => (t.totalDuration / 60000).toFixed(1)) : [0];

      chartInstances['time'] = new Chart(ctxTime, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Minutos invertidos',
            data: dataMins,
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: 'rgba(16, 185, 129, 0.8)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Activity Line Chart (Mock Data over last 7 days)
    const ctxCommits = document.getElementById('chart-commits');
    if (ctxCommits) {
      if (chartInstances['commits']) chartInstances['commits'].destroy();
      
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const today = new Date().getDay();
      const last7Days = [];
      for(let i=6; i>=0; i--) last7Days.push(days[(today - i + 7) % 7]);

      // Mock real-looking data
      const mockData = [2, 5, 3, 8, 4, 10, 1];

      chartInstances['commits'] = new Chart(ctxCommits, {
        type: 'line',
        data: {
          labels: last7Days,
          datasets: [{
            label: 'Commits',
            data: mockData,
            fill: true,
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderColor: 'rgba(56, 189, 248, 0.8)',
            borderWidth: 2,
            tension: 0.4,
            pointBackgroundColor: '#0f172a'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

  } catch (err) {
    console.error('Error rendering charts:', err);
  }
}
// --- MARKDOWN EDITOR LOGIC REPLACED ---
// --- MARKDOWN EDITOR LOGIC ---
let activeEditTodoId = null;
let easyMdeInstance = null;

window.openTodoEditor = (id, title, description) => {
  activeEditTodoId = id;
  document.getElementById('todo-edit-title').value = title || '';
  
  if (!easyMdeInstance) {
    easyMdeInstance = new EasyMDE({
      element: document.getElementById('todo-edit-desc'),
      spellChecker: false,
      placeholder: 'Escribe tu markdown o pega una imagen aquí...',
      uploadImage: true,
      status: false, // Ocultar barra inferior fea
      imageAccept: 'image/png, image/jpeg, image/jpg, image/gif',
      imageUploadFunction: async (file, onSuccess, onError) => {
        try {
          const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
          const arrayBuffer = await file.arrayBuffer();
          const fileUrl = await ipcRenderer.invoke('save-todo-media', arrayBuffer, ext);
          if (fileUrl) {
            onSuccess(fileUrl);
          } else {
            onError('No se pudo guardar la imagen');
          }
        } catch (err) {
          onError(err.message);
        }
      },
      toolbar: [
        'bold', 'italic', 'strikethrough', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide'
      ]
    });

    // Custom Paste Interceptor (Fallback for EasyMDE 2.x issue with Ctrl+V outside toolbars)
    easyMdeInstance.codemirror.on('paste', async (cm, e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
            const arrayBuffer = await file.arrayBuffer();
            const fileUrl = await ipcRenderer.invoke('save-todo-media', arrayBuffer, ext);
            if (fileUrl) {
              const mdImg = `![imagen](${fileUrl})`;
              cm.replaceSelection(mdImg);
            }
          }
        }
      }
    });
  }

  easyMdeInstance.value(description || '');
  
  document.getElementById('modal-todo-edit').classList.remove('hidden');
  lucide.createIcons();
  
  // Refresh layout cause Codemirror buggy in hidden divs
  setTimeout(() => {
    easyMdeInstance.codemirror.refresh();
  }, 50);
};

// Handlers for Save
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('todo-edit-save');
  if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = document.getElementById('todo-edit-title').value;
      const desc = easyMdeInstance ? easyMdeInstance.value() : '';
      if (activeEditTodoId) {
        await ipcRenderer.invoke('todo-action', 'updateDescription', { id: activeEditTodoId, title, description: desc });
        document.getElementById('modal-todo-edit').classList.add('hidden');
        renderTodoTab();
      }
    });
  }
});

// --- POMODORO & FOCUS MODE LOGIC ---
let pomoTimer = null;
let pomoTimeLeft = 25 * 60; // 25 mins
let pomoCurrentState = 'focus';
let pomoIsRunning = false;
let pomoActiveTodoId = null;
let pomoLofiEnabled = false;
let pomoAccumulatedMs = 0;
let pomoLastTick = 0;

const POMO_TIMES = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

window.openFocusMode = (id, title) => {
  pomoActiveTodoId = id;
  document.getElementById('focus-task-title').textContent = title || 'Sesión de Enfoque';
  document.getElementById('focus-mode-overlay').classList.remove('hidden');
  window.setPomodoroMode('focus');
  lucide.createIcons();
};

window.exitFocusMode = async () => {
  if (pomoIsRunning) window.togglePomodoro(); // Pausa y guarda
  if (pomoLofiEnabled) window.toggleLofi(); // Stop music when exiting
  document.getElementById('focus-mode-overlay').classList.add('hidden');
  pomoActiveTodoId = null;
  renderTodoTab(); // refrescar tab para actualizar totalDuration visual
};

window.setPomodoroMode = (mode) => {
  if (pomoIsRunning) window.togglePomodoro(); // pause if switching modes
  
  pomoCurrentState = mode;
  pomoTimeLeft = POMO_TIMES[mode];
  updatePomodoroDisplay();

  // Update styles
  ['focus', 'short', 'long'].forEach(m => {
    const btn = document.getElementById('btn-pomo-' + m);
    if (m === mode) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#94a3b8';
    }
  });
};

window.togglePomodoro = async () => {
  const btn = document.getElementById('btn-pomo-toggle');
  
  if (pomoIsRunning) {
    // Pausing
    clearInterval(pomoTimer);
    pomoIsRunning = false;
    btn.innerHTML = '<i data-lucide="play" style="width:36px; height:36px; margin-left:6px;"></i>';
    document.getElementById('focus-timer-display').style.color = '#f8fafc';
    document.getElementById('focus-timer-display').style.textShadow = '0 0 40px rgba(16,185,129,0.2)';
    
    // Save accumulated time
    if (pomoAccumulatedMs > 0 && pomoActiveTodoId) {
      await ipcRenderer.invoke('todo-action', 'addDuration', { id: pomoActiveTodoId, duration: pomoAccumulatedMs });
      pomoAccumulatedMs = 0;
    }
  } else {
    // Starting
    pomoIsRunning = true;
    pomoLastTick = Date.now();
    btn.innerHTML = '<i data-lucide="pause" style="width:36px; height:36px;"></i>';
    document.getElementById('focus-timer-display').style.color = '#22c55e'; // Green
    
    pomoTimer = setInterval(() => {
      const now = Date.now();
      const delta = now - pomoLastTick;
      pomoLastTick = now;
      
      if (pomoCurrentState === 'focus') {
        pomoAccumulatedMs += delta;
      }
      
      // We subtract 1 second approx for display logic
      pomoTimeLeft--;
      updatePomodoroDisplay();
      
      if (pomoTimeLeft <= 0) {
        clearInterval(pomoTimer);
        pomoIsRunning = false;
        btn.innerHTML = '<i data-lucide="play" style="width:36px; height:36px; margin-left:6px;"></i>';
        
        // Auto-save on complete
        if (pomoAccumulatedMs > 0 && pomoActiveTodoId) {
          ipcRenderer.invoke('todo-action', 'addDuration', { id: pomoActiveTodoId, duration: pomoAccumulatedMs });
          pomoAccumulatedMs = 0;
        }
        
        // Send notification
        new Notification('DevDash Focus', { body: `Ciclo completado (${pomoCurrentState}). ¡Buen trabajo!` });
      }
    }, 1000);
  }
  lucide.createIcons();
};

window.resetPomodoro = async () => {
  if (pomoIsRunning) window.togglePomodoro(); // This will pause and save
  pomoTimeLeft = POMO_TIMES[pomoCurrentState];
  updatePomodoroDisplay();
};

function updatePomodoroDisplay() {
  const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
  const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
  document.getElementById('focus-timer-display').textContent = `${m}:${s}`;
}

window.toggleLofi = () => {
  const container = document.getElementById('lofi-player-container');
  const btn = document.getElementById('btn-pomo-lofi');
  pomoLofiEnabled = !pomoLofiEnabled;
  
  if (pomoLofiEnabled) {
    // Lofi Girl live stream youtube embed
    container.innerHTML = '<iframe width="100" height="100" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>';
    btn.innerHTML = '<i data-lucide="headphones"></i> Lofi Radio: Encendido';
    btn.style.color = '#22c55e';
    btn.style.borderColor = '#22c55e';
  } else {
    container.innerHTML = '';
    btn.innerHTML = '<i data-lucide="headphones"></i> Lofi Radio: Apagado';
    btn.style.color = '#94a3b8';
    btn.style.borderColor = 'rgba(255,255,255,0.2)';
  }
  lucide.createIcons();
};
