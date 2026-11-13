'use client';

import React, { useState } from 'react';
import {
  Check,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Ruler,
  Shirt as ShirtIcon,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_SIZE_TEMPLATES,
  INITIAL_PAPER_SIZES,
  RECEIPT_TEMPLATE_META,
} from '@/data/shirts';
import { formatTHB } from '@/lib/storage';
import type {
  ReceiptPaperSize,
  ReceiptTemplateType,
  Shirt,
  ShirtSize,
} from '@/types/shirt';

export interface SizeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperSizes: ReceiptPaperSize[];
  selectedPaperSizeId: string;
  onSelectPaperSize: (id: string) => void;
  onSavePaperSizes: (sizes: ReceiptPaperSize[]) => void;
  shirts: Shirt[];
  onUpdateShirt: (shirt: Shirt) => void;
}

function createSizeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

const TEMPLATE_OPTIONS = Object.values(RECEIPT_TEMPLATE_META);

interface PaperFormState {
  editingId: string | null;
  name: string;
  widthMm: string;
  isAutoRoll: boolean;
  heightMm: string;
  marginMm: string;
  fontScale: string;
  orientation: 'portrait' | 'landscape';
  defaultTemplate: ReceiptTemplateType;
}

function createEmptyPaperForm(): PaperFormState {
  return {
    editingId: null,
    name: '',
    widthMm: '80',
    isAutoRoll: false,
    heightMm: '150',
    marginMm: '5',
    fontScale: '1',
    orientation: 'portrait',
    defaultTemplate: 'retail_standard',
  };
}

function paperSizeToForm(size: ReceiptPaperSize): PaperFormState {
  return {
    editingId: size.id,
    name: size.name,
    widthMm: String(size.widthMm),
    isAutoRoll: size.heightMm === null,
    heightMm: size.heightMm !== null ? String(size.heightMm) : '150',
    marginMm: String(size.marginMm),
    fontScale: String(size.fontScale),
    orientation: size.orientation,
    defaultTemplate: size.defaultTemplate ?? 'retail_standard',
  };
}

const SizeManagerContent: React.FC<Omit<SizeManagerModalProps, 'isOpen'>> = ({
  onClose,
  paperSizes,
  selectedPaperSizeId,
  onSelectPaperSize,
  onSavePaperSizes,
  shirts,
  onUpdateShirt,
}) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'shirt'>('paper');

  // Tab 1: Paper size form
  const [paperForm, setPaperForm] = useState<PaperFormState>(() => createEmptyPaperForm());
  const [paperNotice, setPaperNotice] = useState<string | null>(null);

  // Tab 2: Shirt size manager
  const [selectedShirtId, setSelectedShirtId] = useState<string>(() => shirts[0]?.id ?? '');
  const [customLabel, setCustomLabel] = useState('');
  const [customChest, setCustomChest] = useState('42');
  const [customLength, setCustomLength] = useState('28.5');
  const [customShoulder, setCustomShoulder] = useState('19');
  const [customPrice, setCustomPrice] = useState('990');
  const [customStock, setCustomStock] = useState('10');
  const [shirtNotice, setShirtNotice] = useState<string | null>(null);

  const activeShirt =
    shirts.find((s) => s.id === selectedShirtId) ?? shirts[0] ?? null;

  const handleSavePaperForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = paperForm.name.trim();
    if (!trimmedName) {
      setPaperNotice('กรุณากรอกชื่อขนาดกระดาษ (เช่น สติกเกอร์ 60x40 หรือ ใบเสร็จ 76mm)');
      return;
    }

    const widthMm = Math.max(5, Math.min(450, Number(paperForm.widthMm) || 80));
    const heightMm = paperForm.isAutoRoll
      ? null
      : Math.max(5, Math.min(600, Number(paperForm.heightMm) || 150));
    const marginMm = Math.max(0, Math.min(40, Number(paperForm.marginMm) || 0));
    const fontScale = Math.max(0.6, Math.min(1.8, Number(paperForm.fontScale) || 1));

    if (paperForm.editingId) {
      const updated = paperSizes.map((item) =>
        item.id === paperForm.editingId
          ? {
              ...item,
              name: trimmedName,
              widthMm,
              heightMm,
              marginMm,
              fontScale,
              orientation: paperForm.orientation,
              defaultTemplate: paperForm.defaultTemplate,
            }
          : item
      );
      onSavePaperSizes(updated);
      setPaperNotice(`อัปเดตขนาดกระดาษ "${trimmedName}" เรียบร้อยแล้ว`);
      setPaperForm(createEmptyPaperForm());
      return;
    }

    const newSize: ReceiptPaperSize = {
      id: `size-custom-${Date.now()}`,
      name: trimmedName,
      widthMm,
      heightMm,
      marginMm,
      fontScale,
      orientation: paperForm.orientation,
      defaultTemplate: paperForm.defaultTemplate,
      isPreset: false,
    };

    const nextSizes = [...paperSizes, newSize];
    onSavePaperSizes(nextSizes);
    onSelectPaperSize(newSize.id);
    setPaperNotice(`เพิ่มและเลือกใช้ขนาด "${trimmedName}" แล้ว`);
    setPaperForm(createEmptyPaperForm());
  };

  const handleDeleteCustomPaperSize = (size: ReceiptPaperSize) => {
    if (size.isPreset) return;
    if (paperSizes.length <= 1) return;
    const filtered = paperSizes.filter((p) => p.id !== size.id);
    onSavePaperSizes(filtered);
    if (selectedPaperSizeId === size.id && filtered[0]) {
      onSelectPaperSize(filtered[0].id);
    }
    if (paperForm.editingId === size.id) {
      setPaperForm(createEmptyPaperForm());
    }
    setPaperNotice(`ลบขนาดกระดาษ "${size.name}" แล้ว`);
  };

  const handleResetPresets = () => {
    const customSizes = paperSizes.filter((p) => !p.isPreset);
    const merged = [
      ...INITIAL_PAPER_SIZES.map((preset) => ({ ...preset })),
      ...customSizes,
    ];
    onSavePaperSizes(merged);
    if (!merged.some((p) => p.id === selectedPaperSizeId)) {
      onSelectPaperSize(INITIAL_PAPER_SIZES[1]?.id ?? INITIAL_PAPER_SIZES[0].id);
    }
    setPaperForm(createEmptyPaperForm());
    setPaperNotice('รีเซ็ตขนาดกระดาษมาตรฐาน (58mm, 80mm, A5, A4, 4×6") กลับสู่ค่าเริ่มต้นแล้ว');
  };

  // Shirt size handlers
  const handleUpdateActiveShirtSizes = (nextSizes: ShirtSize[], notice?: string) => {
    if (!activeShirt) return;
    onUpdateShirt({
      ...activeShirt,
      sizes: nextSizes,
    });
    if (notice) setShirtNotice(notice);
  };

  const handleQuickAddShirtSize = (tpl: Omit<ShirtSize, 'id'>) => {
    if (!activeShirt) return;
    const exists = activeShirt.sizes.some(
      (s) => s.label.trim().toUpperCase() === tpl.label.toUpperCase()
    );
    const label = exists ? `${tpl.label}-${activeShirt.sizes.length + 1}` : tpl.label;
    const base = activeShirt.basePrice || tpl.price;
    const nextSize: ShirtSize = {
      id: createSizeId(activeShirt.id),
      label,
      chestInch: tpl.chestInch,
      lengthInch: tpl.lengthInch,
      shoulderInch: tpl.shoulderInch,
      price:
        tpl.label === 'XL' || tpl.label === '2XL' || tpl.label === '3XL'
          ? Math.max(base, tpl.price)
          : base,
      stock: tpl.stock,
    };
    handleUpdateActiveShirtSizes(
      [...activeShirt.sizes, nextSize],
      `เพิ่มไซส์ ${nextSize.label} ให้ "${activeShirt.name}" แล้ว`
    );
  };

  const handleAddCustomShirtSize = () => {
    if (!activeShirt) return;
    const trimmed = customLabel.trim();
    if (!trimmed) {
      setShirtNotice('กรุณากรอกชื่อไซส์ก่อนกดเพิ่ม');
      return;
    }
    const nextSize: ShirtSize = {
      id: `${activeShirt.id}-custom-${Date.now()}`,
      label: trimmed,
      chestInch: Math.max(1, Number(customChest) || 40),
      lengthInch: Math.max(1, Number(customLength) || 28),
      ...(customShoulder.trim() !== ''
        ? { shoulderInch: Math.max(1, Number(customShoulder) || 18) }
        : {}),
      price: Math.max(0, Number(customPrice) || activeShirt.basePrice || 0),
      stock: Math.max(0, Math.floor(Number(customStock) || 0)),
    };
    handleUpdateActiveShirtSizes(
      [...activeShirt.sizes, nextSize],
      `เพิ่มไซส์กำหนดเอง "${trimmed}" แล้ว`
    );
    setCustomLabel('');
  };

  const handleEditShirtSizeField = <K extends keyof ShirtSize>(
    sizeId: string,
    field: K,
    value: ShirtSize[K]
  ) => {
    if (!activeShirt) return;
    const updated = activeShirt.sizes.map((sz) =>
      sz.id === sizeId ? { ...sz, [field]: value } : sz
    );
    handleUpdateActiveShirtSizes(updated);
  };

  const handleDeleteShirtSize = (sizeId: string) => {
    if (!activeShirt) return;
    if (activeShirt.sizes.length <= 1) {
      setShirtNotice('ต้องคงเหลืออย่างน้อย 1 ไซส์สำหรับเสื้อแต่ละแบบ');
      return;
    }
    const updated = activeShirt.sizes.filter((sz) => sz.id !== sizeId);
    handleUpdateActiveShirtSizes(updated, 'ลบไซส์ออกจากคลังแล้ว');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="จัดการขนาดกระดาษใบเสร็จและไซส์เสื้อ"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#140e0b] border border-[#4a3728] shadow-2xl overflow-hidden text-[#f4ede3]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-[#34261c] bg-[#1a120d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#271c15] border border-[#56402f] flex items-center justify-center text-[#e8c170]">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#e8c170]">
                SIZE &amp; PAPER STUDIO MANAGER
              </p>
              <h2 className="text-base sm:text-lg font-serif font-bold text-[#faf5ee]">
                จัดการขนาดกระดาษใบเสร็จ &amp; ตารางไซส์เสื้อในคลัง
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-[#241a13] hover:bg-[#35261c] text-[#d6c9b8] border border-[#483628]"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-5 sm:px-7 pt-3 pb-2 border-b border-[#2e2219] bg-[#17100c]">
          <button
            type="button"
            onClick={() => setActiveTab('paper')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans font-semibold border transition-all ${
              activeTab === 'paper'
                ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] shadow'
                : 'bg-[#211812] text-[#cbbca9] border-[#3d2d21] hover:border-[#6a503b] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. ขนาดกระดาษใบเสร็จ ({paperSizes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shirt')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans font-semibold border transition-all ${
              activeTab === 'shirt'
                ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] shadow'
                : 'bg-[#211812] text-[#cbbca9] border-[#3d2d21] hover:border-[#6a503b] hover:text-white'
            }`}
          >
            <ShirtIcon className="w-3.5 h-3.5" />
            <span>2. เพิ่ม/แก้ไซส์เสื้อในคลัง ({shirts.length} แบบ)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 font-sans">
          {activeTab === 'paper' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Existing Paper Sizes List */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#faf5ee]">
                    ขนาดกระดาษทั้งหมด (คลิกเลือกใช้ หรือแก้ไขได้ทุกขนาด)
                  </h3>
                  <button
                    type="button"
                    onClick={handleResetPresets}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#251b14] hover:bg-[#35261c] border border-[#4a3728] text-[11px] text-[#e8c170]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>รีเซ็ตค่ามาตรฐาน</span>
                  </button>
                </div>

                {paperNotice && (
                  <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-200 text-xs flex items-center justify-between gap-2">
                    <span>{paperNotice}</span>
                    <button
                      type="button"
                      onClick={() => setPaperNotice(null)}
                      className="text-emerald-300 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-2.5">
                  {paperSizes.map((sz) => {
                    const isSelected = sz.id === selectedPaperSizeId;
                    const isEditingThis = paperForm.editingId === sz.id;
                    const effW =
                      sz.orientation === 'landscape' && sz.heightMm
                        ? sz.heightMm
                        : sz.widthMm;
                    const effH =
                      sz.orientation === 'landscape' && sz.heightMm
                        ? sz.widthMm
                        : sz.heightMm ?? 120;
                    const ratio = effW / effH;

                    return (
                      <div
                        key={sz.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#e8c170]/12 border-[#e8c170] shadow-md'
                            : 'bg-[#1b130e] border-[#3b2c21] hover:border-[#5e4736]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Mini proportional preview icon */}
                          <div className="w-10 h-11 rounded-lg bg-[#120c09] border border-[#3d2e22] flex items-center justify-center shrink-0 p-1">
                            <div
                              className="bg-white/90 rounded-[2px] border border-[#e8c170]/60"
                              style={{
                                width: `${Math.max(10, Math.min(28, 22 * Math.min(1.3, ratio)))}px`,
                                height: `${Math.max(12, Math.min(34, 22 / Math.max(0.45, ratio)))}px`,
                              }}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-[#faf5ee] truncate">
                                {sz.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                                  sz.isPreset
                                    ? 'bg-[#2a2018] text-[#cbb699] border border-[#4a3728]'
                                    : 'bg-sky-950/70 text-sky-200 border border-sky-800/60'
                                }`}
                              >
                                {sz.isPreset ? 'PRESET' : 'CUSTOM'}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded bg-[#e8c170] text-[#1c1410] text-[9px] font-bold">
                                  กำลังใช้งาน
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-[#a99886] mt-1">
                              {sz.widthMm}mm × {sz.heightMm ? `${sz.heightMm}mm` : 'Auto Roll'} • ขอบ{' '}
                              {sz.marginMm}mm • ตัวอักษร {Math.round(sz.fontScale * 100)}% •{' '}
                              {sz.orientation === 'landscape' ? 'แนวนอน' : 'แนวตั้ง'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => onSelectPaperSize(sz.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#271d16] hover:bg-[#e8c170] hover:text-[#1c1410] text-[#e8c170] border border-[#4d3a2c] text-[11px] font-semibold transition-colors"
                            >
                              เลือกใช้
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPaperForm(paperSizeToForm(sz))}
                            className={`p-2 rounded-xl border text-xs transition-colors ${
                              isEditingThis
                                ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170]'
                                : 'bg-[#241a13] hover:bg-[#35261c] text-[#e6dac9] border-[#443326]'
                            }`}
                            title="แก้ไขขนาดกระดาษนี้"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!sz.isPreset && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomPaperSize(sz)}
                              className="p-2 rounded-xl bg-[#361b1b] hover:bg-[#502323] text-red-200 border border-red-900/50"
                              title="ลบขนาดกระดาษที่สร้างเอง"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Add / Edit Paper Size Form */}
              <form
                onSubmit={handleSavePaperForm}
                className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#1a120d] border border-[#433225] space-y-3.5 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#e8c170] uppercase tracking-wider flex items-center gap-1.5">
                    {paperForm.editingId ? (
                      <>
                        <Pencil className="w-3.5 h-3.5" />
                        <span>แก้ไขขนาดกระดาษ</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ เพิ่มขนาดกระดาษใหม่</span>
                      </>
                    )}
                  </h3>
                  {paperForm.editingId && (
                    <button
                      type="button"
                      onClick={() => setPaperForm(createEmptyPaperForm())}
                      className="text-[11px] text-[#baa996] hover:text-white underline"
                    >
                      สลับเป็นเพิ่มขนาดใหม่
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-[#d6c8b6] mb-1">
                    ชื่อขนาดกระดาษ (Paper Name) *
                  </label>
                  <input
                    type="text"
                    value={paperForm.name}
                    onChange={(e) => setPaperForm({ ...paperForm, name: e.target.value })}
                    placeholder="เช่น Thermal 76mm / ใบปะหน้า 100×150"
                    className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">
                      ความกว้าง (Width mm)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={450}
                      step={1}
                      value={paperForm.widthMm}
                      onChange={(e) => setPaperForm({ ...paperForm, widthMm: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">
                      ความสูง (Height mm)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={600}
                      step={1}
                      disabled={paperForm.isAutoRoll}
                      value={paperForm.isAutoRoll ? '' : paperForm.heightMm}
                      placeholder={paperForm.isAutoRoll ? 'Auto Roll' : '150'}
                      onChange={(e) => setPaperForm({ ...paperForm, heightMm: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] disabled:opacity-45 text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#d8cbb9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paperForm.isAutoRoll}
                    onChange={(e) => setPaperForm({ ...paperForm, isAutoRoll: e.target.checked })}
                    className="accent-[#e8c170] rounded"
                  />
                  <span>ม้วนกระดาษความร้อนต่อเนื่อง (Auto Roll Height)</span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">
                      ระยะขอบ (Margin mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      step={0.5}
                      value={paperForm.marginMm}
                      onChange={(e) => setPaperForm({ ...paperForm, marginMm: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">
                      สเกลตัวอักษร ({Math.round((Number(paperForm.fontScale) || 1) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0.65}
                      max={1.5}
                      step={0.05}
                      value={paperForm.fontScale}
                      onChange={(e) => setPaperForm({ ...paperForm, fontScale: e.target.value })}
                      className="w-full accent-[#e8c170] mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">การวางหน้า</label>
                    <select
                      value={paperForm.orientation}
                      onChange={(e) =>
                        setPaperForm({
                          ...paperForm,
                          orientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                    >
                      <option value="portrait">แนวตั้ง (Portrait)</option>
                      <option value="landscape">แนวนอน (Landscape)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#d6c8b6] mb-1">แม่แบบเริ่มต้น</label>
                    <select
                      value={paperForm.defaultTemplate}
                      onChange={(e) =>
                        setPaperForm({
                          ...paperForm,
                          defaultTemplate: e.target.value as ReceiptTemplateType,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                    >
                      {TEMPLATE_OPTIONS.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.label} ({tpl.badge})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {paperForm.editingId ? 'บันทึกการแก้ไขขนาดกระดาษ' : 'เพิ่มขนาดกระดาษใหม่'}
                  </span>
                </button>
              </form>
            </div>
          ) : (
            /* TAB 2: SHIRT INVENTORY SIZES */
            <div className="space-y-4">
              {shirts.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1a120d] border border-[#3b2c21] text-center text-xs text-[#b5a594]">
                  ยังไม่มีเสื้อในคลัง กรุณาเพิ่มเสื้อในปุ่ม &quot;+ เพิ่มเสื้อ / สแกน&quot; ก่อน
                </div>
              ) : (
                <>
                  {/* Shirt Picker */}
                  <div className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] text-[#a79786] mb-1">
                        เลือกเสื้อที่ต้องการเพิ่ม / แก้ไขไซส์ในคลัง
                      </label>
                      <select
                        value={activeShirt?.id ?? ''}
                        onChange={(e) => {
                          setSelectedShirtId(e.target.value);
                          setShirtNotice(null);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                      >
                        {shirts.map((s) => (
                          <option key={s.id} value={s.id}>
                            [{s.sku}] {s.name} ({s.sizes.length} ไซส์)
                          </option>
                        ))}
                      </select>
                    </div>

                    {activeShirt && (
                      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#221812] border border-[#3e2f24] shrink-0">
                        <span
                          className="w-5 h-5 rounded-full border border-white/25"
                          style={{ backgroundColor: activeShirt.color }}
                        />
                        <div>
                          <div className="text-xs font-mono text-[#e8c170] font-bold">
                            {activeShirt.sku}
                          </div>
                          <div className="text-[11px] text-[#b4a493]">
                            {activeShirt.sizes.length} ไซส์ • เริ่มต้น{' '}
                            {formatTHB(activeShirt.sizes[0]?.price ?? activeShirt.basePrice)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {shirtNotice && (
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-200 text-xs flex items-center justify-between">
                      <span>{shirtNotice}</span>
                      <button
                        type="button"
                        onClick={() => setShirtNotice(null)}
                        className="text-emerald-300 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {activeShirt && (
                    <>
                      {/* Quick Templates */}
                      <div className="p-3.5 rounded-2xl bg-[#1a120d] border border-[#34261c]">
                        <div className="text-[11px] font-semibold text-[#e6dac9] mb-2">
                          คลิกเพิ่มไซส์มาตรฐานให้ {activeShirt.sku}:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DEFAULT_SIZE_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.label}
                              type="button"
                              onClick={() => handleQuickAddShirtSize(tpl)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#221812] hover:border-[#e8c170] border border-[#3f2f23] text-xs font-mono text-[#f3eadc]"
                            >
                              <Plus className="w-3 h-3 text-[#e8c170]" />
                              <span className="font-bold">{tpl.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Existing Sizes Editor */}
                      <div className="space-y-2">
                        {activeShirt.sizes.map((sz) => (
                          <div
                            key={sz.id}
                            className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-3 rounded-2xl bg-[#1b130e] border border-[#3b2c21]"
                          >
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-[#a79786] mb-1">ไซส์</label>
                              <input
                                type="text"
                                value={sz.label}
                                onChange={(e) =>
                                  handleEditShirtSizeField(sz.id, 'label', e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono font-bold text-[#faf5ee]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-[#a79786] mb-1">
                                รอบอก (&quot;)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min={1}
                                value={sz.chestInch}
                                onChange={(e) =>
                                  handleEditShirtSizeField(
                                    sz.id,
                                    'chestInch',
                                    Math.max(1, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-[#a79786] mb-1">
                                ความยาว (&quot;)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min={1}
                                value={sz.lengthInch}
                                onChange={(e) =>
                                  handleEditShirtSizeField(
                                    sz.id,
                                    'lengthInch',
                                    Math.max(1, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-[#a79786] mb-1">
                                ไหล่ (&quot;)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={sz.shoulderInch ?? ''}
                                placeholder="-"
                                onChange={(e) =>
                                  handleEditShirtSizeField(
                                    sz.id,
                                    'shoulderInch',
                                    e.target.value === ''
                                      ? undefined
                                      : Math.max(0.5, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-[#a79786] mb-1">
                                ราคา (฿)
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={10}
                                value={sz.price}
                                onChange={(e) =>
                                  handleEditShirtSizeField(
                                    sz.id,
                                    'price',
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#e8c170] font-semibold"
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[10px] text-[#a79786] mb-1">สต็อก</label>
                              <input
                                type="number"
                                min={0}
                                value={sz.stock}
                                onChange={(e) =>
                                  handleEditShirtSizeField(
                                    sz.id,
                                    'stock',
                                    Math.max(0, Math.floor(Number(e.target.value) || 0))
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              />
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                disabled={activeShirt.sizes.length <= 1}
                                onClick={() => handleDeleteShirtSize(sz.id)}
                                className="p-2 rounded-lg bg-[#351b1b] hover:bg-[#4e2424] disabled:opacity-35 text-red-200 border border-red-900/40"
                                title="ลบไซส์นี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Custom Size Adder */}
                      <div className="p-4 rounded-2xl bg-[#1a120d] border border-dashed border-[#5a4331]">
                        <div className="text-xs font-semibold text-[#e8c170] mb-2.5 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มไซส์กำหนดเองให้ {activeShirt.sku}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
                          <div>
                            <label className="block text-[10px] text-[#a79786] mb-1">
                              ชื่อไซส์ *
                            </label>
                            <input
                              type="text"
                              value={customLabel}
                              onChange={(e) => setCustomLabel(e.target.value)}
                              placeholder="เช่น 4XL, Kid-L"
                              className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#a79786] mb-1">
                              รอบอก (&quot;)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min={1}
                              value={customChest}
                              onChange={(e) => setCustomChest(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#a79786] mb-1">
                              ความยาว (&quot;)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min={1}
                              value={customLength}
                              onChange={(e) => setCustomLength(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#a79786] mb-1">
                              ไหล่ (&quot;)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              value={customShoulder}
                              onChange={(e) => setCustomShoulder(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#a79786] mb-1">
                              ราคา (฿)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={10}
                              value={customPrice}
                              onChange={(e) => setCustomPrice(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="w-16">
                              <label className="block text-[10px] text-[#a79786] mb-1">สต็อก</label>
                              <input
                                type="number"
                                min={0}
                                value={customStock}
                                onChange={(e) => setCustomStock(e.target.value)}
                                className="w-full px-2 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddCustomShirtSize}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold"
                            >
                              + เพิ่ม
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-t border-[#34261c] bg-[#1a120d] font-sans">
          <span className="text-[11px] text-[#9f8f7f]">
            การเปลี่ยนแปลงทั้งหมดบันทึกลงในสตูดิโอและพร้อมใช้งานบนใบเสร็จทันที
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};

export const SizeManagerModal: React.FC<SizeManagerModalProps> = ({
  isOpen,
  ...props
}) => {
  if (!isOpen) return null;
  return <SizeManagerContent {...props} />;
};
