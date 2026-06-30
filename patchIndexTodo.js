const fs = require('fs');

let index = fs.readFileSync('./index.html', 'utf8');

// Agregar el array de vistas
index = index.replace(
  "const views = ['resumen', 'proyectos', 'jira', 'workspaces', 'gemini', 'joplin', 'keepass', 'actividad', 'calendario', 'configuracion'];",
  "const views = ['resumen', 'proyectos', 'jira', 'todo', 'workspaces', 'gemini', 'joplin', 'keepass', 'actividad', 'calendario', 'configuracion'];"
);

// Insertar el nav-item
const todoNavItem = `
        <a href="#" class="nav-item" onclick="switchTab('todo', this)" title="To-Do List">
          <i data-lucide="list-todo" style="flex-shrink:0;"></i>
          <span class="nav-text">To-Do List</span>
        </a>`;

index = index.replace(
  `<a href="#" class="nav-item" onclick="switchTab('jira', this)" title="Tareas Jira">`,
  `<a href="#" class="nav-item" onclick="switchTab('jira', this)" title="Tareas Jira">`
);

// Actually we will insert it right after the Jira block.
index = index.replace(
  `<span class="nav-text">Tareas Jira</span>\n        </a>`,
  `<span class="nav-text">Tareas Jira</span>\n        </a>` + todoNavItem
);

fs.writeFileSync('./index.html', index, 'utf8');
console.log('index.html patched with todo tab');
