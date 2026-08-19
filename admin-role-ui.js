// TODO AI role-based Admin UI. Supabase profiles.role is the source of truth.
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const backend=()=>window.TSSBackend;

  function ensureStyles(){
    if($('tssAdminRoleStyle'))return;
    const s=document.createElement('style');s.id='tssAdminRoleStyle';
    s.textContent=`
      #adminView .admin-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0 20px}
      #adminView .admin-stat{background:#091c2b;border:1px solid #23445c;border-radius:12px;padding:16px}
      #adminView .admin-stat small{display:block;color:#83a4ba;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      #adminView .admin-stat strong{font-size:25px;color:#eef8ff}
      #adminUsersTable{overflow:auto}
      #adminUsersTable table{width:100%;border-collapse:collapse;min-width:720px}
      #adminUsersTable th,#adminUsersTable td{text-align:left;padding:12px 14px;border-bottom:1px solid #17374d;font-size:12px}
      #adminUsersTable th{color:#83a4ba;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
      .admin-role-pill{display:inline-flex;padding:4px 8px;border:1px solid #315b77;border-radius:999px;background:#0a2031;color:#d9efff;font-size:10px;font-weight:700;text-transform:capitalize}
      .admin-status-active{color:#77e3aa}.admin-status-inactive{color:#ef9b9b}
      @media(max-width:760px){#adminView .admin-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function ensureSection(){
    const nav=$('nav');const main=document.querySelector('.main-shell');if(!nav||!main)return null;
    let navBtn=$('adminNavBtn');
    if(!navBtn){
      navBtn=document.createElement('button');navBtn.id='adminNavBtn';navBtn.className='nav-item';navBtn.dataset.view='adminView';navBtn.innerHTML='<span>⚙</span>Admin';nav.appendChild(navBtn);
    }
    let view=$('adminView');
    if(!view){
      view=document.createElement('section');view.id='adminView';view.className='view';
      view.innerHTML=`<div class="section-head"><div><span>ADMINISTRATION</span><h1>Admin Control Center</h1><p>User access and TODO AI workspace overview.</p></div></div><div class="admin-summary"><div class="admin-stat"><small>Total users</small><strong id="adminTotalUsers">0</strong></div><div class="admin-stat"><small>Active users</small><strong id="adminActiveUsers">0</strong></div><div class="admin-stat"><small>Admins</small><strong id="adminTotalAdmins">0</strong></div></div><article class="old-panel"><div class="panel-title"><div><span class="purple-label">USER ACCESS</span><h2>Workspace Users</h2></div></div><div id="adminUsersTable"><div class="empty-state">Loading users…</div></div></article>`;
      main.appendChild(view);
    }
    navBtn.onclick=()=>{
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      document.querySelectorAll('#nav .nav-item').forEach(b=>b.classList.remove('active'));
      view.classList.add('active');navBtn.classList.add('active');
      if($('pageTitle'))$('pageTitle').textContent='Administration';
      renderUsers();
    };
    return {navBtn,view};
  }

  async function currentProfile(){
    const c=backend()?.client;if(!c)return null;
    const {data:{session}}=await c.auth.getSession();if(!session?.user)return null;
    const email=String(session.user.email||'').toLowerCase();
    const {data,error}=await c.from('profiles').select('id,email,full_name,role,is_active').ilike('email',email).maybeSingle();
    if(error){console.warn('Admin profile lookup',error.message);return null;}
    return data||null;
  }

  async function renderUsers(){
    const wrap=$('adminUsersTable');if(!wrap)return;
    try{
      const c=backend()?.client;if(!c)return;
      const {data,error}=await c.from('profiles').select('email,full_name,role,is_active').order('email');
      if(error)throw error;
      const users=data||[];
      if($('adminTotalUsers'))$('adminTotalUsers').textContent=String(users.length);
      if($('adminActiveUsers'))$('adminActiveUsers').textContent=String(users.filter(x=>x.is_active).length);
      if($('adminTotalAdmins'))$('adminTotalAdmins').textContent=String(users.filter(x=>String(x.role||'').toLowerCase()==='admin').length);
      wrap.innerHTML=`<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.full_name||'—')}</td><td>${esc(u.email||'—')}</td><td><span class="admin-role-pill">${esc(u.role||'recruiter')}</span></td><td class="${u.is_active?'admin-status-active':'admin-status-inactive'}">${u.is_active?'Active':'Inactive'}</td></tr>`).join('')}</tbody></table>`;
    }catch(e){wrap.innerHTML=`<div class="empty-state">Could not load users: ${esc(e?.message||e)}</div>`;}
  }

  async function boot(){
    ensureStyles();
    try{
      const profile=await currentProfile();
      const isAdmin=Boolean(profile?.is_active)&&String(profile?.role||'').toLowerCase()==='admin';
      if(!isAdmin){$('adminNavBtn')?.remove();$('adminView')?.remove();return false;}
      ensureSection();await renderUsers();
      console.info('TODO AI Admin enabled for',profile?.email);
      return true;
    }catch(e){console.warn('Admin UI boot',e?.message||e);return false;}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900),{once:true});else setTimeout(boot,900);
  window.TSSAdminRoleUI={boot,renderUsers};
})();