'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Pencil,
  Plus,
  Receipt,
  Ruler,
  Search,
  Shirt as ShirtIcon,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { Shirt, ShirtSize } from '@/types/shirt';
import { formatTHB } from '@/lib/storage';
import { ShirtModel } from './ShirtModel';
import { WardrobeRack } from './WardrobeRack';
import { ShirtInspectionView } from './ShirtInspectionView';

export interface ClothingRackCanvasProps {
  shirts: Shirt[];
  receiptItemCount: number;
  receiptTotal: number;
  onOpenStudio: () => void;
  onEditShirt: (shirt: Shirt) => void;
  onOpenReceipt: () => void;
  onOpenSizeManager: () => void;
  onAddToReceipt: (shirt: Shirt, size: ShirtSize, quantity: number) => void;
  onDeleteShirt: (shirtId: string) => void;
}

const STYLE_LABELS: Record<string, string> = {
  tshirt: 'T-Shirt',
  polo: 'Polo',
  oxford: 'Oxford',
  hoodie: 'Hoodie',
};

function getPriceSummary(shirt: Shirt): string {
  if (!shirt.sizes || shirt.sizes.length === 0) {
    return formatTHB(shirt.basePrice || 0);
  }
  const prices = shirt.sizes.map((s) => s.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  return minP === maxP ? formatTHB(minP) : `${formatTHB(minP)} – ${formatTHB(maxP)}`;
}

interface RackCameraRigProps {
  scrollX: number;
}

const RackCameraRig: React.FC<RackCameraRigProps> = ({ scrollX }) => {
  const initializedRef = useRef(false);

  useFrame((state, delta) => {
    const cam = state.camera;
    if (!initializedRef.current) {
      cam.position.set(scrollX, 2.55, 8.6);
      cam.lookAt(scrollX, 2.35, 0);
      initializedRef.current = true;
      return;
    }

    const damp = Math.min(1, delta * 8);
    const nextX = THREE.MathUtils.lerp(cam.position.x, scrollX, damp);
    const nextY = THREE.MathUtils.lerp(cam.position.y, 2.55, damp);
    const nextZ = THREE.MathUtils.lerp(cam.position.z, 8.6, damp);
    cam.position.set(nextX, nextY, nextZ);
    cam.lookAt(nextX, 2.35, 0);
  });

  return null;
};

interface RackSceneProps {
  shirts: Shirt[];
  scrollX: number;
  hoveredShirtId: string | null;
  onHoverShirt: (id: string | null) => void;
  onSelectShirt: (shirt: Shirt) => void;
}

const RACK_SPACING = 1.9;
const SHIRT_HANG_Y = 2.65; // Aligns hook arch (local y=1.70) onto rail at y=4.35

const RackScene: React.FC<RackSceneProps> = ({
  shirts,
  scrollX,
  hoveredShirtId,
  onHoverShirt,
  onSelectShirt,
}) => {
  const placements = useMemo(() => {
    if (shirts.length === 0) return [];
    const totalSpan = (shirts.length - 1) * RACK_SPACING;
    const startX = -totalSpan / 2;
    return shirts.map((shirt, idx) => ({
      shirt,
      position: [startX + idx * RACK_SPACING, SHIRT_HANG_Y, 0] as [number, number, number],
    }));
  }, [shirts]);

  return (
    <>
      <RackCameraRig scrollX={scrollX} />

      {/* Warm Flagship Boutique Lighting */}
      <ambientLight intensity={0.78} />
      <directionalLight position={[scrollX, 5.5, 9]} intensity={1.75} color="#fffbf2" castShadow />
      <directionalLight position={[scrollX - 6, 3, 6]} intensity={0.55} color="#ffd7aa" />
      <directionalLight position={[scrollX + 6, 3, 6]} intensity={0.55} color="#e5ecf5" />

      {/* Architectural Walnut & Brushed Brass Garment Rack */}
      <WardrobeRack rackLength={Math.max(32, shirts.length * 2.5 + 10)} rackDepth={3.8} />

      {/* Hanging Garments on Sculpted Walnut/Brass Hangers */}
      {placements.map(({ shirt, position }) => (
        <ShirtModel
          key={shirt.id}
          shirt={shirt}
          position={position}
          rotation={[0, 0.24, 0]}
          isHovered={hoveredShirtId === shirt.id}
          onClick={() => onSelectShirt(shirt)}
          onPointerOver={() => onHoverShirt(shirt.id)}
          onPointerOut={() => onHoverShirt(null)}
        />
      ))}
    </>
  );
};

export const ClothingRackCanvas: React.FC<ClothingRackCanvasProps> = ({
  shirts,
  receiptItemCount,
  receiptTotal,
  onOpenStudio,
  onEditShirt,
  onOpenReceipt,
  onOpenSizeManager,
  onAddToReceipt,
  onDeleteShirt,
}) => {
  const [rawScrollX, setRawScrollX] = useState<number>(0);
  const [selectedShirtId, setSelectedShirtId] = useState<string | null>(null);
  const [hoveredShirtId, setHoveredShirtId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const initialScrollX = useRef(0);
  const dragDistance = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive always-fresh selectedShirt from shirts array so modal edits reflect immediately
  const selectedShirt = useMemo(
    () => shirts.find((s) => s.id === selectedShirtId) ?? null,
    [shirts, selectedShirtId]
  );

  // Unique category pills
  const categories = useMemo(() => {
    const unique = Array.from(new Set(shirts.map((s) => s.category).filter(Boolean)));
    return ['ทั้งหมด', ...unique];
  }, [shirts]);

  // Filter shirts by category AND search (name / SKU / category / size label)
  const filteredShirts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shirts.filter((shirt) => {
      if (selectedCategory !== 'ทั้งหมด' && shirt.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const matchName = shirt.name.toLowerCase().includes(q);
      const matchSku = shirt.sku.toLowerCase().includes(q);
      const matchCategory = shirt.category.toLowerCase().includes(q);
      const matchCollection = shirt.brandOrCollection.toLowerCase().includes(q);
      const matchStyle = shirt.style.toLowerCase().includes(q);
      const matchSize = shirt.sizes?.some((sz) => sz.label.toLowerCase().includes(q));
      return matchName || matchSku || matchCategory || matchCollection || matchStyle || matchSize;
    });
  }, [shirts, selectedCategory, searchQuery]);

  const hoveredShirt = useMemo(
    () => filteredShirts.find((s) => s.id === hoveredShirtId) ?? null,
    [filteredShirts, hoveredShirtId]
  );

  const maxScroll = Math.max(1.5, ((filteredShirts.length - 1) * RACK_SPACING) / 2 + 0.6);
  const minScroll = -maxScroll;
  const scrollX = Math.max(minScroll, Math.min(maxScroll, rawScrollX));

  // Sync default selected size whenever opening or switching selectedShirt
  const selectedSize = useMemo(() => {
    if (!selectedShirt || !selectedShirt.sizes || selectedShirt.sizes.length === 0) return null;
    const found = selectedShirt.sizes.find((sz) => sz.id === selectedSizeId);
    if (found) return found;
    return selectedShirt.sizes.find((sz) => sz.stock > 0) ?? selectedShirt.sizes[0];
  }, [selectedShirt, selectedSizeId]);

  const handleOpenInspection = (shirt: Shirt) => {
    if (dragDistance.current > 8) return;
    setSelectedShirtId(shirt.id);
    const defaultSize = shirt.sizes.find((sz) => sz.stock > 0) ?? shirt.sizes[0];
    setSelectedSizeId(defaultSize?.id ?? '');
    setQuantity(1);
    setHoveredShirtId(null);
  };

  const handleCloseInspection = () => {
    setSelectedShirtId(null);
    setAddedToast(null);
  };

  // Drag / Swipe / Wheel / Keyboard scrolling along the rack
  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, input, textarea, select, a, [data-no-drag="true"]'));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedShirt || isInteractiveTarget(e.target)) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    initialScrollX.current = scrollX;
    dragDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || selectedShirt) return;
    const dx = e.clientX - dragStartX.current;
    dragDistance.current = Math.max(dragDistance.current, Math.abs(dx));
    const deltaX = dx * 0.015;
    setRawScrollX(Math.max(minScroll, Math.min(maxScroll, initialScrollX.current - deltaX)));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (selectedShirt || e.touches.length === 0 || isInteractiveTarget(e.target)) return;
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    initialScrollX.current = scrollX;
    dragDistance.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || selectedShirt || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    dragDistance.current = Math.max(dragDistance.current, Math.abs(dx));
    const deltaX = dx * 0.016;
    setRawScrollX(Math.max(minScroll, Math.min(maxScroll, initialScrollX.current - deltaX)));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedShirt) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    setRawScrollX((prev) => Math.max(minScroll, Math.min(maxScroll, prev + delta * 0.008)));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (selectedShirt) {
        if (e.key === 'Escape') handleCloseInspection();
        return;
      }
      if (e.key === 'ArrowRight') {
        setRawScrollX((prev) => Math.min(maxScroll, prev + RACK_SPACING));
      } else if (e.key === 'ArrowLeft') {
        setRawScrollX((prev) => Math.max(minScroll, prev - RACK_SPACING));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShirt, maxScroll, minScroll]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleAddSelectedToReceipt = () => {
    if (!selectedShirt || !selectedSize) return;
    onAddToReceipt(selectedShirt, selectedSize, quantity);
    setAddedToast(`เพิ่ม ${selectedShirt.sku} (${selectedSize.label} x${quantity}) ลงใบเสร็จแล้ว`);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setAddedToast(null), 2600);
  };

  const handleDeleteCurrentShirt = () => {
    if (!selectedShirt) return;
    if (confirm(`คุณต้องการลบ "${selectedShirt.name}" (${selectedShirt.sku}) ออกจากราวแขวนหรือไม่?`)) {
      const idToDelete = selectedShirt.id;
      setSelectedShirtId(null);
      onDeleteShirt(idToDelete);
    }
  };

  return (
    <div
      className="relative w-full h-full min-h-screen bg-[#0c0907] select-none overflow-hidden font-serif touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Top Boutique Header & Navigation Controls */}
      <header className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-8 pt-3.5 sm:pt-5 pb-3 pointer-events-none bg-gradient-to-b from-black/85 via-black/55 to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Boutique Title */}
          <div>
            <h1 className="text-base sm:text-xl tracking-[0.2em] sm:tracking-[0.24em] uppercase text-[#f4ede3] font-semibold font-serif">
              Atelier Garment Rack
            </h1>
            <p className="text-[10px] sm:text-xs text-[#a69888] tracking-widest mt-0.5 uppercase font-sans">
              {filteredShirts.length} แบบบนราวแขวน • แตะเสื้อเพื่อเลือกไซส์ & ออกใบเสร็จ
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 pointer-events-auto">
            {/* Search Toggle / Input */}
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center bg-[#1c1410]/95 border border-[#4a3728] rounded-full px-3 py-1.5 shadow-2xl w-44 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#e8c170] mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ / SKU / ไซส์..."
                    autoFocus
                    className="bg-transparent border-none text-xs text-[#f5efe6] focus:outline-none w-full font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-0.5 text-[#a8998a] hover:text-white mr-1"
                      title="ล้างข้อความ"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-0.5 text-[#a8998a] hover:text-white"
                    title="ปิดค้นหา"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 sm:p-2.5 rounded-full bg-[#1c1410]/90 hover:bg-[#2e2118] text-[#f4ece1] border border-[#4a3728] shadow-lg transition-transform active:scale-95"
                  title="ค้นหาเสื้อ / SKU / ไซส์"
                >
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e8c170]" />
                </button>
              )}
            </div>

            {/* Size & Paper Manager */}
            <button
              onClick={onOpenSizeManager}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full bg-[#1c1410]/90 hover:bg-[#2e2118] text-[#efe5d7] border border-[#4a3728] text-[11px] sm:text-xs font-sans font-medium shadow-lg transition-transform active:scale-95"
              title="ตั้งค่าไซส์เสื้อ & ขนาดกระดาษใบเสร็จ"
            >
              <Ruler className="w-3.5 h-3.5 text-[#e8c170]" />
              <span className="hidden md:inline">ขนาด & กระดาษ</span>
            </button>

            {/* Open Shirt Studio (Add / Scan Shirt) */}
            <button
              onClick={onOpenStudio}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-[#f4ece1] hover:bg-white text-[#1c1917] text-[11px] sm:text-xs font-sans font-semibold tracking-wide shadow-lg transition-transform active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8a6839]" />
              <span className="hidden sm:inline">+ เพิ่มเสื้อ / สแกน</span>
              <span className="sm:hidden">+ เสื้อ</span>
            </button>

            {/* Open Receipt Builder / Preview */}
            <button
              onClick={onOpenReceipt}
              className="relative flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] text-[11px] sm:text-xs font-sans font-bold tracking-wide shadow-lg transition-transform active:scale-95"
            >
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3b2a0c]" />
              <span>ใบเสร็จ</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#1c1410] text-[#e8c170] text-[10px] font-mono">
                {receiptItemCount}
              </span>
              {receiptTotal > 0 && (
                <span className="hidden lg:inline text-[11px] font-mono text-[#3b2a0c]">
                  ({formatTHB(receiptTotal)})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter Pills (shown in Rack view) */}
        {!selectedShirt && categories.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 pointer-events-auto no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setRawScrollX(0);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-[#e8c170] text-[#1c1410] border-[#e8c170] font-semibold shadow'
                      : 'bg-[#1a130f]/80 text-[#c9bba9] border-[#3d2e22] hover:border-[#6e533c] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Empty Rack Prompt */}
      {filteredShirts.length === 0 && !selectedShirt && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div
            data-no-drag="true"
            className="bg-[#1b1410]/92 backdrop-blur-md p-8 rounded-3xl border border-[#4a3b30]/60 max-w-sm pointer-events-auto shadow-2xl"
          >
            <ShirtIcon className="w-12 h-12 text-[#e8c170] mx-auto mb-4 opacity-85" />
            <h3 className="text-lg font-serif font-bold text-[#faf5ee] mb-1.5">
              {searchQuery || selectedCategory !== 'ทั้งหมด'
                ? 'ไม่พบเสื้อที่ตรงกับตัวกรอง'
                : 'ราวแขวนเสื้อยังว่างอยู่'}
            </h3>
            <p className="text-xs text-[#bcaea0] leading-relaxed mb-6 font-sans">
              {searchQuery || selectedCategory !== 'ทั้งหมด'
                ? 'ลองเปลี่ยนคำค้นหา (ชื่อ / SKU / ไซส์) หรือกดล้างตัวกรองเพื่อดูเสื้อทั้งหมด'
                : 'เพิ่มเสื้อตัวแรกเข้าสู่ราวไม้บูทีค เพื่อกำหนดไซส์ ราคา และออกใบเสร็จหลายขนาด'}
            </p>
            {searchQuery || selectedCategory !== 'ทั้งหมด' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ทั้งหมด');
                }}
                className="w-full py-2.5 rounded-xl bg-[#2e2118] hover:bg-[#3e2d22] text-[#e8c170] font-sans text-xs font-semibold uppercase tracking-wider"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            ) : (
              <button
                onClick={onOpenStudio}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] font-sans font-bold text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>เพิ่มเสื้อตัวแรกใน Studio</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3D Canvas Scene */}
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{
          position: selectedShirt ? [0, 0.2, 4.9] : [scrollX, 2.55, 8.6],
          fov: 36,
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        {selectedShirt ? (
          <ShirtInspectionView shirt={selectedShirt} onClose={handleCloseInspection} />
        ) : (
          <RackScene
            shirts={filteredShirts}
            scrollX={scrollX}
            hoveredShirtId={hoveredShirtId}
            onHoverShirt={setHoveredShirtId}
            onSelectShirt={handleOpenInspection}
          />
        )}
      </Canvas>

      {/* Hover Tooltip showing Name + SKU + Price + Available Sizes */}
      {!selectedShirt && hoveredShirt && (
        <div className="absolute bottom-22 sm:bottom-26 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center w-11/12 max-w-md transition-all duration-200">
          <div className="bg-[#18110d]/92 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-[#523f30]/75 shadow-2xl text-[#f5efe6]">
            <div className="flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#e8c170]">
              <span>{hoveredShirt.sku}</span>
              <span>•</span>
              <span>{STYLE_LABELS[hoveredShirt.style] || hoveredShirt.style}</span>
              <span>•</span>
              <span>{hoveredShirt.category}</span>
            </div>
            <p className="text-sm sm:text-base font-serif font-semibold text-[#faf5ee] mt-0.5 truncate">
              {hoveredShirt.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 font-sans">
              <span className="text-xs font-bold text-[#e8c170] mr-1">
                {getPriceSummary(hoveredShirt)}
              </span>
              {hoveredShirt.sizes.map((sz) => (
                <span
                  key={sz.id}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                    sz.stock > 0
                      ? 'bg-[#2a1f18] text-[#f2e8da] border-[#4e3b2c]'
                      : 'bg-[#1b1512] text-[#75685b] border-[#2e241d] line-through'
                  }`}
                >
                  {sz.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Garment Inspection & Size Selection Overlay */}
      {selectedShirt && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 sm:p-8 pt-20 sm:pt-24">
          <div className="flex justify-between items-start gap-3">
            {/* Detail + Size Selector Card */}
            <div
              data-no-drag="true"
              className="bg-[#16100c]/94 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-[#4a3728] w-full max-w-sm sm:max-w-md pointer-events-auto shadow-2xl max-h-[75vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#cbb18a] tracking-[0.18em] uppercase font-sans font-semibold">
                  {selectedShirt.brandOrCollection || 'Boutique Collection'} •{' '}
                  {STYLE_LABELS[selectedShirt.style] || selectedShirt.style}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#261c15] border border-[#463527] text-[10px] font-mono text-[#e8c170]">
                  {selectedShirt.sku}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-serif font-bold text-[#faf5ee] mt-1.5 leading-snug">
                {selectedShirt.name}
              </h2>

              <p className="text-xs text-[#b5a594] font-sans mt-1">
                หมวดหมู่: <span className="text-[#ebe1d3]">{selectedShirt.category}</span>
                {selectedShirt.fabricNote ? ` • ${selectedShirt.fabricNote}` : ''}
              </p>

              {/* Interactive Size Selector Pills */}
              <div className="mt-4 pt-3.5 border-t border-[#34271d]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-sans font-semibold text-[#e6dac9]">
                    เลือกไซส์เสื้อ (Size)
                  </span>
                  <span className="text-[11px] font-sans text-[#9d8d7c]">
                    {selectedShirt.sizes.length} ตัวเลือกไซส์
                  </span>
                </div>

                {selectedShirt.sizes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedShirt.sizes.map((sz) => {
                      const isActive = selectedSize?.id === sz.id;
                      const outOfStock = sz.stock <= 0;
                      return (
                        <button
                          key={sz.id}
                          onClick={() => setSelectedSizeId(sz.id)}
                          className={`text-left px-3 py-2 rounded-xl border transition-all font-sans ${
                            isActive
                              ? 'bg-[#e8c170]/15 border-[#e8c170] text-[#faf5ee] shadow-md'
                              : 'bg-[#211813] border-[#3d2e22] text-[#cfc2b2] hover:border-[#6a503b]'
                          } ${outOfStock ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold font-mono">{sz.label}</span>
                            <span className="text-xs font-semibold text-[#e8c170]">
                              {formatTHB(sz.price)}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#a79786] mt-0.5 truncate">
                            อก {sz.chestInch}&quot; / ยาว {sz.lengthInch}&quot;
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[#221913] border border-[#3e2f23] text-xs font-sans text-[#bdaea0]">
                    ยังไม่มีรายการไซส์สำหรับเสื้อตัวนี้ กรุณากดเพิ่ม/แก้ไซส์ด้านล่าง
                  </div>
                )}

                {/* Active Size Measurement Banner */}
                {selectedSize && (
                  <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-[#221913] border border-[#3f3024] flex items-center justify-between gap-2 font-sans">
                    <div>
                      <div className="text-xs text-[#f3eadc] font-semibold">
                        ไซส์ {selectedSize.label}: อก {selectedSize.chestInch}&quot; / ยาว{' '}
                        {selectedSize.lengthInch}&quot;
                        {selectedSize.shoulderInch ? ` / ไหล่ ${selectedSize.shoulderInch}"` : ''}
                      </div>
                      <div className="text-[11px] text-[#9e8e7e] mt-0.5">
                        สต็อกคงเหลือ {selectedSize.stock} ตัว
                      </div>
                    </div>
                    <div className="text-base font-bold font-mono text-[#e8c170]">
                      {formatTHB(selectedSize.price)}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity Stepper & Add to Receipt Action */}
              <div className="mt-4 space-y-2.5 font-sans">
                <div className="flex items-center gap-2.5">
                  {/* Stepper */}
                  <div className="flex items-center bg-[#231a14] border border-[#443326] rounded-xl px-1.5 py-1">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-1.5 rounded-lg text-[#d8cbb9] hover:text-white hover:bg-[#34271e] transition-colors"
                      title="ลดจำนวน"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-mono font-bold text-[#faf5ee]">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="p-1.5 rounded-lg text-[#d8cbb9] hover:text-white hover:bg-[#34271e] transition-colors"
                      title="เพิ่มจำนวน"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Primary Add to Receipt Button */}
                  <button
                    disabled={!selectedSize}
                    onClick={handleAddSelectedToReceipt}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] disabled:opacity-45 text-[#1c1410] font-bold text-xs tracking-wide shadow-lg transition-transform active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>หยิบใส่ใบเสร็จ (+ Add to Receipt)</span>
                  </button>
                </div>

                {addedToast && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{addedToast}</span>
                  </div>
                )}

                {/* Secondary Actions: Edit Sizes/Info & Delete Shirt */}
                <div className="pt-2 border-t border-[#34271d] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onEditShirt(selectedShirt)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#271d17] hover:bg-[#382920] text-[#f0e5d6] border border-[#493729] text-xs font-medium transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#e8c170]" />
                    <span>เพิ่ม/แก้ไซส์ &amp; ข้อมูลเสื้อ</span>
                  </button>

                  <button
                    onClick={handleDeleteCurrentShirt}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#381a1a] hover:bg-[#522222] text-red-200 border border-red-900/50 text-xs font-medium transition-colors"
                    title="ลบเสื้อตัวนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบเสื้อ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Close Inspection View */}
            <button
              onClick={handleCloseInspection}
              data-no-drag="true"
              className="p-2.5 sm:p-3 rounded-full bg-[#1a1410]/95 hover:bg-[#2b211a] text-[#ded6cb] border border-[#4a3728] pointer-events-auto transition-transform active:scale-95 shadow-xl shrink-0"
              title="กลับไปที่ราวแขวน (Esc)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="text-center pointer-events-none">
            <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#150f0c]/80 border border-[#3b2d22] text-[11px] font-sans text-[#b4a493]">
              ลากเพื่อหมุนดูเสื้อ 360° • เลื่อนลูกกลิ้งเมาส์เพื่อซูม
            </span>
          </div>
        </div>
      )}

      {/* Bottom Rack Navigation Controls */}
      {!selectedShirt && filteredShirts.length > 0 && (
        <div className="absolute bottom-5 sm:bottom-8 left-0 right-0 z-20 flex items-center justify-center gap-4 pointer-events-none px-4">
          <div
            data-no-drag="true"
            className="flex items-center gap-2 sm:gap-3 bg-[#17110d]/90 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-2.5 rounded-full border border-[#3b2d22] pointer-events-auto shadow-xl"
          >
            <button
              onClick={() => setRawScrollX((prev) => Math.max(minScroll, prev - RACK_SPACING * 1.4))}
              className="p-1 sm:p-1.5 text-[#cfc4b6] hover:text-white transition-colors"
              title="เลื่อนซ้าย"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2">
              {filteredShirts.slice(0, 10).map((s, idx) => {
                const totalSpan = Math.max(0, (filteredShirts.length - 1) * RACK_SPACING);
                const shirtPos = filteredShirts.length === 1 ? 0 : -totalSpan / 2 + idx * RACK_SPACING;
                const isActive = Math.abs(scrollX - shirtPos) < RACK_SPACING * 0.65;
                return (
                  <button
                    key={s.id}
                    onClick={() => setRawScrollX(shirtPos)}
                    title={`${s.name} (${s.sku})`}
                    className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${
                      isActive ? 'w-5 sm:w-6 bg-[#e8c170]' : 'w-1.5 bg-[#4a3b30] hover:bg-[#7d644f]'
                    }`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => setRawScrollX((prev) => Math.min(maxScroll, prev + RACK_SPACING * 1.4))}
              className="p-1 sm:p-1.5 text-[#cfc4b6] hover:text-white transition-colors"
              title="เลื่อนขวา"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
