function escapeHtml(value) {
  return `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStatusClass(status) {
  const s = `${status || ''}`.toUpperCase();
  if (s.includes('PROGRESO') || s.includes('PROGRESS')) return 'status-progreso';
  if (s.includes('REVISIÓN') || s.includes('REVISION') || s.includes('REVIEW')) return 'status-revision';
  if (s.includes('HECHO') || s.includes('DONE') || s.includes('LISTO')) return 'status-hecho';
  return 'status-default';
}

module.exports = { escapeHtml, getStatusClass };
