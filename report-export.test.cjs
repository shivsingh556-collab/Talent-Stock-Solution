const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('reports-activity.js','utf8');
const functions=source.slice(source.indexOf('function performanceScreens'),source.indexOf('async function boot'));
function fixture(){
 const inputs={employee:'one',client:'Acme',tab:'performance'},saved=[];
 const ctx={lastAdmin:{profiles:[{id:'one',full_name:'One'},{id:'two',full_name:'Two'}],requirements:[{id:'a',clients:{name:'Acme'}},{id:'b',clients:{name:'Elsewhere'}}],performanceScreenings:[{screened_by:'one',requirement_id:'a',final_recommendation:'Strong Match'},{screened_by:'two',requirement_id:'a'}],reports:[{recruiter_id:'one',report_date:'2026-10-04',metrics:{},submissions:[{candidate_name:'Included',client:'Acme'},{candidate_name:'Wrong client',client:'Elsewhere'}]},{recruiter_id:'two',report_date:'2026-10-04',metrics:{},submissions:[{candidate_name:'Wrong employee',client:'Acme'}]}]},lastFriendlyRows:[],document:{querySelector:s=>s==='#reportRecruiter'?{value:inputs.employee}:s==='#reportClient'?{value:inputs.client}:s==='.report-tabs .active'?{dataset:{tab:inputs.tab}}:null},window:{toast(){},TSSDailyActivityReport:{getRows:()=>[{date:'4 Oct',time:'10:00',employee:'Displayed',role:'Recruiter',activity:'Visible action',entity:'Screening',client:'Acme',requirement:'Role',candidate:'Visible candidate',details:'Result'}]},XLSX:{utils:{book_new:()=>({sheets:{}}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(wb,ws,name)=>{wb.sheets[name]=ws}},writeFile:(wb,name)=>saved.push({wb,name})}},alert:message=>{throw Error(message)},console};
 vm.createContext(ctx);vm.runInContext("const $=s=>document.querySelector(s);function displayDate(x){return x}function localDate(){return '2026-10-04'}"+functions,ctx);return{ctx,inputs,saved};
}
(async()=>{
 const f=fixture();await vm.runInContext('exportExcel()',f.ctx);
 const sheets=f.saved[0].wb.sheets;
 assert.equal(sheets['Daily Submissions'].rows.length,2);assert.equal(sheets['Daily Submissions'].rows[1][2],'Included');
 assert.equal(sheets['Recruiter Summary'].rows.length,2);assert.equal(sheets['Recruiter Summary'].rows[1][0],'One');assert.equal(sheets['Recruiter Summary'].rows[1][3],1);
 f.inputs.tab='allactivity';await vm.runInContext('exportExcel()',f.ctx);
 assert.deepEqual(Object.keys(f.saved[1].wb.sheets),['All Activity']);
 assert.equal(f.saved[1].wb.sheets['All Activity'].rows[1][4],'Visible action');assert.equal(f.saved[1].wb.sheets['All Activity'].rows[1][8],'Visible candidate');
 const tracker=fs.readFileSync('recruitment-trackers.js','utf8'),tc={};vm.createContext(tc);
 vm.runInContext(tracker.slice(tracker.indexOf('function summarizeRecruiter'),tracker.indexOf('async function renderMonthlyReport')),tc);
 tc.data={calls:[{recruiter_id:'one',next_follow_up_at:'2000-01-01T00:00:00Z'},{recruiter_id:'one',next_follow_up_at:'2100-01-01T00:00:00Z'},{recruiter_id:'one',next_follow_up_at:null},{recruiter_id:'one',next_follow_up_at:'bad date'},{recruiter_id:'two',next_follow_up_at:'2000-01-01T00:00:00Z'}],screenings:[],interviews:[],submissions:[],candidates:[]};
 assert.equal(vm.runInContext("summarizeRecruiter(data,'one').pendingFollowUps",tc),2);
 console.log('Report exports preserve employee/client filters and displayed activity; pending follow-ups include overdue and upcoming valid dates');
})().catch(error=>{console.error(error);process.exitCode=1});
