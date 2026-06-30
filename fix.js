const fs = require('fs');

const files = [
  './components/RepoCard.js',
  './components/JiraCard.js',
  './components/WorkspaceCard.js',
  './components/utils.js'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Reemplazar \` por `
  content = content.replace(/\\`/g, '`');
  // Reemplazar \${ por ${
  content = content.replace(/\\\${/g, '${');
  fs.writeFileSync(file, content, 'utf8');
});

console.log('Fixed syntax errors in all components.');
