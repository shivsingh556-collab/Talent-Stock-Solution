import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFile(join(root,name),'utf8');
const banner=(name,body)=>`\n/* ===== ${name} ===== */\n${body.trim()}\n`;

const cssFiles=[
  'styles.css','production-polish.css','requirements-perfect-fix.css',
  'todo-ai-branding.css','reports-activity.css','professional-ui.css',
  'quick-screening.css','quick-screening-next.css','light-theme.css',
  'minimal-content-theme.css','ui-overrides.css','todoai-brand.css'
];

const coreFiles=['app.js','master-data.js','old-site.js'];
const runtimeFiles=[
  'brand-assets.js','todo-exact.js','extraction-accuracy.js','candidate-enrichment.js',
  'production.js','candidate-resume-hydration.js','interview-sync.js','interview-actions.js',
  'interview-lifecycle-ui.js','interview-scheduler-ui.js','stable-runtime.js',
  'requirement-status-visibility.js','requirements-live-sync.js',
  'requirement-assignment-hydration-fix.js','safe-backend-features.js',
  'dashboard-cleanup.js','dashboard-actions.js','resdex-assistant.js','resdex-final-safe.js',
  'resdex-import-quick.js','recruitment-workflow.js','assignment-clean-layout.js',
  'client-owner-auto.js','requirement-acknowledgement-ui.js','requirement-positions-field.js',
  'requirement-save-sync.js','requirement-details-owner-sync.js','admin-role-ui.js',
  'screening-cleanup.js','quick-screening.js','quick-screening-next.js',
  'todo-chatbot-upgrade.js','role-access-visibility.js','realtime-performance.js',
  'workflow-finalization.js','requirement-screening-selection-fix.js',
  'reports-activity.js','reports-daily-activity.js'
];

const joinFiles=async files=>(await Promise.all(files.map(async name=>banner(name,await read(name))))).join('');
await writeFile(join(root,'app-runtime.css'),await joinFiles(cssFiles));
await writeFile(join(root,'app-core.js'),await joinFiles(coreFiles));
await writeFile(join(root,'app-runtime.js'),await joinFiles(runtimeFiles));

let html=await read('index.html');
const workspaceStart=html.indexOf('  <div id="workspace"');
const scriptsStart=workspaceStart>=0?html.indexOf('  <script src=',workspaceStart):-1;
let workspace;
if(workspaceStart>=0&&scriptsStart>=0){
  workspace=html.slice(workspaceStart,scriptsStart).trim();
  await writeFile(join(root,'workspace-shell.html'),`${workspace}\n`);
  let publicShell=html.slice(0,workspaceStart);
  publicShell=publicShell.replace(/(?:\s*<link rel="stylesheet"[^>]*>\s*)+/m,'\n  <link rel="stylesheet" href="login-shell.css?v=20260922-forgot-password-1" />\n');
  publicShell+=`  <main id="workspaceMount"></main>\n\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.109.0"></script>\n  <script src="backend/config.js?v=20260913-hardening-1"></script>\n  <script src="backend/supabase-client.js?v=20260922-forgot-password-1"></script>\n  <script src="auth-bootstrap.js?v=20260922-forgot-password-1"></script>\n</body>\n</html>\n`;
  await writeFile(join(root,'index.html'),publicShell);
}else{
  workspace=(await read('workspace-shell.html')).trim();
}

const context={window:{}};
vm.createContext(context);
vm.runInContext(await read('brand-assets.js'),context);
const logo=context.window.TSS_ASSETS?.logo||'';
const match=logo.match(/^data:([^;]+);base64,(.+)$/);
if(!match)throw new Error('TalentStock logo asset missing');
await mkdir(join(root,'assets'),{recursive:true});
await writeFile(join(root,'assets/talentstock-logo.webp'),Buffer.from(match[2],'base64'));

console.log(JSON.stringify({workspaceBytes:Buffer.byteLength(workspace),coreFiles:coreFiles.length,runtimeFiles:runtimeFiles.length,cssFiles:cssFiles.length},null,2));
