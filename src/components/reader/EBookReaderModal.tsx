'use client';

import React, { useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Palette, 
  Bookmark,
  Share2
} from 'lucide-react';
import { Book, BookPage } from '@/types/book';

interface EBookReaderModalProps {
  book: Book | null;
  onClose: () => void;
}

export const EBookReaderModal: React.FC<EBookReaderModalProps> = ({
  book,
  onClose,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fontSize, setFontSize] = useState(19);
  const [theme, setTheme] = useState<'cream' | 'sepia' | 'dark'>('cream');

  if (!book) return null;

  const pages = book.pages && book.pages.length > 0
    ? book.pages
    : [
        {
          pageNumber: 1,
          text: `ยินดีต้อนรับสู่ ${book.title}\n\nประพันธ์โดย ${book.author}\n\n(ยังไม่มีหน้าเนื้อหาที่สแกนเพิ่มเติม คุณสามารถกดปุ่ม "สแกนหน้าหนังสือ" บนหน้าแรกเพื่อเปิดกล้องมือถือสแกนเนื้อหาเข้ามาในเล่มนี้ได้ตลอดเวลา)`,
          fontSize: 18,
        }
      ];

  const currentPage = pages[currentPageIndex] || pages[0];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl h-[92vh] flex flex-col bg-[#120e0b] border border-[#3b2d23] rounded-2xl shadow-2xl overflow-hidden font-serif">
        
        {/* Top bar controls */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#18120e] border-b border-[#30241b] text-[#d6cbbe]">
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-[#f4efe8]">
              {book.title}
            </h4>
            <span className="text-xs text-[#96897c] italic">{book.author}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme switcher */}
            <div className="flex items-center gap-1.5 bg-[#251a13] p-1 rounded-lg border border-[#3d2e23]">
              <button
                onClick={() => setTheme('cream')}
                className={`w-6 h-6 rounded-md bg-[#faf6f0] border ${theme === 'cream' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Cream Theme"
              />
              <button
                onClick={() => setTheme('sepia')}
                className={`w-6 h-6 rounded-md bg-[#f4ebd9] border ${theme === 'sepia' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Sepia Theme"
              />
              <button
                onClick={() => setTheme('dark')}
                className={`w-6 h-6 rounded-md bg-[#1a1816] border ${theme === 'dark' ? 'ring-2 ring-[#e8c170]' : ''}`}
                title="Dark Theme"
              />
            </div>

            {/* Font size */}
            <div className="flex items-center gap-2 bg-[#251a13] px-3 py-1 rounded-lg border border-[#3d2e23] text-xs">
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="hover:text-white font-bold"
              >
                A-
              </button>
              <span className="font-mono">{fontSize}</span>
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

        {/* Center Reader Paper View (Warm Editorial Sheet) */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-10 overflow-hidden bg-[#0c0907]">
          <div
            className="w-full max-w-2xl h-full rounded-lg p-8 sm:p-14 overflow-y-auto transition-colors duration-300 relative select-text"
            style={{
              backgroundColor: themeStyles.bg,
              color: themeStyles.text,
              boxShadow: themeStyles.pageShadow,
              border: `1px solid ${themeStyles.border}`,
            }}
          >
            {/* Header / Running head */}
            <div className="flex justify-between items-center text-[11px] uppercase tracking-[0.2em] opacity-50 pb-6 mb-8 border-b border-current">
              <span>{book.title}</span>
              <span>หน้าที่ {currentPage.pageNumber || currentPageIndex + 1} / {pages.length}</span>
            </div>

            {/* Body Text */}
            <div
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.85' }}
              className="whitespace-pre-wrap font-serif"
            >
              {currentPage.text}
            </div>
          </div>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="flex items-center justify-between px-8 py-4 bg-[#18120e] border-t border-[#30241b] text-xs text-[#a99c8f]">
          <button
            onClick={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#241a13] hover:bg-[#33251c] disabled:opacity-40 text-[#f5eee6]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>หน้าที่แล้ว</span>
          </button>

          <span className="tracking-widest">
            {currentPageIndex + 1} จาก {pages.length}
          </span>

          <button
            onClick={() => setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            disabled={currentPageIndex === pages.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#241a13] hover:bg-[#33251c] disabled:opacity-40 text-[#f5eee6]"
          >
            <span>หน้าถัดไป</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
