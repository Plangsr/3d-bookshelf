import { NextResponse } from 'next/server';
import {
  deleteSheetRowById,
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';

const STICKERS_SHEET_TAB = 'Stickers';
const STICKERS_SHEET_RANGE = 'Stickers!A:N';
const STICKERS_DATA_RANGE = 'Stickers!A2:N';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function pruneExpiredStickerLogs(sheetId: string): Promise<number> {
  const sheets = getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: STICKERS_SHEET_RANGE,
  });

  const rows = (res.data.values || []) as string[][];
  const cutoffMs = Date.now() - ONE_DAY_MS;
  const expiredRowIndices: number[] = [];

  rows.forEach((row, idx) => {
    const id = String(row[0] ?? '').trim();
    if (idx === 0 && id.toLowerCase() === 'id') {
      return;
    }
    if (!id) return;
    const createdAtMs = Date.parse(String(row[12] ?? '').trim());
    if (!Number.isFinite(createdAtMs) || createdAtMs < cutoffMs) {
      expiredRowIndices.push(idx);
    }
  });

  if (expiredRowIndices.length === 0) {
    return 0;
  }

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });
  const targetTab = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === STICKERS_SHEET_TAB
  );
  const tabSheetId = targetTab?.properties?.sheetId;
  if (tabSheetId === undefined || tabSheetId === null) {
    return 0;
  }

  const requests = expiredRowIndices
    .sort((a, b) => b - a)
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId: tabSheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests },
  });

  return expiredRowIndices.length;
}

export interface StickerSheetRecord {
  id: string;
  modelName: string;
  colorName: string;
  sizeLabel: string;
  showBarcode: boolean;
  barcodeDigits: string;
  barcodeCaption: string;
  paperWidthMm: number;
  paperHeightMm: number | null;
  copies: number;
  fontScalePct: number;
  presetName: string;
  createdAt: string;
  notes?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stickerRecordToSheetRow(record: StickerSheetRecord): (string | number | boolean)[] {
  return [
    record.id,
    record.modelName,
    record.colorName,
    record.sizeLabel,
    record.showBarcode,
    record.barcodeDigits,
    record.barcodeCaption,
    record.paperWidthMm,
    record.paperHeightMm === null ? '' : record.paperHeightMm,
    record.copies,
    record.fontScalePct,
    record.presetName,
    record.createdAt,
    record.notes || '',
  ];
}

function sheetRowToStickerRecord(row: string[]): StickerSheetRecord | null {
  const id = String(row[0] ?? '').trim();
  if (!id || id.toLowerCase() === 'id') {
    return null;
  }

  return {
    id,
    modelName: String(row[1] ?? '').trim(),
    colorName: String(row[2] ?? '').trim(),
    sizeLabel: String(row[3] ?? '').trim(),
    showBarcode: String(row[4] ?? '').toLowerCase() === 'true',
    barcodeDigits: String(row[5] ?? '').trim(),
    barcodeCaption: String(row[6] ?? '').trim(),
    paperWidthMm: Number(row[7]) || 30,
    paperHeightMm: row[8] && row[8].trim() !== '' ? Number(row[8]) : null,
    copies: Number(row[9]) || 1,
    fontScalePct: Number(row[10]) || 100,
    presetName: String(row[11] ?? '').trim(),
    createdAt: String(row[12] ?? '').trim() || new Date().toISOString(),
    notes: String(row[13] ?? '').trim(),
  };
}

export async function GET(request?: Request) {
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json({
      stickers: [],
      note: 'No sheets config found',
    });
  }

  try {
    await pruneExpiredStickerLogs(config.sheetId).catch((err) => {
      console.warn('Stickers prune warning:', err);
    });

    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: STICKERS_DATA_RANGE,
    });

    const rows = (res.data.values || []) as string[][];
    const stickers = rows
      .map((row) => sheetRowToStickerRecord(row))
      .filter((rec): rec is StickerSheetRecord => rec !== null)
      .reverse();

    return NextResponse.json({
      stickers,
      source: 'sheets',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read Stickers sheet';
    console.warn('Stickers sheet read error:', message);
    return NextResponse.json({
      stickers: [],
      note: message,
    });
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

  const modelName = typeof rawBody.modelName === 'string' ? rawBody.modelName.trim() : '';
  const colorName = typeof rawBody.colorName === 'string' ? rawBody.colorName.trim() : '';
  const sizeLabel = typeof rawBody.sizeLabel === 'string' ? rawBody.sizeLabel.trim() : '';
  const barcodeDigits = typeof rawBody.barcodeDigits === 'string' ? rawBody.barcodeDigits.trim() : '';
  const barcodeCaption = typeof rawBody.barcodeCaption === 'string' ? rawBody.barcodeCaption.trim() : '';
  const paperWidthMm = typeof rawBody.paperWidthMm === 'number' ? rawBody.paperWidthMm : 30;
  const paperHeightMm =
    typeof rawBody.paperHeightMm === 'number'
      ? rawBody.paperHeightMm
      : rawBody.paperHeightMm === null
      ? null
      : 40;
  const copies = typeof rawBody.copies === 'number' ? Math.max(1, rawBody.copies) : 1;
  const fontScalePct = typeof rawBody.fontScalePct === 'number' ? rawBody.fontScalePct : 100;
  const presetName = typeof rawBody.presetName === 'string' ? rawBody.presetName.trim() : '';
  const notes = typeof rawBody.notes === 'string' ? rawBody.notes.trim() : '';

  const id =
    typeof rawBody.id === 'string' && rawBody.id.trim()
      ? rawBody.id.trim()
      : `stk-${Date.now()}`;
  const createdAt =
    typeof rawBody.createdAt === 'string' && rawBody.createdAt.trim()
      ? rawBody.createdAt.trim()
      : new Date().toISOString();

  const record: StickerSheetRecord = {
    id,
    modelName,
    colorName,
    sizeLabel,
    showBarcode: Boolean(rawBody.showBarcode),
    barcodeDigits,
    barcodeCaption,
    paperWidthMm,
    paperHeightMm,
    copies,
    fontScalePct,
    presetName,
    createdAt,
    notes,
  };

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      const sheets = getGoogleSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: STICKERS_SHEET_RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [stickerRecordToSheetRow(record)],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message =
        sheetErr instanceof Error ? sheetErr.message : 'Google Sheets append failed';
      console.error('Could not log sticker to Google Sheets:', message);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    record,
  });
}

export async function DELETE(req: Request) {
  let id = '';

  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get('id')?.trim();
  if (queryId) {
    id = queryId;
  } else {
    try {
      const body = (await req.json()) as { id?: unknown };
      if (typeof body?.id === 'string') {
        id = body.id.trim();
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }
  }

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Sticker ID is required' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await deleteSheetRowById(config.sheetId, 'Stickers', id);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message =
        sheetErr instanceof Error ? sheetErr.message : 'Google Sheets delete failed';
      console.error('Could not delete sticker from Google Sheets:', message);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    deletedId: id,
  });
}

