const fs = require('fs');

// --- 0. ACTUALIZAR .gitignore ---
let gitignore = '';
if (fs.existsSync('./.gitignore')) gitignore = fs.readFileSync('./.gitignore', 'utf8');
if (!gitignore.includes('todo-media/')) {
  gitignore += '\\ntodo-media/\\n';
  fs.writeFileSync('./.gitignore', gitignore, 'utf8');
}

// --- 1. MODIFICAR todoService.js ---
let svc = fs.readFileSync('./todoService.js', 'utf8');

// Añadir description a addTodo
svc = svc.replace(
  /status: columnsCache\[0\],(?: \/\/ Primera columna)?/,
  "status: columnsCache[0],\n      description: '',"
);

// Añadir updateTodoDescription
const updateDescFunc = `
function updateTodoDescription(id, description, title) {
  return new Promise((resolve) => {
    if (!todosCache) return resolve(false);
    const todo = todosCache.find(t => t.id === id);
    if (todo) {
      if (description !== undefined) todo.description = description;
      if (title !== undefined) todo.title = title;
      saveDB();
      resolve(true);
    } else resolve(false);
  });
}
`;
if (!svc.includes('function updateTodoDescription')) {
  svc = svc.replace('module.exports = {', updateDescFunc + '\\nmodule.exports = {');
  svc = svc.replace('updateTodoStatus,', 'updateTodoStatus, updateTodoDescription,');
}
fs.writeFileSync('./todoService.js', svc, 'utf8');

// --- 2. MODIFICAR main.js ---
let main = fs.readFileSync('./main.js', 'utf8');

// Añadir require('path') y require('fs') si faltan a nivel top
if (!main.includes("const path = require('path')")) {
  main = "const path = require('path');\\n" + main;
}
if (!main.includes("const fs = require('fs')")) {
  main = "const fs = require('fs');\\n" + main;
}

// IPC handlers para description y media
const newHandlers = `
      case 'updateDescription': return await todoService.updateTodoDescription(payload.id, payload.description, payload.title);
`;
if (!main.includes("case 'updateDescription'")) {
  main = main.replace("case 'updateStatus':", newHandlers + "      case 'updateStatus':");
}

// Handler para save-todo-media
const mediaHandler = `
ipcMain.handle('save-todo-media', async (event, buffer, extension) => {
  try {
    const mediaDir = path.join(app.getPath('userData'), 'todo-media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    const filename = 'img_' + Date.now() + (extension || '.png');
    const filepath = path.join(mediaDir, filename);
    fs.writeFileSync(filepath, Buffer.from(buffer));
    
    // Devolvemos el path estandarizado a file:/// con slashes adelante para todas las plataformas
    let fileUrl = 'file:///' + filepath.replace(/\\\\/g, '/');
    return fileUrl;
  } catch (err) {
    console.error('Error saving media:', err);
    return null;
  }
});
`;
if (!main.includes('save-todo-media')) {
  main = main.replace('app.whenReady().then', mediaHandler + '\\napp.whenReady().then');
}

fs.writeFileSync('./main.js', main, 'utf8');
console.log('Backend patched for Markdown Editor.');
