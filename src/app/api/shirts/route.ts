import { NextResponse } from 'next/server';
import { INITIAL_SHIRTS } from '@/data/shirts';
import {
  deleteSheetRowById,
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';
import type { Shirt, ShirtSize, ShirtStyle } from '@/types/shirt';

const VALID_SHIRT_STYLES: ReadonlySet<ShirtStyle> = new Set([
  'tshirt',
  'polo',
  'oxford',
  'hoodie',
]);

const SHIRTS_SHEET_RANGE = 'Shirts!A:O';
const SHIRTS_DATA_RANGE = 'Shirts!A2:O';

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

function validateAndNormalizeSizes(
  rawSizes: unknown,
  shirtId: string
): { sizes?: ShirtSize[]; error?: string } {
  if (!Array.isArray(rawSizes) || rawSizes.length === 0) {
    return { error: 'sizes must be a non-empty array' };
  }

  const normalized: ShirtSize[] = [];

  for (let idx = 0; idx < rawSizes.length; idx += 1) {
    const entry = rawSizes[idx];
    if (!isPlainObject(entry)) {
      return { error: `sizes[${idx}] must be an object` };
    }

    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (!label) {
      return { error: `sizes[${idx}].label is required` };
    }

    const chestInch = toFiniteNumber(entry.chestInch);
    const lengthInch = toFiniteNumber(entry.lengthInch);
    const price = toFiniteNumber(entry.price);
    const stock = entry.stock === undefined ? 0 : toFiniteNumber(entry.stock);

    if (chestInch === null || chestInch <= 0) {
      return { error: `sizes[${idx}].chestInch must be a positive number` };
    }
    if (lengthInch === null || lengthInch <= 0) {
      return { error: `sizes[${idx}].lengthInch must be a positive number` };
    }
    if (price === null || price < 0) {
      return { error: `sizes[${idx}].price must be a non-negative number` };
    }
    if (stock === null || stock < 0) {
      return { error: `sizes[${idx}].stock must be a non-negative number` };
    }

    let shoulderInch: number | undefined;
    if (entry.shoulderInch !== undefined && entry.shoulderInch !== null && entry.shoulderInch !== '') {
      const parsedShoulder = toFiniteNumber(entry.shoulderInch);
      if (parsedShoulder === null || parsedShoulder <= 0) {
        return { error: `sizes[${idx}].shoulderInch must be a positive number` };
      }
      shoulderInch = parsedShoulder;
    }

    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || String(idx + 1);
    const id = rawId || `${shirtId}-${slug}-${idx + 1}`;

    normalized.push({
      id,
      label,
      chestInch,
      lengthInch,
      ...(shoulderInch !== undefined ? { shoulderInch } : {}),
      price,
      stock: Math.floor(stock),
    });
  }

  return { sizes: normalized };
}

function validateAndNormalizeShirt(
  payload: unknown,
  options: { requireId?: boolean } = {}
): { shirt?: Shirt; error?: string } {
  if (!isPlainObject(payload)) {
    return { error: 'Request body must be a JSON object' };
  }

  const rawId = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (options.requireId && !rawId) {
    return { error: 'Shirt id is required for updates' };
  }

  const id = rawId || `shirt-${Date.now()}`;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) {
    return { error: 'Shirt name is required' };
  }

  const styleRaw = typeof payload.style === 'string' ? payload.style.trim() : '';
  if (!VALID_SHIRT_STYLES.has(styleRaw as ShirtStyle)) {
    return {
      error: "Invalid style. Expected one of 'tshirt', 'polo', 'oxford', or 'hoodie'",
    };
  }
  const style = styleRaw as ShirtStyle;

  const sizesCheck = validateAndNormalizeSizes(payload.sizes, id);
  if (sizesCheck.error || !sizesCheck.sizes) {
    return { error: sizesCheck.error || 'Invalid sizes array' };
  }

  const parsedBasePrice = toFiniteNumber(payload.basePrice);
  const basePrice =
    parsedBasePrice !== null && parsedBasePrice >= 0
      ? parsedBasePrice
      : sizesCheck.sizes[0].price;

  const sku =
    typeof payload.sku === 'string' && payload.sku.trim()
      ? payload.sku.trim()
      : `AT-${style.toUpperCase().slice(0, 3)}-${String(Date.now()).slice(-4)}`;

  const brandOrCollection =
    typeof payload.brandOrCollection === 'string' && payload.brandOrCollection.trim()
      ? payload.brandOrCollection.trim()
      : 'ATELIER STUDIO';

  const category =
    typeof payload.category === 'string' && payload.category.trim()
      ? payload.category.trim()
      : style === 'polo'
      ? 'Polo Shirt'
      : style === 'oxford'
      ? 'Oxford Shirt'
      : style === 'hoodie'
      ? 'Hoodie'
      : 'T-Shirt';

  const color =
    typeof payload.color === 'string' && payload.color.trim()
      ? payload.color.trim()
      : '#1a2332';

  const accentColor =
    typeof payload.accentColor === 'string' && payload.accentColor.trim()
      ? payload.accentColor.trim()
      : '#c8a96e';

  const fabricNote =
    typeof payload.fabricNote === 'string' && payload.fabricNote.trim()
      ? payload.fabricNote.trim()
      : undefined;

  const tagText =
    typeof payload.tagText === 'string' && payload.tagText.trim()
      ? payload.tagText.trim()
      : undefined;

  const frontImageUrl =
    typeof payload.frontImageUrl === 'string' && payload.frontImageUrl.trim()
      ? payload.frontImageUrl.trim()
      : undefined;

  const backImageUrl =
    typeof payload.backImageUrl === 'string' && payload.backImageUrl.trim()
      ? payload.backImageUrl.trim()
      : undefined;

  const createdAt =
    typeof payload.createdAt === 'string' && payload.createdAt.trim()
      ? payload.createdAt.trim()
      : new Date().toISOString();

  return {
    shirt: {
      id,
      sku,
      name,
      brandOrCollection,
      category,
      style,
      color,
      accentColor,
      basePrice,
      ...(fabricNote !== undefined ? { fabricNote } : {}),
      ...(tagText !== undefined ? { tagText } : {}),
      ...(frontImageUrl !== undefined ? { frontImageUrl } : {}),
      ...(backImageUrl !== undefined ? { backImageUrl } : {}),
      sizes: sizesCheck.sizes,
      createdAt,
    },
  };
}

function shirtToSheetRow(shirt: Shirt): (string | number)[] {
  return [
    shirt.id,
    shirt.sku,
    shirt.name,
    shirt.brandOrCollection,
    shirt.category,
    shirt.style,
    shirt.color,
    shirt.accentColor,
    shirt.basePrice,
    shirt.fabricNote || '',
    shirt.tagText || '',
    shirt.frontImageUrl || '',
    shirt.backImageUrl || '',
    JSON.stringify(shirt.sizes),
    shirt.createdAt || new Date().toISOString(),
  ];
}

function sheetRowToShirt(row: string[], index: number): Shirt | null {
  const id = (row[0] || '').trim();
  const name = (row[2] || '').trim();
  if (!id || !name || id.toLowerCase() === 'id') {
    return null;
  }

  const styleCandidate = (row[5] || 'tshirt').trim() as ShirtStyle;
  const style: ShirtStyle = VALID_SHIRT_STYLES.has(styleCandidate) ? styleCandidate : 'tshirt';
  const basePrice = toFiniteNumber(row[8]) ?? 890;

  let sizes: ShirtSize[] = [];
  if (row[13]) {
    try {
      const parsedSizes = JSON.parse(row[13]) as unknown;
      const check = validateAndNormalizeSizes(parsedSizes, id);
      if (check.sizes) {
        sizes = check.sizes;
      }
    } catch {
      sizes = [];
    }
  }

  if (sizes.length === 0) {
    sizes = [
      {
        id: `${id}-m`,
        label: 'M',
        chestInch: 40,
        lengthInch: 28,
        shoulderInch: 18.5,
        price: basePrice,
        stock: 10,
      },
    ];
  }

  return {
    id: id || `shirt-sheet-${index + 1}`,
    sku: (row[1] || `AT-SH-${index + 1}`).trim(),
    name,
    brandOrCollection: (row[3] || 'ATELIER STUDIO').trim(),
    category: (row[4] || 'T-Shirt').trim(),
    style,
    color: (row[6] || '#1a2332').trim(),
    accentColor: (row[7] || '#c8a96e').trim(),
    basePrice,
    ...(row[9]?.trim() ? { fabricNote: row[9].trim() } : {}),
    ...(row[10]?.trim() ? { tagText: row[10].trim() } : {}),
    ...(row[11]?.trim() ? { frontImageUrl: row[11].trim() } : {}),
    ...(row[12]?.trim() ? { backImageUrl: row[12].trim() } : {}),
    sizes,
    createdAt: row[14]?.trim() || undefined,
  };
}

export async function GET(request?: Request) {
  // Touch request.url so Next.js 16 (cacheComponents: true) evaluates runtime env config per request.
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json({
      shirts: INITIAL_SHIRTS,
      source: 'catalog',
    });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: SHIRTS_DATA_RANGE,
    });

    const rows = (res.data.values || []) as string[][];
    const parsedShirts = rows
      .map((row, idx) => sheetRowToShirt(row, idx))
      .filter((shirt): shirt is Shirt => shirt !== null);

    if (parsedShirts.length > 0) {
      return NextResponse.json({
        shirts: parsedShirts,
        source: 'sheets',
      });
    }

    return NextResponse.json({
      shirts: INITIAL_SHIRTS,
      source: 'catalog',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read Shirts sheet';
    console.warn('Falling back to INITIAL_SHIRTS catalog:', message);
    return NextResponse.json({
      shirts: INITIAL_SHIRTS,
      source: 'catalog',
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

  const { shirt, error } = validateAndNormalizeShirt(rawBody);
  if (error || !shirt) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid shirt payload' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      const sheets = getGoogleSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.sheetId,
        range: SHIRTS_SHEET_RANGE,
        valueInputOption: 'RAW',
        requestBody: {
          values: [shirtToSheetRow(shirt)],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets append failed';
      console.error('Could not append shirt to Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    shirt,
  });
}

async function handleUpdateShirt(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  const { shirt, error } = validateAndNormalizeShirt(rawBody, { requireId: true });
  if (error || !shirt) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid shirt update payload' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      const sheets = getGoogleSheetsClient();
      const idLookup = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: 'Shirts!A:A',
      });
      const rows = idLookup.data.values || [];
      const rowIndex = rows.findIndex((row, idx) => {
        const cell = String(row[0] ?? '').trim();
        if (idx === 0 && cell.toLowerCase() === 'id') return false;
        return cell === shirt.id;
      });

      if (rowIndex !== -1) {
        const rowNumber = rowIndex + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.sheetId,
          range: `Shirts!A${rowNumber}:O${rowNumber}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [shirtToSheetRow(shirt)],
          },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.sheetId,
          range: SHIRTS_SHEET_RANGE,
          valueInputOption: 'RAW',
          requestBody: {
            values: [shirtToSheetRow(shirt)],
          },
        });
      }
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets update failed';
      console.error('Could not update shirt in Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    shirt,
  });
}

export async function PUT(req: Request) {
  return handleUpdateShirt(req);
}

export async function PATCH(req: Request) {
  return handleUpdateShirt(req);
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
      { success: false, error: 'Shirt ID is required' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await deleteSheetRowById(config.sheetId, 'Shirts', id);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets delete failed';
      console.error('Could not delete shirt from Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    deletedId: id,
  });
}
