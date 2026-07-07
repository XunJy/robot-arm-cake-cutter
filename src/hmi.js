import * as THREE from 'three';

/**
 * Draws a Mitsubishi GOT2000-style HMI screen into a CanvasTexture:
 * product parameter list, green "running man" icon, red Stop button,
 * yellow "Running" status bar.
 */
export function makeHMITexture() {
  const W = 512, H = 376;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  // screen background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d2136');
  bg.addColorStop(1, '#0a1828');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // header bar
  g.fillStyle = '#123a5e';
  g.fillRect(0, 0, W, 44);
  g.fillStyle = '#cfe6ff';
  g.font = 'bold 21px Arial';
  g.textBaseline = 'middle';
  g.fillText('ULTRASONIC CAKE CUTTER', 16, 23);
  g.fillStyle = '#7fd18a';
  g.font = '15px Arial';
  g.textAlign = 'right';
  g.fillText('AUTO', W - 14, 23);
  g.textAlign = 'left';

  // ---- left: product parameter list ----
  const rows = [
    ['Product Height', '90 mm'],
    ['Product Length', '600 mm'],
    ['Product Width', '500 mm'],
    ['Total Pieces', '12'],
    ['Cut Size', '150 × 170 mm'],
  ];
  const x0 = 16, y0 = 66, rowH = 40, colW = 300;
  g.font = '16px Arial';
  rows.forEach((r, i) => {
    const y = y0 + i * rowH;
    g.fillStyle = i % 2 ? '#10283f' : '#0f2439';
    g.fillRect(x0, y, colW, rowH - 6);
    g.fillStyle = '#9db8d2';
    g.fillText(r[0], x0 + 10, y + (rowH - 6) / 2);
    g.fillStyle = '#ffffff';
    g.font = 'bold 16px Arial';
    g.textAlign = 'right';
    g.fillText(r[1], x0 + colW - 10, y + (rowH - 6) / 2);
    g.textAlign = 'left';
    g.font = '16px Arial';
  });

  // ---- right: running man icon (green) ----
  const cx = 400, cy = 108, R = 44;
  g.fillStyle = '#123a24';
  g.strokeStyle = '#35c554';
  g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.stroke();
  // stick figure runner
  g.strokeStyle = '#4de06c';
  g.fillStyle = '#4de06c';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath(); g.arc(cx + 8, cy - 22, 7, 0, Math.PI * 2); g.fill(); // head
  g.beginPath();
  g.moveTo(cx + 4, cy - 12); g.lineTo(cx - 4, cy + 4);            // torso
  g.moveTo(cx + 4, cy - 10); g.lineTo(cx + 20, cy - 2);           // front arm
  g.moveTo(cx + 4, cy - 10); g.lineTo(cx - 12, cy - 16);          // back arm
  g.moveTo(cx - 4, cy + 4); g.lineTo(cx + 12, cy + 14); g.lineTo(cx + 12, cy + 28); // front leg
  g.moveTo(cx - 4, cy + 4); g.lineTo(cx - 14, cy + 16); g.lineTo(cx - 24, cy + 12); // back leg
  g.stroke();

  // ---- right: red round STOP button ----
  const sy = 218;
  const grad = g.createRadialGradient(cx - 8, sy - 8, 6, cx, sy, 42);
  grad.addColorStop(0, '#ff5a52');
  grad.addColorStop(1, '#b7150f');
  g.fillStyle = '#3a0f0d';
  g.beginPath(); g.arc(cx, sy, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = grad;
  g.beginPath(); g.arc(cx, sy, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.font = 'bold 17px Arial';
  g.textAlign = 'center';
  g.fillText('STOP', cx, sy + 1);
  g.textAlign = 'left';

  // ---- bottom: yellow Running status bar ----
  g.fillStyle = '#f5c518';
  g.fillRect(0, H - 46, W, 46);
  g.fillStyle = '#1a1a1a';
  g.font = 'bold 20px Arial';
  g.fillText('● Running', 16, H - 23);
  g.font = '15px Arial';
  g.textAlign = 'right';
  g.fillText('20 kHz  |  2500 W  |  Belt 1000 mm', W - 14, H - 23);
  g.textAlign = 'left';

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Small canvas-based text label plate (e.g. EMERGENCY STOP / RESET tags). */
export function makeTextPlateTexture(lines, { bg = '#ffffff', fg = '#c11212', border = '#c11212', fontPx = 34 } = {}) {
  const W = 256, H = 96;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = border;
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.fillStyle = fg;
  g.font = `bold ${fontPx}px Arial`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lh = fontPx + 6;
  const startY = H / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => g.fillText(ln, W / 2, startY + i * lh));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Yellow e-stop base disc with printed EMERGENCY STOP ring text. */
export function makeEStopBaseTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6c90e';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#c11212';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 30px Arial';
  g.fillText('EMERGENCY', S / 2, 26);
  g.fillText('STOP', S / 2, S - 26);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Yellow triangle warning sticker texture. */
export function makeWarnStickerTexture(symbol = '⚡') {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6c90e';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#111';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(S / 2, 14); g.lineTo(S - 12, S - 16); g.lineTo(12, S - 16); g.closePath();
  g.stroke();
  g.fillStyle = '#111';
  g.font = 'bold 52px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, S / 2, S * 0.62);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Moving belt surface texture (subtle transverse seams on blue). */
export function makeBeltTexture() {
  const W = 256, H = 64;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#1d55c2';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a4cae';
  for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 3, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
