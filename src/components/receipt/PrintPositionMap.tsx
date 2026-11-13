'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, BookmarkPlus, Move, RotateCcw } from 'lucide-react';
import type { PrintLayoutCalibration, ReceiptPaperSize } from '@/types/shirt';
import { FreeNumberInput } from './FreeNumberInput';

interface PrintPositionMapRenderContext {
  contentWidthMm: number;
  safeHeightMm: number;
  pxPerMm: number;
}

interface PrintPositionMapProps {
  paperSizes: ReceiptPaperSize[];
  selectedPaperSizeId: string;
  calibration: PrintLayoutCalibration;
  onChangeCalibration: (next: PrintLayoutCalibration) => void;
  onSelectPreset: (paperSizeId: string) => void;
  onSaveAsNewPreset?: (preset: ReceiptPaperSize, calibration: PrintLayoutCalibration) => void;
  title?: string;
  printerName?: string;
  renderContent?: (ctx: PrintPositionMapRenderContext) => React.ReactNode;
  children?: React.ReactNode;
}

export const PrintPositionMap: React.FC<PrintPositionMapProps> = ({
  paperSizes,
  selectedPaperSizeId,
  calibration,
  onChangeCalibration,
  onSelectPreset,
  onSaveAsNewPreset,
  title = 'Print Position Map & ไม้บรรทัดระยะขอบจริง (mm)',
  printerName,
  renderContent,
  children,
}) => {
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const previewMaxW = useMemo(() => {
    if (viewportWidth >= 1920) return 560;
    if (viewportWidth >= 1536) return 480;
    if (viewportWidth >= 1280) return 420;
    if (viewportWidth >= 1024) return 360;
    return 320;
  }, [viewportWidth]);

  const previewMaxH = useMemo(() => {
    if (viewportWidth >= 1920) return 720;
    if (viewportWidth >= 1536) return 640;
    if (viewportWidth >= 1280) return 560;
    if (viewportWidth >= 1024) return 480;
    return 420;
  }, [viewportWidth]);

  const [dragMode, setDragMode] = useState<
    'none' | 'move' | 'resize-e' | 'resize-w' | 'resize-s' | 'resize-n' | 'resize-se'
  >('none');
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    origOffsetX: number;
    origOffsetY: number;
    origWidthPct: number;
    origHeightPct: number;
  }>({
    clientX: 0,
    clientY: 0,
    origOffsetX: 0,
    origOffsetY: 0,
    origWidthPct: 100,
    origHeightPct: 100,
  });

  // Compute physical oriented dimensions in mm
  const isLandscape =
    calibration.orientation === 'landscape' && calibration.paperHeightMm !== null;
  const effWidthMm = Math.max(
    5,
    isLandscape && calibration.paperHeightMm
      ? calibration.paperHeightMm
      : calibration.paperWidthMm
  );
  const effHeightMm =
    calibration.paperHeightMm === null
      ? Math.max(80, Math.round(effWidthMm * 1.65))
      : Math.max(5, isLandscape ? calibration.paperWidthMm : calibration.paperHeightMm);

  // Convert mm -> screen px so paper sheet fits neatly with exact physical aspect ratio, responsive to screen
  const pxPerMm = useMemo(() => {
    const scaleX = previewMaxW / effWidthMm;
    const scaleY = previewMaxH / effHeightMm;
    return Math.min(scaleX, scaleY, 12);
  }, [effWidthMm, effHeightMm, previewMaxW, previewMaxH]);

  const sheetPxW = effWidthMm * pxPerMm;
  const sheetPxH = effHeightMm * pxPerMm;

  const safeW = Math.max(
    2,
    effWidthMm - calibration.marginLeftMm - calibration.marginRightMm
  );
  const safeH = Math.max(
    2,
    effHeightMm - calibration.marginTopMm - calibration.marginBottomMm
  );

  const contentHeightPct = calibration.contentHeightPct ?? 100;
  const contentWmm = +(safeW * (calibration.contentWidthPct / 100)).toFixed(1);
  const contentHmm = +(safeH * (contentHeightPct / 100)).toFixed(1);
  const actualStartXmm = +(calibration.marginLeftMm + calibration.offsetXMm).toFixed(1);
  const actualStartYmm = +(calibration.marginTopMm + calibration.offsetYMm).toFixed(1);
  const remainRightMm = +(effWidthMm - actualStartXmm - contentWmm).toFixed(1);

  // Ruler ticks (5mm intervals for small labels <= 60mm, otherwise 10mm intervals)
  const xTickStep = effWidthMm <= 60 ? 5 : 10;
  const xLabelStep = effWidthMm > 140 ? 20 : 10;
  const yTickStep = effHeightMm <= 60 ? 5 : 10;
  const yLabelStep = effHeightMm > 140 ? 20 : 10;
  const xTicks = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m <= effWidthMm; m += xTickStep) list.push(m);
    return list;
  }, [effWidthMm, xTickStep]);
  const yTicks = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m <= effHeightMm; m += yTickStep) list.push(m);
    return list;
  }, [effHeightMm, yTickStep]);

  const handlePointerDownMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragMode('move');
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origOffsetX: calibration.offsetXMm,
      origOffsetY: calibration.offsetYMm,
      origWidthPct: calibration.contentWidthPct,
      origHeightPct: calibration.contentHeightPct ?? 100,
    };
  };

  const handlePointerDownResize = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: 'resize-e' | 'resize-w' | 'resize-s' | 'resize-n' | 'resize-se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragMode(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origOffsetX: calibration.offsetXMm,
      origOffsetY: calibration.offsetYMm,
      origWidthPct: calibration.contentWidthPct,
      origHeightPct: calibration.contentHeightPct ?? 100,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragMode === 'none') return;
    const dxMm = (e.clientX - dragStartRef.current.clientX) / pxPerMm;
    const dyMm = (e.clientY - dragStartRef.current.clientY) / pxPerMm;

    if (dragMode === 'move') {
      const nextX = Math.round((dragStartRef.current.origOffsetX + dxMm) * 2) / 2;
      const nextY = Math.round((dragStartRef.current.origOffsetY + dyMm) * 2) / 2;
      onChangeCalibration({
        ...calibration,
        offsetXMm: Math.max(-40, Math.min(150, nextX)),
        offsetYMm: Math.max(-40, Math.min(200, nextY)),
      });
    } else if (dragMode === 'resize-e') {
      const deltaPct = (dxMm / safeW) * 100;
      const nextPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origWidthPct + deltaPct))
      );
      onChangeCalibration({
        ...calibration,
        contentWidthPct: nextPct,
      });
    } else if (dragMode === 'resize-w') {
      const deltaPct = (-dxMm / safeW) * 100;
      const nextPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origWidthPct + deltaPct))
      );
      const actualWidthDeltaMm = ((dragStartRef.current.origWidthPct - nextPct) / 100) * safeW;
      const nextX = Math.round((dragStartRef.current.origOffsetX + actualWidthDeltaMm) * 2) / 2;
      onChangeCalibration({
        ...calibration,
        offsetXMm: Math.max(-40, Math.min(150, nextX)),
        contentWidthPct: nextPct,
      });
    } else if (dragMode === 'resize-s') {
      const deltaPct = (dyMm / safeH) * 100;
      const nextPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origHeightPct + deltaPct))
      );
      onChangeCalibration({
        ...calibration,
        contentHeightPct: nextPct,
      });
    } else if (dragMode === 'resize-n') {
      const deltaPct = (-dyMm / safeH) * 100;
      const nextPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origHeightPct + deltaPct))
      );
      const actualHeightDeltaMm = ((dragStartRef.current.origHeightPct - nextPct) / 100) * safeH;
      const nextY = Math.round((dragStartRef.current.origOffsetY + actualHeightDeltaMm) * 2) / 2;
      onChangeCalibration({
        ...calibration,
        offsetYMm: Math.max(-40, Math.min(200, nextY)),
        contentHeightPct: nextPct,
      });
    } else if (dragMode === 'resize-se') {
      const deltaWPct = (dxMm / safeW) * 100;
      const deltaHPct = (dyMm / safeH) * 100;
      const nextWPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origWidthPct + deltaWPct))
      );
      const nextHPct = Math.round(
        Math.max(10, Math.min(200, dragStartRef.current.origHeightPct + deltaHPct))
      );
      onChangeCalibration({
        ...calibration,
        contentWidthPct: nextWPct,
        contentHeightPct: nextHPct,
      });
    }
  };

  const handlePointerUp = () => {
    setDragMode('none');
  };

  const handleSavePresetClick = () => {
    if (!onSaveAsNewPreset) return;
    const name =
      presetName.trim() ||
      `กำหนดเอง ${calibration.paperWidthMm}×${calibration.paperHeightMm ?? 'Auto'}mm`;
    const newPreset: ReceiptPaperSize = {
      id: `size-map-${Date.now()}`,
      name,
      widthMm: calibration.paperWidthMm,
      heightMm: calibration.paperHeightMm,
      marginMm: Math.round(
        (calibration.marginTopMm +
          calibration.marginRightMm +
          calibration.marginBottomMm +
          calibration.marginLeftMm) /
          4
      ),
      fontScale: +(Math.min(1.5, Math.max(0.6, calibration.contentWidthPct / 100))).toFixed(2),
      orientation: calibration.orientation,
      isPreset: false,
    };
    onSaveAsNewPreset(newPreset, calibration);
    setPresetName('');
    setShowSavePreset(false);
  };

  return (
    <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[#f7f1e8]">{title}</div>
          <div className="text-[11px] text-[#a99784]">
            ลากชิ้นงานบนแผ่นกระดาษเพื่อขยับตำแหน่ง X/Y และลากมุมขวาล่างเพื่อย่อ/ขยายได้อิสระ
            {printerName ? ` • เครื่องพิมพ์: ${printerName}` : ''}
          </div>
        </div>
        {onSaveAsNewPreset && (
          <button
            type="button"
            onClick={() => setShowSavePreset((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-[11px] font-semibold text-[#e8c170] flex items-center gap-1"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>บันทึกเป็น Preset</span>
          </button>
        )}
      </div>

      {showSavePreset && (
        <div className="flex flex-wrap gap-2 bg-[#120d0a] p-2.5 rounded-xl border border-[#3b2c21]">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="ตั้งชื่อ Preset เช่น บิลร้าน 75x120mm ขอบบน 5mm"
            className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-[#1a130e] border border-[#443326] text-xs text-[#faf5ee]"
          />
          <button
            type="button"
            onClick={handleSavePresetClick}
            className="px-3 py-1.5 rounded-lg bg-[#e8c170] text-[#1c1410] text-xs font-bold"
          >
            บันทึก
          </button>
        </div>
      )}

      {/* Visual Rulers + Interactive Paper Map */}
      <div className="rounded-xl bg-[#0e0a08] border border-[#2f231a] p-3 flex flex-col items-center overflow-x-auto">
        {/* Top Ruler + Sheet Wrapper */}
        <div className="relative pl-6 pt-6 pb-2 pr-2 select-none">
          {/* Top Millimeter Ruler */}
          <div
            style={{ width: `${sheetPxW}px`, left: '24px', top: '4px' }}
            className="absolute h-5 border-b border-[#5a4635] text-[9px] font-mono text-[#c8b6a2]"
          >
            {xTicks.map((mm) => (
              <div
                key={mm}
                style={{ left: `${mm * pxPerMm}px` }}
                className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
              >
                {mm % xLabelStep === 0 && <span className="leading-none mb-0.5">{mm}</span>}
                <div
                  className={`w-px bg-[#7a6049] ${mm % xLabelStep === 0 ? 'h-2' : 'h-1'}`}
                />
              </div>
            ))}
          </div>

          {/* Left Millimeter Ruler */}
          <div
            style={{ height: `${sheetPxH}px`, top: '24px', left: '2px' }}
            className="absolute w-5 border-r border-[#5a4635] text-[9px] font-mono text-[#c8b6a2]"
          >
            {yTicks.map((mm) => (
              <div
                key={mm}
                style={{ top: `${mm * pxPerMm}px` }}
                className="absolute right-0 flex items-center -translate-y-1/2"
              >
                {mm % yLabelStep === 0 && <span className="leading-none mr-0.5">{mm}</span>}
                <div
                  className={`h-px bg-[#7a6049] ${mm % yLabelStep === 0 ? 'w-2' : 'w-1'}`}
                />
              </div>
            ))}
          </div>

          {/* Physical Paper Sheet */}
          <div
            style={{
              width: `${sheetPxW}px`,
              height: `${sheetPxH}px`,
            }}
            className="relative bg-white shadow-2xl overflow-hidden border border-neutral-400"
          >
            {/* Shaded Non-Printable Margins Overlay */}
            <div
              style={{
                borderTopWidth: `${calibration.marginTopMm * pxPerMm}px`,
                borderRightWidth: `${calibration.marginRightMm * pxPerMm}px`,
                borderBottomWidth: `${calibration.marginBottomMm * pxPerMm}px`,
                borderLeftWidth: `${calibration.marginLeftMm * pxPerMm}px`,
              }}
              className="absolute inset-0 border-amber-500/20 pointer-events-none z-10"
            />

            {/* Dashed Safe Printable Area Box */}
            <div
              style={{
                top: `${calibration.marginTopMm * pxPerMm}px`,
                right: `${calibration.marginRightMm * pxPerMm}px`,
                bottom: `${calibration.marginBottomMm * pxPerMm}px`,
                left: `${calibration.marginLeftMm * pxPerMm}px`,
              }}
              className="absolute border border-dashed border-emerald-600/75 pointer-events-none z-10"
            >
              <span className="absolute -top-3.5 left-1 px-1 rounded bg-emerald-700/90 text-[8px] font-mono text-white">
                Safe {safeW.toFixed(0)}×{safeH.toFixed(0)}mm
              </span>
            </div>

            {/* Draggable & Resizable Content Box */}
            <div
              onPointerDown={handlePointerDownMove}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                left: `${(calibration.marginLeftMm + calibration.offsetXMm) * pxPerMm}px`,
                top: `${(calibration.marginTopMm + calibration.offsetYMm) * pxPerMm}px`,
                width: `${contentWmm * pxPerMm}px`,
                cursor: dragMode === 'move' ? 'grabbing' : 'grab',
              }}
              className="absolute z-20 ring-2 ring-sky-500/90 bg-white/95 group"
            >
              {/* Live Coordinate Mini Tag */}
              <div className="absolute -top-4 left-0 bg-sky-600 text-white text-[8px] font-mono px-1 rounded-t flex items-center gap-1 pointer-events-none whitespace-nowrap">
                <Move className="w-2.5 h-2.5" />
                <span>
                  X:{actualStartXmm}mm Y:{actualStartYmm}mm ({calibration.contentWidthPct}%)
                </span>
              </div>

              <div
                style={
                  renderContent
                    ? undefined
                    : { fontSize: `${Math.max(4, Math.min(contentWmm, contentHmm * 0.72) * 0.068 * pxPerMm)}px` }
                }
                className="w-full overflow-hidden pointer-events-none"
              >
                {renderContent
                  ? renderContent({
                      contentWidthMm: contentWmm,
                      safeHeightMm: contentHmm,
                      pxPerMm,
                    })
                  : children}
              </div>

              {/* Top Edge Resize Handle */}
              <div
                onPointerDown={(e) => handlePointerDownResize(e, 'resize-n')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="ลากเพื่อย่อ/ขยายจากด้านบน"
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 rounded-full bg-sky-500 border border-white cursor-ns-resize shadow opacity-90 hover:opacity-100"
              />
              {/* Bottom Edge Resize Handle */}
              <div
                onPointerDown={(e) => handlePointerDownResize(e, 'resize-s')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="ลากเพื่อย่อ/ขยายจากด้านล่าง"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 rounded-full bg-sky-500 border border-white cursor-ns-resize shadow opacity-90 hover:opacity-100"
              />
              {/* Left Edge Resize Handle */}
              <div
                onPointerDown={(e) => handlePointerDownResize(e, 'resize-w')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="ลากเพื่อย่อ/ขยายจากด้านซ้าย"
                className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 rounded-full bg-sky-500 border border-white cursor-ew-resize shadow opacity-90 hover:opacity-100"
              />
              {/* Right Edge Resize Handle */}
              <div
                onPointerDown={(e) => handlePointerDownResize(e, 'resize-e')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="ลากเพื่อย่อ/ขยายจากด้านขวา"
                className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 rounded-full bg-sky-500 border border-white cursor-ew-resize shadow opacity-90 hover:opacity-100"
              />
              {/* Bottom-Right Corner Resize Handle */}
              <div
                onPointerDown={(e) => handlePointerDownResize(e, 'resize-se')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="ลากเพื่อปรับขนาดกว้าง-สูง (%)"
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm bg-sky-600 border border-white cursor-nwse-resize shadow"
              />
            </div>
          </div>
        </div>

        {/* Exact Physical Distances Readout */}
        <div className="w-full mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
          <div className="rounded-lg bg-[#16100c] border border-[#2f231a] px-2 py-1 text-[#d6c8b6]">
            กระดาษ: <strong className="text-[#e8c170]">{effWidthMm}×{calibration.paperHeightMm ?? 'Auto'}mm</strong>
          </div>
          <div className="rounded-lg bg-[#16100c] border border-[#2f231a] px-2 py-1 text-[#d6c8b6]">
            ขอบจริง ซ/บ: <strong className="text-sky-300">{actualStartXmm}/{actualStartYmm}mm</strong>
          </div>
          <div className="rounded-lg bg-[#16100c] border border-[#2f231a] px-2 py-1 text-[#d6c8b6]">
            ความกว้างพิมพ์: <strong className="text-emerald-300">{contentWmm}mm</strong>
          </div>
          <div className="rounded-lg bg-[#16100c] border border-[#2f231a] px-2 py-1 text-[#d6c8b6]">
            เหลือขวา: <strong className={remainRightMm < 0 ? 'text-red-400' : 'text-[#e8c170]'}>{remainRightMm}mm</strong>
          </div>
        </div>
      </div>

      {/* Free Dimensions & Margins & Position Controls */}
      <div className="space-y-2.5 text-xs">
        {/* Preset + Orientation + Paper W/H */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2">
            <label className="block text-[10px] text-[#a99784] mb-0.5">
              โหลดจาก Preset
            </label>
            <select
              value={selectedPaperSizeId}
              onChange={(e) => onSelectPreset(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
            >
              {paperSizes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">
              กว้าง (mm)
            </label>
            <FreeNumberInput
              min={5}
              max={400}
              allowDecimal
              step={1}
              value={calibration.paperWidthMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  paperWidthMm: nextVal,
                })
              }
              aria-label="ความกว้างกระดาษ mm"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-[#a99784]">สูง (mm)</label>
              <label className="flex items-center gap-1 text-[10px] text-[#e8c170] cursor-pointer">
                <input
                  type="checkbox"
                  checked={calibration.paperHeightMm === null}
                  onChange={(e) =>
                    onChangeCalibration({
                      ...calibration,
                      paperHeightMm: e.target.checked ? null : 40,
                    })
                  }
                />
                <span>Roll</span>
              </label>
            </div>
            <FreeNumberInput
              min={5}
              max={600}
              allowDecimal
              step={1}
              disabled={calibration.paperHeightMm === null}
              value={calibration.paperHeightMm}
              placeholder="Auto"
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  paperHeightMm: nextVal,
                })
              }
              aria-label="ความสูงกระดาษ mm"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] disabled:opacity-45 font-mono text-xs text-[#faf5ee]"
            />
          </div>
        </div>

        {/* 4 Independent Margins */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">ขอบบน (mm)</label>
            <FreeNumberInput
              min={0}
              max={80}
              allowDecimal
              step={0.5}
              value={calibration.marginTopMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  marginTopMm: nextVal,
                })
              }
              aria-label="ขอบบน mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">ขอบขวา (mm)</label>
            <FreeNumberInput
              min={0}
              max={80}
              allowDecimal
              step={0.5}
              value={calibration.marginRightMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  marginRightMm: nextVal,
                })
              }
              aria-label="ขอบขวา mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">ขอบล่าง (mm)</label>
            <FreeNumberInput
              min={0}
              max={80}
              allowDecimal
              step={0.5}
              value={calibration.marginBottomMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  marginBottomMm: nextVal,
                })
              }
              aria-label="ขอบล่าง mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">ขอบซ้าย (mm)</label>
            <FreeNumberInput
              min={0}
              max={80}
              allowDecimal
              step={0.5}
              value={calibration.marginLeftMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  marginLeftMm: nextVal,
                })
              }
              aria-label="ขอบซ้าย mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
        </div>

        {/* Content Offset X, Y, Width %, Orientation & Quick Actions */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">เลื่อน X (mm)</label>
            <FreeNumberInput
              min={-60}
              max={200}
              allowDecimal
              step={0.5}
              value={calibration.offsetXMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  offsetXMm: nextVal,
                })
              }
              aria-label="เลื่อน X mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">เลื่อน Y (mm)</label>
            <FreeNumberInput
              min={-60}
              max={250}
              allowDecimal
              step={0.5}
              value={calibration.offsetYMm}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  offsetYMm: nextVal,
                })
              }
              aria-label="เลื่อน Y mm"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[#a99784] mb-0.5">ขนาดพิมพ์ (%)</label>
            <FreeNumberInput
              min={10}
              max={200}
              step={5}
              value={calibration.contentWidthPct}
              onChangeNumber={(nextVal) =>
                onChangeCalibration({
                  ...calibration,
                  contentWidthPct: nextVal,
                })
              }
              aria-label="ขนาดพิมพ์ เปอร์เซ็นต์"
              className="w-full px-2 py-1 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
            />
          </div>
          <div className="col-span-3 sm:col-span-1 flex gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChangeCalibration({
                  ...calibration,
                  offsetXMm: +(Math.max(0, (safeW - contentWmm) / 2)).toFixed(1),
                  offsetYMm: 0,
                })
              }
              title="จัดกลางแนวนอน"
              className="flex-1 px-2 py-1.5 rounded-lg bg-[#120d0a] hover:bg-[#291e16] border border-[#3b2c21] text-[11px] text-[#d6c8b6] flex items-center justify-center gap-1"
            >
              <AlignCenter className="w-3 h-3" />
              <span>กลาง</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeCalibration({
                  ...calibration,
                  offsetXMm: 0,
                  offsetYMm: 0,
                  contentWidthPct: 100,
                  contentHeightPct: 100,
                })
              }
              title="รีเซ็ตตำแหน่ง 0,0 (100%)"
              className="px-2 py-1.5 rounded-lg bg-[#120d0a] hover:bg-[#291e16] border border-[#3b2c21] text-[11px] text-[#d6c8b6] flex items-center justify-center"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
