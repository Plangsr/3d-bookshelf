'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
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

const FONT_SCALE_PRESETS: { label: string; pct: number }[] = [
  { label: '70% เล็กมาก', pct: 70 },
  { label: '85% กะทัดรัด', pct: 85 },
  { label: '100% พอดีกรอบ', pct: 100 },
  { label: '115% ใหญ่', pct: 115 },
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
    brandHeader: shopProfile.shopName || 'THAI APPAREL',
    showBrandHeader: true,
    modelName: shirts[0]?.name || 'CHIC CASUAL V.1',
    colorName: shirts[0] ? formatColorDisplayName(shirts[0].color) : 'กรมท่า (NAVY BLUE)',
    sizeLabel: 'L',
    writeInLineStyle: 'solid',
    showBarcode: true,
    barcodeDigits: '8 851234 567890',
    barcodeCaption: `${shirts[0]?.sku || 'AT-TEE-01'}-L`,
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

  useEffect(() => {
    const onAfterPrint = () => setActiveBatchCopies(0);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const patchConfig = (patch: Partial<StickerConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleFillFromCatalogShirt = (shirtId: string) => {
    if (!shirtId) return;
    const found = shirts.find((s) => s.id === shirtId);
    if (!found) return;
    const firstSize = found.sizes[0]?.label || 'M';
    patchConfig({
      modelName: found.name,
      colorName: formatColorDisplayName(found.color),
      sizeLabel: firstSize,
      barcodeCaption: `${found.sku}-${firstSize}`,
    });
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
      config: { ...config },
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
    setStatusText(`สร้าง Set สติกเกอร์ "${newSet.name}" เรียบร้อยแล้ว`);
  };

  const handleUpdateSet = () => {
    if (!selectedSetId) return;
    const name = setNameInput.trim() || 'Set สติกเกอร์';
    const next = stickerSets.map((s) =>
      s.id === selectedSetId
        ? {
            ...s,
            name,
            config: { ...config },
            paperSizeId: selectedPaperSizeId,
            calibration: { ...calibration },
            defaultCopies: Math.max(1, copies),
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    setStickerSets(next);
    saveStickerSets(next);
    setStatusText(`อัปเดต Set สติกเกอร์ "${name}" แล้ว`);
  };

  const handleSelectSet = (setItem: StickerSet) => {
    setSelectedSetId(setItem.id);
    setSetNameInput(setItem.name);
    setConfig({ ...setItem.config });
    setSelectedPaperSizeId(setItem.paperSizeId);
    setCalibration({ ...setItem.calibration });
    setCopies(Math.max(1, setItem.defaultCopies || 1));
    setStatusText(`โหลด Set "${setItem.name}" แล้ว`);
  };

  const handleDeleteSet = (id: string) => {
    const next = stickerSets.filter((s) => s.id !== id);
    setStickerSets(next);
    saveStickerSets(next);
    if (selectedSetId === id) {
      setSelectedSetId('');
      setSetNameInput('');
    }
    setStatusText('ลบ Set สติกเกอร์แล้ว');
  };

  const handlePrintStickers = () => {
    const safeCopies = Math.min(2000, Math.max(1, Math.floor(copies) || 1));
    applyFreePrintPageStyle(calibration);
    setActiveBatchCopies(safeCopies);
    setStatusText(`กำลังพิมพ์สติกเกอร์ ${safeCopies.toLocaleString()} ดวง (ไม่ส่งขึ้น Server)...`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
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

        {/* 1. Sticker Content: รุ่น / สี / ไซส์ + ใส่เองหรือเว้นว่างไว้เขียนภายหลัง */}
        <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#e8c170]" />
              <div className="text-sm font-bold text-[#f7f1e8]">
                1. ข้อมูลบนสติกเกอร์ (รุ่น • สี • ไซส์)
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                patchConfig({
                  modelName: '',
                  colorName: '',
                  sizeLabel: '',
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-[11px] font-semibold text-[#e8c170] flex items-center gap-1"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>เว้นว่างทั้งหมด (ไว้เขียนมือทีหลัง)</span>
            </button>
          </div>

          {/* Quick Pick from Catalog (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] text-[#d6c8b6] mb-1">
                ดึงจากรายการเสื้อ (ไม่บังคับ)
              </label>
              <select
                defaultValue=""
                onChange={(e) => handleFillFromCatalogShirt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
              >
                <option value="">-- เลือกเพื่อเติมข้อมูลเร็ว หรือพิมพ์เองด้านล่าง --</option>
                {shirts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sku} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#d6c8b6]">ชื่อแบรนด์หัวสติกเกอร์</label>
                <label className="flex items-center gap-1 text-[10px] text-[#e8c170] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBrandHeader}
                    onChange={(e) => patchConfig({ showBrandHeader: e.target.checked })}
                  />
                  <span>แสดงหัวแบรนด์</span>
                </label>
              </div>
              <input
                type="text"
                value={config.brandHeader}
                onChange={(e) => patchConfig({ brandHeader: e.target.value })}
                placeholder="เช่น THAI APPAREL"
                className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
              />
            </div>
          </div>

          {/* รุ่น (Model) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#d6c8b6] font-semibold">
                รุ่น (MODEL) — พิมพ์เอง หรือลบให้ว่างเพื่อขีดเส้นไว้เขียนปากกา
              </label>
              {config.modelName && (
                <button
                  type="button"
                  onClick={() => patchConfig({ modelName: '' })}
                  className="text-[10px] text-[#e8c170] hover:underline"
                >
                  เว้นว่างไว้เขียนเอง
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.modelName}
              onChange={(e) => patchConfig({ modelName: e.target.value })}
              placeholder="เว้นว่าง = ขีดเส้นไว้เขียนรุ่นเองภายหลัง เช่น CHIC CASUAL V.1"
              className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
            />
          </div>

          {/* สี (Color) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#d6c8b6] font-semibold">
                สี (COLOR) — พิมพ์เอง เลือกสี หรือเว้นว่างไว้เขียนเอง
              </label>
              {config.colorName && (
                <button
                  type="button"
                  onClick={() => patchConfig({ colorName: '' })}
                  className="text-[10px] text-[#e8c170] hover:underline"
                >
                  เว้นว่างไว้เขียนเอง
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.colorName}
              onChange={(e) => patchConfig({ colorName: e.target.value })}
              placeholder="เว้นว่าง = ขีดเส้นไว้เขียนสีเอง เช่น กรมท่า (NAVY BLUE)"
              className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COLOR_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patchConfig({ colorName: c })}
                  className={`px-2 py-0.5 rounded-md border text-[10px] ${
                    config.colorName === c
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                      : 'bg-[#120d0a] text-[#cfc2b2] border-[#3b2c21] hover:border-[#6a503b]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ไซส์ (Size) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#d6c8b6] font-semibold">
                ไซส์ (SIZE) — เลือก กดพิมพ์ หรือเว้นว่างไว้เขียนเอง
              </label>
              <button
                type="button"
                onClick={() => patchConfig({ sizeLabel: '' })}
                className="text-[10px] text-[#e8c170] hover:underline"
              >
                เว้นว่างไว้เขียนเอง
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_SIZE_CHIPS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => patchConfig({ sizeLabel: sz })}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${
                    config.sizeLabel === sz
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170]'
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
                placeholder="หรือพิมพ์ไซส์เอง"
                className="w-28 px-2.5 py-1 rounded-lg bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
              />
            </div>
          </div>

          {/* Barcode & Write-In Line Style */}
          <div className="pt-2 border-t border-[#2d2118] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-[#d6c8b6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBarcode}
                  onChange={(e) => patchConfig({ showBarcode: e.target.checked })}
                />
                <span>แสดงบาร์โค้ดด้านล่างสติกเกอร์</span>
              </label>
              {config.showBarcode && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={config.barcodeDigits}
                    onChange={(e) => patchConfig({ barcodeDigits: e.target.value })}
                    placeholder="เลขบาร์โค้ด เช่น 8 851234 567890"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee]"
                  />
                  <input
                    type="text"
                    value={config.barcodeCaption}
                    onChange={(e) => patchConfig({ barcodeCaption: e.target.value })}
                    placeholder="รหัสกำกับ เช่น CHIC-NAVY-L-01"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-[11px] text-[#a99784]">รูปแบบเส้นเมื่อเว้นว่างไว้เขียนมือ</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => patchConfig({ writeInLineStyle: 'solid' })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs ${
                    config.writeInLineStyle === 'solid'
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                      : 'bg-[#120d0a] text-[#cfc2b2] border-[#3b2c21]'
                  }`}
                >
                  เส้นทึบ (____)
                </button>
                <button
                  type="button"
                  onClick={() => patchConfig({ writeInLineStyle: 'dashed' })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs ${
                    config.writeInLineStyle === 'dashed'
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                      : 'bg-[#120d0a] text-[#cfc2b2] border-[#3b2c21]'
                  }`}
                >
                  เส้นประ (- - -)
                </button>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-[#cfc2b2] pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showCutBorder}
                  onChange={(e) => patchConfig({ showCutBorder: e.target.checked })}
                />
                <span>แสดงกรอบตัดสติกเกอร์</span>
              </label>
            </div>
          </div>

          {/* Text & Detail Scaling Controls (Auto + Fine-Tune for small 30x40 labels) */}
          <div className="pt-2 border-t border-[#2d2118] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-[#d6c8b6]">
                ขนาดตัวอักษร &amp; รายละเอียด ({config.fontScalePct ?? 100}% • ปรับตามขนาดสติกเกอร์อัตโนมัติ)
              </div>
              <div className="flex items-center gap-1.5">
                <FreeNumberInput
                  min={45}
                  max={160}
                  step={5}
                  value={config.fontScalePct ?? 100}
                  onChangeNumber={(pct) => patchConfig({ fontScalePct: pct })}
                  aria-label="สัดส่วนขนาดตัวอักษรเปอร์เซ็นต์"
                  className="w-16 px-2 py-0.5 rounded-lg bg-[#120d0a] border border-[#443326] font-mono text-xs text-[#faf5ee] text-center"
                />
                <span className="text-[11px] text-[#a99784]">%</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="range"
                min={50}
                max={150}
                step={5}
                value={config.fontScalePct ?? 100}
                onChange={(e) => patchConfig({ fontScalePct: Number(e.target.value) || 100 })}
                className="flex-1 min-w-[140px] accent-[#e8c170]"
              />
              <div className="flex flex-wrap gap-1">
                {FONT_SCALE_PRESETS.map((p) => (
                  <button
                    key={p.pct}
                    type="button"
                    onClick={() => patchConfig({ fontScalePct: p.pct })}
                    className={`px-2 py-0.5 rounded-md border text-[10px] ${
                      (config.fontScalePct ?? 100) === p.pct
                        ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                        : 'bg-[#120d0a] text-[#cfc2b2] border-[#3b2c21]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[#a99784] mr-1">ความกระชับช่องไฟ:</span>
              {(
                [
                  { id: 'auto', label: 'อัตโนมัติ (กระชับเมื่อ ≤ 36mm)' },
                  { id: 'compact', label: 'กระชับพิเศษ (เหมาะ 30×40)' },
                  { id: 'normal', label: 'โปร่ง (สติกเกอร์ใหญ่)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchConfig({ detailDensity: opt.id })}
                  className={`px-2 py-0.5 rounded-md border text-[10px] ${
                    (config.detailDensity ?? 'auto') === opt.id
                      ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f5da98] font-bold'
                      : 'bg-[#120d0a] border-[#3b2c21] text-[#cfc2b2]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Named Sticker Sets */}
        <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-[#f7f1e8]">
              2. บันทึก Set สติกเกอร์ (สร้าง • แก้ไข • ลบ)
            </div>
            <span className="text-[11px] text-[#a99784]">
              บันทึกไว้ในเครื่อง ({stickerSets.length} Set)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={setNameInput}
              onChange={(e) => setSetNameInput(e.target.value)}
              placeholder="ตั้งชื่อ Set เช่น สติกเกอร์ว่างเขียนมือ 50x70"
              className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
            />
            <button
              type="button"
              onClick={handleCreateSet}
              className="px-3 py-1.5 rounded-xl bg-[#e8c170] text-[#1c1410] text-xs font-bold flex items-center gap-1"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>สร้าง Set</span>
            </button>
            {selectedSetId && (
              <button
                type="button"
                onClick={handleUpdateSet}
                className="px-3 py-1.5 rounded-xl bg-[#291e16] border border-[#543e2d] text-[#f5da98] text-xs font-semibold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>อัปเดต</span>
              </button>
            )}
          </div>
          {stickerSets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stickerSets.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs ${
                    selectedSetId === s.id
                      ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#f7e1a8]'
                      : 'bg-[#120d0a] border-[#3b2c21] text-[#d6c8b6]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSet(s)}
                    className="font-medium hover:underline"
                  >
                    {s.name} ({s.defaultCopies})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSet(s.id)}
                    className="text-red-300/80 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
          <div className="flex flex-wrap gap-1.5">
            {STICKER_QUICK_SIZES.map((qs) => (
              <button
                key={qs.label}
                type="button"
                onClick={() =>
                  handleApplyStickerQuickSize(qs.w, qs.h, qs.m, qs.w === 210)
                }
                className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                  calibration.paperWidthMm === qs.w && calibration.paperHeightMm === qs.h
                    ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                    : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                }`}
              >
                {qs.label}
              </button>
            ))}
          </div>

          {/* Single Roll vs Multi-Up Grid Toggle */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPrintLayoutMode('single')}
              className={`px-3 py-1.5 rounded-lg border text-xs ${
                printLayoutMode === 'single'
                  ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f5da98] font-bold'
                  : 'bg-[#120d0a] border-[#3b2c21] text-[#cfc2b2]'
              }`}
            >
              เครื่องพิมพ์สติกเกอร์ (1 ดวง/แผ่น)
            </button>
            <button
              type="button"
              onClick={() => setPrintLayoutMode('grid')}
              className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${
                printLayoutMode === 'grid'
                  ? 'bg-[#e8c170]/20 border-[#e8c170] text-[#f5da98] font-bold'
                  : 'bg-[#120d0a] border-[#3b2c21] text-[#cfc2b2]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {BATCH_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCopies(n)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-mono ${
                    copies === n
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                      : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21]'
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
                className="w-20 px-2.5 py-1 rounded-lg bg-[#120d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
              />
            </div>

            <button
              type="button"
              onClick={handlePrintStickers}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold shadow-lg transition-transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์สติกเกอร์ {copies.toLocaleString()} ดวง (ไม่ส่งขึ้น Server)</span>
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
                    ? Math.max(5, pageH - calibration.marginTopMm - calibration.marginBottomMm)
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
