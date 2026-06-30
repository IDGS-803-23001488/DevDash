const fs = require('fs');

let renderer = fs.readFileSync('./renderer.js', 'utf8');

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

if (!renderer.includes('// --- MARKDOWN EDITOR LOGIC ---')) {
  renderer = renderer + "\\n" + editorLogic;
  fs.writeFileSync('./renderer.js', renderer, 'utf8');
}
console.log("Injected logic.");
