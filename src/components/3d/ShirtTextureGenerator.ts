import * as THREE from 'three';

export interface ShirtTextureSet {
  frontTexture: THREE.CanvasTexture;
  backTexture: THREE.CanvasTexture;
  sleeveTexture: THREE.CanvasTexture;
}

// Cache generated textures so we don't recreate them every render frame
const textureCache = new Map<string, ShirtTextureSet>();

/**
 * Computes a tiny deterministic hash for long image URLs / data URLs so cache keys stay compact.
 */
function hashString(input?: string): string {
  if (!input) return '';
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(input.length / 128));
  for (let i = 0; i < input.length; i += step) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${input.length}_${(hash >>> 0).toString(36)}`;
}

/**
 * Parses a hex color string into RGB components and relative luminance.
 */
function parseHexColor(hex: string): { r: number; g: number; b: number; luminance: number } {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);

  const num = Number.parseInt(full, 16);
  const r = Number.isNaN(num) ? 40 : (num >> 16) & 255;
  const g = Number.isNaN(num) ? 40 : (num >> 8) & 255;
  const b = Number.isNaN(num) ? 45 : num & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { r, g, b, luminance };
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.max(0, Math.min(255, Math.round(r)))}, ${Math.max(
    0,
    Math.min(255, Math.round(g))
  )}, ${Math.max(0, Math.min(255, Math.round(b)))}, ${a})`;
}

/**
 * Draws realistic garment fabric weave (jersey, piqué, oxford basketweave, or brushed fleece).
 */
function drawFabricWeave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColorHex: string,
  style: string
) {
  const { r, g, b, luminance } = parseHexColor(baseColorHex);
  const isLight = luminance > 0.62;

  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, width, height);

  // Subtle vertical garment drape lighting gradient
  const drapeGrad = ctx.createLinearGradient(0, 0, width, 0);
  const edgeShade = isLight ? rgba(r - 28, g - 28, b - 24, 0.28) : rgba(0, 0, 0, 0.28);
  const midHighlight = isLight ? rgba(255, 255, 255, 0.22) : rgba(255, 255, 255, 0.06);
  drapeGrad.addColorStop(0, edgeShade);
  drapeGrad.addColorStop(0.16, midHighlight);
  drapeGrad.addColorStop(0.38, 'rgba(0,0,0,0)');
  drapeGrad.addColorStop(0.5, midHighlight);
  drapeGrad.addColorStop(0.68, 'rgba(0,0,0,0.06)');
  drapeGrad.addColorStop(0.84, midHighlight);
  drapeGrad.addColorStop(1, edgeShade);
  ctx.fillStyle = drapeGrad;
  ctx.fillRect(0, 0, width, height);

  // Micro-weave texture pattern
  const patternCanvas = document.createElement('canvas');
  const pSize = style === 'oxford' ? 8 : style === 'polo' ? 6 : style === 'hoodie' ? 10 : 5;
  patternCanvas.width = pSize;
  patternCanvas.height = pSize;
  const pCtx = patternCanvas.getContext('2d');

  if (pCtx) {
    const darkThread = isLight ? rgba(r - 26, g - 26, b - 24, 0.16) : rgba(0, 0, 0, 0.22);
    const lightThread = isLight ? rgba(255, 255, 255, 0.25) : rgba(255, 255, 255, 0.06);

    if (style === 'oxford') {
      // Basketweave crosshatch
      pCtx.fillStyle = lightThread;
      pCtx.fillRect(0, 0, pSize / 2, pSize / 2);
      pCtx.fillRect(pSize / 2, pSize / 2, pSize / 2, pSize / 2);
      pCtx.fillStyle = darkThread;
      pCtx.fillRect(pSize / 2, 0, pSize / 2, pSize / 2);
      pCtx.fillRect(0, pSize / 2, pSize / 2, pSize / 2);
    } else if (style === 'polo') {
      // Honeycomb piqué knit
      pCtx.fillStyle = darkThread;
      pCtx.fillRect(1, 1, 2, 2);
      pCtx.fillRect(4, 4, 2, 2);
      pCtx.fillStyle = lightThread;
      pCtx.fillRect(4, 1, 1, 1);
      pCtx.fillRect(1, 4, 1, 1);
    } else if (style === 'hoodie') {
      // Heavy brushed fleece grain
      pCtx.fillStyle = darkThread;
      pCtx.fillRect(0, 2, 3, 2);
      pCtx.fillRect(5, 6, 4, 2);
      pCtx.fillStyle = lightThread;
      pCtx.fillRect(2, 0, 3, 1);
      pCtx.fillRect(6, 3, 2, 2);
    } else {
      // Fine combed cotton jersey vertical knit ribs
      pCtx.fillStyle = lightThread;
      pCtx.fillRect(1, 0, 1, pSize);
      pCtx.fillStyle = darkThread;
      pCtx.fillRect(3, 0, 1, pSize);
    }

    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Subtle vertical soft-fold shadows from hanging on hanger
  const foldPositions = [0.22, 0.44, 0.72];
  foldPositions.forEach((fp, i) => {
    const fx = width * fp;
    const fGrad = ctx.createLinearGradient(fx - 26, 0, fx + 26, 0);
    const alpha = isLight ? 0.06 : 0.11;
    fGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fGrad.addColorStop(0.5, i % 2 === 0 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.45})`);
    fGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(fx - 26, height * 0.18, 52, height * 0.78);
  });
}

/**
 * Draws double-needle topstitching along side seams, shoulders, and hem.
 */
function drawStitching(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColorHex: string,
  accentColor: string
) {
  const { luminance } = parseHexColor(baseColorHex);
  const stitchColor = luminance > 0.65 ? 'rgba(65, 56, 46, 0.36)' : 'rgba(255, 248, 236, 0.28)';

  ctx.save();
  ctx.strokeStyle = stitchColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);

  // Bottom double-needle hem stitching
  const hemY1 = height - 30;
  const hemY2 = height - 22;
  ctx.beginPath();
  ctx.moveTo(16, hemY1);
  ctx.lineTo(width - 16, hemY1);
  ctx.moveTo(16, hemY2);
  ctx.lineTo(width - 16, hemY2);
  ctx.stroke();

  // Left & right side-seam lockstitch
  ctx.beginPath();
  ctx.moveTo(14, 40);
  ctx.lineTo(14, height - 26);
  ctx.moveTo(width - 14, 40);
  ctx.lineTo(width - 14, height - 26);
  ctx.stroke();

  // Subtle accent bar-tack near lower side split
  ctx.setLineDash([]);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(14, height - 48);
  ctx.lineTo(14, height - 32);
  ctx.moveTo(width - 14, height - 48);
  ctx.lineTo(width - 14, height - 32);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a woven boutique neck label near top center.
 */
function drawWovenNeckLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  subtitle: string,
  sku: string,
  accentColor: string
) {
  ctx.save();
  const labelW = 112;
  const labelH = 44;
  const x = cx - labelW / 2;

  // Woven grosgrain backing
  ctx.fillStyle = '#f4eee4';
  ctx.fillRect(x, topY, labelW, labelH);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 3, topY + 3, labelW - 6, labelH - 6);

  // Corner tack stitches
  ctx.fillStyle = accentColor;
  ctx.fillRect(x - 2, topY + 4, 4, 4);
  ctx.fillRect(x + labelW - 2, topY + 4, 4, 4);

  // Brand / collection line
  ctx.fillStyle = '#1f1813';
  ctx.font = 'bold 10px "Cinzel", "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.fillText((subtitle || 'ATELIER').slice(0, 14).toUpperCase(), cx, topY + 19);

  // SKU line
  ctx.fillStyle = '#6f5c49';
  ctx.font = '600 9px monospace';
  ctx.fillText(sku.slice(0, 14).toUpperCase(), cx, topY + 33);

  ctx.restore();
}

/**
 * Draws a woven hem SKU/edition tab near the bottom-left hem.
 */
function drawHemSkuTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sku: string,
  tagText: string | undefined,
  accentColor: string
) {
  ctx.save();
  const tagW = 104;
  const tagH = 30;
  ctx.fillStyle = '#191410';
  ctx.fillRect(x, y, tagW, tagH);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 2, y + 2, tagW - 4, tagH - 4);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(sku.slice(0, 12).toUpperCase(), x + 8, y + 13);

  ctx.fillStyle = '#e7dccd';
  ctx.font = '600 8px sans-serif';
  ctx.fillText((tagText || 'BOUTIQUE').slice(0, 14).toUpperCase(), x + 8, y + 24);
  ctx.restore();
}

/**
 * Draws style-specific chest motif, pocket, placket, or emblem.
 */
function drawStyleFrontDetails(
  ctx: CanvasRenderingContext2D,
  name: string,
  sku: string,
  subtitle: string,
  baseColorHex: string,
  accentColor: string,
  style: string,
  tagText?: string
) {
  const { luminance } = parseHexColor(baseColorHex);
  const inkColor = luminance > 0.65 ? '#261e18' : accentColor;
  const stitchColor = luminance > 0.65 ? 'rgba(40,32,26,0.45)' : 'rgba(255,248,236,0.34)';

  if (style === 'oxford') {
    // Center placket seam & mother-of-pearl buttons (complementing 3D collar/placket)
    ctx.save();
    ctx.fillStyle = luminance > 0.65 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(236, 95, 40, 620);
    ctx.strokeStyle = stitchColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(236, 95, 40, 620);
    ctx.setLineDash([]);

    // Left-chest tailored pocket (viewer right: x=318)
    const px = 315;
    const py = 210;
    const pw = 96;
    const ph = 112;
    ctx.fillStyle = luminance > 0.65 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw, py + ph - 18);
    ctx.lineTo(px + pw / 2, py + ph);
    ctx.lineTo(px, py + ph - 18);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = stitchColor;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small embroidered atelier monogram on pocket
    drawAtelierCrest(ctx, px + pw / 2, py + 44, inkColor, 0.42);
    ctx.restore();
  } else if (style === 'polo') {
    // Embroidered crest on chest + subtle horizontal chest stripe accent
    ctx.save();
    ctx.strokeStyle = inkColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 340);
    ctx.lineTo(488, 340);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawAtelierCrest(ctx, 355, 232, inkColor, 0.56);

    ctx.fillStyle = inkColor;
    ctx.font = 'bold 11px "Cinzel", "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.fillText((tagText || 'PIQUÉ').slice(0, 12).toUpperCase(), 355, 276);
    ctx.restore();
  } else if (style === 'hoodie') {
    // Center chest architectural typography + kangaroo pocket stitch outline
    ctx.save();
    drawAtelierCrest(ctx, 256, 238, inkColor, 0.8);

    ctx.fillStyle = inkColor;
    ctx.font = 'bold 21px "Cinzel", "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 18).toUpperCase(), 256, 315);

    ctx.font = '600 11px monospace';
    ctx.globalAlpha = 0.85;
    ctx.fillText(`${subtitle.slice(0, 22).toUpperCase()} • ${sku}`, 256, 342);
    ctx.globalAlpha = 1;

    // Kangaroo pocket topstitch outline at bottom torso
    ctx.strokeStyle = stitchColor;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(116, 485);
    ctx.lineTo(396, 485);
    ctx.lineTo(432, 665);
    ctx.lineTo(80, 665);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  } else {
    // 'tshirt' — clean editorial chest print / pocket crest
    ctx.save();
    drawAtelierCrest(ctx, 256, 255, inkColor, 0.9);

    ctx.fillStyle = inkColor;
    ctx.font = 'bold 22px "Cinzel", "Georgia", serif';
    ctx.textAlign = 'center';
    wrapText(ctx, name.toUpperCase(), 256, 342, 330, 28);

    // Divider line
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(196, 405);
    ctx.lineTo(316, 405);
    ctx.stroke();

    ctx.font = '600 12px monospace';
    ctx.globalAlpha = 0.85;
    ctx.fillText((subtitle || sku).slice(0, 26).toUpperCase(), 256, 432);
    if (tagText) {
      ctx.font = 'italic 12px "Georgia", serif';
      ctx.fillText(tagText.slice(0, 28), 256, 456);
    }
    ctx.restore();
  }
}

function drawAtelierCrest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  scale = 1
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;

  // Diamond atelier frame
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(44, 0);
  ctx.lineTo(0, 44);
  ctx.lineTo(-44, 0);
  ctx.closePath();
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();

  // Crossed needle & thread star motif
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  ctx.lineTo(14, 14);
  ctx.moveTo(14, -14);
  ctx.lineTo(-14, 14);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;
  let linesDrawn = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
      linesDrawn += 1;
      if (linesDrawn >= 2) break;
    } else {
      line = testLine;
    }
  }
  if (linesDrawn < 2) {
    ctx.fillText(line.trim(), x, currentY);
  }
}

/**
 * Loads an optional front/back photo or print URL onto the garment canvas, preserving collar/hem framing.
 */
function overlayGarmentImage(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  imageUrl: string,
  isFront: boolean
) {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
    img.crossOrigin = 'anonymous';
  }
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    // Draw uploaded photo inside a soft rounded garment panel so woven label & hem stitching remain visible
    const padX = 28;
    const padTop = isFront ? 105 : 88;
    const drawW = canvas.width - padX * 2;
    const drawH = canvas.height - padTop - 52;

    const aspectImg = img.width / Math.max(1, img.height);
    const aspectBox = drawW / drawH;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (aspectImg > aspectBox) {
      sw = img.height * aspectBox;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / aspectBox;
      sy = (img.height - sh) / 2;
    }

    ctx.beginPath();
    ctx.roundRect(padX, padTop, drawW, drawH, 14);
    ctx.clip();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, sx, sy, sw, sh, padX, padTop, drawW, drawH);

    // Subtle multiply fabric grain overlay so photo feels printed/woven on fabric
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#000000';
    for (let y = padTop; y < padTop + drawH; y += 4) {
      ctx.fillRect(padX, y, drawW, 1);
    }
    ctx.restore();
    texture.needsUpdate = true;
  };
  img.onerror = () => {
    // Gracefully keep procedural canvas weave on load failure
  };
  img.src = imageUrl;
}

/**
 * Creates lightweight, cached Three.js CanvasTextures for a boutique garment (front, back, sleeve).
 */
export function createShirtTextures(
  name: string,
  sku: string,
  subtitle: string,
  baseColorHex: string,
  accentColor: string,
  style: string,
  tagText?: string,
  frontImageUrl?: string,
  backImageUrl?: string
): ShirtTextureSet {
  const safeBase = baseColorHex || '#1a2332';
  const safeAccent = accentColor || '#e8c170';
  const safeStyle = style || 'tshirt';
  const cacheKey = `${name}_${sku}_${subtitle}_${safeBase}_${safeAccent}_${safeStyle}_${tagText || ''}_${hashString(
    frontImageUrl
  )}_${hashString(backImageUrl)}`;

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  // Fallback for non-DOM environments
  if (typeof document === 'undefined') {
    const empty = new THREE.CanvasTexture({} as HTMLCanvasElement);
    return { frontTexture: empty, backTexture: empty, sleeveTexture: empty };
  }

  // 1. FRONT GARMENT CANVAS (512x768)
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 512;
  frontCanvas.height = 768;
  const fCtx = frontCanvas.getContext('2d')!;
  drawFabricWeave(fCtx, 512, 768, safeBase, safeStyle);
  drawStitching(fCtx, 512, 768, safeBase, safeAccent);
  drawWovenNeckLabel(fCtx, 256, 36, subtitle, sku, safeAccent);
  drawStyleFrontDetails(fCtx, name, sku, subtitle, safeBase, safeAccent, safeStyle, tagText);
  drawHemSkuTag(fCtx, 38, 692, sku, tagText, safeAccent);

  // 2. BACK GARMENT CANVAS (512x768)
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 512;
  backCanvas.height = 768;
  const bCtx = backCanvas.getContext('2d')!;
  drawFabricWeave(bCtx, 512, 768, safeBase, safeStyle);
  drawStitching(bCtx, 512, 768, safeBase, safeAccent);

  // Back shoulder yoke seam (especially crisp for oxford & hoodie)
  const { luminance } = parseHexColor(safeBase);
  bCtx.save();
  bCtx.strokeStyle = luminance > 0.65 ? 'rgba(40,32,26,0.35)' : 'rgba(255,248,236,0.24)';
  bCtx.lineWidth = 1.6;
  bCtx.setLineDash([5, 4]);
  bCtx.beginPath();
  bCtx.moveTo(20, 128);
  bCtx.lineTo(492, 128);
  bCtx.stroke();
  bCtx.restore();

  // Minimalist back emblem + batch label
  const backInk = luminance > 0.65 ? '#2a221b' : safeAccent;
  drawAtelierCrest(bCtx, 256, 265, backInk, 0.65);
  bCtx.fillStyle = backInk;
  bCtx.font = '600 12px "Cinzel", "Georgia", serif';
  bCtx.textAlign = 'center';
  bCtx.fillText((subtitle || 'ATELIER ARCHIVE').toUpperCase(), 256, 336);
  bCtx.font = '600 10px monospace';
  bCtx.fillText(`LOT • ${sku.toUpperCase()}`, 256, 356);

  // 3. SLEEVE CANVAS (256x256)
  const sleeveCanvas = document.createElement('canvas');
  sleeveCanvas.width = 256;
  sleeveCanvas.height = 256;
  const sCtx = sleeveCanvas.getContext('2d')!;
  drawFabricWeave(sCtx, 256, 256, safeBase, safeStyle);

  // Sleeve cuff double-stitching
  sCtx.save();
  sCtx.strokeStyle = luminance > 0.65 ? 'rgba(55,46,38,0.38)' : 'rgba(255,248,236,0.28)';
  sCtx.lineWidth = 1.5;
  sCtx.setLineDash([5, 4]);
  sCtx.beginPath();
  sCtx.moveTo(8, 226);
  sCtx.lineTo(248, 226);
  sCtx.moveTo(8, 234);
  sCtx.lineTo(248, 234);
  sCtx.stroke();

  // Tiny woven cuff accent mark
  sCtx.setLineDash([]);
  sCtx.fillStyle = safeAccent;
  sCtx.fillRect(112, 202, 32, 14);
  sCtx.fillStyle = '#18130f';
  sCtx.font = 'bold 8px monospace';
  sCtx.textAlign = 'center';
  sCtx.fillText(sku.slice(0, 6).toUpperCase(), 128, 212);
  sCtx.restore();

  const frontTexture = new THREE.CanvasTexture(frontCanvas);
  const backTexture = new THREE.CanvasTexture(backCanvas);
  const sleeveTexture = new THREE.CanvasTexture(sleeveCanvas);

  [frontTexture, backTexture, sleeveTexture].forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  });

  if (frontImageUrl) {
    overlayGarmentImage(frontCanvas, frontTexture, frontImageUrl, true);
  }
  if (backImageUrl) {
    overlayGarmentImage(backCanvas, backTexture, backImageUrl, false);
  }

  const result: ShirtTextureSet = { frontTexture, backTexture, sleeveTexture };
  textureCache.set(cacheKey, result);
  return result;
}
