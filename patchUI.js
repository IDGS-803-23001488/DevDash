const fs = require('fs');

// 1. Mejorar resumen.html (el widget)
let resumen = fs.readFileSync('./views/resumen.html', 'utf8');

const newWidget = `
        <!-- Chart 4: Quick To-Do (Timers) -->
        <section class="card widget-half dashboard-widget" id="widget-todo" draggable="true" style="background: linear-gradient(145deg, var(--bg-panel), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(16, 185, 129, 0.15); box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px);">
          <div class="card-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
            <h2 class="card-title" style="color: var(--accent); font-weight: 600;">
              <i data-lucide="check-circle" style="width:20px; height:20px; color: var(--accent);"></i>
              Acceso Rápido: Tareas
            </h2>
          </div>
          <div style="display:flex; flex-direction:column; padding: 16px; height:240px; overflow:hidden;">
            <!-- Input Area -->
            <div style="display:flex; gap:10px; margin-bottom:16px; position:relative;">
              <input type="text" id="todo-quick-input" class="settings-input" style="flex:1; padding:10px 14px; font-size:14px; border-radius: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-light); color: var(--text-main); outline:none; transition: all 0.3s ease;" placeholder="¿Qué necesitas completar ahora? (Enter)" onfocus="this.style.borderColor='var(--accent)';" onblur="this.style.borderColor='var(--border-light)';" onkeydown="if(event.key === 'Enter') { event.preventDefault(); window.submitQuickTodo(); }">
              <button class="update-btn" onclick="window.submitQuickTodo()" style="padding:0 16px; border-radius: 8px; background: var(--accent); color: #fff; font-weight:bold; border:none; cursor:pointer; transition: transform 0.1s;" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1)'">
                <i data-lucide="plus" style="width:18px;height:18px;"></i>
              </button>
            </div>
            
            <!-- List Area -->
            <div id="quick-todo-list" style="flex:1; overflow-y:auto; font-size:13px; padding-right:4px;">
              <!-- render quick list -->
            </div>
          </div>
        </section>
`;

// Reemplazar el viejo widget por este.
// Usamos regex o búsqueda exacta
const startSearch = '<!-- Chart 4: Quick To-Do (Timers) -->';
const endSearch = '</section>';

if (resumen.includes(startSearch)) {
  const parts = resumen.split(startSearch);
  const before = parts[0];
  const afterSection = parts[1].substring(parts[1].indexOf(endSearch) + endSearch.length);
  resumen = before + newWidget + afterSection;
  fs.writeFileSync('./views/resumen.html', resumen, 'utf8');
}

// 2. Modificar el renderer.js para que buildTodoItemHTML se vea super premium y no solo blanco y negro
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const oldBuildFuncStart = 'function buildTodoItemHTML(t, isQuick = false) {';
const oldBuildFuncEnd = '  return el;\n}';

if (renderer.includes(oldBuildFuncStart)) {
  const newBuildFunc = `
function buildTodoItemHTML(t, isQuick = false) {
  const el = document.createElement('div');
  el.className = 'repo-item';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '10px';
  el.style.opacity = t.completed ? '0.5' : '1';
  el.style.padding = isQuick ? '8px 12px' : '12px 18px';
  el.style.marginBottom = '8px';
  el.style.borderRadius = '8px';
  el.style.background = t.isRunning ? 'rgba(16, 185, 129, 0.08)' : (t.completed ? 'rgba(0,0,0,0.1)' : 'var(--bg-panel)');
  el.style.border = t.isRunning ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-light)';
  el.style.transition = 'all 0.2s ease';
  
  // Efecto hover
  el.onmouseover = () => el.style.borderColor = 'var(--text-muted)';
  el.onmouseout = () => el.style.borderColor = t.isRunning ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)';
  
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = t.completed === 1;
  chk.style.cursor = 'pointer';
  chk.style.width = '16px';
  chk.style.height = '16px';
  chk.style.accentColor = 'var(--accent)';
  chk.onchange = () => window.toggleTodoItem(t.id, chk.checked);
  
  const txt = document.createElement('span');
  txt.textContent = t.title;
  txt.style.flex = '1';
  txt.style.fontSize = isQuick ? '13px' : '14px';
  txt.style.textDecoration = t.completed ? 'line-through' : 'none';
  txt.style.color = t.completed ? 'var(--text-muted)' : (t.isRunning ? 'var(--accent)' : 'var(--text-main)');
  txt.style.fontWeight = t.isRunning ? '500' : '400';
  txt.style.whiteSpace = 'nowrap';
  txt.style.overflow = 'hidden';
  txt.style.textOverflow = 'ellipsis';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.alignItems = 'center';
  controls.style.gap = '6px';

  let currentMs = t.totalDuration || 0;
  if (t.isRunning && t.startTime) {
    currentMs += (Date.now() - t.startTime);
  }

  if (!t.completed) {
    if (currentMs > 0 || t.isRunning) {
      const badge = document.createElement('span');
      badge.className = 'todo-timer-badge';
      badge.dataset.id = t.id;
      badge.dataset.start = t.startTime || '';
      badge.dataset.duration = t.totalDuration || 0;
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '600';
      badge.style.letterSpacing = '0.5px';
      badge.style.padding = '3px 8px';
      badge.style.borderRadius = '12px';
      badge.style.background = t.isRunning ? 'var(--accent)' : 'rgba(0,0,0,0.2)';
      badge.style.color = t.isRunning ? '#fff' : 'var(--text-muted)';
      badge.style.border = '1px solid ' + (t.isRunning ? 'transparent' : 'var(--border-light)');
      badge.style.marginRight = '4px';
      badge.style.boxShadow = t.isRunning ? '0 0 10px rgba(16,185,129,0.3)' : 'none';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }

    if (t.isRunning) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn-refresh danger';
      stopBtn.innerHTML = '<i data-lucide="square" style="width:14px;height:14px;"></i>';
      stopBtn.onclick = () => window.stopTodoTimer(t.id);
      stopBtn.title = 'Pausar Timer';
      stopBtn.style.background = 'rgba(239, 68, 68, 0.1)';
      stopBtn.style.color = '#ef4444';
      controls.appendChild(stopBtn);
    } else {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn-refresh';
      playBtn.innerHTML = '<i data-lucide="play" style="width:14px;height:14px; fill:currentColor;"></i>';
      playBtn.onclick = () => window.startTodoTimer(t.id);
      playBtn.title = 'Iniciar Timer';
      playBtn.style.color = '#10b981';
      playBtn.style.background = 'rgba(16, 185, 129, 0.1)';
      controls.appendChild(playBtn);
    }
  } else {
    if (currentMs > 0) {
      const badge = document.createElement('span');
      badge.style.fontSize = '12px';
      badge.style.color = 'var(--text-muted)';
      badge.style.marginRight = '4px';
      badge.style.fontFamily = 'monospace';
      badge.textContent = formatDuration(currentMs);
      controls.appendChild(badge);
    }
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-refresh danger';
  delBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
  delBtn.onclick = () => window.deleteTodoItem(t.id);
  delBtn.title = 'Eliminar';
  controls.appendChild(delBtn);

  el.appendChild(chk);
  el.appendChild(txt);
  el.appendChild(controls);

  return el;
}
`;

  // Cambiar el viejo renderQuickTodoTab error state a uno mas estetico
  renderer = renderer.replace(
    "'<div style=\"color:var(--text-muted); font-size:12px; text-align:center; margin-top:20px;\">Sin pendientes urgentes.</div>'",
    "'<div style=\"display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); opacity:0.6;\"><i data-lucide=\"coffee\" style=\"width:32px; height:32px; margin-bottom:10px;\"></i><span style=\"font-size:13px; font-weight:500;\">Todo al día. Tómate un café.</span></div>'"
  );

  const parts = renderer.split(oldBuildFuncStart);
  const afterSection = parts[1].substring(parts[1].indexOf(oldBuildFuncEnd) + oldBuildFuncEnd.length);
  renderer = parts[0] + newBuildFunc + afterSection;
  fs.writeFileSync('./renderer.js', renderer, 'utf8');
}

console.log('UI Patched successfully');
