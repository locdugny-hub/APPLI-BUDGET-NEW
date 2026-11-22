/* Budget PWA — layout iOS standalone normalisé.
 * Contrôle des surfaces par iOS : aucune sur-extension, aucun calcul
 * reposant sur screen.height, aucun déplacement artificiel du lock.
 *
 * La régression WebKit avec black-translucent est traitée dans les
 * métadonnées HTML : apple-mobile-web-app-status-bar-style=black.
 */
'use strict';
(function installIOSViewportLayout(){
  if(window.__budgetIOSViewportLayout55)return;
  window.__budgetIOSViewportLayout55=true;
  const style=document.createElement('style');
  style.id='budget-ios-layout-normalized';
  style.textContent=`
    html {
      min-height:100%;
      background:#12284B;
      -webkit-text-size-adjust:100%;
    }
    body {
      margin:0;
      padding-top:0!important;
      min-height:100%;
      background:var(--bg,#F4F7FB);
      overflow-x:hidden;
    }
    #app {
      min-height:100vh;
      min-height:100dvh;
      background:var(--bg,#F4F7FB);
    }
    /* iOS 27.2.1 reports 41 CSS px of real upper safe area when installed.
       Its viewport already spans the full screen, so reserve the inset
       once *inside the header*, not via body padding or fake overhangs. */
    /* An opaque iOS status bar owns the top inset; the app must not
       reserve that area a second time. The header stays in flow. */
    @media (max-width:600px){
      #app > header {
        position:relative!important;
        top:auto!important;
        padding:calc(7px + env(safe-area-inset-top,0px)) 0 9px!important;
        min-height:0!important;
      }
      #app > header .h-top {
        min-height:54px!important;
      }
      #nav {
        position:fixed!important;
        inset:auto 0 0 0!important;
        width:100%;
        margin:0!important;
        transform:none!important;
        padding:7px 4px calc(8px + env(safe-area-inset-bottom,0px))!important;
        background:#fff;
      }
      #nav button {
        min-height:55px!important;
      }
      .view {
        padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;
      }
      .sheet-card { max-height:85dvh; }
    }
    /* Lock screen covers exactly the viewport owned by the browser.
       No overscan or fabricated lower inset. */
    #lock {
      inset:0!important;
      height:auto!important;
      min-height:0!important;
      background:linear-gradient(160deg,#12284B,#1C3A63);
    }
    @media (display-mode:standalone){
      #lock{
        padding-top:calc(24px + env(safe-area-inset-top,0px))!important;
        padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))!important;
      }
    }
    html:has(#lock.open),
    body:has(#lock.open){
      background:#12284B!important;
      overscroll-behavior:none;
    }
  `;
  document.head.appendChild(style);
})();