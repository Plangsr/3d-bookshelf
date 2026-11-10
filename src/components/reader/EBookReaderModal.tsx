'use client';

import React, { useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Check, 
  Plus, 
  Trash2,
  Type,
  Palette
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

            {/* Add New Page */}
            <button
              onClick={handleAddNewPage}
              className="p-1.5 rounded-lg bg-[#251a13] hover:bg-[#33241b] text-[#cfc2b4] border border-[#3d2e23] transition-colors"
              title="เพิ่มหน้าใหม่"
            >
              <Plus className="w-4 h-4 text-[#e8c170]" />
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

          <span className="tracking-widest text-[11px] sm:text-xs">
            หน้า {currentPageIndex + 1} จาก {pages.length}
          </span>

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
      </div>
    </div>
  );
};
