'use client';

import React, { useState, useEffect } from 'react';
import { BookshelfCanvas } from '@/components/3d/BookshelfCanvas';
import { MobileScannerModal } from '@/components/scanner/MobileScannerModal';
import { EBookReaderModal } from '@/components/reader/EBookReaderModal';
import { Book } from '@/types/book';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [readingBook, setReadingBook] = useState<Book | null>(null);

  // Load saved books from localStorage or API on initial render
  useEffect(() => {
    // 1. Try local storage first for persistent user books without needing DB
    const saved = localStorage.getItem('user_bookshelf_books');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBooks(parsed);
          return;
        }
      } catch (e) {
        console.error('Failed to parse local books:', e);
      }
    }

    // 2. Fetch from Google Sheets API
    fetch('/api/books')
      .then((res) => res.json())
      .then((data) => {
        if (data.books && Array.isArray(data.books)) {
          setBooks(data.books);
        }
      })
      .catch((err) => console.log('Clean library ready:', err));
  }, []);

  // Save new book
  const handleSaveNewBook = async (newBook: Book) => {
    const updated = [newBook, ...books];
    setBooks(updated);
    localStorage.setItem('user_bookshelf_books', JSON.stringify(updated));

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

  // Update existing book (Page edits, add/delete pages)
  const handleUpdateBook = (updatedBook: Book) => {
    const updated = books.map((b) => (b.id === updatedBook.id ? updatedBook : b));
    setBooks(updated);
    setReadingBook(updatedBook);
    localStorage.setItem('user_bookshelf_books', JSON.stringify(updated));
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0907]">
      {/* 3D Continuous Shelf Scene */}
      <BookshelfCanvas
        books={books}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenReader={(b) => setReadingBook(b)}
      />

      {/* Mobile Book Scanner Modal */}
      <MobileScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveBook={handleSaveNewBook}
      />

      {/* E-Book Reader Modal with Live Page Editing */}
      <EBookReaderModal
        book={readingBook}
        onClose={() => setReadingBook(null)}
        onUpdateBook={handleUpdateBook}
      />
    </main>
  );
}
