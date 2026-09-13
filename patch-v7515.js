/* Budget PWA v7.5.15
   Filtres Dashboard mobiles uniformes en bottom sheet.
   Evite les menus select natifs iOS et le menu Années trop étroit.
*/
'use strict';

(function installV7515(){
  if(window.__budgetV7515) return;
  window.__budgetV7515=true;

  const style=document.createElement('style');
  style.textContent=`
    .mob-filter-grid,.mob-filter-sheet{display:none}
    @media (max-width:600px){
      .dash-dd-panel .dash-dd-grid{display:none!important}
      .mob-filter-grid{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:8px}
      .mob-filter-field{min-width:0}
      .mob-filter-label{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin:0 0 6px 2px}
      .mob-filter-btn{width:100%;height:48px;border:1px solid #D9E2EE;border-radius:13px;background:#fff;color:var(--navy);font-size:13px;font-weight:800;padding:0 32px 0 12px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;box-shadow:0 1px 2px rgba(18,40,75,.03)}
      .mob-filter-btn::after{content:'';position:absolute;right:12px;top:50%;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #56708F;transform:translateY(-20%)}
      .mob-filter-backdrop{position:fixed;inset:0;background:rgba(7,21,42,.36);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:9998;display:none}
      .mob-filter-backdrop.open{display:block}
      .mob-filter-sheet{display:block;position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:9999;background:#fff;border:1px solid #D9E2EE;border-radius:22px;box-shadow:0 18px 60px rgba(9,29,57,.28);transform:translateY(calc(100% + 40px));opacity:0;pointer-events:none;transition:transform .22s ease,opacity .18s ease;max-height:min(72vh,620px);overflow:hidden}
      .mob-filter-sheet.open{transform:translateY(0);opacity:1;pointer-events:auto}
      .mob-filter-handle{width:42px;height:5px;border-radius:999px;background:#D6DFEA;margin:10px auto 3px}
      .mob-filter-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 11px;border-bottom:1px solid #E8EEF5}
      .mob-filter-title{font-size:18px;font-weight:850;color:var(--navy)}
      .mob-filter-close{width:38px;height:38px;border:0;border-radius:12px;background:#F1F5FA;color:var(--navy);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}
      .mob-filter-options{padding:7px 10px 10px;overflow:auto;-webkit-overflow-scrolling:touch;max-height:calc(min(72vh,620px) - 110px)}
      .mob-filter-row{width:100%;min-height:52px;border:0;border-bottom:1px solid #EDF1F6;background:#fff;color:var(--navy);display:flex;align-items:center;gap:12px;padding:8px 10px;font-size:16px;font-weight:700;text-align:left}
      .mob-filter-row:last-child{border-bottom:0}
      .mob-filter-row:active{background:#F5F8FC}
      .mob-filter-check{width:24px;height:24px;border-radius:8px;border:2px solid #C7D3E2;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;font-size:15px;font-weight:900}
      .mob-filter-row.on .mob-filter-check{background:var(--navy);border-color:var(--navy)}
      .mob-filter-row.on .mob-filter-check::after{content:'✓'}
      .mob-filter-radio{width:24px;height:24px;border-radius:50%;border:2px solid #C7D3E2;display:flex;align-items:center;justify-content:center;flex:none}
      .mob-filter-row.on .mob-filter-radio{border-color:#1971D4}
      .mob-filter-row.on .mob-filter-radio::after{content:'';width:12px;height:12px;border-radius:50%;background:#1971D4}
      .mob-filter-done-wrap{padding:9px 12px 12px;border-top:1px solid #E8EEF5;background:#fff}
      .mob-filter-done{width:100%;height:46px;border:0;border-radius:13px;background:var(--navy);color:#fff;font-size:15px;font-weight:800}
    }
    @media(max-width:390px){
      .mob-filter-grid{gap:6px;grid-template-columns:1fr 1.18fr 1fr}
      .mob-filter-btn{height:44px;font-size:12px;padding-left:9px;padding-right:28px}
      .mob-filter-label{font-size:9px}
    }
  `;
  document.head.appendChild(style);

  const isMobile=()=>window.matchMedia('(max-width:600px)').matches;
  const yearsAvailable=()=>[...new Set((monthTabs||[]).map(t=>t.y))].sort((a,b)=>a-b);
  const monthsAvailable=()=>{
    const ys=new Set(dash.years||[]);
    return [...new Set((monthTabs||[]).filter(t=>ys.has(t.y)).map(t=>t.m))].sort((a,b)=>a-b);
  };
  const yearLabel=()=>{
    const ys=(dash.years||[]).slice().sort((a,b)=>a-b);
    if(!ys.length) return 'Année';
    if(ys.length===1) return String(ys[0]);
    if(ys.length===2) return `${ys[0]} + ${ys[1]}`;
    return `${ys[0]}…${ys[ys.length-1]}`;
  };
  const monthLabel=()=>dash.month==null?'Tous les mois':MONTHS_FR[dash.month];
  const modeLabel=()=>dash.status==='forecast'?'Prévisionnel':dash.status==='all'?'Tout':'Réalisé';

  function ensureSheet(){
    let backdrop=document.getElementById('mob-filter-backdrop');
    let sheet=document.getElementById('mob-filter-sheet');
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id='mob-filter-backdrop';
      backdrop.className='mob-filter-backdrop';
      document.body.appendChild(backdrop);
    }
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='mob-filter-sheet';
      sheet.className='mob-filter-sheet';
      sheet.innerHTML=`<div class="mob-filter-handle"></div><div class="mob-filter-head"><div class="mob-filter-title"></div><button type="button" class="mob-filter-close" aria-label="Fermer">×</button></div><div class="mob-filter-options"></div><div class="mob-filter-done-wrap" style="display:none"><button type="button" class="mob-filter-done">Terminé</button></div>`;
      document.body.appendChild(sheet);
      sheet.querySelector('.mob-filter-close').onclick=closeSheet;
      sheet.querySelector('.mob-filter-done').onclick=closeSheet;
    }
    backdrop.onclick=closeSheet;
    return {backdrop,sheet};
  }

  function closeSheet(){
    const b=document.getElementById('mob-filter-backdrop');
    const s=document.getElementById('mob-filter-sheet');
    if(b) b.classList.remove('open');
    if(s) s.classList.remove('open');
    document.body.style.overflow='';
  }

  function openSheet(type){
    if(!isMobile()) return;
    const {backdrop,sheet}=ensureSheet();
    const title=sheet.querySelector('.mob-filter-title');
    const opts=sheet.querySelector('.mob-filter-options');
    const doneWrap=sheet.querySelector('.mob-filter-done-wrap');
    opts.innerHTML='';

    if(type==='years'){
      title.textContent='Choisir les années';
      doneWrap.style.display='block';
      const years=yearsAvailable();
      years.forEach(y=>{
        const row=document.createElement('button');
        row.type='button';
        row.className='mob-filter-row'+((dash.years||[]).includes(y)?' on':'');
        row.innerHTML=`<span class="mob-filter-check"></span><span>${y}</span>`;
        row.onclick=()=>{
          const cur=(dash.years||[]).slice();
          if(cur.includes(y)){
            if(cur.length===1) return;
            dash.years=cur.filter(v=>v!==y);
          }else dash.years=[...cur,y].sort((a,b)=>a-b);
          row.classList.toggle('on',(dash.years||[]).includes(y));
          if(dash.month!=null && !monthsAvailable().includes(dash.month)) dash.month=null;
          renderDashboard();
          requestAnimationFrame(updateMobileButtons);
        };
        opts.appendChild(row);
      });
      if(years.length>1){
        const all=document.createElement('button');
        all.type='button';
        const allOn=(dash.years||[]).length===years.length;
        all.className='mob-filter-row'+(allOn?' on':'');
        all.innerHTML='<span class="mob-filter-check"></span><span>Toutes les années</span>';
        all.onclick=()=>{
          dash.years=allOn?[years[years.length-1]]:years.slice();
          renderDashboard();
          closeSheet();
        };
        opts.appendChild(all);
      }
    }else if(type==='month'){
      title.textContent='Choisir le mois';
      doneWrap.style.display='none';
      const entries=[{v:null,l:'Tous les mois'},...monthsAvailable().map(m=>({v:m,l:MONTHS_FR[m]}))];
      entries.forEach(it=>{
        const on=(dash.month==null&&it.v==null)||dash.month===it.v;
        const row=document.createElement('button');
        row.type='button'; row.className='mob-filter-row'+(on?' on':'');
        row.innerHTML=`<span class="mob-filter-radio"></span><span>${it.l}</span>`;
        row.onclick=()=>{ dash.month=it.v; renderDashboard(); closeSheet(); };
        opts.appendChild(row);
      });
    }else{
      title.textContent='Choisir le mode';
      doneWrap.style.display='none';
      [{v:'realized',l:'Réalisé'},{v:'forecast',l:'Prévisionnel'},{v:'all',l:'Tout'}].forEach(it=>{
        const row=document.createElement('button');
        row.type='button'; row.className='mob-filter-row'+((dash.status||'realized')===it.v?' on':'');
        row.innerHTML=`<span class="mob-filter-radio"></span><span>${it.l}</span>`;
        row.onclick=()=>{ dash.status=it.v; renderDashboard(); closeSheet(); };
        opts.appendChild(row);
      });
    }

    backdrop.classList.add('open');
    sheet.classList.add('open');
    document.body.style.overflow='hidden';
  }

  function updateMobileButtons(){
    const panel=document.getElementById('dash-dd-panel');
    if(!panel) return;
    let grid=panel.querySelector('.mob-filter-grid');
    if(!grid){
      grid=document.createElement('div');
      grid.className='mob-filter-grid';
      grid.innerHTML=`
        <div class="mob-filter-field"><div class="mob-filter-label">Années</div><button type="button" class="mob-filter-btn" data-filter="years"></button></div>
        <div class="mob-filter-field"><div class="mob-filter-label">Mois</div><button type="button" class="mob-filter-btn" data-filter="month"></button></div>
        <div class="mob-filter-field"><div class="mob-filter-label">Mode</div><button type="button" class="mob-filter-btn" data-filter="mode"></button></div>`;
      const oldGrid=panel.querySelector('.dash-dd-grid');
      if(oldGrid) oldGrid.after(grid); else panel.prepend(grid);
      grid.querySelectorAll('.mob-filter-btn').forEach(b=>b.onclick=()=>openSheet(b.dataset.filter));
    }
    const y=grid.querySelector('[data-filter="years"]');
    const m=grid.querySelector('[data-filter="month"]');
    const s=grid.querySelector('[data-filter="mode"]');
    if(y) y.textContent=yearLabel();
    if(m) m.textContent=monthLabel();
    if(s) s.textContent=modeLabel();
  }

  const previous=renderDashboard;
  renderDashboard=async function(){
    await previous();
    requestAnimationFrame(updateMobileButtons);
  };

  window.addEventListener('resize',()=>{ if(!isMobile()) closeSheet(); updateMobileButtons(); });
  requestAnimationFrame(updateMobileButtons);
})();
