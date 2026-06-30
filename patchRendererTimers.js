const fs = require('fs');

let renderer = fs.readFileSync('./renderer.js', 'utf8');

// 1. Modificar renderTodoTab para incluir botones play/stop y logic timer
const newRenderTodo = `
function formatDuration(ms) {
  let seconds = Math.floor(ms / 1000);
  let hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
}

function buildTodoItemHTML(t, isQuick = false) {
  const el = document.createElement('div');
  el.className = 'repo-item';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '8px';
  el.style.opacity = t.completed ? '0.6' : '1';
  el.style.padding = isQuick ? '6px' : '10px 16px';
  
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = t.completed === 1;
  chk.style.cursor = 'pointer';
  chk.onchange = () => toggleTodoItem(t.id, chk.checked);
  
  const txt = document.createElement('span');
  txt.textContent = t.title;
  txt.style.flex = '1';
  txt.style.textDecoration = t.completed ? 'line-through' : 'none';
  txt.style.color = t.completed ? 'var(--text-muted)' : 'var(--text-main)';
  txt.style.whiteSpace = 'nowrap';
  txt.style.overflow = 'hidden';
  txt.style.textOverflow = 'ellipsis';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = '4px';

  // Timer logic
  let currentMs = t.totalDuration || 0;
  if (t.isRunning && t.startTime) {
    currentMs += (Date.now() - t.startTime);
  }

  if (!t.completed) {
    // Reloj
    if (currentMs > 0 || t.isRunning) {
      const badge = document.createElement('span');
      badge.className = 'todo-timer-badge';
      badge.dataset.id = t.id;
      badge.dataset.start = t.startTime || '';
      badge.dataset.duration = t.totalDuration || 0;
      badge.style.fontSize = '11px';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '12px';
      badge.style.background = t.isRunning ? 'var(--accent)' : 'var(--bg-panel)';
      badge.style.color = t.isRunning ? '#fff' : 'var(--text-muted)';
      badge.style.border = '1px solid ' + (t.isRunning ? 'transparent' : 'var(--border-light)');
      badge.style.marginRight = '8px';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }

    if (t.isRunning) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn-refresh danger';
      stopBtn.innerHTML = '<i data-lucide="square" style="width:14px;height:14px;"></i>';
      stopBtn.onclick = () => stopTodoTimer(t.id);
      stopBtn.title = 'Detener Timer';
      controls.appendChild(stopBtn);
    } else {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn-refresh';
      playBtn.innerHTML = '<i data-lucide="play" style="width:14px;height:14px;"></i>';
      playBtn.onclick = () => startTodoTimer(t.id);
      playBtn.title = 'Iniciar Timer';
      playBtn.style.color = '#10b981';
      controls.appendChild(playBtn);
    }
  } else {
    // Si esta completado mostramos el tiempo total
    if (currentMs > 0) {
      const badge = document.createElement('span');
      badge.style.fontSize = '11px';
      badge.style.color = 'var(--text-muted)';
      badge.style.marginRight = '8px';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-refresh danger';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
  delBtn.onclick = () => deleteTodoItem(t.id);
  delBtn.title = 'Eliminar';
  controls.appendChild(delBtn);

  el.appendChild(chk);
  el.appendChild(txt);
  el.appendChild(controls);

  return el;
}

async function renderTodoTab() {
  const container = document.getElementById('todo-list-container');
  if (!container) return;
  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    container.innerHTML = '';
    if (todos.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:14px; text-align:center; margin-top:40px;">No hay tareas para este perfil.</div>';
    } else {
      todos.forEach(t => container.appendChild(buildTodoItemHTML(t, false)));
      lucide.createIcons();
    }
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
      container.innerHTML = '<div style="color:var(--text-muted); font-size:12px; text-align:center; margin-top:20px;">Sin pendientes urgentes.</div>';
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

`;

// Remover el block viejo de "async function renderTodoTab() { ... }" hasta el final para reemplazarlo todo limpio.
const splitStr = "// --- TODO LIST LOGIC ---";
if (renderer.includes(splitStr)) {
  const parts = renderer.split(splitStr);
  
  // Vamos a preservar toggleTodoItem, deleteTodoItem, clearCompletedTodos, submitTodo y reinyectar
  const oldFuncs = `
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
`;

  renderer = parts[0] + splitStr + "\\n" + newRenderTodo + oldFuncs;
}

// Asegurarse de que init() llama a renderQuickTodoTab
if (renderer.includes("loadGitData(activeProfileIndex);")) {
  renderer = renderer.replace(
    "loadGitData(activeProfileIndex);",
    "loadGitData(activeProfileIndex);\n  renderQuickTodoTab();"
  );
}

fs.writeFileSync('./renderer.js', renderer, 'utf8');
console.log('Renderer timers patched.');
