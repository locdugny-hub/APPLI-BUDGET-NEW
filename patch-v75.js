/* Budget PWA v7.5
   - Dashboard mobile multi-années / mois / réalisé-prévisionnel
   - Création automatique des mois au bon emplacement physique dans Google Sheets
   - Les nouveaux mois sont dupliqués depuis Modèle mois pour conserver structure + forme + base prévisionnelle
*/
'use strict';

/* ---------- UI dashboard v7.5 ---------- */
(function installV75UI(){
  const style=document.createElement('style');
  style.textContent=`
    #dash-status{display:flex}
    .dash-caption{font-size:11px;color:var(--muted);margin:8px 16px 0;font-weight:700;text-transform:uppercase;letter-spacing:.35px}
    .year-summary{display:grid;grid-template-columns:64px 1fr 1fr;gap:5px 8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:12px}
    .year-summary:last-child{border-bottom:0}
    .year-summary .ys-year{font-size:16px;font-weight:800;color:var(--navy)}
    .year-summary .ys-solde{grid-column:2/4;font-size:13px;font-weight:800}
    .year-summary .pos{color:var(--green)} .year-summary .neg{color:var(--red)}
    #dash-chart{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
    #dash-chart svg{display:block;max-width:none}
    .dash-period-note{font-size:11px;color:var(--muted);margin:8px 16px 0}
  `;
  document.head.appendChild(style);

  const months=document.getElementById('dash-months');
  if(months && !document.getElementById('dash-status')){
    const cap=document.createElement('div'); cap.className='dash-caption'; cap.textContent='Statut';
    const status=document.createElement('div'); status.className='chips sub'; status.id='dash-status';
    months.after(cap,status);
  }
})();

dash={years:[new Date().getFullYear()],month:null,status:'realized',topAll:false};

async function v75SheetProperties(){
  const r=await api('',{params:{fields:'sheets.properties(sheetId,title,index)'}});
  return (r.sheets||[]).map(s=>s.properties);
}
function v75MonthOrd(y,m){ return y*12+m; }
async function v75InsertIndex(y,m,props){
  const target=v75MonthOrd(y,m);
  const monthly=props.map(p=>{
    const d=parseMonthTitle(p.title);
    return d?{title:p.title,y:d.y,m:d.m,index:p.index,ord:v75MonthOrd(d.y,d.m)}:null;
  }).filter(Boolean);
  const next=monthly.filter(t=>t.ord>target).sort((a,b)=>a.ord-b.ord)[0];
  if(next) return next.index;
  const prev=monthly.filter(t=>t.ord<target).sort((a,b)=>b.ord-a.ord)[0];
  if(prev) return prev.index+1;
  return 0;
}

createMonthFromTemplate=async function(y,m,interactive=true){
  await loadMeta(true);
  const tab=`${MONTHS_FR[m]} ${y}`;
  if(monthTabs.some(t=>t.y===y&&t.m===m)) return tabTitleFor(y,m);
  if(!interactive) throw new Error(`L'onglet « ${tab} » n'existe pas encore.`);
  if(!(await infraReady())) throw new Error('Le Google Sheet doit contenir Modèle mois et les index techniques.');
  const props=await v75SheetProperties();
  const source=props.find(p=>p.title===MODEL);
  if(!source) throw new Error(`Onglet « ${MODEL} » introuvable.`);
  const insertSheetIndex=await v75InsertIndex(y,m,props);
  if(!confirm(`L'onglet « ${tab} » n'existe pas encore.\n\nLe créer maintenant à partir de « ${MODEL} » ?`)) throw new Error('Création du mois annulée.');
  await api(':batchUpdate',{method:'POST',body:{requests:[{duplicateSheet:{sourceSheetId:source.sheetId,insertSheetIndex,newSheetName:tab}}]}});
  metaAt=0;
  await loadMeta(true);
  await valuesUpdate(`'${tab}'!A1`,`${MONTHS_FR[m].toUpperCase()} ${y}`,'RAW');
  delete structCache[tab];
  await applyRecurringValues(tab);
  await syncMonthIndex(tab);
  metaAt=0;
  await loadMeta(true);
  gridSections=null;
  toast(`✅ ${tab} créé au bon emplacement`);
  return tab;
};

chartSVG=function(items,selIdx){
  const W=Math.max(360,56+Math.max(1,items.length)*36),H=198,L=42,Bm=28,T=12,Rm=8;
  const n=Math.max(1,items.length), iw=(W-L-Rm)/n;
  const maxV=Math.max(1,...items.map(i=>Math.max(i.ent||0,i.sor||0,Math.abs(i.sol||0))));
  const y=v=>T+(H-T-Bm)*(1-(Math.max(0,v)/maxV)), y0=H-Bm;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  [1,.5].forEach(f=>{const yy=y(maxV*f);s+=`<line x1="${L}" x2="${W-Rm}" y1="${yy}" y2="${yy}" stroke="#E3E9F2" stroke-dasharray="3 3"/><text x="${L-5}" y="${yy+3}" font-size="9" fill="#9AA5B1" text-anchor="end">${kfmt(maxV*f)}</text>`;});
  s+=`<line x1="${L}" x2="${W-Rm}" y1="${y0}" y2="${y0}" stroke="#CBD5E4"/>`;
  const bw=Math.min(11,Math.max(5,iw*.28));
  items.forEach((it,i)=>{
    const cx=L+iw*i+iw/2;
    s+=`<rect x="${cx-bw-1}" y="${y(it.ent)}" width="${bw}" height="${Math.max(1,y0-y(it.ent))}" rx="2" fill="${CHART_GREEN}"/>`;
    s+=`<rect x="${cx+1}" y="${y(it.sor)}" width="${bw}" height="${Math.max(1,y0-y(it.sor))}" rx="2" fill="${CHART_RED}"/>`;
    if(selIdx===i) s+=`<rect x="${L+iw*i}" y="1" width="${iw}" height="${H-2}" fill="none" stroke="#2E6FB7" stroke-width="1.5" rx="4"/>`;
    s+=`<text x="${cx}" y="${H-10}" font-size="9" fill="#6B7280" text-anchor="middle">${it.label}</text>`;
  });
  if(items.length>1){
    const pts=items.map((it,i)=>`${L+iw*i+iw/2},${y(Math.max(0,it.sol))}`);
    s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${CHART_INK}" stroke-width="2"/>`;
  }
  items.forEach((it,i)=>{
    const cx=L+iw*i+iw/2;
    s+=`<circle cx="${cx}" cy="${y(Math.max(0,it.sol))}" r="3" fill="${it.sol>=0?CHART_INK:CHART_RED}"/>`;
    s+=`<rect data-tap="${i}" x="${L+iw*i}" y="0" width="${iw}" height="${H}" fill="transparent"><title>${it.title||it.label}</title></rect>`;
  });
  return s+'</svg>';
};

function v75StatusOk(t,now=new Date()){
  const current=v75MonthOrd(now.getFullYear(),now.getMonth());
  const k=v75MonthOrd(t.y,t.m);
  if(dash.status==='all') return true;
  if(dash.status==='forecast') return k>current;
  return k<=current;
}
function v75SelectedTabs(){
  return monthTabs.filter(t=>(dash.years||[]).includes(t.y)).filter(t=>v75StatusOk(t)).filter(t=>dash.month==null||t.m===dash.month).sort((a,b)=>a.y-b.y||a.m-b.m);
}
function v75YearAggregate(list,y){ return aggStats(list.filter(x=>x.y===y)); }

renderDashboard=async function(){
  const yc=$('#dash-years'), mc=$('#dash-months'), sc=$('#dash-status');
  const kp=$('#dash-kpis'), kp2=$('#dash-kpis2');
  kp.innerHTML='<p class="muted" style="grid-column:1/3">Chargement…</p>'; kp2.innerHTML='';
  try{ await loadMeta(); }
  catch(e){ kp.innerHTML=`<p class="muted" style="grid-column:1/3">Connexion impossible : ${e.message}</p>`; return; }
  const allTabs=monthTabs.slice().sort((a,b)=>a.y-b.y||a.m-b.m);
  const years=[...new Set(allTabs.map(t=>t.y))].sort((a,b)=>a-b);
  if(!years.length){ yc.innerHTML=''; mc.style.display='none'; kp.innerHTML='<p class="muted" style="grid-column:1/3">Aucun onglet mensuel détecté.</p>'; return; }
  dash.years=(dash.years||[]).filter(y=>years.includes(y));
  if(!dash.years.length){ const cy=new Date().getFullYear(); dash.years=[years.includes(cy)?cy:years[years.length-1]]; }
  yc.innerHTML='';
  years.forEach(yv=>{
    const on=dash.years.includes(yv);
    const b=el('button','chip'+(on?' on':''),String(yv));
    b.onclick=()=>{ if(on){ if(dash.years.length===1) return; dash.years=dash.years.filter(y=>y!==yv); } else dash.years=[...dash.years,yv].sort((a,b)=>a-b); renderDashboard(); };
    yc.appendChild(b);
  });
  const allBtn=el('button','chip'+(dash.years.length===years.length?' on':''),'Tout');
  allBtn.onclick=()=>{ dash.years=dash.years.length===years.length?[years[years.length-1]]:years.slice(); dash.month=null; renderDashboard(); };
  yc.appendChild(allBtn);
  const availableMonths=[...new Set(allTabs.filter(t=>dash.years.includes(t.y)).map(t=>t.m))].sort((a,b)=>a-b);
  if(dash.month!=null&&!availableMonths.includes(dash.month)) dash.month=null;
  mc.style.display='flex'; mc.innerHTML='';
  const allM=el('button','chip'+(dash.month==null?' on':''),'Tous les mois'); allM.onclick=()=>{dash.month=null;renderDashboard();}; mc.appendChild(allM);
  availableMonths.forEach(m=>{ const b=el('button','chip'+(dash.month===m?' on':''),MONTHS_SHORT[m]); b.onclick=()=>{dash.month=m;renderDashboard();}; mc.appendChild(b); });
  if(sc){ sc.innerHTML=''; [['realized','Réalisé'],['forecast','Prévisionnel'],['all','Tout']].forEach(([v,l])=>{ const b=el('button','chip'+(dash.status===v?' on':''),l); b.onclick=()=>{dash.status=v;renderDashboard();}; sc.appendChild(b); }); }
  const selectedTabs=v75SelectedTabs();
  const previousYearTabs=(dash.years.length===1)?allTabs.filter(t=>t.y===dash.years[0]-1&&v75StatusOk(t)&&(dash.month==null||t.m===dash.month)):[];
  const need=[...new Set([...selectedTabs,...previousYearTabs].map(t=>t.title))];
  let stats;
  try{ stats=await loadMonths(need); }
  catch(e){ kp.innerHTML=`<p class="muted" style="grid-column:1/3">Erreur de synchronisation : ${e.message}</p>`; return; }
  updateSyncLine();
  const list=selectedTabs.map(t=>({...t,stat:stats[t.title]}));
  const scope=aggStats(list);
  const monthsCount=Math.max(1,scope.n||selectedTabs.length||1);
  const rate=scope.ent?scope.sol/scope.ent:0;
  kp.innerHTML='';
  kp.appendChild(kpi('Entrées',fmtEUR0(scope.ent),'green'));
  kp.appendChild(kpi('Sorties',fmtEUR0(scope.sor),'red'));
  kp.appendChild(kpi('Solde',fmtEUR0(scope.sol),scope.sol>=0?'green':'red'));
  kp.appendChild(kpi("Taux d'épargne",(rate*100).toFixed(1).replace('.',',')+' %','teal'));
  kp2.innerHTML='';
  kp2.appendChild(kpi('Sorties / mois',fmtEUR0(scope.sor/monthsCount)));
  kp2.appendChild(kpi('Entrées / mois',fmtEUR0(scope.ent/monthsCount)));
  const catsSorted=Object.entries(scope.cats||{}).map(([l,c])=>({l,amt:c.amt,sec:c.sec})).sort((a,b)=>b.amt-a.amt);
  kp2.appendChild(kpi('1er poste',catsSorted.length?short(catsSorted[0].l):'—','navy'));
  kp2.appendChild(kpi('Mois analysés',String(scope.n||0),'navy'));
  const open=$('#dash-open-month');
  if(dash.month!=null&&dash.years.length===1){ open.style.display='block'; open.textContent=`Ouvrir ${MONTHS_FR[dash.month]} ${dash.years[0]} dans Mois ›`; open.onclick=()=>{moisDate=new Date(dash.years[0],dash.month,1);switchTab('mois');}; } else open.style.display='none';
  const cc=$('#dash-compare-card');
  if(dash.years.length>1){
    cc.style.display='block'; $('#dash-compare-title').textContent='📊 Synthèse par année'; $('#dash-compare-note').style.display='none'; let html='';
    dash.years.forEach(y=>{ const a=v75YearAggregate(list,y), r=a.ent?a.sol/a.ent:0; html+=`<div class="year-summary"><div class="ys-year">${y}</div><div>Entrées<br><b>${fmtEUR0(a.ent)}</b></div><div>Sorties<br><b>${fmtEUR0(a.sor)}</b></div><div class="ys-solde ${a.sol>=0?'pos':'neg'}">Solde ${fmtEUR0(a.sol)} · ${(r*100).toFixed(1).replace('.',',')} %</div></div>`; });
    $('#dash-compare').innerHTML=html;
  } else if(previousYearTabs.length){
    const prev=aggStats(previousYearTabs.map(t=>({...t,stat:stats[t.title]}))); cc.style.display='block'; $('#dash-compare-title').textContent=`🔁 ${dash.years[0]} vs ${dash.years[0]-1}`; $('#dash-compare-note').style.display='none'; $('#dash-compare').innerHTML=cmpRow('Dépenses',scope.sor,prev.sor,false)+cmpRow('Revenus',scope.ent,prev.ent,true)+cmpRow('Épargne',scope.sol,prev.sol,true);
  } else cc.style.display='none';
  let chartItems=list.map(x=>({label:MONTHS_AB[x.m]+String(x.y).slice(2),title:`${MONTHS_FR[x.m]} ${x.y}`,ent:x.stat.ent,sor:x.stat.sor,sol:x.stat.sol,y:x.y,m:x.m}));
  if(dash.month!=null){ chartItems=dash.years.map(y=>{ const x=list.find(z=>z.y===y&&z.m===dash.month); return x?{label:String(y),title:`${MONTHS_FR[dash.month]} ${y}`,ent:x.stat.ent,sor:x.stat.sor,sol:x.stat.sol,y,m:dash.month}:{label:String(y),title:`${MONTHS_FR[dash.month]} ${y}`,ent:0,sor:0,sol:0,y,m:dash.month}; }); }
  $('#dash-chart-title').textContent=dash.month==null?'📈 Évolution mensuelle':'📈 Comparaison '+MONTHS_FR[dash.month];
  const ch=$('#dash-chart'); ch.innerHTML=chartSVG(chartItems,null);
  ch.querySelectorAll('[data-tap]').forEach(r=>r.onclick=()=>{ const it=chartItems[+r.dataset.tap]; if(!it) return; moisDate=new Date(it.y,it.m,1); switchTab('mois'); });
  $('#dash-legend').innerHTML=`<span><i style="background:${CHART_GREEN}"></i>Entrées</span><span><i style="background:${CHART_RED}"></i>Sorties</span><span><i style="background:${CHART_INK};height:3px;border-radius:2px;width:14px"></i>Solde</span>`;
  $('#dash-chart-hint').textContent=dash.month==null?'Fais défiler horizontalement pour parcourir les mois.':'Touche une année pour ouvrir ce mois.';
  const cats=catsSorted, totS=scope.sor||1, maxC=cats.length?cats[0].amt:1;
  const top=$('#dash-top'); top.innerHTML=''; const shown=dash.topAll?cats:cats.slice(0,8);
  if(!cats.length) top.appendChild(el('p','muted','Aucune dépense sur cette sélection.'));
  shown.forEach((c,i)=>{ const row=el('div','rank'); row.appendChild(el('div','rn',String(i+1))); const mid=el('div','rmid'); mid.appendChild(el('div','rl',c.l)); const bar=el('div','rbar'),fill=el('i'); fill.style.width=Math.max(2,Math.round(c.amt/maxC*100))+'%'; bar.appendChild(fill); mid.appendChild(bar); row.appendChild(mid); const rr=el('div','rr'); rr.appendChild(el('div','ra',fmtEUR0(c.amt))); rr.appendChild(el('div','rp',Math.round(c.amt/totS*100)+' %')); row.appendChild(rr); row.onclick=()=>openCatYear(c.l); top.appendChild(row); });
  const more=$('#dash-top-more'); more.style.display=cats.length>8?'block':'none'; more.textContent=dash.topAll?'Réduire':`Tout afficher (${cats.length})`;
  const brk=$('#dash-sections'); brk.innerHTML='';
  const secVals=Object.entries(scope.secT||{}).map(([name,val])=>{ const meta=SEC_META.find(([k])=>name.includes(k)); return {name:name.replace(/^[^ ]+ /,''),val,color:meta?meta[1]:'#9AA5B1'}; }).sort((a,b)=>b.val-a.val);
  const maxSec=Math.max(1,...secVals.map(x=>x.val)),totSec=secVals.reduce((a,b)=>a+b.val,0)||1;
  if(!secVals.length) brk.appendChild(el('p','muted','Rien à afficher.'));
  secVals.forEach(x=>{ const row=el('div','brk'); row.appendChild(el('div','bl',x.name)); const bar=el('div','bar'),i2=el('i'); i2.style.width=Math.round(x.val/maxSec*100)+'%'; i2.style.background=x.color; bar.appendChild(i2); row.appendChild(bar); row.appendChild(el('div','bv',Math.round(x.val/totSec*100)+'% · '+fmtEUR0(x.val))); brk.appendChild(row); });
};

openCatYear=function(label){
  $('#cy-title').textContent=label;
  $('#cy-sub').textContent=(dash.years||[]).join(' + ')+(dash.month!=null?' · '+MONTHS_FR[dash.month]:'');
  const list=$('#cy-list'); list.innerHTML='';
  const tabs=v75SelectedTabs();
  let tot=0,nb=0;
  tabs.forEach(t=>{ const c=monthCache[t.title]; if(!c||!c.stat) return; const cat=c.stat.cats[label]; if(!cat||!cat.amt) return; tot+=cat.amt; nb++; const row=el('div','ent-row tap'); const lf=el('div'); lf.appendChild(el('div','el',`${MONTHS_FR[t.m]} ${t.y}`)); row.appendChild(lf); row.appendChild(el('div','ea',fmtEUR(cat.amt))); row.onclick=()=>{$('#catyear-modal').classList.remove('open');openCatSheet(label,t.title);}; list.appendChild(row); });
  if(!nb) list.appendChild(el('p','muted','Aucun montant sur cette période.'));
  $('#cy-total').textContent=fmtEUR(tot);
  $('#catyear-modal').classList.add('open');
};
