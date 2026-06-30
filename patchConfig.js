const fs = require('fs');

const path = './configManager.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Añadir default a defaultConfig.profiles[0]
content = content.replace(
  "tools: { gemini: true, joplin: true, keepass: true }",
  "tools: { gemini: true, joplin: true, keepass: true },\n      customization: { themeMode: 'light', accentColor: '#10b981', bgImage: '', widgets: { kpi: true, jiraDonut: true, gitHealth: true, activity: true } }"
);

// 2. Añadir en normalizeConfig (merged.profiles = merged.profiles.map(profile => ({...})))
content = content.replace(
  "keepass: profile.tools?.keepass !== false\n    }",
  "keepass: profile.tools?.keepass !== false\n    },\n    customization: {\n      themeMode: profile.customization?.themeMode || 'light',\n      accentColor: profile.customization?.accentColor || '#10b981',\n      bgImage: profile.customization?.bgImage || '',\n      widgets: {\n        kpi: profile.customization?.widgets?.kpi !== false,\n        jiraDonut: profile.customization?.widgets?.jiraDonut !== false,\n        gitHealth: profile.customization?.widgets?.gitHealth !== false,\n        activity: profile.customization?.widgets?.activity !== false\n      }\n    }"
);

fs.writeFileSync(path, content, 'utf8');
console.log('configManager.js patched!');
