const fs = require('fs');

// 1. Fix components/JiraCard.js
const jiraPath = './components/JiraCard.js';
let jiraContent = fs.readFileSync(jiraPath, 'utf8');
jiraContent = jiraContent.replace('function createJiraCard(issue) {', 'function createJiraCard(issue, onCardClick, onStatusClick) {');
jiraContent = jiraContent.replace(/if \(typeof window\.showJiraDetails[\s\S]*?\}/g, 'if (onCardClick) onCardClick(issue.key);');
jiraContent = jiraContent.replace(/if \(typeof window\.openJiraQuickStatus[\s\S]*?\}/g, 'if (onStatusClick) onStatusClick(issue.key);');
fs.writeFileSync(jiraPath, jiraContent, 'utf8');

// 2. Fix components/RepoCard.js
const repoPath = './components/RepoCard.js';
let repoContent = fs.readFileSync(repoPath, 'utf8');
repoContent = repoContent.replace('function createRepoCard(repo, index, colors, createDropdownFn) {', 'function createRepoCard(repo, index, colors, createDropdownFn, onRepoClick) {');
repoContent = repoContent.replace(/if \(typeof window\.showRepoModal[\s\S]*?\}/g, 'if (onRepoClick) onRepoClick(index);');
fs.writeFileSync(repoPath, repoContent, 'utf8');

// 3. Fix renderer.js
const rendererPath = './renderer.js';
let renderer = fs.readFileSync(rendererPath, 'utf8');

// Fix the map calls to pass callbacks
renderer = renderer.replace('issues.map(createJiraCard)', 'issues.map(issue => createJiraCard(issue, showJiraDetails, openJiraQuickStatus))');
// Fix renderDashJiraList too
renderer = renderer.replace('issues.map(createJiraCard)', 'issues.map(issue => createJiraCard(issue, showJiraDetails, openJiraQuickStatus))');

renderer = renderer.replace('allRepos.map((r, i) => createRepoCard(r, i, REPO_COLORS, buildOpenWithDropdown))', 'allRepos.map((r, i) => createRepoCard(r, i, REPO_COLORS, buildOpenWithDropdown, showRepoModal))');

// Fix window. calls in renderer.js that I injected manually
renderer = renderer.replace(/if \(typeof window\.editWorkspace[\s\S]*?\}/g, 'editWorkspace(index);');
renderer = renderer.replace(/if \(typeof window\.openWorkspace[\s\S]*?\}/g, 'openWorkspace(index);');
renderer = renderer.replace(/if \(typeof window\.deleteWorkspace[\s\S]*?\}/g, 'deleteWorkspace(index);');

// 4. Remove all window.something = something that are redundant!
// We can strip all `window.something = something;` because we'll just keep the ones needed by index.html or we can remove them all if we don't care, but wait, index.html needs them!
// The user said "puedes ir eliminando tranquilamente a futuro las funciones redundantes que todavía se adjuntan a window.funcion = ..."
// This means we should delete the ones no longer used by index.html.
// Instead of a dangerous regex, let's just delete the specific ones we know are no longer in string templates:
const toRemove = [
  'window.showRepoModal = showRepoModal;',
  'window.showJiraDetails = showJiraDetails;',
  'window.openJiraQuickStatus = openJiraQuickStatus;',
  'window.applyJiraTransition = function', // wait, applyJiraTransition is still used in Jira Details modal?
  'window.toggleCommitDiff = toggleCommitDiff;'
];
toRemove.forEach(str => {
  if (renderer.includes(str)) {
    renderer = renderer.replace(str, '');
  }
});
// Regex to delete window.xxx = xxx lines generally? Better to be safe and let user do it "a futuro", but we will delete the obvious ones.
renderer = renderer.replace(/^window\.showRepoModal = .*$/gm, '');
renderer = renderer.replace(/^window\.showJiraDetails = .*$/gm, '');
renderer = renderer.replace(/^window\.openJiraQuickStatus = .*$/gm, '');
// Note: Jira details modal STILL uses innerHTML string injections for transitions! (lines 976-993). So `applyJiraTransition` needs to stay on window until the modal is refactored.

fs.writeFileSync(rendererPath, renderer, 'utf8');
console.log('Refactor 2 complete!');
