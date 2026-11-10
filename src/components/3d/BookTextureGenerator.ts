import * as THREE from 'three';

/**
 * Creates dynamic high-res canvas textures for Clothbound Book Covers with Foil Motifs.
 */
export function createBookTextures(
  title: string,
  author: string,
  spineText: string | undefined,
  baseColorHex: string,
  foilType: string = 'gold'
) {
  // Foil color palette
  const foilMap: Record<string, { stroke: string; glow: string; shadow: string }> = {
    gold: { stroke: '#e8c170', glow: '#fff2b3', shadow: '#966d18' },
    silver: { stroke: '#dce5ea', glow: '#ffffff', shadow: '#7c8891' },
    copper: { stroke: '#d98b64', glow: '#fed8c3', shadow: '#8c4826' },
    deboss: { stroke: '#1a1817', glow: '#2e2a27', shadow: '#0d0c0b' },
  };

  const foil = foilMap[foilType] || foilMap.gold;

  // 1. FRONT COVER
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 1024;
  frontCanvas.height = 1536;
  const fCtx = frontCanvas.getContext('2d')!;

  // Base cloth color
  fCtx.fillStyle = baseColorHex;
  fCtx.fillRect(0, 0, 1024, 1536);

  // Cloth weave subtle noise overlay
  addClothTexture(fCtx, 1024, 1536);

  // Outer elegant foil border
  fCtx.strokeStyle = foil.stroke;
  fCtx.lineWidth = 6;
  fCtx.strokeRect(60, 60, 904, 1416);

  // Inner thin border
  fCtx.lineWidth = 2;
  fCtx.strokeRect(80, 80, 864, 1376);

  // Corner decorative flourishes
  drawCornerFoil(fCtx, 90, 90, foil.stroke);
  drawCornerFoil(fCtx, 934, 90, foil.stroke, true, false);
  drawCornerFoil(fCtx, 90, 1446, foil.stroke, false, true);
  drawCornerFoil(fCtx, 934, 1446, foil.stroke, true, true);

  // Abstract center foil medallion / motif
  drawCenterMotif(fCtx, 512, 580, foil.stroke);

  // Title
  fCtx.fillStyle = foil.stroke;
  fCtx.font = 'bold 58px "Cinzel", "Playfair Display", "Georgia", serif';
  fCtx.textAlign = 'center';
  wrapText(fCtx, title.toUpperCase(), 512, 860, 720, 70);

  // Divider
  fCtx.beginPath();
  fCtx.moveTo(400, 1080);
  fCtx.lineTo(624, 1080);
  fCtx.lineWidth = 3;
  fCtx.stroke();

  // Author
  fCtx.font = 'italic 36px "Cinzel", "Georgia", serif';
  fCtx.fillText(author, 512, 1150);

  // 2. SPINE COVER
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 384;
  spineCanvas.height = 1536;
  const sCtx = spineCanvas.getContext('2d')!;

  sCtx.fillStyle = baseColorHex;
  sCtx.fillRect(0, 0, 384, 1536);
  addClothTexture(sCtx, 384, 1536);

  // Spine gold bands (top & bottom)
  sCtx.strokeStyle = foil.stroke;
  sCtx.lineWidth = 4;
  [120, 140, 1396, 1416].forEach((y) => {
    sCtx.beginPath();
    sCtx.moveTo(30, y);
    sCtx.lineTo(354, y);
    sCtx.stroke();
  });

  // Vertical spine title
  sCtx.save();
  sCtx.translate(192, 768);
  sCtx.rotate(Math.PI / 2);
  sCtx.fillStyle = foil.stroke;
  sCtx.font = '600 38px "Cinzel", "Georgia", serif';
  sCtx.textAlign = 'center';
  sCtx.fillText((spineText || title).toUpperCase(), 0, 12);
  sCtx.restore();

  // 3. BACK COVER
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 1024;
  backCanvas.height = 1536;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = baseColorHex;
  bCtx.fillRect(0, 0, 1024, 1536);
  addClothTexture(bCtx, 1024, 1536);

  bCtx.strokeStyle = foil.stroke;
  bCtx.lineWidth = 4;
  bCtx.strokeRect(70, 70, 884, 1396);
  drawCenterMotif(bCtx, 512, 768, foil.stroke, 0.7);

  // Convert canvases to Three.js textures
  const frontTexture = new THREE.CanvasTexture(frontCanvas);
  const spineTexture = new THREE.CanvasTexture(spineCanvas);
  const backTexture = new THREE.CanvasTexture(backCanvas);

  [frontTexture, spineTexture, backTexture].forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
  });

  return { frontTexture, spineTexture, backTexture };
}

function addClothTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

function drawCornerFoil(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, flipX = false, flipY = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.lineTo(0, 0);
  ctx.lineTo(40, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(15, 15, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCenterMotif(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  // Diamond with concentric rings & delicate lines
  ctx.beginPath();
  ctx.moveTo(0, -90);
  ctx.lineTo(90, 0);
  ctx.lineTo(0, 90);
  ctx.lineTo(-90, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
