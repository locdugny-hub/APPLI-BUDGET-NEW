/* Budget PWA v7.5.9
   - Ajustements visuels iPhone 12 Pro Max
   - Header plus compact
   - Lisibilite mobile renforcee
*/
'use strict';

(function installV759(){
  if(window.__budgetV759) return;
  window.__budgetV759=true;

  const style=document.createElement('style');
  style.textContent=`
    @media (max-width: 480px){
      /* Header plus compact, tout en respectant la safe area iOS */
      #app > header{
        padding-top:calc(10px + env(safe-area-inset-top));
        padding-bottom:10px;
        min-height:auto;
      }
      #app > header .h-top{
        min-height:72px;
        padding:0 14px;
        align-items:center;
      }
      #app > header h1{
        font-size:22px;
        line-height:1.05;
        margin:0 0 4px;
      }
      #app > header .h-month{
        font-size:13px;
        line-height:1.15;
      }
      #app > header .icon-btn{
        width:46px;
        height:46px;
        border-radius:14px;
        font-size:20px;
      }

      /* Dashboard légèrement plus grand et plus lisible */
      #view-resume{font-size:15px;}
      #view-resume .dash-dd-panel{
        margin:10px 10px 0;
        padding:11px;
        border-radius:17px;
      }
      #view-resume .dash-dd-label{font-size:10px;}
      #view-resume .dash-dd-trigger,
      #view-resume .dash-dd-select{
        height:45px;
        font-size:13px;
      }
      #view-resume .dash-dd-summary{
        padding:12px;
      }
      #view-resume .dash-dd-summary-main{font-size:14px;}
      #view-resume .dash-dd-summary-sub{font-size:11px;}

      #view-resume #dash-kpis{
        gap:10px;
        padding:10px 10px 0;
      }
      #view-resume #dash-kpis .kpi{
        min-height:132px;
        padding:14px;
        border-radius:17px;
      }
      #view-resume #dash-kpis .k-l{font-size:11px;}
      #view-resume #dash-kpis .k-v{
        font-size:24px;
        line-height:1.05;
      }

      /* Graphique un peu plus grand sans prendre trop de hauteur */
      #view-resume .dash-main-chart{
        margin:10px 10px 0!important;
        padding:15px!important;
        border-radius:18px!important;
      }
      #view-resume .dash-main-chart h3{
        font-size:18px!important;
        margin-bottom:10px!important;
      }
      #view-resume .dash-main-chart #dash-chart{
        min-height:265px;
      }
      #view-resume .dash-main-chart #dash-chart svg{
        min-height:250px!important;
      }
      #view-resume .legend{
        font-size:13px!important;
        gap:16px!important;
      }

      /* Cartes finales plus lisibles */
      .dash-bottom-grid{
        margin:10px 10px 0!important;
        gap:10px!important;
      }
      .dash-bottom-grid > .card{
        padding:16px!important;
        border-radius:18px!important;
      }
      #dash-premium-breakdown h3,
      .dash-main-top h3{
        font-size:18px!important;
        margin-bottom:14px!important;
      }
      #dash-premium-breakdown .premium-breakdown-grid{
        grid-template-columns:146px 1fr!important;
        gap:14px!important;
      }
      #dash-premium-breakdown .premium-donut-wrap,
      #dash-premium-breakdown .premium-donut{
        width:146px!important;
        height:146px!important;
      }
      #dash-premium-breakdown .premium-donut-hole{
        inset:28px!important;
      }
      #dash-premium-breakdown .premium-donut-hole b{
        font-size:18px!important;
      }
      #dash-premium-breakdown .premium-leg-row{
        font-size:13px!important;
        gap:8px!important;
      }
      .dash-main-top .rank{
        padding:11px 0!important;
      }
      .dash-main-top .ra,
      .dash-main-top .rr{
        font-size:14px!important;
      }
      .dash-detail-btn,
      .dash-main-top #dash-top-more{
        min-height:48px;
        font-size:14px!important;
      }

      /* Footer mobile légèrement plus compact mais toujours confortable */
      #nav{
        min-height:76px;
        padding-top:8px;
        padding-bottom:calc(8px + env(safe-area-inset-bottom));
      }
      #nav button{
        font-size:12px;
        min-height:58px;
      }
      #nav .ni{
        font-size:25px;
        margin-bottom:4px;
      }
    }
  `;
  document.head.appendChild(style);
})();
