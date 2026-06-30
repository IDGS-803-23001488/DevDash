const fs = require('fs');

let main = fs.readFileSync('./main.js', 'utf8');

const handler = `
// --- TODO ACTION HANDLER ---
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
    console.error('Todo Error:', err);
    return { error: err.message };
  }
});
`;

if (!main.includes('todo-action')) {
  fs.appendFileSync('./main.js', '\\n' + handler, 'utf8');
}
