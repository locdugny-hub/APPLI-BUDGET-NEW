/* Budget PWA v7.5.11
   - Corrige le header sticky sous la status bar iOS
   - Le header reste toujours sous la safe area, meme pendant le scroll
*/
'use strict';

(function installV7511(){
  if(window.__budgetV7511) return;
  window.__budgetV7511=true;

  const style=document.createElement('style');
  style.textContent=`
    @media (max-width: 480px){
      /* Le body reserve la zone iOS et le header sticky ne doit jamais la recouvrir */
      body{padding-top:env(safe-area-inset-top)!important;}
      #app > header{
        top:env(safe-area-inset-top)!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
