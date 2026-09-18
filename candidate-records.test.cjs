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

  const resumeSample=[
    'RUSHIKESH APPASAHEB GAIKWAD',
    'rushikeshg061@gmail.com',
    '7028336692',
    'EDUCATION',
    'MBA in MARKETING Nov 2022 - July 2024',
    'Bachelor Of Science (BSc) Sep 2018 - Oct 2022',
    'SKILLS (Technology & Functional)',
    'Good communication Skills',
    'sales Skills',
    'Marketing Skills',
    'Knowledge of MS Office, Excel, Power point',
    'INTERNSHIP EXPERIENCE',
    'Company Name: - HDFC Bank',
    'Job Role: - Personal loan trainee.',
    'Duration: - 1 Aug 2023 to 1 Oct 2023',
    'EXPERIENCE',
    'Company Name: - Bajaj finance Ltd.',
    'Job Role: - Sales executive.',
    'Duration: - 27 Sep 2023 to Oct 2024',
    'Company Name: - Icici Prudential Life Insurance.',
    'Job Role: - Senior Agency Manager',
    'Duration: - 19 Nov 2024 to Till Date'
  ].join('\n');
  const parsedSample=parser.extractResume(resumeSample);
  assert.equal(parsedSample.name,'Rushikesh Appasaheb Gaikwad');
  assert.equal(parsedSample.email,'rushikeshg061@gmail.com');
  assert.equal(parsedSample.phone,'7028336692');
  assert.match(parsedSample.designation,/Senior Agency Manager/i);
  assert.match(parsedSample.currentCompany,/Icici Prudential Life Insurance/i);
  assert.ok(Number(parsedSample.totalExperience)>=1.8&&Number(parsedSample.totalExperience)<=3.5,'experience should exclude education ranges');
  assert.ok(parsedSample.skills.some(s=>/sales/i.test(s)),'explicit skills section should be captured');

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
