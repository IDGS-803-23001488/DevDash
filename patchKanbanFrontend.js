const fs = require('fs');

// --- 1. MODIFICAR todo.html ---
const kanbanHTML = `<!-- Kanban Board View -->
<main class="main-content hidden" id="tab-todo">
  <header class="header">
    <div class="header-titles">
      <h1>Board</h1>
      <p style="color:var(--text-muted);">Gestión de tareas visual</p>
    </div>
  </header>

  <div class="card" style="margin-top: 20px; display: flex; flex-direction: column; height: calc(100vh - 120px); max-height: 850px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(16px); box-shadow: inset 0 0 40px rgba(0,0,0,0.5);">
    
    <!-- Input Header Rediseñado -->
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid rgba(255,255,255,0.03);">
      
      <!-- Search/Add Bar -->
      <div style="position: relative; display: flex; align-items: center;">
        <input type="text" id="todo-input-text" class="settings-input" style="width: 100%; font-size: 15px; padding: 14px 100px 14px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); outline: none; background: rgba(0,0,0,0.3); color: #fff; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" placeholder="¿Qué necesitas programar hoy?" onfocus="this.style.borderColor='var(--accent)'; this.style.boxShadow='0 0 15px rgba(16, 185, 129, 0.2)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';" onkeydown="if(event.key === 'Enter') { event.preventDefault(); window.submitTodo(); }">
        
        <div style="position: absolute; right: 10px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 6px; font-family: monospace;">Ctrl+K</span>
          <button class="update-btn" onclick="window.submitTodo()" style="padding: 8px 16px; border-radius: 8px; border: none; background: linear-gradient(135deg, var(--accent), #059669); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'">
            <i data-lucide="plus" style="width:18px;height:18px;"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Tablero Kanban Horizontal -->
    <div id="kanban-board-container" style="flex: 1; overflow-x: auto; overflow-y: hidden; padding: 24px; display: flex; gap: 24px; align-items: flex-start;">
      <!-- render here -->
    </div>
  </div>
</main>
`;
fs.writeFileSync('./views/todo.html', kanbanHTML, 'utf8');

// --- 2. MODIFICAR renderer.js ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const regexRenderTab = /async function renderTodoTab\(\) \{[\s\S]*?\} catch \(err\) \{\n    console.error\(err\);\n  \}\n\}/;
const oldRender = renderer.match(regexRenderTab);

const newRenderTodoTab = `
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
  if (confirm(\`¿Eliminar la columna "\${name}"? (Sus tareas se moverán a la primera columna)\`)) {
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
  return \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
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
  card.style.borderRadius = '10px';
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
  header.appendChild(delBtn);
  
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
    badge.style.borderRadius = '6px';
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
      stopBtn.style.borderRadius = '6px';
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
      playBtn.style.borderRadius = '6px';
      playBtn.style.padding = '4px 8px';
      playBtn.style.cursor = 'pointer';
      playBtn.onclick = () => window.startTodoTimer(t.id);
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
      colDiv.style.borderRadius = '12px';
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
    addColBtn.style.borderRadius = '12px';
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
`;

if (oldRender) {
  renderer = renderer.replace(oldRender[0], newRenderTodoTab);
}

// Inyectar en Globals: dragStartTodo, dragEndTodo, dragOverCol, dropCol, addNewColumn, deleteColumn
const additionalGlobals = `
window.dragStartTodo = window.dragStartTodo;
window.dragEndTodo = window.dragEndTodo;
window.dragOverCol = window.dragOverCol;
window.dropCol = window.dropCol;
window.dragLeaveCol = window.dragLeaveCol;
window.addNewColumn = window.addNewColumn;
window.deleteColumn = window.deleteColumn;
`;

if (!renderer.includes('window.addNewColumn')) {
  renderer = renderer.replace('window.submitTodo = submitTodo;', additionalGlobals + '\nwindow.submitTodo = submitTodo;');
}

fs.writeFileSync('./renderer.js', renderer, 'utf8');
console.log('Frontend patched.');
