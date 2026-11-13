import { NextResponse } from 'next/server';
import { DEFAULT_SHOP_PROFILE } from '@/data/shirts';
import {
  deleteSheetRowById,
  getGoogleSheetsClient,
  getSheetsDatabaseConfig,
} from '@/lib/googleSheets';
import { calculateReceiptTotals, generateReceiptNumber } from '@/lib/storage';
import type {
  PaymentMethod,
  ReceiptLineItem,
  ReceiptRecord,
  ReceiptTemplateType,
  ShirtStyle,
  ShopProfile,
  VatMode,
} from '@/types/shirt';

const RECEIPTS_SHEET_RANGE = 'Receipts!A:S';
const RECEIPTS_DATA_RANGE = 'Receipts!A2:S';

const VALID_TEMPLATES: ReadonlySet<ReceiptTemplateType> = new Set([
  'thermal_pos',
  'retail_standard',
  'tax_invoice',
  'boutique_gift',
]);

const VALID_VAT_MODES: ReadonlySet<VatMode> = new Set([
  'none',
  'excluded_7',
  'included_7',
]);

const VALID_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  'cash',
  'transfer',
  'card',
  'cod',
]);

const VALID_SHIRT_STYLES: ReadonlySet<ShirtStyle> = new Set([
  'tshirt',
  'polo',
  'oxford',
  'hoodie',
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

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateAndNormalizeShop(rawShop: unknown): ShopProfile {
  if (!isPlainObject(rawShop)) {
    return { ...DEFAULT_SHOP_PROFILE };
  }

  return {
    shopName:
      typeof rawShop.shopName === 'string' && rawShop.shopName.trim()
        ? rawShop.shopName.trim()
        : DEFAULT_SHOP_PROFILE.shopName,
    tagline:
      typeof rawShop.tagline === 'string'
        ? rawShop.tagline.trim()
        : DEFAULT_SHOP_PROFILE.tagline,
    address:
      typeof rawShop.address === 'string'
        ? rawShop.address.trim()
        : DEFAULT_SHOP_PROFILE.address,
    phone:
      typeof rawShop.phone === 'string'
        ? rawShop.phone.trim()
        : DEFAULT_SHOP_PROFILE.phone,
    taxId:
      typeof rawShop.taxId === 'string'
        ? rawShop.taxId.trim()
        : DEFAULT_SHOP_PROFILE.taxId,
    promptPayId:
      typeof rawShop.promptPayId === 'string'
        ? rawShop.promptPayId.trim()
        : DEFAULT_SHOP_PROFILE.promptPayId,
    footerNote:
      typeof rawShop.footerNote === 'string'
        ? rawShop.footerNote.trim()
        : DEFAULT_SHOP_PROFILE.footerNote,
  };
}

function validateAndNormalizeItems(rawItems: unknown): {
  items?: ReceiptLineItem[];
  error?: string;
} {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Receipt items must be a non-empty array' };
  }

  const normalized: ReceiptLineItem[] = [];

  for (let idx = 0; idx < rawItems.length; idx += 1) {
    const entry = rawItems[idx];
    if (!isPlainObject(entry)) {
      return { error: `items[${idx}] must be an object` };
    }

    const shirtName = typeof entry.shirtName === 'string' ? entry.shirtName.trim() : '';
    if (!shirtName) {
      return { error: `items[${idx}].shirtName is required` };
    }

    const sizeLabel = typeof entry.sizeLabel === 'string' ? entry.sizeLabel.trim() : '';
    if (!sizeLabel) {
      return { error: `items[${idx}].sizeLabel is required` };
    }

    const quantity = toFiniteNumber(entry.quantity);
    if (quantity === null || quantity <= 0) {
      return { error: `items[${idx}].quantity must be a positive number` };
    }

    const unitPrice = toFiniteNumber(entry.unitPrice);
    if (unitPrice === null || unitPrice < 0) {
      return { error: `items[${idx}].unitPrice must be a non-negative number` };
    }

    const rawStyle = typeof entry.shirtStyle === 'string' ? entry.shirtStyle.trim() : 'tshirt';
    const shirtStyle: ShirtStyle = VALID_SHIRT_STYLES.has(rawStyle as ShirtStyle)
      ? (rawStyle as ShirtStyle)
      : 'tshirt';

    const lineId =
      typeof entry.lineId === 'string' && entry.lineId.trim()
        ? entry.lineId.trim()
        : `line-${Date.now()}-${idx + 1}`;
    const shirtId =
      typeof entry.shirtId === 'string' && entry.shirtId.trim()
        ? entry.shirtId.trim()
        : `shirt-${idx + 1}`;
    const sku =
      typeof entry.sku === 'string' && entry.sku.trim()
        ? entry.sku.trim()
        : 'AT-ITEM';
    const shirtColor =
      typeof entry.shirtColor === 'string' && entry.shirtColor.trim()
        ? entry.shirtColor.trim()
        : '#1a2332';
    const sizeId =
      typeof entry.sizeId === 'string' && entry.sizeId.trim()
        ? entry.sizeId.trim()
        : `${shirtId}-${sizeLabel.toLowerCase()}`;
    const sizeMeasureText =
      typeof entry.sizeMeasureText === 'string' ? entry.sizeMeasureText.trim() : '';

    normalized.push({
      lineId,
      shirtId,
      sku,
      shirtName,
      shirtColor,
      shirtStyle,
      sizeId,
      sizeLabel,
      sizeMeasureText,
      quantity,
      unitPrice: round2(unitPrice),
    });
  }

  return { items: normalized };
}

function validateAndNormalizeReceipt(payload: unknown): {
  receipt?: ReceiptRecord;
  error?: string;
} {
  if (!isPlainObject(payload)) {
    return { error: 'Request body must be a JSON object' };
  }

  const itemsCheck = validateAndNormalizeItems(payload.items);
  if (itemsCheck.error || !itemsCheck.items) {
    return { error: itemsCheck.error || 'Invalid receipt items' };
  }

  let templateType: ReceiptTemplateType = 'retail_standard';
  if (payload.templateType !== undefined) {
    if (
      typeof payload.templateType !== 'string' ||
      !VALID_TEMPLATES.has(payload.templateType as ReceiptTemplateType)
    ) {
      return {
        error:
          "Invalid templateType. Expected 'thermal_pos', 'retail_standard', 'tax_invoice', or 'boutique_gift'",
      };
    }
    templateType = payload.templateType as ReceiptTemplateType;
  }

  let vatMode: VatMode = 'none';
  if (payload.vatMode !== undefined) {
    if (
      typeof payload.vatMode !== 'string' ||
      !VALID_VAT_MODES.has(payload.vatMode as VatMode)
    ) {
      return {
        error: "Invalid vatMode. Expected 'none', 'excluded_7', or 'included_7'",
      };
    }
    vatMode = payload.vatMode as VatMode;
  }

  let paymentMethod: PaymentMethod = 'cash';
  if (payload.paymentMethod !== undefined) {
    if (
      typeof payload.paymentMethod !== 'string' ||
      !VALID_PAYMENT_METHODS.has(payload.paymentMethod as PaymentMethod)
    ) {
      return {
        error: "Invalid paymentMethod. Expected 'cash', 'transfer', 'card', or 'cod'",
      };
    }
    paymentMethod = payload.paymentMethod as PaymentMethod;
  }

  const discountRaw = payload.discountAmount === undefined ? 0 : toFiniteNumber(payload.discountAmount);
  if (discountRaw === null || discountRaw < 0) {
    return { error: 'discountAmount must be a non-negative number' };
  }

  const shippingRaw = payload.shippingFee === undefined ? 0 : toFiniteNumber(payload.shippingFee);
  if (shippingRaw === null || shippingRaw < 0) {
    return { error: 'shippingFee must be a non-negative number' };
  }

  const discountAmount = round2(discountRaw);
  const shippingFee = round2(shippingRaw);

  const computed = calculateReceiptTotals(
    itemsCheck.items,
    discountAmount,
    shippingFee,
    vatMode
  );

  const tolerance = 0.05;

  if (payload.subtotal !== undefined) {
    const providedSubtotal = toFiniteNumber(payload.subtotal);
    if (
      providedSubtotal === null ||
      Math.abs(providedSubtotal - computed.subtotal) > tolerance
    ) {
      return {
        error: `Receipt subtotal mismatch: expected ${computed.subtotal}, received ${String(payload.subtotal)}`,
      };
    }
  }

  if (payload.vatAmount !== undefined) {
    const providedVat = toFiniteNumber(payload.vatAmount);
    if (
      providedVat === null ||
      Math.abs(providedVat - computed.vatAmount) > tolerance
    ) {
      return {
        error: `Receipt vatAmount mismatch: expected ${computed.vatAmount}, received ${String(payload.vatAmount)}`,
      };
    }
  }

  if (payload.grandTotal !== undefined) {
    const providedTotal = toFiniteNumber(payload.grandTotal);
    if (
      providedTotal === null ||
      Math.abs(providedTotal - computed.grandTotal) > tolerance
    ) {
      return {
        error: `Receipt grandTotal mismatch: expected ${computed.grandTotal}, received ${String(payload.grandTotal)}`,
      };
    }
  }

  const id =
    typeof payload.id === 'string' && payload.id.trim()
      ? payload.id.trim()
      : `rcp-${Date.now()}`;
  const receiptNo =
    typeof payload.receiptNo === 'string' && payload.receiptNo.trim()
      ? payload.receiptNo.trim()
      : generateReceiptNumber();
  const issuedAt =
    typeof payload.issuedAt === 'string' && payload.issuedAt.trim()
      ? payload.issuedAt.trim()
      : new Date().toISOString();
  const paperSizeId =
    typeof payload.paperSizeId === 'string' && payload.paperSizeId.trim()
      ? payload.paperSizeId.trim()
      : 'size-80mm';

  const receipt: ReceiptRecord = {
    id,
    receiptNo,
    issuedAt,
    templateType,
    paperSizeId,
    shop: validateAndNormalizeShop(payload.shop),
    customerName:
      typeof payload.customerName === 'string' ? payload.customerName.trim() : '',
    customerPhone:
      typeof payload.customerPhone === 'string' ? payload.customerPhone.trim() : '',
    customerAddress:
      typeof payload.customerAddress === 'string' ? payload.customerAddress.trim() : '',
    customerTaxId:
      typeof payload.customerTaxId === 'string' ? payload.customerTaxId.trim() : '',
    paymentMethod,
    items: itemsCheck.items,
    discountAmount,
    shippingFee,
    vatMode,
    ...(typeof payload.hidePricesOnSlip === 'boolean'
      ? { hidePricesOnSlip: payload.hidePricesOnSlip }
      : {}),
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
    subtotal: computed.subtotal,
    vatAmount: computed.vatAmount,
    grandTotal: computed.grandTotal,
  };

  return { receipt };
}

function receiptToSheetRow(receipt: ReceiptRecord): (string | number)[] {
  return [
    receipt.id,
    receipt.receiptNo,
    receipt.issuedAt,
    receipt.templateType,
    receipt.paperSizeId,
    receipt.customerName,
    receipt.customerPhone,
    receipt.customerAddress,
    receipt.customerTaxId,
    receipt.paymentMethod,
    receipt.discountAmount,
    receipt.shippingFee,
    receipt.vatMode,
    receipt.subtotal,
    receipt.vatAmount,
    receipt.grandTotal,
    receipt.items.length,
    JSON.stringify(receipt.items),
    JSON.stringify(receipt),
  ];
}

function sheetRowToReceipt(row: string[]): ReceiptRecord | null {
  const fullJson = row[18];
  if (fullJson) {
    try {
      const parsed = JSON.parse(fullJson) as unknown;
      const check = validateAndNormalizeReceipt(parsed);
      if (check.receipt) {
        return check.receipt;
      }
    } catch {
      // Fall through to column reconstruction
    }
  }

  const id = (row[0] || '').trim();
  const receiptNo = (row[1] || '').trim();
  if (!id || !receiptNo || id.toLowerCase() === 'id') {
    return null;
  }

  let items: ReceiptLineItem[] = [];
  if (row[17]) {
    try {
      const parsedItems = JSON.parse(row[17]) as unknown;
      const itemsCheck = validateAndNormalizeItems(parsedItems);
      if (itemsCheck.items) {
        items = itemsCheck.items;
      }
    } catch {
      items = [];
    }
  }

  if (items.length === 0) {
    return null;
  }

  const check = validateAndNormalizeReceipt({
    id,
    receiptNo,
    issuedAt: row[2] || new Date().toISOString(),
    templateType: row[3] || 'retail_standard',
    paperSizeId: row[4] || 'size-80mm',
    customerName: row[5] || '',
    customerPhone: row[6] || '',
    customerAddress: row[7] || '',
    customerTaxId: row[8] || '',
    paymentMethod: row[9] || 'cash',
    discountAmount: toFiniteNumber(row[10]) ?? 0,
    shippingFee: toFiniteNumber(row[11]) ?? 0,
    vatMode: row[12] || 'none',
    items,
  });

  return check.receipt || null;
}

export async function GET(request?: Request) {
  // Touch request.url so Next.js 16 (cacheComponents: true) evaluates runtime env config per request.
  void request?.url;

  const config = getSheetsDatabaseConfig();
  if (!config) {
    return NextResponse.json({
      receipts: [],
      note: 'Client-persisted history ready',
    });
  }

  try {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: RECEIPTS_DATA_RANGE,
    });

    const rows = (res.data.values || []) as string[][];
    const receipts = rows
      .map((row) => sheetRowToReceipt(row))
      .filter((receipt): receipt is ReceiptRecord => receipt !== null)
      .sort((a, b) => {
        const timeA = Date.parse(a.issuedAt) || 0;
        const timeB = Date.parse(b.issuedAt) || 0;
        return timeB - timeA;
      });

    return NextResponse.json({
      receipts,
      source: 'sheets',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read Receipts sheet';
    console.warn('Receipts sheet unavailable, returning empty client-ready history:', message);
    return NextResponse.json({
      receipts: [],
      note: 'Client-persisted history ready',
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

  const { receipt, error } = validateAndNormalizeReceipt(rawBody);
  if (error || !receipt) {
    return NextResponse.json(
      { success: false, error: error || 'Invalid receipt payload' },
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
        range: RECEIPTS_SHEET_RANGE,
        valueInputOption: 'RAW',
        requestBody: {
          values: [receiptToSheetRow(receipt)],
        },
      });
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets append failed';
      console.error('Could not log receipt to Google Sheets:', message);
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    persisted,
    receipt,
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
      { success: false, error: 'Receipt ID is required' },
      { status: 400 }
    );
  }

  let persisted: 'sheets' | 'local' = 'local';
  const config = getSheetsDatabaseConfig();
  if (config) {
    try {
      await deleteSheetRowById(config.sheetId, 'Receipts', id);
      persisted = 'sheets';
    } catch (sheetErr: unknown) {
      const message = sheetErr instanceof Error ? sheetErr.message : 'Google Sheets delete failed';
      console.error('Could not delete receipt from Google Sheets:', message);
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
