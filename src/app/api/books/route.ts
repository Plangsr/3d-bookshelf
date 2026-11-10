import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import { Book } from '@/types/book';

const SHEET_ID = '1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U';

// 1. GET: Fetch all books from Google Sheet
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('t') || Date.now();

    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0&_t=${timestamp}`;
    const res = await fetch(csvUrl, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ books: [], error: 'Failed to fetch CSV' });
    }

    const csvText = await res.text();
    const books = parseCsvToBooks(csvText);

    return NextResponse.json({ books });
  } catch (error: any) {
    console.error('Error fetching books from sheets:', error);
    return NextResponse.json({ books: [], error: error.message });
  }
}

// 2. POST: Append a new book to Google Sheet
export async function POST(req: Request) {
  try {
    const newBook = await req.json();

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const sheets = getGoogleSheetsClient();
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
    }

    return NextResponse.json({ success: true, book: newBook });
  } catch (error: any) {
    console.error('Error saving book:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. DELETE: Find row by Book ID and delete row in Google Sheet
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    // If Service Account credentials exist, delete row from Google Sheet
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const sheets = getGoogleSheetsClient();

      // Find the row number where column A matches the book id
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A:A',
      });

      const rows = sheetData.data.values || [];
      const rowIndex = rows.findIndex((row) => row[0] === id);

      if (rowIndex !== -1) {
        // Clear or delete the row
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1,
                  },
                },
              },
            ],
          },
        });
      }
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Error deleting book from sheet:', error);
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
    };
  });
}
