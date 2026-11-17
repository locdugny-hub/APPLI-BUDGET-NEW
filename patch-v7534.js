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
      const share=el('p','muted','Part employeur estimée : '+euro(paid*6.02/10.20)+' · Ma part estimée : '+euro(paid*4.18/10.20));
      hist.appendChild(share);
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