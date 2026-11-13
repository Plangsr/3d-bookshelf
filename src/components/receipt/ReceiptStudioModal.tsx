'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  History,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Printer,
  Receipt as ReceiptIcon,
  RefreshCw,
  Ruler,
  Save,
  SlidersHorizontal,
  Store,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { INITIAL_PAPER_SIZES, RECEIPT_TEMPLATE_META } from '@/data/shirts';
import {
  calculateReceiptTotals,
  formatTHB,
  generateReceiptNumber,
} from '@/lib/storage';
import type {
  PaymentMethod,
  ReceiptDraft,
  ReceiptLineItem,
  ReceiptPaperSize,
  ReceiptRecord,
  ReceiptTemplateType,
  Shirt,
  ShopProfile,
  VatMode,
} from '@/types/shirt';
import { ReceiptPreview } from './ReceiptPreview';

export interface ReceiptStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  shirts: Shirt[];
  draft: ReceiptDraft;
  onUpdateDraft: (draft: ReceiptDraft) => void;
  paperSizes: ReceiptPaperSize[];
  onSavePaperSizes: (sizes: ReceiptPaperSize[]) => void;
  shopProfile: ShopProfile;
  onSaveShopProfile: (shop: ShopProfile) => void;
  receiptHistory: ReceiptRecord[];
  onSaveToHistory: (record: ReceiptRecord) => void;
  onDeleteHistory: (id: string) => void;
  onOpenSizeManager: () => void;
  onClearDraftItems: () => void;
  onPrintReceipt?: (recordOverride?: ReceiptRecord) => void;
}

const TEMPLATE_CARDS = Object.values(RECEIPT_TEMPLATE_META);

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'เงินสด' },
  { id: 'transfer', label: 'โอน / PromptPay' },
  { id: 'card', label: 'บัตร' },
  { id: 'cod', label: 'COD' },
];

const VAT_OPTIONS: { id: VatMode; label: string }[] = [
  { id: 'none', label: 'ไม่มี VAT' },
  { id: 'excluded_7', label: 'VAT 7% แยกนอก' },
  { id: 'included_7', label: 'VAT 7% รวมในราคา' },
];

function formatSizeMeasureText(
  chestInch: number,
  lengthInch: number,
  shoulderInch?: number
): string {
  return `อก ${chestInch}" / ยาว ${lengthInch}"${shoulderInch ? ` / ไหล่ ${shoulderInch}"` : ''}`;
}

export function buildDynamicPrintPageCss(paperSize: ReceiptPaperSize): string {
  const isLandscapeWithHeight =
    paperSize.orientation === 'landscape' &&
    paperSize.heightMm !== null &&
    paperSize.heightMm > 0;

  const pageW =
    isLandscapeWithHeight && paperSize.heightMm ? paperSize.heightMm : paperSize.widthMm;
  const pageH =
    isLandscapeWithHeight ? paperSize.widthMm : paperSize.heightMm;

  const sizeRule = pageH ? `${pageW}mm ${pageH}mm` : `${pageW}mm auto`;
  return `@page { size: ${sizeRule}; margin: ${paperSize.marginMm}mm; }`;
}

export function applyDynamicPrintPageStyle(paperSize: ReceiptPaperSize): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildDynamicPrintPageCss(paperSize);
}

const ReceiptStudioContent: React.FC<Omit<ReceiptStudioModalProps, 'isOpen'>> = ({
  onClose,
  shirts,
  draft,
  onUpdateDraft,
  paperSizes,
  onSavePaperSizes,
  shopProfile,
  onSaveShopProfile,
  receiptHistory,
  onSaveToHistory,
  onDeleteHistory,
  onOpenSizeManager,
  onClearDraftItems,
  onPrintReceipt,
}) => {
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInlinePaperEditOpen, setIsInlinePaperEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Quick "+ เพิ่มเสื้อเข้าใบเสร็จ" picker state
  const [pickerShirtId, setPickerShirtId] = useState<string>(() => shirts[0]?.id ?? '');
  const [pickerSizeId, setPickerSizeId] = useState<string>(
    () => shirts[0]?.sizes[0]?.id ?? ''
  );
  const [pickerQty, setPickerQty] = useState<number>(1);

  const activePaperSize = useMemo(
    () =>
      paperSizes.find((p) => p.id === draft.paperSizeId) ??
      paperSizes[0] ??
      INITIAL_PAPER_SIZES[1],
    [paperSizes, draft.paperSizeId]
  );

  const syncedDraft = useMemo<ReceiptDraft>(
    () => ({
      ...draft,
      shop: shopProfile,
    }),
    [draft, shopProfile]
  );

  const totals = useMemo(
    () =>
      calculateReceiptTotals(
        syncedDraft.items,
        syncedDraft.discountAmount,
        syncedDraft.shippingFee,
        syncedDraft.vatMode
      ),
    [
      syncedDraft.items,
      syncedDraft.discountAmount,
      syncedDraft.shippingFee,
      syncedDraft.vatMode,
    ]
  );

  const pickerShirt = useMemo(
    () => shirts.find((s) => s.id === pickerShirtId) ?? shirts[0] ?? null,
    [shirts, pickerShirtId]
  );

  const pickerSize = useMemo(() => {
    if (!pickerShirt || pickerShirt.sizes.length === 0) return null;
    return (
      pickerShirt.sizes.find((sz) => sz.id === pickerSizeId) ??
      pickerShirt.sizes[0]
    );
  }, [pickerShirt, pickerSizeId]);

  const effectiveDim = useMemo(() => {
    const isLandscapeWithH =
      activePaperSize.orientation === 'landscape' &&
      activePaperSize.heightMm !== null &&
      activePaperSize.heightMm > 0;
    return {
      w:
        isLandscapeWithH && activePaperSize.heightMm
          ? activePaperSize.heightMm
          : activePaperSize.widthMm,
      h: isLandscapeWithH ? activePaperSize.widthMm : activePaperSize.heightMm,
    };
  }, [activePaperSize]);

  const patchDraft = (partial: Partial<ReceiptDraft>) => {
    onUpdateDraft({
      ...syncedDraft,
      ...partial,
    });
  };

  const handleQuickAddShirt = () => {
    if (!pickerShirt || !pickerSize) return;
    const qty = Math.max(1, Math.floor(pickerQty) || 1);
    const existingIdx = syncedDraft.items.findIndex(
      (item) => item.shirtId === pickerShirt.id && item.sizeId === pickerSize.id
    );

    let nextItems: ReceiptLineItem[];
    if (existingIdx !== -1) {
      nextItems = syncedDraft.items.map((item, idx) =>
        idx === existingIdx ? { ...item, quantity: item.quantity + qty } : item
      );
    } else {
      const newLine: ReceiptLineItem = {
        lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        shirtId: pickerShirt.id,
        sku: pickerShirt.sku,
        shirtName: pickerShirt.name,
        shirtColor: pickerShirt.color,
        shirtStyle: pickerShirt.style,
        sizeId: pickerSize.id,
        sizeLabel: pickerSize.label,
        sizeMeasureText: formatSizeMeasureText(
          pickerSize.chestInch,
          pickerSize.lengthInch,
          pickerSize.shoulderInch
        ),
        quantity: qty,
        unitPrice: pickerSize.price,
      };
      nextItems = [...syncedDraft.items, newLine];
    }

    patchDraft({ items: nextItems });
    setPickerQty(1);
    setStatusMessage({
      type: 'success',
      text: `เพิ่ม ${pickerShirt.sku} (ไซส์ ${pickerSize.label} × ${qty}) เข้าใบเสร็จแล้ว`,
    });
  };

  const handleChangeItemSize = (lineId: string, nextSizeId: string) => {
    const targetItem = syncedDraft.items.find((i) => i.lineId === lineId);
    if (!targetItem) return;
    const shirt = shirts.find((s) => s.id === targetItem.shirtId);
    const nextSize = shirt?.sizes.find((sz) => sz.id === nextSizeId);
    if (!nextSize) return;

    const nextItems = syncedDraft.items.map((item) =>
      item.lineId === lineId
        ? {
            ...item,
            sizeId: nextSize.id,
            sizeLabel: nextSize.label,
            sizeMeasureText: formatSizeMeasureText(
              nextSize.chestInch,
              nextSize.lengthInch,
              nextSize.shoulderInch
            ),
            unitPrice: nextSize.price,
          }
        : item
    );
    patchDraft({ items: nextItems });
  };

  const handleChangeItemField = (
    lineId: string,
    field: 'quantity' | 'unitPrice',
    value: number
  ) => {
    const nextItems = syncedDraft.items.map((item) =>
      item.lineId === lineId
        ? {
            ...item,
            [field]:
              field === 'quantity'
                ? Math.max(1, Math.floor(value) || 1)
                : Math.max(0, value),
          }
        : item
    );
    patchDraft({ items: nextItems });
  };

  const handleRemoveItem = (lineId: string) => {
    patchDraft({
      items: syncedDraft.items.filter((item) => item.lineId !== lineId),
    });
  };

  const handleInlinePaperPatch = (patch: Partial<ReceiptPaperSize>) => {
    const updated = paperSizes.map((p) =>
      p.id === activePaperSize.id ? { ...p, ...patch } : p
    );
    onSavePaperSizes(updated);
  };

  const handleSaveReceipt = async () => {
    if (syncedDraft.items.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'กรุณาเพิ่มรายการเสื้ออย่างน้อย 1 รายการก่อนบันทึกใบเสร็จ',
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const record: ReceiptRecord = {
      id: `rcp-${Date.now()}`,
      receiptNo: syncedDraft.receiptNo || generateReceiptNumber(),
      issuedAt: new Date().toISOString(),
      templateType: syncedDraft.templateType,
      paperSizeId: activePaperSize.id,
      shop: { ...shopProfile },
      customerName: syncedDraft.customerName,
      customerPhone: syncedDraft.customerPhone,
      customerAddress: syncedDraft.customerAddress,
      customerTaxId: syncedDraft.customerTaxId,
      paymentMethod: syncedDraft.paymentMethod,
      items: syncedDraft.items.map((i) => ({ ...i })),
      discountAmount: syncedDraft.discountAmount,
      shippingFee: syncedDraft.shippingFee,
      vatMode: syncedDraft.vatMode,
      hidePricesOnSlip: syncedDraft.hidePricesOnSlip,
      notes: syncedDraft.notes,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
    };

    onSaveToHistory(record);

    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `บันทึกใบเสร็จ ${record.receiptNo} (${formatTHB(record.grandTotal)}) เรียบร้อยแล้ว`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `บันทึกลงประวัติในเครื่องแล้ว (${record.receiptNo})`,
        });
      }
    } catch {
      setStatusMessage({
        type: 'success',
        text: `บันทึกลงประวัติในเครื่องแล้ว (${record.receiptNo})`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const triggerPrint = (recordOverride?: ReceiptRecord) => {
    if (onPrintReceipt) {
      onPrintReceipt(recordOverride);
      return;
    }

    const paperForPrint = recordOverride
      ? paperSizes.find((p) => p.id === recordOverride.paperSizeId) ?? activePaperSize
      : activePaperSize;
    applyDynamicPrintPageStyle(paperForPrint);
    window.print();
  };

  const handleLoadHistoryRecord = (record: ReceiptRecord) => {
    onUpdateDraft({
      receiptNo: record.receiptNo,
      templateType: record.templateType,
      paperSizeId: record.paperSizeId,
      shop: record.shop,
      customerName: record.customerName,
      customerPhone: record.customerPhone,
      customerAddress: record.customerAddress,
      customerTaxId: record.customerTaxId,
      paymentMethod: record.paymentMethod,
      items: record.items.map((i) => ({ ...i })),
      discountAmount: record.discountAmount,
      shippingFee: record.shippingFee,
      vatMode: record.vatMode,
      hidePricesOnSlip: record.hidePricesOnSlip,
      notes: record.notes,
      subtotal: record.subtotal,
      vatAmount: record.vatAmount,
      grandTotal: record.grandTotal,
      issuedAt: record.issuedAt,
    });
    setIsHistoryOpen(false);
    setStatusMessage({
      type: 'success',
      text: `โหลดใบเสร็จ ${record.receiptNo} เข้ามาแก้ไข/พิมพ์แล้ว`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="สตูดิโอออกใบเสร็จหลายขนาด"
    >
      <div className="relative w-full max-w-7xl h-[94vh] flex flex-col rounded-3xl bg-[#130d0a] border border-[#4a3728] shadow-2xl overflow-hidden text-[#f4ede3]">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-b border-[#34261c] bg-[#1a120d]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#e8c170] text-[#1c1410] flex items-center justify-center shrink-0 shadow">
              <ReceiptIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#e8c170]">
                MULTI-SIZE RECEIPT &amp; INVOICE STUDIO
              </p>
              <h2 className="text-sm sm:text-lg font-serif font-bold text-[#faf5ee] truncate">
                สตูดิโอออกใบเสร็จ &amp; พิมพ์หลายขนาด
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 font-sans">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                isHistoryOpen
                  ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170]'
                  : 'bg-[#241a13] hover:bg-[#34261c] text-[#efe5d7] border-[#483628]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>ประวัติ ({receiptHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={onOpenSizeManager}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#241a13] hover:bg-[#34261c] text-[#e8c170] border border-[#483628] text-xs font-medium"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">จัดการขนาดกระดาษ &amp; ไซส์</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-[#241a13] hover:bg-[#35261c] text-[#d6c9b8] border border-[#483628]"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Pane Switcher */}
        <div className="flex lg:hidden border-b border-[#2e2219] bg-[#16100c] p-2 gap-2 font-sans">
          <button
            type="button"
            onClick={() => setMobilePane('editor')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
              mobilePane === 'editor'
                ? 'bg-[#e8c170] text-[#1c1410]'
                : 'bg-[#221812] text-[#cbbca9]'
            }`}
          >
            แก้ไขรายการ &amp; ลูกค้า ({syncedDraft.items.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
              mobilePane === 'preview'
                ? 'bg-[#e8c170] text-[#1c1410]'
                : 'bg-[#221812] text-[#cbbca9]'
            }`}
          >
            ดูตัวอย่าง &amp; พิมพ์ ({formatTHB(totals.grandTotal)})
          </button>
        </div>

        {/* History Drawer Overlay inside Studio */}
        {isHistoryOpen && (
          <div className="border-b border-[#3d2e22] bg-[#19110d] px-4 sm:px-6 py-4 max-h-72 overflow-y-auto font-sans">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8c170]">
                ประวัติใบเสร็จที่บันทึกไว้ ({receiptHistory.length})
              </h3>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-xs text-[#b4a493] hover:text-white"
              >
                ซ่อนประวัติ
              </button>
            </div>

            {receiptHistory.length === 0 ? (
              <div className="text-xs text-[#9c8c7b] py-4 text-center border border-dashed border-[#3b2c21] rounded-xl">
                ยังไม่มีประวัติใบเสร็จที่บันทึก กด &quot;บันทึกใบเสร็จ&quot; ด้านล่างขวาเพื่อจัดเก็บ
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {receiptHistory.map((rec) => {
                  const meta = RECEIPT_TEMPLATE_META[rec.templateType];
                  return (
                    <div
                      key={rec.id}
                      className="p-3 rounded-2xl bg-[#211711] border border-[#3f2f23] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#e8c170]">
                            {rec.receiptNo}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#2d2118] text-[9px] font-mono text-[#d8cbb9]">
                            {meta?.badge ?? rec.templateType}
                          </span>
                        </div>
                        <div className="text-xs text-[#faf5ee] truncate mt-0.5">
                          {rec.customerName || 'ลูกค้าหน้าร้าน'} • {rec.items.length} รายการ •{' '}
                          <span className="font-mono font-bold text-[#e8c170]">
                            {formatTHB(rec.grandTotal)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#9e8e7e]">
                          {new Date(rec.issuedAt).toLocaleString('th-TH')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadHistoryRecord(rec)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#2d2119] hover:bg-[#3f2e22] text-[11px] text-[#f3eadc] border border-[#4d3a2c]"
                          title="โหลดเข้าสู่หน้าแก้ไข"
                        >
                          โหลด
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerPrint(rec)}
                          className="p-1.5 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410]"
                          title="พิมพ์ซ้ำ"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteHistory(rec.id)}
                          className="p-1.5 rounded-lg bg-[#371b1b] hover:bg-[#512424] text-red-200"
                          title="ลบประวัติ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Main Split Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT WORKSPACE: EDITOR CONTROLS */}
          <div
            className={`lg:col-span-6 overflow-y-auto p-4 sm:p-6 space-y-5 border-r border-[#34261c] font-sans ${
              mobilePane === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* 1. Template Selector */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8c170] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. รูปแบบใบเสร็จ (Receipt Template)</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_CARDS.map((tpl) => {
                  const active = syncedDraft.templateType === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => patchDraft({ templateType: tpl.id as ReceiptTemplateType })}
                      className={`text-left p-3 rounded-2xl border transition-all ${
                        active
                          ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#faf5ee] shadow'
                          : 'bg-[#1b130e] border-[#3b2c21] text-[#cfc2b2] hover:border-[#684e39]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{tpl.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                            active
                              ? 'bg-[#e8c170] text-[#1c1410]'
                              : 'bg-[#2a1f18] text-[#e8c170]'
                          }`}
                        >
                          {tpl.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#b4a493] mt-0.5 truncate">
                        {tpl.thaiLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Paper Size Selector + Inline Edit / Add */}
            <section className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8c170] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>2. ขนาดกระดาษพิมพ์ (Paper Size)</span>
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsInlinePaperEditOpen((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#271d16] hover:bg-[#36281f] border border-[#4b382a] text-[11px] text-[#efe5d7]"
                  >
                    <Pencil className="w-3 h-3 text-[#e8c170]" />
                    <span>แก้ไขขนาดนี้</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSizeManager}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[11px] text-[#1c1410] font-bold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ เพิ่มขนาดใหม่</span>
                  </button>
                </div>
              </div>

              <select
                value={activePaperSize.id}
                onChange={(e) => patchDraft({ paperSizeId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
              >
                {paperSizes.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name} — {ps.widthMm}mm × {ps.heightMm ? `${ps.heightMm}mm` : 'Auto Roll'} (
                    {ps.orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'})
                  </option>
                ))}
              </select>

              {/* Inline quick paper tweak panel */}
              {isInlinePaperEditOpen && (
                <div className="p-3 rounded-xl bg-[#130d0a] border border-[#4a3728] grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">กว้าง (mm)</label>
                    <input
                      type="number"
                      min={30}
                      max={450}
                      value={activePaperSize.widthMm}
                      onChange={(e) =>
                        handleInlinePaperPatch({
                          widthMm: Math.max(30, Number(e.target.value) || 80),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">
                      สูง (ว่าง=Auto)
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={600}
                      value={activePaperSize.heightMm ?? ''}
                      placeholder="Auto"
                      onChange={(e) =>
                        handleInlinePaperPatch({
                          heightMm:
                            e.target.value === ''
                              ? null
                              : Math.max(30, Number(e.target.value) || 150),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ขอบ (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      step={0.5}
                      value={activePaperSize.marginMm}
                      onChange={(e) =>
                        handleInlinePaperPatch({
                          marginMm: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ฟอนต์ (x)</label>
                    <input
                      type="number"
                      min={0.6}
                      max={1.6}
                      step={0.05}
                      value={activePaperSize.fontScale}
                      onChange={(e) =>
                        handleInlinePaperPatch({
                          fontScale: Math.max(0.6, Math.min(1.6, Number(e.target.value) || 1)),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">แนวกระดาษ</label>
                    <select
                      value={activePaperSize.orientation}
                      onChange={(e) =>
                        handleInlinePaperPatch({
                          orientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-[#1d1510] border border-[#443326] text-xs"
                    >
                      <option value="portrait">แนวตั้ง</option>
                      <option value="landscape">แนวนอน</option>
                    </select>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Quick Add Shirt Picker + Line Items */}
            <section className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c] space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8c170]">
                  3. รายการเสื้อในใบเสร็จ ({syncedDraft.items.length})
                </h3>
                {syncedDraft.items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearDraftItems}
                    className="text-[11px] text-red-300 hover:text-red-200 underline"
                  >
                    ล้างรายการทั้งหมด
                  </button>
                )}
              </div>

              {/* Quick "+ เพิ่มเสื้อเข้าใบเสร็จ" Picker */}
              {shirts.length > 0 && (
                <div className="p-3 rounded-xl bg-[#130d0a] border border-dashed border-[#56402f] space-y-2">
                  <div className="text-[11px] font-semibold text-[#e8c170]">
                    + เพิ่มเสื้อเข้าใบเสร็จ
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <select
                      value={pickerShirt?.id ?? ''}
                      onChange={(e) => {
                        const nextShirt = shirts.find((s) => s.id === e.target.value);
                        setPickerShirtId(e.target.value);
                        setPickerSizeId(nextShirt?.sizes[0]?.id ?? '');
                      }}
                      className="sm:col-span-6 px-2.5 py-2 rounded-lg bg-[#1d1510] border border-[#443326] text-xs text-[#faf5ee]"
                    >
                      {shirts.map((s) => (
                        <option key={s.id} value={s.id}>
                          [{s.sku}] {s.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={pickerSize?.id ?? ''}
                      onChange={(e) => setPickerSizeId(e.target.value)}
                      className="sm:col-span-3 px-2.5 py-2 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    >
                      {(pickerShirt?.sizes ?? []).map((sz) => (
                        <option key={sz.id} value={sz.id}>
                          {sz.label} — {formatTHB(sz.price)}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={pickerQty}
                      onChange={(e) => setPickerQty(Math.max(1, Number(e.target.value) || 1))}
                      className="sm:col-span-1 px-2 py-2 rounded-lg bg-[#1d1510] border border-[#443326] text-xs font-mono text-center"
                    />

                    <button
                      type="button"
                      disabled={!pickerShirt || !pickerSize}
                      onClick={handleQuickAddShirt}
                      className="sm:col-span-2 py-2 px-3 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] disabled:opacity-40 text-[#1c1410] text-xs font-bold"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>
              )}

              {/* Line Items List */}
              {syncedDraft.items.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#9e8e7e] border border-[#2f231a] rounded-xl bg-[#150f0b]">
                  ยังไม่มีรายการเสื้อ กดเพิ่มจากตัวเลือกด้านบน หรือแตะเสื้อบนราว 3D
                </div>
              ) : (
                <div className="space-y-2.5">
                  {syncedDraft.items.map((item) => {
                    const sourceShirt = shirts.find((s) => s.id === item.shirtId);
                    const availableSizes = sourceShirt?.sizes ?? [];

                    return (
                      <div
                        key={item.lineId}
                        className="p-3 rounded-xl bg-[#150f0b] border border-[#3a2b20] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0"
                              style={{ backgroundColor: item.shirtColor }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#faf5ee] truncate">
                                {item.shirtName}
                              </div>
                              <div className="text-[10px] font-mono text-[#a79786]">
                                {item.sku} • {item.sizeMeasureText || `Size ${item.sizeLabel}`}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.lineId)}
                            className="p-1.5 rounded-lg bg-[#351b1b] hover:bg-[#4e2424] text-red-200 shrink-0"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Size Selector */}
                          <div className="col-span-5">
                            <label className="block text-[10px] text-[#9c8c7b] mb-0.5">
                              เปลี่ยนไซส์
                            </label>
                            {availableSizes.length > 0 ? (
                              <select
                                value={item.sizeId}
                                onChange={(e) => handleChangeItemSize(item.lineId, e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg bg-[#1f1611] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              >
                                {!availableSizes.some((s) => s.id === item.sizeId) && (
                                  <option value={item.sizeId}>{item.sizeLabel}</option>
                                )}
                                {availableSizes.map((sz) => (
                                  <option key={sz.id} value={sz.id}>
                                    {sz.label} ({sz.chestInch}&quot;) — {formatTHB(sz.price)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="px-2 py-1.5 rounded-lg bg-[#1f1611] border border-[#3a2b20] text-xs font-mono">
                                {item.sizeLabel}
                              </div>
                            )}
                          </div>

                          {/* Quantity Stepper */}
                          <div className="col-span-3">
                            <label className="block text-[10px] text-[#9c8c7b] mb-0.5">
                              จำนวน
                            </label>
                            <div className="flex items-center bg-[#1f1611] border border-[#443326] rounded-lg">
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeItemField(item.lineId, 'quantity', item.quantity - 1)
                                }
                                className="p-1.5 text-[#cfc2b2] hover:text-white"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleChangeItemField(
                                    item.lineId,
                                    'quantity',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full bg-transparent text-center text-xs font-mono text-[#faf5ee] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeItemField(item.lineId, 'quantity', item.quantity + 1)
                                }
                                className="p-1.5 text-[#cfc2b2] hover:text-white"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Unit Price */}
                          <div className="col-span-4">
                            <label className="block text-[10px] text-[#9c8c7b] mb-0.5">
                              ราคา/ตัว (฿)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={10}
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleChangeItemField(
                                  item.lineId,
                                  'unitPrice',
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1f1611] border border-[#443326] text-xs font-mono text-right text-[#e8c170] font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. Customer, Payment & Financial Fields */}
            <section className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c] space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#e8c170] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>4. ข้อมูลลูกค้า การชำระเงิน และภาษี</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">เลขที่ใบเสร็จ</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={syncedDraft.receiptNo}
                      onChange={(e) => patchDraft({ receiptNo: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#e8c170]"
                    />
                    <button
                      type="button"
                      onClick={() => patchDraft({ receiptNo: generateReceiptNumber() })}
                      className="p-2 rounded-xl bg-[#271d16] hover:bg-[#37291f] border border-[#493729] text-[#e8c170]"
                      title="ออกเลขใบเสร็จใหม่"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">ชื่อลูกค้า / บริษัท</label>
                  <input
                    type="text"
                    value={syncedDraft.customerName}
                    onChange={(e) => patchDraft({ customerName: e.target.value })}
                    placeholder="คุณ... / บริษัท..."
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={syncedDraft.customerPhone}
                    onChange={(e) => patchDraft({ customerPhone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">
                    เลขผู้เสียภาษีลูกค้า (สำหรับใบกำกับภาษี)
                  </label>
                  <input
                    type="text"
                    value={syncedDraft.customerTaxId}
                    onChange={(e) => patchDraft({ customerTaxId: e.target.value })}
                    placeholder="13 หลัก (ถ้ามี)"
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">ที่อยู่ลูกค้า / จัดส่ง</label>
                  <input
                    type="text"
                    value={syncedDraft.customerAddress}
                    onChange={(e) => patchDraft({ customerAddress: e.target.value })}
                    placeholder="ที่อยู่สำหรับออกใบกำกับภาษีหรือจัดส่งพัสดุ"
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[11px] text-[#d6c8b6] mb-1.5">วิธีชำระเงิน</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const active = syncedDraft.paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => patchDraft({ paymentMethod: opt.id })}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all ${
                          active
                            ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-bold'
                            : 'bg-[#130d0a] text-[#cfc2b2] border-[#3b2c21] hover:border-[#6a503b]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Financial adjustments */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">ส่วนลด (THB)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={syncedDraft.discountAmount}
                    onChange={(e) =>
                      patchDraft({ discountAmount: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">ค่าจัดส่ง (THB)</label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={syncedDraft.shippingFee}
                    onChange={(e) =>
                      patchDraft({ shippingFee: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">ภาษีมูลค่าเพิ่ม (VAT)</label>
                  <select
                    value={syncedDraft.vatMode}
                    onChange={(e) => patchDraft({ vatMode: e.target.value as VatMode })}
                    className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                  >
                    {VAT_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gift Hide Prices Toggle & Notes */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => patchDraft({ hidePricesOnSlip: !syncedDraft.hidePricesOnSlip })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                    syncedDraft.hidePricesOnSlip
                      ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#f5da98]'
                      : 'bg-[#130d0a] border-[#3b2c21] text-[#c7b7a6]'
                  }`}
                >
                  {syncedDraft.hidePricesOnSlip ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>ซ่อนราคาบนใบของขวัญ (Gift Hide-Prices)</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-[#d6c8b6] mb-1">หมายเหตุท้ายบิล (Notes)</label>
                <textarea
                  rows={2}
                  value={syncedDraft.notes}
                  onChange={(e) => patchDraft({ notes: e.target.value })}
                  placeholder="ข้อความอวยพร คำแนะนำการส่ง หรือหมายเหตุเพิ่มเติม..."
                  className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                />
              </div>
            </section>

            {/* 5. Collapsible Shop Profile Editor */}
            <section className="rounded-2xl bg-[#1a120d] border border-[#34261c] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsShopOpen((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#221711] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#e8c170]" />
                  <div>
                    <div className="text-xs font-bold text-[#faf5ee]">
                      ข้อมูลร้านค้า / พร้อมเพย์ (Shop Profile)
                    </div>
                    <div className="text-[11px] text-[#9e8e7e] truncate">
                      {shopProfile.shopName} • TAX {shopProfile.taxId || '-'}
                    </div>
                  </div>
                </div>
                {isShopOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#b4a493]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#b4a493]" />
                )}
              </button>

              {isShopOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-[#2f231a] grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ชื่อร้านค้า</label>
                    <input
                      type="text"
                      value={shopProfile.shopName}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, shopName: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">คำโปรย (Tagline)</label>
                    <input
                      type="text"
                      value={shopProfile.tagline}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, tagline: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#a79786] mb-1">ที่อยู่ร้าน</label>
                    <input
                      type="text"
                      value={shopProfile.address}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, address: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">เบอร์โทรร้าน</label>
                    <input
                      type="text"
                      value={shopProfile.phone}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">เลขผู้เสียภาษีร้าน</label>
                    <input
                      type="text"
                      value={shopProfile.taxId}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, taxId: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">PromptPay ID</label>
                    <input
                      type="text"
                      value={shopProfile.promptPayId ?? ''}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, promptPayId: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ข้อความท้ายใบเสร็จ</label>
                    <input
                      type="text"
                      value={shopProfile.footerNote}
                      onChange={(e) =>
                        onSaveShopProfile({ ...shopProfile, footerNote: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#130d0a] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT WORKSPACE: LIVE RECEIPT PREVIEW & PRINT */}
          <div
            className={`lg:col-span-6 flex flex-col min-h-0 bg-[#1e1712] font-sans ${
              mobilePane === 'editor' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Preview Toolbar: Zoom + Dimensions Readout */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-[#34261c] bg-[#17110d]">
              <div className="text-xs font-mono text-[#d8cbb9]">
                <span className="text-[#e8c170] font-bold">{activePaperSize.name}</span>
                <span className="mx-1.5 text-[#6b5644]">•</span>
                <span>
                  {effectiveDim.w}mm × {effectiveDim.h ? `${effectiveDim.h}mm` : 'Auto'}
                </span>
                <span className="mx-1.5 text-[#6b5644]">•</span>
                <span>ขอบ {activePaperSize.marginMm}mm</span>
              </div>

              <div className="flex items-center gap-2">
                <ZoomIn className="w-3.5 h-3.5 text-[#e8c170]" />
                <input
                  type="range"
                  min={60}
                  max={130}
                  step={5}
                  value={zoomPercent}
                  onChange={(e) => setZoomPercent(Number(e.target.value))}
                  aria-label="ซูมตัวอย่างใบเสร็จ"
                  className="w-24 sm:w-28 accent-[#e8c170]"
                />
                <span className="text-xs font-mono text-[#e8c170] w-10 text-right">
                  {zoomPercent}%
                </span>
              </div>
            </div>

            {/* Paper Stage */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-[radial-gradient(#34271e_1px,transparent_1px)] [background-size:18px_18px]">
              <ReceiptPreview
                draft={syncedDraft}
                paperSize={activePaperSize}
                totals={totals}
                zoom={zoomPercent / 100}
              />
            </div>

            {/* Status Toast + Action Footer */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-[#34261c] bg-[#17110d] space-y-2.5">
              {statusMessage && (
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
                    statusMessage.type === 'error'
                      ? 'bg-red-950/70 border-red-800 text-red-200'
                      : 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{statusMessage.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusMessage(null)}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[#a79786]">ยอดรวมสุทธิ (Grand Total)</div>
                  <div className="text-lg font-mono font-bold text-[#e8c170]">
                    {formatTHB(totals.grandTotal)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSaveReceipt()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#291e16] hover:bg-[#38291e] disabled:opacity-50 text-[#f4ede3] border border-[#543e2d] text-xs font-semibold"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 text-[#e8c170]" />
                    )}
                    <span>บันทึกใบเสร็จ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerPrint()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold shadow-lg transition-transform active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์ใบเสร็จ / Save PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReceiptStudioModal: React.FC<ReceiptStudioModalProps> = ({
  isOpen,
  ...props
}) => {
  if (!isOpen) return null;
  return <ReceiptStudioContent {...props} />;
};
