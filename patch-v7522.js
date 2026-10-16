/* Budget PWA v7.5.22
   - Bouton explicite de creation du mois suivant depuis l'ecran Mois
   - Utilise createMonthFromTemplate : duplication de Modele mois, recurrentes et index
*/
'use strict';

(function installV7522(){
  if(window.__budgetV7522) return;
  window.__budgetV7522=true;

  const style=document.createElement('style');
  style.textContent=`
    #btn-create-next-month{margin-top:8px;width:100%;border:1px solid #CFE0F4;background:#EEF6FF;color:#1F66AD;border-radius:12px;padding:12px 14px;font-weight:800;font-size:13px}
    #btn-create-next-month:disabled{opacity:.55}
  `;
  document.head.appendChild(style);

  function ensureButton(){
    let b=document.getElementById('btn-create-next-month');
    if(b) return b;
    const tools=document.querySelector('#view-mois .mtools');
    if(!tools) return null;
    b=document.createElement('button');
    b.id='btn-create-next-month';
    b.type='button';
    tools.appendChild(b);
    return b;
  }

  function nextOf(y,m){
    return m===11?{y:y+1,m:0}:{y,m:m+1};
  }

  function updateButton(){
    const b=ensureButton();
    if(!b) return;
    const i=moisIndex();
    if(i<0||!monthTabs.length||i!==monthTabs.length-1){
      b.style.display='none';
      return;
    }
    const cur=monthTabs[i], n=nextOf(cur.y,cur.m);
    b.style.display='block';
    b.textContent='＋ Creer '+MONTHS_FR[n.m]+' '+n.y;
    b.onclick=async()=>{
      b.disabled=true;
      const old=b.textContent;
      b.textContent='Creation...';
      try{
        const tab=await createMonthFromTemplate(n.y,n.m,true);
        await loadMeta(true);
        moisDate=new Date(n.y,n.m,1);
        gridSections=null;
        toast('✅ '+tab+' cree depuis le modele standard');
        await renderMois();
      }catch(e){
        if(!/annule/i.test(String(e&&e.message||''))) toast('Erreur : '+e.message,true);
      }finally{
        b.disabled=false;
        b.textContent=old;
        updateButton();
      }
    };
  }

  const prevRender=renderMois;
  renderMois=async function(){
    await prevRender();
    updateButton();
  };

  requestAnimationFrame(updateButton);
})();