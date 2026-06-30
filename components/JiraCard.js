const { getStatusClass } = require('./utils.js');

function createJiraCard(issue, onCardClick, onStatusClick) {
  const template = document.createElement('template');
  const statusClass = getStatusClass(issue.status);
  
  template.innerHTML = `
    <div class="jira-item" style="padding:14px 0; cursor:pointer;">
      <div class="badge-key"></div>
      <div class="jira-title" style="font-size:14px;"></div>
      <button class="badge-status ${statusClass} jira-status-btn" title="Cambiar estado"></button>
      <button class="btn-refresh jira-row-action" title="Cambio rapido de estado">
        <i data-lucide="move-right" style="width:14px;height:14px;"></i>
      </button>
      <div class="jira-time" style="min-width:60px;"></div>
    </div>
  `;

  const clone = template.content.firstElementChild;

  // Llenado seguro de datos
  clone.querySelector('.badge-key').textContent = issue.key || '';
  clone.querySelector('.jira-title').textContent = issue.summary || '';
  clone.querySelector('.badge-status').textContent = issue.status || '';
  
  const assignee = issue.assignee ? issue.assignee.split(' ')[0] : '';
  clone.querySelector('.jira-time').textContent = assignee;

  // Eventos locales encapsulados
  clone.addEventListener('click', () => {
    if (onCardClick) onCardClick(issue.key);
  });

  const btnStatus = clone.querySelector('.jira-status-btn');
  if (btnStatus) {
    btnStatus.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onStatusClick) onStatusClick(issue.key);
    });
  }

  const btnRowAction = clone.querySelector('.jira-row-action');
  if (btnRowAction) {
    btnRowAction.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onStatusClick) onStatusClick(issue.key);
    });
  }

  return clone;
}

module.exports = { createJiraCard };
