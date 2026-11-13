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
  notes: string;
  defaultCopies: number;
  updatedAt: string;
}
