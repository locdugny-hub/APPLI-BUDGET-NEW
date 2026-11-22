/* Budget PWA v7.5.53 — iOS 27 safe-area/viewport correction.
 * Visual only. Does not affect Sheets, authentication, or accounting data.
 * Loaded after all older styling patches, and directly for old service workers.
 */
'use strict';
(function installIOSViewportFix(){
  if(window.__budgetIOSViewport53)return;
  window.__budgetIOSViewport53=true;
  const style=document.createElement('style');
  style.id='budget-ios-viewport-53';
  style.textContent=`
    html{
      min-height:100%;
      background:#12284B;
      -webkit-text-size-adjust:100%;
    }
    body{
      margin:0;
      min-height:100vh;
      min-height:100dvh;
      padding-top:0!important;
      background:var(--bg,#F4F7FB);
      overflow-x:hidden;
    }
    #app{
      min-height:100vh;
      min-height:100dvh;
      background:var(--bg,#F4F7FB);
    }
    @media (max-width:600px){
      /* Draw the header under the status bar once, rather than reserving
         body padding AND header padding for the same iOS safe area. */
      #app > header{
        position:relative!important;
        top:auto!important;
        padding:calc(7px + env(safe-area-inset-top,0px)) 0 9px!important;
        background:linear-gradient(135deg,#12284B,#1C3A63)!important;
      }
      #app > header .h-top{
        min-height:54px!important;
      }
      /* The home-indicator is part of the navigation surface, not an
         extra margin below a floating footer. */
      #nav{
        position:fixed!important;
        left:0!important;
        right:0!important;
        bottom:0!important;
        width:100%;
        min-height:0!important;
        margin:0!important;
        padding:7px 4px calc(8px + env(safe-area-inset-bottom,0px))!important;
        background:#fff!important;
        transform:none!important;
        box-shadow:0 -1px 0 rgba(18,40,75,.09);
      }
      #nav button{
        min-height:55px!important;
        padding:5px 2px!important;
      }
      /* Ensure the last entry remains scrollable above the fixed nav. */
      .view{
        padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))!important;
      }
      /* Prevent a keyboard opening from changing the entire app's height. */
      .sheet-card{
        max-height:85dvh;
      }
    }

    /* iOS standalone after OS upgrade: paint the PIN screen's entire
       root canvas, including any area outside the fixed overlay. */
    html:has(#lock.open),
    body:has(#lock.open){
      background:#12284B!important;
      background-color:#12284B!important;
      min-height:100%!important;
      overflow:hidden!important;
    }
    html:has(#lock.open) #lock{
      position:fixed!important;
      top:0!important;
      left:0!important;
      right:0!important;
      bottom:-180px!important;
      height:auto!important;
      min-height:calc(100dvh + 180px)!important;
      padding-top:env(safe-area-inset-top,0px)!important;
      padding-bottom:calc(180px + env(safe-area-inset-bottom,0px))!important;
      background:linear-gradient(160deg,#12284B,#1C3A63)!important;
      background-color:#12284B!important;
      overscroll-behavior:none;
    }
    /* The same root paint should cover the transition to authentication. */
    html:has(#screen-connect:not([style*="display: none"])),
    body:has(#screen-connect:not([style*="display: none"])){
      background:#12284B;
    }
    @supports (height:100dvh){
      #app{min-height:100dvh;}
    }
  `;
  document.head.appendChild(style);
})();