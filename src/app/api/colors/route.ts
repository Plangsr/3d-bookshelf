import { NextResponse } from 'next/server';
import {
  ensureSheetTabWithHeaders,
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';

const COLORS_TAB = 'Colors';
const COLORS_RANGE = 'Colors!A:C';
const COLORS_HEADERS = ['id', 'name', 'createdAt'];

export interface ColorRecord {
  id: string;
  name: string;
  createdAt: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request?: Request) {
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json(
      { colors: [], source: 'local', note: 'No sheets config found' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values
      .get({
        spreadsheetId: config.sheetId,
        range: COLORS_RANGE,
      })
      .catch(async () => {
        await ensureSheetTabWithHeaders(config.sheetId, COLORS_TAB, COLORS_HEADERS);
        return sheets.spreadsheets.values.get({
          spreadsheetId: config.sheetId,
          range: COLORS_RANGE,
        });
      });

    const rows = (res.data.values || []) as string[][];
    const colors: ColorRecord[] = rows
      .map((row) => {
        const id = String(row[0] ?? '').trim();
        const name = String(row[1] ?? '').trim();
        if (!id || !name || id.toLowerCase() === 'id') return null;
        return {
          id,
          name,
          createdAt: String(row[2] ?? '').trim() || new Date().toISOString(),
        };
      })
      .filter((item): item is ColorRecord => item !== null);

    return NextResponse.json(
      { colors, source: 'sheets' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read Colors sheet';
    console.warn('Colors sheet read error:', message);
    return NextResponse.json(
      { colors: [], source: 'error', note: message },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  if (!isPlainObject(rawBody)) {
    return NextResponse.json(
      { success: false, error: 'Payload must be an object' },
      { status: 400 }
    );
  }

  const name = typeof rawBody.name === 'string' ? rawBody.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Color name is required' },
      { status: 400 }
    );
  }

  const record: ColorRecord = {
    id: `clr-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
  };

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await ensureSheetTabWithHeaders(config.sheetId, COLORS_TAB, COLORS_HEADERS);
      const sheets = getGoogleSheetsClient();

      // Avoid duplicate color names (case-insensitive)
      const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: COLORS_RANGE,
      });
      const existingRows = (existingRes.data.values || []) as string[][];
      const duplicate = existingRows.find(
        (row, idx) =>
          !(idx === 0 && String(row[0] ?? '').trim().toLowerCase() === 'id') &&
          String(row[1] ?? '').trim().toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json({
          success: true,
          persisted: 'sheets',
          color: {
            id: String(duplicate[0] ?? record.id).trim(),
            name: String(duplicate[1] ?? name).trim(),
            createdAt: String(duplicate[2] ?? record.createdAt).trim(),
          },
          duplicate: true,
        });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: COLORS_RANGE,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[record.id, record.name, record.createdAt]],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message =
        sheetErr instanceof Error ? sheetErr.message : 'Google Sheets append failed';
      console.error('Could not save color to Google Sheets:', message);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    color: record,
  });
}
