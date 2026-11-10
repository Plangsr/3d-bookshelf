'use client';

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Book } from '@/types/book';
import { BookModel } from './BookModel';
import { WalnutShelf } from './WalnutShelf';
import { InspectionView } from './InspectionView';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  X, 
  ScanLine,
  Library,
  Trash2,
  Search
} from 'lucide-react';

interface ContinuousShelfSceneProps {
  books: Book[];
  scrollX: number;
  hoveredBookId: string | null;
  onHoverBook: (id: string | null) => void;
  onSelectBook: (book: Book) => void;
}

const ShelfCameraRig: React.FC<{ scrollX: number }> = ({ scrollX }) => {
  const { camera } = useThree();
  useFrame(() => {
    // Smooth lerp to center book/shelf position
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, scrollX, 0.1);
  });
  return null;
};

const ShelfScene: React.FC<ContinuousShelfSceneProps> = ({
  books,
  scrollX,
  hoveredBookId,
  onHoverBook,
  onSelectBook,
}) => {
  const bookPlacements = useMemo(() => {
    if (books.length === 0) return [];
    let currentX = -((books.length * 0.95) / 2);
    return books.map((book) => {
      const x = currentX + book.depth / 2;
      const y = book.height / 2;
      const z = 0;
      currentX += book.depth + 0.38;
      return { book, position: [x, y, z] as [number, number, number] };
    });
  }, [books]);

  return (
    <>
      <ShelfCameraRig scrollX={scrollX} />
      
      {/* Front-Facing Atmospheric Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[scrollX, 4, 9]}
        intensity={1.8}
        color="#fffbf2"
      />
      <directionalLight position={[scrollX - 5, 2, 6]} intensity={0.5} color="#ffd4aa" />
      <directionalLight position={[scrollX + 5, 2, 6]} intensity={0.5} color="#e5ecf5" />

      {/* The Classic Front-Facing Walnut Cabinet */}
      <WalnutShelf shelfLength={Math.max(35, books.length * 2.2)} />

      {/* Books standing on shelf facing directly forward */}
      {bookPlacements.map(({ book, position }) => (
        <BookModel
          key={book.id}
          book={book}
          position={position}
          rotation={[0, Math.PI / 2, 0]} // Spine facing directly front to viewer
          isHovered={hoveredBookId === book.id}
          onClick={() => onSelectBook(book)}
          onPointerOver={() => onHoverBook(book.id)}
          onPointerOut={() => onHoverBook(null)}
        />
      ))}
    </>
  );
};

interface BookshelfCanvasProps {
  books: Book[];
  onOpenScanner: () => void;
  onOpenReader: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
}

export const BookshelfCanvas: React.FC<BookshelfCanvasProps> = ({
  books,
  onOpenScanner,
  onOpenReader,
  onDeleteBook,
}) => {
  const [scrollX, setScrollX] = useState<number>(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const initialScrollX = useRef(0);

  // Filter books according to search query
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return books;
    const q = searchQuery.toLowerCase();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.year && b.year.includes(q))
    );
  }, [books, searchQuery]);

  const hoveredBook = useMemo(() => {
    return filteredBooks.find((b) => b.id === hoveredBookId);
  }, [filteredBooks, hoveredBookId]);

  const maxScroll = Math.max(2, (filteredBooks.length * 0.95) / 2);
  const minScroll = -maxScroll;

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedBook) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    initialScrollX.current = scrollX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || selectedBook) return;
    const deltaX = (e.clientX - dragStartX.current) * 0.015;
    setScrollX(Math.max(minScroll, Math.min(maxScroll, initialScrollX.current - deltaX)));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (selectedBook || e.touches.length === 0) return;
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    initialScrollX.current = scrollX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || selectedBook || e.touches.length === 0) return;
    const deltaX = (e.touches[0].clientX - dragStartX.current) * 0.016;
    setScrollX(Math.max(minScroll, Math.min(maxScroll, initialScrollX.current - deltaX)));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedBook) return;
    setScrollX((prev) => Math.max(minScroll, Math.min(maxScroll, prev + e.deltaY * 0.008)));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedBook) {
        if (e.key === 'Escape') setSelectedBook(null);
        return;
      }
      if (e.key === 'ArrowRight') {
        setScrollX((prev) => Math.min(maxScroll, prev + 1.2));
      } else if (e.key === 'ArrowLeft') {
        setScrollX((prev) => Math.max(minScroll, prev - 1.2));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBook, maxScroll, minScroll]);

  const handleDeleteCurrentBook = () => {
    if (!selectedBook) return;
    if (confirm(`คุณต้องการลบหนังสือ "${selectedBook.title}" ออกจากชั้นและ Google ชีทหรือไม่?`)) {
      const idToDelete = selectedBook.id;
      setSelectedBook(null);
      onDeleteBook?.(idToDelete);
    }
  };

  return (
    <div
      className="relative w-full h-full min-h-screen bg-[#0e0a08] select-none overflow-hidden font-serif touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Header with Search Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-5 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div>
          <h1 className="text-base sm:text-xl tracking-[0.2em] sm:tracking-[0.25em] uppercase text-[#f3ece2] font-semibold font-serif">
            The Complete Shelf
          </h1>
          <p className="text-[10px] sm:text-xs text-[#a69888] tracking-widest mt-0.5 uppercase">
            {filteredBooks.length} เล่มบนตู้ไม้
          </p>
        </div>

        {/* Action Controls: Search & Scan */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Search Toggle & Input */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center bg-[#1c1410]/95 border border-[#4a3728] rounded-full px-3 py-1.5 shadow-2xl transition-all w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#e8c170] mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อหนังสือ / ผู้แต่ง..."
                  autoFocus
                  className="bg-transparent border-none text-xs text-[#f5efe6] focus:outline-none w-full font-sans"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 text-[#a8998a] hover:text-white mr-1"
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
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 sm:p-2.5 rounded-full bg-[#1c1410]/90 hover:bg-[#2e2118] text-[#f4ece1] border border-[#4a3728] shadow-lg transition-transform active:scale-95"
                title="ค้นหาหนังสือ"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e8c170]" />
              </button>
            )}
          </div>

          {/* Add / Scan Book */}
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#f4ece1] hover:bg-[#ffffff] text-[#1c1917] text-[11px] sm:text-xs font-sans font-semibold tracking-wider uppercase shadow-lg transition-transform active:scale-95"
          >
            <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8a6839]" />
            <span className="hidden xs:inline">สแกนหนังสือใหม่</span>
            <span className="xs:hidden">สแกน</span>
          </button>
        </div>
      </header>

      {/* Empty Shelf Prompt */}
      {filteredBooks.length === 0 && !selectedBook && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="bg-[#1b1410]/90 backdrop-blur-md p-8 rounded-3xl border border-[#4a3b30]/60 max-w-sm pointer-events-auto shadow-2xl">
            <Library className="w-12 h-12 text-[#e8c170] mx-auto mb-4 opacity-80" />
            <h3 className="text-lg font-serif font-bold text-[#faf5ee] mb-1.5">
              {searchQuery ? 'ไม่พบหนังสือที่ตรงกับคำค้นหา' : 'ตู้หนังสือยังว่างอยู่'}
            </h3>
            <p className="text-xs text-[#bcaea0] leading-relaxed mb-6 font-sans">
              {searchQuery 
                ? `ไม่พบหนังสือที่มีชื่อหรือผู้แต่งตรงกับ "${searchQuery}" ลองค้นหาด้วยคำอื่นหรือกดล้างการค้นหา`
                : 'เริ่มต้นเพิ่มหนังสือเล่มโปรดของคุณเข้าสู่ตู้ไม้วอลนัต โดยการกดปุ่มสแกนด้านล่างได้เลย'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="w-full py-2.5 rounded-xl bg-[#2e2118] text-[#e8c170] font-sans text-xs font-semibold uppercase tracking-wider"
              >
                ล้างคำค้นหา
              </button>
            ) : (
              <button
                onClick={onOpenScanner}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] font-sans font-bold text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95"
              >
                <ScanLine className="w-4 h-4" />
                <span>เปิดกล้องสแกนหนังสือเล่มแรก</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3D Canvas - Front Eye-level Perspective (มุมมองระดับสายตาตรงเข้าตู้ไม้) */}
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{
          // Position camera squarely at front eye level [x, y=2.05, z=6.8] pointing straight forward
          position: selectedBook ? [0, 0, 5] : [scrollX, 2.05, 6.8],
          fov: 34,
        }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        {selectedBook ? (
          <InspectionView
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
            onOpenReader={onOpenReader}
          />
        ) : (
          <ShelfScene
            books={filteredBooks}
            scrollX={scrollX}
            hoveredBookId={hoveredBookId}
            onHoverBook={setHoveredBookId}
            onSelectBook={setSelectedBook}
          />
        )}
      </Canvas>

      {/* Toast Book Info on Hover */}
      {!selectedBook && hoveredBook && (
        <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center w-11/12 max-w-xs sm:max-w-md transition-all duration-300">
          <div className="bg-[#1b1410]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl border border-[#4a3b30]/60 shadow-2xl text-[#f5efe6]">
            <p className="text-xs sm:text-sm tracking-wider font-serif uppercase text-[#e5d4be] truncate">
              {hoveredBook.title}
            </p>
            <p className="text-[10px] sm:text-xs text-[#9f9180] tracking-widest mt-0.5 truncate">
              {hoveredBook.author} • {hoveredBook.year || 'Clothbound'}
            </p>
          </div>
        </div>
      )}

      {/* Inspection Modal Controls */}
      {selectedBook && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 sm:p-8">
          <div className="flex justify-between items-start gap-2">
            <div className="bg-[#1a1410]/95 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-[#4a3728] w-full max-w-xs sm:max-w-sm pointer-events-auto shadow-2xl">
              <span className="text-[9px] sm:text-[10px] text-[#cbb18a] tracking-[0.2em] uppercase font-sans font-semibold">
                Hardcover Inspection
              </span>
              <h2 className="text-base sm:text-xl font-serif font-bold text-[#faf5ee] mt-1 truncate">
                {selectedBook.title}
              </h2>
              <p className="text-xs sm:text-sm text-[#bcaea0] italic mt-0.5">{selectedBook.author}</p>
              
              {/* Delete Book Button inside Inspection Card */}
              <div className="mt-3 pt-3 border-t border-[#3d2f23] flex items-center justify-between">
                <button
                  onClick={handleDeleteCurrentBook}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3d1b1b] hover:bg-[#5a2121] text-red-300 text-xs font-sans font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบเล่มนี้ออกจากชั้น & ชีท</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setSelectedBook(null)}
              className="p-2.5 sm:p-3 rounded-full bg-[#1a1410]/95 hover:bg-[#2b211a] text-[#ded6cb] border border-[#4a3728] pointer-events-auto transition-transform active:scale-95 shadow-xl"
              title="ปิด"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="flex justify-center items-center gap-4 pointer-events-auto pb-4 sm:pb-0">
            <button
              onClick={() => onOpenReader(selectedBook)}
              className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] font-serif font-bold tracking-wider text-xs sm:text-sm shadow-2xl transition-transform active:scale-95"
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#3b2a0c]" />
              <span>เปิดอ่านหนังสือ (Open Book)</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Shelf Navigation Controls */}
      {!selectedBook && filteredBooks.length > 0 && (
        <div className="absolute bottom-5 sm:bottom-8 left-0 right-0 z-20 flex items-center justify-center gap-4 pointer-events-none px-4">
          <div className="flex items-center gap-2 sm:gap-3 bg-[#17110d]/90 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-2.5 rounded-full border border-[#3b2d22] pointer-events-auto shadow-xl">
            <button
              onClick={() => setScrollX((prev) => Math.max(minScroll, prev - 2.5))}
              className="p-1 sm:p-2 text-[#cfc4b6] hover:text-white transition-colors"
              title="เลื่อนซ้าย"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Indicator dots */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2">
              {filteredBooks.slice(0, 8).map((b, idx) => {
                const bookStep = (maxScroll - minScroll) / filteredBooks.length;
                const bookPos = minScroll + idx * bookStep;
                const isActive = Math.abs(scrollX - bookPos) < bookStep * 0.8;
                return (
                  <div
                    key={b.id}
                    onClick={() => setScrollX(bookPos)}
                    className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${
                      isActive ? 'w-4 sm:w-6 bg-[#e8c170]' : 'w-1.5 bg-[#4a3b30]'
                    }`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => setScrollX((prev) => Math.min(maxScroll, prev + 2.5))}
              className="p-1 sm:p-2 text-[#cfc4b6] hover:text-white transition-colors"
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
