const fs = require('fs');
const path = './renderer.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Require
content = content.replace("const { ipcRenderer } = require('electron');", "const { ipcRenderer } = require('electron');\nconst { createRepoCard } = require('./components/RepoCard.js');\nconst { createJiraCard } = require('./components/JiraCard.js');\nconst { createWorkspaceCard } = require('./components/WorkspaceCard.js');");

// 2. renderGitTab
content = content.replace(/function renderGitTab\(\) \{[\s\S]*?lucide\.createIcons\(\);\n\}/, `function renderGitTab() {
  const container = document.getElementById('git-tab-list');
  if (!container) return;
  if (allRepos.length === 0) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay repositorios. Haz clic en "Agregar Repositorio".</div>';
    return;
  }
  container.replaceChildren(...allRepos.map((r, i) => createRepoCard(r, i, REPO_COLORS, buildOpenWithDropdown)));
  
  renderProjectCharts('project-charts-container-2');
  lucide.createIcons();
}`);

// 3. renderJiraTab
content = content.replace(/function renderJiraTab\(filter = 'mis'\) \{[\s\S]*?lucide\.createIcons\(\);\n\}/, `function renderJiraTab(filter = 'mis') {
  const container = document.getElementById('jira-tab-list');
  if (!container) return;
  const issues = filter === 'todas' ? allOpenTickets : myTickets;

  if (issues.length === 0) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay tickets disponibles. Configura Jira en Configuración.</div>';
    return;
  }
  container.replaceChildren(...issues.map(createJiraCard));
  lucide.createIcons();
}`);

// 4. renderDashJiraList
content = content.replace(/function renderDashJiraList\(filter\) \{[\s\S]*?\}\)\.join\(''\);\n\}/, `function renderDashJiraList(filter) {
  const issues = filter === 'todas' ? allOpenTickets : myTickets;
  if (!jiraList) return;

  if (issues.length === 0) {
    jiraList.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center; font-size:13px;">No hay tickets cargados.</div>';
    return;
  }
  jiraList.replaceChildren(...issues.map(createJiraCard));
}`);

// 5. renderWorkspacesTab
content = content.replace(/function renderWorkspacesTab\(\) \{[\s\S]*?lucide\.createIcons\(\);\n\}/, `function renderWorkspacesTab() {
  const container = document.getElementById('workspace-list');
  if (!container) return;
  if (!workspaces.length) {
    container.innerHTML = '<div style="padding:40px; color:#64748b; text-align:center;">No hay espacios de trabajo. Crea uno en Configuracion.</div>';
    return;
  }

  container.replaceChildren(...workspaces.map((ws, index) => createWorkspaceCard(ws, index, openWorkspace, null, null)));
  lucide.createIcons();
}`);

// 6. renderWorkspacesSettings
content = content.replace(/function renderWorkspacesSettings\(\) \{[\s\S]*?lucide\.createIcons\(\);\n\}/, `function renderWorkspacesSettings() {
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
    btnEdit.addEventListener('click', () => {
      if (typeof window.editWorkspace === 'function') window.editWorkspace(index);
    });
    
    const btnPlay = document.createElement('button');
    btnPlay.className = 'btn-refresh';
    btnPlay.innerHTML = '<i data-lucide="play" style="width:14px;height:14px;"></i> Probar';
    btnPlay.addEventListener('click', () => {
      if (typeof window.openWorkspace === 'function') window.openWorkspace(index);
    });
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-refresh danger';
    btnDel.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDel.addEventListener('click', () => {
      if (typeof window.deleteWorkspace === 'function') window.deleteWorkspace(index);
    });
    
    row.appendChild(info);
    row.appendChild(btnEdit);
    row.appendChild(btnPlay);
    row.appendChild(btnDel);
    
    return row;
  }));
  lucide.createIcons();
}`);

fs.writeFileSync(path, content, 'utf8');
console.log('Refactor complete!');
