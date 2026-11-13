import {
  DEFAULT_SHOP_PROFILE,
  INITIAL_PAPER_SIZES,
  INITIAL_SHIRTS,
} from '@/data/shirts';
import type {
  PrintSet,
  ReceiptLineItem,
  ReceiptPaperSize,
  ReceiptRecord,
  ReceiptTotals,
  Shirt,
  ShopProfile,
  VatMode,
} from '@/types/shirt';

const STORAGE_KEYS = {
  shirts: 'atelier_shirts_v1',
  paperSizes: 'atelier_paper_sizes_v1',
  shopProfile: 'atelier_shop_profile_v1',
  receiptHistory: 'atelier_receipt_history_v1',
  printSets: 'atelier_print_sets_v1',
  receiptDraft: 'atelier_receipt_draft_v1',
} as const;

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStorageJson(key: string): unknown | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeStorageJson(key: string, value: unknown): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-browsing write failures
  }
}

function cloneShirts(shirts: Shirt[]): Shirt[] {
  return shirts.map((shirt) => ({
    ...shirt,
    sizes: Array.isArray(shirt.sizes) ? shirt.sizes.map((size) => ({ ...size })) : [],
  }));
}

function clonePaperSizes(sizes: ReceiptPaperSize[]): ReceiptPaperSize[] {
  return sizes.map((size) => ({ ...size }));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function loadShirts(): Shirt[] {
  const parsed = readStorageJson(STORAGE_KEYS.shirts);
  if (!Array.isArray(parsed)) {
    return cloneShirts(INITIAL_SHIRTS);
  }
  const validShirts = parsed.filter(
    (item): item is Shirt =>
      isPlainObject(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string'
  );
  return cloneShirts(validShirts);
}

export function saveShirts(shirts: Shirt[]): void {
  writeStorageJson(STORAGE_KEYS.shirts, shirts);
}

export function loadPaperSizes(): ReceiptPaperSize[] {
  const parsed = readStorageJson(STORAGE_KEYS.paperSizes);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return clonePaperSizes(INITIAL_PAPER_SIZES);
  }
  const validSizes = parsed.filter(
    (item): item is ReceiptPaperSize =>
      isPlainObject(item) &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.widthMm === 'number'
  );
  if (validSizes.length === 0) {
    return clonePaperSizes(INITIAL_PAPER_SIZES);
  }
  return clonePaperSizes(validSizes);
}

export function savePaperSizes(sizes: ReceiptPaperSize[]): void {
  writeStorageJson(STORAGE_KEYS.paperSizes, sizes);
}

export function loadShopProfile(): ShopProfile {
  const parsed = readStorageJson(STORAGE_KEYS.shopProfile);
  if (!isPlainObject(parsed)) {
    return { ...DEFAULT_SHOP_PROFILE };
  }
  return {
    ...DEFAULT_SHOP_PROFILE,
    ...(parsed as Partial<ShopProfile>),
  };
}

export function saveShopProfile(shop: ShopProfile): void {
  writeStorageJson(STORAGE_KEYS.shopProfile, shop);
}

export function loadReceiptHistory(): ReceiptRecord[] {
  const parsed = readStorageJson(STORAGE_KEYS.receiptHistory);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(
    (item): item is ReceiptRecord =>
      isPlainObject(item) &&
      typeof item.id === 'string' &&
      typeof item.receiptNo === 'string' &&
      Array.isArray(item.items)
  );
}

export function saveReceiptHistory(records: ReceiptRecord[]): void {
  writeStorageJson(STORAGE_KEYS.receiptHistory, records);
}

export function loadReceiptDraft(): Partial<ReceiptRecord> | null {
  const parsed = readStorageJson(STORAGE_KEYS.receiptDraft);
  if (!isPlainObject(parsed)) {
    return null;
  }
  return parsed as Partial<ReceiptRecord>;
}

export function saveReceiptDraft(draft: Partial<ReceiptRecord>): void {
  writeStorageJson(STORAGE_KEYS.receiptDraft, draft);
}

export function loadPrintSets(): PrintSet[] {
  const parsed = readStorageJson(STORAGE_KEYS.printSets);
  if (Array.isArray(parsed)) {
    return parsed as PrintSet[];
  }
  return [];
}

export function savePrintSets(sets: PrintSet[]): void {
  writeStorageJson(STORAGE_KEYS.printSets, sets);
}

/**
 * Computes receipt monetary totals with Thai VAT 7% support.
 * VAT applies to merchandise total after discount (`afterDiscount`);
 * `shippingFee` is added cleanly on top without distorting garment VAT.
 */
export function calculateReceiptTotals(
  items: ReceiptLineItem[],
  discountAmount: number,
  shippingFee: number,
  vatMode: VatMode
): ReceiptTotals {
  const rawSubtotal = (items ?? []).reduce((sum, item) => {
    const unitPrice = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0;
    const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    return sum + unitPrice * quantity;
  }, 0);

  const subtotal = round2(rawSubtotal);
  const safeDiscount = Number.isFinite(discountAmount)
    ? Math.min(subtotal, Math.max(0, discountAmount))
    : 0;
  const afterDiscount = round2(Math.max(0, subtotal - safeDiscount));
  const safeShipping = Number.isFinite(shippingFee) ? Math.max(0, shippingFee) : 0;

  let vatAmount = 0;
  let grandTotal = round2(afterDiscount + safeShipping);

  if (vatMode === 'excluded_7') {
    vatAmount = round2(afterDiscount * 0.07);
    grandTotal = round2(afterDiscount + vatAmount + safeShipping);
  } else if (vatMode === 'included_7') {
    vatAmount = round2((afterDiscount * 7) / 107);
    grandTotal = round2(afterDiscount + safeShipping);
  }

  return {
    subtotal,
    afterDiscount,
    vatAmount,
    grandTotal,
  };
}

export function formatTHB(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function generateReceiptNumber(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `RCP-${yyyy}${mm}${dd}-${suffix}`;
}
