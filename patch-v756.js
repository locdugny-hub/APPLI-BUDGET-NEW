/* Budget PWA v7.5.6
   - Filtres Dashboard premium en listes déroulantes
   - Années : multi-sélection conservée
   - Mois / Mode : listes déroulantes natives, adaptées au mobile
*/
'use strict';

(function installV756(){
  if(window.__budgetV756) return;
  window.__budgetV756=true;

  const style=document.createElement('style');
  style.textContent=`
    #view-resume #dash-filter-panel{display:none!important}
    .dash-dd-panel{margin:12px 12px 0;background:#fff;border:1px solid var(--line);border-radius:18px;padding:12px;box-shadow:0 2px 10px rgba(18,40,75,.05);position:relative;z-index:4}
    .dash-dd-grid{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:8px}
    .dash-dd-field{min-width:0;position:relative}
    .dash-dd-label{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin:0 0 6px 2px}
    .dash-dd-trigger,.dash-dd-select{width:100%;height:46px;border:1px solid #D9E2EE;border-radius:13px;background:#fff;color:var(--navy);font-size:13px;font-weight:800;padding:0 34px 0 12px;outline:none;box-shadow:0 1px 2px rgba(18,40,75,.03)}
    .dash-dd-trigger{text-align:left;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dash-dd-trigger::after{content:'⌄';position:absolute;right:12px;top:50%;transform:translateY(-55%);font-size:17px;color:#56708F}
    .dash-dd-select{appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,#56708F 50%),linear-gradient(135deg,#56708F 50%,transparent 50%);background-position:calc(100% - 17px) 19px,calc(100% - 12px) 19px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
    .dash-dd-trigger:focus,.dash-dd-select:focus{border-color:#7FA8D8;box-shadow:0 0 0 3px rgba(46,111,183,.10)}
    .dash-dd-menu{position:absolute;left:0;right:0;top:68px;background:#fff;border:1px solid #D9E2EE;border-radius:14px;box-shadow:0 12px 28px rgba(18,40,75,.18);padding:6px;display:none;max-height:260px;overflow:auto;z-index:20}
    .dash-dd-field.open .dash-dd-menu{display:block}
    .dash-dd-year{display:flex;align-items:center;gap:10px;width:100%;padding:10px 9px;border:0;background:#fff;border-radius:10px;text-align:left;color:var(--navy);font-size:13px;font-weight:700}
    .dash-dd-year:active{background:#F2F6FB}
    .dash-dd-check{width:20px;height:20px;border-radius:6px;border:1.5px solid #C5D1E0;display:flex;align-items:center;justify-content:center;color:#fff;background:#fff;font-size:12px;flex:none}
    .dash-dd-year.on .dash-dd-check{background:var(--navy);border-color:var(--navy)}
    .dash-dd-year.on .dash-dd-check::after{content:'✓'}
    .dash-dd-all{border-top:1px solid var(--line);margin-top:4px;padding-top:7px}
    .dash-dd-summary{margin-top:10px;padding:11px 12px;border-radius:14px;background:linear-gradient(135deg,#EEF5FF,#F7FAFE);display:flex;align-items:center;gap:10px}
    .dash-dd-summary-ico{width:34px;height:34px;border-radius:10px;background:#DCEBFF;color:#1971D4;display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}
    .dash-dd-summary-txt{min-width:0;line-height:1.25}
    .dash-dd-summary-label{font-size:10px;color:var(--muted);margin-bottom:2px}
    .dash-dd-summary-main{font-size:13px;font-weight:800;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dash-dd-summary-sub{font-size:10px;color:var(--muted);margin-top:2px}
    @media(max-width:390px){
      .dash-dd-panel{margin-left:10px;margin-right:10px;padding:10px}
      .dash-dd-grid{gap:6px;grid-template-columns:1fr 1.18fr 1fr}
      .dash-dd-trigger,.dash-dd-select{height:43px;font-size:12px;padding-left:9px;padding-right:28px}
      .dash-dd-label{font-size:9px}
    }
  `;
  document.head.appendChild(style);

  function selectedYearsLabel(){
    const ys=(dash.years||[]).slice().sort((a,b)=>a-b);
    if(!ys.length) return 'Année';
    if(ys.length===1) return String(ys[0]);
    if(ys.length===2) return `${ys[0]} + ${ys[1]}`;
    return `${ys[0]} + ${ys[1]} + ${ys[2]}` + (ys.length>3?` +${ys.length-3}`:'');
  }

  function availableYears(){
    return [...new Set((monthTabs||[]).map(t=>t.y))].sort((a,b)=>a-b);
  }

  function availableMonths(){
    const ys=new Set(dash.years||[]);
    return [...new Set((monthTabs||[]).filter(t=>ys.has(t.y)).map(t=>t.m))].sort((a,b)=>a-b);
  }

  function closeMenus(except){
    document.querySelectorAll('.dash-dd-field.open').forEach(x=>{ if(x!==except) x.classList.remove('open'); });
  }

  function makeYearMenu(field,trigger){
    const menu=field.querySelector('.dash-dd-menu');
    menu.innerHTML='';
    const years=availableYears();
    years.forEach(y=>{
      const on=(dash.years||[]).includes(y);
      const b=document.createElement('button');
      b.type='button'; b.className='dash-dd-year'+(on?' on':'');
      b.innerHTML=`<span class="dash-dd-check"></span><span>${y}</span>`;
      b.onclick=e=>{
        e.stopPropagation();
        const current=(dash.years||[]).slice();
        if(current.includes(y)){
          if(current.length===1) return;
          dash.years=current.filter(v=>v!==y);
        }else{
          dash.years=[...current,y].sort((a,b)=>a-b);
        }
        renderDashboard();
      };
      menu.appendChild(b);
    });
    if(years.length>1){
      const all=document.createElement('button');
      all.type='button';
      const allOn=(dash.years||[]).length===years.length;
      all.className='dash-dd-year dash-dd-all'+(allOn?' on':'');
      all.innerHTML='<span class="dash-dd-check"></span><span>Toutes les années</span>';
      all.onclick=e=>{
        e.stopPropagation();
        dash.years=allOn?[years[years.length-1]]:years.slice();
        renderDashboard();
      };
      menu.appendChild(all);
    }
    trigger.textContent=selectedYearsLabel();
  }

  function buildDropdownPanel(){
    const view=document.getElementById('view-resume');
    const kpis=document.getElementById('dash-kpis');
    if(!view||!kpis) return;

    let panel=document.getElementById('dash-dd-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='dash-dd-panel'; panel.className='dash-dd-panel';
      panel.innerHTML=`
        <div class="dash-dd-grid">
          <div class="dash-dd-field" id="dash-dd-years-field">
            <div class="dash-dd-label">Années</div>
            <button type="button" class="dash-dd-trigger" id="dash-dd-years"></button>
            <div class="dash-dd-menu"></div>
          </div>
          <div class="dash-dd-field">
            <div class="dash-dd-label">Mois</div>
            <select class="dash-dd-select" id="dash-dd-month"></select>
          </div>
          <div class="dash-dd-field">
            <div class="dash-dd-label">Mode</div>
            <select class="dash-dd-select" id="dash-dd-status">
              <option value="realized">Réalisé</option>
              <option value="forecast">Prévisionnel</option>
              <option value="all">Tout</option>
            </select>
          </div>
        </div>
        <div class="dash-dd-summary">
          <div class="dash-dd-summary-ico">▣</div>
          <div class="dash-dd-summary-txt">
            <div class="dash-dd-summary-label">Période sélectionnée</div>
            <div class="dash-dd-summary-main" id="dash-dd-summary-main"></div>
            <div class="dash-dd-summary-sub" id="dash-dd-summary-sub"></div>
          </div>
        </div>`;
      kpis.before(panel);

      const yf=panel.querySelector('#dash-dd-years-field');
      const yt=panel.querySelector('#dash-dd-years');
      yt.onclick=e=>{
        e.stopPropagation();
        const opening=!yf.classList.contains('open');
        closeMenus(yf);
        yf.classList.toggle('open',opening);
      };
      panel.querySelector('.dash-dd-menu').onclick=e=>e.stopPropagation();

      const ms=panel.querySelector('#dash-dd-month');
      ms.onchange=()=>{
        dash.month=ms.value===''?null:Number(ms.value);
        renderDashboard();
      };
      const ss=panel.querySelector('#dash-dd-status');
      ss.onchange=()=>{
        dash.status=ss.value;
        renderDashboard();
      };
    }

    const yf=panel.querySelector('#dash-dd-years-field');
    const yt=panel.querySelector('#dash-dd-years');
    makeYearMenu(yf,yt);

    const ms=panel.querySelector('#dash-dd-month');
    const months=availableMonths();
    const current=dash.month==null?'':String(dash.month);
    ms.innerHTML='<option value="">Tous les mois</option>'+months.map(m=>`<option value="${m}">${MONTHS_FR[m]}</option>`).join('');
    if(current!==''&&months.includes(Number(current))) ms.value=current; else ms.value='';

    const ss=panel.querySelector('#dash-dd-status');
    ss.value=dash.status||'realized';

    const st=dash.status==='forecast'?'Prévisionnel':dash.status==='all'?'Réalisé + prévisionnel':'Réalisé';
    const mt=dash.month==null?'Tous les mois':MONTHS_FR[dash.month];
    const summary=`${selectedYearsLabel()} · ${mt} · ${st}`;
    panel.querySelector('#dash-dd-summary-main').textContent=summary;
    let count=0;
    try{ count=v75SelectedTabs().length; }catch(_){ }
    panel.querySelector('#dash-dd-summary-sub').textContent=`${count} mois analysé${count>1?'s':''} · Tous les flux cash inclus`;

    // Hide the former chip based controls and scope text. They remain in DOM for compatibility.
    const old=document.getElementById('dash-filter-panel'); if(old) old.style.display='none';
  }

  if(!window.__budgetV756DocClose){
    window.__budgetV756DocClose=true;
    document.addEventListener('click',()=>closeMenus(null));
  }

  const prev=renderDashboard;
  renderDashboard=async function(){
    await prev();
    requestAnimationFrame(buildDropdownPanel);
  };
})();
