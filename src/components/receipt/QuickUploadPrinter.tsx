'use client';

import React, { useEffect, useState } from 'react';
import { FileImage, FileText, Printer, Ruler, Trash2, Upload } from 'lucide-react';
import type { ReceiptPaperSize } from '@/types/shirt';

interface UploadedDocItem {
  id: string;
  name: string;
  kind: 'image' | 'pdf';
  dataUrl: string;
  paperSizeId: string;
  copies: number;
}

interface QuickUploadPrinterProps {
  paperSizes: ReceiptPaperSize[];
  defaultPaperSizeId: string;
  onOpenSizeManager: () => void;
}

function applyDynamicPageStyle(paperSize: ReceiptPaperSize): void {
  if (typeof document === 'undefined') return;
  const styleId = 'dynamic-print-page-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const isLandscape = paperSize.orientation === 'landscape' && paperSize.heightMm !== null;
  const width = isLandscape && paperSize.heightMm ? paperSize.heightMm : paperSize.widthMm;
  const height =
    paperSize.heightMm === null
      ? 'auto'
      : `${isLandscape ? paperSize.widthMm : paperSize.heightMm}mm`;
  styleEl.textContent = `@media print { @page { size: ${width}mm ${height}; margin: ${paperSize.marginMm}mm; } }`;
}

export const QuickUploadPrinter: React.FC<QuickUploadPrinterProps> = ({
  paperSizes,
  defaultPaperSizeId,
  onOpenSizeManager,
}) => {
  const [docs, setDocs] = useState<UploadedDocItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [printingDoc, setPrintingDoc] = useState<UploadedDocItem | null>(null);

  useEffect(() => {
    const onAfterPrint = () => setPrintingDoc(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach((file) => {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) return;

      if (isPdf) {
        const objectUrl = URL.createObjectURL(file);
        const newItem: UploadedDocItem = {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          kind: 'pdf',
          dataUrl: objectUrl,
          paperSizeId: defaultPaperSizeId || paperSizes[0]?.id || 'size-80mm',
          copies: 1,
        };
        setDocs((prev) => [newItem, ...prev]);
        setSelectedDocId((curr) => curr || newItem.id);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const newItem: UploadedDocItem = {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          kind: 'image',
          dataUrl: reader.result,
          paperSizeId: defaultPaperSizeId || paperSizes[0]?.id || 'size-80mm',
          copies: 1,
        };
        setDocs((prev) => [newItem, ...prev]);
        setSelectedDocId((curr) => curr || newItem.id);
      };
      reader.readAsDataURL(file);
    });
  };

  const updateDoc = (id: string, patch: Partial<UploadedDocItem>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedDocId === id) setSelectedDocId('');
  };

  const handlePrintDoc = (doc: UploadedDocItem) => {
    const paper = paperSizes.find((p) => p.id === doc.paperSizeId) ?? paperSizes[0];
    if (!paper) return;
    applyDynamicPageStyle(paper);

    if (doc.kind === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = doc.dataUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.open(doc.dataUrl, '_blank');
        }
        setTimeout(() => iframe.remove(), 60000);
      };
      document.body.appendChild(iframe);
      return;
    }

    setPrintingDoc(doc);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const activeDoc = docs.find((d) => d.id === selectedDocId) ?? docs[0] ?? null;
  const activePaper = activeDoc
    ? paperSizes.find((p) => p.id === activeDoc.paperSizeId) ?? paperSizes[0]
    : paperSizes[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 space-y-4">
        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${
            isDragging
              ? 'border-[#e8c170] bg-[#e8c170]/10'
              : 'border-[#4a3728] bg-[#1a130e]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#291e16] border border-[#543e2d] flex items-center justify-center text-[#e8c170]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#f7f1e8]">
                  อัปโหลดใบเสร็จ / เอกสารของร้าน (เลือกได้หลายไฟล์, ไม่ส่งขึ้น Server)
                </div>
                <div className="text-xs text-[#a99784]">
                  ลากรูปใบเสร็จมาวาง แล้วเลือกขนาด Preset สำหรับเครื่องพิมพ์เดียวได้ทันที
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenSizeManager}
                className="px-3 py-2 rounded-xl bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-xs font-semibold text-[#e8c170] flex items-center gap-1.5"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>จัดการขนาด Preset</span>
              </button>
              <label className="cursor-pointer px-4 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold flex items-center gap-1.5">
                <FileImage className="w-4 h-4" />
                <span>เลือกไฟล์ใบเสร็จ</span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Uploaded Documents Queue */}
        <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-[#f7f1e8]">
              รายการใบเสร็จที่พร้อมพิมพ์ ({docs.length} ไฟล์)
            </div>
            <span className="text-[11px] text-[#a99784]">
              เลือกขนาด Preset แยกแต่ละใบได้
            </span>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-xl border border-[#2f231a] bg-[#120d0a] p-6 text-center text-xs text-[#8f7e6c]">
              ยังไม่มีไฟล์ใบเสร็จ — กดปุ่ม &ldquo;เลือกไฟล์ใบเสร็จ&rdquo; หรือลากรูปมาวางด้านบน
            </div>
          ) : (
            <div className="space-y-2.5">
              {docs.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`rounded-xl border p-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#e8c170] bg-[#e8c170]/10'
                        : 'border-[#32241a] bg-[#120d0a] hover:border-[#543e2d]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {doc.kind === 'pdf' ? (
                        <div className="w-12 h-14 rounded border border-[#4a3829] bg-[#291e16] flex flex-col items-center justify-center text-[#e8c170] shrink-0">
                          <FileText className="w-5 h-5" />
                          <span className="text-[9px] font-bold mt-0.5">PDF</span>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={doc.dataUrl}
                          alt={doc.name}
                          className="w-12 h-14 object-cover rounded border border-[#4a3829] bg-white shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-[180px] space-y-1.5">
                        <div className="text-xs font-semibold text-[#f5efe6] truncate">
                          {doc.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={doc.paperSizeId}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateDoc(doc.id, { paperSizeId: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1a130e] border border-[#443326] text-xs text-[#faf5ee]"
                          >
                            {paperSizes.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.widthMm}×{p.heightMm ?? 'Auto'}mm)
                              </option>
                            ))}
                          </select>

                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[11px] text-[#a99784]">จำนวน:</span>
                            <input
                              type="number"
                              min={1}
                              max={2000}
                              value={doc.copies}
                              onChange={(e) =>
                                updateDoc(doc.id, {
                                  copies: Math.min(2000, Math.max(1, Number(e.target.value) || 1)),
                                })
                              }
                              className="w-20 px-2 py-1 rounded-lg bg-[#1a130e] border border-[#443326] text-xs font-mono text-[#faf5ee]"
                            />
                            <span className="text-[11px] text-[#a99784]">ใบ</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handlePrintDoc(doc)}
                          className="px-3.5 py-2 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1410] text-xs font-bold flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>พิมพ์ {doc.copies} ใบ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          aria-label={`ลบ ${doc.name}`}
                          className="p-2 rounded-xl border border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-950/50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Preview */}
      <div className="lg:col-span-5 rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3 lg:sticky lg:top-20">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#f7f1e8]">
            พรีวิวขนาดจริง ({activePaper?.name ?? '80mm'})
          </span>
          {activePaper && (
            <span className="text-[#a99784] font-mono">
              {activePaper.widthMm}×{activePaper.heightMm ?? 'Auto'} mm
            </span>
          )}
        </div>
        <div className="overflow-auto max-h-[72vh] rounded-xl bg-[#2a211b] p-4 flex justify-center">
          {activeDoc && activePaper ? (
            <div
              style={{
                width: `${activePaper.widthMm}mm`,
                minHeight: activePaper.heightMm ? `${activePaper.heightMm}mm` : 'auto',
                padding: `${activePaper.marginMm}mm`,
              }}
              className="bg-white shadow-2xl border border-neutral-200 flex items-start justify-center"
            >
              {activeDoc.kind === 'pdf' ? (
                <iframe
                  src={activeDoc.dataUrl}
                  title={activeDoc.name}
                  className="w-full h-[60vh] border-0 bg-white"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeDoc.dataUrl}
                  alt={activeDoc.name}
                  className="w-full h-auto object-contain"
                />
              )}
            </div>
          ) : (
            <div className="py-16 text-xs text-[#8f7e6c] text-center">
              อัปโหลดใบเสร็จด้านซ้ายเพื่อดูตัวอย่างตามขนาด Preset
            </div>
          )}
        </div>
      </div>

      {/* Print-only Pure Document Batch Container */}
      {printingDoc && (
        <div id="printable-batch-root" className="hidden print:block">
          {Array.from({ length: printingDoc.copies }, (_, idx) => (
            <div key={idx} className="print-page-break flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={printingDoc.dataUrl}
                alt={printingDoc.name}
                className="w-full h-auto object-contain"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
