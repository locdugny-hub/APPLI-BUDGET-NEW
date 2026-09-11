/* =====================================================================
   Budget Saisie — PWA reliée à Google Sheets (v7.2)
   Saisie · Mois · Dashboard · Pointage. PIN + Face ID/Touch ID (WebAuthn).
   Session persistante. Gestion des catégories + suppression de saisie.
   v7.2 : journal enrichi pour Pilotage 360, classification analytique locale des notes,
        compatibilité avec les filtres de flux et préparation du futur Tag IA Gemini.
   v7.1 : mois futurs préremplis conservés comme prévisions, exclus automatiquement du réalisé,
        fiche détail des entrées par catégorie (lecture de la formule),
        Dashboard annuel/multi-années calculé uniquement jusqu'au mois courant,
        modèle mensuel prérempli + Dashboard Sheet pérenne. Aucune année maximum.
   ===================================================================== */
'use strict';

const CFG = {
  get clientId(){ return localStorage.getItem('cfg_client_id')||''; },
  set clientId(v){ localStorage.setItem('cfg_client_id', v.trim()); },
  get sheetId(){ return localStorage.getItem('cfg_sheet_id')||''; },
  set sheetId(v){ localStorage.setItem('cfg_sheet_id', v.trim()); },
};
const SCOPE='https://www.googleapis.com/auth/spreadsheets';
const JOURNAL='Saisies App';
const SYNTH='Synthèse globale';
const MODEL='Modèle mois';
const INDEX_MONTHS='Index Mois';
const INDEX_CATS='Index Catégories';
const REF_CATS='Référentiel catégories';
const MONTHS_FR=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_AB=['J','F','M','A','M','J','J','A','S','O','N','D'];
const MONTHS_SHORT=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

/* ---------- Détection dynamique des onglets mensuels (aucune année codée en dur) ---------- */
const _norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const MONTH_IDX={}; MONTHS_FR.forEach((n,i)=>MONTH_IDX[_norm(n)]=i);
function parseMonthTitle(t){
  const m=_norm(t).match(/^([a-zé]+)\s+(\d{4})$/i); if(!m) return null;
  const idx=MONTH_IDX[m[1]]; if(idx===undefined) return null;
  const y=+m[2]; if(y<2000) return null;
  return {y,m:idx};
}
/* Titre réel de l'onglet pour (année, mois) — respecte l'orthographe exacte du classeur */
function tabTitleFor(y,m){ const f=monthTabs.find(t=>t.y===y&&t.m===m); return f?f.title:`${MONTHS_FR[m]} ${y}`; }
/* Les onglets futurs peuvent déjà exister et contenir une base budgétaire.
   Ils restent accessibles dans la vue Mois, mais le Dashboard 'réalisé' ne les
   additionne qu'à partir du mois auquel ils correspondent. */
const monthKey=t=>t.y*12+t.m;
function isRealizedTab(t,refDate=new Date()){
  return monthKey(t)<=refDate.getFullYear()*12+refDate.getMonth();
}
function dashboardMonthTabs(){ const now=new Date(); return monthTabs.filter(t=>isRealizedTab(t,now)); }

/* Liste de base (fallback hors-ligne) — la grille réelle est lue dans l'onglet du mois. */
const SECTIONS=[
  ['💰 Revenus','B',['💰 Salaire (M-1)','🏠 Loyer perçu Bondy','🏠 Loyer perçu Dugny','🚕 Revenus VTC','💰 Revenus divers']],
  ['🏠 Logement','C',['🏠 Location Romainville','💼 Charge copropriété Bondy','💼 Charge copropriété Dugny','🏛️ Taxe foncière (mensualisée)','🏦 Crédit Bondy','🏦 Crédit Dugny','⚡ Facture Électricité','🔥 Facture Gaz','🔥 Régularisation Gaz','🔧 Entretien chaudière']],
  ['🚗 Transport','C',['⛽ Essence','🚗 Frais voiture','🚌 Navigo']],
  ['🛡️ Assurances','C',['🚗 Assurance voiture','🏘️ Assurance Dugny','🏘️ Assurance Bondy','📄 Assurance emprunteur Bondy','📄 Assurance emprunteur Dugny','🏡 Assurance habitation Romainville','🛡️ Protection Boursorama','❤️ Mutuelle Sarah']],
  ['📱 Abonnements','C',['🎵 Apple Music','☁️ Apple Drive / iCloud','🎵 Apple Music (Sarah)','☁️ Apple Drive (Sarah)','🎬 Netflix','🌐 Box Internet','🤖 ChatGPT','📱 Abonnement téléphone','📱 Abonnement téléphone Darris','📱 Abonnement téléphone Sarah','🚕 Uber One','🏋️ Salle de sport']],
  ['🛒 Vie courante','C',['🛒 Courses','🍽️ Restaurants','✂️ Coiffeur','🚬 Chicha / Charbon','🎉 Sorties / Loisirs','🎁 Cadeaux','👨‍👩‍👧 Virement Papa','💶 Retrait espèces','📦 Frais divers','📦 Compte BRED Sarah','📦 Frais Sarah Fortuneo','🛡️ Sécurillon','🏛️ URSSAF']],
];
const EXC_HEADER='🎉 Exceptionnel / Ponctuel';
const SEC_NAMES=SECTIONS.map(s=>s[0]);
const CAT_INFO={}; SECTIONS.forEach(([sec,col,ls])=>ls.forEach(l=>CAT_INFO[l]={section:sec,col}));
const SEC_META=[['Logement','#2E6FB7'],['Transport','#1BA098'],['Assurances','#E8A33D'],['Abonnements','#8E7CC3'],['Vie courante','#D072A6'],['Exceptionnel','#9AA5B1']];

let accessToken=null, tokenExpiry=0, tokenClient=null;
const structCache={}; let selectedCat=null, decSep=null, sheetIds=null;
let moisDate=new Date(); moisDate.setDate(1);
let meta=null, metaAt=0;                 // métadonnées du classeur (titres d'onglets)
let monthTabs=[];                        // onglets mensuels détectés [{title,y,m}] triés
const monthCache={};                     // données mensuelles {rows,at,stat}
let journalCache=null;                   // {rows,at}
let lastSync=0;                          // dernière lecture/écriture réussie
let dash={year:new Date().getFullYear(), month:null, topAll:false};
let gridTab=null;                        // onglet utilisé par la grille de saisie
let entryTab=null;                       // onglet affiché dans la fiche catégorie

const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t); if(c)e.className=c; if(x!=null)e.textContent=x; return e;};
const tabName=d=>`${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
const todayISO=()=>new Date().toISOString().slice(0,10);
const frDate=iso=>{const p=String(iso).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(iso);};
const fmtEUR=n=>(Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const fmtEUR0=n=>Math.round(Number(n)||0).toLocaleString('fr-FR')+' €';
function colLetter(n){ let s=''; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26);} return s; }
function normAmount(s){ if(s==null)return null; const c=String(s).trim().replace(/\s/g,'').replace(',', '.'); if(!/^\d+(\.\d{1,2})?$/.test(c))return null; if(parseFloat(c)<=0)return null; return c; }
const usage=()=>{try{return JSON.parse(localStorage.getItem('usage')||'{}');}catch(_){return {};}};
const bumpUsage=l=>{const u=usage(); u[l]=(u[l]||0)+1; localStorage.setItem('usage',JSON.stringify(u));};
const queueGet=()=>{try{return JSON.parse(localStorage.getItem('queue')||'[]');}catch(_){return [];}};
const queueSet=q=>localStorage.setItem('queue',JSON.stringify(q));

/* ---------- PIN (clavier réactif : pointerdown, pas de délai) ---------- */
async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const pinHash=()=>localStorage.getItem('pin_hash')||'';
const setPinHash=h=>localStorage.setItem('pin_hash',h);
let lock={mode:'verify',buf:'',first:null,onDone:null,busy:false,bioTried:false};
function showLock(mode,onDone){ lock={mode,buf:'',first:null,onDone:onDone||null,busy:false,bioTried:false};
  $('#lock-title').textContent=mode==='create'?'Créez un code':'Entrez votre code';
  $('#lock-sub').textContent=mode==='create'?'Choisissez un code PIN à 6 chiffres':'Code PIN à 6 chiffres';
  $('#lock-forgot').style.display=mode==='verify'?'block':'none'; renderDots(); $('#lock').classList.add('open');
  syncLockBio(true); }
function hideLock(){ $('#lock').classList.remove('open'); }
function renderDots(){ const d=$('#pin-dots'); d.innerHTML=''; for(let i=0;i<6;i++) d.appendChild(el('div','dot'+(i<lock.buf.length?' on':''))); }
function buildPad(){
  const p=$('#pin-pad'); p.innerHTML='';
  ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k=>{
    if(k===''){
      /* Touche Face ID (coin bas-gauche, comme iOS) — visible si activé */
      const fb=el('button','key bio'); fb.id='key-bio'; fb.title='Déverrouiller avec Face ID';
      fb.innerHTML=FACE_SVG; fb.style.visibility='hidden';
      const fpress=e=>{ e.preventDefault(); fb.classList.add('pressed'); setTimeout(()=>fb.classList.remove('pressed'),120); tryBioUnlock(); };
      if(window.PointerEvent) fb.addEventListener('pointerdown',fpress);
      else fb.addEventListener('touchstart',fpress,{passive:false}), fb.addEventListener('mousedown',fpress);
      p.appendChild(fb); return;
    }
    const b=el('button','key',k);
    const press=e=>{ e.preventDefault(); b.classList.add('pressed'); setTimeout(()=>b.classList.remove('pressed'),120); pinPress(k); };
    if(window.PointerEvent) b.addEventListener('pointerdown',press);
    else b.addEventListener('touchstart',press,{passive:false}), b.addEventListener('mousedown',press);
    p.appendChild(b);
  });
}
function pinPress(k){
  if(lock.busy) return;
  if(k==='⌫'){ lock.buf=lock.buf.slice(0,-1); renderDots(); return; }
  if(lock.buf.length>=6) return;
  lock.buf+=k; renderDots();
  if(lock.buf.length===6) pinComplete();
}
async function pinComplete(){
  lock.busy=true;
  try{
    const code=lock.buf;
    if(lock.mode==='create'){
      if(lock.first===null){ lock.first=code; lock.buf=''; renderDots();
        $('#lock-title').textContent='Confirmez le code'; $('#lock-sub').textContent='Retapez le même code'; return; }
      if(code!==lock.first){ lock.first=null; lock.buf=''; shake();
        $('#lock-title').textContent='Créez un code'; $('#lock-sub').textContent='Les codes diffèrent, réessayez'; return; }
      setPinHash(await sha256(code)); const cb=lock.onDone; hideLock(); if(cb)cb(); toast('🔒 Code PIN enregistré');
      /* Proposer Face ID juste après la création du code */
      if(bioSupport&&!bioEnabled()&&confirm('Activer Face ID pour déverrouiller sans taper le code ?')){
        try{ await bioRegister(); toast('✅ Face ID activé'); }
        catch(_){ toast('Face ID non activé — réessaie depuis Réglages → Sécurité.',true); }
      }
      return;
    }
    if(await sha256(code)===pinHash()){ const cb=lock.onDone; hideLock(); if(cb)cb(); }
    else { lock.buf=''; shake(); }
  } finally { lock.busy=false; }
}
function shake(){ const l=$('#lock'); l.classList.add('shake'); setTimeout(()=>l.classList.remove('shake'),350); renderDots(); }

/* ---------- Face ID / Touch ID (WebAuthn — passkey locale, rien n'est envoyé à un serveur) ---------- */
const FACE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H6a3 3 0 0 0-3 3v2"/><path d="M16 3h2a3 3 0 0 1 3 3v2"/><path d="M8 21H6a3 3 0 0 1-3-3v-2"/><path d="M16 21h2a3 3 0 0 0 3-3v-2"/><path d="M8.5 9v1.6"/><path d="M15.5 9v1.6"/><path d="M12 9.5v3.2c0 .5-.4.9-1 .9"/><path d="M8.7 16a4.6 4.6 0 0 0 6.6 0"/></svg>';
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64uDec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const bioEnabled=()=>!!localStorage.getItem('bio_cred');
let bioSupport=false, bioBusy=false;
async function bioCheckSupport(){
  try{ bioSupport=!!(window.isSecureContext&&window.PublicKeyCredential&&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch(_){ bioSupport=false; }
  updateBioUI(); syncLockBio(true);   // si le verrou est déjà affiché au boot, la touche apparaît + tentative auto
  return bioSupport;
}
async function bioRegister(){
  if(!bioSupport) throw new Error('Indisponible ici (HTTPS + appareil compatible requis).');
  const cred=await navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    rp:{name:'Budget Saisie'},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'Budget',displayName:'Budget · Saisie'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},
    timeout:60000,attestation:'none'}});
  if(!cred) throw new Error('Activation annulée.');
  localStorage.setItem('bio_cred',b64u(cred.rawId));
  updateBioUI();
}
function bioDisable(){ localStorage.removeItem('bio_cred'); updateBioUI(); }
async function bioAssert(){
  const id=localStorage.getItem('bio_cred'); if(!id) return false;
  const a=await navigator.credentials.get({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials:[{type:'public-key',id:b64uDec(id),transports:['internal']}],
    userVerification:'required',timeout:60000}});
  return !!a;
}
async function tryBioUnlock(){
  if(bioBusy||lock.mode!=='verify'||!bioEnabled()||!$('#lock').classList.contains('open')) return;
  bioBusy=true;
  try{ if(await bioAssert()){ const cb=lock.onDone; hideLock(); if(cb)cb(); } }
  catch(_){ /* refus / échec Face ID → le code PIN reste disponible */ }
  finally{ bioBusy=false; }
}
function syncLockBio(auto){
  const show=lock.mode==='verify'&&bioSupport&&bioEnabled()&&$('#lock').classList.contains('open');
  const kb=$('#key-bio'); if(kb) kb.style.visibility=show?'visible':'hidden';
  if(show){ $('#lock-sub').textContent='Face ID ou code à 6 chiffres';
    if(auto&&!lock.bioTried){ lock.bioTried=true; setTimeout(tryBioUnlock,350); } }
}
function updateBioUI(){
  const btn=$('#s-bio'), note=$('#s-bio-note');
  if(btn){ btn.style.display=bioSupport?'':'none'; btn.textContent=bioEnabled()?'Désactiver Face ID':'Activer Face ID / Touch ID'; }
  if(note) note.style.display=bioSupport?'none':'';
}

/* ---------- Session persistante ---------- */
function saveTok(){ try{ localStorage.setItem('tok', JSON.stringify({t:accessToken,e:tokenExpiry})); }catch(_){} }
function restoreTok(){ try{ const o=JSON.parse(localStorage.getItem('tok')||'null');
  if(o&&o.t&&o.e&&o.e>Date.now()+60000){ accessToken=o.t; tokenExpiry=o.e; return true; } }catch(_){} return false; }
function clearTok(){ localStorage.removeItem('tok'); accessToken=null; tokenExpiry=0; }

function initAuth(){ if(!CFG.clientId)return false;
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG.clientId,scope:SCOPE,callback:()=>{}}); return true; }
function requestToken(){ return new Promise((resolve,reject)=>{
  if(!tokenClient){reject(new Error('Client OAuth non initialisé (Réglages).')); return;}
  tokenClient.callback=r=>{ if(r&&r.access_token){ accessToken=r.access_token; tokenExpiry=Date.now()+((r.expires_in||3300)*1000); saveTok(); resolve(r.access_token); }
    else reject(new Error('Échec de connexion Google.')); };
  tokenClient.error_callback=e=>reject(new Error((e&&e.type)||'Connexion annulée.'));
  /* prompt:'' = réutilise l'autorisation déjà donnée (pas de re-consentement) */
  tokenClient.requestAccessToken({prompt:''}); }); }
async function ensureToken(){
  if(accessToken&&Date.now()<tokenExpiry-60000) return accessToken;
  try{ return await requestToken(); }
  catch(e){ showReconnect(); throw new Error('Session expirée — touche « Se connecter »'); }
}
function showReconnect(){ $('#app').style.display='none'; $('#nav').classList.remove('on'); $('#screen-connect').style.display='block'; }

/* ---------- Sheets API ---------- */
async function api(path,{method='GET',params=null,body=null}={}){
  await ensureToken();
  let url=`https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}${path}`;
  if(params){ const qs=(params instanceof URLSearchParams)?params:new URLSearchParams(params);
    url+=(url.includes('?')?'&':'?')+qs.toString(); }
  const opt={method,headers:{Authorization:`Bearer ${accessToken}`}};
  if(body){opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body);}
  let r=await fetch(url,opt);
  if(r.status===401){ clearTok(); await ensureToken(); opt.headers.Authorization=`Bearer ${accessToken}`; r=await fetch(url,opt); }
  if(!r.ok){ const t=await r.text(); throw new Error(`API ${r.status}: ${t.slice(0,160)}`); }
  lastSync=Date.now();
  return r.json();
}
const enc=r=>encodeURIComponent(r);
const valuesGet=(range,render)=>api(`/values/${enc(range)}`,{params:render?{valueRenderOption:render}:null});
function valuesBatchGet(ranges,render){
  const p=new URLSearchParams(); ranges.forEach(r=>p.append('ranges',r));
  if(render) p.set('valueRenderOption',render);
  return api('/values:batchGet',{params:p});
}
const valuesUpdate=(range,value,vio='USER_ENTERED')=>api(`/values/${enc(range)}`,{method:'PUT',params:{valueInputOption:vio},body:{values:[[value]]}});
const valuesUpdateRow=(range,rowVals,vio='USER_ENTERED')=>api(`/values/${enc(range)}`,{method:'PUT',params:{valueInputOption:vio},body:{values:[rowVals]}});
const valuesAppend=(range,row,vio='RAW')=>api(`/values/${enc(range)}:append`,{method:'POST',params:{valueInputOption:vio,insertDataOption:'INSERT_ROWS'},body:{values:[row]}});
const valuesAppendRows=(range,rows,vio='USER_ENTERED')=>api(`/values/${enc(range)}:append`,{method:'POST',params:{valueInputOption:vio,insertDataOption:'INSERT_ROWS'},body:{values:rows}});
async function valuesBatch(data){ return api(`/values:batchUpdate`,{method:'POST',body:{valueInputOption:'USER_ENTERED',data}}); }
/* Métadonnées du classeur : titres + ids d'onglets. C'est ici que les nouveaux
   onglets mensuels (Janvier 2027, …) sont détectés automatiquement. */
const META_TTL=10*60*1000;
async function loadMeta(force){
  const now=Date.now();
  if(!force&&meta&&now-metaAt<META_TTL) return meta;
  const m=await api('',{params:{fields:'sheets.properties(sheetId,title)'}});
  sheetIds={}; const titles=[];
  (m.sheets||[]).forEach(s=>{ sheetIds[s.properties.title]=s.properties.sheetId; titles.push(s.properties.title); });
  monthTabs=titles.map(t=>{ const p=parseMonthTitle(t); return p?{title:t,y:p.y,m:p.m}:null; })
    .filter(Boolean).sort((a,b)=>a.y-b.y||a.m-b.m);
  meta={titles}; metaAt=now;
  return meta;
}
async function sheetIdOf(title){
  await loadMeta();
  if(!(title in sheetIds)) await loadMeta(true);
  if(!(title in sheetIds)) throw new Error(`Onglet « ${title} » introuvable dans le classeur.`);
  return sheetIds[title];
}
async function insertRowAt(title,R){ const sid=await sheetIdOf(title);
  await api(':batchUpdate',{method:'POST',body:{requests:[{insertDimension:{range:{sheetId:sid,dimension:'ROWS',startIndex:R-1,endIndex:R},inheritFromBefore:true}}]}}); }
async function deleteRowAt(title,R){ const sid=await sheetIdOf(title);
  await api(':batchUpdate',{method:'POST',body:{requests:[{deleteDimension:{range:{sheetId:sid,dimension:'ROWS',startIndex:R-1,endIndex:R}}}]}}); }

/* ---------- Infrastructure pérenne du classeur ----------
   Le Dashboard Google Sheets s'appuie sur des index normalisés. La PWA les
   maintient lors de la création d'un mois ou d'une catégorie. ---------- */
const escSheet=s=>String(s).replace(/'/g,"''");
const escLabel=s=>String(s).replace(/"/g,'""');
const cleanSection=s=>String(s).replace(/^[^ ]+\s+/,'').replace(/\s*\/\s*Ponctuel$/,'');
function idxCellFormula(tab,col,label,S){
  const t=escSheet(tab), l=escLabel(label);
  return `=IFERROR(INDEX('${t}'!$${col}:$${col}${S}MATCH("${l}"${S}'${t}'!$A:$A${S}0))${S}0)`;
}
function idxKpiFormula(tab,label,S){
  const t=escSheet(tab), l=escLabel(label);
  return `=IFERROR(INDEX('${t}'!$G:$G${S}MATCH("${l}"${S}'${t}'!$F:$F${S}0))${S}0)`;
}
async function infraReady(){
  const m=await loadMeta();
  return [MODEL,INDEX_MONTHS,INDEX_CATS,REF_CATS].every(t=>m.titles.includes(t));
}
async function ensureAnnualSummaryRow(yearIndex){
  const R=58+yearIndex, sourceSRow=3+yearIndex, S=await argSep();
  const yRef=`'${INDEX_MONTHS}'!$S$${sourceSRow}`;
  const vals=[
    `=IFERROR(IF(${yRef}<=YEAR(TODAY())${S}${yRef}${S}"")${S}"")`,
    `=IF($A${R}=""${S}""${S}SUMIFS('${INDEX_MONTHS}'!$G:$G${S}'${INDEX_MONTHS}'!$A:$A${S}$A${R}${S}'${INDEX_MONTHS}'!$F:$F${S}1))`,
    `=IF($A${R}=""${S}""${S}SUMIFS('${INDEX_MONTHS}'!$H:$H${S}'${INDEX_MONTHS}'!$A:$A${S}$A${R}${S}'${INDEX_MONTHS}'!$F:$F${S}1))`,
    `=IF($A${R}=""${S}""${S}B${R}-C${R})`,
    `=IF($A${R}=""${S}""${S}IFERROR(D${R}/B${R}${S}0))`
  ];
  for(const col of ['K','L','M','N','O','P','Q'])
    vals.push(`=IF($A${R}=""${S}""${S}SUMIFS('${INDEX_MONTHS}'!$${col}:$${col}${S}'${INDEX_MONTHS}'!$A:$A${S}$A${R}${S}'${INDEX_MONTHS}'!$F:$F${S}1))`);
  if(R>61){
    const sid=await sheetIdOf(SYNTH);
    try{ await api(':batchUpdate',{method:'POST',body:{requests:[{copyPaste:{
      source:{sheetId:sid,startRowIndex:57,endRowIndex:58,startColumnIndex:0,endColumnIndex:12},
      destination:{sheetId:sid,startRowIndex:R-1,endRowIndex:R,startColumnIndex:0,endColumnIndex:12},
      pasteType:'PASTE_FORMAT',pasteOrientation:'NORMAL'}}]}}); }catch(_){ /* format facultatif */ }
  }
  await valuesUpdateRow(`'${SYNTH}'!A${R}:L${R}`,vals,'USER_ENTERED');
}
async function ensureYearSelector(y){
  const d=await valuesGet(`'${INDEX_MONTHS}'!S3:S`,'UNFORMATTED_VALUE');
  const years=(d.values||[]).map(r=>r&&r[0]).filter(v=>v!==''&&v!=null).map(Number);
  let i=years.findIndex(v=>v===Number(y));
  if(i<0){ await valuesAppend(`'${INDEX_MONTHS}'!S:S`,Number(y),'RAW'); years.push(Number(y)); i=years.length-1; }
  await ensureAnnualSummaryRow(i);
}
async function ensureReferenceEntry(section,type,col,label){
  const d=await valuesGet(`'${REF_CATS}'!A2:D`,'UNFORMATTED_VALUE');
  const rows=d.values||[];
  if(rows.some(r=>String(r[1]||'')===type&&String(r[3]||'')===label)) return;
  const R=rows.length+2, S=await argSep();
  const totalF=`=IF(D${R}=""${S}""${S}IF('${SYNTH}'!$B$2="TOUTES"${S}SUMIFS('${INDEX_CATS}'!$H:$H${S}'${INDEX_CATS}'!$G:$G${S}D${R}${S}'${INDEX_CATS}'!$F:$F${S}B${R}${S}'${INDEX_CATS}'!$I:$I${S}1)${S}SUMIFS('${INDEX_CATS}'!$H:$H${S}'${INDEX_CATS}'!$G:$G${S}D${R}${S}'${INDEX_CATS}'!$F:$F${S}B${R}${S}'${INDEX_CATS}'!$B:$B${S}'${SYNTH}'!$B$2${S}'${INDEX_CATS}'!$I:$I${S}1)))`;
  const keyF=`=IF(B${R}="Sortie"${S}G${R}+ROW()/1000000000${S}0)`;
  await valuesAppendRows(`'${REF_CATS}'!A:H`,[[cleanSection(section),type,col,label,false,'',totalF,keyF]],'USER_ENTERED');
}
async function syncMonthCategories(tab){
  if(!(await infraReady())) return;
  const p=parseMonthTitle(tab); if(!p) return;
  const S=await argSep(), st=await getTabStructure(tab);
  const [ex,rd]=await Promise.all([
    valuesGet(`'${INDEX_CATS}'!D2:G`,'UNFORMATTED_VALUE'),
    valuesGet(`'${REF_CATS}'!A2:D`,'UNFORMATTED_VALUE')
  ]);
  const existing=new Set((ex.values||[]).map(r=>`${r[0]||''}|${r[2]||''}|${r[3]||''}`));
  const refRows=rd.values||[], refKeys=new Set(refRows.map(r=>`${r[1]||''}|${r[3]||''}`));
  const add=[], refAdd=[];
  for(const sec of st.sections){
    for(const label of sec.labels){
      const specs=sec.name===SEC_NAMES[0]?[['Entrée','B']]:sec.name===EXC_HEADER?[['Entrée','B'],['Sortie','C']]:[['Sortie','C']];
      for(const [type,col] of specs){
        const refKey=`${type}|${label}`;
        if(!refKeys.has(refKey)){
          const R=refRows.length+refAdd.length+2;
          const totalF=`=IF(D${R}=""${S}""${S}IF('${SYNTH}'!$B$2="TOUTES"${S}SUMIFS('${INDEX_CATS}'!$H:$H${S}'${INDEX_CATS}'!$G:$G${S}D${R}${S}'${INDEX_CATS}'!$F:$F${S}B${R}${S}'${INDEX_CATS}'!$I:$I${S}1)${S}SUMIFS('${INDEX_CATS}'!$H:$H${S}'${INDEX_CATS}'!$G:$G${S}D${R}${S}'${INDEX_CATS}'!$F:$F${S}B${R}${S}'${INDEX_CATS}'!$B:$B${S}'${SYNTH}'!$B$2${S}'${INDEX_CATS}'!$I:$I${S}1)))`;
          const keyF=`=IF(B${R}="Sortie"${S}G${R}+ROW()/1000000000${S}0)`;
          refAdd.push([cleanSection(sec.name),type,col,label,false,'',totalF,keyF]); refKeys.add(refKey);
        }
        const key=`${tab}|${type}|${label}`;
        if(existing.has(key)) continue;
        const idxR=(ex.values||[]).length+add.length+2;
        const actualF=`=IF(D${idxR}=""${S}0${S}--(B${idxR}*12+C${idxR}<=YEAR(TODAY())*12+MONTH(TODAY())))`;
        add.push([`${p.y}-${String(p.m+1).padStart(2,'0')}-01`,p.y,p.m+1,tab,cleanSection(sec.name),type,label,idxCellFormula(tab,col,label,S),actualF]);
        existing.add(key);
      }
    }
  }
  if(refAdd.length) await valuesAppendRows(`'${REF_CATS}'!A:H`,refAdd,'USER_ENTERED');
  if(add.length) await valuesAppendRows(`'${INDEX_CATS}'!A:I`,add,'USER_ENTERED');
}
async function syncMonthIndex(tab){
  if(!(await infraReady())) return false;
  const p=parseMonthTitle(tab); if(!p) return false;
  const d=await valuesGet(`'${INDEX_MONTHS}'!D2:D`,'UNFORMATTED_VALUE');
  const rows=d.values||[];
  const exists=rows.some(r=>String((r||[])[0]||'')===tab);
  if(!exists){
    const R=rows.length+2, S=await argSep();
    const fEnt=idxKpiFormula(tab,'Entrées du mois',S), fSor=idxKpiFormula(tab,'Sorties du mois',S);
    const actualF=`=IF(D${R}=""${S}0${S}--(A${R}*12+B${R}<=YEAR(TODAY())*12+MONTH(TODAY())))`;
    const filledF=`=IF(AND(F${R}=1${S}OR(G${R}<>0${S}H${R}<>0))${S}1${S}0)`;
    const statusF=`=IF(D${R}=""${S}""${S}IF(A${R}*12+B${R}>YEAR(TODAY())*12+MONTH(TODAY())${S}"Prévisionnel"${S}IF(A${R}*12+B${R}=YEAR(TODAY())*12+MONTH(TODAY())${S}"En cours"${S}"Réalisé")))`;
    const vals=[p.y,p.m+1,MONTHS_FR[p.m],tab,`${p.y}-${String(p.m+1).padStart(2,'0')}-01`,actualF,
      fEnt,fSor,`=G${R}-H${R}`,`=IFERROR(I${R}/G${R}${S}0)`,
      `=G${R}`,idxCellFormula(tab,'C','Sous-total Logement',S),
      idxCellFormula(tab,'C','Sous-total Transport',S),idxCellFormula(tab,'C','Sous-total Assurances',S),
      idxCellFormula(tab,'C','Sous-total Abonnements',S),idxCellFormula(tab,'C','Sous-total Vie courante',S),
      idxCellFormula(tab,'C','Sous-total Exceptionnel',S),'','',filledF,statusF];
    await valuesAppendRows(`'${INDEX_MONTHS}'!A:U`,[vals],'USER_ENTERED');
  }
  await ensureYearSelector(p.y);
  await syncMonthCategories(tab);
  return true;
}
async function syncDetectedMonthsToIndexes(){
  if(!(await infraReady())) return;
  const d=await valuesGet(`'${INDEX_MONTHS}'!D2:D`,'UNFORMATTED_VALUE');
  const known=new Set((d.values||[]).map(r=>String((r||[])[0]||'')));
  for(const t of monthTabs){ if(!known.has(t.title)) await syncMonthIndex(t.title); }
}
async function applyRecurringValues(tab){
  if(!(await infraReady())) return;
  const d=await valuesGet(`'${REF_CATS}'!A2:F`,'UNFORMATTED_VALUE');
  const st=await getTabStructure(tab), data=[];
  (d.values||[]).forEach(r=>{
    const active=r[4]===true||String(r[4]).toUpperCase()==='TRUE'||r[4]===1;
    const amount=r[5]; if(!active||amount===''||amount==null) return;
    const label=String(r[3]||''), row=st.map[label]; if(!row) return;
    const col=String(r[2]||st.colOf[label]||'C');
    data.push({range:`'${tab}'!${col}${row}`,values:[[Number(amount)]]});
  });
  if(data.length) await valuesBatch(data);
}
async function createMonthFromTemplate(y,m,interactive=true){
  await loadMeta(true);
  const tab=`${MONTHS_FR[m]} ${y}`;
  if(monthTabs.some(t=>t.y===y&&t.m===m)) return tabTitleFor(y,m);
  if(!interactive) throw new Error(`L'onglet « ${tab} » n'existe pas encore.`);
  if(!(await infraReady())) throw new Error('Le Google Sheet doit d’abord être migré vers la version pérenne (Modèle mois + index techniques).');
  if(!confirm(`L'onglet « ${tab} » n'existe pas encore.\n\nLe créer maintenant à partir de « ${MODEL} » ?`)) throw new Error('Création du mois annulée.');
  const sid=await sheetIdOf(MODEL);
  await api(':batchUpdate',{method:'POST',body:{requests:[{duplicateSheet:{sourceSheetId:sid,newSheetName:tab}}]}});
  metaAt=0; await loadMeta(true);
  await valuesUpdate(`'${tab}'!A1`,`${MONTHS_FR[m].toUpperCase()} ${y}`,'RAW');
  delete structCache[tab];
  await applyRecurringValues(tab);
  await syncMonthIndex(tab);
  metaAt=0; await loadMeta(true);
  gridSections=null;
  toast(`✅ ${tab} créé et ajouté au suivi`);
  return tab;
}

/* Séparateur décimal + séparateur d'arguments selon la locale du fichier */
async function getDecSep(){
  if(decSep) return decSep;
  try{ const meta=await api('',{params:{fields:'properties.locale'}});
    const loc=((meta.properties&&meta.properties.locale)||'fr_FR').replace('_','-');
    decSep=(1.1).toLocaleString(loc).replace(/[0-9]/g,'').trim()||'.'; }
  catch(_){ decSep=','; }
  return decSep;
}
async function argSep(){ return (await getDecSep())===','?';':','; }
async function toLocalFormula(f){ return (await getDecSep())===','? f.split(',').join(';') : f; }

/* ---------- Structure d'un onglet mensuel (dynamique) ---------- */
function parseStructure(rows){
  const sections=[]; let cur=null; const map={}; const colOf={}; let totalRow=null;
  rows.forEach((row,i)=>{
    const a=(row&&row[0]!=null?row[0]:'').toString().trim(); const R=i+1;
    if(!a) return;
    if(a==='TOTAL'){ totalRow=R; cur=null; return; }
    if(a==='SOLDE DU MOIS'){ cur=null; return; }
    if(SEC_NAMES.includes(a)||a===EXC_HEADER){ cur={name:a,headerRow:R,catRows:[],labels:[],subtotalRow:null}; sections.push(cur); return; }
    if(a.startsWith('Sous-total')){ if(cur)cur.subtotalRow=R; cur=null; return; }
    if(cur){ cur.catRows.push(R); cur.labels.push(a); map[a]=R; colOf[a]=(cur.name===SEC_NAMES[0])?'B':'C';
      CAT_INFO[a]=CAT_INFO[a]||{section:cur.name,col:colOf[a]}; }
  });
  return {sections,map,colOf,totalRow};
}
async function getTabStructure(tab){
  if(structCache[tab]) return structCache[tab];
  const data=await valuesGet(`'${tab}'!A1:A200`); const rows=data.values||[];
  const st=parseStructure(rows); structCache[tab]=st; return st;
}
function invalidateCaches(){
  for(const k in structCache) delete structCache[k];
  for(const k in monthCache) delete monthCache[k];
  journalCache=null; metaAt=0;
}

function composeFormula(existing,amt){
  if(existing===undefined||existing===null||existing==='') return `=${amt}`;
  const s=String(existing).trim(); if(s==='')return `=${amt}`;
  return s.startsWith('=')?`${s}+${amt}`:`=${s}+${amt}`;
}

/* ---------- Anti-doublon ---------- */
async function findDuplicates(dateISO,label,amt){
  try{ const d=await valuesGet(`'${JOURNAL}'!A2:H`,'UNFORMATTED_VALUE'); const rows=d.values||[]; const a=parseFloat(amt); const out=[];
    rows.forEach(r=>{ if(String(r[1])===dateISO&&String(r[3])===label&&Math.abs((Number(r[4])||0)-a)<0.005) out.push(r); }); return out;
  }catch(_){ return []; }
}

/* ---------- Enrichissement analytique du journal ---------- */
function classifyJournalEntry(label,note,col,dateISO){
  const c=_norm(label||''), n=_norm(note||''), txt=(c+' '+n);
  const sense=col==='B'?'Entrée':'Sortie';
  let tag='', nature='', rec='Variable', source='Catégorie';
  if(sense==='Entrée'){
    nature='Revenu';
    if(txt.includes('vente voiture')){ tag='Cession actif'; nature='Flux neutre'; rec='Ponctuel'; source='Règle'; }
    else if(['rembours','mutuel','mutuelle','alan','sollyazar','autodoc','shein','dgfip'].some(k=>txt.includes(k))){ tag='Remboursement'; nature='Flux neutre'; rec='Ponctuel'; source='Règle'; }
    else if(txt.includes('credit impot')||txt.includes('avance impot')){ tag='Flux fiscal'; nature='Flux neutre'; rec='Ponctuel'; source='Règle'; }
    else if(c.includes('loyer')){ tag='Revenu immobilier'; rec='Récurrent'; }
    else if(c.includes('salaire')){ tag='Salaire'; rec='Récurrent'; }
    else if(c.includes('vtc')){ tag='VTC'; }
    else if(c.includes('revenus divers')){ tag='Service / autre revenu'; source='Règle'; }
    else tag=label||'Revenu';
  }else{
    nature=(c.includes('credit bondy')||c.includes('credit dugny'))?'Patrimonial':'Dépense';
    if(['dentiste','medec','pharma','sante','mutuelle'].some(k=>txt.includes(k))){ tag='Santé'; rec='Ponctuel'; source='Règle'; }
    else if(['hotel','avion','vacance','aeroport','voyage'].some(k=>txt.includes(k))){ tag='Vacances / Voyage'; rec='Ponctuel'; source='Règle'; }
    else if(['midas','pneu','voiture','carte grise','controle technique','autodoc'].some(k=>txt.includes(k))){ tag='Auto'; source='Règle'; }
    else if(['ikea','leroy','chaudiere','travaux','dugny','bondy'].some(k=>txt.includes(k))){ tag='Immobilier / Travaux'; rec='Ponctuel'; source='Règle'; }
    else if(['cadeau','aid','mouton'].some(k=>txt.includes(k))){ tag='Cadeaux / Famille'; rec='Ponctuel'; source='Règle'; }
    else if(txt.includes('formation')){ tag='Formation'; rec='Ponctuel'; source='Règle'; }
    else if(c.includes('frais sarah fortuneo')||c.includes('compte bred sarah')) tag='Foyer Sarah';
    else if(c.includes('frais divers')){ tag='Divers à analyser'; rec='Ponctuel'; source='Règle'; }
    else if(c.includes('courses')) tag='Courses';
    else if(c.includes('restaurants')) tag='Restaurant';
    else tag=label||'Autre';
  }
  const d=new Date(dateISO+'T12:00:00');
  const signed=sense==='Entrée'?1:-1;
  return {sense,tag,nature,rec,year:d.getFullYear(),month:d.getMonth()+1,signed,source};
}

/* ---------- Écriture d'une saisie ---------- */
async function writeEntry({label,amtStr,dateISO,note,_interactive=true}){
  const d=new Date(dateISO+'T12:00:00');
  await loadMeta();
  let tab=tabTitleFor(d.getFullYear(),d.getMonth());
  if(!monthTabs.some(t=>t.y===d.getFullYear()&&t.m===d.getMonth()))
    tab=await createMonthFromTemplate(d.getFullYear(),d.getMonth(),_interactive);
  const st=await getTabStructure(tab); const row=st.map[label];
  if(!row) throw new Error(`Catégorie « ${label} » absente de l'onglet ${tab}.`);
  const col=st.colOf[label]||'C';
  const cell=`'${tab}'!${col}${row}`;
  const sep=await getDecSep(); const amtOut=amtStr.replace('.',sep);
  const cur=await valuesGet(cell,'FORMULA');
  const existing=(cur.values&&cur.values[0]&&cur.values[0][0]!==undefined)?cur.values[0][0]:'';
  await valuesUpdate(cell,composeFormula(existing,amtOut));
  let newTotal=null; try{ const t=await valuesGet(cell,'UNFORMATTED_VALUE'); newTotal=(t.values&&t.values[0]&&t.values[0][0]!=null)?Number(t.values[0][0]):null; }catch(_){}
  try{ await ensureJournal(); const a=classifyJournalEntry(label,note,col,dateISO); const amount=Number(amtStr); await valuesAppend(`'${JOURNAL}'!A:Q`,[new Date().toISOString(),dateISO,tab,label,amount,note||'',cell,false,a.sense,a.tag,a.nature,a.rec,a.year,a.month,a.signed*amount,a.source,'']); }catch(_){}
  bumpUsage(label); delete monthCache[tab]; journalCache=null;
  return {tab,cell,newTotal};
}
let journalReady=false;
async function ensureJournal(){
  if(journalReady)return;
  const m=await loadMeta();
  if(!m.titles.includes(JOURNAL)){
    await api(':batchUpdate',{method:'POST',body:{requests:[{addSheet:{properties:{title:JOURNAL}}}]}});
    await valuesAppend(`'${JOURNAL}'!A1:Q1`,['Horodatage','Date dépense','Mois (onglet)','Catégorie','Montant','Note','Cellule','Pointé','Sens','Tag analytique','Nature économique','Récurrence','Année','Mois #','Montant signé','Source classement','Tag IA (futur)'],'RAW');
    metaAt=0;
  }
  journalReady=true;
}

/* ---------- Suppression d'une saisie (retire le montant + la ligne du journal) ---------- */
async function deleteEntry(item){
  const sep=await getDecSep();
  const cand=[]; const n=item.amt;
  cand.push(String(n).replace('.',sep));
  if(Number.isFinite(n)) cand.push(n.toFixed(2).replace('.',sep));
  const cur=await valuesGet(item.cell,'FORMULA');
  let f=(cur.values&&cur.values[0]&&cur.values[0][0]!==undefined)?String(cur.values[0][0]):'';
  let done=false;
  for(const c of [...new Set(cand)]){
    const needle='+'+c; const i=f.lastIndexOf(needle);
    if(i>=0){ const after=f[i+needle.length]; if(after===undefined||!/[0-9]/.test(after)){ f=f.slice(0,i)+f.slice(i+needle.length); done=true; break; } }
    if(f==='='+c){ f=''; done=true; break; }
  }
  if(!done){ const s=String(f||'').trim(); f=(s===''?'=0':(s.startsWith('=')?s:'='+s))+'-'+cand[0]; }
  await valuesUpdate(item.cell,f);
  await deleteRowAt(JOURNAL,item.sheetRow);
  const mm=String(item.cell).match(/^'(.+)'!/); if(mm) delete monthCache[mm[1]];
  journalCache=null;
}

/* ---------- Ajout d'une catégorie ---------- */
function monthsFrom(startTab,alsoFuture){
  const all=monthTabs.map(t=>t.title);           // dynamique : tous les onglets existants
  const i=all.indexOf(startTab); if(i<0) return [startTab];
  return alsoFuture? all.slice(i) : [startTab];
}
async function addCategory({emoji,name,secIdx,startTab,alsoFuture}){
  const label=(emoji||'🏷️').trim()+' '+name.trim();
  const secName=SEC_NAMES[secIdx], col=(secIdx===0)?'B':'C', type=(secIdx===0)?'Entrée':'Sortie';
  const tabs=monthsFrom(startTab,alsoFuture); let added=0; const changed=[];
  async function addTo(tab){
    let st; try{ st=await getTabStructure(tab); }catch(_){ return false; }
    if(st.map[label]) return false;
    const sec=st.sections.find(s=>s.name===secName);
    if(!sec||!sec.catRows.length) return false;
    const R=sec.catRows[sec.catRows.length-1];
    await insertRowAt(tab,R); await valuesUpdate(`'${tab}'!A${R}`,label,'RAW');
    delete structCache[tab]; return true;
  }
  for(const tab of tabs){ if(await addTo(tab)){ added++; changed.push(tab); } }
  /* Si la catégorie doit exister à l'avenir, elle est aussi ajoutée au modèle
     dont seront dupliqués tous les nouveaux mois. */
  if(alsoFuture&&meta&&meta.titles.includes(MODEL)){ try{ await addTo(MODEL); }catch(_){} }
  if(!added) throw new Error('Catégorie déjà présente (ou section introuvable).');
  await ensureReferenceEntry(secName,type,col,label);
  for(const tab of changed){ try{ await syncMonthCategories(tab); }catch(_){} }
  invalidateCaches();
  return {added};
}

/* ---------- Suppression d'une catégorie (du mois uniquement) ---------- */
async function deleteCategory(tab,label){
  const st=await getTabStructure(tab);
  const R=st.map[label]; if(!R) throw new Error('Catégorie introuvable.');
  const sec=st.sections.find(s=>s.labels.includes(label));
  if(sec&&sec.catRows.length<=1) throw new Error('Impossible : garde au moins une catégorie par section.');
  await deleteRowAt(tab,R);
  delete structCache[tab]; delete monthCache[tab];
}

/* ---------- File d'attente ---------- */
async function flushQueue(){ let q=queueGet(); if(!q.length)return; const rest=[]; for(const it of q){ try{await writeEntry({...it,_interactive:false});}catch(_){rest.push(it);} } queueSet(rest); renderQueueBadge(); }
window.addEventListener('online',()=>{ if(accessToken) flushQueue().then(()=>renderCategories()); });

/* =====================================================================
   UI / Navigation
   ===================================================================== */
const VIEWS=['saisie','mois','resume','reco'];
const activeView=()=>VIEWS.find(v=>$('#view-'+v).classList.contains('on'))||'saisie';
function switchTab(w){
  VIEWS.forEach(v=>{ $('#view-'+v).classList.toggle('on',v===w); $('#nav-'+v).classList.toggle('on',v===w); });
  const titles={saisie:'💶 Saisie',mois:'📅 Mois',resume:'📊 Dashboard',reco:'✓ Pointage'};
  $('#hdr-title').textContent=titles[w]||'💶 Budget';
  if(w==='mois') renderMois(); else if(w==='resume') renderDashboard(); else if(w==='reco') renderReco();
}
async function onAuthed(){
  $('#screen-connect').style.display='none'; $('#app').style.display='block'; $('#nav').classList.add('on');
  $('#hdr-month').textContent=tabName(new Date());
  invalidateCaches();
  renderQueueBadge(); flushQueue();
  try{ await loadMeta(); await syncDetectedMonthsToIndexes(); }catch(_){ /* hors-ligne / ancien classeur : démarrage quand même */ }
  updateSyncLine();
  renderCategories();
  if(!pinHash()) showLock('create',()=>{});
}

/* ---------- Indicateur discret de synchronisation ---------- */
function agoStr(){
  if(!lastSync) return '';
  const s=(Date.now()-lastSync)/1000;
  if(s<60) return "synchro à l'instant";
  if(s<3600) return 'synchro il y a '+Math.max(1,Math.round(s/60))+' min';
  return 'synchro il y a '+Math.round(s/3600)+' h';
}
function updateSyncLine(){
  const a=agoStr();
  const now=new Date(); const curTab=tabTitleFor(now.getFullYear(),now.getMonth());
  const missing=monthTabs.length&&!monthTabs.some(t=>t.title===curTab);
  $('#hdr-month').textContent=curTab+(missing?' · onglet à créer':'')+(a?' · '+a:'');
  const d=$('#dash-sync-t'); if(d) d.textContent=a||'—';
}

/* ---------- Saisie (grille dynamique depuis l'onglet du mois) ---------- */
let gridSections=null;
async function loadGrid(){
  try{ await loadMeta(); }catch(_){}
  const now=new Date(); let tab=tabTitleFor(now.getFullYear(),now.getMonth());
  if(monthTabs.length&&!monthTabs.some(t=>t.title===tab)) tab=monthTabs[monthTabs.length-1].title; // dernier onglet dispo
  gridTab=tab;
  try{
    const st=await getTabStructure(tab);
    gridSections=st.sections.filter(s=>s.labels.length).map(s=>({name:s.name,labels:s.labels.slice(),col:(s.name===SEC_NAMES[0])?'B':'C'}));
  }catch(_){
    gridSections=SECTIONS.map(([name,col,labels])=>({name,labels:labels.slice(),col}));
  }
}
async function renderCategories(){
  if(!gridSections) await loadGrid();
  const wrap=$('#categories'); wrap.innerHTML='';
  const q=($('#search').value||'').toLowerCase().trim(); const u=usage();
  const all=[]; gridSections.forEach(s=>s.labels.forEach(l=>all.push(l)));
  const freq=Object.keys(u).filter(l=>all.includes(l)).sort((a,b)=>u[b]-u[a]).slice(0,6);
  if(freq.length&&!q){ wrap.appendChild(el('div','sec-title','⭐ Fréquents')); const g=el('div','grid'); freq.forEach(l=>g.appendChild(catButton(l))); wrap.appendChild(g); }
  gridSections.forEach(s=>{
    const m=s.labels.filter(l=>!q||l.toLowerCase().includes(q)); if(!m.length)return;
    wrap.appendChild(el('div','sec-title',s.name)); const g=el('div','grid'); m.forEach(l=>g.appendChild(catButton(l,s.col==='B'))); wrap.appendChild(g);
  });
}
function catButton(label,isRev){
  const b=el('button','cat'); const p=label.split(' '); const emoji=p.length>1?p.shift():'🏷️';
  b.innerHTML=`<span class="emo">${emoji}</span><span class="lbl">${p.join(' ')||label}</span>`;
  const rev=(isRev!==undefined)?isRev:(CAT_INFO[label]&&CAT_INFO[label].col==='B');
  if(rev) b.classList.add('rev');
  b.onclick=()=>openCatSheet(label,gridTab); return b;
}

/* =====================================================================
   Fiche catégorie : historique des entrées (lecture de la formule) + ajout
   ===================================================================== */
function parseLocaleNum(t,sep){
  let x=String(t).trim(); if(x==='') return null;
  if(sep===','){ if(x.includes('.')&&x.includes(',')) return null; x=x.replace(',', '.'); }
  return /^\d+(\.\d+)?$/.test(x)? parseFloat(x): null;
}
/* Découpe une formule en termes additifs de premier niveau.
   `=120+23,5+45-18` → [120, 23.5, 45, -18]. Les termes non numériques
   (SUM(...), références, produits…) sont conservés tels quels : on ne casse rien. */
function parseFormulaTerms(f,sep){
  const s=String(f==null?'':f).trim();
  if(s==='') return {terms:[],additive:true};
  if(!s.startsWith('=')){
    const n=parseLocaleNum(s,sep);
    return {terms:[{raw:s,num:n,sign:1}],additive:n!=null};
  }
  const body=s.slice(1);
  const parts=[]; let depth=0, cur='', curSign=1;
  for(let i=0;i<body.length;i++){
    const c=body[i];
    if(c==='"'){ cur+=c; i++; while(i<body.length){ cur+=body[i]; if(body[i]==='"') break; i++; } continue; }
    if(c==='(') depth++;
    else if(c===')') depth=Math.max(0,depth-1);
    if(depth===0&&(c==='+'||c==='-')){
      const t=cur.trimEnd(); const prev=t.slice(-1);
      if(t===''){ if(c==='-') curSign=-curSign; continue; }               // signe en tête
      const isExp=/[eE]$/.test(t)&&/[0-9]/.test(body[i+1]||'');           // 1e-3
      if(!isExp&&!'*/^,;('.includes(prev)){ parts.push({expr:cur,sign:curSign}); cur=''; curSign=(c==='-')?-1:1; continue; }
    }
    cur+=c;
  }
  if(cur.trim()!=='') parts.push({expr:cur,sign:curSign});
  let additive=parts.length>0;
  const terms=parts.map(p=>{ const t=p.expr.trim(); const n=parseLocaleNum(t,sep);
    if(n==null) additive=false; return {raw:t,num:n,sign:p.sign}; });
  return {terms,additive};
}
async function getJournal(){
  const now=Date.now();
  if(journalCache&&now-journalCache.at<60e3) return journalCache.rows;
  try{ const d=await valuesGet(`'${JOURNAL}'!A2:H`,'UNFORMATTED_VALUE'); journalCache={rows:d.values||[],at:now}; }
  catch(_){ journalCache={rows:[],at:now}; }
  return journalCache.rows;
}
function presetISOFor(tab){
  const p=parseMonthTitle(tab); const now=new Date();
  if(!p||(p.y===now.getFullYear()&&p.m===now.getMonth())) return todayISO();
  return `${p.y}-${String(p.m+1).padStart(2,'0')}-15`;
}
let detailSeq=0;
function openCatSheet(label,tab){
  selectedCat=label;
  entryTab=tab||gridTab||tabName(new Date());
  $('#m-cat').textContent=label;
  $('#m-sub').textContent=entryTab;
  $('#m-total').textContent='…';
  $('#m-count').textContent='';
  const isRev=CAT_INFO[label]&&CAT_INFO[label].col==='B';
  $('#m-total-l').textContent='Total du mois';
  $('#m-showform').textContent=isRev?'＋ Ajouter un montant':'＋ Ajouter une dépense';
  $('#m-hist').innerHTML='<div class="skl"></div><div class="skl" style="width:70%"></div>';
  $('#m-histnote').style.display='none';
  $('#m-form').style.display='none'; $('#m-showform').style.display='';
  $('#m-amount').value=''; $('#m-note').value=''; $('#m-date').value=presetISOFor(entryTab);
  $('#modal').classList.add('open');
  loadCatDetail(label,entryTab,++detailSeq);
}
async function loadCatDetail(label,tab,seq){
  const hist=$('#m-hist');
  try{
    const st=await getTabStructure(tab);
    const R=st.map[label];
    if(!R) throw new Error(`Catégorie absente de l'onglet ${tab}.`);
    const col=st.colOf[label]||'C';
    const cell=`'${tab}'!${col}${R}`;
    const [fD,vD,jRows,sep]=await Promise.all([
      valuesGet(cell,'FORMULA'), valuesGet(cell,'UNFORMATTED_VALUE'), getJournal(), getDecSep()
    ]);
    if(seq!==detailSeq) return;                      // une autre fiche a été ouverte entre-temps
    const rawF=(fD.values&&fD.values[0]&&fD.values[0][0]!==undefined)?fD.values[0][0]:'';
    const val=(vD.values&&vD.values[0]&&vD.values[0][0]!=null)?Number(vD.values[0][0]):0;
    const {terms}=parseFormulaTerms(rawF,sep);
    /* Association avec le journal (dates + notes des saisies faites via l'app) */
    const jList=jRows.filter(r=>r&&String(r[2])===tab&&String(r[3])===label)
      .map(r=>({date:String(r[1]||''),amt:Number(r[4])||0,note:String(r[5]||'')}));
    const used=new Array(jList.length).fill(false);
    const items=terms.map(t=>{
      if(t.num==null) return {kind:'expr',raw:t.raw};
      if(t.sign>0){ const k=jList.findIndex((j,i)=>!used[i]&&Math.abs(j.amt-t.num)<0.005);
        if(k>=0){ used[k]=true; return {kind:'app',num:t.num,date:jList[k].date,note:jList[k].note}; } }
      return {kind:'sheet',num:t.num*t.sign};
    });
    hist.innerHTML='';
    $('#m-total').textContent=fmtEUR(val);
    const nNum=items.filter(x=>x.kind!=='expr').length;
    $('#m-count').textContent=nNum?`${nNum} entrée${nNum>1?'s':''}`:'';
    if(!items.length){ hist.appendChild(el('p','muted','Aucune entrée ce mois-ci.')); return; }
    items.forEach(x=>{
      const row=el('div','ent-row'); const lf=el('div');
      if(x.kind==='app'){
        lf.appendChild(el('div','el',frDate(x.date)));
        if(x.note) lf.appendChild(el('div','em',x.note));
        row.appendChild(lf); row.appendChild(el('div','ea',fmtEUR(x.num)));
      }else if(x.kind==='sheet'){
        lf.appendChild(el('div','el',x.num<0?'Correction':'Saisie Google Sheets'));
        row.appendChild(lf); row.appendChild(el('div','ea'+(x.num<0?' neg':''),fmtEUR(x.num)));
      }else{
        lf.appendChild(el('div','el','Formule'));
        lf.appendChild(el('div','em',x.raw.length>34?x.raw.slice(0,34)+'…':x.raw));
        row.appendChild(lf); row.appendChild(el('div','ea','—'));
      }
      hist.appendChild(row);
    });
    if(items.some(x=>x.kind==='expr')){
      const n=$('#m-histnote');
      n.textContent='Cette cellule contient une partie calculée par formule : le total ci-dessus reste la valeur exacte de Google Sheets.';
      n.style.display='block';
    }
  }catch(e){
    if(seq!==detailSeq) return;
    $('#m-total').textContent='—';
    hist.innerHTML='';
    hist.appendChild(el('p','muted',navigator.onLine?('Historique indisponible : '+e.message):'Hors-ligne : historique indisponible (l\'ajout reste possible).'));
  }
}
function closeEntry(){ $('#modal').classList.remove('open'); selectedCat=null; }
async function submitEntry(){
  const amtStr=normAmount($('#m-amount').value); if(!amtStr){ toast('Montant invalide',true); return; }
  const dateISO=$('#m-date').value||todayISO(); const note=$('#m-note').value.trim();
  const payload={label:selectedCat,amtStr,dateISO,note};
  const btn=$('#m-add'); btn.disabled=true; btn.textContent='…';
  try{
    if(!navigator.onLine) throw new Error('offline');
    const dups=await findDuplicates(dateISO,selectedCat,amtStr);
    if(dups.length){ if(!confirm(`⚠️ Déjà saisi le ${frDate(dateISO)} : ${short(selectedCat)} ${fmtEUR(amtStr)}${dups[0][5]?' ('+dups[0][5]+')':''}.\nAjouter quand même ?`)){ btn.disabled=false; btn.textContent='Ajouter'; return; } }
    const res=await writeEntry(payload); closeEntry();
    toast(`✅ ${fmtEUR(amtStr)} → ${short(payload.label)} (${res.tab})`+(res.newTotal!=null?` · total ${fmtEUR(res.newTotal)}`:''));
    renderCategories();
    const v=activeView(); if(v==='mois') renderMois(); else if(v==='resume') renderDashboard();
  }catch(e){
    if(e.message==='offline'||/Failed to fetch|NetworkError/i.test(e.message)){ const q=queueGet(); q.push(payload); queueSet(q); closeEntry(); toast("📴 Hors-ligne : mise en file d'attente"); renderQueueBadge(); }
    else toast('Erreur : '+e.message,true);
  }finally{ btn.disabled=false; btn.textContent='Ajouter'; }
}
const short=l=>{ const p=l.split(' '); return p.length>1?p.slice(1).join(' '):l; };

/* ---------- Nouvelle catégorie ---------- */
function openCatModal(){
  const sel=$('#c-section'); sel.innerHTML='';
  SEC_NAMES.forEach((n,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=n; if(i===5)o.selected=true; sel.appendChild(o); });
  const ms=$('#c-month'); ms.innerHTML='';
  const now=new Date(); const cur=tabTitleFor(now.getFullYear(),now.getMonth());
  const list=monthTabs.length?monthTabs.map(t=>t.title):[tabName(now)];   // dynamique
  list.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; if(t===cur)o.selected=true; ms.appendChild(o); });
  $('#c-emoji').value=''; $('#c-name').value=''; $('#c-future').checked=true;
  $('#cat-modal').classList.add('open');
}
async function submitCat(){
  let name=($('#c-name').value||'').trim().replace(/["';,=]/g,'');
  const emoji=($('#c-emoji').value||'').trim();
  if(name.length<2){ toast('Nom trop court',true); return; }
  const secIdx=parseInt($('#c-section').value,10);
  const startTab=$('#c-month').value; const alsoFuture=$('#c-future').checked;
  const btn=$('#c-add'); btn.disabled=true; btn.textContent='…';
  try{
    const res=await addCategory({emoji,name,secIdx,startTab,alsoFuture});
    $('#cat-modal').classList.remove('open');
    toast(`✅ Catégorie créée dans ${res.added} mois + dashboard`);
    gridSections=null; renderCategories();
  }catch(e){ toast('Erreur : '+e.message,true); }
  finally{ btn.disabled=false; btn.textContent='Créer'; }
}

/* ---------- Gérer les catégories du mois ---------- */
async function openManage(){
  const tab=currentMoisTab(); $('#mg-title').textContent=`🗂 Catégories — ${tab}`;
  const list=$('#mg-list'); list.innerHTML='<p class="muted">Chargement…</p>';
  $('#manage-modal').classList.add('open');
  let st,vals;
  try{ st=await getTabStructure(tab); const d=await valuesGet(`'${tab}'!A1:C200`,'UNFORMATTED_VALUE'); vals=d.values||[]; }
  catch(e){ list.innerHTML='<p class="muted">Erreur de lecture.</p>'; return; }
  list.innerHTML='';
  st.sections.forEach(sec=>{
    if(sec.name===EXC_HEADER) return;
    list.appendChild(el('div','sec-title',sec.name));
    sec.labels.forEach((label,k)=>{
      const R=sec.catRows[k]; const v=vals[R-1]||[];
      const amount=(sec.name===SEC_NAMES[0])?(Number(v[1])||0):(Number(v[2])||0);
      const row=el('div','hrow'); const left=el('div','hleft');
      const info=el('div'); info.appendChild(el('div','hcat',label));
      info.appendChild(el('div','hmeta', amount? fmtEUR(amount)+' ce mois-ci':'vide ce mois-ci'));
      left.appendChild(info); row.appendChild(left);
      const right=el('div','hright');
      const del=el('button','del','🗑');
      del.onclick=async()=>{
        const warn=amount? `⚠️ « ${label} » contient ${fmtEUR(amount)} sur ${tab}. Sa valeur sera perdue pour CE mois.\n`:'';
        if(!confirm(warn+`Supprimer « ${label} » de ${tab} ?\n(Le dashboard garde la ligne : l'historique des autres mois est conservé.)`)) return;
        del.disabled=true;
        try{ await deleteCategory(tab,label); toast('Catégorie supprimée de '+tab); gridSections=null; openManage(); renderCategories(); }
        catch(e){ toast('Erreur : '+e.message,true); del.disabled=false; }
      };
      right.appendChild(del); row.appendChild(right); list.appendChild(row);
    });
  });
}

/* ---------- Mois (navigation dynamique sur les onglets existants) ---------- */
function moisIndex(){
  if(!monthTabs.length) return -1;
  const y=moisDate.getFullYear(), m=moisDate.getMonth();
  const i=monthTabs.findIndex(t=>t.y===y&&t.m===m);
  if(i>=0) return i;
  for(let k=monthTabs.length-1;k>=0;k--){ const t=monthTabs[k]; if(t.y<y||(t.y===y&&t.m<=m)) return k; }
  return 0;
}
function currentMoisTab(){ const i=moisIndex(); return i>=0?monthTabs[i].title:tabName(moisDate); }
function moveMois(d){
  const i=moisIndex(); if(i<0) return;
  const j=i+d; if(j<0||j>=monthTabs.length) return;
  moisDate=new Date(monthTabs[j].y,monthTabs[j].m,1); renderMois();
}
async function renderMois(){
  try{ await loadMeta(); }catch(_){}
  const i=moisIndex();
  if(i>=0) moisDate=new Date(monthTabs[i].y,monthTabs[i].m,1);
  const tab=currentMoisTab(); $('#mois-label').textContent=tab;
  $('#m-prev').disabled=(i<=0); $('#m-next').disabled=(i<0||i>=monthTabs.length-1);
  const body=$('#mois-body'); body.innerHTML='<p class="muted">Chargement…</p>';
  let data; try{ data=await valuesGet(`'${tab}'!A1:D200`,'UNFORMATTED_VALUE'); }catch(e){ body.innerHTML='<p class="muted">Impossible de lire ce mois.</p>'; return; }
  const rows=data.values||[]; const val={};
  rows.forEach(r=>{ const a=(r[0]||'').toString().trim(); if(a){ val[a]={ent:Number(r[1])||0,sor:Number(r[2])||0}; } });
  let st; try{ st=await getTabStructure(tab); }catch(e){ body.innerHTML='<p class="muted">Structure illisible.</p>'; return; }
  let totEnt=0,totSor=0;
  st.sections.forEach(sec=>sec.labels.forEach(l=>{ const v=val[l]; if(!v) return;
    if(sec.name===SEC_NAMES[0]) totEnt+=v.ent;
    else if(sec.name===EXC_HEADER){ totEnt+=v.ent; totSor+=v.sor; }
    else totSor+=v.sor; }));
  body.innerHTML='';
  const head=el('div','kpis'); head.style.padding='0 0 4px';
  head.appendChild(kpi('Entrées',fmtEUR0(totEnt),'green'));
  head.appendChild(kpi('Sorties',fmtEUR0(totSor),'red'));
  head.appendChild(kpi('Solde',fmtEUR0(totEnt-totSor),(totEnt-totSor)>=0?'green':'red'));
  const tx=totEnt>0?((totEnt-totSor)/totEnt):0; head.appendChild(kpi("Taux d'épargne",(tx*100).toFixed(1).replace('.',',')+' %','teal'));
  body.appendChild(head);
  st.sections.forEach(sec=>{
    const isRev=(sec.name===SEC_NAMES[0]);
    const items=sec.labels.map(l=>({l,v:val[l]})).filter(x=>x.v&&((isRev?x.v.ent:x.v.sor)>0));
    if(!items.length) return;
    const card=el('div','card'); card.style.margin='14px 0 0';
    card.appendChild(el('h3',null,sec.name));
    let sub=0;
    items.forEach(({l,v})=>{
      const amount=isRev?v.ent:v.sor; sub+=amount;
      const row=el('div','mrow'); row.onclick=()=>openCatSheet(l,tab);
      const left=el('div','ml'); const p=l.split(' '); const emo=p.length>1?p.shift():'🏷️';
      left.appendChild(el('span','',emo)); left.appendChild(el('span','lbl',p.join(' ')||l));
      row.appendChild(left); row.appendChild(el('div','mv'+(isRev?' rev':''),fmtEUR(amount)));
      card.appendChild(row);
    });
    const stt=el('div','subtot'); stt.appendChild(el('span',null,'Sous-total')); stt.appendChild(el('span',null,fmtEUR(sub)));
    card.appendChild(stt); body.appendChild(card);
  });
  const hint=el('p','muted','Touche une ligne pour voir le détail des saisies et en ajouter.');
  hint.style.cssText='font-size:12px;text-align:center;margin:16px 0 0'; body.appendChild(hint);
}
function kpi(label,value,cls){ const c=el('div','kpi '+(cls||'')); c.appendChild(el('div','k-l',label)); c.appendChild(el('div','k-v',value)); return c; }

/* =====================================================================
   Dashboard — calculé directement depuis les onglets mensuels.
   Aucune dépendance à une plage d'années : tout vient de monthTabs.
   ===================================================================== */
const CHART_GREEN='#2E9E5B', CHART_RED='#B0333D', CHART_INK='#12284B';
const kfmt=v=>{ const a=Math.abs(v);
  if(a>=1000){ let s=(v/1000).toFixed(a>=10000?0:1).replace('.',','); s=s.replace(/,0$/,''); return s+' k€'; }
  return Math.round(v)+' €'; };
const fmtPctFR=p=>{ const x=Math.abs(p)*100; return x.toFixed(x>=10?0:1).replace('.',',')+' %'; };

function computeMonthStat(rows){
  const st=parseStructure(rows||[]);
  const cats={}; const secT={}; let ent=0,sor=0;
  st.sections.forEach(sec=>{
    const isRev=sec.name===SEC_NAMES[0], isExc=sec.name===EXC_HEADER;
    sec.labels.forEach((l,k)=>{
      const r=(rows&&rows[sec.catRows[k]-1])||[];
      const b=Number(r[1])||0, c=Number(r[2])||0;
      if(isRev){ ent+=b; }
      else if(isExc){ ent+=b; sor+=c; if(c){ cats[l]={amt:c,sec:sec.name}; secT[sec.name]=(secT[sec.name]||0)+c; } }
      else { sor+=c; if(c){ cats[l]={amt:c,sec:sec.name}; secT[sec.name]=(secT[sec.name]||0)+c; } }
    });
  });
  return {ent,sor,sol:ent-sor,cats,secT,has:(ent>0||sor>0)};
}
/* Lecture groupée des onglets (1 seul appel batchGet), avec cache + TTL */
async function loadMonths(titles,force){
  const now=Date.now(); const cur=tabTitleFor(new Date().getFullYear(),new Date().getMonth());
  const need=titles.filter(t=>{ const c=monthCache[t]; if(!c) return true;
    const ttl=(t===cur)?60*1000:15*60*1000; return !!force||now-c.at>ttl; });
  if(need.length){
    const res=await valuesBatchGet(need.map(t=>`'${t}'!A1:D200`),'UNFORMATTED_VALUE');
    (res.valueRanges||[]).forEach((vr,i)=>{ const rows=vr.values||[];
      monthCache[need[i]]={rows,at:now,stat:computeMonthStat(rows)}; });
  }
  const out={}; titles.forEach(t=>out[t]=(monthCache[t]&&monthCache[t].stat)||computeMonthStat([]));
  return out;
}
function aggStats(list){          // list = [{y,m,title,stat}]
  const a={ent:0,sor:0,sol:0,cats:{},secT:{},n:0};
  list.forEach(x=>{ if(!x.stat||!x.stat.has) return;
    a.n++; a.ent+=x.stat.ent; a.sor+=x.stat.sor;
    Object.entries(x.stat.cats).forEach(([l,c])=>{ (a.cats[l]=a.cats[l]||{amt:0,sec:c.sec}).amt+=c.amt; });
    Object.entries(x.stat.secT).forEach(([s,v])=>{ a.secT[s]=(a.secT[s]||0)+v; }); });
  a.sol=a.ent-a.sor; return a;
}
function evoBadge(cur,prev,goodUp){
  if(prev==null) return '';
  if(prev===0&&cur===0) return '';
  if(prev===0) return '<span class="bd new">nouveau</span>';
  const p=(cur-prev)/Math.abs(prev);
  if(Math.abs(p)<0.01) return '<span class="bd flat">stable</span>';
  const up=p>0, good=goodUp?up:!up;
  return `<span class="bd ${good?'g':'r'}">${up?'▲':'▼'} ${fmtPctFR(p)}</span>`;
}
function cmpRow(label,cur,prev,goodUp){
  const badge=(prev==null)?'<span class="bd flat">—</span>':evoBadge(cur,prev,goodUp)||'<span class="bd flat">stable</span>';
  const sub=(prev==null)?fmtEUR0(cur):`${fmtEUR0(prev)} → ${fmtEUR0(cur)}`;
  return `<div class="cmp"><div><div class="cl">${label}</div><div class="cv">${sub}</div></div>${badge}</div>`;
}
/* Barres revenus/dépenses + ligne de solde. Couleurs validées CVD
   (vert #2E9E5B / rouge profond #B0333D, ΔE deutan 9,8) ; le solde est un
   trait navy = forme distincte. Un seul axe (tout est en €). */
function chartSVG(items,selIdx){
  const W=360,H=196,L=40,Bm=26,T=12,Rm=8;
  const n=Math.max(1,items.length); const iw=(W-L-Rm)/n;
  const maxV=Math.max(1,...items.map(i=>Math.max(i.ent,i.sor,Math.abs(i.sol))));
  const y=v=>T+(H-T-Bm)*(1-v/maxV); const y0=H-Bm;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Revenus, dépenses et solde par période">`;
  [1,.5].forEach(f=>{ const vy=y(maxV*f);
    s+=`<line x1="${L}" x2="${W-Rm}" y1="${vy.toFixed(1)}" y2="${vy.toFixed(1)}" stroke="#E3E9F2" stroke-width="1" stroke-dasharray="3 3"/>`;
    s+=`<text x="${L-5}" y="${(vy+3).toFixed(1)}" font-size="9" fill="#9AA5B1" text-anchor="end">${kfmt(maxV*f)}</text>`; });
  s+=`<line x1="${L}" x2="${W-Rm}" y1="${y0}" y2="${y0}" stroke="#CBD5E4" stroke-width="1"/>`;
  const bw=Math.min(11,Math.max(4,iw*0.3));
  items.forEach((it,i)=>{ const cx=L+iw*i+iw/2;
    const dim=(selIdx!=null&&selIdx!==i)?' opacity="0.35"':'';
    s+=`<g${dim}><rect x="${(cx-bw-1).toFixed(1)}" y="${y(it.ent).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y0-y(it.ent)).toFixed(1)}" rx="2" fill="${CHART_GREEN}"/>`;
    s+=`<rect x="${(cx+1).toFixed(1)}" y="${y(it.sor).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y0-y(it.sor)).toFixed(1)}" rx="2" fill="${CHART_RED}"/></g>`;
    s+=`<text x="${cx.toFixed(1)}" y="${H-10}" font-size="9" fill="#6B7280" text-anchor="middle"${selIdx===i?' font-weight="800"':''}>${it.label}</text>`; });
  if(items.length>1){
    const pts=items.map((it,i)=>`${(L+iw*i+iw/2).toFixed(1)},${y(Math.max(0,it.sol)).toFixed(1)}`);
    s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${CHART_INK}" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>`;
  }
  items.forEach((it,i)=>{ const cx=L+iw*i+iw/2;
    s+=`<circle cx="${cx.toFixed(1)}" cy="${y(Math.max(0,it.sol)).toFixed(1)}" r="3" fill="${it.sol>=0?CHART_INK:CHART_RED}"/>`; });
  items.forEach((it,i)=>{ s+=`<rect data-tap="${i}" x="${(L+iw*i).toFixed(1)}" y="0" width="${iw.toFixed(1)}" height="${H}" fill="transparent"><title>${it.title||it.label} — Revenus ${fmtEUR0(it.ent)}, Dépenses ${fmtEUR0(it.sor)}, Solde ${fmtEUR0(it.sol)}</title></rect>`; });
  return s+'</svg>';
}
let allCmp=null;
async function renderDashboard(){
  allCmp=null;
  const yc=$('#dash-years'), mc=$('#dash-months'), kp=$('#dash-kpis'), kp2=$('#dash-kpis2');
  kp.innerHTML='<p class="muted" style="grid-column:1/3">Chargement…</p>'; kp2.innerHTML='';
  try{ await loadMeta(); }
  catch(e){ kp.innerHTML=`<p class="muted" style="grid-column:1/3">Connexion impossible : ${e.message}</p>`; return; }
  const dashTabs=dashboardMonthTabs();
  const years=[...new Set(dashTabs.map(t=>t.y))].sort((a,b)=>a-b);
  if(!years.length){ yc.innerHTML=''; mc.style.display='none';
    kp.innerHTML='<p class="muted" style="grid-column:1/3">Aucun onglet mensuel détecté dans le Google Sheet.</p>'; return; }
  if(dash.year!=='all'&&!years.includes(dash.year))
    dash.year=years.includes(new Date().getFullYear())?new Date().getFullYear():years[years.length-1];
  /* Sélecteur d'années (dynamique — les nouvelles années apparaissent seules) */
  yc.innerHTML='';
  years.forEach(yv=>{ const b=el('button','chip'+(dash.year===yv?' on':''),String(yv));
    b.onclick=()=>{ dash.year=yv; dash.month=null; renderDashboard(); }; yc.appendChild(b); });
  const ba=el('button','chip'+(dash.year==='all'?' on':''),'Tout');
  ba.onclick=()=>{ dash.year='all'; dash.month=null; renderDashboard(); }; yc.appendChild(ba);
  /* Sélecteur de mois de l'année choisie */
  const yTabs=dash.year==='all'?[]:dashTabs.filter(t=>t.y===dash.year);
  if(dash.month!=null&&!yTabs.some(t=>t.m===dash.month)) dash.month=null;
  mc.style.display=yTabs.length?'flex':'none'; mc.innerHTML='';
  if(yTabs.length){
    const all=el('button','chip'+(dash.month==null?' on':''),'Année');
    all.onclick=()=>{ dash.month=null; renderDashboard(); }; mc.appendChild(all);
    yTabs.forEach(t=>{ const b=el('button','chip'+(dash.month===t.m?' on':''),MONTHS_SHORT[t.m]);
      b.onclick=()=>{ dash.month=t.m; renderDashboard(); }; mc.appendChild(b); });
  }
  /* Données du périmètre (+ période précédente pour les comparaisons) */
  const scopeTabs=dash.year==='all'?dashTabs.slice():dashTabs.filter(t=>t.y===dash.year);
  const prevYTabs=(dash.year!=='all'&&years.includes(dash.year-1))?dashTabs.filter(t=>t.y===dash.year-1):[];
  const needTitles=[...new Set([...scopeTabs,...prevYTabs].map(t=>t.title))];
  let stats;
  try{ stats=await loadMonths(needTitles); }
  catch(e){ kp.innerHTML=`<p class="muted" style="grid-column:1/3">Erreur de synchronisation : ${e.message}</p>`; return; }
  updateSyncLine();
  const mlist=scopeTabs.map(t=>({...t,stat:stats[t.title]}));
  const withData=mlist.filter(x=>x.stat.has);
  const now=new Date(); const curKey=now.getFullYear()*12+now.getMonth();
  const isMonthScope=dash.month!=null;
  /* ---- Agrégats du périmètre ---- */
  let scope, scopeTitle, prevRef=null, prevTitle='', cmpNote='';
  if(isMonthScope){
    const t=mlist.find(x=>x.m===dash.month);
    scope=t?t.stat:computeMonthStat([]); scopeTitle=`${MONTHS_FR[dash.month]} ${dash.year}`;
    const gi=dashTabs.findIndex(x=>x.y===dash.year&&x.m===dash.month);
    if(gi>0){ const pt=dashTabs[gi-1]; const ps=(monthCache[pt.title]&&monthCache[pt.title].stat)||null;
      if(ps&&ps.has){ prevRef=ps; prevTitle=`${MONTHS_FR[pt.m]} ${pt.y}`; } }
  }else if(dash.year==='all'){
    scope=aggStats(mlist); scopeTitle='Toutes les années';
  }else{
    scope=aggStats(mlist); scopeTitle=String(dash.year);
    /* Comparaison N-1 à période équivalente : on ne retient de l'année
       précédente que les mois qui ont des données cette année (sinon une
       année en cours paraîtrait faussement en baisse). */
    if(prevYTabs.length){
      const curMonths=mlist.filter(x=>x.stat.has).map(x=>x.m);
      const pa=aggStats(prevYTabs.filter(t=>curMonths.includes(t.m)).map(t=>({...t,stat:stats[t.title]})));
      if(pa.n){ prevRef=pa; prevTitle=String(dash.year-1);
        cmpNote=(curMonths.length<12)?`à période équivalente (${curMonths.length} mois)`:''; }
    }
  }
  if(dash.year==='all'){ /* comparaison : deux dernières années avec données, à période équivalente */
    const perY={}; mlist.forEach(x=>{ (perY[x.y]=perY[x.y]||[]).push(x); });
    const ys=Object.keys(perY).map(Number).sort((a,b)=>a-b).filter(yv=>aggStats(perY[yv]).n>0);
    if(ys.length>=2){
      const yCur=ys[ys.length-1], yPrev=ys[ys.length-2];
      const curMonths=perY[yCur].filter(x=>x.stat.has).map(x=>x.m);
      prevRef=aggStats(perY[yPrev].filter(x=>curMonths.includes(x.m))); prevTitle=String(yPrev);
      allCmp={cur:aggStats(perY[yCur]),title:String(yCur)};
      cmpNote=(curMonths.length<12)?`à période équivalente (${curMonths.length} mois)`:'';
    }
  }
  /* ---- KPI principaux ---- */
  const tx=scope.ent>0?scope.sol/scope.ent:0;
  kp.innerHTML='';
  kp.appendChild(kpi('Revenus',fmtEUR0(scope.ent),'green'));
  kp.appendChild(kpi('Dépenses',fmtEUR0(scope.sor),'red'));
  kp.appendChild(kpi('Épargne',fmtEUR0(scope.sol),scope.sol>=0?'green':'red'));
  kp.appendChild(kpi("Taux d'épargne",(tx*100).toFixed(1).replace('.',',')+' %','teal'));
  const link=$('#dash-open-month');
  if(isMonthScope){ link.style.display='block'; link.textContent=`Ouvrir ${scopeTitle} dans Mois ›`;
    link.onclick=()=>{ moisDate=new Date(dash.year,dash.month,1); switchTab('mois'); }; }
  else link.style.display='none';
  /* ---- KPI secondaires (moyennes, mois extrêmes) ---- */
  kp2.innerHTML='';
  if(!isMonthScope&&withData.length){
    const n=Math.max(1,scope.n);
    kp2.appendChild(kpi('Dépenses / mois',fmtEUR0(scope.sor/n)));
    kp2.appendChild(kpi('Revenus / mois',fmtEUR0(scope.ent/n)));
    const spenders=withData.filter(x=>x.stat.sor>0);
    if(spenders.length){
      const maxM=spenders.reduce((a,b)=>b.stat.sor>a.stat.sor?b:a);
      const noCur=spenders.filter(x=>x.y*12+x.m!==curKey);
      const minPool=noCur.length?noCur:spenders;
      const minM=minPool.reduce((a,b)=>b.stat.sor<a.stat.sor?b:a);
      const lbl=x=>MONTHS_SHORT[x.m]+(dash.year==='all'?' '+String(x.y).slice(2):'');
      kp2.appendChild(kpi('Mois le + dépensier',`${lbl(maxM)} · ${kfmt(maxM.stat.sor)}`,'red'));
      kp2.appendChild(kpi('Mois le - dépensier',`${lbl(minM)} · ${kfmt(minM.stat.sor)}`,'green'));
    }
  }
  /* ---- Comparaison ---- */
  const cc=$('#dash-compare-card');
  if(prevRef){
    cc.style.display='block';
    const curC=(dash.year==='all'&&allCmp)?allCmp.cur:scope;
    const curT=(dash.year==='all'&&allCmp)?allCmp.title:scopeTitle;
    $('#dash-compare-title').textContent=`🔁 ${curT} vs ${prevTitle}`;
    $('#dash-compare-note').textContent=cmpNote;
    $('#dash-compare-note').style.display=cmpNote?'block':'none';
    $('#dash-compare').innerHTML=
      cmpRow('Dépenses',curC.sor,prevRef.sor,false)+
      cmpRow('Revenus',curC.ent,prevRef.ent,true)+
      cmpRow('Épargne',curC.sol,prevRef.sol,true);
  } else cc.style.display='none';
  /* ---- Graphique ---- */
  let chartItems, chartSel=null;
  if(dash.year==='all'){
    const perY={}; mlist.forEach(x=>{ (perY[x.y]=perY[x.y]||[]).push(x); });
    chartItems=Object.keys(perY).map(Number).sort((a,b)=>a-b)
      .map(yv=>{ const a=aggStats(perY[yv]); return {label:String(yv),title:String(yv),ent:a.ent,sor:a.sor,sol:a.sol,year:yv}; });
    $('#dash-chart-title').textContent='📈 Année par année';
  }else{
    chartItems=mlist.map(x=>({label:MONTHS_AB[x.m],title:`${MONTHS_FR[x.m]} ${x.y}`,ent:x.stat.ent,sor:x.stat.sor,sol:x.stat.sol,y:x.y,m:x.m}));
    if(isMonthScope) chartSel=mlist.findIndex(x=>x.m===dash.month);
    $('#dash-chart-title').textContent=`📈 Mois par mois — ${dash.year}`;
  }
  const ch=$('#dash-chart'); ch.innerHTML=chartSVG(chartItems,chartSel);
  ch.querySelectorAll('[data-tap]').forEach(r=>{
    r.style.cursor='pointer';
    r.addEventListener('click',()=>{ const it=chartItems[+r.getAttribute('data-tap')]; if(!it) return;
      if(dash.year==='all'){ dash.year=it.year; dash.month=null; renderDashboard(); }
      else { moisDate=new Date(it.y,it.m,1); switchTab('mois'); } });
  });
  $('#dash-legend').innerHTML=
    `<span><i style="background:${CHART_GREEN}"></i>Revenus</span>`+
    `<span><i style="background:${CHART_RED}"></i>Dépenses</span>`+
    `<span><i style="background:${CHART_INK};height:3px;border-radius:2px;width:14px"></i>Solde</span>`;
  $('#dash-chart-hint').textContent=dash.year==='all'?'Touche une année pour la détailler.':'Touche un mois pour l\'ouvrir.';
  /* ---- Top dépenses ---- */
  const cats=Object.entries(scope.cats).map(([l,c])=>({l,amt:c.amt,sec:c.sec})).sort((a,b)=>b.amt-a.amt);
  const totS=scope.sor||1; const maxC=cats.length?cats[0].amt:1;
  const top=$('#dash-top'); top.innerHTML='';
  const shown=dash.topAll?cats:cats.slice(0,8);
  if(!cats.length) top.appendChild(el('p','muted','Aucune dépense sur cette période.'));
  shown.forEach((c,i)=>{
    const row=el('div','rank');
    row.appendChild(el('div','rn',String(i+1)));
    const mid=el('div','rmid');
    const l1=el('div','rl',c.l); mid.appendChild(l1);
    const bar=el('div','rbar'); const fill=el('i'); fill.style.width=Math.max(2,Math.round(c.amt/maxC*100))+'%'; bar.appendChild(fill); mid.appendChild(bar);
    row.appendChild(mid);
    const rr=el('div','rr');
    rr.appendChild(el('div','ra',fmtEUR0(c.amt)));
    const sub=el('div','rp',Math.round(c.amt/totS*100)+' %'); rr.appendChild(sub);
    if(prevRef&&dash.year!=='all'){
      const pv=prevRef.cats&&prevRef.cats[c.l]?prevRef.cats[c.l].amt:null;
      const b=evoBadge(c.amt,pv==null?null:pv,false);
      if(b){ const bd=el('div'); bd.innerHTML=b; bd.firstChild.style.marginTop='3px'; rr.appendChild(bd.firstChild); }
    }
    row.appendChild(rr);
    row.onclick=()=>{ if(isMonthScope) openCatSheet(c.l,tabTitleFor(dash.year,dash.month)); else openCatYear(c.l); };
    top.appendChild(row);
  });
  const more=$('#dash-top-more');
  more.style.display=cats.length>8?'block':'none';
  more.textContent=dash.topAll?'Réduire':`Tout afficher (${cats.length})`;
  /* ---- Répartition par pôle ---- */
  const brk=$('#dash-sections'); brk.innerHTML='';
  const secVals=Object.entries(scope.secT).map(([name,val])=>{
    const meta=SEC_META.find(([k])=>name.includes(k));
    return {name:name.replace(/^[^ ]+ /,''),val,color:meta?meta[1]:'#9AA5B1'};
  }).sort((a,b)=>b.val-a.val);
  const maxSec=Math.max(1,...secVals.map(x=>x.val)); const totSec=secVals.reduce((x,y)=>x+y.val,0)||1;
  if(!secVals.length) brk.appendChild(el('p','muted','Rien à afficher.'));
  secVals.forEach(x=>{ const row=el('div','brk');
    row.appendChild(el('div','bl',x.name));
    const bar=el('div','bar'); const i2=el('i'); i2.style.width=Math.round(x.val/maxSec*100)+'%'; i2.style.background=x.color; bar.appendChild(i2); row.appendChild(bar);
    row.appendChild(el('div','bv',Math.round(x.val/totSec*100)+'% · '+fmtEUR0(x.val))); brk.appendChild(row); });
}
/* Détail d'une catégorie sur l'année (ou toutes les années) : mois par mois */
function openCatYear(label){
  $('#cy-title').textContent=label;
  $('#cy-sub').textContent=dash.year==='all'?'Toutes les années':String(dash.year);
  const list=$('#cy-list'); list.innerHTML='';
  const dTabs=dashboardMonthTabs();
  const tabs=dash.year==='all'?dTabs:dTabs.filter(t=>t.y===dash.year);
  let tot=0, nb=0;
  tabs.forEach(t=>{ const c=monthCache[t.title]; if(!c||!c.stat) return;
    const cat=c.stat.cats[label]; if(!cat||!cat.amt) return;
    tot+=cat.amt; nb++;
    const row=el('div','ent-row tap');
    const lf=el('div'); lf.appendChild(el('div','el',`${MONTHS_FR[t.m]} ${t.y}`));
    row.appendChild(lf); row.appendChild(el('div','ea',fmtEUR(cat.amt)));
    row.onclick=()=>{ $('#catyear-modal').classList.remove('open'); openCatSheet(label,t.title); };
    list.appendChild(row); });
  if(!nb) list.appendChild(el('p','muted','Aucun montant sur cette période.'));
  $('#cy-total').textContent=fmtEUR(tot);
  $('#catyear-modal').classList.add('open');
}

/* ---------- Pointage ---------- */
async function renderReco(){
  const wrap=$('#reco'); wrap.innerHTML='<p class="muted">Chargement…</p>';
  let data; try{ data=await valuesGet(`'${JOURNAL}'!A2:H`,'UNFORMATTED_VALUE'); }catch(e){ wrap.innerHTML='<p class="muted">Aucun journal pour le moment.</p>'; return; }
  const rows=data.values||[]; const filter=$('#reco-filter').value; const items=[];
  rows.forEach((r,i)=>{ if(!r||r[3]==null)return; const done=r[7]===true||r[7]==='TRUE'||r[7]===1;
    if(filter==='todo'&&done)return; if(filter==='done'&&!done)return;
    items.push({sheetRow:i+2,dateISO:String(r[1]||''),cat:String(r[3]||''),amt:Number(r[4])||0,note:String(r[5]||''),cell:String(r[6]||''),done}); });
  items.reverse(); wrap.innerHTML='';
  if(!items.length){ wrap.appendChild(el('p','muted','Rien à afficher pour ce filtre.')); return; }
  items.forEach(it=>{ const isRev=CAT_INFO[it.cat]&&CAT_INFO[it.cat].col==='B';
    const row=el('div','hrow'+(it.done?' done':'')); const left=el('div','hleft');
    const chk=el('button','chk'+(it.done?' on':''),it.done?'✓':'');
    chk.onclick=async()=>{ chk.disabled=true; try{ await valuesUpdate(`'${JOURNAL}'!H${it.sheetRow}`,!it.done,'RAW'); renderReco(); }catch(e){ toast('Erreur: '+e.message,true); chk.disabled=false; } };
    left.appendChild(chk); const info=el('div');
    info.appendChild(el('div','hcat',it.cat)); info.appendChild(el('div','hmeta',`${frDate(it.dateISO)}${it.note?' · '+it.note:''}`));
    left.appendChild(info); row.appendChild(left);
    const right=el('div','hright');
    right.appendChild(el('div','hamt'+(isRev?' rev':''),fmtEUR(it.amt)));
    const del=el('button','del','🗑');
    del.onclick=async()=>{
      if(!it.cell){ toast('Saisie sans cellule (ancienne version)',true); return; }
      if(!confirm(`Supprimer cette saisie ?\n${it.cat} · ${fmtEUR(it.amt)} · ${frDate(it.dateISO)}\nLe montant sera retiré de la cellule du mois.`)) return;
      del.disabled=true;
      try{ await deleteEntry(it); toast('🗑 Saisie supprimée, montant retiré'); renderReco(); }
      catch(e){ toast('Erreur : '+e.message,true); del.disabled=false; }
    };
    right.appendChild(del); row.appendChild(right); wrap.appendChild(row); });
}
function renderQueueBadge(){ const n=queueGet().length; const b=$('#queue-badge'); if(n){b.style.display='inline'; b.textContent='('+n+')';} else b.style.display='none'; }

/* ---------- Toast ---------- */
let toastT=null;
function toast(msg,err){ const t=$('#toast'); t.textContent=msg;
  t.className='toast show'+(err?' err':''); clearTimeout(toastT); toastT=setTimeout(()=>{ t.className='toast'; },3800); }

/* ---------- Réglages ---------- */
function openSettings(){ $('#s-client').value=CFG.clientId; $('#s-sheet').value=CFG.sheetId; $('#settings').classList.add('open'); }
function saveSettings(){ CFG.clientId=$('#s-client').value; CFG.sheetId=$('#s-sheet').value; $('#settings').classList.remove('open'); location.reload(); }

/* ---------- Actualisation manuelle (bouton ↻ / « Actualiser ») ---------- */
async function fullRefresh(){
  invalidateCaches(); gridSections=null;
  try{ await loadMeta(true); await syncDetectedMonthsToIndexes(); }catch(e){ toast('Actualisation impossible : '+e.message,true); return; }
  updateSyncLine();
  const v=activeView();
  if(v==='saisie') renderCategories();
  else { switchTab(v); renderCategories(); }
  toast('✅ Données actualisées');
}

/* ---------- Démarrage ---------- */
function boot(){
  buildPad(); bioCheckSupport();
  $('#btn-connect').onclick=()=>{
    if(!CFG.clientId||!CFG.sheetId){ toast("Renseigne d'abord tes identifiants (Réglages).",true); openSettings(); return; }
    if(!(window.google&&google.accounts&&google.accounts.oauth2)){ toast('Google se charge, réessaie dans 2 s…',true); return; }
    if(!tokenClient) initAuth();
    requestToken().then(()=>onAuthed()).catch(e=>toast(e.message,true));
  };
  $('#btn-settings').onclick=openSettings; $('#btn-settings2').onclick=openSettings;
  $('#s-save').onclick=saveSettings; $('#s-cancel').onclick=()=>$('#settings').classList.remove('open');
  $('#s-pin').onclick=()=>{ $('#settings').classList.remove('open'); showLock('create',()=>{}); };
  $('#s-bio').onclick=async()=>{
    if(bioEnabled()){ if(confirm('Désactiver Face ID sur cet appareil ?')){ bioDisable(); toast('Face ID désactivé'); } return; }
    try{ await bioRegister(); toast('✅ Face ID activé'); }
    catch(e){ toast('Face ID : '+(e.message||'échec'),true); }
  };
  $('#s-logout').onclick=()=>{ if(confirm('Effacer les réglages et le code PIN de cet appareil ?')){ localStorage.clear(); location.reload(); } };
  $('#lock-forgot').onclick=()=>{ if(confirm('Code oublié : réinitialiser ? Efface les réglages locaux (tes données Google restent intactes).')){ localStorage.clear(); location.reload(); } };
  $('#m-cancel').onclick=closeEntry; $('#m-add').onclick=submitEntry;
  $('#m-showform').onclick=()=>{ $('#m-form').style.display='block'; $('#m-showform').style.display='none';
    setTimeout(()=>$('#m-amount').focus(),60); };
  $('#m-cancelform').onclick=()=>{ $('#m-form').style.display='none'; $('#m-showform').style.display=''; };
  $('#cy-close').onclick=()=>$('#catyear-modal').classList.remove('open');
  $('#dash-top-more').onclick=()=>{ dash.topAll=!dash.topAll; renderDashboard(); };
  $('#dash-refresh').onclick=()=>fullRefresh();
  $('#btn-newcat').onclick=openCatModal;
  $('#c-cancel').onclick=()=>$('#cat-modal').classList.remove('open');
  $('#c-add').onclick=submitCat;
  $('#btn-manage').onclick=openManage;
  $('#mg-close').onclick=()=>$('#manage-modal').classList.remove('open');
  $('#search').oninput=renderCategories;
  $('#btn-refresh').onclick=()=>fullRefresh();
  $('#nav-saisie').onclick=()=>switchTab('saisie'); $('#nav-mois').onclick=()=>switchTab('mois');
  $('#nav-resume').onclick=()=>switchTab('resume'); $('#nav-reco').onclick=()=>switchTab('reco');
  $('#m-prev').onclick=()=>moveMois(-1);
  $('#m-next').onclick=()=>moveMois(1);
  $('#reco-refresh').onclick=renderReco; $('#reco-filter').onchange=renderReco;
  /* Synchro : rafraîchissement auto au retour dans l'app + horloge discrète */
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&accessToken&&Date.now()-lastSync>5*60*1000){
      metaAt=0; gridSections=null;
      const v=activeView();
      if(v==='saisie') renderCategories(); else if(v==='mois') renderMois();
      else if(v==='resume') renderDashboard(); else if(v==='reco') renderReco();
    }
    updateSyncLine();
  });
  setInterval(updateSyncLine,30*1000);

  const hasCfg=CFG.clientId&&CFG.sheetId;
  const start=()=>{
    if(hasCfg&&restoreTok()){ onAuthed(); return; }        // session encore valide -> direct
    $('#screen-connect').style.display='block';
    if(hasCfg){                                            // tentative silencieuse (sans re-consentement)
      const wait=setInterval(()=>{ if(window.google&&google.accounts&&google.accounts.oauth2){
        clearInterval(wait); initAuth();
        requestToken().then(()=>onAuthed()).catch(()=>{ /* l'utilisateur tapera Se connecter */ });
      } },120);
      setTimeout(()=>clearInterval(wait),8000);
    }
  };
  if(pinHash()) showLock('verify',start); else start();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',boot);
