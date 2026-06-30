const axios = require('axios');

function client(config = {}) {
  if (!config.baseUrl || !config.token) return null;
  return axios.create({
    baseURL: config.baseUrl.replace(/\/+$/, ''),
    timeout: 15000,
    params: { token: config.token }
  });
}

function formatError(error) {
  return error.response?.data?.error || error.response?.data || error.message;
}

async function testConnection(config) {
  const api = client(config);
  if (!api) return { success: false, error: 'Falta URL o token de Joplin.' };
  try {
    const res = await api.get('/ping');
    return { success: true, message: res.data || 'ok' };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

async function searchNotes(config, query) {
  const api = client(config);
  if (!api) return { success: false, error: 'Falta URL o token de Joplin.', notes: [] };
  try {
    const res = await api.get('/search', {
      params: {
        query,
        type: 'note',
        fields: 'id,title,body,updated_time,parent_id',
        limit: 20
      }
    });
    return { success: true, notes: res.data.items || [] };
  } catch (error) {
    return { success: false, error: formatError(error), notes: [] };
  }
}

async function getNote(config, noteId) {
  const api = client(config);
  if (!api) return { success: false, error: 'Falta URL o token de Joplin.' };
  try {
    const res = await api.get(`/notes/${encodeURIComponent(noteId)}`, {
      params: { fields: 'id,title,body,updated_time,parent_id' }
    });
    return { success: true, note: res.data };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

async function saveNote(config, note = {}) {
  const api = client(config);
  if (!api) return { success: false, error: 'Falta URL o token de Joplin.' };
  try {
    const payload = { title: note.title || 'Nueva nota', body: note.body || '' };
    if (note.id) {
      const res = await api.put(`/notes/${encodeURIComponent(note.id)}`, payload);
      return { success: true, note: res.data };
    }
    const res = await api.post('/notes', payload);
    return { success: true, note: res.data };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

async function deleteNote(config, noteId) {
  const api = client(config);
  if (!api) return { success: false, error: 'Falta URL o token de Joplin.' };
  try {
    await api.delete(`/notes/${encodeURIComponent(noteId)}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

module.exports = {
  testConnection,
  searchNotes,
  getNote,
  saveNote,
  deleteNote
};
