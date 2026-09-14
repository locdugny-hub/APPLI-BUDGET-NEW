/* Budget PWA v7.5.17
   - Multi-selection des mois dans le Dashboard
   - Compatible avec la multi-selection des annees
   - Mobile : reutilise le bottom sheet premium
   - Desktop : menu mois custom a cases a cocher
*/
'use strict';

(function installV7517(){
  if(window.__budgetV7517) return;
  window.__budgetV7517=true;

  if(!Array.isArray(dash.months)) dash.months=[];

  const oldSelected=v75SelectedTabs;
  v75SelectedTabs=function(){
    const months=Array.isArray(dash.months)?dash.months:[];
    return monthTabs
      .filter(t=>(dash.years||[]).includes(t.y))
      .filter(t=>v75StatusOk(t))
      .filter(t=>months.length===0 || months.includes(t.m))
      .sort((a,b)=>a.y-b.y||a.m-b.m);
  };

  function availableMonths(){
    const ys=new Set(dash.years||[]);
    return [...new Set((monthTabs||[]).filter(t=>ys.has(t.y)).map(t=>t.m))].sort((a,b)=>a-b);
  }
  function normalizeMonths(){
    const avail=availableMonths();
    dash.months=(Array.isArray(dash.months)?dash.months:[]).filter(m=>avail.includes(m)).sort((a,b)=>a-b);
    if(dash.months.length===1) dash.month=dash.months[0];
    else dash.month=null;
  }
  function monthLabel(){
    const ms=(dash.months||[]).slice().sort((a,b)=>a-b);
    if(!ms.length) return 'Tous les mois';
    if(ms.length===1) return MONTHS_FR[ms[0]];
    if(ms.length<=3) return ms.map(m=>MONTHS_SHORT[m]).join(' + ');
    const consecutive=ms.every((m,i)=>i===0||m===ms[i-1]+1);
    if(consecutive) return `${MONTHS_SHORT[ms[0]]} → ${MONTHS_SHORT[ms[ms.length-1]]}`;
    return `${ms.length} mois`;
  }
  function statusLabel(){ return dash.status==='forecast'?'Prévisionnel':dash.status==='all'?'Réalisé + prévisionnel':'Réalisé'; }
  function yearsLabel(){
    const ys=(dash.years||[]).slice().sort((a,b)=>a-b);
    if(!ys.length) return 'Année';
    if(ys.length===1) return String(ys[0]);
    if(ys.length===2) return `${ys[0]} + ${ys[1]}`;
    return `${ys[0]}…${ys[ys.length-1]}`;
  }

  function applyMonths(ms){
    dash.months=[...new Set(ms)].sort((a,b)=>a-b);
    normalizeMonths();
    renderDashboard();
  }

  function ensureDesktopMonthMenu(){
    const panel=document.getElementById('dash-dd-panel');
    if(!panel) return;
    const native=panel.querySelector('#dash-dd-month');
    if(native) native.style.display='none';
    const field=native&&native.closest('.dash-dd-field');
    if(!field) return;
    let btn=field.querySelector('#dash-dd-month-multi');
    let menu=field.querySelector('.dash-month-multi-menu');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button'; btn.id='dash-dd-month-multi'; btn.className='dash-dd-trigger';
      native.after(btn);
      menu=document.createElement('div'); menu.className='dash-dd-menu dash-month-multi-menu'; btn.after(menu);
      btn.onclick=e=>{ e.stopPropagation(); const opening=!field.classList.contains('open'); document.querySelectorAll('.dash-dd-field.open').forEach(x=>x.classList.remove('open')); field.classList.toggle('open',opening); };
      menu.onclick=e=>e.stopPropagation();
    }
    btn.textContent=monthLabel();
    menu.innerHTML='';
    const avail=availableMonths();
    const selected=dash.months||[];
    const all=document.createElement('button'); all.type='button'; all.className='dash-dd-year'+(!selected.length?' on':'');
    all.innerHTML='<span class="dash-dd-check"></span><span>Tous les mois</span>';
    all.onclick=()=>{ dash.months=[]; dash.month=null; field.classList.remove('open'); renderDashboard(); };
    menu.appendChild(all);
    avail.forEach(m=>{
      const row=document.createElement('button'); row.type='button'; row.className='dash-dd-year'+(selected.includes(m)?' on':'');
      row.innerHTML=`<span class="dash-dd-check"></span><span>${MONTHS_FR[m]}</span>`;
      row.onclick=()=>{
        const cur=(dash.months||[]).slice();
        const next=cur.includes(m)?cur.filter(x=>x!==m):[...cur,m];
        applyMonths(next);
      };
      menu.appendChild(row);
    });
  }

  function openMobileMonthMulti(){
    if(!window.matchMedia('(max-width:600px)').matches) return;
    let backdrop=document.getElementById('mob-filter-backdrop');
    let sheet=document.getElementById('mob-filter-sheet');
    if(!backdrop||!sheet) return;
    const title=sheet.querySelector('.mob-filter-title');
    const opts=sheet.querySelector('.mob-filter-options');
    const doneWrap=sheet.querySelector('.mob-filter-done-wrap');
    title.textContent='Choisir les mois'; opts.innerHTML=''; doneWrap.style.display='block';
    const selected=dash.months||[];
    const all=document.createElement('button'); all.type='button'; all.className='mob-filter-row'+(!selected.length?' on':'');
    all.innerHTML='<span class="mob-filter-check"></span><span>Tous les mois</span>';
    all.onclick=()=>{ dash.months=[]; dash.month=null; renderDashboard(); setTimeout(openMobileMonthMulti,80); };
    opts.appendChild(all);
    availableMonths().forEach(m=>{
      const row=document.createElement('button'); row.type='button'; row.className='mob-filter-row'+(selected.includes(m)?' on':'');
      row.innerHTML=`<span class="mob-filter-check"></span><span>${MONTHS_FR[m]}</span>`;
      row.onclick=()=>{
        const cur=(dash.months||[]).slice();
        dash.months=cur.includes(m)?cur.filter(x=>x!==m):[...cur,m].sort((a,b)=>a-b);
        normalizeMonths();
        row.classList.toggle('on',dash.months.includes(m));
        all.classList.toggle('on',dash.months.length===0);
        renderDashboard();
      };
      opts.appendChild(row);
    });
    backdrop.classList.add('open'); sheet.classList.add('open'); document.body.style.overflow='hidden';
  }

  function patchControls(){
    normalizeMonths();
    const panel=document.getElementById('dash-dd-panel');
    if(!panel) return;

    if(window.matchMedia('(max-width:600px)').matches){
      const b=panel.querySelector('.mob-filter-btn[data-filter="month"]');
      if(b){
        b.textContent=monthLabel();
        const clone=b.cloneNode(true); clone.textContent=monthLabel(); clone.onclick=openMobileMonthMulti; b.replaceWith(clone);
      }
    }else ensureDesktopMonthMenu();

    const sumMain=panel.querySelector('#dash-dd-summary-main');
    if(sumMain) sumMain.textContent=`${yearsLabel()} · ${monthLabel()} · ${statusLabel()}`;
    const sumSub=panel.querySelector('#dash-dd-summary-sub');
    if(sumSub){
      let count=0; try{count=v75SelectedTabs().length;}catch(_){ }
      sumSub.textContent=`${count} mois analysé${count>1?'s':''} · Tous les flux cash inclus`;
    }

    const title=document.getElementById('dash-chart-title');
    if(title && (dash.months||[]).length>1) title.textContent='📈 Évolution sur les mois sélectionnés';
  }

  const previous=renderDashboard;
  renderDashboard=async function(){
    normalizeMonths();
    await previous();
    requestAnimationFrame(()=>requestAnimationFrame(patchControls));
  };

  document.addEventListener('click',e=>{
    if(!e.target.closest('.dash-dd-field')) document.querySelectorAll('.dash-dd-field.open').forEach(x=>x.classList.remove('open'));
  });

  requestAnimationFrame(patchControls);
})();
