const fs = require('fs');

// 1. Update resumen.html
let resumen = fs.readFileSync('./views/resumen.html', 'utf8');
resumen = resumen.replace('<div class="stats-grid">', '<div class="stats-grid" id="widget-kpi">');
resumen = resumen.replace('<!-- Chart 1: Jira (Donut) -->\n        <section class="card">', '<!-- Chart 1: Jira (Donut) -->\n        <section class="card" id="widget-jira">');
resumen = resumen.replace('<!-- Chart 2: Git Status (Horizontal Bars) -->\n        <section class="card">', '<!-- Chart 2: Git Status (Horizontal Bars) -->\n        <section class="card" id="widget-git">');
resumen = resumen.replace('<!-- Chart 3: Actividad (Vertical Bars) -->\n        <section class="card" style="grid-column: span 2;">', '<!-- Chart 3: Actividad (Vertical Bars) -->\n        <section class="card" id="widget-activity" style="grid-column: span 2;">');
fs.writeFileSync('./views/resumen.html', resumen, 'utf8');

// 2. Update configuracion.html
let config = fs.readFileSync('./views/configuracion.html', 'utf8');

const customizationUI = `
        <div class="settings-container">
          <h3>Personalización del Perfil (Visual)</h3>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:15px;">Ajusta el tema y color de acento de tu perfil actual.</p>
          
          <label>Tema Base</label>
          <select id="profile-theme-mode" class="settings-input" onchange="saveAppearanceConfig()">
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
          
          <label style="margin-top:10px;">Color de Acento (Hexadecimal)</label>
          <div style="display:flex; gap:8px;">
            <input type="color" id="profile-accent-color-picker" style="height:38px; width:40px; border:none; padding:0; cursor:pointer;" onchange="document.getElementById('profile-accent-color').value = this.value; saveAppearanceConfig();">
            <input type="text" id="profile-accent-color" class="settings-input" placeholder="#10b981" style="flex:1;" onchange="document.getElementById('profile-accent-color-picker').value = this.value; saveAppearanceConfig();">
          </div>
          
          <label style="margin-top:10px;">Imagen de Fondo (URL o Ruta Local)</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="profile-bg-image" class="settings-input" placeholder="ej. file:///ruta/a/imagen.jpg o https://..." style="flex:1;" onchange="saveAppearanceConfig()">
            <button class="btn-refresh danger" onclick="document.getElementById('profile-bg-image').value=''; saveAppearanceConfig();" title="Limpiar fondo"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
          </div>
        </div>
        
        <div class="settings-container">
          <h3>Widgets del Dashboard (Perfil)</h3>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:15px;">Elige qué métricas se mostrarán en la pestaña Resumen para este perfil.</p>
          <div class="tool-visibility-settings" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <label class="tool-toggle">
              <input type="checkbox" id="widget-visible-kpi" onchange="saveAppearanceConfig()">
              <span><strong>Métricas Rápidas</strong><small>Tarjetas superiores</small></span>
            </label>
            <label class="tool-toggle">
              <input type="checkbox" id="widget-visible-jira" onchange="saveAppearanceConfig()">
              <span><strong>Estado Tareas</strong><small>Donut Chart</small></span>
            </label>
            <label class="tool-toggle">
              <input type="checkbox" id="widget-visible-git" onchange="saveAppearanceConfig()">
              <span><strong>Salud Git</strong><small>Barras Horizontales</small></span>
            </label>
            <label class="tool-toggle">
              <input type="checkbox" id="widget-visible-activity" onchange="saveAppearanceConfig()">
              <span><strong>Actividad</strong><small>Commits en 7 días</small></span>
            </label>
          </div>
        </div>
`;

config = config.replace('        <div class="settings-container">\n          <h3>Icono de la App</h3>', customizationUI + '\n        <div class="settings-container">\n          <h3>Icono de la App (Global)</h3>');
fs.writeFileSync('./views/configuracion.html', config, 'utf8');

console.log('HTML views patched!');
