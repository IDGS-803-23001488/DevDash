const { exec, spawn } = require('child_process');
const path = require('path');

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
}

function openWithApp(repoPath, command, args = []) {
  return new Promise((resolve) => {
    try {
      // For terminal apps that need the path as last arg
      const finalArgs = [...args, repoPath];
      // Special cases
      let cmd = command;
      let spawnArgs = finalArgs;

      if (command === 'explorer') {
        spawnArgs = [repoPath];
      } else if (command === 'notepad') {
        spawnArgs = [repoPath];
      } else if (command === 'cmd') {
        spawnArgs = ['/k', `cd /d "${repoPath}"`];
      } else if (command === 'powershell') {
        spawnArgs = ['-NoExit', '-Command', `Set-Location -Path '${repoPath}'`];
      } else {
        // code, devenv, android studio, webstorm etc — pass the path as argument
        spawnArgs = [repoPath];
      }

      const child = spawn(cmd, spawnArgs, {
        detached: true,
        stdio: 'ignore',
        shell: true,
        cwd: repoPath
      });
      child.unref();
      resolve({ success: true });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function splitArgs(args) {
  if (Array.isArray(args)) return args.filter(arg => `${arg}`.trim() !== '');
  if (!args || typeof args !== 'string') return [];
  const matches = args.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map(arg => arg.replace(/^["']|["']$/g, ''));
}

function launchDetached(command, args = [], cwd = process.cwd()) {
  return new Promise((resolve) => {
    try {
      if (!command || !command.trim()) {
        resolve({ success: false, error: 'Comando vacio.' });
        return;
      }

      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: true,
        cwd: cwd || process.cwd()
      });
      child.unref();
      resolve({ success: true });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function openWorkspaceAction(action) {
  const cwd = action.cwd || process.cwd();
  const command = action.command || (action.type === 'terminal' ? 'powershell' : '');
  let args = splitArgs(action.args);

  if (action.type === 'terminal' && args.length === 0) {
    if (command.toLowerCase().includes('powershell')) {
      args = ['-NoExit', '-Command', `Set-Location -Path '${cwd}'`];
    } else if (command.toLowerCase() === 'cmd') {
      args = ['/k', `cd /d "${cwd}"`];
    }
  }

  const normalizedArgs = args.map(arg => arg === '.' ? cwd : arg);
  return await launchDetached(command, normalizedArgs, cwd);
}

async function getRepoStatus(repoPath) {
  const branchRes = await runCommand('git rev-parse --abbrev-ref HEAD', repoPath);
  const statusRes = await runCommand('git status --porcelain', repoPath);

  if (!branchRes.success) {
    return { name: path.basename(repoPath), path: repoPath, status: 'Not a Git repo', branch: '-', isDirty: false, changedFiles: 0, ahead: 0, behind: 0 };
  }

  const branch = branchRes.output;
  const isDirty = statusRes.success && statusRes.output.length > 0;
  const changedFiles = isDirty ? statusRes.output.split('\n').filter(l => l.trim()).length : 0;

  // Check ahead/behind vs remote
  let ahead = 0, behind = 0;
  const abRes = await runCommand(`git rev-list --left-right --count HEAD...origin/${branch}`, repoPath);
  if (abRes.success) {
    const parts = abRes.output.split(/\s+/);
    ahead = parseInt(parts[0]) || 0;
    behind = parseInt(parts[1]) || 0;
  }

  return {
    name: path.basename(repoPath),
    path: repoPath,
    branch,
    isDirty,
    changedFiles,
    ahead,
    behind,
    status: isDirty ? 'Modificado' : 'Limpio'
  };
}

async function pullRepo(repoPath) {
  await runCommand('git fetch --prune', repoPath);
  return await runCommand('git pull', repoPath);
}

async function pushRepo(repoPath) {
  const branchRes = await runCommand('git rev-parse --abbrev-ref HEAD', repoPath);
  if (!branchRes.success) return { success: false, error: 'No se pudo detectar la rama.' };
  return await runCommand(`git push origin ${branchRes.output}`, repoPath);
}

function getBranches(cwd) {
  return new Promise((resolve) => {
    // Get all local branches with current marker
    exec('git branch -v', { cwd }, (error, stdout) => {
      if (error) { resolve({ success: false, branches: [], current: '' }); return; }
      const lines = stdout.split('\n').filter(l => l.trim());
      let current = '';
      const branches = lines.map(line => {
        const isCurrent = line.startsWith('*');
        const name = line.replace(/^\*?\s+/, '').split(/\s+/)[0];
        if (isCurrent) current = name;
        return { name, isCurrent };
      });
      resolve({ success: true, branches, current });
    });
  });
}

function checkoutBranch(cwd, branchName) {
  return new Promise((resolve) => {
    exec(`git checkout ${branchName}`, { cwd }, (error, stdout, stderr) => {
      if (error) { resolve({ success: false, error: stderr || error.message }); return; }
      resolve({ success: true, output: stdout || stderr });
    });
  });
}

// Returns last N commits with actual ISO date for calendar
function getRecentCommits(cwd, count = 20) {
  return new Promise((resolve) => {
    // Format: hash|subject|relative|ISO date|author
    exec(`git log -n ${count} --pretty=format:"%h|%s|%ar|%ci|%an"`, { cwd }, (error, stdout) => {
      if (error) { resolve({ success: false, commits: [] }); return; }
      const commits = stdout.split('\n').filter(l => l.trim()).map(line => {
        const firstPipe = line.indexOf('|');
        const lastPipe = line.lastIndexOf('|');
        const secondLastPipe = line.lastIndexOf('|', lastPipe - 1);
        const thirdLastPipe = line.lastIndexOf('|', secondLastPipe - 1);
        
        const hash = line.slice(0, firstPipe);
        const author = line.slice(lastPipe + 1).trim();
        const isoDate = line.slice(secondLastPipe + 1, lastPipe).trim();
        const timeAgo = line.slice(thirdLastPipe + 1, secondLastPipe).trim();
        const message = line.slice(firstPipe + 1, thirdLastPipe).trim();
        
        return { hash, message, timeAgo, isoDate, author };
      });
      resolve({ success: true, commits });
    });
  });
}

function getCommitDiff(cwd, hash) {
  return new Promise((resolve) => {
    exec(`git show --name-status --format="" ${hash}`, { cwd }, (error, stdout) => {
      if (error) { resolve({ success: false, files: [] }); return; }
      const files = stdout.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split('\t');
        return { status: parts[0], path: parts[1] };
      });
      resolve({ success: true, files });
    });
  });
}

function getChangedFiles(cwd) {
  return new Promise((resolve) => {
    exec('git status --porcelain', { cwd }, (error, stdout) => {
      if (error) { resolve({ success: false, files: [] }); return; }
      const files = stdout.split('\n').filter(l => l.trim()).map(line => ({
        status: line.substring(0, 2).trim(),
        file: line.substring(3).trim()
      }));
      resolve({ success: true, files });
    });
  });
}

async function openInExplorer(repoPath) {
  return await runCommand(`explorer "${repoPath}"`, process.cwd());
}

async function openInVSCode(repoPath) {
  return await runCommand(`code "${repoPath}"`, process.cwd());
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'appdata', 'windows', 'program files', 'program files (x86)',
  '.cache', 'temp', 'tmp', '$recycle.bin', 'system volume information'
]);

async function scanForGitRepos(dir, onProgress, maxDepth = 6, currentDepth = 0, excludes = new Set()) {
  let repos = [];
  if (currentDepth > maxDepth) return repos;

  try {
    const entries = await require('fs').promises.readdir(dir, { withFileTypes: true });
    
    const isRepo = entries.some(e => e.name === '.git' && e.isDirectory());
    if (isRepo) {
      if (onProgress) onProgress(dir);
      return [dir]; // stop recursing inside a git repo
    }

    const tasks = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        if (IGNORE_DIRS.has(name) || name.startsWith('.') || excludes.has(name)) continue;

        const fullPath = require('path').join(dir, entry.name);
        tasks.push(scanForGitRepos(fullPath, onProgress, maxDepth, currentDepth + 1, excludes));
      }
    }
    const results = await Promise.all(tasks);
    repos = results.flat();
  } catch (error) {
    // Ignore permissions errors
  }
  return repos;
}

async function cloneRepo(url, targetPath) {
  try {
    await execAsync(`git clone "${url}" "${targetPath}"`);
    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  getRepoStatus,
  pullRepo,
  pushRepo,
  getBranches,
  checkoutBranch,
  getRecentCommits,
  getCommitDiff,
  getChangedFiles,
  openInExplorer,
  openInVSCode,
  openWithApp,
  openWorkspaceAction,
  scanForGitRepos,
  cloneRepo
};
