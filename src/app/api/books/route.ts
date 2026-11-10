import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import { Book } from '@/types/book';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U';

export async function GET() {
  try {
    // 1. First attempt: Authenticated Google Sheets API (via Service Account)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const sheets = getGoogleSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A2:J', // Or Sheet1!A2:J or Books!A2:J
      });

      const rows = response.data.values || [];
      const books: Book[] = rows.map((row, idx) => parseRowToBook(row, idx));
      return NextResponse.json({ books });
    }

    // 2. Second attempt: Direct Public CSV Fetch (works when sheet is shared "Anyone with link can view")
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
    const res = await fetch(csvUrl, { next: { revalidate: 30 } });

    if (res.ok) {
      const csvText = await res.text();
      const books = parseCsvToBooks(csvText);
      return NextResponse.json({ books });
    }

    return NextResponse.json({ books: [], message: 'Sheet is private or empty' });
  } catch (error: any) {
    console.error('Error fetching books from sheets:', error);
    return NextResponse.json({ books: [], error: error.message });
  }
}

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

function parseRowToBook(row: any[], idx: number): Book {
  return {
    id: row[0] || `book-${idx}`,
    title: row[1] || 'Untitled',
    author: row[2] || 'Unknown',
    year: row[3] || '',
    color: row[4] || '#1e293b',
    foilColor: row[5] || 'gold',
    frontCoverUrl: row[6] || undefined,
    spineCoverUrl: row[7] || undefined,
    backCoverUrl: row[8] || undefined,
    height: 3.8,
    width: 2.5,
    depth: 0.65,
  };
}

function parseCsvToBooks(csvText: string): Book[] {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  // Skip header row
  return lines.slice(1).map((line, idx) => {
    // Basic CSV parser handling quotes
    const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
    return parseRowToBook(cells, idx);
  });
}
