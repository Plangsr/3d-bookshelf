import { NextResponse } from 'next/server';
import { DEFAULT_SHOP_PROFILE } from '@/data/shirts';
import {
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';
import type { ShopProfile } from '@/types/shirt';

const SHOP_PROFILE_RANGE = 'ShopProfile!A1:H2';
const SHOP_PROFILE_DATA_RANGE = 'ShopProfile!A2:H';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateAndNormalizeShopProfile(payload: unknown): {
  shopProfile?: ShopProfile;
  error?: string;
} {
  const candidate =
    isPlainObject(payload) && isPlainObject(payload.shopProfile)
      ? payload.shopProfile
      : payload;

  if (!isPlainObject(candidate)) {
    return { error: 'Request body must contain a shopProfile object' };
  }

  const shopName = typeof candidate.shopName === 'string' ? candidate.shopName.trim() : '';
  if (!shopName) {
    return { error: 'shopName is required' };
  }

  const tagline =
    typeof candidate.tagline === 'string'
      ? candidate.tagline.trim()
      : DEFAULT_SHOP_PROFILE.tagline;
  const address =
    typeof candidate.address === 'string'
      ? candidate.address.trim()
      : DEFAULT_SHOP_PROFILE.address;
  const phone =
    typeof candidate.phone === 'string'
      ? candidate.phone.trim()
      : DEFAULT_SHOP_PROFILE.phone;
  const taxId =
    typeof candidate.taxId === 'string'
      ? candidate.taxId.trim()
      : DEFAULT_SHOP_PROFILE.taxId;
  const promptPayId =
    typeof candidate.promptPayId === 'string'
      ? candidate.promptPayId.trim()
      : DEFAULT_SHOP_PROFILE.promptPayId || '';
  const footerNote =
    typeof candidate.footerNote === 'string'
      ? candidate.footerNote.trim()
      : DEFAULT_SHOP_PROFILE.footerNote;

  return {
    shopProfile: {
      shopName,
      tagline,
      address,
      phone,
      taxId,
      promptPayId,
      footerNote,
    },
  };
}

function sheetRowToShopProfile(row: string[]): ShopProfile | null {
  const id = String(row[0] ?? '').trim();
  const shopName = String(row[1] ?? '').trim();
  if (!shopName || id.toLowerCase() === 'id') {
    return null;
  }

  return {
    shopName,
    tagline: String(row[2] ?? '').trim(),
    address: String(row[3] ?? '').trim(),
    phone: String(row[4] ?? '').trim(),
    taxId: String(row[5] ?? '').trim(),
    promptPayId: String(row[6] ?? '').trim(),
    footerNote: String(row[7] ?? '').trim(),
  };
}

export async function GET(request?: Request) {
  // Touch request.url so Next.js 16 (cacheComponents: true) evaluates runtime env config per request.
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json({
      shopProfile: DEFAULT_SHOP_PROFILE,
      source: 'default',
    });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: SHOP_PROFILE_DATA_RANGE,
    });

    const rows = (res.data.values || []) as string[][];
    const defaultRow =
      rows.find((row) => String(row[0] ?? '').trim() === 'default') || rows[0];

    if (defaultRow) {
      const parsed = sheetRowToShopProfile(defaultRow);
      if (parsed) {
        return NextResponse.json({
          shopProfile: parsed,
          source: 'sheets',
        });
      }
    }

    return NextResponse.json({
      shopProfile: DEFAULT_SHOP_PROFILE,
      source: 'default',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read ShopProfile sheet';
    console.warn('Falling back to DEFAULT_SHOP_PROFILE:', message);
    return NextResponse.json({
      shopProfile: DEFAULT_SHOP_PROFILE,
      source: 'default',
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

  const { shopProfile, error } = validateAndNormalizeShopProfile(rawBody);
  if (error || !shopProfile) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid shopProfile payload' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      const sheets = getGoogleSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.sheetId,
        range: SHOP_PROFILE_RANGE,
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['id', 'shopName', 'tagline', 'address', 'phone', 'taxId', 'promptPayId', 'footerNote'],
            [
              'default',
              shopProfile.shopName,
              shopProfile.tagline,
              shopProfile.address,
              shopProfile.phone,
              shopProfile.taxId,
              shopProfile.promptPayId || '',
              shopProfile.footerNote,
            ],
          ],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets update failed';
      console.error('Could not update ShopProfile in Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    shopProfile,
  });
}
