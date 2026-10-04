const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('./api/workspace-shell.js');
function response(){return {code:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},end(){return this},send(body){this.body=body;return this}}}
test('workspace rejects missing, invalid, inactive and foreign sessions, and fails closed',async()=>{
 const original=global.fetch;
 try{
  const call=async(auth,answers)=>{let calls=0;global.fetch=async()=>{calls++;const answer=answers.shift();if(answer instanceof Error)throw answer;return {ok:answer.status===200,status:answer.status,json:async()=>answer.body}};const res=response();await handler({method:'GET',headers:auth?{authorization:auth}:{}},res);return {res,calls}};
  let result=await call(null,[]);assert.equal(result.res.code,401);assert.equal(result.calls,0);
  result=await call('Bearer invalid',[{status:401}]);assert.equal(result.res.code,401);assert.equal(result.res.body,'');
  const user={id:'user-1',email:'recruiter@talent-stock.com'};
  for(const profile of [null,{id:'user-1',email:user.email,role:'recruiter',is_active:false},{id:'user-2',email:user.email,role:'admin',is_active:true}]){result=await call('Bearer valid',[{status:200,body:user},{status:200,body:profile?[profile]:[]}]);assert.equal(result.res.code,403);assert.equal(result.res.body,'')}
  result=await call('Bearer valid',[{status:200,body:{id:'user-1',email:'foreign@example.com'}}]);assert.equal(result.res.code,403);
  result=await call('Bearer valid',[new Error('network failed')]);assert.equal(result.res.code,503);
  for(const role of ['recruiter','admin']){result=await call('Bearer valid',[{status:200,body:user},{status:200,body:[{...user,role,is_active:true}]}]);assert.equal(result.res.code,200);assert.match(result.res.body,/id="workspace"/);assert.match(result.res.headers['Cache-Control'],/no-store/)}
 }finally{global.fetch=original}
});
test('production output contains no private template or migration',()=>{
 const fs=require('node:fs');
 assert.equal(fs.existsSync('dist/workspace-shell.html'),false);
 assert.equal(fs.existsSync('dist/private'),false);
 assert.equal(fs.existsSync('dist/supabase'),false);
 assert.equal(fs.existsSync('dist/api'),false);
 assert.ok(fs.existsSync('dist/index.html'));
});
