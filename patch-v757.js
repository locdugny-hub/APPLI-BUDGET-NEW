/* Budget PWA v7.5.7
   - Organisation finale du Dashboard selon le visuel cible
   - Dashboard principal volontairement synthétique
   - Détails longs déplacés hors de la vue principale
*/
'use strict';

(function installV757(){
  if(window.__budgetV757) return;
  window.__budgetV757=true;

  const style=document.createElement('style');
  style.textContent=`
    /* Dashboard = vraie vue d'ensemble */
    #view-resume{max-width:1180px;margin:0 auto;padding-bottom:96px}
    #view-resume > p.muted{display:none!important}
    #view-resume #dash-compare-card{display:none!important}
    #view-resume #dash-kpis2{display:none!important}
    #view-resume .cat-groups-card{display:none!important}
    #view-resume .syncline{margin:14px 16px 4px}

    /* Filtres */
    #view-resume .dash-dd-panel{margin:12px 16px 0;padding:12px 14px;border-radius:18px}
    #view-resume .dash-dd-summary{min-height:58px}

    /* KPI principaux : 4 cartes comme le visuel */
    #view-resume #dash-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px 16px 0}
    #view-resume #dash-kpis .kpi{min-height:142px;padding:16px 14px;border-radius:18px;display:flex;flex-direction:column;justify-content:flex-start;box-shadow:0 2px 12px rgba(18,40,75,.055)}
    #view-resume #dash-kpis .kpi::before{position:static;width:38px;height:38px;margin-bottom:10px}
    #view-resume #dash-kpis .k-l{font-size:11px}
    #view-resume #dash-kpis .k-v{font-size:25px;margin-top:7px}
    #view-resume #dash-kpis .kpi.teal{position:relative;padding-right:104px}
    .save-ring{position:absolute;right:14px;top:22px;width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .save-ring::after{content:'';position:absolute;inset:10px;background:#fff;border-radius:50%}
    .save-ring span{position:relative;z-index:1;font-size:14px;font-weight:900;color:var(--navy)}
    .k-subline{font-size:11px;color:var(--muted);margin-top:5px;font-weight:600}

    /* Evolution mensuelle, toujours immédiatement après les KPI */
    #view-resume .dash-main-chart{margin:12px 16px 0!important;padding:16px!important}
    #view-resume .dash-main-chart h3{font-size:16px;margin-bottom:8px}
    #view-resume .dash-main-chart #dash-chart{min-height:235px;overflow-x:auto}
    #view-resume .dash-main-chart #dash-chart svg{width:100%!important;min-width:620px;min-height:220px}

    /* Rangée finale : donut + top 5 */
    .dash-bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 16px 0}
    .dash-bottom-grid > .card{margin:0!important;height:100%;padding:16px!important}
    #dash-premium-breakdown{display:block!important}
    #dash-premium-breakdown h3,.dash-main-top h3{font-size:16px;margin-bottom:14px}
    .dash-main-top #dash-top .rank:nth-child(n+6){display:none!important}
    .dash-main-top #dash-top-more{display:block!important;width:100%;margin-top:12px;padding:11px;border-radius:11px;background:#EAF3FF;color:#1971D4;font-weight:800;text-decoration:none}
    .dash-main-top .rank{padding:9px 0}
    .dash-main-top .rbar{display:none}
    .dash-main-top .rr{min-width:92px}
    .dash-main-top .rp{display:none}
    .dash-main-top .rn{width:28px;height:28px;border-radius:9px}

    #dash-premium-breakdown .premium-breakdown-grid{grid-template-columns:150px 1fr;gap:18px}
    #dash-premium-breakdown .premium-donut-wrap,#dash-premium-breakdown .premium-donut{width:150px;height:150px}
    #dash-premium-breakdown .premium-donut-hole{inset:29px}
    #dash-premium-breakdown .premium-leg-row{font-size:12px}
    .dash-detail-btn{width:100%;margin-top:12px;padding:11px 12px;border:0;border-radius:11px;background:#EAF3FF;color:#1971D4;font-size:12px;font-weight:800}

    /* Détail hors dashboard principal */
    .dash-detail-sheet{position:fixed;inset:0;background:rgba(8,18,35,.45);display:none;align-items:flex-end;z-index:70}
    .dash-detail-sheet.open{display:flex}
    .dash-detail-card{width:100%;max-height:88vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(18,40,75,.18)}
    .dash-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .dash-detail-head h2{margin:0;font-size:18px;color:var(--navy)}
    .dash-detail-close{width:34px;height:34px;border:0;border-radius:10px;background:#EEF2F8;color:var(--navy);font-size:18px}
    .detail-rank{display:grid;grid-template-columns:32px 1fr auto;gap:10px;align-items:center;padding:11px 2px;border-bottom:1px solid var(--line)}
    .detail-rank .n{width:28px;height:28px;border-radius:9px;background:#EEF4FB;color:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}
    .detail-rank .name{font-size:13px;font-weight:700;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .detail-rank .amt{font-size:13px;font-weight:900;white-space:nowrap}
    .detail-section{border-top:1px solid var(--line)}
    .detail-section:first-child{border-top:0}
    .detail-section-title{display:flex;justify-content:space-between;gap:10px;padding:13px 2px;font-weight:900;color:var(--navy)}
    .detail-cat{display:flex;justify-content:space-between;gap:12px;padding:9px 2px;border-top:1px solid #F0F3F7;font-size:13px}

    @media(max-width:720px){
      #view-resume{max-width:none}
      #view-resume #dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));padding-left:10px;padding-right:10px}
      #view-resume #dash-kpis .kpi{min-height:128px;padding:13px}
      #view-resume #dash-kpis .k-v{font-size:22px}
      #view-resume #dash-kpis .kpi.teal{padding-right:82px}
      .save-ring{width:62px;height:62px;right:10px;top:27px}.save-ring::after{inset:8px}.save-ring span{font-size:12px}
      #view-resume .dash-dd-panel{margin-left:10px;margin-right:10px}
      #view-resume .dash-main-chart{margin-left:10px!important;margin-right:10px!important}
      .dash-bottom-grid{grid-template-columns:1fr;gap:10px;margin-left:10px;margin-right:10px}
      #dash-premium-breakdown .premium-breakdown-grid{grid-template-columns:128px 1fr;gap:12px}
      #dash-premium-breakdown .premium-donut-wrap,#dash-premium-breakdown .premium-donut{width:128px;height:128px}
      #dash-premium-breakdown .premium-donut-hole{inset:25px}
    }
  `;
  document.head.appendChild(style);

  function ensureDetailSheet(){
    if(document.getElementById('dash-detail-sheet')) return;
    const sheet=document.createElement('div');
    sheet.id='dash-detail-sheet'; sheet.className='dash-detail-sheet';
    sheet.innerHTML=`<div class="dash-detail-card"><div class="dash-detail-head"><h2 id="dash-detail-title">Détail</h2><button class="dash-detail-close" type="button">×</button></div><div id="dash-detail-body"></div></div>`;
    document.body.appendChild(sheet);
    sheet.querySelector('.dash-detail-close').onclick=()=>sheet.classList.remove('open');
    sheet.onclick=e=>{if(e.target===sheet) sheet.classList.remove('open');};
  }

  function selectedAgg(){
    try{
      const list=v75SelectedTabs().map(t=>({...t,stat:monthCache[t.title]&&monthCache[t.title].stat})).filter(x=>x.stat);
      return aggStats(list);
    }catch(_){ return {cats:{},secT:{},ent:0,sor:0,sol:0,n:0}; }
  }

  function showAllExpenses(){
    ensureDetailSheet();
    const a=selectedAgg();
    const cats=Object.entries(a.cats||{}).map(([label,c])=>({label,amt:Number(c.amt)||0})).filter(x=>x.amt>0).sort((x,y)=>y.amt-x.amt);
    const body=document.getElementById('dash-detail-body');
    document.getElementById('dash-detail-title').textContent='Toutes les dépenses';
    body.innerHTML=cats.map((x,i)=>`<div class="detail-rank"><span class="n">${i+1}</span><span class="name">${x.label}</span><span class="amt">${fmtEUR0(x.amt)}</span></div>`).join('')||'<p class="muted">Aucune dépense.</p>';
    document.getElementById('dash-detail-sheet').classList.add('open');
  }

  function showCategoryDetail(){
    ensureDetailSheet();
    const a=selectedAgg();
    const grouped={};
    Object.entries(a.cats||{}).forEach(([label,c])=>{
      const amt=Number(c&&c.amt)||0; if(!amt) return;
      const sec=(c&&c.sec)||'Autres';
      (grouped[sec]||(grouped[sec]=[])).push({label,amt});
    });
    const groups=Object.entries(grouped).map(([sec,items])=>({sec,items:items.sort((x,y)=>y.amt-x.amt),total:items.reduce((s,x)=>s+x.amt,0)})).sort((x,y)=>y.total-x.total);
    document.getElementById('dash-detail-title').textContent='Détail par catégorie';
    document.getElementById('dash-detail-body').innerHTML=groups.map(g=>`<div class="detail-section"><div class="detail-section-title"><span>${g.sec.replace(/^[^ ]+ /,'')}</span><span>${fmtEUR0(g.total)}</span></div>${g.items.map(x=>`<div class="detail-cat"><span>${x.label}</span><b>${fmtEUR0(x.amt)}</b></div>`).join('')}</div>`).join('')||'<p class="muted">Aucune dépense.</p>';
    document.getElementById('dash-detail-sheet').classList.add('open');
  }

  function arrangeDashboard(){
    const view=document.getElementById('view-resume');
    if(!view) return;

    // Header cible
    const title=document.getElementById('hdr-title');
    const sub=document.getElementById('hdr-month');
    if(title && document.getElementById('nav-resume')?.classList.contains('on')) title.textContent='📊 Mon Budget';
    if(sub && document.getElementById('nav-resume')?.classList.contains('on')) sub.textContent='Vue d’ensemble · '+(sub.textContent.includes('synchro')?sub.textContent.split('·').pop().trim():'Synchronisé à l’instant');

    const kpis=document.getElementById('dash-kpis');
    if(!kpis) return;

    // Anneau dans la carte taux d'épargne
    const cards=[...kpis.children];
    if(cards[3]){
      const rateText=cards[3].querySelector('.k-v')?.textContent||'0%';
      const pct=Math.max(0,Math.min(100,parseFloat(rateText.replace(',','.'))||0));
      let ring=cards[3].querySelector('.save-ring');
      if(!ring){ ring=document.createElement('div'); ring.className='save-ring'; cards[3].appendChild(ring); }
      ring.style.background=`conic-gradient(var(--teal) ${pct}%,#E8EDF4 ${pct}% 100%)`;
      ring.innerHTML=`<span>${rateText}</span>`;
      const val=cards[3].querySelector('.k-v'); if(val) val.style.visibility='hidden';
    }

    // Graphique : tag la carte qui le contient et replace juste après KPI
    const chart=document.getElementById('dash-chart');
    const chartCard=chart&&chart.closest('.card');
    if(chartCard){
      chartCard.classList.add('dash-main-chart');
      kpis.after(chartCard);
    }

    // Répartition + top dans une seule rangée
    const breakdown=document.getElementById('dash-premium-breakdown');
    const top=document.getElementById('dash-top');
    const topCard=top&&top.closest('.card');
    if(topCard) topCard.classList.add('dash-main-top');
    let grid=document.getElementById('dash-bottom-grid');
    if(!grid){
      grid=document.createElement('div'); grid.id='dash-bottom-grid'; grid.className='dash-bottom-grid';
      if(chartCard) chartCard.after(grid); else kpis.after(grid);
    }
    if(breakdown) grid.appendChild(breakdown);
    if(topCard) grid.appendChild(topCard);

    // Bouton détail sous donut
    if(breakdown && !document.getElementById('dash-cat-detail-btn')){
      const b=document.createElement('button'); b.id='dash-cat-detail-btn'; b.className='dash-detail-btn'; b.type='button'; b.textContent='Voir le détail par catégorie  →'; b.onclick=showCategoryDetail; breakdown.appendChild(b);
    }

    // Top 5 seulement sur la page principale
    const more=document.getElementById('dash-top-more');
    if(more){ more.textContent='Voir toutes les dépenses  →'; more.onclick=showAllExpenses; }

    // Masquer les éléments analytiques secondaires de la vue principale
    const groups=document.querySelector('.cat-groups-card'); if(groups) groups.style.display='none';
    const comp=document.getElementById('dash-compare-card'); if(comp) comp.style.display='none';
    const k2=document.getElementById('dash-kpis2'); if(k2) k2.style.display='none';
  }

  const previousRender=renderDashboard;
  renderDashboard=async function(){
    await previousRender();
    requestAnimationFrame(()=>requestAnimationFrame(arrangeDashboard));
  };
})();
