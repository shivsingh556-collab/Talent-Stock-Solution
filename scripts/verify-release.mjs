import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
function run(args){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
for(const file of readdirSync(root).filter(name=>name.endsWith('.js')))run(['--check',file]);
for(const dir of ['api','backend']){
  for(const file of readdirSync(join(root,dir)).filter(name=>name.endsWith('.js')))run(['--check',join(dir,file)]);
}
const tests=readdirSync(root).filter(name=>name.endsWith('.test.cjs')&&!name.includes('browser'));
run(['--test',...tests]);
