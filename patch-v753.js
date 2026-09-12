/* Budget PWA v7.5.3
   - Dashboard mobile compact + sections/catégories dynamiques
   - Auth Google plus fluide : reconnexion silencieuse + login_hint mémorisé
*/
'use strict';

(function installV753(){
  if(window.__budgetV753) return;
  window.__budgetV753=true;

  const AUTH_SCOPE=SCOPE+' openid email';
  const LOGIN_HINT_KEY='google_login_hint';

  async function rememberGoogleIdentity(token){
    try{
      const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token}`}});
      if(!r.ok) return;
      const u=await r.json();
      if(u&&u.email) localStorage.setItem(LOGIN_HINT_KEY,String(u.email));
    }catch(_){ }
  }

  initAuth=function(){
    if(!CFG.clientId) return false;
    const hint=localStorage.getItem(LOGIN_HINT_KEY)||undefined;
    tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:CFG.clientId,
      scope:AUTH_SCOPE,
      login_hint:hint,
      callback:()=>{}
    });
    return true;
  };

  requestToken=function(opts={}){
    const interactive=!!opts.interactive;
    return new Promise((resolve,reject)=>{
      if(!tokenClient){ reject(new Error('Client OAuth non initialisé (Réglages).')); return; }
      tokenClient.callback=async r=>{
        if(r&&r.access_token){
          accessToken=r.access_token;
          tokenExpiry=Date.now()+((r.expires_in||3300)*1000);
          saveTok();
          rememberGoogleIdentity(accessToken);
          resolve(r.access_token);
        } else reject(new Error((r&&r.error_description)||'Échec de connexion Google.'));
      };
      tokenClient.error_callback=e=>reject(new Error((e&&e.type)||'Connexion Google indisponible.'));
      const cfg={prompt:interactive?'':'none'};
      const hint=localStorage.getItem(LOGIN_HINT_KEY);
      if(hint) cfg.login_hint=hint;
      tokenClient.requestAccessToken(cfg);
    });
  };

  ensureToken=async function(){
    if(accessToken&&Date.now()<tokenExpiry-60000) return accessToken;
    try{ return await requestToken({interactive:false}); }
    catch(e){ showReconnect(); throw new Error('Session Google à renouveler'); }
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('btn-connect');
    if(btn){
      btn.textContent='Continuer avec Google';
      btn.onclick=()=>{
        if(!CFG.clientId||!CFG.sheetId){ toast("Renseigne d'abord tes identifiants (Réglages).",true); openSettings(); return; }
        if(!(window.google&&google.accounts&&google.accounts.oauth2)){ toast('Google se charge, réessaie dans 2 s…',true); return; }
        if(!tokenClient) initAuth();
        requestToken({interactive:true}).then(()=>onAuthed()).catch(e=>toast(e.message,true));
      };
    }
  });

  const style=document.createElement('style');
  style.textContent=`
    #view-resume .dash-caption{margin-top:8px}
    #view-resume .chips{padding-top:8px}
    #view-resume .kpis.xl{gap:8px;padding-top:10px}
    #view-resume .kpis.mini{gap:8px;padding-top:8px}
    #view-resume .kpis.mini .kpi{padding:10px 12px}
    #view-resume .kpis.mini .k-v{font-size:16px}
    .dash-filter-label{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.45px;margin:10px 16px 0}
    .dash-scope{margin:10px 16px 0;padding:9px 11px;border-radius:12px;background:#EEF3F9;color:var(--navy);font-size:12px;font-weight:700}
    .dash-scope.forecast{background:#FFF4DF;color:#8A5A00}
    .cat-groups-card{padding:0;overflow:hidden}
    .cat-group{border-top:1px solid var(--line)}
    .cat-group:first-child{border-top:0}
    .cat-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;background:#fff;border:0;text-align:left}
    .cat-head-left{display:flex;align-items:center;gap:9px;min-width:0}
    .cat-dot{width:10px;height:10px;border-radius:50%;flex:none}
    .cat-head-title{font-size:14px;font-weight:800;color:var(--navy)}
    .cat-head-total{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap}
    .cat-list{display:none;padding:0 14px 10px;background:#FBFCFE}
    .cat-group.open .cat-list{display:block}
    .cat-line{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
    .cat-line:last-child{border-bottom:0}
    .cat-line .name{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cat-line .amt{font-weight:800;white-space:nowrap}
    .cat-share{font-size:11px;color:var(--muted);margin-left:5px}
  `;
  document.head.appendChild(style);

  function ensureFilterLabels(){
    const view=document.getElementById('view-resume');
    const years=document.getElementById('dash-years'), months=document.getElementById('dash-months'), status=document.getElementById('dash-status');
    if(years&&!document.getElementById('lbl-years')){ const x=document.createElement('div');x.id='lbl-years';x.className='dash-filter-label';x.textContent='Années';years.before(x); }
    if(months&&!document.getElementById('lbl-months')){ const x=document.createElement('div');x.id='lbl-months';x.className='dash-filter-label';x.textContent='Mois';months.before(x); }
    if(status&&!document.getElementById('dash-scope')){ const x=document.createElement('div');x.id='dash-scope';x.className='dash-scope';status.after(x); }
    if(view&&!document.getElementById('dash-category-groups')){
      const sec=document.getElementById('dash-sections');
      if(sec&&sec.parentElement){
        const card=document.createElement('div');card.className='card cat-groups-card';
        card.innerHTML='<h3 style="padding:14px 14px 4px;margin:0">📂 Catégories par section</h3><div id="dash-category-groups"></div>';
        sec.parentElement.after(card);
      }
    }
  }

  function selectedList(){
    try{
      const tabs=v75SelectedTabs();
      return tabs.map(t=>({...t,stat:monthCache[t.title]&&monthCache[t.title].stat})).filter(x=>x.stat);
    }catch(_){ return []; }
  }

  function sectionColor(name){
    const m=SEC_META.find(([k])=>String(name).includes(k));
    return m?m[1]:'#9AA5B1';
  }

  function enhanceDashboard(){
    ensureFilterLabels();
    const scopeEl=document.getElementById('dash-scope');
    if(scopeEl){
      const ys=(dash.years||[]).join(' + ')||'—';
      const ms=dash.month==null?'Tous les mois':MONTHS_FR[dash.month];
      const st=dash.status==='forecast'?'Prévisionnel':dash.status==='all'?'Réalisé + prévisionnel':'Réalisé';
      scopeEl.textContent=`${ys} · ${ms} · ${st}`;
      scopeEl.classList.toggle('forecast',dash.status==='forecast');
    }
    const host=document.getElementById('dash-category-groups');
    if(!host) return;
    const list=selectedList();
    const agg=aggStats(list);
    const grouped={};
    Object.entries(agg.cats||{}).forEach(([label,c])=>{
      if(!c||!c.amt) return;
      const sec=c.sec||'Autres';
      (grouped[sec]||(grouped[sec]=[])).push({label,amt:c.amt});
    });
    const groups=Object.entries(grouped).map(([sec,items])=>({sec,items:items.sort((a,b)=>b.amt-a.amt),total:items.reduce((s,x)=>s+x.amt,0)})).sort((a,b)=>b.total-a.total);
    host.innerHTML='';
    if(!groups.length){ host.innerHTML='<p class="muted" style="padding:0 14px 14px">Aucune dépense sur cette sélection.</p>'; return; }
    groups.forEach((g,idx)=>{
      const wrap=document.createElement('div');wrap.className='cat-group'+(idx===0?' open':'');
      const head=document.createElement('button');head.className='cat-head';
      head.innerHTML=`<span class="cat-head-left"><i class="cat-dot" style="background:${sectionColor(g.sec)}"></i><span class="cat-head-title">${g.sec.replace(/^[^ ]+ /,'')}</span></span><span class="cat-head-total">${fmtEUR0(g.total)} ▾</span>`;
      const body=document.createElement('div');body.className='cat-list';
      g.items.forEach(it=>{
        const r=document.createElement('div');r.className='cat-line';
        const pct=g.total?Math.round(it.amt/g.total*100):0;
        r.innerHTML=`<span class="name">${it.label}<span class="cat-share">${pct}%</span></span><span class="amt">${fmtEUR0(it.amt)}</span>`;
        r.onclick=()=>openCatYear(it.label);
        body.appendChild(r);
      });
      head.onclick=()=>wrap.classList.toggle('open');
      wrap.append(head,body);host.appendChild(wrap);
    });
  }

  const previousRender=renderDashboard;
  renderDashboard=async function(){
    await previousRender();
    enhanceDashboard();
  };
})();
