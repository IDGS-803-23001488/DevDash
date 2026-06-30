const fs = require('fs');

let index = fs.readFileSync('./index.html', 'utf8');

const focusModeHTML = `
  <!-- FOCUS MODE OVERLAY -->
  <div id="focus-mode-overlay" class="hidden" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:#020617; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#f8fafc; font-family:'Inter', sans-serif;">
    
    <!-- Background Lofi Embed (Invisible but active) -->
    <div id="lofi-player-container" style="position:absolute; top:-9999px; left:-9999px; width:1px; height:1px; overflow:hidden; opacity:0;"></div>
    
    <div style="position:absolute; top:40px; right:40px;">
      <button onclick="window.exitFocusMode()" style="background:rgba(255,255,255,0.1); border:none; border-radius:8px; padding:12px 24px; color:#f8fafc; font-size:16px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
        <i data-lucide="log-out"></i> Salir del Enfoque
      </button>
    </div>

    <div style="text-align:center; max-width:800px; width:100%;">
      <div style="margin-bottom:30px; display:inline-flex; background:rgba(255,255,255,0.05); padding:8px; border-radius:100px; gap:8px;">
        <button onclick="window.setPomodoroMode('focus')" id="btn-pomo-focus" style="background:var(--accent); color:#fff; border:none; padding:8px 24px; border-radius:100px; cursor:pointer; font-weight:600; font-size:14px;">Focus (25m)</button>
        <button onclick="window.setPomodoroMode('short')" id="btn-pomo-short" style="background:transparent; color:#94a3b8; border:none; padding:8px 24px; border-radius:100px; cursor:pointer; font-weight:600; font-size:14px;">Short Break (5m)</button>
        <button onclick="window.setPomodoroMode('long')" id="btn-pomo-long" style="background:transparent; color:#94a3b8; border:none; padding:8px 24px; border-radius:100px; cursor:pointer; font-weight:600; font-size:14px;">Long Break (15m)</button>
      </div>
      
      <div id="focus-task-title" style="font-size:24px; color:#cbd5e1; margin-bottom:20px; font-weight:500; letter-spacing:0.5px;">Ninguna tarea seleccionada</div>
      
      <div id="focus-timer-display" style="font-size:160px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1; margin-bottom:40px; text-shadow:0 0 40px rgba(16,185,129,0.2); transition: color 0.3s ease;">25:00</div>
      
      <div style="display:flex; justify-content:center; gap:20px;">
        <button id="btn-pomo-toggle" onclick="window.togglePomodoro()" style="background:#fff; color:#0f172a; border:none; width:80px; height:80px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(255,255,255,0.2); transition:transform 0.2s;">
          <i data-lucide="play" style="width:36px; height:36px; margin-left:6px;"></i>
        </button>
        <button id="btn-pomo-reset" onclick="window.resetPomodoro()" style="background:rgba(255,255,255,0.1); color:#fff; border:none; width:80px; height:80px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
          <i data-lucide="rotate-ccw" style="width:32px; height:32px;"></i>
        </button>
      </div>

      <div style="margin-top:60px;">
        <button id="btn-pomo-lofi" onclick="window.toggleLofi()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#94a3b8; border-radius:100px; padding:10px 24px; cursor:pointer; display:inline-flex; align-items:center; gap:10px; font-size:15px; transition:0.3s;">
          <i data-lucide="headphones"></i> Lofi Radio: Apagado
        </button>
      </div>
    </div>
  </div>
  <!-- END FOCUS MODE -->
`;

if (!index.includes('focus-mode-overlay')) {
  // Insert before </body>
  index = index.replace('</body>', focusModeHTML + '\\n</body>');
  fs.writeFileSync('./index.html', index, 'utf8');
  console.log('Focus mode HTML injected.');
} else {
  console.log('Focus mode already exists.');
}
