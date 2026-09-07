const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadParser(){
  const document={readyState:'complete',scripts:[],getElementById(){return null},addEventListener(){}};
  const context={console,Date,document,setTimeout,clearTimeout};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('extraction-accuracy.js','utf8'),context);
  return context.TSSDocumentParser;
}

function loadBackend(existingEmail='manual@example.com'){
  let updatedPayload=null;
  const client={
    auth:{getUser:async()=>({data:{user:{id:'recruiter-1'}},error:null})},
    from(table){
      let operation='';
      const builder={
        select(){if(operation!=='update')operation='select';return builder},
        update(payload){operation='update';updatedPayload=payload;return builder},
        eq(){return builder},
        async single(){
          if(operation==='select')return{data:{email:existingEmail},error:null};
          return{data:{id:'candidate-1',email:updatedPayload.email??existingEmail,...updatedPayload},error:null};
        }
      };
      assert.equal(table,'candidates');
      return builder;
    }
  };
  const context={console,document:{},TSS_SUPABASE_CONFIG:{url:'https://example.supabase.co',anonKey:'publishable'},supabase:{createClient:()=>client}};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('backend/supabase-client.js','utf8'),context);
  return{backend:context.TSSBackend,getUpdatedPayload:()=>updatedPayload};
}

(async()=>{
  const parser=loadParser();
  assert.equal(parser.extractResume('JAYESH WAGHELA\nEmail: jayesh.waghela @ gmail. com\nMobile: 9867741866').email,'jayesh.waghela@gmail.com');
  assert.equal(parser.extractResume('Email: Candidate.Name@Example.COM').email,'candidate.name@example.com');

  const preserve=loadBackend('saved@example.com');
  await preserve.backend.updateCandidate('candidate-1',{name:'Jayesh Waghela',email:'',phone:'9867741866'});
  assert.equal(Object.hasOwn(preserve.getUpdatedPayload(),'email'),false,'blank parser/form email must not overwrite a saved email');
  assert.equal(preserve.getUpdatedPayload().phone,'9867741866');

  const update=loadBackend(null);
  await update.backend.updateCandidate('candidate-1',{name:'Jayesh Waghela',email:' NEW.EMAIL@Example.COM ',phone:'+91 98677 41866',location:'Mumbai',designation:'Executive',totalExperience:'5.6'});
  assert.equal(update.getUpdatedPayload().email,'new.email@example.com');
  assert.equal(update.getUpdatedPayload().phone,'9867741866');
  assert.equal(update.getUpdatedPayload().current_location,'Mumbai');
  assert.equal(update.getUpdatedPayload().current_designation,'Executive');
  assert.equal(update.getUpdatedPayload().total_experience,5.6);

  console.log('candidate records tests passed');
})().catch(error=>{console.error(error);process.exitCode=1});
