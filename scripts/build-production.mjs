import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'public');
const read=name=>readFile(join(root,name),'utf8');
const readSource=name=>read(name.endsWith('.css')?`src/css/${name}`:`src/js/${name}`);
const banner=(name,body)=>`\n/* ===== ${name} ===== */\n${body.replace(/\r\n?/g,'\n').trim()}\n`;
const emit=(name,body)=>writeFile(join(output,name),body);
const copy=(source,destination)=>cp(join(root,source),join(output,destination),{recursive:true});

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

const joinFiles=async files=>(await Promise.all(files.map(async name=>banner(name,await readSource(name))))).join('');

// Only deployment output is rebuilt. Editable source files are never rewritten.
await rm(output,{recursive:true,force:true});
await mkdir(join(output,'modules'),{recursive:true});
await emit('app-runtime.css',await joinFiles(cssFiles));
await emit('app-core.js',await joinFiles(coreFiles));
await emit('app-runtime.js',await joinFiles(runtimeFiles));

for(const name of ['index.html','confirm.html','reschedule.html','workspace-shell.html']){
  await copy(`src/pages/${name}`,name);
}
for(const name of ['auth-bootstrap.js','confirm.js','evidence-screening.js']){
  await copy(`src/js/${name}`,name);
}
await copy('src/css/login-shell.css','login-shell.css');
for(const name of ['reports-activity.js','recruitment-trackers.js','role-access-visibility.js']){
  await copy(`src/js/${name}`,`modules/${name}`);
}
for(const name of ['reports-activity.css','recruitment-trackers.css']){
  await copy(`src/css/${name}`,`modules/${name}`);
}
await mkdir(join(output,'backend'),{recursive:true});
for(const name of ['config.js','supabase-client.js']){
  await copy(`src/backend/${name}`,`backend/${name}`);
}
await copy('src/assets','assets');

const context={window:{}};
vm.createContext(context);
vm.runInContext(await readSource('brand-assets.js'),context);
const logo=context.window.TSS_ASSETS?.logo||'';
const match=logo.match(/^data:([^;]+);base64,(.+)$/);
if(!match)throw new Error('TalentStock logo asset missing');
await emit('assets/talentstock-logo.webp',Buffer.from(match[2],'base64'));
const workspace=await read('src/pages/workspace-shell.html');
console.log(JSON.stringify({outputDirectory:'public',workspaceBytes:Buffer.byteLength(workspace.trim()),coreFiles:coreFiles.length,runtimeFiles:runtimeFiles.length,cssFiles:cssFiles.length},null,2));
