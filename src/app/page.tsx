'use client';

import React, { useState, useEffect } from 'react';
import { BookshelfCanvas } from '@/components/3d/BookshelfCanvas';
import { MobileScannerModal } from '@/components/scanner/MobileScannerModal';
import { EBookReaderModal } from '@/components/reader/EBookReaderModal';
import { INITIAL_BOOKS } from '@/data/books';
import { Book } from '@/types/book';

export default function Home() {
  const [books, setBooks] = useState<Book[]>(INITIAL_BOOKS);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);

  // Fetch books from API (Google Sheets) if configured
  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data) => {
        if (data.books && Array.isArray(data.books) && data.books.length > 0) {
          setBooks(data.books);
        }
      })
      .catch((err) => console.log('Using initial 19-piece library collection:', err));
  }, []);

  const handleSaveNewBook = async (newBook: Book) => {
    // Optimistic UI update on the 3D shelf
    setBooks((prev) => [newBook, ...prev]);

    // Save to Google Sheets via backend API
    try {
      await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook),
      });
    } catch (e) {
      console.error('Failed to sync new book to backend:', e);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0907]">
      {/* 3D Continuous Shelf Scene */}
      <BookshelfCanvas
        books={books}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenReader={(b) => setReadingBook(b)}
      />

      {/* Mobile Book Scanner Modal (OCR + Covers + Formatting) */}
      <MobileScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveBook={handleSaveNewBook}
      />

      {/* E-Book Reader Modal */}
      <EBookReaderModal
        book={readingBook}
        onClose={() => setReadingBook(null)}
      />
    </main>
  );
}
