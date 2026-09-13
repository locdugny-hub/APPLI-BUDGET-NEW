/* Budget PWA v7.5.8
   - Optimisation mobile prioritaire pour iPhone 12 Pro Max (428 px)
   - Graphique 12 mois sans scroll horizontal
   - Filtres, KPI, donut/top et navigation adaptés au tactile + safe areas iOS
*/
'use strict';

(function installV758(){
  if(window.__budgetV758) return;
  window.__budgetV758=true;

  const style=document.createElement('style');
  style.textContent=`
    /* iOS / PWA ergonomics */
    html{-webkit-text-size-adjust:100%;}
    body{overscroll-behavior-y:none;}
    button,select,input{-webkit-tap-highlight-color:transparent;}

    @media(max-width:460px){
      body{background:#F4F7FB;}
      header{padding-top:max(10px,env(safe-area-inset-top));}
      header .h-top{padding-left:14px;padding-right:14px;min-height:62px;}
      header h1{font-size:20px;line-height:1.05;}
      header .h-month{font-size:11px;margin-top:4px;}
      header .icon-btn{width:42px;height:42px;border-radius:13px;font-size:18px;}

      #view-resume{width:100%;padding-bottom:calc(86px + env(safe-area-inset-bottom));overflow-x:hidden;}

      /* Filtres : même logique que le visuel cible, sur une seule ligne */
      #view-resume .dash-dd-panel{margin:10px 10px 0;padding:10px;border-radius:16px;}
      #view-resume .dash-dd-grid{grid-template-columns:.9fr 1.15fr 1fr;gap:6px;}
      #view-resume .dash-dd-label{font-size:9px;margin:0 0 5px 2px;letter-spacing:.25px;}
      #view-resume .dash-dd-trigger,
      #view-resume .dash-dd-select{height:44px;min-height:44px;border-radius:12px;font-size:11.5px;padding-left:9px;padding-right:26px;}
      #view-resume .dash-dd-trigger::after{right:9px;font-size:15px;}
      #view-resume .dash-dd-menu{top:63px;max-height:270px;border-radius:13px;}
      #view-resume .dash-dd-year{min-height:44px;padding:9px;font-size:13px;}
      #view-resume .dash-dd-summary{margin-top:8px;padding:9px 10px;min-height:54px;border-radius:13px;gap:9px;}
      #view-resume .dash-dd-summary-ico{width:32px;height:32px;border-radius:9px;font-size:15px;}
      #view-resume .dash-dd-summary-main{font-size:12px;}
      #view-resume .dash-dd-summary-label,#view-resume .dash-dd-summary-sub{font-size:9.5px;}

      /* KPI : 2x2, gros chiffres, sans hauteur excessive */
      #view-resume #dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:9px 10px 0;}
      #view-resume #dash-kpis .kpi{min-height:116px;padding:11px 11px 10px;border-radius:16px;}
      #view-resume #dash-kpis .kpi::before{width:32px;height:32px;margin-bottom:7px;font-size:16px;}
      #view-resume #dash-kpis .k-l{font-size:9.5px;letter-spacing:.2px;}
      #view-resume #dash-kpis .k-v{font-size:22px;line-height:1.05;margin-top:7px;white-space:nowrap;}
      #view-resume #dash-kpis .kpi.teal{padding-right:72px;}
      #view-resume .save-ring{width:56px;height:56px;right:9px;top:30px;}
      #view-resume .save-ring::after{inset:7px;}
      #view-resume .save-ring span{font-size:11px;}

      /* Evolution : tous les mois visibles en une fois sur iPhone 12 Pro Max */
      #view-resume .dash-main-chart{margin:9px 10px 0!important;padding:12px 10px 10px!important;border-radius:16px;}
      #view-resume .dash-main-chart h3{font-size:14px;margin-bottom:3px;}
      #view-resume .dash-main-chart #dash-chart{min-height:198px;overflow:hidden!important;width:100%;}
      #view-resume .dash-main-chart #dash-chart svg{width:100%!important;min-width:0!important;height:auto!important;min-height:190px;max-height:220px;display:block;}
      #view-resume .dash-main-chart .legend{font-size:10px;gap:12px;margin-top:0;}
      #view-resume .dash-main-chart .chart-hint{display:none;}

      /* Bas du dashboard : deux cartes côte à côte sur 428 px */
      #view-resume .dash-bottom-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:9px 10px 0;align-items:stretch;}
      #view-resume .dash-bottom-grid>.card{padding:11px!important;border-radius:16px;min-width:0;}
      #view-resume #dash-premium-breakdown h3,
      #view-resume .dash-main-top h3{font-size:13px;margin-bottom:9px;white-space:nowrap;}

      #view-resume #dash-premium-breakdown .premium-breakdown-grid{display:block;}
      #view-resume #dash-premium-breakdown .premium-donut-wrap,
      #view-resume #dash-premium-breakdown .premium-donut{width:104px;height:104px;}
      #view-resume #dash-premium-breakdown .premium-donut-wrap{margin:0 auto 8px;}
      #view-resume #dash-premium-breakdown .premium-donut-hole{inset:20px;}
      #view-resume #dash-premium-breakdown .premium-donut-hole b{font-size:12px;}
      #view-resume #dash-premium-breakdown .premium-donut-hole span{font-size:8px;}
      #view-resume #dash-premium-breakdown .premium-legend{gap:4px;}
      #view-resume #dash-premium-breakdown .premium-leg-row{grid-template-columns:8px 1fr auto;gap:5px;font-size:9.5px;}
      #view-resume #dash-premium-breakdown .premium-leg-dot{width:7px;height:7px;}
      #view-resume #dash-premium-breakdown .premium-leg-val{font-size:9px;}

      #view-resume .dash-main-top .rank{padding:6px 0;grid-template-columns:22px 1fr auto;gap:6px;}
      #view-resume .dash-main-top .rn{width:22px;height:22px;border-radius:7px;font-size:10px;}
      #view-resume .dash-main-top .rl{font-size:10px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      #view-resume .dash-main-top .rr{min-width:54px;}
      #view-resume .dash-main-top .ra{font-size:10px;white-space:nowrap;}
      #view-resume .dash-main-top #dash-top-more,
      #view-resume .dash-detail-btn{margin-top:8px;padding:9px 6px;border-radius:10px;font-size:9.5px;min-height:38px;}

      /* Feuilles de détail */
      .dash-detail-card{max-height:90dvh;padding:16px 14px calc(18px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;}
      .dash-detail-close{width:44px;height:44px;border-radius:12px;}
      .detail-rank,.detail-cat{min-height:44px;}

      /* Navigation iOS */
      #nav{height:auto;min-height:70px;padding-bottom:max(7px,env(safe-area-inset-bottom));padding-top:6px;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
      #nav button{min-height:56px;font-size:11px;padding:4px 2px;touch-action:manipulation;}
      #nav .ni{font-size:23px;margin-bottom:2px;}

      /* Toutes les actions importantes doivent avoir une cible tactile >=44px */
      .linkbtn,.openm,.btn,.newcat,.reco-bar button,.mnav button{min-height:44px;}
    }

    /* Sur les iPhone plus étroits, on empile seulement les cartes du bas */
    @media(max-width:390px){
      #view-resume .dash-bottom-grid{grid-template-columns:1fr;}
      #view-resume #dash-premium-breakdown .premium-breakdown-grid{display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;}
      #view-resume #dash-premium-breakdown .premium-donut-wrap{margin:auto;}
      #view-resume #dash-kpis .k-v{font-size:20px;}
    }
  `;
  document.head.appendChild(style);

  // Sur iPhone, évite qu'un retour depuis une feuille de détail laisse le body bloqué.
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) document.body.style.overflow='';
  });
})();
