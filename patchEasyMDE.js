const fs = require('fs');

// --- 1. MODIFICAR index.html ---
let index = fs.readFileSync('./index.html', 'utf8');

// Inyectar CDNs
if (!index.includes('easymde.min.css')) {
  index = index.replace(
    '</head>',
    '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">\\n</head>'
  );
  index = index.replace(
    '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>\\n  <script src="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js"></script>'
  );
}

// Inyectar CSS Theming para Dark Mode
const easyMdeDarkCss = `
/* EasyMDE Dark Theme Overrides */
.editor-toolbar { border-color: rgba(255,255,255,0.1); opacity: 1; border-top-left-radius: 8px; border-top-right-radius: 8px; background: rgba(0,0,0,0.3); }
.editor-toolbar > button { color: #cbd5e1 !important; border: transparent !important; }
.editor-toolbar > button:hover, .editor-toolbar > button.active { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
.editor-toolbar i.separator { border-left-color: rgba(255,255,255,0.1); border-right-color: transparent; }
.CodeMirror { background: rgba(0,0,0,0.2) !important; color: #f1f5f9 !important; border-color: rgba(255,255,255,0.1) !important; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-family: monospace; font-size: 14px; }
.CodeMirror-cursor { border-left-color: #cbd5e1 !important; }
.editor-preview { background: #0f172a; color: #f1f5f9; }
.editor-statusbar { color: rgba(255,255,255,0.3) !important; }
`;
if (!index.includes('/* EasyMDE Dark Theme Overrides */')) {
  index = index.replace('</style>', easyMdeDarkCss + '\\n</style>');
}

// Reemplazar Modal HTML antiguo por el nuevo
const oldModalRegex = /<div id="modal-todo-edit"[\s\S]*?<!-- TODO MARKDOWN EDITOR MODAL -->/g; // This is reversed, wait. We should replace the entire div#modal-todo-edit
const targetModalRegex = /<div id="modal-todo-edit" class="modal-overlay hidden" style="z-index: 10005;">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newModalHTML = `
  <div id="modal-todo-edit" class="modal-overlay hidden" style="z-index: 10005;">
    <div class="modal-content" style="max-width: 900px; width: 90vw; height: 85vh; border-radius: 12px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column;" onclick="event.stopPropagation()">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 16px 24px; display:flex; justify-content:space-between; align-items:center;">
        <input type="text" id="todo-edit-title" style="background:transparent; border:none; color:#fff; font-size:18px; font-weight:600; width:100%; outline:none;" placeholder="Título de la tarea...">
        <button class="btn-close-modal" onclick="document.getElementById('modal-todo-edit').classList.add('hidden')" style="color:rgba(255,255,255,0.5); background:none; border:none; cursor:pointer;"><i data-lucide="x"></i></button>
      </div>

      <div class="modal-body" style="flex:1; padding: 24px; display:flex; flex-direction:column; position:relative; overflow:hidden;">
        <!-- EasyMDE Target -->
        <textarea id="todo-edit-desc" style="display:none;"></textarea>
      </div>

      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:rgba(255,255,255,0.3);"><i data-lucide="image" style="width:12px; height:12px; margin-right:4px;"></i>Soporta Drag & Drop y Ctrl+V de imágenes</span>
        <button id="todo-edit-save" style="background:var(--accent); color:#fff; border:none; border-radius:6px; padding:8px 24px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.3);">Guardar Cambios</button>
      </div>
    </div>
  </div>
`;

if (index.match(targetModalRegex)) {
  index = index.replace(targetModalRegex, newModalHTML);
}
fs.writeFileSync('./index.html', index, 'utf8');

// --- 2. MODIFICAR renderer.js ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

// Eliminar el logic anterior del Editor Markdown
const removeOldEditorRegex = /\/\/ --- MARKDOWN EDITOR LOGIC ---[\s\S]*?function insertAtCursor\(myField, myValue\) \{[\s\S]*?\}/;
if (renderer.match(removeOldEditorRegex)) {
  renderer = renderer.replace(removeOldEditorRegex, '// --- MARKDOWN EDITOR LOGIC REPLACED ---');
}

const newEditorLogic = `
// --- MARKDOWN EDITOR LOGIC ---
let activeEditTodoId = null;
let easyMdeInstance = null;

window.openTodoEditor = (id, title, description) => {
  activeEditTodoId = id;
  document.getElementById('todo-edit-title').value = title || '';
  
  if (!easyMdeInstance) {
    easyMdeInstance = new EasyMDE({
      element: document.getElementById('todo-edit-desc'),
      spellChecker: false,
      placeholder: 'Escribe tu markdown o pega una imagen aquí...',
      uploadImage: true,
      status: false, // Ocultar barra inferior fea
      imageAccept: 'image/png, image/jpeg, image/jpg, image/gif',
      imageUploadFunction: async (file, onSuccess, onError) => {
        try {
          const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
          const arrayBuffer = await file.arrayBuffer();
          const fileUrl = await ipcRenderer.invoke('save-todo-media', arrayBuffer, ext);
          if (fileUrl) {
            onSuccess(fileUrl);
          } else {
            onError('No se pudo guardar la imagen');
          }
        } catch (err) {
          onError(err.message);
        }
      },
      toolbar: [
        'bold', 'italic', 'strikethrough', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide'
      ]
    });

    // Custom Paste Interceptor (Fallback for EasyMDE 2.x issue with Ctrl+V outside toolbars)
    easyMdeInstance.codemirror.on('paste', async (cm, e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
            const arrayBuffer = await file.arrayBuffer();
            const fileUrl = await ipcRenderer.invoke('save-todo-media', arrayBuffer, ext);
            if (fileUrl) {
              const mdImg = \`![imagen](\${fileUrl})\`;
              cm.replaceSelection(mdImg);
            }
          }
        }
      }
    });
  }

  easyMdeInstance.value(description || '');
  
  document.getElementById('modal-todo-edit').classList.remove('hidden');
  lucide.createIcons();
  
  // Refresh layout cause Codemirror buggy in hidden divs
  setTimeout(() => {
    easyMdeInstance.codemirror.refresh();
  }, 50);
};

// Handlers for Save
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('todo-edit-save');
  if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = document.getElementById('todo-edit-title').value;
      const desc = easyMdeInstance ? easyMdeInstance.value() : '';
      if (activeEditTodoId) {
        await ipcRenderer.invoke('todo-action', 'updateDescription', { id: activeEditTodoId, title, description: desc });
        document.getElementById('modal-todo-edit').classList.add('hidden');
        renderTodoTab();
      }
    });
  }
});
`;

if (!renderer.includes('new EasyMDE')) {
  renderer = renderer + "\\n" + newEditorLogic;
  fs.writeFileSync('./renderer.js', renderer, 'utf8');
}
console.log('EasyMDE installed.');
