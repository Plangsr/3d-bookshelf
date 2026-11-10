'use client';

import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { 
  Camera, 
  Upload, 
  Check, 
  X, 
  Loader2, 
  Sparkles, 
  Type, 
  Palette, 
  FileText, 
  BookMarked,
  Layers
} from 'lucide-react';
import { Book, BookPage } from '@/types/book';

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (newBook: Book) => void;
}

export const MobileScannerModal: React.FC<MobileScannerModalProps> = ({
  isOpen,
  onClose,
  onSaveBook,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'pages'>('info');

  // Book Meta State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverColor, setCoverColor] = useState('#1e293b');
  const [foilColor, setFoilColor] = useState('gold');

  // Covers (Spine, Front, Back)
  const [frontCoverPreview, setFrontCoverPreview] = useState<string | null>(null);
  const [backCoverPreview, setBackCoverPreview] = useState<string | null>(null);
  const [spineCoverPreview, setSpineCoverPreview] = useState<string | null>(null);

  // Pages & OCR State
  const [pages, setPages] = useState<BookPage[]>([]);
  const [currentPageText, setCurrentPageText] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [textColor, setTextColor] = useState('#1c1917');
  const [bgColor, setBgColor] = useState('#faf7f2');
  const [fontFamily, setFontFamily] = useState('serif');

  // OCR Processing Status
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');

  // Hidden File Inputs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const spineInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle OCR for a page image using Tesseract.js (supports Thai & English)
  const handlePageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOcr(true);
    setOcrProgress(0);
    setOcrStatusText('กำลังเตรียมโมเดลวิเคราะห์ข้อความ (ไทย + อังกฤษ)...');

    try {
      const worker = await createWorker(['tha', 'eng'], 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
            setOcrStatusText(`กำลังอ่านข้อความในหน้ากระดาษ... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // Clean up text and set to editor
      setCurrentPageText(text);
      setOcrStatusText('สแกนสำเร็จ!');
    } catch (err) {
      console.error('OCR Error:', err);
      alert('เกิดข้อผิดพลาดในการสแกนข้อความ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleAddPage = () => {
    if (!currentPageText.trim()) return;
    const newPage: BookPage = {
      pageNumber: pages.length + 1,
      text: currentPageText,
      fontSize,
      textColor,
      bgColor,
      fontFamily,
    };
    setPages([...pages, newPage]);
    setCurrentPageText('');
  };

  const handleSaveAll = () => {
    if (!title.trim()) {
      alert('กรุณากรอกชื่อหนังสือ');
      return;
    }

    const newBook: Book = {
      id: `book-${Date.now()}`,
      title,
      author: author || 'นิรนาม',
      color: coverColor,
      foilColor,
      height: 3.8 + Math.random() * 0.4,
      width: 2.5,
      depth: 0.5 + Math.min(0.6, pages.length * 0.05),
      spineText: title,
      frontCoverUrl: frontCoverPreview || undefined,
      backCoverUrl: backCoverPreview || undefined,
      spineCoverUrl: spineCoverPreview || undefined,
      pages: pages.length > 0 ? pages : [
        {
          pageNumber: 1,
          text: currentPageText || 'ไม่มีเนื้อหาที่บันทึก',
          fontSize,
          textColor,
          bgColor,
          fontFamily,
        }
      ],
    };

    onSaveBook(newBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#1a1410] border border-[#4a392c] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e8ded2]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3b2d23] bg-[#140f0c]">
          <div className="flex items-center gap-2.5">
            <BookMarked className="w-5 h-5 text-[#e8c170]" />
            <h3 className="font-serif font-bold text-lg text-[#f4eee6]">
              สตูดิโอสแกน & สร้างหนังสือ (Book Scanner Studio)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#2e231c] text-[#a99c8f] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#3b2d23] bg-[#18120e]">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-xs tracking-wider uppercase font-sans font-medium transition-colors ${
              activeTab === 'info'
                ? 'border-b-2 border-[#e8c170] text-[#e8c170] bg-[#221a14]'
                : 'text-[#8c7e70] hover:text-[#cfc2b4]'
            }`}
          >
            1. ข้อมูลหนังสือ & ภาพปก (Cover & Binding)
          </button>
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex-1 py-3 text-xs tracking-wider uppercase font-sans font-medium transition-colors ${
              activeTab === 'pages'
                ? 'border-b-2 border-[#e8c170] text-[#e8c170] bg-[#221a14]'
                : 'text-[#8c7e70] hover:text-[#cfc2b4]'
            }`}
          >
            2. สแกนเนื้อหาทีละหน้า & OCR (Page Scanner) ({pages.length} หน้า)
          </button>
        </div>

        {/* Tab 1: Book Info & 3-Side Cover Scanning */}
        {activeTab === 'info' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-1.5">
                  ชื่อเรื่องหนังสือ (Title) *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ประวัติศาสตร์ศิลปะร่วมสมัย..."
                  className="w-full px-4 py-2.5 bg-[#0f0b09] border border-[#3d2e23] rounded-lg text-sm text-[#f5efe6] focus:outline-none focus:border-[#e8c170]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-1.5">
                  ชื่อผู้แต่ง (Author)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="เช่น ม.ร.ว. คึกฤทธิ์..."
                  className="w-full px-4 py-2.5 bg-[#0f0b09] border border-[#3d2e23] rounded-lg text-sm text-[#f5efe6] focus:outline-none focus:border-[#e8c170]"
                />
              </div>
            </div>

            {/* Clothbound Color & Foil Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-2">
                  สีผ้าหุ้มปก (Clothbound Fabric Palette)
                </label>
                <div className="flex items-center gap-2.5">
                  {[
                    { name: 'Navy', hex: '#1e293b' },
                    { name: 'Burgundy', hex: '#4c171e' },
                    { name: 'Forest', hex: '#1b3b2b' },
                    { name: 'Walnut', hex: '#382e25' },
                    { name: 'Ochre', hex: '#5c3a21' },
                    { name: 'Charcoal', hex: '#222225' },
                  ].map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setCoverColor(c.hex)}
                      className={`w-9 h-9 rounded-full border-2 transition-transform ${
                        coverColor === c.hex ? 'border-[#e8c170] scale-110 shadow-lg' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-2">
                  ลวดลายฟอยล์สะท้อนแสง (Foil Motif)
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'gold', label: 'ฟอยล์ทอง (Gold)' },
                    { id: 'silver', label: 'ฟอยล์เงิน (Silver)' },
                    { id: 'copper', label: 'คอปเปอร์ (Copper)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFoilColor(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-colors ${
                        foilColor === f.id
                          ? 'bg-[#e8c170] text-[#1c1917] font-semibold'
                          : 'bg-[#291f18] text-[#cfc2b4] hover:bg-[#382b22]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3-Side Cover Scanning (Spine, Front, Back) */}
            <div className="pt-4 border-t border-[#3b2d23]">
              <span className="text-xs uppercase tracking-wider text-[#a8998a] block mb-3">
                สแกนภาพจริง 3 ด้าน: ปกหน้า / สันปก / ปกหลัง (สำหรับใส่ในโมเดล 3D และ Drive)
              </span>

              <div className="grid grid-cols-3 gap-4 text-center">
                {/* Front Cover */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-4 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-xs font-medium text-[#c8bba9] mb-2">1. ปกหน้า</span>
                  {frontCoverPreview ? (
                    <img src={frontCoverPreview} alt="Front" className="h-28 object-contain rounded mb-2 shadow" />
                  ) : (
                    <Camera className="w-8 h-8 text-[#6d5b4d] mb-2" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={frontInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFrontCoverPreview(URL.createObjectURL(f));
                    }}
                  />
                  <button
                    onClick={() => frontInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded bg-[#2c2018] hover:bg-[#3d2e23] text-[#e8c170]"
                  >
                    ถ่าย / อัปโหลด
                  </button>
                </div>

                {/* Spine */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-4 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-xs font-medium text-[#c8bba9] mb-2">2. สันปก</span>
                  {spineCoverPreview ? (
                    <img src={spineCoverPreview} alt="Spine" className="h-28 object-contain rounded mb-2 shadow" />
                  ) : (
                    <Layers className="w-8 h-8 text-[#6d5b4d] mb-2" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={spineInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setSpineCoverPreview(URL.createObjectURL(f));
                    }}
                  />
                  <button
                    onClick={() => spineInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded bg-[#2c2018] hover:bg-[#3d2e23] text-[#e8c170]"
                  >
                    ถ่าย / อัปโหลด
                  </button>
                </div>

                {/* Back Cover */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-4 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-xs font-medium text-[#c8bba9] mb-2">3. ปกหลัง</span>
                  {backCoverPreview ? (
                    <img src={backCoverPreview} alt="Back" className="h-28 object-contain rounded mb-2 shadow" />
                  ) : (
                    <Camera className="w-8 h-8 text-[#6d5b4d] mb-2" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={backInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setBackCoverPreview(URL.createObjectURL(f));
                    }}
                  />
                  <button
                    onClick={() => backInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded bg-[#2c2018] hover:bg-[#3d2e23] text-[#e8c170]"
                  >
                    ถ่าย / อัปโหลด
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Scan Content & OCR & Style formatting */}
        {activeTab === 'pages' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Camera / Upload trigger for OCR */}
            <div className="bg-[#130f0c] border border-[#3d2f23] rounded-xl p-5 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={pageInputRef}
                className="hidden"
                onChange={handlePageImageUpload}
              />
              <button
                onClick={() => pageInputRef.current?.click()}
                disabled={isProcessingOcr}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#e8c170] hover:bg-[#ffd98c] disabled:bg-[#4a3d2e] text-[#1c1917] font-semibold text-sm shadow-lg transition-transform active:scale-95"
              >
                {isProcessingOcr ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{ocrStatusText}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 text-[#3d2a0e]" />
                    <span>เปิดกล้องมือถือสแกนหน้ากระดาษ (OCR ภาษาไทย/อังกฤษ)</span>
                  </>
                )}
              </button>

              {isProcessingOcr && (
                <div className="w-full max-w-md mx-auto mt-4">
                  <div className="h-2 bg-[#2d221a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e8c170] transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Formatting & Style Controls (ฟอนต์, ขนาด, สีข้อความ, สีพื้นหลัง) */}
            <div className="bg-[#140e0b] p-4 rounded-xl border border-[#3b2d22] flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-[#e8c170]" />
                <span className="text-xs text-[#a99c8f]">ขนาดฟอนต์:</span>
                <input
                  type="range"
                  min="14"
                  max="32"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-24 accent-[#e8c170]"
                />
                <span className="text-xs font-mono">{fontSize}px</span>
              </div>

              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#e8c170]" />
                <span className="text-xs text-[#a99c8f]">สีกระดาษ:</span>
                {[
                  { name: 'Cream', hex: '#faf7f2' },
                  { name: 'Warm Parchment', hex: '#f4ebd9' },
                  { name: 'Vintage Dark', hex: '#1c1917' },
                ].map((bg) => (
                  <button
                    key={bg.name}
                    type="button"
                    onClick={() => {
                      setBgColor(bg.hex);
                      if (bg.hex === '#1c1917') setTextColor('#e8ded2');
                      else setTextColor('#1c1917');
                    }}
                    className={`w-5 h-5 rounded-full border ${bgColor === bg.hex ? 'ring-2 ring-[#e8c170]' : ''}`}
                    style={{ backgroundColor: bg.hex }}
                    title={bg.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#a99c8f]">รูปแบบฟอนต์:</span>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="bg-[#241a13] border border-[#4a392c] rounded px-2.5 py-1 text-xs text-[#e8ded2]"
                >
                  <option value="serif">Serif (Cinzel / หนังสือหรู)</option>
                  <option value="sans">Sans-serif (โมเดิร์นอ่านง่าย)</option>
                  <option value="mono">Monospace (เครื่องพิมพ์ดีด)</option>
                </select>
              </div>
            </div>

            {/* Text Editor Preview Window */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-[#a8998a]">
                  เนื้อหาที่สแกนได้ (ตรวจสอบและแก้ไขข้อความได้โดยตรง):
                </label>
                <button
                  onClick={handleAddPage}
                  disabled={!currentPageText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] disabled:opacity-40 text-[#1c1917] text-xs font-semibold"
                >
                  + บันทึกหน้านี้ลงในเล่ม (หน้าที่ {pages.length + 1})
                </button>
              </div>

              <textarea
                value={currentPageText}
                onChange={(e) => setCurrentPageText(e.target.value)}
                placeholder="ข้อความที่สแกนจะปรากฏที่นี่ หรือพิมพ์ลงไปได้เองโดยตรง..."
                rows={9}
                style={{
                  fontSize: `${fontSize}px`,
                  backgroundColor: bgColor,
                  color: textColor,
                  fontFamily: fontFamily === 'serif' ? 'Cinzel, Georgia, serif' : fontFamily === 'mono' ? 'monospace' : 'sans-serif',
                }}
                className="w-full p-4 rounded-xl border border-[#4a392c] focus:outline-none shadow-inner leading-relaxed"
              />
            </div>

            {/* Saved Pages List Preview */}
            {pages.length > 0 && (
              <div className="pt-2">
                <span className="text-xs text-[#a8998a] uppercase tracking-wider block mb-2">
                  หน้าที่บันทึกแล้วในเล่มนี้:
                </span>
                <div className="flex flex-wrap gap-2">
                  {pages.map((p, i) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 rounded bg-[#241a14] border border-[#3d2e23] text-xs flex items-center gap-2"
                    >
                      <span>หน้า {p.pageNumber}</span>
                      <button
                        onClick={() => setPages(pages.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#3b2d23] bg-[#140f0c] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-[#4a392c] text-xs uppercase tracking-wider text-[#b8ab9d] hover:bg-[#251a14]"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] text-xs font-semibold uppercase tracking-wider shadow-lg transition-transform active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>สร้างหนังสือและวางบนชั้น 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
};
