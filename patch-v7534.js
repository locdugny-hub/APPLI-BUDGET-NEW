/* v7.5.46 — Tickets-restaurant : intégré dans chaque mois, hors budget bancaire.
   Données transactionnelles J:O du même onglet, synthèse E:G de la ligne dédiée.
   Aucune écriture dans B/C, Saisies App, Index Catégories ou le budget bancaire. */
'use strict';
(function(){
  if(window.__budgetTR46)return;
  window.__budgetTR46=true;
  const LABEL='🍱 Tickets-restaurant';
  const M='Modèle mois';
  const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  function iso(v){
    if(typeof v==='number'&&Number.isFinite(v)){
      const d=new Date(Math.floor(v-25569)*86400000);
      return isNaN(d)?'':d.toISOString().slice(0,10);
    }
    const s=String(v==null?'':v).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
  }
  function euro(v){return fmtEUR(Math.abs(Number(v)||0));}
  function isTab(t){return !!parseMonthTitle(t);}
  function tabKey(tab){const p=parseMonthTitle(tab);return p?String(p.y)+'-'+String(p.m+1).padStart(2,'0'):'';}

  /* Carte indépendante de toutes les rubriques de dépenses. */
  const stylesheet=document.createElement('style');
  stylesheet.textContent=`
    .meal-panel{margin:18px 0 16px;border-radius:19px;overflow:hidden;border:1px solid rgba(39,60,97,.13);background:#f8faff;box-shadow:0 9px 28px rgba(18,39,70,.08)}
    .meal-panel .meal-head{background:linear-gradient(112deg,#172b48,#294a70);color:#fff;padding:16px 17px;display:flex;gap:14px;align-items:center;justify-content:space-between}
    .meal-panel .meal-kicker{font-size:11px;text-transform:uppercase;letter-spacing:1.1px;font-weight:700;color:#c5d7f4}
    .meal-panel .meal-name{font-size:17px;font-weight:750;margin-top:4px;color:white}
    .meal-panel .meal-pill{background:#ffe1a1;color:#64450c;font-size:10px;font-weight:800;letter-spacing:.25px;border-radius:50px;padding:6px 9px;white-space:nowrap}
    .meal-panel .meal-body{padding:16px 17px 15px;color:#172b48}
    .meal-panel .meal-label{font-size:11px;font-weight:700;letter-spacing:.2px;color:#5a6e88}
    .meal-panel .meal-total{font-size:29px;line-height:1.25;font-weight:800;font-variant-numeric:tabular-nums;margin-top:5px;letter-spacing:-.45px;color:#172b48}
    .meal-panel .meal-bar{display:flex;overflow:hidden;height:9px;border-radius:9px;background:#e2e9f3;margin:16px 0 12px}
    .meal-panel .meal-bar > span:first-child{width:59.0196078%;background:#22845e}
    .meal-panel .meal-bar > span:last-child{flex:1;background:#3975c5}
    .meal-panel .meal-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .meal-panel .meal-split > div{border:1px solid #e0e9f3;padding:11px 12px;background:#fff;border-radius:12px;min-width:0}
    .meal-panel .meal-split strong{display:block;font-size:18px;line-height:1.3;margin-top:5px;font-variant-numeric:tabular-nums}
    .meal-panel .meal-split > div:first-child strong{color:#22845e}
    .meal-panel .meal-split > div:last-child strong{color:#3975c5}
    .meal-panel .meal-foot{margin-top:12px;font-size:11px;color:#61728c;line-height:1.4}
    .meal-panel .meal-open{border:0;border-radius:11px;background:#e2ebf9;color:#193e70;font-size:13px;font-weight:750;width:100%;padding:12px;margin-top:13px;cursor:pointer}
    .meal-panel .meal-open:focus-visible{outline:3px solid #e9bb59;outline-offset:2px}
    @media(max-width:385px){.meal-panel .meal-name{font-size:15px}.meal-panel .meal-total{font-size:25px}.meal-panel .meal-split strong{font-size:15px}.meal-panel .meal-pill{font-size:9px}}
  `;
  document.head.appendChild(stylesheet);
  function mealElement(tag,className,content){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=String(content);
    return node;
  }
  function buildMealPanel(tab,values){
    const card=mealElement('section','meal-panel');
    card.setAttribute('aria-label','Avantage repas, dépenses tickets-restaurant hors budget');
    const head=mealElement('div','meal-head');
    const t=mealElement('div','');
    t.appendChild(mealElement('div','meal-kicker','🍱 AVANTAGE REPAS'));
    t.appendChild(mealElement('div','meal-name','Carte titres-restaurant'));
    head.appendChild(t);
    head.appendChild(mealElement('span','meal-pill','HORS BUDGET'));
    card.appendChild(head);
    const body=mealElement('div','meal-body');
    if(values){
      body.appendChild(mealElement('div','meal-label','TOTAL DES PAIEMENTS CARTE'));
      body.appendChild(mealElement('div','meal-total',euro(values.total)));
      const bar=mealElement('div','meal-bar');
      bar.appendChild(mealElement('span'));bar.appendChild(mealElement('span'));
      body.appendChild(bar);
      const two=mealElement('div','meal-split');
      const emp=mealElement('div'),pers=mealElement('div');
      emp.appendChild(mealElement('div','meal-label','Part employeur · estimée'));
      emp.appendChild(mealElement('strong','',euro(values.employer)));
      pers.appendChild(mealElement('div','meal-label','Ma part · estimée'));
      pers.appendChild(mealElement('strong','',euro(values.personal)));
      two.appendChild(emp);two.appendChild(pers);
      body.appendChild(two);
      body.appendChild(mealElement('div','meal-foot','Répartition indicative 6,02 € / 4,18 € par titre. Aucun impact sur les bilans.'));
    }else{
      body.appendChild(mealElement('div','meal-label','VOTRE CARTE REPAS'));
      body.appendChild(mealElement('div','meal-foot','Consultez vos paiements, leur historique et la répartition entre votre employeur et vous, sans modifier votre budget bancaire.'));
    }
    const action=mealElement('button','meal-open',values?'Voir les paiements du mois':'Ouvrir le suivi de ma carte');
    action.type='button';
    action.onclick=()=>openCatSheet(LABEL,tab);
    body.appendChild(action);card.appendChild(body);
    return card;
  }
  window.renderMealBenefitCard=function(container,tab,values){
    if(!container)return;
    container.appendChild(buildMealPanel(tab,values));
  };
  const beforeCategories=renderCategories;
  renderCategories=async function(){
    await beforeCategories();
    const container=document.getElementById('categories');
    const q=(document.getElementById('search')?.value||'').trim().toLowerCase();
    if(!container||q&&!('avantage repas tickets-restaurant carte'.includes(q)||LABEL.toLowerCase().includes(q)))return;
    const tab=gridTab||tabTitleFor(new Date().getFullYear(),new Date().getMonth());
    if(tabKey(tab)>='2025-11')container.prepend(buildMealPanel(tab,null));
  };

  const dashCss=document.createElement('style');
  dashCss.textContent=`
  .meal-dashboard{margin:15px 12px 20px;border-radius:18px;border:1px solid #dae5f1;overflow:hidden;background:#fff;box-shadow:0 7px 24px rgba(15,39,69,.07)}
  .meal-dashboard .md-head{background:linear-gradient(112deg,#172b48,#294b71);padding:16px 18px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px}
  .meal-dashboard .md-title{font-size:16px;color:#fff;font-weight:800;margin:3px 0}
  .meal-dashboard .md-sub{font-size:11px;color:#d7e5f6}
  .meal-dashboard .md-tag{font-size:10px;background:#ffe0a0;color:#61420a;border-radius:30px;padding:7px 9px;font-weight:800;white-space:nowrap}
  .meal-dashboard .md-body{padding:16px}
  .meal-dashboard .md-total-label{font-size:11px;letter-spacing:.5px;color:#62748c;font-weight:750}
  .meal-dashboard .md-total{font-size:30px;font-weight:850;color:#172b48;letter-spacing:-.6px;margin:5px 0 14px;font-variant-numeric:tabular-nums}
  .meal-dashboard .md-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .meal-dashboard .md-mini{border-radius:12px;padding:11px;border:1px solid #e2eaf3;background:#f7faff}
  .meal-dashboard .md-mini small{font-size:11px;color:#62748c;display:block;line-height:1.4}
  .meal-dashboard .md-mini strong{font-size:19px;display:block;margin-top:5px;font-variant-numeric:tabular-nums;color:#172b48}
  .meal-dashboard .md-mini:first-child strong{color:#19805a}
  .meal-dashboard .md-mini:last-child strong{color:#3975c5}
  .meal-dashboard .md-bar{height:9px;overflow:hidden;border-radius:8px;display:flex;margin:14px 0}
  .meal-dashboard .md-bar i:first-child{width:59.0196078%;background:#19805a}
  .meal-dashboard .md-bar i:last-child{flex:1;background:#3975c5}
  .meal-dashboard .md-chart-title{font-size:13px;font-weight:800;color:#213a5c;margin:20px 0 10px}
  .meal-dashboard .md-chart{display:flex;align-items:flex-end;gap:5px;height:128px;border-bottom:1px solid #d9e3ee;padding:0 4px 0}
  .meal-dashboard .md-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:pointer;gap:3px}
  .meal-dashboard .md-figure{width:min(100%,22px);border-radius:5px 5px 0 0;background:linear-gradient(180deg,#4c8fcb,#2a5d94);min-height:2px}
  .meal-dashboard .md-labels{display:flex;gap:5px;padding:7px 4px 0}
  .meal-dashboard .md-labels span{flex:1;min-width:0;font-size:10px;text-align:center;color:#63758f}
  .meal-dashboard .md-footer{font-size:11px;color:#6a7a90;margin-top:15px;line-height:1.5}
  .meal-dashboard .md-empty{font-size:12px;color:#63758f;margin:18px 0}
  @media(max-width:385px){.meal-dashboard .md-total{font-size:27px}.meal-dashboard .md-mini strong{font-size:16px}.meal-dashboard .md-labels span{font-size:9px}}
  `;
  document.head.appendChild(dashCss);
  window.renderMealDashboard=function(data,year,month){
    const parent=document.getElementById('view-resume');
    if(!parent)return;
    let host=document.getElementById('meal-dashboard-panel');
    if(!host){
      host=document.createElement('section');
      host.id='meal-dashboard-panel';
      host.className='meal-dashboard';
      const compare=document.getElementById('dash-compare-card');
      if(compare&&compare.parentNode===parent)parent.insertBefore(host,compare);
      else parent.appendChild(host);
    }
    host.replaceChildren();
    const available=data.filter(x=>Number(x.total)>0);
    const total=data.reduce((a,x)=>a+x.total,0);
    const employer=data.reduce((a,x)=>a+x.employer,0);
    const personal=data.reduce((a,x)=>a+x.personal,0);
    const nowTitle=year==='all'?'Toutes les années':month==null?'Année '+year:MONTHS[month]+' '+year;
    const head=mealElement('div','md-head');
    const heading=mealElement('div');
    heading.appendChild(mealElement('div','md-sub','🍱 AVANTAGE REPAS · PILOTAGE'));
    heading.appendChild(mealElement('div','md-title','Carte titres-restaurant'));
    heading.appendChild(mealElement('div','md-sub',nowTitle));
    head.appendChild(heading);
    head.appendChild(mealElement('span','md-tag','HORS BUDGET'));
    host.appendChild(head);
    const body=mealElement('div','md-body');
    body.appendChild(mealElement('div','md-total-label','DÉPENSES CARTE · PÉRIODE SÉLECTIONNÉE'));
    body.appendChild(mealElement('div','md-total',euro(total)));
    const split=mealElement('div','md-split');
    for(const [label,amount]of [['Part employeur estimée',employer],['Ma part estimée',personal]]){
      const box=mealElement('div','md-mini');
      box.appendChild(mealElement('small','',label));
      box.appendChild(mealElement('strong','',euro(amount)));
      split.appendChild(box);
    }
    body.appendChild(split);
    const bar=mealElement('div','md-bar');
    bar.appendChild(document.createElement('i'));bar.appendChild(document.createElement('i'));
    body.appendChild(bar);
    if(available.length){
      body.appendChild(mealElement('div','md-chart-title','Évolution des dépenses par carte'));
      const chart=mealElement('div','md-chart');
      const labels=mealElement('div','md-labels');
      let points=data;
      // Éviter des barres illisibles sur mobile : 12 derniers mois pour « Tout ».
      if(year==='all'&&points.length>12)points=points.slice(-12);
      const max=Math.max(1,...points.map(p=>p.total));
      for(const point of points){
        const column=mealElement('div','md-col');
        column.setAttribute('role','button');
        column.setAttribute('tabindex','0');
        column.setAttribute('aria-label',point.title+' : '+euro(point.total));
        column.title=point.title+' · '+euro(point.total);
        const fig=mealElement('div','md-figure');
        fig.style.height=Math.max(2,Math.round(point.total/max*109))+'px';
        fig.style.opacity=point.total?1:0.16;
        column.appendChild(fig);chart.appendChild(column);
        column.onclick=()=>openCatSheet(LABEL,point.title);
        column.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();column.click();}};
        labels.appendChild(mealElement('span','',MONTHS[point.month].slice(0,3)));
      }
      body.appendChild(chart);body.appendChild(labels);
      if(year==='all'&&data.length>12)
        body.appendChild(mealElement('div','md-footer','Graphique : 12 derniers mois. Les totaux ci-dessus couvrent toute la période sélectionnée.'));
    }else{
      body.appendChild(mealElement('div','md-empty','Aucun paiement par carte enregistré dans cette période.'));
    }
    body.appendChild(mealElement('div','md-footer','Suivi uniquement informatif · 6,02 € employeur / 4,18 € salarié par titre de 10,20 € · Non inclus dans les dépenses, revenus ou l’épargne.'));
    host.appendChild(body);
  };
  const previousOpen=openCatSheet;
  openCatSheet=function(label,tab){
    previousOpen(label,tab);
    if(label!==LABEL)return;
    document.getElementById('m-total-l').textContent='Dépenses de carte · hors budget';
    document.getElementById('m-showform').textContent='＋ Ajouter un paiement carte';
    const note=document.getElementById('m-histnote');
    note.style.display='block';
    note.textContent='Suivi indépendant : ni les montants de la carte ni leurs financements ne sont ajoutés au budget bancaire. Indique le commerçant dans le commentaire lors d’une nouvelle saisie.';
  };
  const originalDetail=loadCatDetail;
  loadCatDetail=async function(label,tab,seq){
    if(label!==LABEL)return originalDetail(label,tab,seq);
    const hist=document.getElementById('m-hist');
    try{
      const source=await valuesGet("'"+tab+"'!J95:O500",'UNFORMATTED_VALUE');
      if(seq!==detailSeq)return;
      const rows=source.values||[];
      const header=rows.findIndex(r=>String(r?.[0]||'')==='Date'&&String(r?.[1]||'')==='Commerçant');
      if(header<0)throw new Error('Registre de carte absent dans cet onglet.');
      const data=rows.slice(header+1).filter(r=>!!iso(r?.[0])).map(r=>({
        date:iso(r[0]),merchant:String(r[1]||''),type:String(r[2]||''),
        amount:Number(r[3])||0,note:String(r[4]||'')
      }));
      const paid=data.filter(t=>t.type==='Paiement').reduce((a,t)=>a+Math.max(0,-t.amount),0);
      const funded=data.filter(t=>t.type==='Chargement').reduce((a,t)=>a+t.amount,0);
      document.getElementById('m-total').textContent=euro(paid);
      document.getElementById('m-count').textContent=data.length+' mouvement'+(data.length>1?'s':'')+' · chargements '+euro(funded);
      hist.innerHTML='';
      const picker=document.createElement('select');
      picker.setAttribute('aria-label','Mois des titres-restaurant');
      picker.style.cssText='width:100%;height:46px;border-radius:12px;border:1px solid #d6e0ec;background:#f7fafe;padding:0 12px;font-size:15px;margin:2px 0 14px';
      const selected=tabKey(tab);
      const available=(monthTabs||[]).filter(t=>isTab(t.title)&&tabKey(t.title)>='2025-11').sort((a,b)=>tabKey(b.title).localeCompare(tabKey(a.title)));
      for(const m of available){
        const opt=document.createElement('option');
        opt.value=m.title;opt.textContent=MONTHS[m.m]+' '+m.y;
        if(m.title===tab)opt.selected=true;
        picker.appendChild(opt);
      }
      picker.onchange=()=>{
        entryTab=picker.value;
        document.getElementById('m-sub').textContent=entryTab;
        document.getElementById('m-date').value=presetISOFor(entryTab);
        document.getElementById('m-total').textContent='…';
        loadCatDetail(LABEL,entryTab,++detailSeq);
      };
      hist.appendChild(picker);
      const share=el('div','',null);
      share.style.cssText='background:#f4f8ff;border:1px solid #dce7f5;padding:12px 14px;border-radius:13px;margin:0 0 13px;font-size:14px;color:#203957';
      const shareTitle=el('div','', 'Répartition estimée · hors budget bancaire');
      shareTitle.style.cssText='font-weight:600;margin-bottom:6px';
      share.appendChild(shareTitle);
      const shareDetail=el('div','', 'Employeur : '+euro(paid*6.02/10.20)+' · Ma part : '+euro(paid*4.18/10.20));
      share.appendChild(shareDetail);
      hist.appendChild(share);
      if(!data.length){hist.appendChild(el('p','muted','Aucun mouvement recensé pour ce mois.'));return;}
      for(const t of data.slice().reverse()){
        const isPayment=t.type==='Paiement';
        const credit=t.type==='Chargement'||t.type==='Prolongation';
        const dateText=t.date.slice(8,10)+'/'+t.date.slice(5,7)+'/'+t.date.slice(0,4);
        const subtitle=dateText+' · '+(isPayment?'Paiement accepté':t.type)+(t.type==='Refus'?' (aucun débit)':'');
        const row=el('div','ent-row');
        const left=el('div');
        left.appendChild(el('div','el',t.merchant));
        left.appendChild(el('div','em',subtitle));
        if(t.type==='Refus'||t.type==='Remboursé'){
          if(t.note)left.appendChild(el('div','em',t.note.slice(0,95)));
        }
        row.appendChild(left);
        const txt=isPayment?'-'+euro(t.amount):credit?'+'+euro(t.amount):t.type==='Péremption'?'-'+euro(t.amount):'—';
        const number=el('div','ea',txt);
        if(credit)number.style.color='#148452';
        if(!isPayment&&!credit)number.style.opacity='0.65';
        row.appendChild(number);hist.appendChild(row);
      }
      // Détail du partage de dépense : quote-parts estimées, pas de
      // deuxième écriture bancaire ni de répartition de chargement fictive.

    }catch(err){
      if(seq!==detailSeq)return;
      document.getElementById('m-total').textContent='—';
      hist.innerHTML='';
      hist.appendChild(el('p','muted','Historique de carte indisponible : '+(err?.message||err)));
    }
  };
  const originalSubmit=submitEntry;
  submitEntry=async function(){
    if(selectedCat!==LABEL)return originalSubmit();
    const numeric=normAmount(document.getElementById('m-amount').value);
    const date=document.getElementById('m-date').value||todayISO();
    const merchant=document.getElementById('m-note').value.trim();
    if(numeric==null){toast('Montant invalide',true);return;}
    if(!merchant){toast('Indique le commerçant dans le commentaire.',true);return;}
    const amount=Number(numeric);
    const btn=document.getElementById('m-add');
    btn.disabled=true;btn.textContent='…';
    try{
      if(!navigator.onLine)throw new Error('Connexion requise pour enregistrer ce paiement.');
      const d=new Date(date+'T12:00:00');
      await loadMeta();
      let tab=tabTitleFor(d.getFullYear(),d.getMonth());
      if(!monthTabs.some(t=>t.y===d.getFullYear()&&t.m===d.getMonth()))
        tab=await createMonthFromTemplate(d.getFullYear(),d.getMonth(),true);
      const grid=await valuesGet("'"+tab+"'!J95:O500",'UNFORMATTED_VALUE');
      const rows=grid.values||[];
      const head=rows.findIndex(r=>String(r?.[0]||'')==='Date'&&String(r?.[1]||'')==='Commerçant');
      if(head<0)throw new Error('Ce mois ne possède pas encore de suivi titres-restaurant.');
      const duplicate=rows.slice(head+1).some(r=>iso(r?.[0])===date &&
        String(r?.[1]||'').trim().toLowerCase()===merchant.toLowerCase() &&
        String(r?.[2]||'')==='Paiement'&&Math.abs((Number(r?.[3])||0)+amount)<0.005);
      if(duplicate&&!confirm('Paiement identique déjà présent ce jour-là. Ajouter quand même ?'))return;
      let last=head;
      for(let i=head+1;i<rows.length;i++)if(rows[i]?.some(v=>v!==''&&v!==null&&v!==undefined))last=i;
      const target=95+last+1;
      if(target>500)throw new Error('Le registre de ce mois est plein.');
      await valuesUpdateRow("'"+tab+"'!J"+target+":O"+target,
        [date,merchant,'Paiement',-amount,'Dépense carte prépayée — hors budget bancaire','PWA Budget'],'RAW');
      document.getElementById('m-amount').value='';
      document.getElementById('m-note').value='';
      document.getElementById('m-form').style.display='none';
      document.getElementById('m-showform').style.display='';
      entryTab=tab;document.getElementById('m-sub').textContent=tab;
      toast('✅ Carte titres-restaurant : paiement enregistré');
      await loadCatDetail(LABEL,tab,++detailSeq);
    }catch(err){toast('Carte titres-restaurant : '+(err?.message||err),true);}
    finally{btn.disabled=false;btn.textContent='Ajouter';}
  };
})();