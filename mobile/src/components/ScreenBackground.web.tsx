import { useEffect } from 'react';

// Web background: a single fixed, full-viewport ::before layer carrying the EXACT
// web `html body` background (globals.css ~5780). Using position:fixed; inset:0
// guarantees the radial glows sit at the same viewport spot as the responsive web
// (orange 78%/12%, blue 16%/2%), regardless of document/scroll height.
export function ScreenBackground() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let styleEl = document.getElementById('lp-web-bg') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'lp-web-bg';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      html, body { background-color: #050b12 !important; }
      body::before {
        content: '' !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: -1 !important;
        pointer-events: none !important;
        background-color: #050b12 !important;
        background-image:
          linear-gradient(90deg, rgba(148,163,184,0.025) 1px, transparent 1px),
          linear-gradient(180deg, rgba(148,163,184,0.019) 1px, transparent 1px),
          radial-gradient(circle at 78% 12%, rgba(255,107,0,0.18), transparent 27rem),
          radial-gradient(circle at 16% 2%, rgba(65,110,155,0.16), transparent 24rem),
          linear-gradient(180deg, #050b12 0%, #07111d 46%, #050b12 100%) !important;
        background-size: 92px 92px, 92px 92px, auto, auto, auto !important;
        background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat !important;
      }
      /* Keep React Native Web wrapper containers transparent so the fixed
         background shows through the whole app (header + every screen). */
      #root, #root > div, #root > div > div, #root > div > div > div {
        background-color: transparent !important;
      }
    `;
  }, []);

  return null;
}
