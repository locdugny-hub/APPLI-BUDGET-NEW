/* Budget PWA v7.5.44 : carte titres-restaurant, séparée des dépenses bancaires.
   Le registre reste dans Google Sheets, aucune cellule mensuelle n'est modifiée. */
'use strict';
(function installTicketRestaurant(){
  if(window.__budgetTR44) return;
  window.__budgetTR44=true;
  const LABEL='🍱 Carte titres-restaurant';
  const SHEET='Carte titres-restaurant';
  const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const renderOriginal=renderCategories;
  renderCategories=async function(){
    await renderOriginal();
    const wrap=document.getElementById('categories');
    const query=(document.getElementById('search')?.value||'').toLowerCase().trim();
    if(!wrap||query&&!LABEL.toLowerCase().includes(query)) return;
    const title=el('div','sec-title','🍱 Carte titres-restaurant · hors budget bancaire');
    const grid=el('div','grid');
    grid.appendChild(catButton(LABEL));
    wrap.appendChild(title);wrap.appendChild(grid);
  };

  function monthKey(tab){
    const p=parseMonthTitle(tab);
    return p?p.y+'-'+String(p.m+1).padStart(2,'0'):new Date().toISOString().slice(0,7);
  }
  function euro(n){return fmtEUR(Math.abs(Number(n)||0));}
  function textRow(parent,top,bottom,amount,kind){
    const row=el('div','ent-row');
    const left=el('div');
    left.appendChild(el('div','el',top));
    if(bottom)left.appendChild(el('div','em',bottom));
    const val=el('div','ea'+(kind==='credit'?'':''));
    val.textContent=amount;
    if(kind==='credit')val.style.color='#16804C';
    if(kind==='muted')val.style.opacity='0.65';
    row.appendChild(left);row.appendChild(val);parent.appendChild(row);
  }
  const oldOpen=openCatSheet;
  openCatSheet=function(label,tab){
    oldOpen(label,tab);
    if(label!==LABEL)return;
    document.getElementById('m-cat').textContent=LABEL;
    document.getElementById('m-total-l').textContent='Dépenses du mois · carte prépayée';
    document.getElementById('m-showform').textContent='＋ Ajouter un paiement carte';
    document.getElementById('m-histnote').style.display='block';
    document.getElementById('m-histnote').textContent='Compte indépendant : les opérations de cette carte ne modifient pas les totaux de dépenses du budget bancaire. Pour saisir un paiement, indique le marchand dans le commentaire.';
  };
  const oldDetail=loadCatDetail;
  loadCatDetail=async function(label,tab,seq){
    if(label!==LABEL)return oldDetail(label,tab,seq);
    const hist=document.getElementById('m-hist');
    try{
      const data=await valuesGet("'"+SHEET+"'!A13:J500",'UNFORMATTED_VALUE');
      if(seq!==detailSeq)return;
      const entries=(data.values||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(String(r[0]||'')));
      const mk=monthKey(tab);
      const list=entries.filter(r=>String(r[0]).slice(0,7)===mk).reverse();
      const spent=list.reduce((sum,r)=>sum+(r[2]==='Paiement'?Number(r[5])||0:0),0);
      const funded=list.reduce((sum,r)=>sum+(r[2]==='Chargement'?Number(r[3])||0:0),0);
      document.getElementById('m-total').textContent=euro(spent);
      document.getElementById('m-count').textContent=list.length+' mouvement'+(list.length>1?'s':'')+' · chargements '+euro(funded);
      hist.innerHTML='';
      if(!list.length){hist.appendChild(el('p','muted','Aucun mouvement recensé pour ce mois.'));return;}
      for(const r of list){
        const type=String(r[2]||''),amount=Number(r[3])||0;
        const isPayment=type==='Paiement',isCredit=type==='Chargement'||type==='Prolongation';
        const note=String(r[0]||'').split('-').reverse().join('/')+' · '+(isPayment?'Paiement accepté':type)+(type==='Refus'?' (non débité)':'');
        textRow(hist,String(r[1]||''),note,isPayment?'-'+euro(amount):isCredit?'+'+euro(amount):type==='Péremption'?'-'+euro(amount):'—',isCredit?'credit':!isPayment?'muted':'normal');
      }
    }catch(err){
      if(seq!==detailSeq)return;
      hist.innerHTML='';
      hist.appendChild(el('p','muted','Historique carte indisponible : '+(err?.message||err)));
      document.getElementById('m-total').textContent='—';
    }
  };

  const originalSubmit=submitEntry;
  submitEntry=async function(){
    if(selectedCat!==LABEL)return originalSubmit();
    const amount=Number(normAmount(document.getElementById('m-amount').value));
    const dateISO=document.getElementById('m-date').value||todayISO();
    const merchant=document.getElementById('m-note').value.trim();
    if(!Number.isFinite(amount)||amount<=0){toast('Montant invalide',true);return;}
    if(!merchant){toast('Indique le marchand dans le commentaire.',true);return;}
    const btn=document.getElementById('m-add');
    btn.disabled=true;btn.textContent='…';
    try{
      if(!navigator.onLine)throw new Error('Connexion nécessaire pour enregistrer la carte.');
      const response=await valuesGet("'"+SHEET+"'!A13:D500",'UNFORMATTED_VALUE');
      const lines=response.values||[];
      const duplicate=lines.some(r=>String(r[0])===dateISO&&
        String(r[1]||'').toLowerCase()===merchant.toLowerCase()&&
        String(r[2])==='Paiement'&&Math.abs((Number(r[3])||0)+amount)<0.005);
      if(duplicate&&!confirm('Un paiement identique existe déjà à cette date. Ajouter quand même ?'))return;
      const n=13+lines.length;
      const values=[dateISO,merchant,'Paiement',-amount,'Validé',
        '=IF(C'+n+'="Paiement";MAX(0;-D'+n+');0)',
        '=IFERROR(F'+n+'*$B$4/$B$3;0)',
        '=IFERROR(F'+n+'*$B$5/$B$3;0)',
        'Paiement manuel sur carte prépayée — hors budget bancaire','PWA Budget'];
      await valuesAppendRows("'"+SHEET+"'!A:J",[values],'USER_ENTERED');
      document.getElementById('m-amount').value='';
      document.getElementById('m-note').value='';
      document.getElementById('m-form').style.display='none';
      document.getElementById('m-showform').style.display='';
      toast('✅ Paiement carte enregistré sans modifier ton budget');
      await loadCatDetail(LABEL,entryTab,++detailSeq);
    }catch(err){toast('Erreur carte titres-restaurant : '+(err?.message||err),true);}
    finally{btn.disabled=false;btn.textContent='Ajouter';}
  };
})();