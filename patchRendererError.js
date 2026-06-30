const fs = require('fs');
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const errorLogger = `
window.addEventListener('error', function(event) {
  const fs = require('fs');
  fs.appendFileSync('./renderer-error.log', new Date().toISOString() + '\\n' + event.error.stack + '\\n\\n');
});
window.addEventListener('unhandledrejection', function(event) {
  const fs = require('fs');
  fs.appendFileSync('./renderer-error.log', new Date().toISOString() + ' (Promise)\\n' + (event.reason ? event.reason.stack : event.reason) + '\\n\\n');
});
`;

if (!renderer.includes('renderer-error.log')) {
  renderer = errorLogger + '\\n' + renderer;
  fs.writeFileSync('./renderer.js', renderer, 'utf8');
}
