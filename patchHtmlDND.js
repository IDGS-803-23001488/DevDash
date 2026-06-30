const fs = require('fs');

let resumen = fs.readFileSync('./views/resumen.html', 'utf8');

// 1. Quitar los tags sueltos y reemplazarlos por los de draggable
resumen = resumen.replace('<!-- Estadísticas KPI -->', '<div id="dashboard-widgets-container" class="dashboard-dnd-grid">\n      <!-- Estadísticas KPI -->');
resumen = resumen.replace('<div class="stats-grid" id="widget-kpi">', '<div class="stats-grid widget-full dashboard-widget" id="widget-kpi" draggable="true">');
resumen = resumen.replace('<div class="dashboard-charts" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 10px;">', '');
resumen = resumen.replace('<section class="card" id="widget-jira">', '<section class="card widget-half dashboard-widget" id="widget-jira" draggable="true">');
resumen = resumen.replace('<section class="card" id="widget-git">', '<section class="card widget-half dashboard-widget" id="widget-git" draggable="true">');
resumen = resumen.replace('<section class="card" id="widget-activity" style="grid-column: span 2;">', '<section class="card widget-full dashboard-widget" id="widget-activity" draggable="true">');

// Reemplazar el ultimo </div> de dashboard-charts que quité (ya que borre el <div> anterior que lo abria).
// O mas facil, como envolví TODO en <div id="dashboard-widgets-container">, el ultimo </div> que cerraba dashboard-charts ahora cierra dashboard-widgets-container.

fs.writeFileSync('./views/resumen.html', resumen, 'utf8');
console.log('HTML updated for DND');
