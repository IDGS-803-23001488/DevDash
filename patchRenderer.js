const fs = require('fs');

const path = './renderer.js';
let content = fs.readFileSync(path, 'utf8');

const customizationFunctions = `

// --- Profile Customization Engine ---

function applyProfileCustomization(profile) {
  if (!profile) return;
  const cust = profile.customization || {};
  const theme = cust.themeMode || 'light';
  
  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }
  
  if (cust.accentColor) {
    document.documentElement.style.setProperty('--accent-green-bg', cust.accentColor + '20');
    document.documentElement.style.setProperty('--accent-green-text', cust.accentColor);
    // Overriding the main accents dynamically
  } else {
    document.documentElement.style.removeProperty('--accent-green-bg');
    document.documentElement.style.removeProperty('--accent-green-text');
  }
  
  if (cust.bgImage) {
    document.body.classList.add('has-custom-bg');
    document.documentElement.style.setProperty('--user-bg-image', 'url(' + cust.bgImage + ')');
  } else {
    document.body.classList.remove('has-custom-bg');
    document.documentElement.style.removeProperty('--user-bg-image');
  }
  
  // Widgets Visibility
  const w = cust.widgets || {};
  const kpiEl = document.getElementById('widget-kpi');
  const jiraEl = document.getElementById('widget-jira');
  const gitEl = document.getElementById('widget-git');
  const activityEl = document.getElementById('widget-activity');
  
  if (kpiEl) kpiEl.style.display = w.kpi !== false ? '' : 'none';
  if (jiraEl) jiraEl.style.display = w.jiraDonut !== false ? '' : 'none';
  if (gitEl) gitEl.style.display = w.gitHealth !== false ? '' : 'none';
  if (activityEl) activityEl.style.display = w.activity !== false ? '' : 'none';

  // Sync inputs if in config view
  const thEl = document.getElementById('profile-theme-mode');
  const clEl = document.getElementById('profile-accent-color');
  const clpEl = document.getElementById('profile-accent-color-picker');
  const bgEl = document.getElementById('profile-bg-image');
  
  const wkpi = document.getElementById('widget-visible-kpi');
  const wjira = document.getElementById('widget-visible-jira');
  const wgit = document.getElementById('widget-visible-git');
  const wact = document.getElementById('widget-visible-activity');

  if (thEl) thEl.value = theme;
  if (clEl) clEl.value = cust.accentColor || '#10b981';
  if (clpEl) clpEl.value = cust.accentColor || '#10b981';
  if (bgEl) bgEl.value = cust.bgImage || '';
  
  if (wkpi) wkpi.checked = w.kpi !== false;
  if (wjira) wjira.checked = w.jiraDonut !== false;
  if (wgit) wgit.checked = w.gitHealth !== false;
  if (wact) wact.checked = w.activity !== false;
}

async function saveAppearanceConfig() {
  const profile = profiles[activeProfileIndex];
  if (!profile) return;
  
  if (!profile.customization) profile.customization = {};
  
  const thEl = document.getElementById('profile-theme-mode');
  const clEl = document.getElementById('profile-accent-color');
  const bgEl = document.getElementById('profile-bg-image');
  
  const wkpi = document.getElementById('widget-visible-kpi');
  const wjira = document.getElementById('widget-visible-jira');
  const wgit = document.getElementById('widget-visible-git');
  const wact = document.getElementById('widget-visible-activity');

  if (thEl) profile.customization.themeMode = thEl.value;
  if (clEl) profile.customization.accentColor = clEl.value;
  if (bgEl) profile.customization.bgImage = bgEl.value;
  
  if (!profile.customization.widgets) profile.customization.widgets = {};
  if (wkpi) profile.customization.widgets.kpi = wkpi.checked;
  if (wjira) profile.customization.widgets.jiraDonut = wjira.checked;
  if (wgit) profile.customization.widgets.gitHealth = wgit.checked;
  if (wact) profile.customization.widgets.activity = wact.checked;

  await ipcRenderer.invoke('save-config', { profiles });
  applyProfileCustomization(profile);
  
  // Refrescar el pie de los cards de resumen para reposicionar
  renderProjectCharts('project-charts-container'); 
}
window.saveAppearanceConfig = saveAppearanceConfig;
`;

// Inject functions at the end
content += customizationFunctions;

// Call in selectProfile
content = content.replace(
  'avatarInitialsEl.textContent = profile.name.substring(0, 2).toUpperCase();',
  "avatarInitialsEl.textContent = profile.name.substring(0, 2).toUpperCase();\n    applyProfileCustomization(profile);"
);

fs.writeFileSync(path, content, 'utf8');
console.log('renderer.js patched for customization!');
