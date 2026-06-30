const fs = require('fs');

let renderer = fs.readFileSync('./renderer.js', 'utf8');

// 1. Add "Focus" button in Kanban Cards
const todoHtmlInsertionPoint = /const playBtn = document\.createElement\('button'\);/g;
if (!renderer.includes('focusBtn = document.createElement')) {
  renderer = renderer.replace(
    /const playBtn = document\.createElement\('button'\);[\s\S]*?playBtn\.onclick = \(\) => window\.startTodoTimer\(t\.id\);/g,
    `$&
      const focusBtn = document.createElement('button');
      focusBtn.className = 'todo-action-btn focus-btn';
      focusBtn.innerHTML = '<i data-lucide="crosshair"></i>';
      focusBtn.title = 'Modo Enfoque';
      focusBtn.onclick = () => window.openFocusMode(t.id, t.title);`
  );
  
  // also inject the focusBtn into the actions div
  renderer = renderer.replace(
    /actions\.appendChild\(playBtn\);/g,
    `actions.appendChild(playBtn);
      actions.appendChild(focusBtn);`
  );
}

// 2. Inject Pomodoro Logic at the end of renderer.js
const pomodoroLogic = `
// --- POMODORO & FOCUS MODE LOGIC ---
let pomoTimer = null;
let pomoTimeLeft = 25 * 60; // 25 mins
let pomoCurrentState = 'focus';
let pomoIsRunning = false;
let pomoActiveTodoId = null;
let pomoLofiEnabled = false;
let pomoAccumulatedMs = 0;
let pomoLastTick = 0;

const POMO_TIMES = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

window.openFocusMode = (id, title) => {
  pomoActiveTodoId = id;
  document.getElementById('focus-task-title').textContent = title || 'Sesión de Enfoque';
  document.getElementById('focus-mode-overlay').classList.remove('hidden');
  window.setPomodoroMode('focus');
  lucide.createIcons();
};

window.exitFocusMode = async () => {
  if (pomoIsRunning) window.togglePomodoro(); // Pausa y guarda
  document.getElementById('focus-mode-overlay').classList.add('hidden');
  pomoActiveTodoId = null;
  renderTodoTab(); // refrescar tab para actualizar totalDuration visual
};

window.setPomodoroMode = (mode) => {
  if (pomoIsRunning) window.togglePomodoro(); // pause if switching modes
  
  pomoCurrentState = mode;
  pomoTimeLeft = POMO_TIMES[mode];
  updatePomodoroDisplay();

  // Update styles
  ['focus', 'short', 'long'].forEach(m => {
    const btn = document.getElementById('btn-pomo-' + m);
    if (m === mode) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#94a3b8';
    }
  });
};

window.togglePomodoro = async () => {
  const btn = document.getElementById('btn-pomo-toggle');
  
  if (pomoIsRunning) {
    // Pausing
    clearInterval(pomoTimer);
    pomoIsRunning = false;
    btn.innerHTML = '<i data-lucide="play" style="width:36px; height:36px; margin-left:6px;"></i>';
    document.getElementById('focus-timer-display').style.color = '#f8fafc';
    document.getElementById('focus-timer-display').style.textShadow = '0 0 40px rgba(16,185,129,0.2)';
    
    // Save accumulated time
    if (pomoAccumulatedMs > 0 && pomoActiveTodoId) {
      await ipcRenderer.invoke('todo-action', 'addDuration', { id: pomoActiveTodoId, duration: pomoAccumulatedMs });
      pomoAccumulatedMs = 0;
    }
  } else {
    // Starting
    pomoIsRunning = true;
    pomoLastTick = Date.now();
    btn.innerHTML = '<i data-lucide="pause" style="width:36px; height:36px;"></i>';
    document.getElementById('focus-timer-display').style.color = '#22c55e'; // Green
    
    pomoTimer = setInterval(() => {
      const now = Date.now();
      const delta = now - pomoLastTick;
      pomoLastTick = now;
      
      if (pomoCurrentState === 'focus') {
        pomoAccumulatedMs += delta;
      }
      
      // We subtract 1 second approx for display logic
      pomoTimeLeft--;
      updatePomodoroDisplay();
      
      if (pomoTimeLeft <= 0) {
        clearInterval(pomoTimer);
        pomoIsRunning = false;
        btn.innerHTML = '<i data-lucide="play" style="width:36px; height:36px; margin-left:6px;"></i>';
        
        // Auto-save on complete
        if (pomoAccumulatedMs > 0 && pomoActiveTodoId) {
          ipcRenderer.invoke('todo-action', 'addDuration', { id: pomoActiveTodoId, duration: pomoAccumulatedMs });
          pomoAccumulatedMs = 0;
        }
        
        // Send notification
        new Notification('DevDash Focus', { body: \`Ciclo completado (\${pomoCurrentState}). ¡Buen trabajo!\` });
      }
    }, 1000);
  }
  lucide.createIcons();
};

window.resetPomodoro = async () => {
  if (pomoIsRunning) window.togglePomodoro(); // This will pause and save
  pomoTimeLeft = POMO_TIMES[pomoCurrentState];
  updatePomodoroDisplay();
};

function updatePomodoroDisplay() {
  const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
  const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
  document.getElementById('focus-timer-display').textContent = \`\${m}:\${s}\`;
}

window.toggleLofi = () => {
  const container = document.getElementById('lofi-player-container');
  const btn = document.getElementById('btn-pomo-lofi');
  pomoLofiEnabled = !pomoLofiEnabled;
  
  if (pomoLofiEnabled) {
    // Lofi Girl live stream youtube embed
    container.innerHTML = '<iframe width="100" height="100" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>';
    btn.innerHTML = '<i data-lucide="headphones"></i> Lofi Radio: Encendido';
    btn.style.color = '#22c55e';
    btn.style.borderColor = '#22c55e';
  } else {
    container.innerHTML = '';
    btn.innerHTML = '<i data-lucide="headphones"></i> Lofi Radio: Apagado';
    btn.style.color = '#94a3b8';
    btn.style.borderColor = 'rgba(255,255,255,0.2)';
  }
  lucide.createIcons();
};
`;

if (!renderer.includes('POMODORO & FOCUS MODE LOGIC')) {
  fs.writeFileSync('./renderer.js', renderer + '\\n' + pomodoroLogic, 'utf8');
  console.log('Pomodoro logic injected in renderer.js');
} else {
  console.log('Pomodoro logic already exists');
}
