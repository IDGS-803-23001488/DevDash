const axios = require('axios');

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

function normalizeModelName(model) {
  const raw = `${model || ''}`.trim();
  if (!raw) return '';
  if (raw.startsWith('models/')) return raw.slice('models/'.length);
  return raw;
}

function looksLikeInvalidModel(model) {
  const normalized = normalizeModelName(model);
  if (!normalized) return true;
  return normalized.startsWith('gen-lang-client-') || normalized.includes('api_key') || normalized.includes('AIza');
}

async function listModels(config = {}) {
  if (!config.apiKey) return { success: false, error: 'Falta API key de Gemini.', models: [] };
  try {
    const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      params: { key: config.apiKey },
      timeout: 15000
    });
    const models = (response.data?.models || [])
      .filter(model => (model.supportedGenerationMethods || []).includes('generateContent'))
      .map(model => ({
        name: normalizeModelName(model.name),
        displayName: model.displayName || normalizeModelName(model.name),
        description: model.description || ''
      }));
    return { success: true, models };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return { success: false, error: message, models: [] };
  }
}

async function resolveModel(config = {}) {
  const configured = normalizeModelName(config.model);
  if (!looksLikeInvalidModel(configured)) return configured;

  const listed = await listModels(config);
  if (listed.success && listed.models.length) {
    const names = listed.models.map(model => model.name);
    return FALLBACK_MODELS.find(name => names.includes(name)) || names[0];
  }
  return FALLBACK_MODELS[0];
}

function buildContext(context = {}) {
  const chunks = [];
  if (Array.isArray(context.repos) && context.repos.length) {
    chunks.push(`Repositorios:\n${context.repos.slice(0, 12).map(r => `- ${r.name} (${r.branch || '-'}) ${r.status || ''} ${r.path || ''}`).join('\n')}`);
  }
  if (Array.isArray(context.tickets) && context.tickets.length) {
    chunks.push(`Tickets Jira:\n${context.tickets.slice(0, 20).map(t => `- ${t.key}: ${t.summary} [${t.status}]`).join('\n')}`);
  }
  if (Array.isArray(context.notes) && context.notes.length) {
    chunks.push(`Notas Joplin:\n${context.notes.slice(0, 8).map(n => `- ${n.title}: ${String(n.body || '').slice(0, 700)}`).join('\n')}`);
  }
  return chunks.join('\n\n');
}

async function askGemini(config = {}, question, context = {}) {
  if (!config.apiKey) return { success: false, error: 'Falta API key de Gemini.' };
  const model = await resolveModel(config);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contextText = buildContext(context);
  const prompt = [
    'Eres el asistente interno de DevDash. Responde en español, directo y accionable.',
    'Usa el contexto local si ayuda. Si no hay datos suficientes, dilo sin inventar.',
    contextText ? `Contexto local:\n${contextText}` : '',
    `Pregunta:\n${question}`
  ].filter(Boolean).join('\n\n');

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 900
      }
    }, {
      params: { key: config.apiKey },
      timeout: 30000
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    return { success: true, text: text || 'Gemini no devolvio texto.', model };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return { success: false, error: message };
  }
}

module.exports = { askGemini, listModels, normalizeModelName };
