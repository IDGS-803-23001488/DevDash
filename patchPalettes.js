const fs = require('fs');

// 1. Modificar HTML
let html = fs.readFileSync('./views/configuracion.html', 'utf8');
const oldColorHTML = `<label style="margin-top:10px;">Color de Acento (Hexadecimal)</label>
          <div style="display:flex; gap:8px;">
            <input type="color" id="profile-accent-color-picker" style="height:38px; width:40px; border:none; padding:0; cursor:pointer;" onchange="document.getElementById('profile-accent-color').value = this.value; saveAppearanceConfig();">
            <input type="text" id="profile-accent-color" class="settings-input" placeholder="#10b981" style="flex:1;" onchange="document.getElementById('profile-accent-color-picker').value = this.value; saveAppearanceConfig();">
          </div>`;
const newColorHTML = `<label style="margin-top:10px;">Paleta de Colores</label>
          <div id="palette-swatches" style="display:flex; gap:12px; margin-top:6px; padding-bottom:4px;">
            <button class="palette-btn" data-palette="emerald" title="Emerald (Defecto)" style="background: linear-gradient(135deg, #10b981, #3b82f6);" onclick="selectPalette('emerald')"></button>
            <button class="palette-btn" data-palette="ocean" title="Ocean Depth" style="background: linear-gradient(135deg, #0ea5e9, #6366f1);" onclick="selectPalette('ocean')"></button>
            <button class="palette-btn" data-palette="sunset" title="Sunset Flare" style="background: linear-gradient(135deg, #f43f5e, #f97316);" onclick="selectPalette('sunset')"></button>
            <button class="palette-btn" data-palette="dracula" title="Dracula (Neon)" style="background: linear-gradient(135deg, #bd93f9, #ff79c6);" onclick="selectPalette('dracula')"></button>
            <button class="palette-btn" data-palette="monochrome" title="Sleek Mono" style="background: linear-gradient(135deg, #475569, #94a3b8);" onclick="selectPalette('monochrome')"></button>
          </div>`;
html = html.replace(oldColorHTML, newColorHTML);
fs.writeFileSync('./views/configuracion.html', html, 'utf8');


// 2. Modificar CSS
let css = fs.readFileSync('./style.css', 'utf8');
const swatchesCSS = `
/* Palette Buttons */
.palette-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border-light);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.palette-btn:hover {
  transform: scale(1.1);
}
.palette-btn.active {
  border-color: var(--text-main);
  box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--text-main);
  transform: scale(1.1);
}
`;
fs.appendFileSync('./style.css', swatchesCSS, 'utf8');


// 3. Modificar ConfigManager
let config = fs.readFileSync('./configManager.js', 'utf8');
config = config.replace("accentColor: profile.customization?.accentColor || '#10b981',", "colorPalette: profile.customization?.colorPalette || 'emerald',");
config = config.replace("accentColor: '#10b981'", "colorPalette: 'emerald'"); // For defaultConfig if it exists there
fs.writeFileSync('./configManager.js', config, 'utf8');


// 4. Modificar renderer.js
let renderer = fs.readFileSync('./renderer.js', 'utf8');

const jsInjections = `
const COLOR_PALETTES = {
  emerald: { primary: '#10b981', info: '#3b82f6', warning: '#f59e0b', secondary: '#8b5cf6' },
  ocean: { primary: '#0ea5e9', info: '#6366f1', warning: '#eab308', secondary: '#14b8a6' },
  sunset: { primary: '#f43f5e', info: '#8b5cf6', warning: '#f97316', secondary: '#db2777' },
  dracula: { primary: '#bd93f9', info: '#8be9fd', warning: '#f1fa8c', secondary: '#ff79c6' },
  monochrome: { primary: '#64748b', info: '#94a3b8', warning: '#cbd5e1', secondary: '#475569' }
};

let currentSelectedPalette = 'emerald';

function selectPalette(id) {
  currentSelectedPalette = id;
  const btns = document.querySelectorAll('.palette-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.palette === id));
  saveAppearanceConfig();
}
window.selectPalette = selectPalette;
`;
renderer += jsInjections;

// Regex para buscar el applyProfileCustomization entero y reemplazar su parte interior
const applyCustomizationRegex = /if \(cust\.accentColor\) \{([\s\S]*?)\} else \{([\s\S]*?)\}/m;

const newApplyCustomization = `
  const paletteId = cust.colorPalette || 'emerald';
  currentSelectedPalette = paletteId;
  const pal = COLOR_PALETTES[paletteId] || COLOR_PALETTES['emerald'];

  document.documentElement.style.setProperty('--accent-green-bg', pal.primary + '20');
  document.documentElement.style.setProperty('--accent-green-text', pal.primary);
  
  document.documentElement.style.setProperty('--accent-blue-bg', pal.info + '20');
  document.documentElement.style.setProperty('--accent-blue-text', pal.info);

  document.documentElement.style.setProperty('--accent-orange-bg', pal.warning + '20');
  document.documentElement.style.setProperty('--accent-orange-text', pal.warning);

  document.documentElement.style.setProperty('--accent-purple-bg', pal.secondary + '20');
  document.documentElement.style.setProperty('--accent-purple-text', pal.secondary);
  
  // Sync palette UI
  const btns = document.querySelectorAll('.palette-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.palette === paletteId));
`;

renderer = renderer.replace(applyCustomizationRegex, newApplyCustomization);

// Reemplazar la parte que guardaba el accentColor
renderer = renderer.replace(
  "const clEl = document.getElementById('profile-accent-color');",
  ""
);
renderer = renderer.replace(
  "if (clEl) profile.customization.accentColor = clEl.value;",
  "profile.customization.colorPalette = currentSelectedPalette;"
);
// Borrar la inicialización del color anterior
renderer = renderer.replace("const clpEl = document.getElementById('profile-accent-color-picker');", "");
renderer = renderer.replace("if (clEl) clEl.value = cust.accentColor || '#10b981';", "");
renderer = renderer.replace("if (clpEl) clpEl.value = cust.accentColor || '#10b981';", "");


fs.writeFileSync('./renderer.js', renderer, 'utf8');

console.log('Premium Color Palettes injected!');
