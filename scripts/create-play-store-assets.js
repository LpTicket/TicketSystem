const fs = require('fs');
const path = require('path');
const sharp = require('../backend/node_modules/sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'mobile', 'assets');
const outDir = path.join(root, 'play-store-assets');

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  await sharp(path.join(assetsDir, 'icon.png'))
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'lp-ticket-play-icon-512.png'));

  const logo = await sharp(path.join(assetsDir, 'logo-header.png'))
    .resize({ width: 420, withoutEnlargement: true })
    .png()
    .toBuffer();

  const banner = await sharp(path.join(assetsDir, 'home-banner.webp'))
    .resize(440, 440, { fit: 'cover' })
    .modulate({ brightness: 0.72, saturation: 1.08 })
    .png()
    .toBuffer();

  const base = Buffer.from(`
    <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#06111f"/>
          <stop offset="0.58" stop-color="#0a243b"/>
          <stop offset="1" stop-color="#ff6b00"/>
        </linearGradient>
        <radialGradient id="glow" cx="78%" cy="30%" r="65%">
          <stop offset="0" stop-color="#ff7a18" stop-opacity="0.46"/>
          <stop offset="1" stop-color="#ff7a18" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bg)"/>
      <rect width="1024" height="500" fill="url(#glow)"/>
      <g opacity="0.18" stroke="#ffffff" stroke-width="1">
        <path d="M0 80 H1024 M0 160 H1024 M0 240 H1024 M0 320 H1024 M0 400 H1024 M128 0 V500 M256 0 V500 M384 0 V500 M512 0 V500 M640 0 V500 M768 0 V500 M896 0 V500"/>
      </g>
      <rect x="46" y="44" width="932" height="412" rx="34" fill="rgba(2,8,16,0.56)" stroke="rgba(255,255,255,0.16)"/>
      <text x="72" y="232" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900">Tus eventos.</text>
      <text x="72" y="294" fill="#ff7a18" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900">Tus tickets.</text>
      <text x="72" y="346" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700">Compra, gestiona y valida entradas digitales.</text>
      <rect x="72" y="376" width="264" height="48" rx="24" fill="#ff6b00"/>
      <text x="105" y="408" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900">LP Ticket</text>
    </svg>
  `);

  const phoneFrame = Buffer.from(`
    <svg width="458" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect x="24" y="54" width="410" height="392" rx="36" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <rect x="52" y="86" width="354" height="328" rx="26" fill="rgba(0,0,0,0.34)"/>
    </svg>
  `);

  await sharp(base)
    .composite([
      { input: banner, left: 558, top: 30 },
      { input: phoneFrame, left: 520, top: 0 },
      { input: logo, left: 70, top: 82 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'lp-ticket-feature-graphic-1024x500.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
