(function(){
  'use strict';
  function unique(rows=[]){
    const pairs=new Map();
    for(const row of rows){
      if(row.countsForPerformance===false)continue;
      const candidate=row.candidateId||row.candidate_id,requirement=row.requirementId||row.requirement_id;
      if(!candidate||!requirement)continue;
      const key=JSON.stringify([candidate,requirement]);
      const previous=pairs.get(key);
      const stamp=x=>Date.parse(x.date||x.screened_at||'')||0;
      if(!previous||stamp(row)<stamp(previous)||(stamp(row)===stamp(previous)&&String(row.id)<String(previous.id)))pairs.set(key,row);
    }
    return [...pairs.values()];
  }
  function latest(rows=[]){
    const pairs=new Map();
    for(const row of rows){
      const candidate=row.candidateId||row.candidate_id,requirement=row.requirementId||row.requirement_id;
      if(!candidate||!requirement)continue;
      const key=JSON.stringify([candidate,requirement]),previous=pairs.get(key);
      if(!previous||Date.parse(row.date||row.screened_at)>=Date.parse(previous.date||previous.screened_at))pairs.set(key,row);
    }
    return [...pairs.values()];
  }
  window.TSSScreeningCounts={unique,latest};
})();
