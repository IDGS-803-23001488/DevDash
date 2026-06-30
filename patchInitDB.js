const fs = require('fs');

let main = fs.readFileSync('./main.js', 'utf8');

if (!main.includes('todoService.initDB')) {
  main = main.replace(
    'app.whenReady().then(() => {',
    "app.whenReady().then(() => {\\n    todoService.initDB(app.getPath('userData'));"
  );
  fs.writeFileSync('./main.js', main, 'utf8');
}
