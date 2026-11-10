import * as THREE from 'three';

// Cache generated textures so we don't recreate them every render frame
const textureCache = new Map<string, { frontTexture: THREE.CanvasTexture; spineTexture: THREE.CanvasTexture; backTexture: THREE.CanvasTexture }>();

/**
 * Creates lightweight, high-performance canvas textures for Clothbound Book Covers.
 * Optimized for mobile GPUs with texture caching and 512x768 resolution.
 */
export function createBookTextures(
  title: string,
  author: string,
  spineText: string | undefined,
  baseColorHex: string,
  foilType: string = 'gold'
) {
  const cacheKey = `${title}_${author}_${spineText}_${baseColorHex}_${foilType}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const foilMap: Record<string, { stroke: string }> = {
    gold: { stroke: '#e8c170' },
    silver: { stroke: '#dce5ea' },
    copper: { stroke: '#d98b64' },
    deboss: { stroke: '#1a1817' },
  };

  const foil = foilMap[foilType] || foilMap.gold;

  // 1. FRONT COVER (Optimized to 512x768 for 60fps on mobile)
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 512;
  frontCanvas.height = 768;
  const fCtx = frontCanvas.getContext('2d')!;

  fCtx.fillStyle = baseColorHex;
  fCtx.fillRect(0, 0, 512, 768);

  // Outer elegant foil border
  fCtx.strokeStyle = foil.stroke;
  fCtx.lineWidth = 3;
  fCtx.strokeRect(30, 30, 452, 708);

  // Inner thin border
  fCtx.lineWidth = 1;
  fCtx.strokeRect(40, 40, 432, 688);

  // Corner decorative flourishes
  drawCornerFoil(fCtx, 45, 45, foil.stroke);
  drawCornerFoil(fCtx, 467, 45, foil.stroke, true, false);
  drawCornerFoil(fCtx, 45, 723, foil.stroke, false, true);
  drawCornerFoil(fCtx, 467, 723, foil.stroke, true, true);

  // Center foil medallion
  drawCenterMotif(fCtx, 256, 290, foil.stroke);

  // Title
  fCtx.fillStyle = foil.stroke;
  fCtx.font = 'bold 30px "Cinzel", "Playfair Display", "Georgia", serif';
  fCtx.textAlign = 'center';
  wrapText(fCtx, title.toUpperCase(), 256, 430, 360, 36);

  // Divider line
  fCtx.beginPath();
  fCtx.moveTo(200, 540);
  fCtx.lineTo(312, 540);
  fCtx.lineWidth = 1.5;
  fCtx.stroke();

  // Author
  fCtx.font = 'italic 19px "Cinzel", "Georgia", serif';
  fCtx.fillText(author, 256, 580);

  // 2. SPINE COVER (192x768)
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 192;
  spineCanvas.height = 768;
  const sCtx = spineCanvas.getContext('2d')!;

  sCtx.fillStyle = baseColorHex;
  sCtx.fillRect(0, 0, 192, 768);

  // Spine bands
  sCtx.strokeStyle = foil.stroke;
  sCtx.lineWidth = 2;
  [60, 70, 698, 708].forEach((y) => {
    sCtx.beginPath();
    sCtx.moveTo(15, y);
    sCtx.lineTo(177, y);
    sCtx.stroke();
  });

  // Vertical spine title
  sCtx.save();
  sCtx.translate(96, 384);
  sCtx.rotate(Math.PI / 2);
  sCtx.fillStyle = foil.stroke;
  sCtx.font = '600 20px "Cinzel", "Georgia", serif';
  sCtx.textAlign = 'center';
  sCtx.fillText((spineText || title).toUpperCase(), 0, 7);
  sCtx.restore();

  // 3. BACK COVER
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 512;
  backCanvas.height = 768;
  const bCtx = backCanvas.getContext('2d')!;

  bCtx.fillStyle = baseColorHex;
  bCtx.fillRect(0, 0, 512, 768);
  bCtx.strokeStyle = foil.stroke;
  bCtx.lineWidth = 2;
  bCtx.strokeRect(35, 35, 442, 698);
  drawCenterMotif(bCtx, 256, 384, foil.stroke, 0.6);

  // Convert to Three.js textures
  const frontTexture = new THREE.CanvasTexture(frontCanvas);
  const spineTexture = new THREE.CanvasTexture(spineCanvas);
  const backTexture = new THREE.CanvasTexture(backCanvas);

  [frontTexture, spineTexture, backTexture].forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false; // Disable mipmaps for fast rendering
    t.minFilter = THREE.LinearFilter;
  });

  const result = { frontTexture, spineTexture, backTexture };
  textureCache.set(cacheKey, result);
  return result;
}

function drawCornerFoil(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, flipX = false, flipY = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, 8, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCenterMotif(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * 0.65, scale * 0.65);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(60, 0);
  ctx.lineTo(0, 60);
  ctx.lineTo(-60, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
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
