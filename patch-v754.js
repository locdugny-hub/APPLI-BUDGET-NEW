/* Budget PWA v7.5.4
   - Dashboard mobile premium, plus proche du design cible
   - KPI principaux en logique cash totale, sans retraitement : toutes les entrées et sorties sont conservées
   - Répartition visuelle par section + filtres regroupés
*/
'use strict';

(function installV754(){
  if(window.__budgetV754) return;
  window.__budgetV754=true;

  const style=document.createElement('style');
  style.textContent=`
    #view-resume{padding-bottom:110px}
    #view-resume .dash-filter-panel{margin:12px 12px 0;background:#fff;border:1px solid var(--line);border-radius:18px;padding:12px;box-shadow:0 2px 10px rgba(18,40,75,.05)}
    #view-resume .dash-filter-panel .dash-filter-label{margin:8px 2px 6px;font-size:10px}
    #view-resume .dash-filter-panel .chips{padding:0;gap:7px}
    #view-resume .dash-filter-panel .chip{padding:10px 14px;border-radius:16px;font-size:13px}
    #view-resume .dash-filter-panel .dash-caption{margin:10px 2px 6px;font-size:10px}
    #view-resume .dash-scope{margin:10px 0 0;padding:11px 12px;border-radius:14px;background:linear-gradient(135deg,#EEF5FF,#F6F9FD);font-size:12px;line-height:1.35}
    #view-resume .dash-scope::after{content:' · Tous les flux cash inclus';font-weight:600;color:var(--muted)}
    #view-resume .dash-scope.forecast::after{content:' · Tous les flux prévisionnels inclus'}

    #view-resume #dash-kpis{gap:10px;padding:12px 12px 0}
    #view-resume #dash-kpis .kpi{position:relative;min-height:132px;border-radius:18px;padding:16px 14px 14px 58px;box-shadow:0 2px 10px rgba(18,40,75,.05);overflow:hidden}
    #view-resume #dash-kpis .kpi::before{position:absolute;left:14px;top:16px;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900}
    #view-resume #dash-kpis .kpi.green::before{content:'↓';background:#E7F7EE;color:var(--green)}
    #view-resume #dash-kpis .kpi.red::before{content:'↑';background:#FDEBED;color:var(--red)}
    #view-resume #dash-kpis .kpi.navy::before{content:'€';background:#EAF1FB;color:var(--blue)}
    #view-resume #dash-kpis .kpi.teal::before{content:'%';background:#E5F7F5;color:var(--teal)}
    #view-resume #dash-kpis .k-l{font-size:10px;margin-top:2px}
    #view-resume #dash-kpis .k-v{font-size:25px;margin-top:10px;letter-spacing:-.5px}

    #view-resume #dash-kpis2{gap:8px;padding:8px 12px 0}
    #view-resume #dash-kpis2 .kpi{border-radius:14px;padding:10px 12px;min-height:76px;background:#FBFCFE}
    #view-resume #dash-kpis2 .k-v{font-size:16px}

    #view-resume .card{margin:12px 12px 0;border-radius:18px;box-shadow:0 2px 10px rgba(18,40,75,.04)}
    #view-resume .card h3{font-size:15px;margin-bottom:12px}
    #view-resume #dash-compare-card{padding:16px}
    #view-resume #dash-chart{padding-bottom:6px}
    #view-resume #dash-chart svg{min-width:100%}

    #dash-premium-breakdown{padding:16px}
    .premium-breakdown-grid{display:grid;grid-template-columns:132px 1fr;gap:16px;align-items:center}
    .premium-donut-wrap{position:relative;width:132px;height:132px;margin:auto}
    .premium-donut{width:132px;height:132px;border-radius:50%;position:absolute;inset:0}
    .premium-donut-hole{position:absolute;inset:24px;background:#fff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:inset 0 0 0 1px #EEF2F8}
    .premium-donut-hole b{font-size:16px;color:var(--navy)}
    .premium-donut-hole span{font-size:10px;color:var(--muted);margin-top:2px}
    .premium-legend{display:flex;flex-direction:column;gap:8px}
    .premium-leg-row{display:grid;grid-template-columns:10px 1fr auto;gap:7px;align-items:center;font-size:12px}
    .premium-leg-dot{width:9px;height:9px;border-radius:50%}
    .premium-leg-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .premium-leg-val{font-weight:800;white-space:nowrap;color:var(--navy)}

    #view-resume .premium-top-card .rank{padding:10px 0}
    #view-resume .premium-top-card .rn{background:#EEF4FB;color:var(--blue);border-radius:9px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:800}
    #view-resume .premium-top-card .ra{font-size:13px}

    #view-resume .cat-groups-card h3{font-size:15px}
    #view-resume .cat-head{padding:14px}
    #view-resume .cat-head-title{font-size:14px}
    #view-resume .cat-head-total{font-size:14px}

    @media(max-width:390px){
      #view-resume #dash-kpis .kpi{padding-left:50px;min-height:124px}
      #view-resume #dash-kpis .kpi::before{left:11px;width:30px;height:30px}
      #view-resume #dash-kpis .k-v{font-size:22px}
      .premium-breakdown-grid{grid-template-columns:112px 1fr;gap:12px}
      .premium-donut-wrap,.premium-donut{width:112px;height:112px}
      .premium-donut-hole{inset:21px}
      .premium-leg-row{font-size:11px}
    }
  `;
  document.head.appendChild(style);

  function sectionColor(name){
    const meta=SEC_META.find(([k])=>String(name).includes(k));
    return meta?meta[1]:'#9AA5B1';
  }

  function selectedList(){
    try{
      return v75SelectedTabs().map(t=>({...t,stat:monthCache[t.title]&&monthCache[t.title].stat})).filter(x=>x.stat);
    }catch(_){ return []; }
  }

  function regroupFilters(){
    const view=document.getElementById('view-resume');
    if(!view || document.getElementById('dash-filter-panel')) return;
    const years=document.getElementById('dash-years');
    const months=document.getElementById('dash-months');
    const status=document.getElementById('dash-status');
    if(!years||!months||!status) return;
    const yl=document.getElementById('lbl-years');
    const ml=document.getElementById('lbl-months');
    const scope=document.getElementById('dash-scope');
    let statusLabel=status.previousElementSibling;
    if(!(statusLabel&&statusLabel.classList.contains('dash-caption'))) statusLabel=null;
    const panel=document.createElement('div'); panel.id='dash-filter-panel'; panel.className='dash-filter-panel';
    if(yl) panel.appendChild(yl); panel.appendChild(years);
    if(ml) panel.appendChild(ml); panel.appendChild(months);
    if(statusLabel) panel.appendChild(statusLabel); panel.appendChild(status);
    if(scope) panel.appendChild(scope);
    const firstKpi=document.getElementById('dash-kpis');
    if(firstKpi) firstKpi.before(panel); else view.prepend(panel);
  }

  function addBreakdown(){
    const list=selectedList();
    const agg=aggStats(list);
    const vals=Object.entries(agg.secT||{}).map(([name,val])=>({name:name.replace(/^[^ ]+ /,''),raw:name,val:Number(val)||0,color:sectionColor(name)})).filter(x=>x.val>0).sort((a,b)=>b.val-a.val);
    const total=vals.reduce((s,x)=>s+x.val,0);
    let card=document.getElementById('dash-premium-breakdown');
    const old=document.getElementById('dash-sections');
    if(old&&old.parentElement) old.parentElement.style.display='none';
    if(!card){
      card=document.createElement('div'); card.id='dash-premium-breakdown'; card.className='card';
      const groups=document.querySelector('.cat-groups-card');
      if(groups) groups.before(card);
      else if(old&&old.parentElement) old.parentElement.after(card);
    }
    if(!vals.length){ card.innerHTML='<h3>◔ Répartition des dépenses</h3><p class="muted">Aucune dépense sur cette sélection.</p>'; return; }
    let cur=0,parts=[];
    vals.forEach(x=>{const start=cur;cur+=x.val/total*100;parts.push(`${x.color} ${start.toFixed(2)}% ${cur.toFixed(2)}%`);});
    const legend=vals.slice(0,7).map(x=>`<div class="premium-leg-row"><i class="premium-leg-dot" style="background:${x.color}"></i><span class="premium-leg-name">${x.name}</span><span class="premium-leg-val">${Math.round(x.val/total*100)}%</span></div>`).join('');
    card.innerHTML=`<h3>◔ Répartition des dépenses</h3><div class="premium-breakdown-grid"><div class="premium-donut-wrap"><div class="premium-donut" style="background:conic-gradient(${parts.join(',')})"></div><div class="premium-donut-hole"><b>${fmtEUR0(total)}</b><span>Total sorties</span></div></div><div class="premium-legend">${legend}</div></div>`;
  }

  function polishCards(){
    const top=document.getElementById('dash-top'); if(top&&top.parentElement) top.parentElement.classList.add('premium-top-card');
    const scope=document.getElementById('dash-scope');
    if(scope && !scope.dataset.cash){ scope.dataset.cash='1'; }
  }

  function enhance(){
    regroupFilters();
    addBreakdown();
    polishCards();
  }

  const prev=renderDashboard;
  renderDashboard=async function(){
    await prev();
    requestAnimationFrame(enhance);
  };
})();
