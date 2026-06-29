const axios = require('axios');

function createClient(jiraConfig) {
  if (!jiraConfig || !jiraConfig.baseUrl || !jiraConfig.email || !jiraConfig.token) {
    return null;
  }
  const baseUrl = jiraConfig.baseUrl.replace(/\/+$/, '');
  return axios.create({
    baseURL: `${baseUrl}/rest/api/3`,
    timeout: 15000,
    headers: {
      'Authorization': `Basic ${Buffer.from(
        `${jiraConfig.email}:${jiraConfig.token}`
      ).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

function formatJiraError(error) {
  const status = error.response?.status;
  const data = error.response?.data;
  const messages = [
    ...(Array.isArray(data?.errorMessages) ? data.errorMessages : []),
    ...(data?.errors ? Object.values(data.errors) : [])
  ].filter(Boolean);

  if (messages.length > 0) {
    return status ? `${status}: ${messages.join(' | ')}` : messages.join(' | ');
  }
  if (status === 401) return '401: Credenciales invalidas o token expirado.';
  if (status === 403) return '403: Sin permisos para esta operacion.';
  if (status === 404) return '404: Recurso no encontrado. Revisa la URL o la llave del ticket.';
  if (error.code === 'ECONNABORTED') return 'La solicitud tardo demasiado. Revisa tu conexion o la URL de Jira.';
  return error.message || 'Error desconocido de Jira';
}

async function testConnection(jiraConfig) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    const [myself, statuses] = await Promise.all([
      client.get('/myself'),
      client.get('/status')
    ]);
    return {
      success: true,
      user: {
        displayName: myself.data.displayName,
        emailAddress: myself.data.emailAddress || jiraConfig.email
      },
      statuses: statuses.data.map(s => ({
        id: s.id,
        name: s.name,
        category: s.statusCategory?.name || ''
      }))
    };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

async function searchIssues(client, payload) {
  try {
    return await client.post('/search/jql', payload);
  } catch (error) {
    const status = error.response?.status;
    if ([404, 405, 410].includes(status)) {
      return await client.post('/search', payload);
    }
    throw error;
  }
}

async function getMyTickets(jiraConfig) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    const response = await searchIssues(client, {
      jql: 'assignee = currentUser() ORDER BY updated DESC',
      maxResults: 20,
      fields: ['summary', 'status', 'issuetype', 'assignee']
    });
    return { success: true, issues: formatIssues(response.data.issues) };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

async function getAllTickets(jiraConfig) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    const projectKey = jiraConfig.projectKey || jiraConfig.project || '';
    const jql = projectKey
      ? `project = "${projectKey}" ORDER BY updated DESC`
      : 'assignee = currentUser() ORDER BY updated DESC';
    const response = await searchIssues(client, {
      jql,
      maxResults: 25,
      fields: ['summary', 'status', 'issuetype', 'assignee']
    });
    return { success: true, issues: formatIssues(response.data.issues) };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

function formatIssues(issuesArray) {
  return issuesArray.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    type: issue.fields.issuetype.name,
    assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Sin asignar'
  }));
}

async function getIssueDetails(jiraConfig, issueKey) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    const res = await client.get(`/issue/${issueKey}?fields=summary,description,status,issuetype,assignee,reporter,comment,updated`);
    const fields = res.data.fields;
    
    // Parse comments
    let comments = [];
    if (fields.comment && fields.comment.comments) {
      comments = fields.comment.comments.map(c => ({
        author: c.author.displayName,
        body: parseJiraDoc(c.body), // V3 API uses Atlassian Document Format
        created: c.created
      }));
    }

    return { 
      success: true, 
      issue: {
        key: res.data.key,
        summary: fields.summary,
        description: parseJiraDoc(fields.description),
        status: fields.status.name,
        type: fields.issuetype.name,
        assignee: fields.assignee ? fields.assignee.displayName : 'Sin asignar',
        reporter: fields.reporter ? fields.reporter.displayName : 'Desconocido',
        comments: comments,
        updated: fields.updated
      }
    };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

// Helper to extract text from Atlassian Document Format (Jira v3)
function parseJiraDoc(doc) {
  if (!doc) return 'Sin descripción.';
  if (typeof doc === 'string') return doc; // Fallback
  if (doc.type === 'doc' && doc.content) {
    return doc.content.map(block => {
      if (block.type === 'paragraph' && block.content) {
        return block.content.map(textNode => textNode.text || '').join('');
      }
      return '';
    }).join('\n\n');
  }
  return JSON.stringify(doc);
}

async function getIssueTransitions(jiraConfig, issueKey) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    const res = await client.get(`/issue/${issueKey}/transitions`);
    return {
      success: true, 
      transitions: res.data.transitions.map(t => ({
        id: t.id,
        name: t.name,
        to: t.to.name,
        statusCategory: t.to.statusCategory?.name || ''
      }))
    };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

async function transitionIssue(jiraConfig, issueKey, transitionId) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    await client.post(`/issue/${issueKey}/transitions`, {
      transition: { id: transitionId }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

async function addComment(jiraConfig, issueKey, text) {
  const client = createClient(jiraConfig);
  if (!client) return { success: false, error: 'Credenciales incompletas' };
  try {
    // V3 API requires Atlassian Document Format
    const body = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: text }]
          }
        ]
      }
    };
    await client.post(`/issue/${issueKey}/comment`, body);
    return { success: true };
  } catch (error) {
    return { success: false, error: formatJiraError(error) };
  }
}

module.exports = {
  testConnection,
  getMyTickets,
  getAllTickets,
  getIssueDetails,
  getIssueTransitions,
  transitionIssue,
  addComment
};
