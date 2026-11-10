import { NextResponse } from 'next/server';
import { Book } from '@/types/book';

const SHEET_ID = '1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U';

export async function GET(request: Request) {
  try {
    // Reading request URL makes the route dynamic automatically in Next.js Turbopack
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
