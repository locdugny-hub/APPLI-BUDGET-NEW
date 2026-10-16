/* Budget PWA v7.5.24
   - Restaure le detail des calculs historiques dans les categories
   - Une ligne Saisies App = une operation individuelle, meme si plusieurs montants sont identiques
   - Les cellules mensuelles sont reconstruites proprement sous forme de somme lisible (=15+15)
   - Modification / suppression / reaffectation ciblent une ligne unique du journal
*/
'use strict';

(function installV7524(){
  if(window.__budgetV7524) return;
  window.__budgetV7524=true;

  const cache=new Map();
  const TTL=20000;
  let state=null;
  let armed=false, armTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .v7524-right{display:flex;align-items:center;gap:7px;margin-left:auto;flex:none}
    .v7524-actions{display:flex;gap:5px}
    .v7524-act{width:38px;height:38px;border:1px solid #D9E2EE;border-radius:11px;background:#F7FAFE;color:var(--navy);font-size:17px;display:flex;align-items:center;justify-content:center;padding:0}
    .v7524-del{color:#C53B47;background:#FFF7F8;border-color:#F0D6D9}
    .v7524-src{font-size:10px;color:var(--muted);margin-top:2px}
    .v7524-overlay{position:fixed;inset:0;z-index:10300;background:rgba(7,21,42,.48);display:none;align-items:flex-end}
    .v7524-overlay.open{display:flex}
    .v7524-card{width:100%;background:#fff;border-radius:24px 24px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(9,29,57,.25)}
    .v7524-handle{width:44px;height:5px;border-radius:999px;background:#D6DFEA;margin:2px auto 12px}
    .v7524-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
    .v7524-title{font-size:20px;font-weight:900;color:var(--navy);line-height:1.2}
    .v7524-sub{font-size:12px;color:var(--muted);margin-top:4px}
    .v7524-close{width:40px;height:40px;border:0;border-radius:12px;background:#F1F5FA;color:var(--navy);font-size:24px}
    .v7524-field{margin:12px 0}
    .v7524-label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.35px;margin:0 0 7px 2px}
    .v7524-input,.v7524-select,.v7524-note{width:100%;box-sizing:border-box;border:1px solid #D6E0EC;border-radius:14px;background:#fff;color:var(--navy);font:inherit;font-size:16px;padding:13px 14px;outline:none}
    .v7524-input,.v7524-select{height:52px;font-weight:800}
    .v7524-note{min-height:92px;resize:none;line-height:1.35}
    .v7524-select:disabled{background:#F3F6FA;color:#677489}
    .v7524-info{font-size:11px;color:var(--muted);line-height:1.4;margin:8px 2px 14px}
    .v7524-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .v7524-save,.v7524-delete{height:50px;border-radius:14px;font-size:15px;font-weight:850}
    .v7524-save{border:0;background:#2E6FB7;color:#fff}
    .v7524-delete{border:1px solid #F0D6D9;background:#FFF7F8;color:#C53B47}
    .v7524-save:disabled,.v7524-delete:disabled{opacity:.5}
    @media(min-width:700px){.v7524-overlay{align-items:center;justify-content:center}.v7524-card{max-width:500px;border-radius:24px;padding-bottom:20px}}
  `;
  document.head.appendChild(style);

  function key(label,tab){return tab+'|'+label;}
  function clear(label,tab){
    cache.delete(key(label,tab));
    delete monthCache[tab];
    journalCache=null;
    lastSync=Date.now();
  }
  async function info(tab,label){
    const st=await getTabStructure(tab);
    const row=st.map[label];
    if(!row) throw new Error(`Categorie « ${label} » absente de ${tab}.`);
    const col=st.colOf[label]||(CAT_INFO[label]&&CAT_INFO[label].col)||'C';
    return {st,row,col,cell:`'${tab}'!${col}${row}`};
  }
  function balancedOuter(s){
    if(!s.startsWith('(')||!s.endsWith(')')) return false;
    let d=0;
    for(let i=0;i<s.length;i++){
      if(s[i]==='(') d++;
      else if(s[i]===')') d--;
      if(d===0&&i<s.length-1) return false;
      if(d<0) return false;
    }
    return d===0;
  }
  function parseDetail(raw,sep){
    let s=String(raw==null?'':raw).trim();
    if(!s) return [];
    if(!s.startsWith('=')){
      const n=parseLocaleNum(s,sep);
      return [{raw:s,num:n,sign:1}];
    }
    let body=s.slice(1).trim();
    while(balancedOuter(body)) body=body.slice(1,-1).trim();
    const p=parseFormulaTerms('='+body,sep);
    if(p.terms&&p.terms.length) return p.terms.map(t=>({...t}));
    return [{raw:body,num:null,sign:1}];
  }
  function nraw(n,sep){
    const x=Math.abs(Number(n)||0);
    return String(Number(x.toFixed(2))).replace('.',sep);
  }
  function formula(parts,appRows,sep){
    const all=[];
    (parts||[]).forEach(p=>{
      if(p==null) return;
      const raw=p.raw!=null?String(p.raw):nraw(p.amount,sep);
      if(raw==='') return;
      all.push({raw,sign:p.sign<0?-1:1});
    });
    (appRows||[]).forEach(x=>{
      const amount=Number(x.amount!=null?x.amount:(x.r&&x.r[4]))||0;
      all.push({raw:nraw(amount,sep),sign:amount<0?-1:1});
    });
    if(!all.length) return '=0';
    return '='+all.map((p,i)=>(i===0?(p.sign<0?'-':''):(p.sign<0?'-':'+'))+p.raw).join('');
  }
  function matchFormulaTerms(terms,tracked,total){
    const used=new Set(), matched=new Map();
    let allMatched=true;
    [...tracked].reverse().forEach(j=>{
      const amt=Math.abs(Number(j.r[4])||0);
      let found=-1;
      for(let i=terms.length-1;i>=0;i--){
        const t=terms[i];
        if(used.has(i)||t.num==null||t.sign<=0) continue;
        if(Math.abs(Math.abs(Number(t.num))-amt)<0.005){found=i;break;}
      }
      if(found>=0){used.add(found);matched.set(j.sheetRow,found);}
      else allMatched=false;
    });

    if(allMatched){
      return {
        historical:terms.map((t,i)=>({t,i})).filter(x=>!used.has(x.i)).map(x=>({
          raw:x.t.raw,num:x.t.num,sign:x.t.sign,termIndex:x.i
        })),
        matched
      };
    }
    const trackedTotal=tracked.reduce((s,x)=>s+(Number(x.r[4])||0),0);
    const residual=Number(total)||0-trackedTotal;
    return {
      historical:Math.abs(residual)>=0.005?[{raw:null,num:Math.abs(residual),sign:residual<0?-1:1,aggregate:true}]:[],
      matched:new Map()
    };
  }
  async function model(label,tab,force){
    const k=key(label,tab), now=Date.now();
    const old=cache.get(k);
    if(!force&&old&&now-old.at<TTL) return old.data;
    const inf=await info(tab,label);
    const [fD,vD,jRows,sep]=await Promise.all([
      valuesGet(inf.cell,'FORMULA'),
      valuesGet(inf.cell,'UNFORMATTED_VALUE'),
      getJournal(),
      getDecSep()
    ]);
    const raw=(fD.values&&fD.values[0]&&fD.values[0][0]!==undefined)?fD.values[0][0]:'';
    const total=(vD.values&&vD.values[0]&&vD.values[0][0]!=null)?Number(vD.values[0][0])||0:0;
    const tracked=(jRows||[]).map((r,i)=>({r:r||[],sheetRow:i+2}))
      .filter(x=>x.r.some(v=>v!==''&&v!=null))
      .filter(x=>String(x.r[2]||'')===tab&&String(x.r[3]||'')===label);
    const terms=parseDetail(raw,sep);
    const m=matchFormulaTerms(terms,tracked,total);
    const data={label,tab,...inf,raw,total,sep,tracked,historical:m.historical};
    cache.set(k,{at:now,data});
    return data;
  }
  async function fullJournalRows(){
    await ensureJournal();
    const d=await valuesGet(`'${JOURNAL}'!A2:Q`,'UNFORMATTED_VALUE');
    return d.values||[];
  }
  function freeRow(rows){
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||[];
      if(!r.some(v=>v!==''&&v!=null)) return i+2;
    }
    return rows.length+2;
  }
  async function freshRow(n){
    const d=await valuesGet(`'${JOURNAL}'!A${n}:Q${n}`,'UNFORMATTED_VALUE');
    return (d.values&&d.values[0])?d.values[0]:[];
  }
  function journalRow({oldRow,dateISO,tab,label,amount,note,cell,col}){
    const a=classifyJournalEntry(label,note,col,dateISO);
    return [
      oldRow&&oldRow[0]?oldRow[0]:new Date().toISOString(),
      dateISO,tab,label,amount,note||'',cell,
      oldRow&&oldRow[7]!==undefined?oldRow[7]:false,
      a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,
      oldRow&&oldRow[16]?oldRow[16]:''
    ];
  }

  function ensureEditor(){
    let ov=document.getElementById('v7524-overlay');
    if(ov) return ov;
    ov=document.createElement('div');
    ov.id='v7524-overlay';ov.className='v7524-overlay';
    ov.innerHTML=`<div class="v7524-card">
      <div class="v7524-handle"></div>
      <div class="v7524-head"><div><div class="v7524-title"></div><div class="v7524-sub"></div></div><button class="v7524-close" type="button">×</button></div>
      <div class="v7524-field"><div class="v7524-label">Categorie</div><select class="v7524-select"></select></div>
      <div class="v7524-field"><div class="v7524-label">Montant</div><input class="v7524-input" inputmode="decimal"></div>
      <div class="v7524-field"><div class="v7524-label">Commentaire</div><textarea class="v7524-note" placeholder="Commentaire facultatif"></textarea></div>
      <div class="v7524-info"></div>
      <div class="v7524-buttons"><button class="v7524-delete" type="button">Supprimer</button><button class="v7524-save" type="button">Enregistrer</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.v7524-close').onclick=closeEditor;
    ov.onclick=e=>{if(e.target===ov) closeEditor();};
    ov.querySelector('.v7524-save').onclick=save;
    ov.querySelector('.v7524-delete').onclick=remove;
    return ov;
  }
  function resetArm(){
    armed=false;
    if(armTimer){clearTimeout(armTimer);armTimer=null;}
    const ov=document.getElementById('v7524-overlay'), b=ov&&ov.querySelector('.v7524-delete');
    if(b){b.textContent='Supprimer';b.style.background='#FFF7F8';b.style.color='#C53B47';}
  }
  function closeEditor(){
    const ov=document.getElementById('v7524-overlay');
    if(ov) ov.classList.remove('open');
    state=null;resetArm();
  }
  async function fillSelect(sel,item){
    sel.innerHTML='';
    const st=await getTabStructure(item.tab);
    st.sections.forEach(sec=>{
      const labels=sec.labels.filter(l=>(st.colOf[l]||'C')===item.col);
      if(!labels.length) return;
      const g=document.createElement('optgroup');g.label=cleanSection(sec.name);
      labels.forEach(l=>{const o=document.createElement('option');o.value=l;o.textContent=l;o.selected=l===item.label;g.appendChild(o);});
      sel.appendChild(g);
    });
    sel.disabled=item.kind!=='app';
  }
  async function open(item){
    state={...item};
    const ov=ensureEditor();
    ov.querySelector('.v7524-title').textContent=item.label;
    ov.querySelector('.v7524-sub').textContent=item.tab;
    ov.querySelector('.v7524-input').value=String(Math.abs(Number(item.amount)||0)).replace('.',',');
    ov.querySelector('.v7524-note').value=item.note||'';
    await fillSelect(ov.querySelector('.v7524-select'),item);
    ov.querySelector('.v7524-info').textContent=item.kind==='app'
      ?'Cette operation est individuelle. Tu peux la modifier, la supprimer ou la deplacer sans toucher aux autres lignes.'
      :'Montant historique provenant de la formule Google Sheets. Une modification le convertira en operation suivie individuellement.';
    resetArm();ov.classList.add('open');
  }

  function historicalWithout(m,item){
    return m.historical.filter((_,i)=>i!==item.hIndex).map(x=>({...x}));
  }
  function trackedList(m,excludeRow,replace){
    return m.tracked.filter(x=>x.sheetRow!==excludeRow).map(x=>({amount:Number(x.r[4])||0,row:x}))
      .concat(replace?[replace]:[]);
  }

  async function save(){
    if(!state) return;
    const s={...state}, ov=ensureEditor();
    const saveBtn=ov.querySelector('.v7524-save'), delBtn=ov.querySelector('.v7524-delete');
    const norm=normAmount(ov.querySelector('.v7524-input').value);
    if(norm==null){toast('Montant invalide',true);return;}
    const amount=Number(norm), note=ov.querySelector('.v7524-note').value.trim();
    const target=ov.querySelector('.v7524-select').value||s.label;
    saveBtn.disabled=delBtn.disabled=true;
    try{
      if(s.kind==='app'){
        const src=await model(s.label,s.tab,true);
        const oldRow=await freshRow(s.journalRow);
        if(!oldRow.some(v=>v!==''&&v!=null)) throw new Error('Cette operation n existe plus dans Saisies App.');
        const dateISO=String(oldRow[1]||s.date||presetISOFor(s.tab));

        if(target===s.label){
          const apps=trackedList(src,s.journalRow,{amount});
          const next=formula(src.historical,apps,src.sep);
          const rowVals=journalRow({oldRow,dateISO,tab:s.tab,label:s.label,amount,note,cell:src.cell,col:src.col});
          await valuesBatch([
            {range:src.cell,values:[[next]]},
            {range:`'${JOURNAL}'!A${s.journalRow}:Q${s.journalRow}`,values:[rowVals]}
          ]);
        }else{
          const dst=await model(target,s.tab,true);
          const srcApps=trackedList(src,s.journalRow,null);
          const dstApps=trackedList(dst,null,{amount});
          const srcFormula=formula(src.historical,srcApps,src.sep);
          const dstFormula=formula(dst.historical,dstApps,dst.sep);
          const rowVals=journalRow({oldRow,dateISO,tab:s.tab,label:target,amount,note,cell:dst.cell,col:dst.col});
          await valuesBatch([
            {range:src.cell,values:[[srcFormula]]},
            {range:dst.cell,values:[[dstFormula]]},
            {range:`'${JOURNAL}'!A${s.journalRow}:Q${s.journalRow}`,values:[rowVals]}
          ]);
          clear(target,s.tab);
        }
      }else{
        const m=await model(s.label,s.tab,true);
        const parts=historicalWithout(m,s);
        const rows=await fullJournalRows();
        const jr=freeRow(rows);
        const dateISO=presetISOFor(s.tab);
        const apps=trackedList(m,null,{amount});
        const next=formula(parts,apps,m.sep);
        const rowVals=journalRow({dateISO,tab:s.tab,label:s.label,amount,note,cell:m.cell,col:m.col});
        await valuesBatch([
          {range:m.cell,values:[[next]]},
          {range:`'${JOURNAL}'!A${jr}:Q${jr}`,values:[rowVals]}
        ]);
      }
      clear(s.label,s.tab);
      closeEditor();
      toast(target!==s.label?'✅ Operation deplacee':'✅ Operation modifiee');
      await loadCatDetail(target!==s.label?target:s.label,s.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){toast('Erreur : '+(e&&e.message||e),true);}
    finally{saveBtn.disabled=delBtn.disabled=false;}
  }

  async function remove(){
    if(!state) return;
    const ov=ensureEditor(), saveBtn=ov.querySelector('.v7524-save'), delBtn=ov.querySelector('.v7524-delete');
    if(!armed){
      armed=true;delBtn.textContent='Confirmer la suppression';delBtn.style.background='#C53B47';delBtn.style.color='#fff';
      armTimer=setTimeout(resetArm,5000);return;
    }
    const s={...state};saveBtn.disabled=delBtn.disabled=true;
    try{
      const m=await model(s.label,s.tab,true);
      if(s.kind==='app'){
        const row=await freshRow(s.journalRow);
        if(!row.some(v=>v!==''&&v!=null)) throw new Error('Cette operation n existe plus dans Saisies App.');
        const apps=trackedList(m,s.journalRow,null);
        const next=formula(m.historical,apps,m.sep);
        await valuesBatch([
          {range:m.cell,values:[[next]]},
          {range:`'${JOURNAL}'!A${s.journalRow}:Q${s.journalRow}`,values:[new Array(17).fill('')]}
        ]);
      }else{
        const parts=historicalWithout(m,s);
        const apps=trackedList(m,null,null);
        const next=formula(parts,apps,m.sep);
        await valuesUpdate(m.cell,next);
      }
      clear(s.label,s.tab);closeEditor();toast('🗑 Operation supprimee');
      await loadCatDetail(s.label,s.tab,++detailSeq);
      try{renderMois();}catch(_){}
      try{renderDashboard();}catch(_){}
    }catch(e){resetArm();toast('Erreur suppression : '+(e&&e.message||e),true);}
    finally{saveBtn.disabled=delBtn.disabled=false;}
  }

  function row(hist,item){
    const r=el('div','ent-row'), left=el('div');
    if(item.kind==='app'){
      left.appendChild(el('div','el',frDate(item.date)));
      if(item.note) left.appendChild(el('div','em',item.note));
      left.appendChild(el('div','v7524-src','Saisie App · operation individuelle'));
    }else{
      const title=item.raw&&item.num==null?'Formule historique':'Montant historique Google Sheets';
      left.appendChild(el('div','el',title));
      if(item.raw&&item.num==null) left.appendChild(el('div','em',item.raw));
      left.appendChild(el('div','v7524-src','Historique du fichier · modifiable'));
    }
    r.appendChild(left);
    const right=document.createElement('div');right.className='v7524-right';
    right.appendChild(el('div','ea',fmtEUR(item.amount)));
    const acts=document.createElement('div');acts.className='v7524-actions';
    const e=document.createElement('button');e.className='v7524-act';e.type='button';e.textContent='✎';
    const d=document.createElement('button');d.className='v7524-act v7524-del';d.type='button';d.textContent='🗑';
    e.onclick=ev=>{ev.preventDefault();ev.stopPropagation();open(item);};
    d.onclick=ev=>{ev.preventDefault();ev.stopPropagation();open(item);};
    acts.append(e,d);right.appendChild(acts);r.appendChild(right);hist.appendChild(r);
  }

  loadCatDetail=async function(label,tab,seq){
    const hist=$('#m-hist');
    try{
      const m=await model(label,tab,false);
      if(seq!==detailSeq) return;
      $('#m-total').textContent=fmtEUR(m.total);
      hist.innerHTML='';$('#m-histnote').style.display='none';
      const items=[];
      m.historical.forEach((h,i)=>{
        let amount=h.num!=null?Math.abs(Number(h.num)||0):0;
        if(h.num==null&&m.tracked.length===0&&m.historical.length===1) amount=Math.abs(m.total);
        items.push({kind:'historical',label,tab,col:m.col,amount,raw:h.raw,note:'',hIndex:i});
      });
      m.tracked.forEach(x=>items.push({
        kind:'app',label,tab,col:m.col,amount:Number(x.r[4])||0,
        date:String(x.r[1]||''),note:String(x.r[5]||''),journalRow:x.sheetRow
      }));
      $('#m-count').textContent=items.length?`${items.length} entree${items.length>1?'s':''}`:'';
      if(!items.length){hist.appendChild(el('p','muted','Aucune entree ce mois-ci.'));return;}
      items.forEach(it=>row(hist,it));
    }catch(e){
      if(seq!==detailSeq) return;
      $('#m-total').textContent='—';hist.innerHTML='';
      hist.appendChild(el('p','muted','Historique indisponible : '+(e&&e.message||e)));
    }
  };

  writeEntry=async function({label,amtStr,dateISO,note,_interactive=true}){
    const d=new Date(dateISO+'T12:00:00');
    await loadMeta();
    let tab=tabTitleFor(d.getFullYear(),d.getMonth());
    if(!monthTabs.some(t=>t.y===d.getFullYear()&&t.m===d.getMonth()))
      tab=await createMonthFromTemplate(d.getFullYear(),d.getMonth(),_interactive);
    const m=await model(label,tab,true);
    const amount=Number(amtStr);
    if(!Number.isFinite(amount)) throw new Error('Montant invalide.');
    const rows=await fullJournalRows(), jr=freeRow(rows);
    const apps=trackedList(m,null,{amount});
    const next=formula(m.historical,apps,m.sep);
    const rowVals=journalRow({dateISO,tab,label,amount,note,cell:m.cell,col:m.col});
    await valuesBatch([
      {range:m.cell,values:[[next]]},
      {range:`'${JOURNAL}'!A${jr}:Q${jr}`,values:[rowVals]}
    ]);
    clear(label,tab);bumpUsage(label);
    const t=await valuesGet(m.cell,'UNFORMATTED_VALUE').catch(()=>({values:[]}));
    const newTotal=(t.values&&t.values[0]&&t.values[0][0]!=null)?Number(t.values[0][0]):null;
    return {tab,cell:m.cell,newTotal};
  };
})();