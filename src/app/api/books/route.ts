import { NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import { INITIAL_BOOKS } from '@/data/books';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      // Fallback to rich curated 19-piece library if sheet credentials not set up yet
      return NextResponse.json({ books: INITIAL_BOOKS });
    }

    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Books!A2:J',
    });

    const rows = response.data.values || [];
    const books = rows.map((row, idx) => ({
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
    }));

    return NextResponse.json({ books: books.length > 0 ? books : INITIAL_BOOKS });
  } catch (error: any) {
    console.error('Error fetching books from sheets:', error);
    // Return fallback sample library so 3D scene always renders seamlessly
    return NextResponse.json({ books: INITIAL_BOOKS, error: error.message });
  }
}

export async function POST(req: Request) {
  try {
    const newBook = await req.json();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (spreadsheetId) {
      const sheets = getGoogleSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Books!A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              newBook.id,
              newBook.title,
              newBook.author,
              newBook.year || new Date().getFullYear().toString(),
              newBook.color,
              newBook.foilColor,
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
