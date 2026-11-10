import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import { Book } from '@/types/book';

const SHEET_ID = '1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U';

// 1. GET: Fetch all books and their pages from Google Sheet
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('t') || Date.now();

    // Fetch Books tab (gid=0)
    const booksCsvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0&_t=${timestamp}`;
    const booksRes = await fetch(booksCsvUrl, { cache: 'no-store' });

    if (!booksRes.ok) {
      return NextResponse.json({ books: [], error: 'Failed to fetch Books CSV' });
    }

    const booksCsvText = await booksRes.text();
    const books = parseCsvToBooks(booksCsvText);

    // Try fetching Pages tab (if exists as sheet 'Pages')
    try {
      const pagesCsvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Pages&_t=${timestamp}`;
      const pagesRes = await fetch(pagesCsvUrl, { cache: 'no-store' });
      if (pagesRes.ok) {
        const pagesCsvText = await pagesRes.text();
        attachPagesToBooks(books, pagesCsvText);
      }
    } catch (e) {
      // Pages sheet optional
    }

    return NextResponse.json({ books });
  } catch (error: any) {
    console.error('Error fetching books from sheets:', error);
    return NextResponse.json({ books: [], error: error.message });
  }
}

// 2. POST: Append a new book and its pages to Google Sheet
export async function POST(req: Request) {
  try {
    const newBook: Book = await req.json();

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const sheets = getGoogleSheetsClient();

      // Append Book to 'Books' sheet (or first tab)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              newBook.id,
              newBook.title,
              newBook.author,
              newBook.year || new Date().getFullYear().toString(),
              newBook.color || '#1e293b',
              newBook.foilColor || 'gold',
              newBook.frontCoverUrl || '',
              newBook.spineCoverUrl || '',
              newBook.backCoverUrl || '',
              new Date().toISOString(),
            ],
          ],
        },
      });

      // If book has scanned pages, append them to 'Pages' sheet
      if (newBook.pages && newBook.pages.length > 0) {
        const pageRows = newBook.pages.map((p) => [
          newBook.id,
          p.pageNumber,
          p.text,
          p.fontSize || 18,
          p.fontFamily || 'serif',
          p.bgColor || '#faf7f2',
          p.textColor || '#1c1917',
          new Date().toISOString(),
        ]);

        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Pages!A:H',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: pageRows },
        }).catch((err) => console.warn('Could not append to Pages sheet:', err.message));
      }
    }

    return NextResponse.json({ success: true, book: newBook });
  } catch (error: any) {
    console.error('Error saving book:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. DELETE: Cascade delete book from 'Books' tab AND all linked pages from 'Pages' tab
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const sheets = getGoogleSheetsClient();

      // Step A: Find and delete the book from the main Books tab (Sheet 0)
      const bookData = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A:A',
      });
      const bookRows = bookData.data.values || [];
      const bookRowIndex = bookRows.findIndex((row) => row[0] === id);

      if (bookRowIndex !== -1) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: bookRowIndex,
                    endIndex: bookRowIndex + 1,
                  },
                },
              },
            ],
          },
        });
      }

      // Step B: Cascade delete all linked pages from the 'Pages' tab
      try {
        const pagesData = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Pages!A:A',
        });
        const pageRows = pagesData.data.values || [];

        // Find all row indices matching this book_id (delete in reverse order to keep indices valid)
        const matchingIndices: number[] = [];
        pageRows.forEach((row, idx) => {
          if (row[0] === id) {
            matchingIndices.push(idx);
          }
        });

        if (matchingIndices.length > 0) {
          // Get Pages sheetId metadata
          const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
          const pagesSheet = sheetMeta.data.sheets?.find((s) => s.properties?.title === 'Pages');
          const pagesSheetId = pagesSheet?.properties?.sheetId;

          if (pagesSheetId !== undefined) {
            // Reverse delete to prevent shifting
            const deleteRequests = matchingIndices.reverse().map((rIdx) => ({
              deleteDimension: {
                range: {
                  sheetId: pagesSheetId,
                  dimension: 'ROWS',
                  startIndex: rIdx,
                  endIndex: rIdx + 1,
                },
              },
            }));

            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: SHEET_ID,
              requestBody: { requests: deleteRequests },
            });
          }
        }
      } catch (err) {
        console.warn('Pages sheet cascade delete skipped or table not created yet:', err);
      }
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Error cascade deleting book and pages from sheet:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function parseCsvToBooks(csvText: string): Book[] {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const dataLines = lines.slice(1);

  return dataLines.map((line, idx) => {
    const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => {
      let val = c.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      return val.trim();
    });

    const title = cells[1] || 'Untitled';
    const author = cells[2] || 'Unknown';
    const color = cells[4] || '#1e293b';
    const foilColor = cells[5] || 'gold';

    return {
      id: cells[0] || `book-${idx}`,
      title,
      author,
      year: cells[3] || '',
      color,
      foilColor,
      frontCoverUrl: cells[6] && !cells[6].includes('[link removed]') ? cells[6] : undefined,
      spineCoverUrl: cells[7] && !cells[7].includes('[link removed]') ? cells[7] : undefined,
      backCoverUrl: cells[8] && !cells[8].includes('[link removed]') ? cells[8] : undefined,
      height: 3.8 + (idx % 3) * 0.2,
      width: 2.5,
      depth: 0.65 + (idx % 3) * 0.1,
      spineText: title,
      pages: [],
    };
  });
}

function attachPagesToBooks(books: Book[], pagesCsvText: string) {
  const lines = pagesCsvText.trim().split('\n');
  if (lines.length <= 1) return;

  const dataLines = lines.slice(1);
  dataLines.forEach((line) => {
    const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => {
      let val = c.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      return val.trim();
    });

    const bookId = cells[0];
    const targetBook = books.find((b) => b.id === bookId);
    if (targetBook) {
      if (!targetBook.pages) targetBook.pages = [];
      targetBook.pages.push({
        pageNumber: parseInt(cells[1], 10) || targetBook.pages.length + 1,
        text: cells[2] || '',
        fontSize: parseInt(cells[3], 10) || 18,
        fontFamily: cells[4] || 'serif',
        bgColor: cells[5] || '#faf7f2',
        textColor: cells[6] || '#1c1917',
      });
    }
  });
}
