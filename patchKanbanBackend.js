const fs = require('fs');

// --- 1. REESCRIBIR todoService.js (Completo) ---
const newTodoService = `
const path = require('path');
const fs = require('fs');

let dbPath = null;
let todosCache = null;
let columnsCache = null;

const defaultColumns = ['Por Hacer', 'En Progreso', 'Completado'];

function initDB(userDataPath) {
  dbPath = path.join(userDataPath, 'todos.json');
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ todos: [], columns: defaultColumns }), 'utf8');
      todosCache = [];
      columnsCache = [...defaultColumns];
    } else {
      const data = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(data);
      todosCache = parsed.todos || [];
      columnsCache = parsed.columns || [...defaultColumns];
      
      // Auto-migrate old tasks
      let migrated = false;
      todosCache.forEach(t => {
        if (t.status === undefined) {
          t.status = t.completed ? 'Completado' : 'Por Hacer';
          migrated = true;
        }
      });
      if (migrated) saveDB();
    }
  } catch (error) {
    console.error('Error initializing JSON DB:', error);
    todosCache = [];
    columnsCache = [...defaultColumns];
  }
}

function saveDB() {
  if (!dbPath) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify({ todos: todosCache, columns: columnsCache }), 'utf8');
  } catch (error) {
    console.error('Error saving JSON DB:', error);
  }
}

function getTodos(profileId) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve([]);
    resolve(todosCache.filter(t => t.profileId === profileId));
  });
}

function getColumns() {
  return new Promise((resolve) => {
    if (!columnsCache) return resolve(defaultColumns);
    resolve(columnsCache);
  });
}

function addColumn(colName) {
  return new Promise((resolve) => {
    if (!columnsCache) columnsCache = [...defaultColumns];
    if (!columnsCache.includes(colName)) {
      columnsCache.push(colName);
      saveDB();
      resolve(true);
    } else resolve(false);
  });
}

function deleteColumn(colName) {
  return new Promise((resolve) => {
    if (!columnsCache) return resolve(false);
    // Don't delete if it's the very first column (we need a fallback)
    if (columnsCache.length <= 1) return resolve(false);
    
    columnsCache = columnsCache.filter(c => c !== colName);
    const fallbackCol = columnsCache[0];
    
    // Move orphaned tasks to fallback
    if (todosCache) {
      todosCache.forEach(t => {
        if (t.status === colName) t.status = fallbackCol;
      });
    }
    saveDB();
    resolve(true);
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
      status: columnsCache[0], // Primera columna
      createdAt: new Date().toISOString(),
      isRunning: false,
      startTime: null,
      totalDuration: 0
    });
    saveDB();
    resolve(newId);
  });
}

function updateTodoStatus(id, newStatus) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo) {
      todo.status = newStatus;
      // Auto-stop timer si se mueve a Completado
      if (newStatus === 'Completado' || newStatus.toLowerCase().includes('done')) {
        if (todo.isRunning) {
          todo.isRunning = false;
          if (todo.startTime) {
            todo.totalDuration += (Date.now() - todo.startTime);
            todo.startTime = null;
          }
        }
      }
      saveDB();
      resolve(true);
    } else resolve(false);
  });
}

// Retro-compatibility helper for toggles (e.g., Quick widget)
function toggleTodo(id, completed) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo) {
      if (completed) {
         todo.status = columnsCache.includes('Completado') ? 'Completado' : columnsCache[columnsCache.length - 1];
         if (todo.isRunning) {
           todo.isRunning = false;
           if (todo.startTime) {
             todo.totalDuration += (Date.now() - todo.startTime);
             todo.startTime = null;
           }
         }
      } else {
         todo.status = columnsCache[0];
      }
      saveDB();
      resolve(true);
    } else resolve(false);
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
    // Borramos todas las tareas que esten en la ultima columna o se llamen Completado
    const targetStatus = columnsCache.includes('Completado') ? 'Completado' : columnsCache[columnsCache.length - 1];
    todosCache = todosCache.filter(t => !(t.profileId === profileId && t.status === targetStatus));
    saveDB();
    resolve(true);
  });
}

function startTimer(id) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo) {
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
  initDB, getTodos, getColumns, addColumn, deleteColumn, updateTodoStatus, addTodo, toggleTodo, deleteTodo, clearCompleted, startTimer, stopTimer
};
`;
fs.writeFileSync('./todoService.js', newTodoService, 'utf8');


// --- 2. MODIFICAR main.js IPC ---
let main = fs.readFileSync('./main.js', 'utf8');
const oldIpcHandler = `case 'stop': return await todoService.stopTimer(payload.id);`;
if (main.includes(oldIpcHandler) && !main.includes("case 'updateStatus'")) {
  main = main.replace(
    oldIpcHandler,
    oldIpcHandler + `\n      case 'updateStatus': return await todoService.updateTodoStatus(payload.id, payload.status);\n      case 'getColumns': return await todoService.getColumns();\n      case 'addColumn': return await todoService.addColumn(payload.colName);\n      case 'deleteColumn': return await todoService.deleteColumn(payload.colName);`
  );
  fs.writeFileSync('./main.js', main, 'utf8');
}
console.log('Backend patched.');
