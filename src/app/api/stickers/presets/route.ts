import { NextResponse } from 'next/server';
import {
  deleteSheetRowById,
  ensureSheetTabWithHeaders,
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';
import type { StickerConfig, StickerPrintSettings, StickerSet } from '@/types/shirt';

const STICKER_PRESETS_TAB = 'StickerPresets';
const STICKER_PRESETS_RANGE = 'StickerPresets!A:Q';
const STICKER_PRESETS_HEADERS = [
  'id',
  'name',
  'modelName',
  'colorName',
  'sizeLabel',
  'showBarcode',
  'barcodeDigits',
  'barcodeCaption',
  'paperWidthMm',
  'paperHeightMm',
  'defaultCopies',
  'fontScalePct',
  'calibrationJson',
  'updatedAt',
  'paperSizeId',
  'configJson',
  'printSettingsJson',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject<T>(raw: string | undefined): Partial<T> | null {
  if (!raw || !raw.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? (parsed as Partial<T>) : null;
  } catch {
    return null;
  }
}

function stickerSetToSheetRow(set: StickerSet): (string | number | boolean)[] {
  return [
    set.id,
    set.name,
    set.config.modelName ?? '',
    set.config.colorName ?? '',
    set.config.sizeLabel ?? '',
    Boolean(set.config.showBarcode),
    set.config.barcodeDigits ?? '',
    set.config.barcodeCaption ?? '',
    set.calibration?.paperWidthMm || 30,
    set.calibration?.paperHeightMm === null ? '' : set.calibration?.paperHeightMm ?? 40,
    set.defaultCopies || 1,
    set.config.fontScalePct ?? 100,
    JSON.stringify(set.calibration || {}),
    set.updatedAt || new Date().toISOString(),
    set.paperSizeId || '',
    JSON.stringify(set.config || {}),
    JSON.stringify(set.printSettings || {}),
  ];
}

function sheetRowToStickerSet(row: string[]): StickerSet | null {
  const id = String(row[0] ?? '').trim();
  if (!id || id.toLowerCase() === 'id') {
    return null;
  }

  let calibration = {
    paperWidthMm: Number(row[8]) || 30,
    paperHeightMm: row[9] && row[9].trim() !== '' ? Number(row[9]) : null,
    orientation: 'portrait' as const,
    marginTopMm: 2,
    marginRightMm: 2,
    marginBottomMm: 2,
    marginLeftMm: 2,
    offsetXMm: 0,
    offsetYMm: 0,
    contentWidthPct: 100,
  };

  const parsedCal = parseJsonObject<typeof calibration>(row[12]);
  if (parsedCal) {
    calibration = { ...calibration, ...parsedCal };
  }

  const baseConfig: StickerConfig = {
    brandHeader: '',
    showBrandHeader: false,
    modelName: String(row[2] ?? '').trim(),
    colorName: String(row[3] ?? '').trim(),
    sizeLabel: String(row[4] ?? '').trim(),
    writeInLineStyle: 'solid',
    showBarcode: String(row[5] ?? '').toLowerCase() === 'true',
    barcodeDigits: String(row[6] ?? '').trim(),
    barcodeCaption: String(row[7] ?? '').trim(),
    borderRadiusMm: 2,
    showCutBorder: true,
    fontScalePct: Number(row[11]) || 100,
    textAlign: 'left',
    detailDensity: 'auto',
  };

  const parsedConfig = parseJsonObject<StickerConfig>(row[15]);
  const mergedConfig: StickerConfig = parsedConfig
    ? { ...baseConfig, ...parsedConfig }
    : baseConfig;

  const parsedPrintSettings = parseJsonObject<StickerPrintSettings>(row[16]) ?? undefined;
  const rawPaperSizeId = String(row[14] ?? '').trim();

  return {
    id,
    name: String(row[1] ?? '').trim() || 'Preset สติกเกอร์',
    paperSizeId: rawPaperSizeId || `preset-${id}`,
    config: mergedConfig,
    calibration,
    defaultCopies: Number(row[10]) || 1,
    ...(parsedPrintSettings ? { printSettings: parsedPrintSettings as StickerPrintSettings } : {}),
    updatedAt: String(row[13] ?? '').trim() || new Date().toISOString(),
  };
}

export async function GET(request?: Request) {
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json(
      {
        presets: [],
        source: 'local',
        note: 'No sheets config found',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values
      .get({
        spreadsheetId: config.sheetId,
        range: STICKER_PRESETS_RANGE,
      })
      .catch(async () => {
        await ensureSheetTabWithHeaders(
          config.sheetId,
          STICKER_PRESETS_TAB,
          STICKER_PRESETS_HEADERS
        );
        return sheets.spreadsheets.values.get({
          spreadsheetId: config.sheetId,
          range: STICKER_PRESETS_RANGE,
        });
      });

    const allRows = (res.data.values || []) as string[][];
    const presets = allRows
      .map((row) => sheetRowToStickerSet(row))
      .filter((rec): rec is StickerSet => rec !== null)
      .sort((a, b) => {
        const ta = Date.parse(a.updatedAt) || 0;
        const tb = Date.parse(b.updatedAt) || 0;
        return tb - ta;
      });

    return NextResponse.json(
      {
        presets,
        source: 'sheets',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read StickerPresets sheet';
    console.warn('StickerPresets sheet read error:', message);
    return NextResponse.json(
      {
        presets: [],
        source: 'error',
        note: message,
      },
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

  const setItem = rawBody as unknown as StickerSet;
  if (!setItem.id || !setItem.name) {
    return NextResponse.json(
      { success: false, error: 'Preset id and name are required' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await ensureSheetTabWithHeaders(
        config.sheetId,
        STICKER_PRESETS_TAB,
        STICKER_PRESETS_HEADERS
      );
      const sheets = getGoogleSheetsClient();
      // Delete any existing rows with this ID so POST acts as an idempotent upsert.
      await deleteSheetRowById(config.sheetId, STICKER_PRESETS_TAB, setItem.id);

      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: STICKER_PRESETS_RANGE,
        valueInputOption: 'RAW',
        requestBody: {
          values: [stickerSetToSheetRow(setItem)],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message =
        sheetErr instanceof Error ? sheetErr.message : 'Google Sheets append failed';
      console.error('Could not save sticker preset to Google Sheets:', message);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    preset: setItem,
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
      { success: false, error: 'Preset ID is required' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await deleteSheetRowById(config.sheetId, STICKER_PRESETS_TAB, id);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message =
        sheetErr instanceof Error ? sheetErr.message : 'Google Sheets delete failed';
      console.error('Could not delete sticker preset from Google Sheets:', message);
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    deletedId: id,
  });
}
