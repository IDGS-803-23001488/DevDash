const { spawn } = require('child_process');

function runKeePass(config = {}, args = [], masterPassword = '') {
  return new Promise((resolve) => {
    const command = config.cliPath || 'keepassxc-cli';
    const child = spawn(command, args, { shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => resolve({ success: false, error: error.message }));
    child.on('close', code => {
      if (code === 0) resolve({ success: true, output: stdout.trim() });
      else resolve({ success: false, error: (stderr || stdout || `keepassxc-cli salio con codigo ${code}`).trim() });
    });

    if (masterPassword) child.stdin.write(`${masterPassword}\n`);
    child.stdin.end();
  });
}

function databaseArgs(config = {}) {
  const args = [];
  if (config.keyFile) args.push('--key-file', config.keyFile);
  args.push(config.databasePath);
  return args;
}

async function listEntries(config, masterPassword) {
  if (!config.databasePath) return { success: false, error: 'Falta la ruta de la base KeePass.' };
  const res = await runKeePass(config, ['ls', '-R', ...databaseArgs(config)], masterPassword);
  if (!res.success) return { ...res, entries: [] };
  const entries = res.output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return { success: true, entries };
}

async function searchEntries(config, query, masterPassword) {
  const listed = await listEntries(config, masterPassword);
  if (!listed.success) return listed;
  const q = query.toLowerCase();
  return {
    success: true,
    entries: listed.entries.filter(entry => entry.toLowerCase().includes(q)).slice(0, 30)
  };
}

async function getEntryPassword(config, entryPath, masterPassword) {
  if (!config.databasePath) return { success: false, error: 'Falta la ruta de la base KeePass.' };
  if (!entryPath) return { success: false, error: 'Falta la entrada KeePass.' };
  const res = await runKeePass(config, ['show', '-s', '-a', 'Password', ...databaseArgs(config), entryPath], masterPassword);
  if (!res.success) return res;
  return { success: true, password: res.output };
}

module.exports = {
  listEntries,
  searchEntries,
  getEntryPassword
};
