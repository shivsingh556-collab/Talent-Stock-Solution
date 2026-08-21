// Wire dashboard action buttons that are otherwise presentation-only.
(function(){
  function go(view){
    try{
      if(typeof window.gotoView==='function') return window.gotoView(view);
      const btn=document.querySelector(`.nav-item[data-view="${view}"]`);
      if(btn) return btn.click();
      document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
    }catch(e){console.warn('TODO AI dashboard navigation',e)}
  }

  function wire(){
    const pipeline=[...document.querySelectorAll('.pipeline-card .text-btn')]
      .find(b=>(b.textContent||'').trim().toLowerCase().includes('view full pipeline'));
    if(pipeline && !pipeline.dataset.pipelineWired){
      pipeline.dataset.pipelineWired='1';
      pipeline.addEventListener('click',e=>{
        e.preventDefault();
        go('candidates');
      });
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
  setTimeout(wire,300);
  window.TSSDashboardActions={wire};
})();
