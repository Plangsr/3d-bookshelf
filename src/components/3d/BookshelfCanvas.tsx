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
  Plus, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface ContinuousShelfSceneProps {
  books: Book[];
  scrollX: number;
  hoveredBookId: string | null;
  onHoverBook: (id: string | null) => void;
  onSelectBook: (book: Book) => void;
}

// Sub-component inside Canvas to handle smooth camera tracking on shelf scroll
const ShelfCameraRig: React.FC<{ scrollX: number }> = ({ scrollX }) => {
  const { camera } = useThree();
  useFrame(() => {
    // Smooth lerp towards targeted scroll position
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, scrollX, 0.08);
  });
  return null;
};

// 3D Scene representing the shelf and books
const ShelfScene: React.FC<ContinuousShelfSceneProps> = ({
  books,
  scrollX,
  hoveredBookId,
  onHoverBook,
  onSelectBook,
}) => {
  // Pre-calculate positions of books side-by-side standing on the shelf
  const bookPlacements = useMemo(() => {
    let currentX = -((books.length * 0.95) / 2);
    return books.map((book) => {
      const x = currentX + book.depth / 2;
      const y = book.height / 2;
      const z = 0;
      currentX += book.depth + 0.38; // spacing between books
      return { book, position: [x, y, z] as [number, number, number] };
    });
  }, [books]);

  return (
    <>
      <ShelfCameraRig scrollX={scrollX} />
      
      {/* Warm library lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[scrollX + 5, 8, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#fffaf0"
      />
      <directionalLight position={[scrollX - 6, 4, 3]} intensity={0.4} color="#ffd4aa" />

      {/* The Continuous Walnut Shelf */}
      <WalnutShelf shelfLength={Math.max(60, books.length * 2)} />

      {/* Array of Hardcover Books standing on shelf */}
      {bookPlacements.map(({ book, position }) => (
        <BookModel
          key={book.id}
          book={book}
          position={position}
          // Turn book 90 degrees so spine faces the camera (shelf view)
          rotation={[0, Math.PI / 2, 0]}
          isHovered={hoveredBookId === book.id}
          onClick={() => onSelectBook(book)}
          onPointerOver={() => onHoverBook(book.id)}
          onPointerOut={() => onHoverBook(null)}
        />
      ))}
    </>
  );
};

// Main 3D Bookshelf Canvas Container
interface BookshelfCanvasProps {
  books: Book[];
  onOpenScanner: () => void;
  onOpenReader: (book: Book) => void;
}

export const BookshelfCanvas: React.FC<BookshelfCanvasProps> = ({
  books,
  onOpenScanner,
  onOpenReader,
}) => {
  const [scrollX, setScrollX] = useState<number>(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const initialScrollX = useRef(0);

  const hoveredBook = useMemo(() => {
    return books.find((b) => b.id === hoveredBookId);
  }, [books, hoveredBookId]);

  // Limits of horizontal scrolling
  const maxScroll = (books.length * 0.95) / 2;
  const minScroll = -maxScroll;

  // Handle Dragging
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

  // Wheel horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (selectedBook) return;
    setScrollX((prev) => Math.max(minScroll, Math.min(maxScroll, prev + e.deltaY * 0.008)));
  };

  // Keyboard navigation
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

  return (
    <div
      className="relative w-full h-screen bg-[#0e0a08] select-none overflow-hidden font-serif"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Editorial Header bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-6 pointer-events-none">
        <div>
          <h1 className="text-xl tracking-[0.25em] uppercase text-[#f3ece2] font-medium font-serif">
            The Complete Shelf
          </h1>
          <p className="text-xs text-[#a69888] tracking-widest mt-0.5 uppercase">
            A Curated 19-Piece Clothbound Library
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#f4ece1] hover:bg-[#ffffff] text-[#1c1917] text-xs font-sans font-medium tracking-wider uppercase shadow-lg transition-all duration-300 transform active:scale-95"
          >
            <ScanLine className="w-4 h-4 text-[#8a6839]" />
            <span>สแกนหน้าหนังสือ / เพิ่มเล่มใหม่</span>
          </button>
        </div>
      </header>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{
          position: selectedBook ? [0, 0, 5] : [scrollX, 2.2, 7.5],
          fov: 38,
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
            books={books}
            scrollX={scrollX}
            hoveredBookId={hoveredBookId}
            onHoverBook={setHoveredBookId}
            onSelectBook={setSelectedBook}
          />
        )}
      </Canvas>

      {/* Non-selected Hover Information Toast */}
      {!selectedBook && hoveredBook && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center transition-all duration-300">
          <div className="bg-[#1b1410]/85 backdrop-blur-md px-6 py-3.5 rounded-xl border border-[#4a3b30]/50 shadow-2xl text-[#f5efe6]">
            <p className="text-sm tracking-wider font-serif uppercase text-[#e5d4be]">
              {hoveredBook.title}
            </p>
            <p className="text-xs text-[#9f9180] tracking-widest mt-1">
              {hoveredBook.author} • {hoveredBook.year || 'Clothbound'}
            </p>
          </div>
        </div>
      )}

      {/* Inspection Modal Controls overlay (When a book is pulled into orbit inspection) */}
      {selectedBook && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-8">
          <div className="flex justify-between items-start">
            <div className="bg-[#1a1410]/90 backdrop-blur-md p-6 rounded-2xl border border-[#4a3728] max-w-sm pointer-events-auto shadow-2xl">
              <span className="text-[10px] text-[#cbb18a] tracking-[0.2em] uppercase font-sans font-semibold">
                Hardcover Inspection View
              </span>
              <h2 className="text-xl font-serif font-bold text-[#faf5ee] mt-1">
                {selectedBook.title}
              </h2>
              <p className="text-sm text-[#bcaea0] italic mt-0.5">{selectedBook.author}</p>
              <div className="mt-4 pt-4 border-t border-[#3d2f23] text-xs text-[#a99c8f] space-y-1">
                <p>หมุน (Drag/Orbit) เพื่อตรวจดูสันปกและปกหลัง</p>
                <p>ซูม (Scroll) เพื่อดูลวดลายฟอยล์และเส้นใยผ้า</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedBook(null)}
              className="p-3 rounded-full bg-[#1a1410]/90 hover:bg-[#2b211a] text-[#ded6cb] border border-[#4a3728] pointer-events-auto transition-transform active:scale-95 shadow-xl"
              title="กลับไปที่ชั้นหนังสือ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center items-center gap-4 pointer-events-auto">
            <button
              onClick={() => onOpenReader(selectedBook)}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#e8c170] hover:bg-[#ffd98c] text-[#1c1917] font-serif font-semibold tracking-wider text-sm shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95"
            >
              <BookOpen className="w-5 h-5 text-[#3b2a0c]" />
              <span>เปิดอ่านหนังสือ (Open Book)</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Shelf Navigation Controls */}
      {!selectedBook && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-center gap-6 pointer-events-none">
          <div className="flex items-center gap-3 bg-[#17110d]/85 backdrop-blur-md px-6 py-2.5 rounded-full border border-[#3b2d22] pointer-events-auto shadow-xl">
            <button
              onClick={() => setScrollX((prev) => Math.max(minScroll, prev - 2.5))}
              className="p-2 text-[#cfc4b6] hover:text-white transition-colors"
              title="เลื่อนไปทางซ้าย"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Position indicator dots / markers */}
            <div className="flex items-center gap-1.5 px-2">
              {books.slice(0, 10).map((b, idx) => {
                const bookStep = (maxScroll - minScroll) / books.length;
                const bookPos = minScroll + idx * bookStep;
                const isActive = Math.abs(scrollX - bookPos) < bookStep * 0.8;
                return (
                  <div
                    key={b.id}
                    onClick={() => setScrollX(bookPos)}
                    className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${
                      isActive ? 'w-6 bg-[#e8c170]' : 'w-1.5 bg-[#4a3b30] hover:bg-[#806854]'
                    }`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => setScrollX((prev) => Math.min(maxScroll, prev + 2.5))}
              className="p-2 text-[#cfc4b6] hover:text-white transition-colors"
              title="เลื่อนไปทางขวา"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
