import { NextResponse } from 'next/server';
import { INITIAL_PAPER_SIZES } from '@/data/shirts';
import {
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';
import type { ReceiptPaperSize, ReceiptTemplateType } from '@/types/shirt';

const PAPER_SIZES_DATA_RANGE = 'PaperSizes!A2:J';

const VALID_TEMPLATES: ReadonlySet<ReceiptTemplateType> = new Set([
  'thermal_pos',
  'retail_standard',
  'tax_invoice',
  'boutique_gift',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function validateAndNormalizePaperSize(
  entry: unknown,
  idx: number
): { size?: ReceiptPaperSize; error?: string } {
  if (!isPlainObject(entry)) {
    return { error: `paperSizes[${idx}] must be an object` };
  }

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) {
    return { error: `paperSizes[${idx}].name is required` };
  }

  const widthMm = toFiniteNumber(entry.widthMm);
  if (widthMm === null || widthMm <= 0) {
    return { error: `paperSizes[${idx}].widthMm must be a positive number` };
  }

  let heightMm: number | null = null;
  if (entry.heightMm !== null && entry.heightMm !== undefined && entry.heightMm !== '') {
    const parsedHeight = toFiniteNumber(entry.heightMm);
    if (parsedHeight === null || parsedHeight <= 0) {
      return { error: `paperSizes[${idx}].heightMm must be null or a positive number` };
    }
    heightMm = parsedHeight;
  }

  const marginMm = entry.marginMm === undefined ? 4 : toFiniteNumber(entry.marginMm);
  if (marginMm === null || marginMm < 0) {
    return { error: `paperSizes[${idx}].marginMm must be a non-negative number` };
  }

  const fontScale = entry.fontScale === undefined ? 1 : toFiniteNumber(entry.fontScale);
  if (fontScale === null || fontScale <= 0) {
    return { error: `paperSizes[${idx}].fontScale must be a positive number` };
  }

  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (entry.orientation !== undefined) {
    if (entry.orientation !== 'portrait' && entry.orientation !== 'landscape') {
      return { error: `paperSizes[${idx}].orientation must be 'portrait' or 'landscape'` };
    }
    orientation = entry.orientation;
  }

  let defaultTemplate: ReceiptTemplateType | undefined;
  if (entry.defaultTemplate !== undefined && entry.defaultTemplate !== '') {
    if (
      typeof entry.defaultTemplate !== 'string' ||
      !VALID_TEMPLATES.has(entry.defaultTemplate as ReceiptTemplateType)
    ) {
      return { error: `paperSizes[${idx}].defaultTemplate is invalid` };
    }
    defaultTemplate = entry.defaultTemplate as ReceiptTemplateType;
  }

  const id =
    typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : `size-custom-${Date.now()}-${idx + 1}`;

  return {
    size: {
      id,
      name,
      widthMm,
      heightMm,
      marginMm,
      fontScale,
      orientation,
      ...(defaultTemplate !== undefined ? { defaultTemplate } : {}),
      ...(typeof entry.isPreset === 'boolean' ? { isPreset: entry.isPreset } : {}),
    },
  };
}

function validatePaperSizeList(rawList: unknown): {
  paperSizes?: ReceiptPaperSize[];
  error?: string;
} {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return { error: 'paperSizes must be a non-empty array' };
  }

  const paperSizes: ReceiptPaperSize[] = [];
  for (let idx = 0; idx < rawList.length; idx += 1) {
    const check = validateAndNormalizePaperSize(rawList[idx], idx);
    if (check.error || !check.size) {
      return { error: check.error || 'Invalid paper size item' };
    }
    paperSizes.push(check.size);
  }

  return { paperSizes };
}

function paperSizeToSheetRow(size: ReceiptPaperSize): (string | number | boolean)[] {
  return [
    size.id,
    size.name,
    size.widthMm,
    size.heightMm === null ? '' : size.heightMm,
    size.marginMm,
    size.fontScale,
    size.orientation,
    size.defaultTemplate || '',
    Boolean(size.isPreset),
    new Date().toISOString(),
  ];
}

function sheetRowToPaperSize(row: string[]): ReceiptPaperSize | null {
  const id = String(row[0] ?? '').trim();
  const name = String(row[1] ?? '').trim();
  if (!id || !name || id.toLowerCase() === 'id') {
    return null;
  }

  const widthMm = toFiniteNumber(row[2]);
  if (widthMm === null || widthMm <= 0) {
    return null;
  }

  const rawHeight = String(row[3] ?? '').trim();
  let heightMm: number | null = null;
  if (rawHeight && rawHeight.toLowerCase() !== 'null' && rawHeight.toLowerCase() !== 'auto') {
    const parsedHeight = toFiniteNumber(rawHeight);
    if (parsedHeight !== null && parsedHeight > 0) {
      heightMm = parsedHeight;
    }
  }

  const marginMm = toFiniteNumber(row[4]) ?? 4;
  const fontScale = toFiniteNumber(row[5]) ?? 1;
  const orientation =
    String(row[6] ?? '').trim().toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  const rawTemplate = String(row[7] ?? '').trim();
  const defaultTemplate = VALID_TEMPLATES.has(rawTemplate as ReceiptTemplateType)
    ? (rawTemplate as ReceiptTemplateType)
    : undefined;
  const rawPreset = String(row[8] ?? '').trim().toLowerCase();
  const isPreset =
    rawPreset === 'true' || rawPreset === '1'
      ? true
      : rawPreset === 'false' || rawPreset === '0'
      ? false
      : undefined;

  return {
    id,
    name,
    widthMm,
    heightMm,
    marginMm: Math.max(0, marginMm),
    fontScale: fontScale > 0 ? fontScale : 1,
    orientation,
    ...(defaultTemplate !== undefined ? { defaultTemplate } : {}),
    ...(isPreset !== undefined ? { isPreset } : {}),
  };
}

async function readPaperSizesFromSheet(sheetId: string): Promise<ReceiptPaperSize[]> {
  const sheets = getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: PAPER_SIZES_DATA_RANGE,
  });

  const rows = (res.data.values || []) as string[][];
  return rows
    .map((row) => sheetRowToPaperSize(row))
    .filter((size): size is ReceiptPaperSize => size !== null);
}

async function replacePaperSizesInSheet(
  sheetId: string,
  paperSizes: ReceiptPaperSize[]
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: PAPER_SIZES_DATA_RANGE,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: PAPER_SIZES_DATA_RANGE,
    valueInputOption: 'RAW',
    requestBody: {
      values: paperSizes.map(paperSizeToSheetRow),
    },
  });
}

export async function GET(request?: Request) {
  // Touch request.url so Next.js 16 (cacheComponents: true) evaluates runtime env config per request.
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json({
      paperSizes: INITIAL_PAPER_SIZES,
      source: 'catalog',
    });
  }

  try {
    const parsed = await readPaperSizesFromSheet(config.sheetId);
    if (parsed.length > 0) {
      return NextResponse.json({
        paperSizes: parsed,
        source: 'sheets',
      });
    }

    return NextResponse.json({
      paperSizes: INITIAL_PAPER_SIZES,
      source: 'catalog',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read PaperSizes sheet';
    console.warn('Falling back to INITIAL_PAPER_SIZES catalog:', message);
    return NextResponse.json({
      paperSizes: INITIAL_PAPER_SIZES,
      source: 'catalog',
    });
  }
}

export async function PUT(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  const listCandidate = Array.isArray(rawBody)
    ? rawBody
    : isPlainObject(rawBody)
    ? rawBody.paperSizes
    : null;

  const { paperSizes, error } = validatePaperSizeList(listCandidate);
  if (error || !paperSizes) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid paperSizes payload' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await replacePaperSizesInSheet(config.sheetId, paperSizes);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets update failed';
      console.error('Could not update PaperSizes in Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    paperSizes,
  });
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

  // Support bulk { paperSizes: [...] } or raw array
  const maybeBulk = Array.isArray(rawBody)
    ? rawBody
    : isPlainObject(rawBody) && Array.isArray(rawBody.paperSizes)
    ? rawBody.paperSizes
    : null;

  if (maybeBulk !== null) {
    const { paperSizes, error } = validatePaperSizeList(maybeBulk);
    if (error || !paperSizes) {
      return NextResponse.json(
        { success: false, error: error || 'Invalid paperSizes payload' },
        { status: 400 }
      );
    }

    let persisted: 'sheets' | 'local' = 'local';
    const config = getSheetsDatabaseConfig();
    if (config) {
      try {
        await replacePaperSizesInSheet(config.sheetId, paperSizes);
        persisted = 'sheets';
      } catch (sheetErr: unknown) {
        const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets update failed';
        console.error('Could not update PaperSizes in Google Sheets:', message);
        return NextResponse.json(
          { success: false, error: message },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      persisted,
      paperSizes,
    });
  }

  // Single paper size payload ({ paperSize: ... } or direct ReceiptPaperSize)
  const singleCandidate =
    isPlainObject(rawBody) && isPlainObject(rawBody.paperSize)
      ? rawBody.paperSize
      : rawBody;
  const { size, error } = validateAndNormalizePaperSize(singleCandidate, 0);
  if (error || !size) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid paper size payload' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  let mergedSizes: ReceiptPaperSize[] = [...INITIAL_PAPER_SIZES];
  const config = getSheetsDatabaseConfig();

  if (config) {
    try {
      const existing = await readPaperSizesFromSheet(config.sheetId);
      const base = existing.length > 0 ? existing : [...INITIAL_PAPER_SIZES];
      const idx = base.findIndex((item) => item.id === size.id);
      mergedSizes =
        idx >= 0
          ? base.map((item, i) => (i === idx ? size : item))
          : [...base, size];

      await replacePaperSizesInSheet(config.sheetId, mergedSizes);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets write failed';
      console.error('Could not save paper size to Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  } else {
    const idx = mergedSizes.findIndex((item) => item.id === size.id);
    mergedSizes =
      idx >= 0
        ? mergedSizes.map((item, i) => (i === idx ? size : item))
        : [...mergedSizes, size];
  }

  return NextResponse.json({
    success: true,
    persisted,
    paperSize: size,
    paperSizes: mergedSizes,
  });
}
