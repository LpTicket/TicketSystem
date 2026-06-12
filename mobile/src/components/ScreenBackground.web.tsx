import { useEffect } from 'react';

// Web background: injects the EXACT web `html body` background (globals.css ~5780)
// behind the whole app — 92px grid squares + orange glow (right) + blue glow (left)
// + navy base. Injected once and left in place so navigation never flashes white.
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
      html, body, #root {
        background-color: #050b12 !important;
        background-image:
          linear-gradient(90deg, rgba(148,163,184,0.025) 1px, transparent 1px),
          linear-gradient(180deg, rgba(148,163,184,0.019) 1px, transparent 1px),
          radial-gradient(circle at 78% 12%, rgba(255,107,0,0.18), transparent 27rem),
          radial-gradient(circle at 16% 2%, rgba(65,110,155,0.16), transparent 24rem),
          linear-gradient(180deg, #050b12 0%, #07111d 46%, #050b12 100%) !important;
        background-size: 92px 92px, 92px 92px, auto, auto, auto !important;
        background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat !important;
        background-attachment: fixed !important;
        min-height: 100vh;
      }
      /* Make React Native Web's wrapper containers transparent so the body
         background (grid + glows) shows through the whole app, header included. */
      #root, #root > div, #root > div > div, #root > div > div > div {
        background-color: transparent !important;
      }
    `;
  }, []);

  return null;
}
