const fs = require('fs');

// --- 1. MODIFICAR todo.html ---
const newTodoHTML = `<!-- ToDo List View -->
<main class="main-content hidden" id="tab-todo">
  <header class="header">
    <div class="header-titles">
      <h1>To-Do List</h1>
      <p>Tareas rápidas y organización local</p>
    </div>
  </header>

  <div class="card" style="margin-top: 20px; display: flex; flex-direction: column; height: calc(100vh - 120px); max-height: 800px;">
    
    <!-- Input Header Rediseñado -->
    <div style="padding: 20px 20px 10px 20px; display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Search/Add Bar -->
      <div style="position: relative; display: flex; align-items: center;">
        <input type="text" id="todo-input-text" class="settings-input" style="width: 100%; font-size: 15px; padding: 14px 100px 14px 16px; border-radius: 8px; border: 1px solid var(--border-light); outline: none; background: var(--bg-panel); color: var(--text-main); transition: border-color 0.2s;" placeholder="¿Qué necesitas programar hoy?" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border-light)'" onkeydown="if(event.key === 'Enter') { event.preventDefault(); window.submitTodo(); }">
        
        <div style="position: absolute; right: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); background: rgba(0,0,0,0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-light); font-family: monospace;">Ctrl+K</span>
          <button class="update-btn" onclick="window.submitTodo()" style="padding: 6px 12px; border-radius: 6px; border: none; background: rgba(16, 185, 129, 0.1); color: var(--accent); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='var(--accent)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(16, 185, 129, 0.1)'; this.style.color='var(--accent)';">
            <i data-lucide="plus" style="width:18px;height:18px;"></i>
          </button>
        </div>
      </div>

      <!-- Filters & Actions -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 10px;">
        <div style="display: flex; gap: 8px;" id="todo-filters-container">
          <button onclick="window.setTodoFilter('all')" id="todo-filter-all" class="todo-filter-btn active" style="padding: 6px 12px; font-size: 13px; border-radius: 20px; border: none; background: var(--accent); color: #fff; cursor: pointer;">Todas</button>
          <button onclick="window.setTodoFilter('pending')" id="todo-filter-pending" class="todo-filter-btn" style="padding: 6px 12px; font-size: 13px; border-radius: 20px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: background 0.2s;" onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(0,0,0,0.05)'" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent'">Pendientes</button>
          <button onclick="window.setTodoFilter('completed')" id="todo-filter-completed" class="todo-filter-btn" style="padding: 6px 12px; font-size: 13px; border-radius: 20px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: background 0.2s;" onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(0,0,0,0.05)'" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent'">Completadas</button>
        </div>
        
        <button id="todo-clear-btn" class="btn-refresh danger" onclick="window.clearCompletedTodos()" style="display: none; padding: 6px 12px; font-size: 13px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; border-radius: 6px; cursor: pointer;">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i> Limpiar
        </button>
      </div>
    </div>

    <!-- Lista de tareas -->
    <div id="todo-list-container" style="flex: 1; overflow-y: auto; padding: 10px 20px 20px 20px;">
      <!-- render here -->
    </div>
  </div>
</main>
`;
fs.writeFileSync('./views/todo.html', newTodoHTML, 'utf8');

// --- 2. MODIFICAR renderer.js ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const globals = `
// EXPORT GLOBALS FOR HTML
window.submitTodo = submitTodo;
window.submitQuickTodo = submitQuickTodo;
window.toggleTodoItem = toggleTodoItem;
window.deleteTodoItem = deleteTodoItem;
window.clearCompletedTodos = clearCompletedTodos;
window.startTodoTimer = startTodoTimer;
window.stopTodoTimer = stopTodoTimer;
window.setTodoFilter = setTodoFilter;
`;

if (!renderer.includes('let currentTodoFilter =')) {
  // Inject state variable and logic at the top of the Todo functions
  const logicInjection = `
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

`;

  // Find where buildTodoItemHTML is declared and put it before
  renderer = renderer.replace('function buildTodoItemHTML(t, isQuick = false) {', logicInjection + 'function buildTodoItemHTML(t, isQuick = false) {');
}

// Modify renderTodoTab to support filters, empty state and clear button logic
const oldRenderTodoTab = renderer.match(/async function renderTodoTab\(\) \{[\s\S]*?\} catch \(err\) \{\n    console.error\(err\);\n  \}\n\}/)[0];

const newRenderTodoTab = `async function renderTodoTab() {
  const container = document.getElementById('todo-list-container');
  if (!container) return;
  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    container.innerHTML = '';
    
    // Filtros
    let filteredTodos = todos;
    if (currentTodoFilter === 'pending') filteredTodos = todos.filter(t => !t.completed);
    if (currentTodoFilter === 'completed') filteredTodos = todos.filter(t => t.completed);

    // Botón de Limpiar Completadas
    const clearBtn = document.getElementById('todo-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = todos.some(t => t.completed) ? 'flex' : 'none';
    }

    if (filteredTodos.length === 0) {
      let emptyMsg = currentTodoFilter === 'completed' ? 'Aún no has completado ninguna tarea.' : 
                    (currentTodoFilter === 'pending' ? 'No tienes tareas pendientes.' : 'Todo limpio por aquí. ¿Qué vas a programar hoy?');
      container.innerHTML = \`<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); opacity:0.7; padding-top:40px;">
        <i data-lucide="layout-list" style="width:48px; height:48px; margin-bottom:16px; opacity:0.5;"></i>
        <span style="font-size:15px; font-weight:500;">\${emptyMsg}</span>
      </div>\`;
    } else {
      filteredTodos.forEach(t => container.appendChild(buildTodoItemHTML(t, false)));
    }
    
    lucide.createIcons();
    renderQuickTodoTab(todos);
  } catch (err) {
    console.error(err);
  }
}`;

renderer = renderer.replace(oldRenderTodoTab, newRenderTodoTab);

// Add Global Keyboard Shortcut for Ctrl+K
if (!renderer.includes('// Ctrl+K Shortcut')) {
  renderer = renderer + `
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
`;
}

// Replace Globals exported at the end
renderer = renderer.replace(/window\.submitTodo = submitTodo;[\s\S]*?(?=\n|$)/, globals.trim());

fs.writeFileSync('./renderer.js', renderer, 'utf8');
console.log("Files updated successfully.");
