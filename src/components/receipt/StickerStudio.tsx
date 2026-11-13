'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Eraser,
  FolderPlus,
  Grid,
  Printer,
  Save,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  applyFreePrintPageStyle,
  calibrationFromPaperSize,
  formatColorDisplayName,
  loadLayoutCalibrations,
  loadStickerSets,
  saveLayoutCalibrations,
  saveStickerSets,
} from '@/lib/storage';
import type {
  DetectedPrinterInfo,
  PrintLayoutCalibration,
  ReceiptPaperSize,
  Shirt,
  ShopProfile,
  StickerConfig,
  StickerSet,
} from '@/types/shirt';
import { FreeNumberInput } from './FreeNumberInput';
import { PrinterSelectorCard } from './PrinterSelectorCard';
import { PrintPositionMap } from './PrintPositionMap';
import { StickerLabelPreview } from './StickerLabelPreview';

interface StickerStudioProps {
  shirts: Shirt[];
  paperSizes: ReceiptPaperSize[];
  shopProfile: ShopProfile;
  onSavePaperSizes?: (sizes: ReceiptPaperSize[]) => void;
}

const STICKER_QUICK_SIZES: { label: string; w: number; h: number; m: number }[] = [
  { label: 'สติกเกอร์เล็ก 30×40mm', w: 30, h: 40, m: 1.5 },
  { label: 'สติกเกอร์ 40×60mm', w: 40, h: 60, m: 2 },
  { label: 'สติกเกอร์เสื้อ 50×70mm', w: 50, h: 70, m: 2 },
  { label: 'สติกเกอร์กลาง 58×80mm', w: 58, h: 80, m: 2 },
  { label: 'A4 แผ่นรวม (210×297mm)', w: 210, h: 297, m: 8 },
];

const QUICK_SIZE_CHIPS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Freesize'];
const QUICK_COLOR_CHIPS = [
  'กรมท่า (NAVY BLUE)',
  'ดำ (BLACK)',
  'ขาว (WHITE)',
  'ครีมงาช้าง (IVORY)',
  'เขียวไพร (FOREST GREEN)',
  'เบอร์กันดี (BURGUNDY)',
];
const BATCH_PRESETS = [1, 10, 50, 100, 500, 1000];

export const StickerStudio: React.FC<StickerStudioProps> = ({
  shirts,
  paperSizes,
  shopProfile,
  onSavePaperSizes,
}) => {
  const [stickerSets, setStickerSets] = useState<StickerSet[]>(() => loadStickerSets());
  const [selectedSetId, setSelectedSetId] = useState('');
  const [setNameInput, setSetNameInput] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState<DetectedPrinterInfo | null>(null);
  const [savedCalibrations, setSavedCalibrations] = useState<
    Record<string, PrintLayoutCalibration>
  >(() => loadLayoutCalibrations());

  const [selectedPaperSizeId, setSelectedPaperSizeId] = useState<string>(
    paperSizes[0]?.id ?? 'size-58mm'
  );
  const [calibration, setCalibration] = useState<PrintLayoutCalibration>({
    paperWidthMm: 50,
    paperHeightMm: 70,
    orientation: 'portrait',
    marginTopMm: 2,
    marginRightMm: 2,
    marginBottomMm: 2,
    marginLeftMm: 2,
    offsetXMm: 0,
    offsetYMm: 0,
    contentWidthPct: 100,
  });

  const [config, setConfig] = useState<StickerConfig>(() => ({
    brandHeader: shopProfile.shopName || '',
    showBrandHeader: false,
    modelName: shirts[0]?.name || '111036',
    colorName: shirts[0] ? formatColorDisplayName(shirts[0].color) : 'Pink',
    sizeLabel: 'L',
    writeInLineStyle: 'solid',
    showBarcode: true,
    barcodeDigits: '8 851234 567890',
    barcodeCaption: `${shirts[0]?.sku || '111036'}-L`,
    borderRadiusMm: 2,
    showCutBorder: true,
    fontScalePct: 100,
    detailDensity: 'auto',
  }));

  const [copies, setCopies] = useState<number>(10);
  const [printLayoutMode, setPrintLayoutMode] = useState<'single' | 'grid'>('single');
  const [gridColumns, setGridColumns] = useState<number>(6);
  const [gridGapMm, setGridGapMm] = useState<number>(3);
  const [stickerBoxWidthMm, setStickerBoxWidthMm] = useState<number>(30);
  const [stickerBoxHeightMm, setStickerBoxHeightMm] = useState<number>(40);
  const [activeBatchCopies, setActiveBatchCopies] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  // 1. Fetch presets & latest stickers from Google Sheets on mount so multiple devices sync seamlessly
  useEffect(() => {
    let isCancelled = false;
    const fetchCrossDevicePresets = async () => {
      try {
        const res = await fetch('/api/stickers/presets');
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.presets) && data.presets.length > 0) {
          if (isCancelled) return;
          const remotePresets = data.presets as StickerSet[];
          setStickerSets((prev) => {
            // Merge remote presets with local presets (remote takes precedence by id)
            const map = new Map<string, StickerSet>();
            for (const p of prev) map.set(p.id, p);
            for (const r of remotePresets) map.set(r.id, r);
            const merged = Array.from(map.values());
            saveStickerSets(merged);
            return merged;
          });

          // Automatically select the most recently updated preset so all devices mirror the active sticker
          const latestPreset = remotePresets[0];
          if (latestPreset) {
            setSelectedSetId(latestPreset.id);
            setSetNameInput(latestPreset.name);
            setConfig({
              ...latestPreset.config,
              showBrandHeader: false,
            });
            if (latestPreset.calibration) {
              setCalibration({
                ...latestPreset.calibration,
              });
            }
            if (latestPreset.defaultCopies) {
              setCopies(latestPreset.defaultCopies);
            }
            if (latestPreset.paperSizeId) {
              setSelectedPaperSizeId(latestPreset.paperSizeId);
            }
          }
        }
      } catch (err) {
        console.warn('Unable to sync presets from Google Sheets on mount:', err);
      }
    };

    void fetchCrossDevicePresets();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAfterPrint = () => setActiveBatchCopies(0);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const patchConfig = (patch: Partial<StickerConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectPaperPreset = (paperSizeId: string) => {
    setSelectedPaperSizeId(paperSizeId);
    const found = paperSizes.find((p) => p.id === paperSizeId) ?? paperSizes[0];
    if (found) {
      setCalibration(calibrationFromPaperSize(found, savedCalibrations));
    }
  };

  const handleApplyStickerQuickSize = (w: number, h: number, m: number, isA4Grid: boolean) => {
    setCalibration({
      paperWidthMm: w,
      paperHeightMm: h,
      orientation: 'portrait',
      marginTopMm: m,
      marginRightMm: m,
      marginBottomMm: m,
      marginLeftMm: m,
      offsetXMm: 0,
      offsetYMm: 0,
      contentWidthPct: 100,
    });
    setPrintLayoutMode(isA4Grid ? 'grid' : 'single');
  };

  const handleSaveAsNewPreset = (
    newPreset: ReceiptPaperSize,
    cal: PrintLayoutCalibration
  ) => {
    const nextMap = { ...savedCalibrations, [newPreset.id]: { ...cal } };
    setSavedCalibrations(nextMap);
    saveLayoutCalibrations(nextMap);
    if (onSavePaperSizes) {
      onSavePaperSizes([...paperSizes, newPreset]);
    }
    setSelectedPaperSizeId(newPreset.id);
    setStatusText(`บันทึกขนาดสติกเกอร์ "${newPreset.name}" เป็น Preset แล้ว`);
  };

  const handleCreateSet = () => {
    const name =
      setNameInput.trim() ||
      `สติกเกอร์ ${config.modelName.trim() || 'เขียนเอง'} ${config.sizeLabel || ''}`.trim();
    const newSet: StickerSet = {
      id: `stk-${Date.now()}`,
      name,
      config: { ...config, showBrandHeader: false },
      paperSizeId: selectedPaperSizeId,
      calibration: { ...calibration },
      defaultCopies: Math.max(1, copies),
      updatedAt: new Date().toISOString(),
    };
    const next = [newSet, ...stickerSets];
    setStickerSets(next);
    saveStickerSets(next);
    setSelectedSetId(newSet.id);
    setSetNameInput(newSet.name);
    setStatusText(`บันทึก Preset สติกเกอร์ "${newSet.name}" เรียบร้อยแล้ว`);

    // Sync to Google Sheets automatically (both to Preset tab and Stickers history)
    void (async () => {
      try {
        await Promise.allSettled([
          fetch('/api/stickers/presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSet),
          }),
          fetch('/api/stickers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: newSet.id,
              modelName: config.modelName,
              colorName: config.colorName,
              sizeLabel: config.sizeLabel,
              showBarcode: config.showBarcode,
              barcodeDigits: config.barcodeDigits,
              barcodeCaption: config.barcodeCaption,
              paperWidthMm: calibration.paperWidthMm,
              paperHeightMm: calibration.paperHeightMm,
              copies: Math.max(1, copies),
              fontScalePct: config.fontScalePct ?? 100,
              presetName: newSet.name,
              createdAt: newSet.updatedAt,
            }),
          }),
        ]);
        setStatusText(`บันทึก Preset "${newSet.name}" และส่งลง Google Sheet เรียบร้อยแล้ว`);
      } catch (err) {
        console.warn('Google Sheets sync error:', err);
      }
    })();
  };

  const handleUpdateSet = () => {
    if (!selectedSetId) return;
    const name = setNameInput.trim() || 'Preset สติกเกอร์';
    const next = stickerSets.map((s) =>
      s.id === selectedSetId
        ? {
            ...s,
            name,
            config: { ...config, showBrandHeader: false },
            paperSizeId: selectedPaperSizeId,
            calibration: { ...calibration },
            defaultCopies: Math.max(1, copies),
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    setStickerSets(next);
    saveStickerSets(next);
    setStatusText(`อัปเดต Preset สติกเกอร์ "${name}" แล้ว`);

    // Sync updated preset to Google Sheets (both to Preset tab and Stickers log)
    const updatedItem = next.find((s) => s.id === selectedSetId);
    void (async () => {
      try {
        await Promise.allSettled([
          updatedItem
            ? fetch('/api/stickers/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem),
              })
            : Promise.resolve(),
          fetch('/api/stickers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selectedSetId,
              modelName: config.modelName,
              colorName: config.colorName,
              sizeLabel: config.sizeLabel,
              showBarcode: config.showBarcode,
              barcodeDigits: config.barcodeDigits,
              barcodeCaption: config.barcodeCaption,
              paperWidthMm: calibration.paperWidthMm,
              paperHeightMm: calibration.paperHeightMm,
              copies: Math.max(1, copies),
              fontScalePct: config.fontScalePct ?? 100,
              presetName: name,
              createdAt: new Date().toISOString(),
            }),
          }),
        ]);
        setStatusText(`อัปเดต Preset "${name}" และส่งลง Google Sheet เรียบร้อยแล้ว`);
      } catch (err) {
        console.warn('Google Sheets sync error:', err);
      }
    })();
  };

  const handleSelectSet = (setItem: StickerSet) => {
    setSelectedSetId(setItem.id);
    setSetNameInput(setItem.name);
    setConfig({ ...setItem.config, showBrandHeader: false });
    setSelectedPaperSizeId(setItem.paperSizeId);
    setCalibration({ ...setItem.calibration });
    setCopies(Math.max(1, setItem.defaultCopies || 1));
    setStatusText(`โหลด Preset "${setItem.name}" แล้ว`);
  };

  const handleDeleteSet = (id: string) => {
    const next = stickerSets.filter((s) => s.id !== id);
    setStickerSets(next);
    saveStickerSets(next);
    if (selectedSetId === id) {
      setSelectedSetId('');
      setSetNameInput('');
    }
    setStatusText('ลบ Preset สติกเกอร์แล้ว');

    void (async () => {
      try {
        await Promise.allSettled([
          fetch(`/api/stickers/presets?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }),
          fetch(`/api/stickers?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }),
        ]);
      } catch (err) {
        console.warn('Google Sheets delete error:', err);
      }
    })();
  };

  const handlePrintStickers = () => {
    const safeCopies = Math.min(2000, Math.max(1, Math.floor(copies) || 1));
    applyFreePrintPageStyle(calibration);
    setActiveBatchCopies(safeCopies);
    setStatusText(`กำลังพิมพ์สติกเกอร์ ${safeCopies.toLocaleString()} ดวง...`);

    // บันทึกลง Google Sheet ประวัติการพิมพ์ด้วย
    void (async () => {
      try {
        await fetch('/api/stickers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `print-${Date.now()}`,
            modelName: config.modelName,
            colorName: config.colorName,
            sizeLabel: config.sizeLabel,
            showBarcode: config.showBarcode,
            barcodeDigits: config.barcodeDigits,
            barcodeCaption: config.barcodeCaption,
            paperWidthMm: calibration.paperWidthMm,
            paperHeightMm: calibration.paperHeightMm,
            copies: safeCopies,
            fontScalePct: config.fontScalePct ?? 100,
            presetName: setNameInput.trim() || 'พิมพ์ทันที',
            createdAt: new Date().toISOString(),
            notes: 'Printed',
          }),
        });
      } catch (err) {
        console.warn('Print logging to sheets error:', err);
      }
    })();

    // Small delay to ensure React state (activeBatchCopies) is committed to DOM before triggering print dialog
    setTimeout(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    }, 150);
  };

  // Compute grid fit metrics for multi-up A4/A5 sheet mode and Map preview
  const gridFitStats = useMemo(() => {
    const safeW = Math.max(
      10,
      calibration.paperWidthMm - calibration.marginLeftMm - calibration.marginRightMm
    );
    const safeH = Math.max(
      10,
      (calibration.paperHeightMm ?? 297) -
        calibration.marginTopMm -
        calibration.marginBottomMm
    );
    const cellW = Math.max(8, stickerBoxWidthMm);
    const cellH = Math.max(8, stickerBoxHeightMm);
    const fitCols = Math.max(1, Math.floor((safeW + gridGapMm) / (cellW + gridGapMm)));
    const cols = Math.max(1, Math.min(gridColumns, fitCols));
    const rowsPerPage = Math.max(1, Math.floor((safeH + gridGapMm) / (cellH + gridGapMm)));
    const perPage = Math.max(1, rowsPerPage * cols);
    return { cols, rowsPerPage, perPage };
  }, [calibration, stickerBoxWidthMm, stickerBoxHeightMm, gridGapMm, gridColumns]);

  // Chunk into pages when printing A4 multi-sticker grid
  const gridPages = useMemo(() => {
    if (activeBatchCopies <= 0 || printLayoutMode !== 'grid') return [];
    const { perPage } = gridFitStats;
    const pages: number[][] = [];
    for (let i = 0; i < activeBatchCopies; i += perPage) {
      pages.push(
        Array.from({ length: Math.min(perPage, activeBatchCopies - i) }, (_, j) => i + j)
      );
    }
    return pages;
  }, [activeBatchCopies, printLayoutMode, gridFitStats]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Sticker Fields + Blank Write-In Options + Sets + Printer + Batch */}
      <div className="lg:col-span-6 space-y-4">
        {statusText && (
          <div className="rounded-xl border border-[#e8c170]/40 bg-[#e8c170]/10 px-4 py-2 text-xs text-[#f6dc9b]">
            {statusText}
          </div>
        )}

        {/* 1. Sticker Content: รุ่น / สี / ไซส์ (Clean Large UI, Scales with Screen) */}
        <div className="rounded-2xl border border-[#4a3628] bg-[#1a130e] p-5 sm:p-6 xl:p-8 space-y-5 xl:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3a2a1f] pb-3">
            <div className="flex items-center gap-2.5">
              <Tag className="w-5 h-5 xl:w-6 xl:h-6 text-[#e8c170]" />
              <div className="text-base sm:text-lg xl:text-xl font-bold text-[#f7f1e8]">
                ข้อมูลสติกเกอร์ (รุ่น • สี • ไซส์)
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                patchConfig({
                  modelName: '',
                  colorName: '',
                  sizeLabel: '',
                  barcodeDigits: '',
                  barcodeCaption: '',
                })
              }
              className="px-3 py-1.5 xl:px-4 xl:py-2 rounded-xl bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-xs xl:text-sm font-semibold text-[#e8c170] flex items-center gap-1.5 transition-colors"
            >
              <Eraser className="w-4 h-4 xl:w-5 xl:h-5" />
              <span>เว้นว่างทั้งหมด (ไว้เขียนมือ)</span>
            </button>
          </div>

          {/* รุ่น (Model) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm sm:text-base xl:text-lg font-bold text-[#f5efe6]">
                รุ่น (MODEL)
              </label>
              {config.modelName && (
                <button
                  type="button"
                  onClick={() => patchConfig({ modelName: '' })}
                  className="text-xs sm:text-sm text-[#e8c170] hover:underline"
                >
                  เว้นว่างไว้เขียนเอง
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.modelName}
              onChange={(e) => patchConfig({ modelName: e.target.value })}
              placeholder="พิมพ์ชื่อรุ่น เช่น 1103 หรือปล่อยว่างเพื่อขีดเส้นเขียน"
              className="w-full px-4 py-3 xl:py-4 rounded-xl bg-[#120d0a] border border-[#523d2e] text-base sm:text-lg xl:text-xl font-semibold text-[#ffffff] placeholder:text-[#786656] focus:border-[#e8c170] focus:outline-none transition-colors"
            />
          </div>

          {/* สี (Color) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm sm:text-base xl:text-lg font-bold text-[#f5efe6]">
                สี (COLOR)
              </label>
              {config.colorName && (
                <button
                  type="button"
                  onClick={() => patchConfig({ colorName: '' })}
                  className="text-xs sm:text-sm text-[#e8c170] hover:underline"
                >
                  เว้นว่างไว้เขียนเอง
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.colorName}
              onChange={(e) => patchConfig({ colorName: e.target.value })}
              placeholder="พิมพ์ชื่อสี หรือเลือกปุ่มด้านล่าง"
              className="w-full px-4 py-3 xl:py-4 rounded-xl bg-[#120d0a] border border-[#523d2e] text-base sm:text-lg xl:text-xl font-semibold text-[#ffffff] placeholder:text-[#786656] focus:border-[#e8c170] focus:outline-none transition-colors"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_COLOR_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patchConfig({ colorName: c })}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border text-xs sm:text-sm xl:text-base font-semibold transition-all ${
                    config.colorName === c
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold shadow-md scale-105'
                      : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ไซส์ (Size) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-sm sm:text-base xl:text-lg font-bold text-[#f5efe6]">
                ไซส์ (SIZE)
              </label>
              <button
                type="button"
                onClick={() => patchConfig({ sizeLabel: '' })}
                className="text-xs sm:text-sm text-[#e8c170] hover:underline"
              >
                เว้นว่างไว้เขียนเอง
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {QUICK_SIZE_CHIPS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => patchConfig({ sizeLabel: sz })}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border text-sm sm:text-base xl:text-lg font-bold transition-all ${
                    config.sizeLabel === sz
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] scale-105 shadow-md'
                      : 'bg-[#120d0a] text-[#cfc2b2] border-[#3b2c21] hover:border-[#6a503b]'
                  }`}
                >
                  {sz}
                </button>
              ))}
              <input
                type="text"
                value={config.sizeLabel}
                onChange={(e) => patchConfig({ sizeLabel: e.target.value })}
                placeholder="พิมพ์ไซส์เอง"
                className="w-32 sm:w-36 px-3.5 py-2 sm:py-2.5 rounded-xl bg-[#120d0a] border border-[#523d2e] text-sm sm:text-base xl:text-lg font-bold text-[#ffffff] placeholder:text-[#786656] text-center"
              />
            </div>
          </div>

          {/* Barcode Option */}
          <div className="pt-3 border-t border-[#3a2a1f] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2.5 text-sm sm:text-base font-medium text-[#f5efe6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBarcode}
                  onChange={(e) => patchConfig({ showBarcode: e.target.checked })}
                  className="w-4 h-4 xl:w-5 xl:h-5 rounded accent-[#e8c170]"
                />
                <span>แสดงแถบบาร์โค้ด</span>
              </label>
              {config.showBarcode && (config.barcodeDigits || config.barcodeCaption) && (
                <button
                  type="button"
                  onClick={() => patchConfig({ barcodeDigits: '', barcodeCaption: '' })}
                  className="text-xs sm:text-sm text-[#e8c170] hover:underline"
                >
                  เว้นว่างไว้เขียนเอง
                </button>
              )}
            </div>
            {config.showBarcode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={config.barcodeDigits}
                  onChange={(e) => patchConfig({ barcodeDigits: e.target.value })}
                  placeholder="เลขบาร์โค้ด เช่น 8 851234 567890"
                  className="w-full px-3.5 py-2.5 xl:py-3.5 rounded-xl bg-[#120d0a] border border-[#523d2e] font-mono text-sm sm:text-base text-[#faf5ee]"
                />
                <input
                  type="text"
                  value={config.barcodeCaption}
                  onChange={(e) => patchConfig({ barcodeCaption: e.target.value })}
                  placeholder="รหัสข้อความกำกับ เช่น 1103-XL"
                  className="w-full px-3.5 py-2.5 xl:py-3.5 rounded-xl bg-[#120d0a] border border-[#523d2e] text-sm sm:text-base text-[#faf5ee]"
                />
              </div>
            )}
          </div>

          {/* Text Scaling Slider */}
          <div className="pt-3 border-t border-[#3a2a1f] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm xl:text-base font-semibold text-[#d6c8b6]">
              ขยายขนาดตัวอักษรบนสติกเกอร์
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={60}
                max={150}
                step={5}
                value={config.fontScalePct ?? 100}
                onChange={(e) => patchConfig({ fontScalePct: Number(e.target.value) || 100 })}
                className="w-36 sm:w-52 accent-[#e8c170]"
              />
              <span className="font-mono text-xs sm:text-sm xl:text-base font-bold text-[#e8c170] w-12 sm:w-16 text-right">
                {config.fontScalePct ?? 100}%
              </span>
            </div>
          </div>
        </div>

        {/* 2. บันทึก Preset สติกเกอร์ (ขนาดกระดาษ + ข้อมูลที่กรอก รวมเป็น Preset เดียวกัน) */}
        <div className="rounded-2xl border border-[#e8c170]/40 bg-[#1a130e] p-5 sm:p-6 xl:p-7 space-y-3.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-base sm:text-lg xl:text-xl font-bold text-[#f7f1e8] flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 xl:w-6 xl:h-6 text-[#e8c170]" />
                <span>2. บันทึก Preset (ขนาดกระดาษ + ข้อมูลสติกเกอร์)</span>
              </div>
              <p className="text-xs sm:text-sm text-[#a99784] mt-0.5">
                บันทึกทั้งขนาดกระดาษ ระยะขอบ และข้อมูลรุ่น/สี/ไซส์ รวมไว้ใน Preset เดียวกัน และซิงก์ข้ามเครื่องผ่าน Google Sheet
              </p>
            </div>
            <span className="text-xs sm:text-sm font-mono text-[#e8c170] bg-[#291e16] px-3 py-1.5 rounded-lg border border-[#543e2d]">
              {stickerSets.length} Preset ในระบบ
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <input
              type="text"
              value={setNameInput}
              onChange={(e) => setSetNameInput(e.target.value)}
              placeholder="ตั้งชื่อ Preset เช่น สติกเกอร์ 50x70 รุ่น 1103 สีกรมท่า"
              className="flex-1 min-w-[220px] px-4 py-2.5 xl:py-3.5 rounded-xl bg-[#120d0a] border border-[#523d2e] text-sm sm:text-base text-[#ffffff] font-medium placeholder:text-[#786656] focus:border-[#e8c170] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCreateSet}
              className="px-4 py-2.5 xl:px-5 xl:py-3.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-sm sm:text-base font-bold flex items-center gap-1.5 shadow transition-transform active:scale-95"
            >
              <FolderPlus className="w-4 h-4 xl:w-5 xl:h-5" />
              <span>บันทึกเป็น Preset ใหม่</span>
            </button>
            {selectedSetId && (
              <button
                type="button"
                onClick={handleUpdateSet}
                className="px-4 py-2.5 xl:px-5 xl:py-3.5 rounded-xl bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-[#f5da98] text-sm sm:text-base font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4 xl:w-5 xl:h-5" />
                <span>บันทึกทับ Preset เดิม</span>
              </button>
            )}
          </div>

          {stickerSets.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#3a2a1f]">
              <div className="text-xs sm:text-sm font-semibold text-[#c8b7a4]">
                เลือก Preset ที่บันทึกไว้ (ใช้งานร่วมกันได้ทุกเครื่อง):
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {stickerSets.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm transition-all ${
                      selectedSetId === s.id
                        ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f7e1a8] font-bold shadow-md scale-102'
                        : 'bg-[#120d0a] border-[#3b2c21] text-[#d6c8b6] hover:border-[#6a503b]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSet(s)}
                      className="hover:underline flex items-center gap-1.5 text-left"
                    >
                      <span>{s.name}</span>
                      <span className="text-[11px] sm:text-xs opacity-75 font-mono">
                        ({s.calibration?.paperWidthMm}×{s.calibration?.paperHeightMm ?? 'Auto'}mm)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSet(s.id)}
                      className="text-red-300/70 hover:text-red-300 p-0.5 rounded hover:bg-red-950/30 transition-colors"
                      title="ลบ Preset นี้"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Printers Info */}
        <PrinterSelectorCard
          paperSizes={paperSizes}
          selectedPrinterId={selectedPrinter?.id}
          activePaperSizeId={selectedPaperSizeId}
          onSelectPrinter={setSelectedPrinter}
          onApplyMappedPaperSize={handleSelectPaperPreset}
        />

        {/* 4. Batch Sticker Printing (Roll vs Multi-Up A4 Grid) */}
        <div className="rounded-2xl border border-[#e8c170]/35 bg-[#1a130e] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-[#f7f1e8]">
              3. ขนาดสติกเกอร์ด่วน &amp; พิมพ์หลายดวงพร้อมกัน (สูงสุด 2,000 ดวง)
            </div>
          </div>

          {/* Quick Sticker Size Chips */}
          <div className="flex flex-wrap gap-2">
            {STICKER_QUICK_SIZES.map((qs) => (
              <button
                key={qs.label}
                type="button"
                onClick={() =>
                  handleApplyStickerQuickSize(qs.w, qs.h, qs.m, qs.w === 210)
                }
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                  calibration.paperWidthMm === qs.w && calibration.paperHeightMm === qs.h
                    ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold shadow-md scale-102'
                    : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                }`}
              >
                {qs.label}
              </button>
            ))}
          </div>

          {/* Single Roll vs Multi-Up Grid Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPrintLayoutMode('single')}
              className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                printLayoutMode === 'single'
                  ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f5da98]'
                  : 'bg-[#120d0a] border-[#3b2c21] text-[#cfc2b2] hover:border-[#6a503b]'
              }`}
            >
              เครื่องพิมพ์สติกเกอร์ (1 ดวง/แผ่น)
            </button>
            <button
              type="button"
              onClick={() => setPrintLayoutMode('grid')}
              className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                printLayoutMode === 'grid'
                  ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f5da98]'
                  : 'bg-[#120d0a] border-[#3b2c21] text-[#cfc2b2] hover:border-[#6a503b]'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>เรียงหลายดวงในแผ่น A4/A5</span>
            </button>
          </div>

          {printLayoutMode === 'grid' && (
            <div className="bg-[#120d0a] p-2.5 rounded-xl border border-[#32241a] space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-[#a99784]">กว้างสติกเกอร์ (mm)</label>
                  <FreeNumberInput
                    min={8}
                    max={150}
                    allowDecimal
                    step={1}
                    value={stickerBoxWidthMm}
                    onChangeNumber={setStickerBoxWidthMm}
                    aria-label="ความกว้างสติกเกอร์ต่อดวง mm"
                    className="w-full px-2 py-1 rounded bg-[#1a130e] border border-[#443326] font-mono text-xs text-[#faf5ee]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#a99784]">สูงสติกเกอร์ (mm)</label>
                  <FreeNumberInput
                    min={8}
                    max={200}
                    allowDecimal
                    step={1}
                    value={stickerBoxHeightMm}
                    onChangeNumber={setStickerBoxHeightMm}
                    aria-label="ความสูงสติกเกอร์ต่อดวง mm"
                    className="w-full px-2 py-1 rounded bg-[#1a130e] border border-[#443326] font-mono text-xs text-[#faf5ee]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#a99784]">สูงสุด/แถว (Cols)</label>
                  <FreeNumberInput
                    min={1}
                    max={12}
                    step={1}
                    value={gridColumns}
                    onChangeNumber={setGridColumns}
                    aria-label="จำนวนดวงต่อแถวสูงสุด"
                    className="w-full px-2 py-1 rounded bg-[#1a130e] border border-[#443326] font-mono text-xs text-[#faf5ee]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#a99784]">ช่องไฟ (Gap mm)</label>
                  <FreeNumberInput
                    min={0}
                    max={20}
                    allowDecimal
                    step={0.5}
                    value={gridGapMm}
                    onChangeNumber={setGridGapMm}
                    aria-label="ช่องไฟระหว่างสติกเกอร์ mm"
                    className="w-full px-2 py-1 rounded bg-[#1a130e] border border-[#443326] font-mono text-xs text-[#faf5ee]"
                  />
                </div>
              </div>
              <div className="text-[10px] text-emerald-300/90 font-mono">
                จัดเรียงได้ {gridFitStats.cols} × {gridFitStats.rowsPerPage} = {gridFitStats.perPage} ดวง/แผ่น
              </div>
            </div>
          )}

          {/* Copies Count & Print Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {BATCH_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCopies(n)}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-all ${
                    copies === n
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] shadow-md scale-105'
                      : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                  }`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
              <FreeNumberInput
                min={1}
                max={2000}
                step={1}
                value={copies}
                onChangeNumber={setCopies}
                aria-label="จำนวนดวงที่ต้องการพิมพ์"
                className="w-24 px-3 py-1.5 sm:py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs sm:text-sm font-mono font-bold text-[#faf5ee]"
              />
            </div>

            <button
              type="button"
              onClick={handlePrintStickers}
              className="flex items-center gap-2 px-6 py-3 xl:py-4 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-sm sm:text-base font-bold shadow-xl transition-transform active:scale-95"
            >
              <Printer className="w-5 h-5" />
              <span>พิมพ์สติกเกอร์ {copies.toLocaleString()} ดวง & บันทึกลง Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Print Position Map with Dimension-Aware Sticker Preview */}
      <div className="lg:col-span-6 lg:sticky lg:top-16">
        <PrintPositionMap
          paperSizes={paperSizes}
          selectedPaperSizeId={selectedPaperSizeId}
          calibration={calibration}
          onChangeCalibration={setCalibration}
          onSelectPreset={handleSelectPaperPreset}
          onSaveAsNewPreset={onSavePaperSizes ? handleSaveAsNewPreset : undefined}
          title="Map ระยะขอบ & ตำแหน่งพิมพ์สติกเกอร์จริง (mm)"
          printerName={selectedPrinter?.name}
          renderContent={({ contentWidthMm, safeHeightMm, pxPerMm }) =>
            printLayoutMode === 'grid' ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${gridGapMm * pxPerMm}px`,
                }}
              >
                {Array.from(
                  { length: Math.min(copies, gridFitStats.perPage) },
                  (_, itemIdx) => (
                    <div
                      key={itemIdx}
                      style={{
                        width: `${stickerBoxWidthMm * pxPerMm}px`,
                      }}
                    >
                      <StickerLabelPreview
                        config={config}
                        widthMm={stickerBoxWidthMm}
                        heightMm={stickerBoxHeightMm}
                        pxPerMm={pxPerMm}
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <StickerLabelPreview
                config={config}
                widthMm={contentWidthMm}
                heightMm={calibration.paperHeightMm === null ? null : safeHeightMm}
                pxPerMm={pxPerMm}
              />
            )
          }
        />
      </div>

      {/* Print-Only Calibrated Batch Stickers Container */}
      {activeBatchCopies > 0 && (
        <div id="printable-batch-root" className="hidden print:block">
          {printLayoutMode === 'grid'
            ? gridPages.map((pageItems, pageIdx) => {
                const pageW =
                  calibration.orientation === 'landscape' && calibration.paperHeightMm
                    ? calibration.paperHeightMm
                    : calibration.paperWidthMm;
                const pageH =
                  calibration.paperHeightMm === null
                    ? null
                    : calibration.orientation === 'landscape'
                    ? calibration.paperWidthMm
                    : calibration.paperHeightMm;
                return (
                  <div
                    key={pageIdx}
                    style={{
                      width: `${pageW}mm`,
                      height: pageH !== null ? `${pageH}mm` : 'auto',
                      paddingTop: `${calibration.marginTopMm}mm`,
                      paddingRight: `${calibration.marginRightMm}mm`,
                      paddingBottom: `${calibration.marginBottomMm}mm`,
                      paddingLeft: `${calibration.marginLeftMm}mm`,
                      boxSizing: 'border-box',
                    }}
                    className="print-page-break bg-white"
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: `${gridGapMm}mm`,
                        transform: `translate(${calibration.offsetXMm}mm, ${calibration.offsetYMm}mm)`,
                      }}
                    >
                      {pageItems.map((itemIdx) => (
                        <div
                          key={itemIdx}
                          style={{
                            width: `${stickerBoxWidthMm}mm`,
                          }}
                        >
                          <StickerLabelPreview
                            config={config}
                            widthMm={stickerBoxWidthMm}
                            heightMm={stickerBoxHeightMm}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            : Array.from({ length: activeBatchCopies }, (_, idx) => {
                const isLandscape =
                  calibration.orientation === 'landscape' &&
                  calibration.paperHeightMm !== null;
                const pageW =
                  isLandscape && calibration.paperHeightMm
                    ? calibration.paperHeightMm
                    : calibration.paperWidthMm;
                const pageH =
                  calibration.paperHeightMm === null
                    ? null
                    : isLandscape
                    ? calibration.paperWidthMm
                    : calibration.paperHeightMm;
                const safeContentW =
                  Math.max(5, pageW - calibration.marginLeftMm - calibration.marginRightMm) *
                  (calibration.contentWidthPct / 100);
                const safeContentH =
                  pageH !== null
                    ? Math.max(5, pageH - calibration.marginTopMm - calibration.marginBottomMm) *
                      ((calibration.contentHeightPct ?? 100) / 100)
                    : null;
                return (
                  <div
                    key={idx}
                    style={{
                      width: `${pageW}mm`,
                      height: pageH !== null ? `${pageH}mm` : 'auto',
                      paddingTop: `${calibration.marginTopMm}mm`,
                      paddingRight: `${calibration.marginRightMm}mm`,
                      paddingBottom: `${calibration.marginBottomMm}mm`,
                      paddingLeft: `${calibration.marginLeftMm}mm`,
                      boxSizing: 'border-box',
                      overflow: pageH !== null ? 'hidden' : 'visible',
                    }}
                    className="print-page-break bg-white"
                  >
                    <div
                      style={{
                        width: `${calibration.contentWidthPct}%`,
                        transform: `translate(${calibration.offsetXMm}mm, ${calibration.offsetYMm}mm)`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <StickerLabelPreview
                        config={config}
                        widthMm={safeContentW}
                        heightMm={safeContentH}
                      />
                    </div>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
};
