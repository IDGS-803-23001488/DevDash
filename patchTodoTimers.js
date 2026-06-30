const fs = require('fs');

// --- 1. MODIFICAR todoService.js ---
const todoServiceContent = `
const path = require('path');
const fs = require('fs');

let dbPath = null;
let todosCache = null;

function initDB(userDataPath) {
  dbPath = path.join(userDataPath, 'todos.json');
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ todos: [] }), 'utf8');
      todosCache = [];
    } else {
      const data = fs.readFileSync(dbPath, 'utf8');
      todosCache = JSON.parse(data).todos || [];
    }
  } catch (error) {
    console.error('Error initializing JSON DB:', error);
    todosCache = [];
  }
}

function saveDB() {
  if (!dbPath) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify({ todos: todosCache }), 'utf8');
  } catch (error) {
    console.error('Error saving JSON DB:', error);
  }
}

function getTodos(profileId) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve([]);
    const filtered = todosCache.filter(t => t.profileId === profileId);
    filtered.sort((a, b) => {
      if (a.completed === b.completed) return b.id - a.id;
      return a.completed ? 1 : -1;
    });
    resolve(filtered);
  });
}

function addTodo(profileId, title) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(null);
    const newId = todosCache.length > 0 ? Math.max(...todosCache.map(t => t.id)) + 1 : 1;
    todosCache.push({
      id: newId,
      profileId,
      title,
      completed: 0,
      createdAt: new Date().toISOString(),
      isRunning: false,
      startTime: null,
      totalDuration: 0 // en milisegundos
    });
    saveDB();
    resolve(newId);
  });
}

function toggleTodo(id, completed) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo) {
      todo.completed = completed ? 1 : 0;
      if (todo.completed === 1 && todo.isRunning) {
        // Detener timer si se completa
        todo.isRunning = false;
        if (todo.startTime) {
          todo.totalDuration += (Date.now() - todo.startTime);
          todo.startTime = null;
        }
      }
      saveDB();
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

function deleteTodo(id) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    todosCache = todosCache.filter(t => t.id !== id);
    saveDB();
    resolve(true);
  });
}

function clearCompleted(profileId) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    todosCache = todosCache.filter(t => !(t.profileId === profileId && t.completed === 1));
    saveDB();
    resolve(true);
  });
}

function startTimer(id) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo && !todo.completed) {
      todo.isRunning = true;
      todo.startTime = Date.now();
      saveDB();
      resolve(true);
    } else resolve(false);
  });
}

function stopTimer(id) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo && todo.isRunning) {
      todo.isRunning = false;
      if (todo.startTime) {
        todo.totalDuration += (Date.now() - todo.startTime);
        todo.startTime = null;
      }
      saveDB();
      resolve(true);
    } else resolve(false);
  });
}

module.exports = {
  initDB, getTodos, addTodo, toggleTodo, deleteTodo, clearCompleted, startTimer, stopTimer
};
`;
fs.writeFileSync('./todoService.js', todoServiceContent, 'utf8');

// --- 2. MODIFICAR main.js ---
let main = fs.readFileSync('./main.js', 'utf8');
if (!main.includes('todoService.initDB')) {
  main = main.replace(
    "const userDataPath = app.getPath('userData');",
    "const userDataPath = app.getPath('userData');\n  todoService.initDB(userDataPath);"
  );
}

if (!main.includes('todo-action')) {
  const handler = `
ipcMain.handle('todo-action', async (event, action, payload) => {
  try {
    switch (action) {
      case 'get': return await todoService.getTodos(payload.profileId);
      case 'add': return await todoService.addTodo(payload.profileId, payload.title);
      case 'toggle': return await todoService.toggleTodo(payload.id, payload.completed);
      case 'delete': return await todoService.deleteTodo(payload.id);
      case 'clear': return await todoService.clearCompleted(payload.profileId);
      case 'start': return await todoService.startTimer(payload.id);
      case 'stop': return await todoService.stopTimer(payload.id);
      default: return null;
    }
  } catch (err) {
    return { error: err.message };
  }
});
`;
  main = main.replace("app.on('window-all-closed'", handler + "\napp.on('window-all-closed'");
}
fs.writeFileSync('./main.js', main, 'utf8');

// --- 3. MODIFICAR resumen.html ---
let resumen = fs.readFileSync('./views/resumen.html', 'utf8');
const widgetTodo = `
        <!-- Chart 4: Quick To-Do (Timers) -->
        <section class="card widget-half dashboard-widget" id="widget-todo" draggable="true">
          <div class="card-header">
            <h2 class="card-title">
              <i data-lucide="check-square" style="width:20px; height:20px;"></i>
              Tareas y Tiempos
            </h2>
          </div>
          <div style="display:flex; flex-direction:column; padding: 10px 16px; height:220px; overflow:hidden;">
            <div style="display:flex; gap:8px; margin-bottom:10px;">
              <input type="text" id="todo-quick-input" class="settings-input" style="flex:1; padding:6px 10px; font-size:13px;" placeholder="Nueva tarea rápida..." onkeydown="if(event.key === 'Enter') submitQuickTodo()">
              <button class="update-btn" onclick="submitQuickTodo()" style="padding:0 12px; height:32px;">+</button>
            </div>
            <div id="quick-todo-list" style="flex:1; overflow-y:auto; font-size:13px;">
              <!-- render quick list -->
            </div>
          </div>
        </section>
`;
if (!resumen.includes('widget-todo')) {
  resumen = resumen.replace("</div>\n\n      <!-- Contenido Principal: Gráficos -->", "</div>\n\n      <!-- Contenido Principal: Gráficos -->\n" + widgetTodo);
  fs.writeFileSync('./views/resumen.html', resumen, 'utf8');
}

// --- 4. MODIFICAR configuracion.html ---
let config = fs.readFileSync('./views/configuracion.html', 'utf8');
const todoToggle = `
            <label class="tool-toggle">
              <input type="checkbox" id="widget-visible-todo" onchange="saveAppearanceConfig()">
              <span><strong>Tareas y Tiempos</strong><small>Lista y Temporizadores</small></span>
            </label>
`;
if (!config.includes('widget-visible-todo')) {
  config = config.replace('<label class="tool-toggle">\n              <input type="checkbox" id="widget-visible-activity"', todoToggle + '\n            <label class="tool-toggle">\n              <input type="checkbox" id="widget-visible-activity"');
  fs.writeFileSync('./views/configuracion.html', config, 'utf8');
}

// --- 5. MODIFICAR configManager.js ---
let configMan = fs.readFileSync('./configManager.js', 'utf8');
if (!configMan.includes('todo: profile.customization?.widgets?.todo !== false')) {
  configMan = configMan.replace(
    "activity: profile.customization?.widgets?.activity !== false\n      }",
    "activity: profile.customization?.widgets?.activity !== false,\n        todo: profile.customization?.widgets?.todo !== false\n      }"
  );
  configMan = configMan.replace(
    "['widget-kpi', 'widget-jira', 'widget-git', 'widget-activity']",
    "['widget-kpi', 'widget-jira', 'widget-git', 'widget-todo', 'widget-activity']"
  );
  fs.writeFileSync('./configManager.js', configMan, 'utf8');
}

console.log('All files patched successfully');
