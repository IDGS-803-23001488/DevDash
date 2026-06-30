const { escapeHtml } = require('./utils.js');

// En renderer.js REPO_COLORS es = ['icon-green', 'icon-blue', 'icon-orange', 'icon-purple'];

function createRepoCard(repo, index, colors, createDropdownFn, onRepoClick) {
  const template = document.createElement('template');
  const cls = colors[index % colors.length];
  const colorName = cls.split('-')[1];

  let aheadBadge = '';
  let behindBadge = '';
  let dirtyBadge = '';

  if (repo.ahead > 0) aheadBadge = `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;">↑${repo.ahead} por subir</span>`;
  if (repo.behind > 0) behindBadge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;">↓${repo.behind} por bajar</span>`;
  if (repo.changedFiles > 0) dirtyBadge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;">${repo.changedFiles} archivo(s) modificados</span>`;

  template.innerHTML = `
    <div class="repo-item" style="padding:18px 20px; flex-wrap:wrap; gap:12px; cursor:pointer;">
      <div class="repo-icon ${cls}">
        <i data-lucide="folder" style="width:20px;height:20px;"></i>
      </div>
      <div class="repo-info" style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="repo-name"></div>
          <div class="repo-branch text-${colorName}" style="font-size:12px;">
            <i data-lucide="git-branch" style="width:12px;height:12px;"></i>
            <span class="branch-name"></span>
          </div>
          <div class="dot ${repo.isDirty ? 'dot-orange' : 'dot-' + colorName}" style="width:8px;height:8px;"></div>
        </div>
        <div class="repo-path" style="margin-top:2px;"></div>
        <div class="repo-badges" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
          ${aheadBadge}${behindBadge}${dirtyBadge}
        </div>
      </div>
      <div class="repo-open-with" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
      </div>
    </div>
  `;

  const clone = template.content.firstElementChild;
  
  clone.querySelector('.repo-name').textContent = repo.name || '';
  clone.querySelector('.branch-name').textContent = repo.branch || '';
  clone.querySelector('.repo-path').textContent = repo.path || '';

  // Dropdown injection (Si createDropdownFn retorna un String o Node)
  const openWithContainer = clone.querySelector('.repo-open-with');
  if (typeof createDropdownFn === 'function') {
    const dropdownContent = createDropdownFn(repo.path);
    if (dropdownContent instanceof Node) {
      openWithContainer.appendChild(dropdownContent);
    } else {
      openWithContainer.innerHTML = dropdownContent; // fallback si todavía genera string
    }
  }

  // Evento local seguro
  clone.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('.open-with-wrapper')) {
      return; // Ignorar clics en los botones internos
    }
    if (onRepoClick) onRepoClick(index);
  });

  return clone;
}

module.exports = { createRepoCard };
