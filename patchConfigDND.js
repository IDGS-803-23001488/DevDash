const fs = require('fs');

const path = './configManager.js';
let content = fs.readFileSync(path, 'utf8');

// Añadir widgetOrder en normalization
content = content.replace(
  "activity: profile.customization?.widgets?.activity !== false\n      }",
  "activity: profile.customization?.widgets?.activity !== false\n      },\n      widgetOrder: profile.customization?.widgetOrder || ['widget-kpi', 'widget-jira', 'widget-git', 'widget-activity']"
);

fs.writeFileSync(path, content, 'utf8');
console.log('configManager.js patched for DND!');
