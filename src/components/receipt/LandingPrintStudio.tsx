'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  FileImage,
  FolderPlus,
  Plus,
  Printer,
  Ruler,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { INITIAL_PAPER_SIZES, RECEIPT_TEMPLATE_META } from '@/data/shirts';
import {
  applyFreePrintPageStyle,
  calculateReceiptTotals,
  calibrationFromPaperSize,
  formatColorDisplayName,
  formatTHB,
  generateReceiptNumber,
  loadLayoutCalibrations,
  loadPrintSets,
  saveLayoutCalibrations,
  savePrintSets,
} from '@/lib/storage';
import type {
  PrintLayoutCalibration,
  PrintSet,
  ReceiptDraft,
  ReceiptPaperSize,
  ReceiptTemplateType,
  Shirt,
  ShopProfile,
} from '@/types/shirt';
import { FreeNumberInput } from './FreeNumberInput';
import { PrintPositionMap } from './PrintPositionMap';
import { QuickUploadPrinter } from './QuickUploadPrinter';
import { ReceiptPreview } from './ReceiptPreview';
import { StickerStudio } from './StickerStudio';

interface LandingPrintStudioProps {
  shirts: Shirt[];
  paperSizes: ReceiptPaperSize[];
  shopProfile: ShopProfile;
  draft: ReceiptDraft;
  onUpdateDraft: (next: ReceiptDraft) => void;
  onSavePaperSizes?: (sizes: ReceiptPaperSize[]) => void;
  onOpenSizeManager: () => void;
  onSwitchTo3DRack?: () => void;
}

const TEMPLATE_KEYS: ReceiptTemplateType[] = [
  'thermal_pos',
  'retail_standard',
  'tax_invoice',
  'boutique_gift',
];

const BATCH_PRESETS = [1, 10, 50, 100, 500, 1000];

export const LandingPrintStudio: React.FC<LandingPrintStudioProps> = ({
  shirts,
  paperSizes,
  shopProfile,
  draft,
  onUpdateDraft,
  onSavePaperSizes,
  onOpenSizeManager,
}) => {
  const [studioTab, setStudioTab] = useState<'quick' | 'sticker' | 'builder'>('sticker');
  const [printSets, setPrintSets] = useState<PrintSet[]>(() => loadPrintSets());
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [setNameInput, setSetNameInput] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [autoNumberBatch, setAutoNumberBatch] = useState<boolean>(true);
  const [activeBatchCopies, setActiveBatchCopies] = useState<number>(0);
  const [isDraggingSlip, setIsDraggingSlip] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  // Quick-add garment state
  const [quickShirtId, setQuickShirtId] = useState<string>(shirts[0]?.id ?? '');
  const selectedQuickShirt = useMemo(
    () => shirts.find((s) => s.id === quickShirtId) ?? shirts[0],
    [shirts, quickShirtId]
  );
  const [quickColor, setQuickColor] = useState<string>(
    formatColorDisplayName(selectedQuickShirt?.color ?? '#1a2332'),
  );
  const [quickSizeLabel, setQuickSizeLabel] = useState<string>(
    selectedQuickShirt?.sizes[0]?.label ?? 'M'
  );
  const [quickQty, setQuickQty] = useState<number>(1);

  useEffect(() => {
    const handleAfterPrint = () => {
      setActiveBatchCopies(0);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const activePaperSize = useMemo(
    () =>
      paperSizes.find((p) => p.id === draft.paperSizeId) ??
      paperSizes[0] ??
      INITIAL_PAPER_SIZES[1],
    [paperSizes, draft.paperSizeId]
  );

  const [savedCalibrations, setSavedCalibrations] = useState<
    Record<string, PrintLayoutCalibration>
  >(() => loadLayoutCalibrations());
  const [builderCalibration, setBuilderCalibration] = useState<PrintLayoutCalibration>(
    () => calibrationFromPaperSize(activePaperSize, loadLayoutCalibrations())
  );

  const handleSelectBuilderPreset = (paperSizeId: string) => {
    patchDraft({ paperSizeId });
    const target =
      paperSizes.find((p) => p.id === paperSizeId) ??
      paperSizes[0] ??
      INITIAL_PAPER_SIZES[1];
    setBuilderCalibration(calibrationFromPaperSize(target, savedCalibrations));
  };

  const handleSaveBuilderPreset = (
    newPreset: ReceiptPaperSize,
    calibration: PrintLayoutCalibration
  ) => {
    const nextMap = { ...savedCalibrations, [newPreset.id]: { ...calibration } };
    setSavedCalibrations(nextMap);
    saveLayoutCalibrations(nextMap);
    if (onSavePaperSizes) {
      onSavePaperSizes([...paperSizes, newPreset]);
    }
    patchDraft({ paperSizeId: newPreset.id });
    setStatusText(`บันทึก Preset "${newPreset.name}" พร้อมระยะตำแหน่งบน Map แล้ว`);
  };

  const totals = useMemo(
    () =>
      calculateReceiptTotals(
        draft.items,
        draft.discountAmount,
        draft.shippingFee,
        draft.vatMode
      ),
    [draft.items, draft.discountAmount, draft.shippingFee, draft.vatMode]
  );

  const patchDraft = (patch: Partial<ReceiptDraft>) => {
    onUpdateDraft({
      ...draft,
      ...patch,
      shop: patch.shop ?? shopProfile,
    });
  };

  const handleSlipFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        patchDraft({
          slipImageDataUrl: reader.result,
          slipFileName: file.name,
          includeSlipOnPrint: draft.includeSlipOnPrint ?? true,
        });
        setStatusText(`แนบสลิป "${file.name}" ในเครื่องแล้ว (ไม่ส่งขึ้น Server)`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAddShirt = () => {
    if (!selectedQuickShirt) return;
    const sizeObj =
      selectedQuickShirt.sizes.find((sz) => sz.label === quickSizeLabel) ??
      selectedQuickShirt.sizes[0];
    if (!sizeObj) return;

    const existingIdx = draft.items.findIndex(
      (i) =>
        i.shirtId === selectedQuickShirt.id &&
        i.sizeLabel === sizeObj.label &&
        i.shirtColor === quickColor
    );
    const nextItems = [...draft.items];
    if (existingIdx >= 0) {
      nextItems[existingIdx] = {
        ...nextItems[existingIdx],
        quantity: nextItems[existingIdx].quantity + Math.max(1, quickQty),
      };
    } else {
      nextItems.push({
        lineId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        shirtId: selectedQuickShirt.id,
        sku: selectedQuickShirt.sku,
        shirtName: selectedQuickShirt.name,
        shirtColor: quickColor || selectedQuickShirt.color,
        shirtStyle: selectedQuickShirt.style,
        sizeId: sizeObj.id,
        sizeLabel: sizeObj.label,
        sizeMeasureText: `สี ${quickColor || selectedQuickShirt.color} • อก ${sizeObj.chestInch}" ยาว ${sizeObj.lengthInch}"`,
        unitPrice: sizeObj.price,
        quantity: Math.max(1, quickQty),
      });
    }
    patchDraft({ items: nextItems });
  };

  const handleCreatePrintSet = () => {
    const name = setNameInput.trim() || `Set การพิมพ์ ${printSets.length + 1}`;
    const newSet: PrintSet = {
      id: `pset-${Date.now()}`,
      name,
      templateType: draft.templateType,
      paperSizeId: activePaperSize.id,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress,
      customerTaxId: draft.customerTaxId,
      paymentMethod: draft.paymentMethod,
      items: draft.items.map((i) => ({ ...i })),
      discountAmount: draft.discountAmount,
      shippingFee: draft.shippingFee,
      vatMode: draft.vatMode,
      hidePricesOnSlip: draft.hidePricesOnSlip,
      includeSlipOnPrint: draft.includeSlipOnPrint,
      useCustomShopTemplate: draft.useCustomShopTemplate,
      notes: draft.notes,
      defaultCopies: Math.max(1, copies),
      updatedAt: new Date().toISOString(),
    };
    const next = [newSet, ...printSets];
    setPrintSets(next);
    savePrintSets(next);
    setSelectedSetId(newSet.id);
    setSetNameInput(newSet.name);
    setStatusText(`สร้าง Set "${newSet.name}" เรียบร้อยแล้ว`);
  };

  const handleUpdateSelectedSet = () => {
    if (!selectedSetId) return;
    const name = setNameInput.trim() || 'Set การพิมพ์';
    const next = printSets.map((s) =>
      s.id === selectedSetId
        ? {
            ...s,
            name,
            templateType: draft.templateType,
            paperSizeId: activePaperSize.id,
            customerName: draft.customerName,
            customerPhone: draft.customerPhone,
            customerAddress: draft.customerAddress,
            customerTaxId: draft.customerTaxId,
            paymentMethod: draft.paymentMethod,
            items: draft.items.map((i) => ({ ...i })),
            discountAmount: draft.discountAmount,
            shippingFee: draft.shippingFee,
            vatMode: draft.vatMode,
            hidePricesOnSlip: draft.hidePricesOnSlip,
            includeSlipOnPrint: draft.includeSlipOnPrint,
            useCustomShopTemplate: draft.useCustomShopTemplate,
            notes: draft.notes,
            defaultCopies: Math.max(1, copies),
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    setPrintSets(next);
    savePrintSets(next);
    setStatusText(`อัปเดต Set "${name}" เรียบร้อยแล้ว`);
  };

  const handleSelectPrintSet = (setItem: PrintSet) => {
    setSelectedSetId(setItem.id);
    setSetNameInput(setItem.name);
    setCopies(Math.max(1, setItem.defaultCopies || 1));
    onUpdateDraft({
      ...draft,
      receiptNo: draft.receiptNo || generateReceiptNumber(),
      templateType: setItem.templateType,
      paperSizeId: setItem.paperSizeId,
      customerName: setItem.customerName,
      customerPhone: setItem.customerPhone,
      customerAddress: setItem.customerAddress,
      customerTaxId: setItem.customerTaxId,
      paymentMethod: setItem.paymentMethod,
      items: setItem.items.map((i) => ({ ...i })),
      discountAmount: setItem.discountAmount,
      shippingFee: setItem.shippingFee,
      vatMode: setItem.vatMode,
      hidePricesOnSlip: setItem.hidePricesOnSlip,
      includeSlipOnPrint: setItem.includeSlipOnPrint,
      useCustomShopTemplate: setItem.useCustomShopTemplate,
      notes: setItem.notes,
      shop: shopProfile,
    });
    setStatusText(`โหลด Set "${setItem.name}" แล้ว`);
  };

  const handleDeletePrintSet = (id: string) => {
    const next = printSets.filter((s) => s.id !== id);
    setPrintSets(next);
    savePrintSets(next);
    if (selectedSetId === id) {
      setSelectedSetId('');
      setSetNameInput('');
    }
    setStatusText('ลบ Set การพิมพ์แล้ว');
  };

  const handleBatchPrint = () => {
    const safeCopies = Math.min(2000, Math.max(1, Math.floor(copies) || 1));
    applyFreePrintPageStyle(builderCalibration);
    setActiveBatchCopies(safeCopies);
    setStatusText(`กำลังเตรียมพิมพ์ ${safeCopies.toLocaleString()} ใบ (ไม่ส่งขึ้น Server)...`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#120d0a] text-[#f5efe6] pt-4 pb-10 px-4 sm:px-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Header Strip (Cleaned up & Compact) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3a2a1f] bg-[#1a130e] px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-[#f7f1e8]">
              สตูดิโอพิมพ์สติกเกอร์ &amp; ป้ายสินค้า
            </h2>
            <span className="hidden sm:inline text-xs text-[#a99784] border-l border-[#3a2a1f] pl-3">
              พิมพ์โดยตรงผ่านเบราว์เซอร์
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenSizeManager}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-xs font-semibold text-[#e8c170]"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>ขนาดกระดาษ / เครื่องพิมพ์</span>
            </button>
          </div>
        </div>

        {statusText && (
          <div className="rounded-xl border border-[#e8c170]/40 bg-[#e8c170]/10 px-4 py-2 text-xs text-[#f6dc9b]">
            {statusText}
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d2118] pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStudioTab('sticker')}
              className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                studioTab === 'sticker'
                  ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170]'
                  : 'bg-[#1a130e] text-[#d6c8b6] border-[#3a2a1f] hover:border-[#6a503b]'
              }`}
            >
              🏷️ สติกเกอร์แปะเสื้อ (รุ่น • สี • ไซส์)
            </button>
            <button
              type="button"
              onClick={() => setStudioTab('quick')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                studioTab === 'quick'
                  ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                  : 'bg-[#1a130e]/60 text-[#a99784] border-[#3a2a1f]/60 hover:text-[#d6c8b6]'
              }`}
            >
              พิมพ์ด่วนจากไฟล์ PDF/รูปสลิป
            </button>
          </div>
        </div>

        {studioTab === 'quick' ? (
          <QuickUploadPrinter
            paperSizes={paperSizes}
            defaultPaperSizeId={activePaperSize.id}
            onOpenSizeManager={onOpenSizeManager}
            onSavePaperSizes={onSavePaperSizes}
          />
        ) : studioTab === 'sticker' ? (
          <StickerStudio
            shirts={shirts}
            paperSizes={paperSizes}
            shopProfile={shopProfile}
            onSavePaperSizes={onSavePaperSizes}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Upload + Print Sets + Form + Batch Print */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Upload Slip Card */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingSlip(true);
              }}
              onDragLeave={() => setIsDraggingSlip(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingSlip(false);
                handleSlipFile(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${
                isDraggingSlip
                  ? 'border-[#e8c170] bg-[#e8c170]/10'
                  : 'border-[#4a3728] bg-[#1a130e]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#291e16] border border-[#543e2d] flex items-center justify-center text-[#e8c170]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#f7f1e8]">
                      1. อัปโหลดสลิปโอนเงิน / รูปแนบ (Local ไม่ส่งขึ้น Server)
                    </div>
                    <div className="text-xs text-[#a99784]">
                      ลากไฟล์รูปมาวางที่นี่ หรือกดปุ่มเลือกรูปสลิปจากเครื่อง
                    </div>
                  </div>
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold flex items-center gap-1.5">
                  <FileImage className="w-4 h-4" />
                  <span>{draft.slipImageDataUrl ? 'เปลี่ยนรูปสลิป' : 'เลือกรูปสลิป'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleSlipFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {draft.slipImageDataUrl && (
                <div className="mt-3 pt-3 border-t border-[#32241a] flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.slipImageDataUrl}
                    alt={draft.slipFileName || 'Slip'}
                    className="w-14 h-16 object-cover rounded-lg border border-[#543e2d]"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-xs font-medium text-[#f5efe6] truncate">
                      {draft.slipFileName || 'สลิปที่แนบไว้'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          patchDraft({ includeSlipOnPrint: draft.includeSlipOnPrint === false })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                          draft.includeSlipOnPrint !== false
                            ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#f5da98]'
                            : 'bg-[#130d0a] border-[#3b2c21] text-[#a79582]'
                        }`}
                      >
                        {draft.includeSlipOnPrint !== false
                          ? '✓ แสดงสลิปบนใบเสร็จตอนพิมพ์'
                          : 'ซ่อนสลิปตอนพิมพ์'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchDraft({
                            slipImageDataUrl: undefined,
                            slipFileName: undefined,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg border border-red-900/50 bg-red-950/30 text-red-300 text-[11px]"
                      >
                        ลบสลิป
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Named Print Sets (Create / Edit / Delete) */}
            <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[#f7f1e8]">
                  2. Set การพิมพ์ (ตั้งชื่อ • เพิ่ม • แก้ไข • ลบ)
                </div>
                <span className="text-[11px] text-[#a99784]">
                  บันทึกไว้ในเครื่อง ({printSets.length} Set)
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={setNameInput}
                  onChange={(e) => setSetNameInput(e.target.value)}
                  placeholder="ตั้งชื่อ Set เช่น ชุดออกบูธ 80mm / ชุดส่งของ 4x6"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                />
                <button
                  type="button"
                  onClick={handleCreatePrintSet}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>สร้าง Set ใหม่</span>
                </button>
                {selectedSetId && (
                  <button
                    type="button"
                    onClick={handleUpdateSelectedSet}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-[#f5da98] text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>บันทึกแก้ไข Set</span>
                  </button>
                )}
              </div>

              {printSets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {printSets.map((s) => {
                    const active = s.id === selectedSetId;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs ${
                          active
                            ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#f7e1a8]'
                            : 'bg-[#120d0a] border-[#3b2c21] text-[#d6c8b6]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPrintSet(s)}
                          className="font-medium hover:underline text-left"
                        >
                          {s.name} ({s.defaultCopies} ใบ)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePrintSet(s.id)}
                          aria-label={`ลบ ${s.name}`}
                          className="text-red-300/80 hover:text-red-300 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Receipt Type, Paper Size & Items Form */}
            <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3.5">
              <div className="text-sm font-bold text-[#f7f1e8]">
                3. เลือกแบบใบเสร็จ ขนาดกระดาษ และกรอกรายการ
              </div>

              {/* Custom Shop Receipt Template Upload (100% Local) */}
              <div className="rounded-xl border border-[#3b2c21] bg-[#120d0a] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#f5efe6]">
                      อัปโหลดรูปแบบใบเสร็จของร้าน (Custom Shop Format)
                    </div>
                    <div className="text-[11px] text-[#a99784]">
                      อัปโหลดไฟล์รูปแบบใบเสร็จของร้าน เพื่อพิมพ์ตามขนาด Preset ที่เลือกโดยตรง
                    </div>
                  </div>
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-xs font-semibold text-[#e8c170]">
                    <span>
                      {draft.customShopTemplateDataUrl ? 'เปลี่ยนรูปแบบร้าน' : 'อัปโหลดรูปแบบร้าน'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            patchDraft({
                              customShopTemplateDataUrl: reader.result,
                              customShopTemplateName: file.name,
                              useCustomShopTemplate: true,
                            });
                            setStatusText(
                              `อัปโหลดรูปแบบใบเสร็จร้าน "${file.name}" แล้ว — พร้อมพิมพ์ตามขนาด Preset`
                            );
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {draft.customShopTemplateDataUrl && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#2b2018]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.customShopTemplateDataUrl}
                      alt={draft.customShopTemplateName || 'Shop Template'}
                      className="w-12 h-14 object-cover rounded border border-[#4a3829] bg-white"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs text-[#f5efe6] truncate">
                        {draft.customShopTemplateName || 'รูปแบบใบเสร็จของร้าน'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            patchDraft({ useCustomShopTemplate: !draft.useCustomShopTemplate })
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                            draft.useCustomShopTemplate
                              ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#f5da98]'
                              : 'bg-[#1a130e] border-[#3b2c21] text-[#a79582]'
                          }`}
                        >
                          {draft.useCustomShopTemplate
                            ? '✓ กำลังใช้รูปแบบร้านนี้ในการพิมพ์'
                            : 'ใช้รูปแบบมาตรฐานของระบบ'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchDraft({
                              customShopTemplateDataUrl: undefined,
                              customShopTemplateName: undefined,
                              useCustomShopTemplate: false,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-red-900/50 bg-red-950/30 text-red-300 text-[11px]"
                        >
                          ลบรูปแบบร้าน
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATE_KEYS.map((key) => {
                  const meta = RECEIPT_TEMPLATE_META[key];
                  const active = draft.templateType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchDraft({ templateType: key })}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                          : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{meta.label}</div>
                      <div className="text-[10px] opacity-80 truncate">{meta.thaiLabel}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">
                    ขนาดกระดาษ (Preset)
                  </label>
                  <select
                    value={activePaperSize.id}
                    onChange={(e) => patchDraft({ paperSizeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  >
                    {paperSizes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.widthMm}×{p.heightMm ?? 'Auto'}mm)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Add Shirt Item: รุ่น / สี / Size เท่านั้น */}
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[#2d2118]">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">
                    รุ่น (Model)
                  </label>
                  <select
                    value={selectedQuickShirt?.id ?? ''}
                    onChange={(e) => {
                      const nextShirt = shirts.find((s) => s.id === e.target.value);
                      setQuickShirtId(e.target.value);
                      if (nextShirt) {
                        setQuickColor(formatColorDisplayName(nextShirt.color));
                        if (nextShirt.sizes[0]) {
                          setQuickSizeLabel(nextShirt.sizes[0].label);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  >
                    {shirts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">สี (Color)</label>
                  <input
                    type="text"
                    value={quickColor}
                    onChange={(e) => setQuickColor(e.target.value)}
                    placeholder="เช่น ดำ / ขาว"
                    className="w-full px-2.5 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">Size</label>
                  <select
                    value={quickSizeLabel}
                    onChange={(e) => setQuickSizeLabel(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  >
                    {(selectedQuickShirt?.sizes ?? []).map((sz) => (
                      <option key={sz.id} value={sz.label}>
                        {sz.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickQty(1);
                    handleQuickAddShirt();
                  }}
                  className="px-4 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่ม</span>
                </button>
              </div>

              {/* Current Items List */}
              {draft.items.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {draft.items.map((item) => (
                    <div
                      key={item.lineId}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#120d0a] border border-[#32241a] px-3 py-1.5 text-xs"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-[#f5efe6]">{item.shirtName}</span>{' '}
                        <span className="text-[#e8c170]">({item.sizeLabel})</span> ×{' '}
                        <span className="font-mono">{item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[#d6c8b6]">
                          {formatTHB(item.unitPrice * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            patchDraft({
                              items: draft.items.filter((x) => x.lineId !== item.lineId),
                            })
                          }
                          className="text-red-300/80 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* 4. Batch Print Control (1 - 1,000+ copies) */}
            <div className="rounded-2xl border border-[#e8c170]/35 bg-[#1a130e] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#f7f1e8]">
                  <Copy className="w-4 h-4 text-[#e8c170]" />
                  <span>4. พิมพ์หลายใบพร้อมกันในรอบเดียว (เช่น 1,000 ใบ)</span>
                </div>
                <div className="text-xs font-mono text-[#e8c170] font-bold">
                  ยอดสุทธิ/ใบ: {formatTHB(totals.grandTotal)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {BATCH_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCopies(n)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                      copies === n
                        ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                        : 'bg-[#120d0a] text-[#d6c8b6] border-[#3b2c21] hover:border-[#6a503b]'
                    }`}
                  >
                    {n.toLocaleString()} ใบ
                  </button>
                ))}
                <FreeNumberInput
                  min={1}
                  max={2000}
                  step={1}
                  value={copies}
                  onChangeNumber={setCopies}
                  aria-label="จำนวนใบเสร็จ"
                  className="w-24 px-3 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#cfc2b2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNumberBatch}
                    onChange={(e) => setAutoNumberBatch(e.target.checked)}
                    className="rounded border-[#543e2d]"
                  />
                  <span>รันเลขที่ใบเสร็จอัตโนมัติ (-0001 ถึง -{String(copies).padStart(4, '0')})</span>
                </label>

                <button
                  type="button"
                  onClick={handleBatchPrint}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold shadow-lg transition-transform active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    พิมพ์ {copies.toLocaleString()} ใบพร้อมกัน (ไม่ส่งขึ้น Server)
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Print Position Map */}
          <div className="lg:col-span-5 lg:sticky lg:top-16">
            <PrintPositionMap
              paperSizes={paperSizes}
              selectedPaperSizeId={activePaperSize.id}
              calibration={builderCalibration}
              onChangeCalibration={setBuilderCalibration}
              onSelectPreset={handleSelectBuilderPreset}
              onSaveAsNewPreset={onSavePaperSizes ? handleSaveBuilderPreset : undefined}
              title="Map ระยะขอบ & ตำแหน่งพิมพ์จริง (1 ใบ)"
            >
              <ReceiptPreview
                draft={{ ...draft, shop: shopProfile }}
                paperSize={activePaperSize}
                totals={totals}
              />
            </PrintPositionMap>
          </div>
        </div>
        )}
      </div>

      {/* Print-only Calibrated Batch Container (1:1 Physical Margins & Offset) */}
      {studioTab !== 'sticker' && activeBatchCopies > 0 && (
        <div id="printable-batch-root" className="hidden print:block">
          {Array.from({ length: activeBatchCopies }, (_, idx) => {
            const copyReceiptNo =
              activeBatchCopies > 1 && autoNumberBatch
                ? `${draft.receiptNo}-${String(idx + 1).padStart(4, '0')}`
                : draft.receiptNo;
            const isLandscape =
              builderCalibration.orientation === 'landscape' &&
              builderCalibration.paperHeightMm !== null;
            const pageW =
              isLandscape && builderCalibration.paperHeightMm
                ? builderCalibration.paperHeightMm
                : builderCalibration.paperWidthMm;
            const pageH =
              builderCalibration.paperHeightMm === null
                ? null
                : isLandscape
                ? builderCalibration.paperWidthMm
                : builderCalibration.paperHeightMm;
            return (
              <div
                key={idx}
                style={{
                  width: `${pageW}mm`,
                  height: pageH !== null ? `${pageH}mm` : 'auto',
                  paddingTop: `${builderCalibration.marginTopMm}mm`,
                  paddingRight: `${builderCalibration.marginRightMm}mm`,
                  paddingBottom: `${builderCalibration.marginBottomMm}mm`,
                  paddingLeft: `${builderCalibration.marginLeftMm}mm`,
                  boxSizing: 'border-box',
                  overflow: pageH !== null ? 'hidden' : 'visible',
                }}
                className="print-page-break bg-white"
              >
                <div
                  style={{
                    width: `${builderCalibration.contentWidthPct}%`,
                    transform: `translate(${builderCalibration.offsetXMm}mm, ${builderCalibration.offsetYMm}mm)`,
                    transformOrigin: 'top left',
                  }}
                >
                  <ReceiptPreview
                    draft={{ ...draft, shop: shopProfile, receiptNo: copyReceiptNo }}
                    paperSize={activePaperSize}
                    totals={totals}
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
