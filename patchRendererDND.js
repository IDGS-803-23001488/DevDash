const fs = require('fs');

const path = './renderer.js';
let content = fs.readFileSync(path, 'utf8');

const dndFunctions = `

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
`;

// Inyectar funciones al final de renderer
content += dndFunctions;

// Inyectar inicializador en init() (o despues del layout initial load)
content = content.replace(
  'renderWorkspacesTab();',
  'renderWorkspacesTab();\n    initDashboardDND();'
);

// Modificar applyProfileCustomization para reordenar DOM
const replacementCust = `
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
`;

content = content.replace(
  '// Widgets Visibility\n  const w = cust.widgets || {};\n  const kpiEl = document.getElementById(\'widget-kpi\');\n  const jiraEl = document.getElementById(\'widget-jira\');\n  const gitEl = document.getElementById(\'widget-git\');\n  const activityEl = document.getElementById(\'widget-activity\');',
  replacementCust
);

fs.writeFileSync(path, content, 'utf8');
console.log('renderer.js patched for DND!');
