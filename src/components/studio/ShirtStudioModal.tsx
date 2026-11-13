'use client';

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Ruler,
  ScanText,
  Shirt as ShirtIcon,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { DEFAULT_SIZE_TEMPLATES } from '@/data/shirts';
import { formatTHB } from '@/lib/storage';
import type { Shirt, ShirtSize, ShirtStyle } from '@/types/shirt';

export interface ShirtStudioModalProps {
  isOpen: boolean;
  editingShirt: Shirt | null;
  onClose: () => void;
  onSaveShirt: (shirt: Shirt) => void;
}

const STYLE_OPTIONS: {
  id: ShirtStyle;
  label: string;
  thaiLabel: string;
  defaultCategory: string;
  skuPrefix: string;
}[] = [
  { id: 'tshirt', label: 'T-Shirt', thaiLabel: 'เสื้อยืดคอกลม', defaultCategory: 'T-Shirt', skuPrefix: 'AT-TEE' },
  { id: 'polo', label: 'Polo', thaiLabel: 'เสื้อโปโล', defaultCategory: 'Polo Shirt', skuPrefix: 'AT-PLO' },
  { id: 'oxford', label: 'Oxford', thaiLabel: 'เชิ้ตอ็อกซ์ฟอร์ด', defaultCategory: 'Oxford Shirt', skuPrefix: 'AT-OXF' },
  { id: 'hoodie', label: 'Hoodie', thaiLabel: 'ฮู้ดดี้สเวตเตอร์', defaultCategory: 'Hoodie', skuPrefix: 'AT-HDY' },
];

const FABRIC_SWATCHES: { name: string; hex: string }[] = [
  { name: 'กรมท่านภาลัย', hex: '#1a2332' },
  { name: 'เบอร์กันดีไวน์', hex: '#4c171e' },
  { name: 'เขียวไพรพฤกษา', hex: '#1b3b2b' },
  { name: 'ครีมงาช้าง', hex: '#e8e2d8' },
  { name: 'เอสเพรสโซ่', hex: '#382e25' },
  { name: 'ดำชาร์โคล', hex: '#222225' },
  { name: 'น้ำตาลคาเมล', hex: '#8b6a4b' },
  { name: 'ฟ้าสเลท', hex: '#3b5169' },
  { name: 'เทาหินอ่อน', hex: '#9ca3af' },
  { name: 'ขาวบริสุทธิ์', hex: '#f5f2eb' },
];

const ACCENT_PRESETS: { id: 'gold' | 'silver' | 'white' | 'charcoal'; label: string; hex: string }[] = [
  { id: 'gold', label: 'Gold', hex: '#c8a96e' },
  { id: 'silver', label: 'Silver', hex: '#b0b7c3' },
  { id: 'white', label: 'White', hex: '#f4eee4' },
  { id: 'charcoal', label: 'Charcoal', hex: '#2c2d30' },
];

function createDefaultSku(prefix = 'AT-TEE'): string {
  return `${prefix}-${String(Date.now()).slice(-3)}`;
}

function createUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createDefaultSizes(basePrice: number, prefix: string): ShirtSize[] {
  const starterLabels = new Set(['S', 'M', 'L', 'XL']);
  return DEFAULT_SIZE_TEMPLATES.filter((t) => starterLabels.has(t.label)).map((tpl, idx) => ({
    id: `${prefix}-${tpl.label.toLowerCase()}-${idx + 1}`,
    label: tpl.label,
    chestInch: tpl.chestInch,
    lengthInch: tpl.lengthInch,
    shoulderInch: tpl.shoulderInch,
    price: tpl.label === 'XL' ? basePrice + 60 : basePrice,
    stock: tpl.stock,
  }));
}

function readFileAsCompressedDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) {
        reject(new Error('ข้อมูลรูปภาพว่างเปล่า'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

interface ShirtStudioFormProps {
  editingShirt: Shirt | null;
  onClose: () => void;
  onSaveShirt: (shirt: Shirt) => void;
}

const ShirtStudioForm: React.FC<ShirtStudioFormProps> = ({
  editingShirt,
  onClose,
  onSaveShirt,
}) => {
  const isEditing = Boolean(editingShirt);
  const initialBasePrice = editingShirt?.basePrice ?? 890;

  const [activeTab, setActiveTab] = useState<'info' | 'sizes'>('info');
  const [name, setName] = useState(editingShirt?.name ?? '');
  const [sku, setSku] = useState(
    () => editingShirt?.sku ?? createDefaultSku('AT-TEE')
  );
  const [brandOrCollection, setBrandOrCollection] = useState(
    editingShirt?.brandOrCollection ?? 'ATELIER STUDIO'
  );
  const [style, setStyle] = useState<ShirtStyle>(editingShirt?.style ?? 'tshirt');
  const [category, setCategory] = useState(editingShirt?.category ?? 'T-Shirt');
  const [basePrice, setBasePrice] = useState<number>(initialBasePrice);
  const [color, setColor] = useState(editingShirt?.color ?? '#1a2332');
  const [accentColor, setAccentColor] = useState(editingShirt?.accentColor ?? '#c8a96e');
  const [fabricNote, setFabricNote] = useState(editingShirt?.fabricNote ?? '');
  const [tagText, setTagText] = useState(editingShirt?.tagText ?? '');
  const [frontImageUrl, setFrontImageUrl] = useState(editingShirt?.frontImageUrl ?? '');
  const [backImageUrl, setBackImageUrl] = useState(editingShirt?.backImageUrl ?? '');

  const [sizes, setSizes] = useState<ShirtSize[]>(() => {
    if (editingShirt && editingShirt.sizes.length > 0) {
      return editingShirt.sizes.map((s) => ({ ...s }));
    }
    return createDefaultSizes(initialBasePrice, `sz-${Date.now()}`);
  });

  // Custom size form state
  const [newLabel, setNewLabel] = useState('');
  const [newChest, setNewChest] = useState('42');
  const [newLength, setNewLength] = useState('28.5');
  const [newShoulder, setNewShoulder] = useState('19');
  const [newPrice, setNewPrice] = useState(String(initialBasePrice));
  const [newStock, setNewStock] = useState('10');

  // Upload & AI Scan feedback state
  const [uploadingSide, setUploadingSide] = useState<'front' | 'back' | null>(null);
  const [aiStatus, setAiStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const frontFileRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const tagScanFileRef = useRef<HTMLInputElement>(null);

  const handleStyleSelect = (nextStyle: ShirtStyle) => {
    const prevMeta = STYLE_OPTIONS.find((s) => s.id === style);
    const nextMeta = STYLE_OPTIONS.find((s) => s.id === nextStyle);
    setStyle(nextStyle);
    if (nextMeta && (!category.trim() || category === prevMeta?.defaultCategory)) {
      setCategory(nextMeta.defaultCategory);
    }
  };

  const handleRegenerateSku = () => {
    const meta = STYLE_OPTIONS.find((s) => s.id === style);
    const prefix = meta?.skuPrefix ?? 'AT-SH';
    const num = String(Math.floor(10 + Math.random() * 89));
    setSku(`${prefix}-${num}`);
  };

  const handleImageFileUpload = async (file: File, side: 'front' | 'back') => {
    setUploadingSide(side);
    setFormError(null);
    try {
      const localDataUrl = await readFileAsCompressedDataUrl(file);
      let resolvedUrl = localDataUrl;

      try {
        const body = new FormData();
        body.append('file', file);
        body.append('type', side);
        const res = await fetch('/api/upload-cover', { method: 'POST', body });
        if (res.ok) {
          const data = (await res.json()) as { success?: boolean; url?: string; webContentLink?: string };
          if (data.success && (data.webContentLink || data.url)) {
            // Keep local data URL if Drive link isn't directly CORS-readable for Three.js CanvasTexture,
            // or use local data URL for reliable 3D rendering while keeping upload successful.
            resolvedUrl = localDataUrl;
          }
        }
      } catch {
        // Gracefully use local compressed data URL
      }

      if (side === 'front') {
        setFrontImageUrl(resolvedUrl);
      } else {
        setBackImageUrl(resolvedUrl);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
    } finally {
      setUploadingSide(null);
    }
  };

  const runGeminiScan = async (imageSource: string, mode: 'ocr' | 'categorize') => {
    if (!imageSource) {
      setAiStatus({
        type: 'error',
        message: 'กรุณาอัปโหลดรูปเสื้อหรือรูปป้ายแท็กก่อนใช้งาน AI Scan',
      });
      return;
    }

    setIsAiBusy(true);
    setAiStatus({
      type: 'info',
      message:
        mode === 'ocr'
          ? 'กำลังอ่านข้อความป้ายสินค้า / ตารางไซส์ด้วย Gemini AI...'
          : 'กำลังวิเคราะห์ทรงเสื้อ เนื้อผ้า และโทนสีด้วย Gemini AI...',
    });

    try {
      const res = await fetch('/api/gemini-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageSource,
          mode,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        code?: string;
        text?: string;
        data?: {
          name?: string;
          sku?: string;
          category?: string;
          style?: ShirtStyle;
          recommendedColor?: string;
          accentColor?: string;
          fabricNote?: string;
          estimatedPrice?: number;
          price?: number;
          summary?: string;
          sizes?: {
            label: string;
            chestInch?: number;
            lengthInch?: number;
            shoulderInch?: number;
            price?: number;
          }[];
        };
      };

      if (!res.ok || !json.success) {
        if (res.status === 503 || json.code === 'MISSING_GEMINI_API_KEY') {
          setAiStatus({
            type: 'error',
            message:
              'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในเซิร์ฟเวอร์ — สามารถกรอกข้อมูลเสื้อและไซส์ด้วยตนเองได้ทันที',
          });
        } else {
          setAiStatus({
            type: 'error',
            message: json.error || 'ไม่สามารถสแกนรูปภาพด้วย AI ได้ กรุณากรอกข้อมูลด้วยตนเอง',
          });
        }
        return;
      }

      const data = json.data;
      if (mode === 'categorize' && data) {
        if (data.name) setName(data.name);
        if (data.sku) setSku(data.sku);
        if (data.category) setCategory(data.category);
        if (data.style) setStyle(data.style);
        if (data.recommendedColor) setColor(data.recommendedColor);
        if (data.accentColor) setAccentColor(data.accentColor);
        if (data.fabricNote) setFabricNote(data.fabricNote);
        if (typeof data.estimatedPrice === 'number' && data.estimatedPrice > 0) {
          setBasePrice(data.estimatedPrice);
          setNewPrice(String(data.estimatedPrice));
        }
        setAiStatus({
          type: 'success',
          message: data.summary || 'วิเคราะห์รูปเสื้อและเติมข้อมูลแนะนำเรียบร้อยแล้ว',
        });
      } else if (mode === 'ocr' && data) {
        if (data.name && !name.trim()) setName(data.name);
        if (data.sku) setSku(data.sku);
        if (typeof data.price === 'number' && data.price > 0) {
          setBasePrice(data.price);
          setNewPrice(String(data.price));
        }
        if (data.fabricNote) setFabricNote(data.fabricNote);
        if (json.text && !tagText.trim()) {
          setTagText(json.text.slice(0, 48));
        }
        if (Array.isArray(data.sizes) && data.sizes.length > 0) {
          const imported: ShirtSize[] = data.sizes.map((s, idx) => ({
            id: `scan-${Date.now()}-${idx}`,
            label: s.label,
            chestInch: s.chestInch && s.chestInch > 0 ? s.chestInch : 40,
            lengthInch: s.lengthInch && s.lengthInch > 0 ? s.lengthInch : 28,
            shoulderInch: s.shoulderInch && s.shoulderInch > 0 ? s.shoulderInch : undefined,
            price: typeof s.price === 'number' && s.price >= 0 ? s.price : basePrice,
            stock: 10,
          }));
          setSizes(imported);
        }
        setAiStatus({
          type: 'success',
          message: json.text
            ? `สแกนป้ายสำเร็จ: ${json.text.slice(0, 120)}`
            : 'สแกนป้ายสินค้าเรียบร้อยแล้ว',
        });
      }
    } catch {
      setAiStatus({
        type: 'error',
        message: 'การเชื่อมต่อ AI Scan ขัดข้อง — กรุณากรอกรายละเอียดด้วยตนเอง',
      });
    } finally {
      setIsAiBusy(false);
    }
  };

  const handleQuickTagScanFile = async (file: File) => {
    try {
      const dataUrl = await readFileAsCompressedDataUrl(file);
      await runGeminiScan(dataUrl, 'ocr');
    } catch (err) {
      setAiStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'อ่านไฟล์รูปป้ายไม่สำเร็จ',
      });
    }
  };

  const handleQuickAddTemplate = (tpl: Omit<ShirtSize, 'id'>) => {
    const exists = sizes.some((s) => s.label.trim().toUpperCase() === tpl.label.toUpperCase());
    const labelToUse = exists ? `${tpl.label}-${sizes.length + 1}` : tpl.label;
    const priceToUse =
      tpl.label === 'XL' || tpl.label === '2XL' || tpl.label === '3XL'
        ? Math.max(basePrice, tpl.price)
        : basePrice || tpl.price;

    setSizes((prev) => [
      ...prev,
      {
        id: createUniqueId('sz'),
        label: labelToUse,
        chestInch: tpl.chestInch,
        lengthInch: tpl.lengthInch,
        shoulderInch: tpl.shoulderInch,
        price: priceToUse,
        stock: tpl.stock,
      },
    ]);
    setFormError(null);
  };

  const handleAddCustomSize = () => {
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) {
      setFormError('กรุณาระบุชื่อไซส์ก่อนกดเพิ่ม (เช่น M+, Oversize, 44")');
      return;
    }
    const chest = Math.max(1, Number(newChest) || 40);
    const length = Math.max(1, Number(newLength) || 28);
    const shoulder = newShoulder.trim() === '' ? undefined : Math.max(1, Number(newShoulder) || 18);
    const price = Math.max(0, Number(newPrice) || basePrice || 0);
    const stock = Math.max(0, Math.floor(Number(newStock) || 0));

    setSizes((prev) => [
      ...prev,
      {
        id: createUniqueId('sz-custom'),
        label: trimmedLabel,
        chestInch: chest,
        lengthInch: length,
        ...(shoulder !== undefined ? { shoulderInch: shoulder } : {}),
        price,
        stock,
      },
    ]);
    setNewLabel('');
    setFormError(null);
  };

  const handleUpdateSizeField = <K extends keyof ShirtSize>(
    sizeId: string,
    field: K,
    value: ShirtSize[K]
  ) => {
    setSizes((prev) =>
      prev.map((sz) => (sz.id === sizeId ? { ...sz, [field]: value } : sz))
    );
  };

  const handleDeleteSize = (sizeId: string) => {
    if (sizes.length <= 1) {
      setFormError('ต้องมีอย่างน้อย 1 ไซส์สำหรับเสื้อแต่ละแบบ');
      return;
    }
    setSizes((prev) => prev.filter((s) => s.id !== sizeId));
    setFormError(null);
  };

  const handleApplyBasePriceToSizes = () => {
    const safePrice = Math.max(0, Number(basePrice) || 0);
    setSizes((prev) => prev.map((sz) => ({ ...sz, price: safePrice })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setActiveTab('info');
      setFormError('กรุณากรอกชื่อเสื้อ (Name) ก่อนบันทึก');
      return;
    }

    const sanitizedSizes: ShirtSize[] = sizes
      .map((sz, idx) => ({
        id: sz.id || `sz-${Date.now()}-${idx}`,
        label: sz.label.trim() || `Size ${idx + 1}`,
        chestInch: Number.isFinite(sz.chestInch) && sz.chestInch > 0 ? sz.chestInch : 40,
        lengthInch: Number.isFinite(sz.lengthInch) && sz.lengthInch > 0 ? sz.lengthInch : 28,
        ...(typeof sz.shoulderInch === 'number' && Number.isFinite(sz.shoulderInch) && sz.shoulderInch > 0
          ? { shoulderInch: sz.shoulderInch }
          : {}),
        price: Number.isFinite(sz.price) && sz.price >= 0 ? sz.price : Math.max(0, basePrice),
        stock: Number.isFinite(sz.stock) && sz.stock >= 0 ? Math.floor(sz.stock) : 0,
      }));

    if (sanitizedSizes.length === 0) {
      setActiveTab('sizes');
      setFormError('ต้องมีอย่างน้อย 1 ไซส์ก่อนบันทึก');
      return;
    }

    const shirtPayload: Shirt = {
      id: editingShirt?.id ?? `shirt-${Date.now()}`,
      sku: sku.trim() || `AT-${style.toUpperCase().slice(0, 3)}-${String(Date.now()).slice(-3)}`,
      name: trimmedName,
      brandOrCollection: brandOrCollection.trim() || 'ATELIER STUDIO',
      category: category.trim() || 'T-Shirt',
      style,
      color: color.trim() || '#1a2332',
      accentColor: accentColor.trim() || '#c8a96e',
      basePrice: Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : sanitizedSizes[0].price,
      ...(fabricNote.trim() ? { fabricNote: fabricNote.trim() } : {}),
      ...(tagText.trim() ? { tagText: tagText.trim() } : {}),
      ...(frontImageUrl.trim() ? { frontImageUrl: frontImageUrl.trim() } : {}),
      ...(backImageUrl.trim() ? { backImageUrl: backImageUrl.trim() } : {}),
      sizes: sanitizedSizes,
      createdAt: editingShirt?.createdAt ?? new Date().toISOString(),
    };

    onSaveShirt(shirtPayload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'แก้ไขข้อมูลเสื้อและไซส์' : 'เพิ่มเสื้อเข้าสู่ราวแขวน'}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#140e0b] border border-[#4a3728] shadow-2xl overflow-hidden text-[#f4ede3]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-[#34261c] bg-[#1a120d]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl border border-[#5a4230] flex items-center justify-center shrink-0 shadow-inner"
              style={{ backgroundColor: color }}
            >
              <ShirtIcon className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#e8c170]">
                {isEditing ? `EDIT GARMENT • ${editingShirt?.sku}` : 'ATELIER GARMENT STUDIO'}
              </p>
              <h2 className="text-base sm:text-lg font-serif font-bold text-[#faf5ee] truncate">
                {isEditing ? `แก้ไขเสื้อ: ${editingShirt?.name}` : 'เพิ่มเสื้อใหม่เข้าสู่ราวแขวน 3D'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-[#241a13] hover:bg-[#35261c] text-[#d6c9b8] border border-[#483628] transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-5 sm:px-7 pt-3 pb-2 border-b border-[#2e2219] bg-[#17100c]">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans font-semibold transition-all border ${
              activeTab === 'info'
                ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] shadow'
                : 'bg-[#211812] text-[#cbbca9] border-[#3d2d21] hover:border-[#6a503b] hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>1. ข้อมูลเสื้อ &amp; สีผ้า</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sizes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans font-semibold transition-all border ${
              activeTab === 'sizes'
                ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] shadow'
                : 'bg-[#211812] text-[#cbbca9] border-[#3d2d21] hover:border-[#6a503b] hover:text-white'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>2. จัดการไซส์เสื้อ &amp; ราคา</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'sizes' ? 'bg-[#1c1410] text-[#e8c170]' : 'bg-[#33261d] text-[#e8c170]'
              }`}
            >
              {sizes.length}
            </span>
          </button>
        </div>

        {/* Error Banner */}
        {formError && (
          <div className="mx-5 sm:mx-7 mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-950/70 border border-red-800/70 text-red-200 text-xs font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 font-sans">
          {activeTab === 'info' ? (
            <>
              {/* Style Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#e6dac9] mb-2">
                  ทรงเสื้อ (Shirt Silhouette 3D)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {STYLE_OPTIONS.map((opt) => {
                    const active = style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleStyleSelect(opt.id)}
                        className={`text-left p-3 rounded-2xl border transition-all ${
                          active
                            ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#faf5ee] shadow-md'
                            : 'bg-[#1d1510] border-[#3c2d21] text-[#c7b7a6] hover:border-[#684e39]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono uppercase">{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[#e8c170]" />}
                        </div>
                        <p className="text-[11px] text-[#a79786] mt-0.5">{opt.thaiLabel}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    ชื่อเสื้อ (Garment Name) <span className="text-[#e8c170]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="เช่น Atelier Supima Tee — กรมท่านภาลัย"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-sm text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    รหัสสินค้า (SKU)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="AT-TEE-01"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs font-mono uppercase text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateSku}
                      className="px-3 py-2 rounded-xl bg-[#261b14] hover:bg-[#35261c] border border-[#493729] text-[11px] text-[#e8c170] font-medium whitespace-nowrap"
                      title="สุ่มรหัส SKU ใหม่"
                    >
                      สุ่มรหัส
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    แบรนด์ / คอลเลกชัน (Brand / Collection)
                  </label>
                  <input
                    type="text"
                    value={brandOrCollection}
                    onChange={(e) => setBrandOrCollection(e.target.value)}
                    placeholder="ATELIER CORE"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    หมวดหมู่ (Category)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="T-Shirt / Oxford Shirt / Resort Polo"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    ราคาตั้งต้น (Base Price THB)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={basePrice}
                      onChange={(e) => setBasePrice(Math.max(0, Number(e.target.value) || 0))}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs font-mono text-[#faf5ee] focus:outline-none focus:border-[#e8c170]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBasePriceToSizes}
                      className="px-3 py-2 rounded-xl bg-[#261b14] hover:bg-[#35261c] border border-[#493729] text-[11px] text-[#d6c8b6] whitespace-nowrap"
                      title="อัปเดตราคาพื้นฐานนี้ให้ทุกไซส์"
                    >
                      ใช้กับทุกไซส์
                    </button>
                  </div>
                </div>
              </div>

              {/* Fabric Color & Accent Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#1a120d] border border-[#34261c]">
                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-2">
                    สีผ้าหลัก (Fabric Color)
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {FABRIC_SWATCHES.map((swatch) => {
                      const active = color.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setColor(swatch.hex)}
                          title={`${swatch.name} (${swatch.hex})`}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            active
                              ? 'border-[#e8c170] scale-110 ring-2 ring-[#e8c170]/35'
                              : 'border-[#4a3728] hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1a2332'}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#443326] bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1f1611] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                      placeholder="#1a2332"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-2">
                    สีตะเข็บ / ป้ายคอ / อะไหล่ (Accent Color)
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    {ACCENT_PRESETS.map((preset) => {
                      const active = accentColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAccentColor(preset.hex)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                            active
                              ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#faf5ee]'
                              : 'bg-[#1f1611] border-[#3d2e22] text-[#c7b7a6] hover:border-[#6a503b]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span className="font-medium">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : '#c8a96e'}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#443326] bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1f1611] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                </div>
              </div>

              {/* Fabric Note & Hangtag Text */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    รายละเอียดเนื้อผ้า (Fabric &amp; Care Note)
                  </label>
                  <textarea
                    rows={2}
                    value={fabricNote}
                    onChange={(e) => setFabricNote(e.target.value)}
                    placeholder="เช่น 100% Supima Cotton 260 GSM — ผ้าทอแน่นสัมผัสนุ่ม ซักเครื่องโหมดถนอมผ้า"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6dac9] mb-1.5">
                    ข้อความบนป้ายแท็ก (Hangtag Text)
                  </label>
                  <div className="relative">
                    <Tag className="w-3.5 h-3.5 text-[#a79786] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      placeholder="SUPIMA 260G"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#1f1611] border border-[#443326] text-xs font-mono text-[#faf5ee] placeholder:text-[#7a6b5d] focus:outline-none focus:border-[#e8c170]"
                    />
                  </div>
                  <p className="text-[10px] text-[#968677] mt-1">
                    แสดงบนแท็กชายเสื้อในโมเดล 3D
                  </p>
                </div>
              </div>

              {/* Front / Back Image Upload & AI Tag Scan */}
              <div className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-[#faf5ee] flex items-center gap-1.5">
                      <ImagePlus className="w-4 h-4 text-[#e8c170]" />
                      <span>รูปถ่ายเสื้อด้านหน้า / ด้านหลัง &amp; AI Tag Scan (ไม่บังคับ)</span>
                    </h3>
                    <p className="text-[11px] text-[#9e8e7e] mt-0.5">
                      อัปโหลดรูปจริงเพื่อแสดงบนตัวเสื้อ 3D หรือสแกนป้ายสินค้าเพื่อดึงข้อมูลอัตโนมัติ
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={tagScanFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleQuickTagScanFile(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={isAiBusy}
                      onClick={() => tagScanFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a1e16] hover:bg-[#3a2a1f] disabled:opacity-50 border border-[#56402f] text-xs text-[#e8c170] font-medium"
                    >
                      {isAiBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanText className="w-3.5 h-3.5" />
                      )}
                      <span>AI สแกนป้ายแท็ก</span>
                    </button>

                    {frontImageUrl && (
                      <button
                        type="button"
                        disabled={isAiBusy}
                        onClick={() => void runGeminiScan(frontImageUrl, 'categorize')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#e8c170]/15 hover:bg-[#e8c170]/25 disabled:opacity-50 border border-[#e8c170]/50 text-xs text-[#f6d992] font-medium"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>AI วิเคราะห์รูปเสื้อ</span>
                      </button>
                    )}
                  </div>
                </div>

                {aiStatus && (
                  <div
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs border ${
                      aiStatus.type === 'error'
                        ? 'bg-amber-950/50 border-amber-800/60 text-amber-200'
                        : aiStatus.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
                        : 'bg-[#251b14] border-[#4b3829] text-[#e6dac9]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{aiStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Front Image */}
                  <div className="p-3 rounded-xl bg-[#1f1611] border border-[#3d2e22] flex items-center gap-3">
                    <input
                      ref={frontFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageFileUpload(file, 'front');
                        e.target.value = '';
                      }}
                    />
                    <div className="w-16 h-16 rounded-xl bg-[#140e0b] border border-[#3c2d21] flex items-center justify-center overflow-hidden shrink-0">
                      {frontImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={frontImageUrl} alt="Front preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 text-[#7a6b5d]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#f3eadc]">รูปด้านหน้า (Front)</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => frontFileRef.current?.click()}
                          disabled={uploadingSide === 'front'}
                          className="px-2.5 py-1 rounded-lg bg-[#2e2219] hover:bg-[#3f2f23] text-[11px] text-[#e8c170] border border-[#4e3b2c]"
                        >
                          {uploadingSide === 'front' ? 'กำลังโหลด...' : frontImageUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                        </button>
                        {frontImageUrl && (
                          <button
                            type="button"
                            onClick={() => setFrontImageUrl('')}
                            className="px-2 py-1 rounded-lg bg-[#351b1b] hover:bg-[#4c2424] text-[11px] text-red-200"
                          >
                            ลบรูป
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Back Image */}
                  <div className="p-3 rounded-xl bg-[#1f1611] border border-[#3d2e22] flex items-center gap-3">
                    <input
                      ref={backFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageFileUpload(file, 'back');
                        e.target.value = '';
                      }}
                    />
                    <div className="w-16 h-16 rounded-xl bg-[#140e0b] border border-[#3c2d21] flex items-center justify-center overflow-hidden shrink-0">
                      {backImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={backImageUrl} alt="Back preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 text-[#7a6b5d]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#f3eadc]">รูปด้านหลัง (Back)</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => backFileRef.current?.click()}
                          disabled={uploadingSide === 'back'}
                          className="px-2.5 py-1 rounded-lg bg-[#2e2219] hover:bg-[#3f2f23] text-[11px] text-[#e8c170] border border-[#4e3b2c]"
                        >
                          {uploadingSide === 'back' ? 'กำลังโหลด...' : backImageUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                        </button>
                        {backImageUrl && (
                          <button
                            type="button"
                            onClick={() => setBackImageUrl('')}
                            className="px-2 py-1 rounded-lg bg-[#351b1b] hover:bg-[#4c2424] text-[11px] text-red-200"
                          >
                            ลบรูป
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: SHIRT SIZE & PRICE MANAGER */
            <div className="space-y-4">
              {/* Quick Add from DEFAULT_SIZE_TEMPLATES */}
              <div className="p-4 rounded-2xl bg-[#1a120d] border border-[#34261c]">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div>
                    <h3 className="text-xs font-semibold text-[#faf5ee]">
                      เพิ่มไซส์มาตรฐานอย่างรวดเร็ว (Quick Add Templates)
                    </h3>
                    <p className="text-[11px] text-[#9e8e7e]">
                      คลิกเพื่อเพิ่มไซส์ XS – 3XL หรือ Freesize พร้อมสัดส่วนแนะนำเข้าสู่ตารางทันที
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SIZE_TEMPLATES.map((tpl) => {
                    const hasLabel = sizes.some(
                      (s) => s.label.trim().toUpperCase() === tpl.label.toUpperCase()
                    );
                    return (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => handleQuickAddTemplate(tpl)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                          hasLabel
                            ? 'bg-[#2a2119] border-[#5b4634] text-[#e8c170]'
                            : 'bg-[#211812] border-[#3d2e22] text-[#efe5d7] hover:border-[#e8c170]'
                        }`}
                      >
                        <Plus className="w-3 h-3 text-[#e8c170]" />
                        <span className="font-bold">{tpl.label}</span>
                        <span className="text-[10px] text-[#9f8f7f]">
                          ({tpl.chestInch}&quot;/{tpl.lengthInch}&quot;)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Sizes List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#faf5ee]">
                    รายการไซส์ของเสื้อรุ่นนี้ ({sizes.length} ไซส์ — แก้ไขได้ทุกช่อง)
                  </h3>
                  <span className="text-[11px] text-[#9e8e7e]">
                    หน่วยสัดส่วน: นิ้ว (Inch) • ราคา: บาท (THB)
                  </span>
                </div>

                <div className="space-y-2">
                  {sizes.map((sz) => (
                    <div
                      key={sz.id}
                      className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-3 rounded-2xl bg-[#1b130e] border border-[#3b2c21]"
                    >
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[#a79786] mb-1">ชื่อไซส์</label>
                        <input
                          type="text"
                          value={sz.label}
                          onChange={(e) => handleUpdateSizeField(sz.id, 'label', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono font-bold text-[#faf5ee]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[#a79786] mb-1">รอบอก (&quot;)</label>
                        <input
                          type="number"
                          step="0.5"
                          min={1}
                          value={sz.chestInch}
                          onChange={(e) =>
                            handleUpdateSizeField(
                              sz.id,
                              'chestInch',
                              Math.max(1, Number(e.target.value) || 0)
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[#a79786] mb-1">ความยาว (&quot;)</label>
                        <input
                          type="number"
                          step="0.5"
                          min={1}
                          value={sz.lengthInch}
                          onChange={(e) =>
                            handleUpdateSizeField(
                              sz.id,
                              'lengthInch',
                              Math.max(1, Number(e.target.value) || 0)
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-[#a79786] mb-1">ไหล่ (&quot;)</label>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          value={sz.shoulderInch ?? ''}
                          placeholder="-"
                          onChange={(e) =>
                            handleUpdateSizeField(
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
                        <label className="block text-[10px] text-[#a79786] mb-1">ราคา (฿)</label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={sz.price}
                          onChange={(e) =>
                            handleUpdateSizeField(
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
                            handleUpdateSizeField(
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
                          onClick={() => handleDeleteSize(sz.id)}
                          disabled={sizes.length <= 1}
                          title={sizes.length <= 1 ? 'ต้องมีอย่างน้อย 1 ไซส์' : 'ลบไซส์นี้'}
                          className="p-2 rounded-lg bg-[#351b1b] hover:bg-[#4e2424] disabled:opacity-35 text-red-200 border border-red-900/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Custom Size Form */}
              <div className="p-4 rounded-2xl bg-[#1a120d] border border-dashed border-[#5a4331]">
                <h4 className="text-xs font-semibold text-[#e8c170] mb-3 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มไซส์กำหนดเอง (Custom Size)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ชื่อไซส์ *</label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="เช่น 4XL, Boxy-M"
                      className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">รอบอก (นิ้ว)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={newChest}
                      onChange={(e) => setNewChest(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ความยาว (นิ้ว)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={newLength}
                      onChange={(e) => setNewLength(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ไหล่ (นิ้ว)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={newShoulder}
                      onChange={(e) => setNewShoulder(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#a79786] mb-1">ราคา (฿)</label>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="w-16">
                      <label className="block text-[10px] text-[#a79786] mb-1">สต็อก</label>
                      <input
                        type="number"
                        min={0}
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        className="w-full px-2 py-2 rounded-xl bg-[#140e0b] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomSize}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold whitespace-nowrap"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-[#34261c] bg-[#1a120d] font-sans">
          <div className="flex items-center gap-2.5 text-xs text-[#b8a998]">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/25 inline-block"
              style={{ backgroundColor: color }}
            />
            <span className="font-mono text-[#e8c170]">{sku || 'NEW-SKU'}</span>
            <span>•</span>
            <span>{sizes.length} ไซส์</span>
            <span>•</span>
            <span>เริ่มต้น {formatTHB(sizes[0]?.price ?? basePrice)}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#241a13] hover:bg-[#34261c] text-[#dcd0c0] border border-[#473527] text-xs font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold tracking-wide shadow-lg transition-transform active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'บันทึกการแก้ไขเสื้อ' : 'บันทึกเสื้อเข้าสู่ราวแขวน'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export const ShirtStudioModal: React.FC<ShirtStudioModalProps> = ({
  isOpen,
  editingShirt,
  onClose,
  onSaveShirt,
}) => {
  if (!isOpen) return null;

  return (
    <ShirtStudioForm
      key={editingShirt ? `edit-${editingShirt.id}` : 'create-new'}
      editingShirt={editingShirt}
      onClose={onClose}
      onSaveShirt={onSaveShirt}
    />
  );
};
