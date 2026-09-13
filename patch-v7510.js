/* Budget PWA v7.5.10
   - Header mobile fortement compacte
   - Optimise pour iPhone 12 Pro Max / largeur <= 480px
*/
'use strict';

(function installV7510(){
  if(window.__budgetV7510) return;
  window.__budgetV7510=true;

  const style=document.createElement('style');
  style.textContent=`
    @media (max-width:480px){
      #app > header{
        padding:6px 0 7px!important;
        min-height:0!important;
      }
      #app > header .h-top{
        min-height:52px!important;
        padding:0 12px!important;
        align-items:center!important;
      }
      #app > header .h-top > div:first-child{
        min-width:0;
        flex:1;
      }
      #app > header h1{
        font-size:18px!important;
        line-height:1.05!important;
        margin:0 0 2px!important;
        white-space:nowrap;
      }
      #app > header .h-month{
        font-size:11.5px!important;
        line-height:1.1!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        max-width:245px;
      }
      #app > header .h-top > div:last-child{
        gap:6px!important;
        flex:none;
      }
      #app > header .icon-btn{
        width:38px!important;
        height:38px!important;
        min-width:38px!important;
        border-radius:12px!important;
        font-size:17px!important;
        padding:0!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
