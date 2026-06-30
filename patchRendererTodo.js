const fs = require('fs');

let renderer = fs.readFileSync('./renderer.js', 'utf8');

// Inyectar la inicialización y funciones de TODO
const todoJS = `
// --- TODO LIST LOGIC ---
async function renderTodoTab() {
  const container = document.getElementById('todo-list-container');
  if (!container) return;
  
  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    if (todos.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:14px; text-align:center; margin-top:40px;">No hay tareas para este perfil.</div>';
      return;
    }

    container.innerHTML = '';
    todos.forEach(t => {
      const el = document.createElement('div');
      el.className = 'repo-item'; // Aprovechando las clases del panel de repo
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '12px';
      el.style.opacity = t.completed ? '0.6' : '1';
      
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

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-refresh danger';
      delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
      delBtn.onclick = () => deleteTodoItem(t.id);

      el.appendChild(chk);
      el.appendChild(txt);
      el.appendChild(delBtn);

      container.appendChild(el);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

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

renderer += '\\n' + todoJS;

// Enganchar el switchTab
renderer = renderer.replace(
  "case 'actividad':",
  "case 'todo':\n      renderTodoTab();\n      break;\n    case 'actividad':"
);

// Llamarlo cuando se cambia de perfil:
// function switchActiveProfile...
renderer = renderer.replace(
  "if (document.getElementById('tab-resumen').classList.contains('hidden') === false) {",
  "if (document.getElementById('tab-todo').classList.contains('hidden') === false) renderTodoTab();\n  if (document.getElementById('tab-resumen').classList.contains('hidden') === false) {"
);

fs.writeFileSync('./renderer.js', renderer, 'utf8');
console.log('renderer.js patched with todo logic');
