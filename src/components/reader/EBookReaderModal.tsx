'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Check, 
  Plus, 
  Trash2,
  Camera,
  Crop,
  Contrast,
  Loader2
} from 'lucide-react';
import { Book, BookPage } from '@/types/book';

interface EBookReaderModalProps {
  book: Book | null;
  onClose: () => void;
  onUpdateBook?: (updatedBook: Book) => void;
}

export const EBookReaderModal: React.FC<EBookReaderModalProps> = ({
  book,
  onClose,
  onUpdateBook,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState<'cream' | 'sepia' | 'dark'>('cream');

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  // OCR Scan States for Reader
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageFileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsLiveCameraOpen(false);
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!book) return null;

  const pages: BookPage[] = book.pages && book.pages.length > 0
    ? book.pages
    : [
        {
          pageNumber: 1,
          text: `ยินดีต้อนรับสู่ ${book.title}\n\nประพันธ์โดย ${book.author}\n\n(กดปุ่ม "แก้ไขหน้านี้" ด้านบนเพื่อเริ่มพิมพ์หรือแก้ไขเนื้อหาได้ทันที)`,
          fontSize: 18,
        }
      ];

  const currentPage = pages[currentPageIndex] || pages[0];

  const handleStartEdit = () => {
    setEditedText(currentPage.text);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      text: editedText,
    };

    const updatedBook: Book = {
      ...book,
      pages: updatedPages,
    };

    onUpdateBook?.(updatedBook);
    setIsEditing(false);
  };

  const handleAddNewPage = () => {
    const newPageNum = pages.length + 1;
    const newPage: BookPage = {
      pageNumber: newPageNum,
      text: `เนื้อหาหน้าที่ ${newPageNum}...`,
      fontSize: 18,
    };
    const updatedPages = [...pages, newPage];
    const updatedBook: Book = {
      ...book,
      pages: updatedPages,
    };
    onUpdateBook?.(updatedBook);
    setCurrentPageIndex(updatedPages.length - 1);
    setEditedText(newPage.text);
    setIsEditing(true);
  };

  // Assign stream to video when stream or camera state updates
  useEffect(() => {
    if (isLiveCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, [isLiveCameraOpen, cameraStream]);

  // Start live camera scanner
  const startDocumentCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported or insecure origin');
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      setCameraStream(stream);
      setIsLiveCameraOpen(true);
    } catch {
      pageFileInputRef.current?.click();
      setIsLiveCameraOpen(false);
    }
  };

  // Contrast filter for document scan
  const applyDocumentScanFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = gray > 140 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Perform OCR and append as a new page
  const processOcrAndAppendPage = async (base64: string, mimeType: string) => {
    setIsScanningOcr(true);
    setScanStatusText('กำลังสแกนถอดข้อความ OCR...');

    try {
      const res = await fetch('/api/ocr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        const newPageNum = pages.length + 1;
        const newPage: BookPage = {
          pageNumber: newPageNum,
          text: data.text,
          fontSize: 18,
        };
        const updatedPages = [...pages, newPage];
        const updatedBook: Book = {
          ...book,
          pages: updatedPages,
        };
        onUpdateBook?.(updatedBook);
        setCurrentPageIndex(updatedPages.length - 1);
        setIsEditing(false);
      } else {
        alert(data.error || 'ไม่สามารถถอดข้อความได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('เกิดข้อผิดพลาดในการสแกน OCR');
    } finally {
      setIsScanningOcr(false);
      setScanStatusText('');
    }
  };

  const captureDocumentFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (enhanceContrast) {
      applyDocumentScanFilter(ctx, canvas.width, canvas.height);
    }
    stopCamera();

    const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    await processOcrAndAppendPage(base64Data, 'image/jpeg');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setIsScanningOcr(true);
    setScanStatusText('กำลังเตรียมประมวลผลรูปภาพ...');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          if (enhanceContrast) {
            applyDocumentScanFilter(ctx, width, height);
          }
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          await processOcrAndAppendPage(compressedBase64, 'image/jpeg');
        } else {
          const rawBase64 = (reader.result as string).split(',')[1];
          await processOcrAndAppendPage(rawBase64, file.type);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePage = () => {
    if (pages.length <= 1) {
      alert('หนังสือต้องมีเนื้อหาอย่างน้อย 1 หน้า');
      return;
    }
    if (!confirm(`คุณต้องการลบหน้าที่ ${currentPage.pageNumber || currentPageIndex + 1} หรือไม่?`)) {
      return;
    }

    const updatedPages = pages
      .filter((_, idx) => idx !== currentPageIndex)
      .map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    const updatedBook: Book = {
      ...book,
      pages: updatedPages,
    };

    onUpdateBook?.(updatedBook);
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    setIsEditing(false);
  };

  const themeStyles = {
    cream: {
      bg: '#faf6f0',
      text: '#24211e',
      border: '#e4dacd',
      pageShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    },
    sepia: {
      bg: '#f4ebd9',
      text: '#3b2f22',
      border: '#ddcfb8',
      pageShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
    },
    dark: {
      bg: '#1a1816',
      text: '#e8e2d8',
      border: '#332c25',
      pageShadow: '0 10px 40px rgba(0, 0, 0, 0.7)',
    },
  }[theme];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl h-[94vh] flex flex-col bg-[#120e0b] border border-[#3b2d23] rounded-2xl shadow-2xl overflow-hidden font-serif">
        
        {/* Top bar controls */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 bg-[#18120e] border-b border-[#30241b] text-[#d6cbbe] gap-2">
          <div className="min-w-0 max-w-[200px] sm:max-w-xs">
            <h4 className="text-xs sm:text-sm font-semibold tracking-wide text-[#f4efe8] truncate">
              {book.title}
            </h4>
            <span className="text-[11px] text-[#96897c] italic truncate block">{book.author}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Edit / Save Page Button */}
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2e7d32] hover:bg-[#388e3c] text-white text-xs font-sans font-semibold shadow transition-transform active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>บันทึกหน้า</span>
              </button>
            ) : (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] text-xs font-sans font-semibold shadow transition-transform active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#3b2a0c]" />
                <span>แก้ไขหน้านี้</span>
              </button>
            )}

            {/* Add New Page (Manual) */}
            <button
              onClick={handleAddNewPage}
              className="p-1.5 rounded-lg bg-[#251a13] hover:bg-[#33241b] text-[#cfc2b4] border border-[#3d2e23] transition-colors"
              title="เพิ่มหน้าว่างใหม่"
            >
              <Plus className="w-4 h-4 text-[#e8c170]" />
            </button>

            {/* Scan New Page with Native Camera */}
            <button
              onClick={() => pageFileInputRef.current?.click()}
              disabled={isScanningOcr}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] font-semibold text-xs font-sans shadow transition-all active:scale-95"
              title="เปิดกล้องมือถือถ่ายเพื่อสแกนเพิ่มหน้า"
            >
              {isScanningOcr ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1c1917]" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-[#1c1917]" />
              )}
              <span className="hidden sm:inline">ถ่ายรูปเพิ่มหน้า</span>
            </button>

            {/* Delete Page */}
            {pages.length > 1 && (
              <button
                onClick={handleDeletePage}
                className="p-1.5 rounded-lg bg-[#251a13] hover:bg-[#3d1b1b] text-red-400 border border-[#3d2e23] transition-colors"
                title="ลบหน้านี้"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Theme switcher */}
            <div className="hidden xs:flex items-center gap-1.5 bg-[#251a13] p-1 rounded-lg border border-[#3d2e23]">
              <button
                onClick={() => setTheme('cream')}
                className={`w-5 h-5 rounded-md bg-[#faf6f0] border ${theme === 'cream' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Cream Theme"
              />
              <button
                onClick={() => setTheme('sepia')}
                className={`w-5 h-5 rounded-md bg-[#f4ebd9] border ${theme === 'sepia' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Sepia Theme"
              />
              <button
                onClick={() => setTheme('dark')}
                className={`w-5 h-5 rounded-md bg-[#1a1816] border ${theme === 'dark' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Dark Theme"
              />
            </div>

            {/* Font size */}
            <div className="flex items-center gap-1.5 bg-[#251a13] px-2.5 py-1 rounded-lg border border-[#3d2e23] text-xs">
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="hover:text-white font-bold"
              >
                A-
              </button>
              <span className="font-mono text-[11px]">{fontSize}</span>
              <button
                onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                className="hover:text-white font-bold"
              >
                A+
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[#2b1f17] text-[#a99c8f] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Reader Paper View */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-8 overflow-hidden bg-[#0c0907]">
          <div
            className="w-full max-w-2xl h-full rounded-lg p-6 sm:p-12 overflow-y-auto transition-colors duration-300 relative flex flex-col"
            style={{
              backgroundColor: themeStyles.bg,
              color: themeStyles.text,
              boxShadow: themeStyles.pageShadow,
              border: `1px solid ${themeStyles.border}`,
            }}
          >
            {/* Header / Running head */}
            <div className="flex justify-between items-center text-[10px] sm:text-[11px] uppercase tracking-[0.2em] opacity-50 pb-4 mb-6 border-b border-current">
              <span className="truncate max-w-[200px]">{book.title}</span>
              <span>หน้าที่ {currentPage.pageNumber || currentPageIndex + 1} / {pages.length}</span>
            </div>

            {/* Body Content or Textarea Editor */}
            {isEditing ? (
              <div className="flex-1 flex flex-col">
                <span className="text-xs text-[#8a7a6a] mb-2 font-sans">
                  กำลังแก้ไขข้อความ (พิมพ์หรือจัดวรรคตอนตามต้องการ):
                </span>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  style={{ fontSize: `${fontSize}px`, lineHeight: '1.8' }}
                  className="w-full flex-1 p-3 bg-transparent border border-dashed border-[#8a7a6a] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#e8c170] font-serif resize-none"
                  placeholder="พิมพ์เนื้อหาหน้านี้..."
                />
              </div>
            ) : (
              <div
                style={{ fontSize: `${fontSize}px`, lineHeight: '1.85' }}
                className="whitespace-pre-wrap font-serif flex-1 select-text"
              >
                {currentPage.text}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 bg-[#18120e] border-t border-[#30241b] text-xs text-[#a99c8f]">
          <button
            onClick={() => {
              setCurrentPageIndex((i) => Math.max(0, i - 1));
              setIsEditing(false);
            }}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg bg-[#241a13] hover:bg-[#33251c] disabled:opacity-30 text-[#f5eee6]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">หน้าที่แล้ว</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="tracking-widest text-[11px] sm:text-xs">
              หน้า {currentPageIndex + 1} จาก {pages.length}
            </span>
            {isScanningOcr && (
              <span className="text-[11px] text-[#e8c170] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {scanStatusText}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
              setIsEditing(false);
            }}
            disabled={currentPageIndex === pages.length - 1}
            className="flex items-center gap-1 px-3 sm:px-4 py-1.5 rounded-lg bg-[#241a13] hover:bg-[#33251c] disabled:opacity-30 text-[#f5eee6]"
          >
            <span className="hidden xs:inline">หน้าถัดไป</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Input & Canvas for Reader OCR */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={pageFileInputRef}
          className="hidden"
          onChange={handleFileUpload}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Document Scanner Camera Fullscreen Overlay */}
        {isLiveCameraOpen && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-between p-4">
            <div className="w-full flex items-center justify-between z-10 text-white">
              <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full text-xs">
                <Crop className="w-4 h-4 text-[#e8c170]" />
                <span>สแกนหน้าหนังสือเพิ่มเข้าในเล่มนี้</span>
              </div>
              <button
                onClick={stopCamera}
                className="p-2 rounded-full bg-black/60 text-white hover:bg-black/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-3 rounded-2xl border border-white/20">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  (e.target as HTMLVideoElement).play().catch(() => {});
                }}
                className="w-full h-full object-cover bg-black"
              />
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

              <button
                onClick={captureDocumentFrame}
                className="w-16 h-16 rounded-full border-4 border-white bg-[#e8c170] flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
                title="กดถ่ายสแกนเพิ่มหน้านี้"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  <Camera className="w-6 h-6 text-[#1c1917]" />
                </div>
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  pageFileInputRef.current?.click();
                }}
                className="text-xs text-[#cfc2b4] hover:text-white underline"
              >
                อัปโหลดรูป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
