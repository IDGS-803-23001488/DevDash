const fs = require('fs');
const path = './style.css';

const darkThemeCSS = `
/* --- Theming & Customization --- */

body.theme-dark {
  --bg-app: #0f172a;
  --bg-panel: #1e293b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --border-light: #334155;
  
  --accent-green-bg: #064e3b;
  --accent-green-text: #34d399;
  --accent-blue-bg: #1e3a8a;
  --accent-blue-text: #60a5fa;
  --accent-orange-bg: #7c2d12;
  --accent-orange-text: #fb923c;
  --accent-purple-bg: #581c87;
  --accent-purple-text: #c084fc;
}

body.has-custom-bg {
  background-image: var(--user-bg-image);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* Semi-transparent panels when using custom background */
body.has-custom-bg .app-layout .sidebar {
  background-color: rgba(var(--bg-app-rgb, 245, 247, 249), 0.85);
  backdrop-filter: blur(10px);
}
body.theme-dark.has-custom-bg .app-layout .sidebar {
  background-color: rgba(15, 23, 42, 0.85);
}

body.has-custom-bg .main-content {
  background-color: transparent !important;
}

body.has-custom-bg .card, 
body.has-custom-bg .settings-container, 
body.has-custom-bg .repo-item, 
body.has-custom-bg .jira-item, 
body.has-custom-bg .workspace-card,
body.has-custom-bg .stat-card {
  background-color: var(--bg-panel);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(255,255,255,0.1);
}

body.has-custom-bg .header {
  background-color: transparent !important;
  border-bottom: none !important;
}
`;

fs.appendFileSync(path, darkThemeCSS, 'utf8');
console.log('style.css patched!');
