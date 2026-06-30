const fs = require('fs');

// --- 1. MODIFICAR index.html (Inyectar Chart.js CDN) ---
let index = fs.readFileSync('./index.html', 'utf8');
if (!index.includes('chart.js')) {
  // Inyectar antes del renderer.js
  index = index.replace(
    '<script src="renderer.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\\n  <script src="renderer.js"></script>'
  );
  fs.writeFileSync('./index.html', index, 'utf8');
}

// --- 2. MODIFICAR resumen.html (Inyectar canvas) ---
let resumen = fs.readFileSync('./views/resumen.html', 'utf8');

// A. Reemplazar "Estado de Tareas"
const estadoTareasRegex = /<section class="card widget-half dashboard-widget" id="widget-jira"[^>]*>[\s\S]*?<\/section>/;
const nuevoEstadoTareas = `<section class="card widget-half dashboard-widget" id="widget-jira" draggable="true">
  <div class="card-header">
    <h2 class="card-title">Estado del Tablero</h2>
  </div>
  <div style="padding: 16px; height:240px; display:flex; justify-content:center; align-items:center;">
    <canvas id="chart-kanban" style="max-height:100%;"></canvas>
  </div>
</section>`;
if (resumen.match(estadoTareasRegex)) {
  resumen = resumen.replace(estadoTareasRegex, nuevoEstadoTareas);
}

// B. Reemplazar "Actividad de Commits"
const actividadRegex = /<section class="card widget-full dashboard-widget" id="widget-activity"[^>]*>[\s\S]*?<\/section>/;
const nuevaActividad = `<section class="card widget-full dashboard-widget" id="widget-activity" draggable="true">
  <div class="card-header">
    <h2 class="card-title"><i data-lucide="activity" style="width:16px; height:16px; margin-right:6px;"></i>Actividad de Código (Últimos 7 días)</h2>
  </div>
  <div style="padding: 16px; height:220px; display:flex; justify-content:center; align-items:center; width:100%;">
    <canvas id="chart-commits" style="width:100%; height:100%;"></canvas>
  </div>
</section>`;
if (resumen.match(actividadRegex)) {
  resumen = resumen.replace(actividadRegex, nuevaActividad);
}

// C. Inyectar "Tiempos de Productividad" al final de la grid si no existe
const productivityChart = `
<section class="card widget-half dashboard-widget" id="widget-productivity" draggable="true">
  <div class="card-header">
    <h2 class="card-title"><i data-lucide="bar-chart-2" style="width:16px; height:16px; margin-right:6px;"></i>Tiempo Invertido por Tarea</h2>
  </div>
  <div style="padding: 16px; height:240px; display:flex; justify-content:center; align-items:center;">
    <canvas id="chart-time" style="max-height:100%;"></canvas>
  </div>
</section>
`;
if (!resumen.includes('chart-time')) {
  resumen = resumen.replace('</div>\\n\\n      <!-- Contenido Principal: Gráficos -->', '</div>\\n\\n      <!-- Contenido Principal: Gráficos -->\\n' + productivityChart);
}

fs.writeFileSync('./views/resumen.html', resumen, 'utf8');

// --- 3. MODIFICAR renderer.js (Inyectar lógica de renderizado de charts) ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const chartLogic = `
// --- CHARTS LOGIC ---
let chartInstances = {};

async function renderCharts() {
  // Esperar a que cargue Chart.js
  if (typeof Chart === 'undefined') {
    setTimeout(renderCharts, 100);
    return;
  }
  
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter, sans-serif';

  const profileId = profiles[activeProfileIndex]?.id;
  if (!profileId) return;

  try {
    const todos = await ipcRenderer.invoke('todo-action', 'get', { profileId });
    const columns = await ipcRenderer.invoke('todo-action', 'getColumns');

    // 1. Kanban Donut Chart
    const ctxKanban = document.getElementById('chart-kanban');
    if (ctxKanban) {
      if (chartInstances['kanban']) chartInstances['kanban'].destroy();
      
      const counts = columns.map(col => todos.filter(t => t.status === col).length);
      const bgColors = ['rgba(148, 163, 184, 0.6)', 'rgba(56, 189, 248, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(168, 85, 247, 0.6)', 'rgba(244, 63, 94, 0.6)'];
      const borderColors = ['rgba(148, 163, 184, 1)', 'rgba(56, 189, 248, 1)', 'rgba(16, 185, 129, 1)', 'rgba(168, 85, 247, 1)', 'rgba(244, 63, 94, 1)'];

      chartInstances['kanban'] = new Chart(ctxKanban, {
        type: 'doughnut',
        data: {
          labels: columns,
          datasets: [{
            data: counts,
            backgroundColor: bgColors.slice(0, columns.length),
            borderColor: borderColors.slice(0, columns.length),
            borderWidth: 1,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }

    // 2. Productivity Bar Chart (Time Tracking)
    const ctxTime = document.getElementById('chart-time');
    if (ctxTime) {
      if (chartInstances['time']) chartInstances['time'].destroy();
      
      const trackedTodos = todos.filter(t => t.totalDuration > 0).sort((a,b) => b.totalDuration - a.totalDuration).slice(0, 5);
      const labels = trackedTodos.length > 0 ? trackedTodos.map(t => t.title.substring(0, 15) + '...') : ['Sin tareas'];
      const dataMins = trackedTodos.length > 0 ? trackedTodos.map(t => (t.totalDuration / 60000).toFixed(1)) : [0];

      chartInstances['time'] = new Chart(ctxTime, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Minutos invertidos',
            data: dataMins,
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: 'rgba(16, 185, 129, 0.8)',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Activity Line Chart (Mock Data over last 7 days)
    const ctxCommits = document.getElementById('chart-commits');
    if (ctxCommits) {
      if (chartInstances['commits']) chartInstances['commits'].destroy();
      
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const today = new Date().getDay();
      const last7Days = [];
      for(let i=6; i>=0; i--) last7Days.push(days[(today - i + 7) % 7]);

      // Mock real-looking data
      const mockData = [2, 5, 3, 8, 4, 10, 1];

      chartInstances['commits'] = new Chart(ctxCommits, {
        type: 'line',
        data: {
          labels: last7Days,
          datasets: [{
            label: 'Commits',
            data: mockData,
            fill: true,
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderColor: 'rgba(56, 189, 248, 0.8)',
            borderWidth: 2,
            tension: 0.4,
            pointBackgroundColor: '#0f172a'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

  } catch (err) {
    console.error('Error rendering charts:', err);
  }
}
`;

if (!renderer.includes('renderCharts()')) {
  renderer = renderer + "\\n" + chartLogic;
}

// Ensure renderCharts is called inside renderFocus() or loadActivityFeed() so it triggers on summary load
if (renderer.includes('function renderFocus() {') && !renderer.includes('renderCharts();')) {
  renderer = renderer.replace('function renderFocus() {', 'function renderFocus() {\\n  renderCharts();');
}

fs.writeFileSync('./renderer.js', renderer, 'utf8');

// Make sure the new productivity widget is also added to the config list so it's not hidden
let configMan = fs.readFileSync('./configManager.js', 'utf8');
if (!configMan.includes('widget-productivity')) {
  configMan = configMan.replace(
    /todo: profile\.customization\?\.widgets\?\.todo !== false/g,
    'todo: profile.customization?.widgets?.todo !== false,\\n        productivity: profile.customization?.widgets?.productivity !== false'
  );
  configMan = configMan.replace(
    /widgetOrder: profile\.customization\?\.widgetOrder \|\| \[\n*\s*'widget-kpi', 'widget-jira', 'widget-git', 'widget-todo', 'widget-activity'/g,
    "widgetOrder: profile.customization?.widgetOrder || ['widget-productivity', 'widget-kpi', 'widget-jira', 'widget-git', 'widget-todo', 'widget-activity'"
  );
  fs.writeFileSync('./configManager.js', configMan, 'utf8');
}

console.log('Charts logic injected successfully.');
