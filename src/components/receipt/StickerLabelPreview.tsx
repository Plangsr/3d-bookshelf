'use client';

import React, { useMemo } from 'react';
import type { StickerConfig } from '@/types/shirt';

interface StickerLabelPreviewProps {
  config: StickerConfig;
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

export const StickerLabelPreview: React.FC<StickerLabelPreviewProps> = ({ config }) => {
  const barcodeSeed = config.barcodeDigits.trim() || config.barcodeCaption.trim() || config.modelName;
  const bars = useMemo(() => buildBarcodeBars(barcodeSeed), [barcodeSeed]);
  const totalSvgWidth = useMemo(() => {
    const last = bars[bars.length - 1];
    return last ? last.x + last.w + 2 : 120;
  }, [bars]);

  const borderLineClass =
    config.writeInLineStyle === 'dashed'
      ? 'border-b-[1.5px] border-dashed border-neutral-500'
      : 'border-b-[1.5px] border-neutral-800';

  const brandWords = config.brandHeader.trim().split(/\s+/);
  const brandTop = brandWords[0] || 'THAI';
  const brandSub = brandWords.slice(1).join(' ');

  return (
    <div
      style={{
        borderRadius: `${config.borderRadiusMm}mm`,
      }}
      className={`w-full bg-white text-[#15181e] p-[5%] flex flex-col justify-between leading-tight font-sans select-none ${
        config.showCutBorder ? 'border border-neutral-300' : ''
      }`}
    >
      {/* Brand Header */}
      {config.showBrandHeader && (
        <div className="text-center pb-[4%] border-b border-neutral-200/80 mb-[4%]">
          <div className="text-[1.45em] font-extrabold tracking-wide text-[#243b6b] uppercase leading-none">
            {brandTop}
          </div>
          {brandSub && (
            <div className="text-[0.68em] font-semibold tracking-[0.22em] text-[#2c4a82] uppercase mt-[0.2em]">
              {brandSub}
            </div>
          )}
        </div>
      )}

      {/* Main Fields: รุ่น / สี / ไซส์ */}
      <div className="space-y-[5%]">
        {/* รุ่น (MODEL) */}
        <div>
          <div className="text-[0.65em] font-medium text-neutral-600">รุ่น (MODEL):</div>
          {config.modelName.trim() ? (
            <div className="text-[1.08em] font-extrabold tracking-tight text-black mt-[0.12em] break-words">
              {config.modelName.trim()}
            </div>
          ) : (
            <div className={`h-[1.35em] w-full mt-[0.15em] ${borderLineClass}`} />
          )}
        </div>

        {/* สี (COLOR) */}
        <div>
          <div className="text-[0.65em] font-medium text-neutral-600">สี (COLOR):</div>
          {config.colorName.trim() ? (
            <div className="text-[0.98em] font-bold text-[#1d222b] mt-[0.12em] break-words">
              {config.colorName.trim()}
            </div>
          ) : (
            <div className={`h-[1.35em] w-full mt-[0.15em] ${borderLineClass}`} />
          )}
        </div>

        {/* ไซส์ (SIZE) */}
        <div>
          <div className="text-[0.65em] font-medium text-neutral-600">ไซส์ (SIZE):</div>
          {config.sizeLabel.trim() ? (
            <div className="text-center text-[2.2em] font-black text-black tracking-tight leading-none py-[0.12em]">
              {config.sizeLabel.trim()}
            </div>
          ) : (
            <div className={`h-[1.8em] w-full mt-[0.15em] ${borderLineClass}`} />
          )}
        </div>
      </div>

      {/* Optional Barcode */}
      {config.showBarcode && (
        <div className="mt-[6%] pt-[3%] text-center">
          <svg
            viewBox={`0 0 ${totalSvgWidth} 36`}
            className="w-[88%] h-[2.1em] mx-auto block"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {bars.map((b, idx) => (
              <rect key={idx} x={b.x} y={0} width={b.w} height={36} fill="#000000" />
            ))}
          </svg>
          {config.barcodeDigits.trim() && (
            <div className="text-[0.72em] font-mono tracking-[0.16em] text-black mt-[0.18em]">
              {config.barcodeDigits.trim()}
            </div>
          )}
          {config.barcodeCaption.trim() && (
            <div className="text-[0.54em] font-medium text-neutral-700 mt-[0.18em] break-words">
              บาร์โค้ด (BARCODE): {config.barcodeCaption.trim()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
