const fs = require('fs');

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
`;

if (!renderer.includes('window.submitTodo = submitTodo;')) {
  renderer += '\\n' + globals;
  fs.writeFileSync('./renderer.js', renderer, 'utf8');
}
