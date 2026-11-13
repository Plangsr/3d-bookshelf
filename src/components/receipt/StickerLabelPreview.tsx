'use client';

import React, { useMemo } from 'react';
import type { StickerConfig } from '@/types/shirt';

export interface StickerLabelPreviewProps {
  config: StickerConfig;
  /** Printable sticker box width in mm (used to auto-scale typography, spacing & details) */
  widthMm?: number;
  /** Printable sticker box height in mm (prevents overflow on small stickers like 30x40mm) */
  heightMm?: number | null;
  /** Screen scale px/mm inside Map Preview; omit when rendering native mm for window.print() */
  pxPerMm?: number;
}

/**
 * Generates deterministic high-contrast barcode bars cleanly in SVG from text/digits.
 */
function buildBarcodeBars(seed: string): { x: number; w: number }[] {
  const input = seed.trim() || '8851234567890';
  const bars: { x: number; w: number }[] = [];
  let cursor = 0;

  // Start guard
  bars.push({ x: cursor, w: 2 });
  cursor += 4;
  bars.push({ x: cursor, w: 2 });
  cursor += 5;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    const p1 = (code % 3) + 1;
    const p2 = ((code >> 2) % 2) + 1;
    const p3 = ((code >> 4) % 3) + 1;
    const g1 = ((code >> 1) % 2) + 1.5;
    const g2 = ((code >> 3) % 2) + 1.5;

    bars.push({ x: cursor, w: p1 });
    cursor += p1 + g1;
    bars.push({ x: cursor, w: p2 });
    cursor += p2 + g2;
    bars.push({ x: cursor, w: p3 });
    cursor += p3 + 2;
  }

  // Stop guard
  bars.push({ x: cursor, w: 2 });
  cursor += 4;
  bars.push({ x: cursor, w: 2 });

  return bars;
}

interface ComputedStickerMetrics {
  baseFontMm: number;
  isCompact: boolean;
  borderRadiusMm: number;
}

/**
 * Computes proportional base font size (mm) and compact layout mode so every sticker
 * size (from small 30x40mm or 20x30mm labels up to large 70x100mm hangtags) scales
 * text, padding, write-in lines, and barcodes cleanly without clipping.
 */
function computeStickerMetrics(
  config: StickerConfig,
  widthMm?: number,
  heightMm?: number | null
): ComputedStickerMetrics {
  const effW = Math.max(8, widthMm ?? 46);
  const effH = heightMm && heightMm > 0 ? Math.max(8, heightMm) : effW * 1.4;

  const isSmallLabel = effW <= 36 || effH <= 46;
  const isCompact =
    config.detailDensity === 'compact'
      ? true
      : config.detailDensity === 'normal'
      ? false
      : isSmallLabel;

  // Estimate vertical demand in `em` based on enabled blocks & line wrapping
  const modelChars = config.modelName.trim().length;
  const colorChars = config.colorName.trim().length;
  const captionChars = config.barcodeCaption.trim().length;

  const modelLines = modelChars > 18 ? 1.85 : 1.0;
  const colorLines = colorChars > 18 ? 1.75 : 1.0;

  let emDemand = isCompact ? 0.75 : 1.3; // outer top+bottom padding
  if (config.showBrandHeader) {
    const hasBrandSub = config.brandHeader.trim().includes(' ');
    emDemand += isCompact ? (hasBrandSub ? 2.15 : 1.65) : hasBrandSub ? 2.9 : 2.2;
  }
  emDemand += (isCompact ? 0.62 : 0.78) + modelLines * (isCompact ? 0.96 : 1.15);
  emDemand += (isCompact ? 0.62 : 0.78) + colorLines * (isCompact ? 0.9 : 1.05);
  emDemand += isCompact ? 2.15 : 2.85; // ไซส์
  emDemand += isCompact ? 0.48 : 1.1; // spacing between fields

  if (config.showBarcode) {
    emDemand += isCompact ? 1.7 : 2.65;
    if (config.barcodeDigits.trim()) emDemand += 0.8;
    if (config.barcodeCaption.trim()) emDemand += captionChars > 24 ? 1.1 : 0.65;
  }

  const widthBudgetMm = effW * (isCompact ? 0.056 : 0.058);
  const heightBudgetMm = (effH * 0.93) / Math.max(6, emDemand);
  const userScale = Math.max(0.45, Math.min(1.6, (config.fontScalePct ?? 100) / 100));

  const rawFontMm = Math.min(widthBudgetMm, heightBudgetMm) * userScale;
  const baseFontMm = Math.max(0.55, Math.min(6.5, rawFontMm));
  const safeRadiusMm = Math.min(config.borderRadiusMm, +(effW * 0.09).toFixed(2));

  return {
    baseFontMm,
    isCompact,
    borderRadiusMm: safeRadiusMm,
  };
}

export const StickerLabelPreview: React.FC<StickerLabelPreviewProps> = ({
  config,
  widthMm,
  heightMm,
  pxPerMm,
}) => {
  const barcodeSeed =
    config.barcodeDigits.trim() || config.barcodeCaption.trim() || config.modelName;
  const bars = useMemo(() => buildBarcodeBars(barcodeSeed), [barcodeSeed]);
  const totalSvgWidth = useMemo(() => {
    const last = bars[bars.length - 1];
    return last ? last.x + last.w + 2 : 120;
  }, [bars]);

  const metrics = useMemo(
    () => computeStickerMetrics(config, widthMm, heightMm),
    [config, widthMm, heightMm]
  );

  const fontSizeCss =
    pxPerMm && pxPerMm > 0
      ? `${(metrics.baseFontMm * pxPerMm).toFixed(2)}px`
      : `${metrics.baseFontMm.toFixed(3)}mm`;
  const radiusCss =
    pxPerMm && pxPerMm > 0
      ? `${(metrics.borderRadiusMm * pxPerMm).toFixed(2)}px`
      : `${metrics.borderRadiusMm}mm`;

  const borderLineClass =
    config.writeInLineStyle === 'dashed'
      ? 'border-b-[1.25px] border-dashed border-neutral-500'
      : 'border-b-[1.25px] border-neutral-800';

  const brandWords = config.brandHeader.trim().split(/\s+/);
  const brandTop = brandWords[0] || 'THAI';
  const brandSub = brandWords.slice(1).join(' ');

  const padClass = metrics.isCompact ? 'p-[0.38em]' : 'p-[0.75em]';
  const fieldGapClass = metrics.isCompact ? 'space-y-[0.22em]' : 'space-y-[0.55em]';

  return (
    <div
      style={{
        fontSize: fontSizeCss,
        borderRadius: radiusCss,
      }}
      className={`w-full bg-white text-[#15181e] ${padClass} flex flex-col justify-between leading-[1.12] font-sans select-none ${
        config.showCutBorder ? 'border border-neutral-300' : ''
      }`}
    >
      {/* Brand Header */}
      {config.showBrandHeader && (
        <div
          className={`text-center border-b border-neutral-200/80 ${
            metrics.isCompact ? 'pb-[0.22em] mb-[0.22em]' : 'pb-[0.42em] mb-[0.45em]'
          }`}
        >
          <div
            className={`${
              metrics.isCompact ? 'text-[1.22em]' : 'text-[1.45em]'
            } font-extrabold tracking-wide text-[#243b6b] uppercase leading-none`}
          >
            {brandTop}
          </div>
          {brandSub && (
            <div
              className={`${
                metrics.isCompact ? 'text-[0.58em] tracking-[0.16em]' : 'text-[0.68em] tracking-[0.22em]'
              } font-semibold text-[#2c4a82] uppercase mt-[0.16em]`}
            >
              {brandSub}
            </div>
          )}
        </div>
      )}

      {/* Main Fields: รุ่น / สี / ไซส์ */}
      <div className={fieldGapClass}>
        {/* รุ่น (MODEL) */}
        <div>
          <div
            className={`${
              metrics.isCompact ? 'text-[0.58em]' : 'text-[0.65em]'
            } font-medium text-neutral-600`}
          >
            รุ่น (MODEL):
          </div>
          {config.modelName.trim() ? (
            <div
              className={`${
                metrics.isCompact ? 'text-[0.95em]' : 'text-[1.08em]'
              } font-extrabold tracking-tight text-black mt-[0.08em] break-words`}
            >
              {config.modelName.trim()}
            </div>
          ) : (
            <div
              className={`${
                metrics.isCompact ? 'h-[1.05em]' : 'h-[1.35em]'
              } w-full mt-[0.12em] ${borderLineClass}`}
            />
          )}
        </div>

        {/* สี (COLOR) */}
        <div>
          <div
            className={`${
              metrics.isCompact ? 'text-[0.58em]' : 'text-[0.65em]'
            } font-medium text-neutral-600`}
          >
            สี (COLOR):
          </div>
          {config.colorName.trim() ? (
            <div
              className={`${
                metrics.isCompact ? 'text-[0.88em]' : 'text-[0.98em]'
              } font-bold text-[#1d222b] mt-[0.08em] break-words`}
            >
              {config.colorName.trim()}
            </div>
          ) : (
            <div
              className={`${
                metrics.isCompact ? 'h-[1.05em]' : 'h-[1.35em]'
              } w-full mt-[0.12em] ${borderLineClass}`}
            />
          )}
        </div>

        {/* ไซส์ (SIZE) */}
        <div>
          <div
            className={`${
              metrics.isCompact ? 'text-[0.58em]' : 'text-[0.65em]'
            } font-medium text-neutral-600`}
          >
            ไซส์ (SIZE):
          </div>
          {config.sizeLabel.trim() ? (
            <div
              className={`text-center ${
                metrics.isCompact ? 'text-[1.72em]' : 'text-[2.2em]'
              } font-black text-black tracking-tight leading-none py-[0.08em]`}
            >
              {config.sizeLabel.trim()}
            </div>
          ) : (
            <div
              className={`${
                metrics.isCompact ? 'h-[1.45em]' : 'h-[1.8em]'
              } w-full mt-[0.12em] ${borderLineClass}`}
            />
          )}
        </div>
      </div>

      {/* Optional Barcode */}
      {config.showBarcode && (
        <div
          className={`text-center ${
            metrics.isCompact ? 'mt-[0.26em] pt-[0.14em]' : 'mt-[0.55em] pt-[0.25em]'
          }`}
        >
          <svg
            viewBox={`0 0 ${totalSvgWidth} 36`}
            className={`w-[90%] ${
              metrics.isCompact ? 'h-[1.45em]' : 'h-[2.1em]'
            } mx-auto block`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {bars.map((b, idx) => (
              <rect key={idx} x={b.x} y={0} width={b.w} height={36} fill="#000000" />
            ))}
          </svg>
          {config.barcodeDigits.trim() && (
            <div
              className={`${
                metrics.isCompact ? 'text-[0.62em] tracking-[0.1em]' : 'text-[0.72em] tracking-[0.16em]'
              } font-mono text-black mt-[0.12em] whitespace-nowrap`}
            >
              {config.barcodeDigits.trim()}
            </div>
          )}
          {config.barcodeCaption.trim() && (
            <div
              className={`${
                metrics.isCompact ? 'text-[0.46em]' : 'text-[0.54em]'
              } font-medium text-neutral-700 mt-[0.12em] break-words`}
            >
              บาร์โค้ด (BARCODE): {config.barcodeCaption.trim()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
