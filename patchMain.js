const fs = require('fs');

let main = fs.readFileSync('./main.js', 'utf8');

// 1. Agregar el import de todoService
main = main.replace(
  "const fs = require('fs');",
  "const fs = require('fs');\nconst todoService = require('./todoService');"
);

// 2. Inicializar base de datos en app.whenReady (después de configurar userDataPath)
main = main.replace(
  "const rawConfig = fs.readFileSync(configPath, 'utf8');",
  "const rawConfig = fs.readFileSync(configPath, 'utf8');\n  \n  // Init DB\n  todoService.initDB(userDataPath);"
);

// 3. Añadir el ipcMain.handle para todo-action al final de los handlers
const handlers = `
ipcMain.handle('todo-action', async (event, action, payload) => {
  try {
    switch (action) {
      case 'get':
        return await todoService.getTodos(payload.profileId);
      case 'add':
        return await todoService.addTodo(payload.profileId, payload.title);
      case 'toggle':
        return await todoService.toggleTodo(payload.id, payload.completed);
      case 'delete':
        return await todoService.deleteTodo(payload.id);
      case 'clear':
        return await todoService.clearCompleted(payload.profileId);
      default:
        return null;
    }
  } catch (error) {
    console.error('Todo DB Error:', error);
    return { error: error.message };
  }
});
`;

// Si main no tiene todo-action aún, lo agregamos al final del archivo antes del window-all-closed o similar
// O lo metemos antes de "app.on('window-all-closed', () => {"
main = main.replace("app.on('window-all-closed', () => {", handlers + "\n\napp.on('window-all-closed', () => {");

fs.writeFileSync('./main.js', main, 'utf8');
console.log('main.js patched with todo handlers!');
