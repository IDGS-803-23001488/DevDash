const fs = require('fs');
const path = './style.css';

const dndCSS = `
/* --- Drag and Drop Grid --- */
.dashboard-dnd-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-top: 10px;
}

.widget-full { grid-column: span 2; }
.widget-half { grid-column: span 1; }

.dashboard-widget {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: grab;
}

.dashboard-widget:active {
  cursor: grabbing;
}

.dashboard-widget.dragging {
  opacity: 0.5;
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
  z-index: 10;
}

.dashboard-widget.drag-over {
  border: 2px dashed var(--accent-green-text);
  background-color: rgba(var(--accent-green-bg), 0.1);
}
`;

fs.appendFileSync(path, dndCSS, 'utf8');
console.log('style.css patched for DND!');
