'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Camera, 
  Check, 
  X, 
  Loader2, 
  Type, 
  Palette, 
  BookMarked,
  Layers,
  Crop,
  Contrast
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
  const [fontFamily] = useState('serif');

  // OCR Processing Status
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrStatusText, setOcrStatusText] = useState('');

  // Live Camera & Document Scanner Viewfinder State
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // File Inputs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const spineInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsLiveCameraOpen(false);
  }, [cameraStream]);

  // Stop camera when closing modal or unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start Live Document Camera with HD resolution & auto-focus
  const startDocumentCamera = async () => {
    try {
      setIsLiveCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Cannot open direct camera stream, fallback to native camera intent:', err);
      // Fallback to native capture input
      pageInputRef.current?.click();
      setIsLiveCameraOpen(false);
    }
  };

  // Capture photo from video feed with Document B&W/Contrast Enhancement filter
  const captureDocumentFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply Document Scanning Filter (Enhance Text Contrast & Whiten Paper)
    if (enhanceContrast) {
      applyDocumentScanFilter(ctx, canvas.width, canvas.height);
    }

    // Stop camera feed after capture
    stopCamera();

    // Process with OCR
    const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    await processOcr(base64Data, 'image/jpeg');
  };

  // Image Processing Filter for Crisp Document Scanning
  const applyDocumentScanFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale luminance
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // High contrast thresholding for crisp printed text
      const enhanced = gray > 140 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);

      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Process OCR using robust offline-capable Tesseract OCR
  const processOcr = async (base64: string, mimeType: string) => {
    setIsProcessingOcr(true);
    setOcrStatusText('กำลังใช้ระบบ OCR สแกนถอดข้อความและจัดรูปแบบ...');

    try {
      const res = await fetch('/api/ocr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        setCurrentPageText(data.text);
        setOcrStatusText('สแกนและจัดรูปแบบข้อความสำเร็จ!');
      } else {
        alert(data.error || 'ไม่สามารถถอดข้อความได้ กรุณาลองถ่ายใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('เกิดข้อผิดพลาดในการประมวลผล OCR');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Fallback file input handler
  const handlePageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await processOcr(base64, file.type);
    };
    reader.readAsDataURL(file);
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
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[94vh] bg-[#1a1410] border border-[#4a392c] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e8ded2]">
        
        {/* Hidden Canvas for Processing Image Frame */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Document Scanner Camera Fullscreen Overlay */}
        {isLiveCameraOpen && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-between p-4">
            {/* Top Bar inside Camera */}
            <div className="w-full flex items-center justify-between z-10 text-white">
              <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full text-xs">
                <Crop className="w-4 h-4 text-[#e8c170]" />
                <span>โหมดสแกนเอกสาร (Document Scan Mode)</span>
              </div>
              <button
                onClick={stopCamera}
                className="p-2 rounded-full bg-black/60 text-white hover:bg-black/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Video Feed with Document Scanning Guide Box */}
            <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-3 rounded-2xl border border-white/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Document Alignment Frame Box */}
              <div className="absolute inset-x-8 inset-y-12 sm:inset-x-16 sm:inset-y-12 border-2 border-[#e8c170] rounded-xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-3">
                <div className="flex justify-between items-start">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-[#ffd98c] -mt-1 -ml-1 rounded-tl-sm" />
                  <div className="w-6 h-6 border-t-4 border-r-4 border-[#ffd98c] -mt-1 -mr-1 rounded-tr-sm" />
                </div>
                <div className="text-center bg-black/70 py-1 px-3 rounded-full text-[11px] text-[#e8c170] self-center">
                  จัดหน้ากระดาษให้อยู่ในกรอบนี้
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-[#ffd98c] -mb-1 -ml-1 rounded-bl-sm" />
                  <div className="w-6 h-6 border-b-4 border-r-4 border-[#ffd98c] -mb-1 -mr-1 rounded-br-sm" />
                </div>
              </div>
            </div>

            {/* Bottom Shutter Controls */}
            <div className="w-full flex items-center justify-around z-10 pb-2">
              <button
                onClick={() => setEnhanceContrast(!enhanceContrast)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  enhanceContrast ? 'bg-[#e8c170] text-[#1c1917] font-bold' : 'bg-white/20 text-white'
                }`}
              >
                <Contrast className="w-3.5 h-3.5" />
                <span>โหมดขาวดำชัดเจน</span>
              </button>

              {/* Shutter Button */}
              <button
                onClick={captureDocumentFrame}
                className="w-16 h-16 rounded-full border-4 border-white bg-[#e8c170] flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
                title="กดถ่ายสแกนเอกสาร"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  <Camera className="w-6 h-6 text-[#1c1917]" />
                </div>
              </button>

              <div className="w-20" />
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#3b2d23] bg-[#140f0c]">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#e8c170]" />
            <h3 className="font-serif font-bold text-base sm:text-lg text-[#f4eee6]">
              สตูดิโอสแกน & สร้างหนังสือ
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-[#2e231c] text-[#a99c8f] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#3b2d23] bg-[#18120e]">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-[11px] sm:text-xs tracking-wider uppercase font-sans font-medium transition-colors ${
              activeTab === 'info'
                ? 'border-b-2 border-[#e8c170] text-[#e8c170] bg-[#221a14]'
                : 'text-[#8c7e70] hover:text-[#cfc2b4]'
            }`}
          >
            1. ข้อมูลเล่ม & ปก
          </button>
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex-1 py-3 text-[11px] sm:text-xs tracking-wider uppercase font-sans font-medium transition-colors ${
              activeTab === 'pages'
                ? 'border-b-2 border-[#e8c170] text-[#e8c170] bg-[#221a14]'
                : 'text-[#8c7e70] hover:text-[#cfc2b4]'
            }`}
          >
            2. โหมดสแกนเอกสาร & OCR ({pages.length} หน้า)
          </button>
        </div>

        {/* Tab 1: Book Info */}
        {activeTab === 'info' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-1.5">
                  ชื่อเรื่องหนังสือ (Title) *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น บันทึกแห่งกาลเวลา..."
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

            {/* Clothbound Color Palette & Foil */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#a8998a] mb-2">
                สีผ้าหุ้มปก (Clothbound Fabric)
              </label>
              <div className="flex flex-wrap items-center gap-3 mb-3">
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
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      coverColor === c.hex ? 'border-[#e8c170] scale-110 shadow-lg' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-[#a8998a]">สีฟอยล์ตัวอักษร:</span>
                {(['gold', 'silver', 'copper'] as const).map((foil) => (
                  <button
                    key={foil}
                    type="button"
                    onClick={() => setFoilColor(foil)}
                    className={`px-2.5 py-1 rounded text-xs capitalize border transition-colors ${
                      foilColor === foil
                        ? 'border-[#e8c170] text-[#e8c170] bg-[#2a1e16]'
                        : 'border-[#3d2e23] text-[#8c7e70]'
                    }`}
                  >
                    {foil}
                  </button>
                ))}
              </div>
            </div>

            {/* 3-Side Cover Scanning */}
            <div className="pt-3 border-t border-[#3b2d23]">
              <span className="text-xs uppercase tracking-wider text-[#a8998a] block mb-3">
                ถ่ายภาพจริง 3 ด้าน: ปกหน้า / สันปก / ปกหลัง
              </span>

              <div className="grid grid-cols-3 gap-3 text-center">
                {/* Front Cover */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-3 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-[11px] font-medium text-[#c8bba9] mb-1.5">1. ปกหน้า</span>
                  {frontCoverPreview ? (
                    <div className="relative h-20 w-16 mb-1.5 shadow">
                      <Image src={frontCoverPreview} alt="Front" fill className="object-contain rounded" unoptimized />
                    </div>
                  ) : (
                    <Camera className="w-6 h-6 text-[#6d5b4d] mb-1.5" />
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
                    className="text-[10px] px-2.5 py-1 rounded bg-[#2c2018] text-[#e8c170]"
                  >
                    ถ่าย/เลือก
                  </button>
                </div>

                {/* Spine */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-3 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-[11px] font-medium text-[#c8bba9] mb-1.5">2. สันปก</span>
                  {spineCoverPreview ? (
                    <div className="relative h-20 w-16 mb-1.5 shadow">
                      <Image src={spineCoverPreview} alt="Spine" fill className="object-contain rounded" unoptimized />
                    </div>
                  ) : (
                    <Layers className="w-6 h-6 text-[#6d5b4d] mb-1.5" />
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
                    className="text-[10px] px-2.5 py-1 rounded bg-[#2c2018] text-[#e8c170]"
                  >
                    ถ่าย/เลือก
                  </button>
                </div>

                {/* Back Cover */}
                <div className="border border-dashed border-[#4a392c] rounded-xl p-3 flex flex-col items-center justify-center bg-[#130e0b]">
                  <span className="text-[11px] font-medium text-[#c8bba9] mb-1.5">3. ปกหลัง</span>
                  {backCoverPreview ? (
                    <div className="relative h-20 w-16 mb-1.5 shadow">
                      <Image src={backCoverPreview} alt="Back" fill className="object-contain rounded" unoptimized />
                    </div>
                  ) : (
                    <Camera className="w-6 h-6 text-[#6d5b4d] mb-1.5" />
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
                    className="text-[10px] px-2.5 py-1 rounded bg-[#2c2018] text-[#e8c170]"
                  >
                    ถ่าย/เลือก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Document Scanner Viewfinder & Text OCR */}
        {activeTab === 'pages' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Document Camera Button */}
            <div className="bg-[#130f0c] border border-[#3d2f23] rounded-2xl p-4 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={pageInputRef}
                className="hidden"
                onChange={handlePageImageUpload}
              />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={startDocumentCamera}
                  disabled={isProcessingOcr}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#e8c170] hover:bg-[#ffd98c] disabled:opacity-50 text-[#1c1917] font-semibold text-xs sm:text-sm shadow-xl transition-transform active:scale-95"
                >
                  <Crop className="w-4 h-4 text-[#3d2a0e]" />
                  <span>เปิดโหมดสแกนเอกสาร (Document Scanner Camera)</span>
                </button>

                <button
                  onClick={() => pageInputRef.current?.click()}
                  disabled={isProcessingOcr}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#241a13] hover:bg-[#33241b] text-[#cfc2b4] text-xs font-sans transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-[#e8c170]" />
                  <span>อัปโหลดรูปภาพแทน</span>
                </button>
              </div>

              {isProcessingOcr && (
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-[#e8c170]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{ocrStatusText}</span>
                </div>
              )}
            </div>

            {/* Formatting & Controls */}
            <div className="bg-[#140e0b] p-3 rounded-xl border border-[#3b2d22] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-[#e8c170]" />
                <span className="text-[#a99c8f]">ขนาดฟอนต์:</span>
                <input
                  type="range"
                  min="14"
                  max="28"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-20 accent-[#e8c170]"
                />
                <span className="font-mono">{fontSize}px</span>
              </div>

              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#e8c170]" />
                <span className="text-[#a99c8f]">สีกระดาษ:</span>
                {[
                  { name: 'Cream', hex: '#faf7f2' },
                  { name: 'Parchment', hex: '#f4ebd9' },
                  { name: 'Dark', hex: '#1c1917' },
                ].map((bg) => (
                  <button
                    key={bg.name}
                    type="button"
                    onClick={() => {
                      setBgColor(bg.hex);
                      if (bg.hex === '#1c1917') setTextColor('#e8ded2');
                      else setTextColor('#1c1917');
                    }}
                    className={`w-4 h-4 rounded-full border ${bgColor === bg.hex ? 'ring-2 ring-[#e8c170]' : ''}`}
                    style={{ backgroundColor: bg.hex }}
                    title={bg.name}
                  />
                ))}
              </div>
            </div>

            {/* Text Editor Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] uppercase tracking-wider text-[#a8998a]">
                  ข้อความที่สแกนได้ (สามารถพิมพ์ตรวจทานแก้ไขได้โดยตรง):
                </label>
                <button
                  onClick={handleAddPage}
                  disabled={!currentPageText.trim()}
                  className="px-3 py-1 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] disabled:opacity-40 text-[#1c1917] text-xs font-semibold"
                >
                  + บันทึกเป็นหน้าที่ {pages.length + 1}
                </button>
              </div>

              <textarea
                value={currentPageText}
                onChange={(e) => setCurrentPageText(e.target.value)}
                placeholder="เมื่อกดถ่ายสแกนเอกสาร ข้อความจะปรากฏที่นี่โดยอัตโนมัติ..."
                rows={7}
                style={{
                  fontSize: `${fontSize}px`,
                  backgroundColor: bgColor,
                  color: textColor,
                }}
                className="w-full p-3.5 rounded-xl border border-[#4a392c] focus:outline-none shadow-inner leading-relaxed font-serif"
              />
            </div>

            {/* Saved Pages Preview */}
            {pages.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] text-[#a8998a] uppercase tracking-wider block mb-1.5">
                  หน้าที่บันทึกในเล่มนี้แล้ว ({pages.length} หน้า):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {pages.map((p, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded bg-[#241a14] border border-[#3d2e23] text-xs flex items-center gap-1.5"
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

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#3b2d23] bg-[#140f0c] flex items-center justify-between">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-lg border border-[#4a392c] text-xs text-[#b8ab9d] hover:bg-[#251a14]"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>สร้างหนังสือวางบนชั้น 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
};
