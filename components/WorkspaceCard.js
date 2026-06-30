function workspaceIcon(type) {
  if (type === 'app' || type === 'terminal') return 'terminal';
  if (type === 'url') return 'globe';
  return 'file-code';
}

function createWorkspaceCard(workspace, index, openWorkspaceFn, editWorkspaceFn, deleteWorkspaceFn) {
  const template = document.createElement('template');

  template.innerHTML = `
    <div class="workspace-card">
      <div class="workspace-card-head">
        <div>
          <h3 class="ws-title"></h3>
          <p class="ws-desc"></p>
        </div>
        <div class="ws-actions" style="display:flex; gap:8px;">
          <!-- Botones de edicion agregados si pasamos funciones correspondientes -->
        </div>
      </div>
      <div class="workspace-items"></div>
    </div>
  `;

  const clone = template.content.firstElementChild;

  clone.querySelector('.ws-title').textContent = workspace.name || '';
  clone.querySelector('.ws-desc').textContent = workspace.description || `${workspace.items?.length || 0} acciones configuradas`;

  // Renderizar items locales seguros
  const itemsContainer = clone.querySelector('.workspace-items');
  if (workspace.items && workspace.items.length > 0) {
    workspace.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'workspace-item';
      
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', workspaceIcon(item.type));
      icon.style.width = '16px';
      icon.style.height = '16px';

      const info = document.createElement('div');
      const str = document.createElement('strong');
      str.textContent = item.name || '';
      
      const sub = document.createElement('span');
      sub.textContent = item.type === 'url' ? (item.url || '') : `${item.command} ${(item.args || []).join(' ')}`;
      
      info.appendChild(str);
      info.appendChild(sub);
      
      el.appendChild(icon);
      el.appendChild(info);
      itemsContainer.appendChild(el);
    });
  } else {
    itemsContainer.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">Sin acciones.</div>';
  }

  const actionsContainer = clone.querySelector('.ws-actions');

  // Dependiendo del contexto (Configuracion vs Resumen) pasamos distintas fns
  if (typeof openWorkspaceFn === 'function') {
    const btnPlay = document.createElement('button');
    btnPlay.className = 'update-btn';
    btnPlay.innerHTML = '<i data-lucide="play" style="width:15px;height:15px;"></i> Abrir todo';
    btnPlay.addEventListener('click', (e) => {
      e.stopPropagation();
      openWorkspaceFn(index);
    });
    actionsContainer.appendChild(btnPlay);
  }

  if (typeof editWorkspaceFn === 'function') {
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-refresh';
    btnEdit.innerHTML = '<i data-lucide="pencil" style="width:14px;height:14px;"></i> Editar';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      editWorkspaceFn(index);
    });
    actionsContainer.appendChild(btnEdit);
  }

  if (typeof deleteWorkspaceFn === 'function') {
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-refresh danger';
    btnDel.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteWorkspaceFn(index);
    });
    actionsContainer.appendChild(btnDel);
  }

  return clone;
}

module.exports = { createWorkspaceCard };
