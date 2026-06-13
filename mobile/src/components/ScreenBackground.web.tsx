import { CSSProperties, useEffect } from 'react';

// Web background: render a real `position: fixed` full-viewport <div> carrying the
// exact web `html body` background. Unlike `background-attachment: fixed` (which
// react-native-web does not anchor to the viewport), a fixed div guarantees the
// glows sit at the same viewport height as the responsive web (orange 78%/12%).
const bgStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundColor: '#050b12',
  backgroundImage: [
    'linear-gradient(90deg, rgba(148,163,184,0.025) 1px, transparent 1px)',
    'linear-gradient(180deg, rgba(148,163,184,0.019) 1px, transparent 1px)',
    'radial-gradient(circle at 78% 12%, rgba(255,107,0,0.18), transparent 27rem)',
    'radial-gradient(circle at 16% 2%, rgba(65,110,155,0.16), transparent 24rem)',
    'linear-gradient(180deg, #050b12 0%, #07111d 46%, #050b12 100%)',
  ].join(','),
  backgroundSize: '92px 92px, 92px 92px, auto, auto, auto',
  backgroundRepeat: 'repeat, repeat, no-repeat, no-repeat, no-repeat',
};

export function ScreenBackground() {
  // Keep the react-native-web wrappers transparent so this fixed layer shows
  // through, and give the app content a stacking context above the bg.
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
      #root > div, #root > div > div, #root > div > div > div {
        background-color: transparent !important;
      }
    `;
  }, []);

  return <div aria-hidden="true" style={bgStyle} />;
}
