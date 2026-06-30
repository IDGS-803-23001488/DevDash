const fs = require('fs');

// --- 1. Fix index.html literal \n ---
let index = fs.readFileSync('./index.html', 'utf8');
index = index.replace('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">\\n</head>', '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">\\n</head>');
// The actual bug was literal \n string, let's fix it universally
index = index.replace(/\\n<\/head>/g, '\\n</head>');
fs.writeFileSync('./index.html', index, 'utf8');

// --- 2. Append Dark Theme for EasyMDE in style.css ---
const darkThemeCSS = `
/* EasyMDE Dark Theme Overrides */
.editor-toolbar { border-color: rgba(255,255,255,0.1) !important; opacity: 1 !important; border-top-left-radius: 8px !important; border-top-right-radius: 8px !important; background: #1e293b !important; }
.editor-toolbar > button { color: #94a3b8 !important; border: transparent !important; }
.editor-toolbar > button:hover, .editor-toolbar > button.active { background: rgba(255,255,255,0.1) !important; color: #fff !important; border-color: transparent !important; }
.editor-toolbar > button i { color: inherit !important; }
.editor-toolbar i.separator { border-left-color: rgba(255,255,255,0.1) !important; border-right-color: transparent !important; }
.EasyMDEContainer .CodeMirror { background: #0f172a !important; color: #f1f5f9 !important; border-color: rgba(255,255,255,0.1) !important; border-bottom-left-radius: 8px !important; border-bottom-right-radius: 8px !important; font-family: monospace; font-size: 14px; }
.EasyMDEContainer .CodeMirror-cursor { border-left-color: #cbd5e1 !important; }
.editor-preview, .editor-preview-side { background: #0f172a !important; color: #f1f5f9 !important; border-color: rgba(255,255,255,0.1) !important; }
.editor-statusbar { color: rgba(255,255,255,0.3) !important; padding: 8px 10px !important; }
.editor-toolbar.fullscreen, .CodeMirror-fullscreen, .editor-preview-active-side { z-index: 100000 !important; background: #0f172a !important; }

/* Font Awesome Icon Fallbacks just in case */
.fa { display: inline-block; font: normal normal normal 14px/1 FontAwesome; text-rendering: auto; -webkit-font-smoothing: antialiased; }

/* Markdown Preview Elements (Dark) */
.editor-preview h1, .editor-preview-side h1, .editor-preview h2, .editor-preview-side h2 { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
.editor-preview img, .editor-preview-side img { max-width: 100%; border-radius: 6px; }
.editor-preview pre, .editor-preview-side pre { background: rgba(0,0,0,0.3) !important; padding: 12px; border-radius: 6px; }
.editor-preview code, .editor-preview-side code { background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px; }
.editor-preview blockquote, .editor-preview-side blockquote { border-left: 4px solid var(--accent); padding-left: 12px; color: rgba(255,255,255,0.6); }
`;

let style = fs.readFileSync('./style.css', 'utf8');
if (!style.includes('EasyMDE Dark Theme Overrides')) {
  style += "\\n" + darkThemeCSS;
  fs.writeFileSync('./style.css', style, 'utf8');
}
console.log('Styles patched.');
