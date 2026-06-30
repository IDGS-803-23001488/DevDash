const fs = require('fs');

// --- 1. MODIFICAR index.html ---
let index = fs.readFileSync('./index.html', 'utf8');

// A. Inyectar marked.js
if (!index.includes('marked.min.js')) {
  index = index.replace(
    '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\\n  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>'
  );
}

// B. Inyectar el Modal
const editorModal = `
  <!-- TODO MARKDOWN EDITOR MODAL -->
  <div id="modal-todo-edit" class="modal-overlay hidden" style="z-index: 10005;">
    <div class="modal-content" style="max-width: 800px; width: 90vw; height: 85vh; border-radius: 12px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column;" onclick="event.stopPropagation()">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 16px 24px; display:flex; justify-content:space-between; align-items:center;">
        <input type="text" id="todo-edit-title" style="background:transparent; border:none; color:#fff; font-size:18px; font-weight:600; width:100%; outline:none;" placeholder="Título de la tarea...">
        <button class="btn-close-modal" onclick="document.getElementById('modal-todo-edit').classList.add('hidden')" style="color:rgba(255,255,255,0.5); background:none; border:none; cursor:pointer;"><i data-lucide="x"></i></button>
      </div>
      
      <div style="display:flex; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 0 24px;">
        <button id="todo-tab-write" class="todo-editor-tab active" onclick="window.switchTodoTab('write')" style="background:transparent; border:none; padding:12px 16px; color:var(--accent); font-weight:500; border-bottom:2px solid var(--accent); cursor:pointer;">Escribir (MD)</button>
        <button id="todo-tab-preview" class="todo-editor-tab" onclick="window.switchTodoTab('preview')" style="background:transparent; border:none; padding:12px 16px; color:rgba(255,255,255,0.5); font-weight:500; border-bottom:2px solid transparent; cursor:pointer;">Vista Previa</button>
      </div>

      <div class="modal-body" style="flex:1; padding: 24px; overflow-y:auto; position:relative;">
        <!-- Write Mode -->
        <textarea id="todo-edit-desc" style="width:100%; height:100%; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:16px; color:#cbd5e1; font-family:monospace; font-size:14px; outline:none; resize:none;" placeholder="Añade una descripción (soporta Markdown)... ¡Pega o arrastra imágenes aquí!"></textarea>
        <!-- Preview Mode -->
        <div id="todo-edit-preview" class="hidden" style="width:100%; height:100%; background:rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:16px; color:#f1f5f9; overflow-y:auto; line-height:1.6;"></div>
      </div>

      <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:rgba(255,255,255,0.3);"><i data-lucide="image" style="width:12px; height:12px; margin-right:4px;"></i>Soporta Drag & Drop / Ctrl+V de imágenes</span>
        <button id="todo-edit-save" style="background:var(--accent); color:#fff; border:none; border-radius:6px; padding:8px 24px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.3);">Guardar</button>
      </div>
    </div>
  </div>
`;
if (!index.includes('modal-todo-edit')) {
  index = index.replace('</body>', editorModal + '\\n</body>');
}
fs.writeFileSync('./index.html', index, 'utf8');

// --- 2. MODIFICAR renderer.js ---
let renderer = fs.readFileSync('./renderer.js', 'utf8');

// Inyectar el ícono de edición en las tarjetas
const editBtnInjection = `
  const editBtn = document.createElement('button');
  editBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px; height:14px;"></i>';
  editBtn.style.background = 'transparent';
  editBtn.style.border = 'none';
  editBtn.style.color = 'rgba(255,255,255,0.3)';
  editBtn.style.cursor = 'pointer';
  editBtn.style.padding = '0';
  editBtn.style.marginRight = '8px';
  editBtn.onclick = () => window.openTodoEditor(t.id, t.title, t.description);
  editBtn.onmouseover = () => editBtn.style.color = 'var(--accent)';
  editBtn.onmouseout = () => editBtn.style.color = 'rgba(255,255,255,0.3)';
  
  const actionsBox = document.createElement('div');
  actionsBox.style.display = 'flex';
  actionsBox.appendChild(editBtn);
  actionsBox.appendChild(delBtn);
`;
renderer = renderer.replace("header.appendChild(delBtn);", editBtnInjection + "\\n  header.appendChild(actionsBox);");

// Añadir la lógica del Editor Markdown
const editorLogic = `
// --- MARKDOWN EDITOR LOGIC ---
let activeEditTodoId = null;

window.openTodoEditor = (id, title, description) => {
  activeEditTodoId = id;
  document.getElementById('todo-edit-title').value = title || '';
  document.getElementById('todo-edit-desc').value = description || '';
  window.switchTodoTab('write');
  document.getElementById('modal-todo-edit').classList.remove('hidden');
  lucide.createIcons();
};

window.switchTodoTab = (tab) => {
  const btnWrite = document.getElementById('todo-tab-write');
  const btnPreview = document.getElementById('todo-tab-preview');
  const txDesc = document.getElementById('todo-edit-desc');
  const txPrev = document.getElementById('todo-edit-preview');

  if (tab === 'write') {
    btnWrite.style.color = 'var(--accent)';
    btnWrite.style.borderBottomColor = 'var(--accent)';
    btnPreview.style.color = 'rgba(255,255,255,0.5)';
    btnPreview.style.borderBottomColor = 'transparent';
    txDesc.classList.remove('hidden');
    txPrev.classList.add('hidden');
  } else {
    btnPreview.style.color = 'var(--accent)';
    btnPreview.style.borderBottomColor = 'var(--accent)';
    btnWrite.style.color = 'rgba(255,255,255,0.5)';
    btnWrite.style.borderBottomColor = 'transparent';
    txDesc.classList.add('hidden');
    txPrev.classList.remove('hidden');
    
    // Parse Markdown
    if (typeof marked !== 'undefined') {
      txPrev.innerHTML = marked.parse(txDesc.value);
    } else {
      txPrev.innerHTML = '<p style="color:red;">Error: No se pudo cargar el motor Markdown.</p>';
    }
  }
};

// Handlers for Save
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('todo-edit-save');
  if(saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = document.getElementById('todo-edit-title').value;
      const desc = document.getElementById('todo-edit-desc').value;
      if (activeEditTodoId) {
        await ipcRenderer.invoke('todo-action', 'updateDescription', { id: activeEditTodoId, title, description: desc });
        document.getElementById('modal-todo-edit').classList.add('hidden');
        renderTodoTab();
      }
    });
  }

  // File Upload Handlers (Paste & Drop)
  const textarea = document.getElementById('todo-edit-desc');
  if(textarea) {
    // PASTE
    textarea.addEventListener('paste', async (e) => {
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
              insertAtCursor(textarea, mdImg);
            }
          }
        }
      }
    });

    // DROP
    textarea.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith('image/')) {
            const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
            const arrayBuffer = await file.arrayBuffer();
            const fileUrl = await ipcRenderer.invoke('save-todo-media', arrayBuffer, ext);
            
            if (fileUrl) {
              const mdImg = \`![imagen](\${fileUrl})\`;
              insertAtCursor(textarea, mdImg);
            }
          }
        }
      }
    });
    
    // Allow dragover
    textarea.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
  }
});

function insertAtCursor(myField, myValue) {
  if (document.selection) {
      myField.focus();
      sel = document.selection.createRange();
      sel.text = myValue;
  } else if (myField.selectionStart || myField.selectionStart == '0') {
      var startPos = myField.selectionStart;
      var endPos = myField.selectionEnd;
      myField.value = myField.value.substring(0, startPos) +
          myValue +
          myField.value.substring(endPos, myField.value.length);
      myField.selectionStart = startPos + myValue.length;
      myField.selectionEnd = startPos + myValue.length;
  } else {
      myField.value += myValue;
  }
}
`;

if (!renderer.includes('window.openTodoEditor')) {
  renderer = renderer + '\\n' + editorLogic;
}

// Ensure openTodoEditor and switchTodoTab are globalized
if (!renderer.includes('window.switchTodoTab = window.switchTodoTab;')) {
  renderer = renderer.replace('window.submitTodo = submitTodo;', 'window.switchTodoTab = window.switchTodoTab;\\nwindow.openTodoEditor = window.openTodoEditor;\\nwindow.submitTodo = submitTodo;');
}

// Inyectar CSS global para markdown rendering
const mdStyles = `
/* CSS FOR MARKDOWN PREVIEW */
#todo-edit-preview h1, #todo-edit-preview h2, #todo-edit-preview h3 { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-top: 16px; margin-bottom: 8px;}
#todo-edit-preview img { max-width: 100%; border-radius: 6px; margin: 10px 0; }
#todo-edit-preview pre { background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; }
#todo-edit-preview code { background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 13px;}
#todo-edit-preview blockquote { border-left: 4px solid var(--accent); padding-left: 12px; margin: 12px 0; color: rgba(255,255,255,0.6); }
#todo-edit-preview table { width: 100%; border-collapse: collapse; margin: 12px 0; }
#todo-edit-preview th, #todo-edit-preview td { border: 1px solid rgba(255,255,255,0.1); padding: 8px; }
`;
if (!index.includes('/* CSS FOR MARKDOWN PREVIEW */')) {
  index = index.replace('</style>', mdStyles + '\\n</style>');
  fs.writeFileSync('./index.html', index, 'utf8');
}

fs.writeFileSync('./renderer.js', renderer, 'utf8');
console.log('Frontend patched for Markdown Editor.');
