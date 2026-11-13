export type ShirtStyle = 'tshirt' | 'polo' | 'oxford' | 'hoodie';

export interface ShirtSize {
  id: string;
  label: string;
  chestInch: number;
  lengthInch: number;
  shoulderInch?: number;
  price: number;
  stock: number;
}

export interface Shirt {
  id: string;
  sku: string;
  name: string;
  brandOrCollection: string;
  category: string;
  style: ShirtStyle;
  color: string;
  accentColor: string;
  basePrice: number;
  fabricNote?: string;
  tagText?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  sizes: ShirtSize[];
  createdAt?: string;
}

export type ReceiptTemplateType =
  | 'thermal_pos'
  | 'retail_standard'
  | 'tax_invoice'
  | 'boutique_gift';

export interface ReceiptTemplateMeta {
  id: ReceiptTemplateType;
  label: string;
  thaiLabel: string;
  description: string;
  badge: string;
}

export interface ReceiptPaperSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number | null;
  marginMm: number;
  fontScale: number;
  orientation: 'portrait' | 'landscape';
  defaultTemplate?: ReceiptTemplateType;
  isPreset?: boolean;
}

export interface PrintLayoutCalibration {
  paperWidthMm: number;
  paperHeightMm: number | null;
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  offsetXMm: number;
  offsetYMm: number;
  contentWidthPct: number;
  contentHeightPct?: number;
  linkedPrinterId?: string;
}

export interface DetectedPrinterInfo {
  id: string;
  name: string;
  source: 'windows' | 'webusb' | 'webserial' | 'manual';
  status: string;
  driverOrVendor?: string;
  portOrId?: string;
  isDefault?: boolean;
  defaultPaperSizeId?: string;
}

export interface StickerConfig {
  brandHeader: string;
  showBrandHeader: boolean;
  modelName: string;
  colorName: string;
  sizeLabel: string;
  writeInLineStyle: 'solid' | 'dashed';
  showBarcode: boolean;
  barcodeDigits: string;
  barcodeCaption: string;
  borderRadiusMm: number;
  showCutBorder: boolean;
  /** Optional multiplier (%) on top of automatic sticker-size text scaling (default 100) */
  fontScalePct?: number;
  /** Text alignment across sticker fields: 'left' | 'center' | 'right' */
  textAlign?: 'left' | 'center' | 'right';
  /** Detail spacing mode: 'auto' shrinks padding/gaps when sticker <= 36x46mm */
  detailDensity?: 'auto' | 'compact' | 'normal';
}

export interface StickerSet {
  id: string;
  name: string;
  config: StickerConfig;
  paperSizeId: string;
  calibration: PrintLayoutCalibration;
  defaultCopies: number;
  updatedAt: string;
}

export interface ReceiptLineItem {
  lineId: string;
  shirtId: string;
  sku: string;
  shirtName: string;
  shirtColor: string;
  shirtStyle: ShirtStyle;
  sizeId: string;
  sizeLabel: string;
  sizeMeasureText: string;
  quantity: number;
  unitPrice: number;
}

export interface ShopProfile {
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  taxId: string;
  promptPayId?: string;
  footerNote: string;
}

export type VatMode = 'none' | 'excluded_7' | 'included_7';

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'cod';

export interface ReceiptTotals {
  subtotal: number;
  afterDiscount: number;
  vatAmount: number;
  grandTotal: number;
}

export interface ReceiptRecord {
  id: string;
  receiptNo: string;
  issuedAt: string;
  templateType: ReceiptTemplateType;
  paperSizeId: string;
  shop: ShopProfile;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxId: string;
  paymentMethod: PaymentMethod;
  items: ReceiptLineItem[];
  discountAmount: number;
  shippingFee: number;
  vatMode: VatMode;
  hidePricesOnSlip?: boolean;
  slipImageDataUrl?: string;
  slipFileName?: string;
  includeSlipOnPrint?: boolean;
  customShopTemplateDataUrl?: string;
  customShopTemplateName?: string;
  useCustomShopTemplate?: boolean;
  notes: string;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
}

export type ReceiptDraft = Omit<ReceiptRecord, 'id' | 'issuedAt'> & {
  id?: string;
  issuedAt?: string;
};

export interface PrintSet {
  id: string;
  name: string;
  templateType: ReceiptTemplateType;
  paperSizeId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxId: string;
  paymentMethod: PaymentMethod;
  items: ReceiptLineItem[];
  discountAmount: number;
  shippingFee: number;
  vatMode: VatMode;
  hidePricesOnSlip?: boolean;
  includeSlipOnPrint?: boolean;
  useCustomShopTemplate?: boolean;
  notes: string;
  defaultCopies: number;
  updatedAt: string;
}
