const fs = require('fs');

// --- 1. MODIFICAR todo.html ---
let html = fs.readFileSync('./views/todo.html', 'utf8');

// Quitar gradientes y reducir bordes
html = html.replace(/border-radius: 12px;/g, 'border-radius: 4px;');
html = html.replace(/border-radius: 8px;/g, 'border-radius: 4px;');
html = html.replace(/border-radius: 6px;/g, 'border-radius: 2px;');
html = html.replace(/background: linear-gradient\\([^)]+\\)/g, 'background: var(--accent)');

fs.writeFileSync('./views/todo.html', html, 'utf8');


// --- 2. MODIFICAR renderer.js ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

// Columnas
renderer = renderer.replace(/colDiv\.style\.borderRadius = '12px';/g, "colDiv.style.borderRadius = '4px';");

// Tarjetas
renderer = renderer.replace(/card\.style\.borderRadius = '10px';/g, "card.style.borderRadius = '4px';");

// Boton Nueva Columna
renderer = renderer.replace(/addColBtn\.style\.borderRadius = '12px';/g, "addColBtn.style.borderRadius = '4px';");

// Badges y botones (Play/Stop/Ctrl+K)
renderer = renderer.replace(/badge\.style\.borderRadius = '6px';/g, "badge.style.borderRadius = '2px';");
renderer = renderer.replace(/stopBtn\.style\.borderRadius = '6px';/g, "stopBtn.style.borderRadius = '2px';");
renderer = renderer.replace(/playBtn\.style\.borderRadius = '6px';/g, "playBtn.style.borderRadius = '2px';");

// Quitar el gradient de resumen si existe (aunque el usuario decia del Todo, el widget rapido de Resumen tenia gradient pero lo habia sobreescrito con glassmorphism antes. Chequearemos si hay gradients aqui)
renderer = renderer.replace(/background: linear-gradient\\([^)]+\\)/g, "background: var(--accent)");

fs.writeFileSync('./renderer.js', renderer, 'utf8');

// Quick TODO widget on resumen.html
try {
  let resumen = fs.readFileSync('./views/resumen.html', 'utf8');
  resumen = resumen.replace(/background: linear-gradient\\([^)]+\\)/g, 'background: var(--bg-panel)');
  resumen = resumen.replace(/border-radius: 8px;/g, 'border-radius: 4px;');
  fs.writeFileSync('./views/resumen.html', resumen, 'utf8');
} catch (e) {}

console.log('Flat style applied.');
