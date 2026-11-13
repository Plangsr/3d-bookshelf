'use client';

import React from 'react';
import { formatTHB } from '@/lib/storage';
import type {
  PaymentMethod,
  ReceiptDraft,
  ReceiptPaperSize,
  ReceiptTotals,
  ShirtStyle,
} from '@/types/shirt';

export interface ReceiptPreviewProps {
  draft: ReceiptDraft;
  paperSize: ReceiptPaperSize;
  totals: ReceiptTotals;
  zoom?: number;
  printableId?: string;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { th: string; en: string }> = {
  cash: { th: 'เงินสด', en: 'Cash' },
  transfer: { th: 'โอนเงิน / พร้อมเพย์', en: 'Bank Transfer / PromptPay' },
  card: { th: 'บัตรเครดิต / เดบิต', en: 'Credit / Debit Card' },
  cod: { th: 'เก็บเงินปลายทาง', en: 'Cash on Delivery' },
};

const STYLE_BADGE_LABELS: Record<ShirtStyle, string> = {
  tshirt: 'T-SHIRT',
  polo: 'POLO',
  oxford: 'OXFORD',
  hoodie: 'HOODIE',
};

function formatReceiptTimestamp(iso?: string): string {
  if (!iso) {
    return 'ฉบับร่าง (Draft)';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso || '-';
  }
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getEffectiveDimensions(paperSize: ReceiptPaperSize): {
  widthMm: number;
  heightMm: number | null;
} {
  const isLandscapeWithHeight =
    paperSize.orientation === 'landscape' &&
    paperSize.heightMm !== null &&
    paperSize.heightMm > 0;

  if (isLandscapeWithHeight && paperSize.heightMm !== null) {
    return {
      widthMm: paperSize.heightMm,
      heightMm: paperSize.widthMm,
    };
  }

  return {
    widthMm: paperSize.widthMm,
    heightMm: paperSize.heightMm,
  };
}

function computePreVatBase(draft: ReceiptDraft, totals: ReceiptTotals): number {
  if (draft.vatMode === 'included_7') {
    return Math.round((totals.afterDiscount - totals.vatAmount + Number.EPSILON) * 100) / 100;
  }
  return totals.afterDiscount;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  draft,
  paperSize,
  totals,
  zoom = 1,
  printableId,
}) => {
  const { widthMm, heightMm } = getEffectiveDimensions(paperSize);
  const isCompact = widthMm <= 70;
  const isMedium = widthMm > 70 && widthMm <= 125;
  const paymentMeta = PAYMENT_METHOD_LABELS[draft.paymentMethod] ?? PAYMENT_METHOD_LABELS.cash;
  const issueDateText = formatReceiptTimestamp(draft.issuedAt);
  const preVatBase = computePreVatBase(draft, totals);

  // Base font px scaled by paperSize.fontScale so all em-based typography scales cleanly
  const baseFontPx = (isCompact ? 10 : isMedium ? 11.2 : 12.2) * (paperSize.fontScale || 1);
  const template = draft.templateType || 'retail_standard';

  const paperStyle: React.CSSProperties = {
    width: `${widthMm}mm`,
    minHeight: heightMm ? `${heightMm}mm` : undefined,
    padding: `${paperSize.marginMm}mm`,
    fontSize: `${baseFontPx}px`,
    boxSizing: 'border-box',
    ...(zoom !== 1 ? { zoom } : {}),
  };

  return (
    <div
      id={printableId}
      style={paperStyle}
      className="bg-white text-[#171412] shadow-2xl border border-neutral-200 flex flex-col justify-between leading-snug break-words print:!w-full print:!min-h-0 print:!p-0 print:!shadow-none print:!border-0 print:![zoom:1]"
    >
      {/* ============================================================
          TEMPLATE 1: THERMAL POS SLIP
          ============================================================ */}
      {template === 'thermal_pos' && (
        <div className="flex flex-col flex-1 justify-between font-mono text-[0.92em]">
          <div>
            {/* Shop Header */}
            <div className="text-center pb-[0.65em] border-b border-dashed border-neutral-400">
              <div className="font-bold text-[1.22em] tracking-wider uppercase text-black">
                {draft.shop.shopName || 'ATELIER STUDIO'}
              </div>
              {draft.shop.tagline && (
                <div className="text-[0.76em] text-neutral-600 mt-[0.15em]">
                  {draft.shop.tagline}
                </div>
              )}
              {draft.shop.address && (
                <div className="text-[0.74em] text-neutral-700 mt-[0.3em] leading-tight">
                  {draft.shop.address}
                </div>
              )}
              <div className="text-[0.74em] text-neutral-700 mt-[0.2em]">
                {draft.shop.phone ? `Tel: ${draft.shop.phone}` : ''}
                {draft.shop.taxId ? ` | TAX: ${draft.shop.taxId}` : ''}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="py-[0.55em] border-b border-dashed border-neutral-400 text-[0.82em] space-y-[0.2em]">
              <div className="flex justify-between gap-2">
                <span className="text-neutral-600">RECEIPT NO:</span>
                <span className="font-bold">{draft.receiptNo}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-neutral-600">DATE:</span>
                <span>{issueDateText}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-neutral-600">PAY BY:</span>
                <span className="px-[0.45em] py-[0.1em] border border-neutral-800 rounded text-[0.86em] font-bold uppercase">
                  {paymentMeta.th}
                </span>
              </div>
              {draft.customerName && (
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-600">CUSTOMER:</span>
                  <span className="text-right font-semibold">{draft.customerName}</span>
                </div>
              )}
              {draft.customerPhone && (
                <div className="flex justify-between gap-2">
                  <span className="text-neutral-600">TEL:</span>
                  <span>{draft.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="py-[0.55em] border-b border-dashed border-neutral-400">
              <div className="flex justify-between text-[0.76em] font-bold text-neutral-600 pb-[0.35em] border-b border-neutral-300">
                <span>ITEM / SIZE</span>
                <span>AMOUNT</span>
              </div>

              {draft.items.length === 0 ? (
                <div className="py-[1.2em] text-center text-[0.82em] text-neutral-500">
                  -- ยังไม่มีรายการสินค้า --
                </div>
              ) : (
                <div className="divide-y divide-dotted divide-neutral-300">
                  {draft.items.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <div key={item.lineId} className="py-[0.45em]">
                        <div className="flex items-start justify-between gap-1 font-semibold text-black">
                          <span>
                            {item.sku ? `[${item.sku}] ` : ''}
                            {item.shirtName}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-1 text-[0.82em] text-neutral-700 mt-[0.15em]">
                          <span>
                            Size <strong className="text-black">{item.sizeLabel}</strong>
                            {item.sizeMeasureText && !isCompact ? ` (${item.sizeMeasureText})` : ''}
                            {` • ${item.quantity} x ${formatTHB(item.unitPrice)}`}
                          </span>
                          <span className="font-bold text-black shrink-0">
                            {formatTHB(lineTotal)}
                          </span>
                        </div>
                        {item.sizeMeasureText && isCompact && (
                          <div className="text-[0.74em] text-neutral-500">
                            {item.sizeMeasureText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="py-[0.6em] border-b border-dashed border-neutral-400 space-y-[0.22em] text-[0.86em]">
              <div className="flex justify-between">
                <span>รวมค่าสินค้า (Subtotal)</span>
                <span>{formatTHB(totals.subtotal)}</span>
              </div>
              {draft.discountAmount > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>ส่วนลด (Discount)</span>
                  <span>-{formatTHB(draft.discountAmount)}</span>
                </div>
              )}
              {draft.shippingFee > 0 && (
                <div className="flex justify-between">
                  <span>ค่าจัดส่ง (Shipping)</span>
                  <span>{formatTHB(draft.shippingFee)}</span>
                </div>
              )}
              {draft.vatMode !== 'none' && (
                <div className="flex justify-between text-neutral-700">
                  <span>
                    {draft.vatMode === 'included_7' ? 'VAT 7% (Included)' : 'VAT 7% (Excluded)'}
                  </span>
                  <span>{formatTHB(totals.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-[0.35em] mt-[0.25em] border-t border-neutral-800 text-[1.18em] font-bold text-black">
                <span>TOTAL</span>
                <span>{formatTHB(totals.grandTotal)}</span>
              </div>
            </div>

            {/* PromptPay & Notes */}
            {(draft.shop.promptPayId || draft.notes) && (
              <div className="py-[0.55em] border-b border-dashed border-neutral-400 text-center space-y-[0.3em]">
                {draft.shop.promptPayId && (
                  <div className="px-[0.5em] py-[0.35em] border border-neutral-800 rounded bg-neutral-50">
                    <div className="text-[0.74em] uppercase font-bold tracking-wider">
                      PromptPay / พร้อมเพย์
                    </div>
                    <div className="text-[0.95em] font-bold tracking-widest mt-[0.1em]">
                      {draft.shop.promptPayId}
                    </div>
                  </div>
                )}
                {draft.notes && (
                  <div className="text-[0.78em] text-neutral-700 text-left">
                    Note: {draft.notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thank-You Footer */}
          <div className="pt-[0.65em] text-center space-y-[0.35em]">
            {draft.shop.footerNote && (
              <div className="text-[0.76em] text-neutral-700 leading-snug">
                {draft.shop.footerNote}
              </div>
            )}
            <div className="text-[0.72em] font-bold tracking-[0.22em] text-neutral-500">
              *** THANK YOU ***
            </div>
            <div className="flex justify-center gap-[1.5px] h-[1.1em] opacity-70 pt-[0.15em]">
              {[2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2].map((w, idx) => (
                <span
                  key={idx}
                  className="bg-black inline-block h-full"
                  style={{ width: `${w}px`, marginRight: idx % 2 === 0 ? '1px' : '2px' }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TEMPLATE 2: RETAIL STANDARD (BOUTIQUE RECEIPT)
          ============================================================ */}
      {template === 'retail_standard' && (
        <div className="flex flex-col flex-1 justify-between font-sans">
          <div>
            {/* Boutique Header */}
            <div className="border-b-2 border-[#1f1914] pb-[0.8em] flex flex-wrap justify-between items-start gap-[0.6em]">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[1.45em] tracking-[0.1em] uppercase text-[#1a1410] font-[family-name:var(--font-cinzel)]">
                  {draft.shop.shopName || 'ATELIER BANGKOK STUDIO'}
                </div>
                {draft.shop.tagline && (
                  <div className="text-[0.82em] italic text-[#6d5a47] mt-[0.1em]">
                    {draft.shop.tagline}
                  </div>
                )}
                <div className="text-[0.78em] text-neutral-600 mt-[0.35em] leading-snug">
                  {draft.shop.address}
                  {draft.shop.phone ? ` • โทร ${draft.shop.phone}` : ''}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-[0.75em] py-[0.25em] bg-[#1f1914] text-[#f5efe6] text-[0.78em] font-bold tracking-widest uppercase rounded">
                  ใบเสร็จรับเงิน / RECEIPT
                </div>
                <div className="text-[0.82em] font-mono font-bold mt-[0.35em]">
                  No. {draft.receiptNo}
                </div>
                <div className="text-[0.75em] text-neutral-600">{issueDateText}</div>
              </div>
            </div>

            {/* Customer & Payment Block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[0.7em] py-[0.7em] border-b border-neutral-300 text-[0.82em]">
              <div className="p-[0.55em] rounded bg-[#faf8f5] border border-neutral-200">
                <div className="text-[0.82em] font-bold uppercase tracking-wider text-[#6e5a47] mb-[0.2em]">
                  ข้อมูลลูกค้า (Customer)
                </div>
                <div className="font-semibold text-black">
                  {draft.customerName || 'ลูกค้าหน้าร้าน (Walk-in Client)'}
                </div>
                {draft.customerPhone && (
                  <div className="text-neutral-700">โทร: {draft.customerPhone}</div>
                )}
                {draft.customerAddress && (
                  <div className="text-neutral-600 text-[0.9em] mt-[0.1em]">
                    {draft.customerAddress}
                  </div>
                )}
              </div>

              <div className="p-[0.55em] rounded bg-[#faf8f5] border border-neutral-200 flex flex-col justify-between">
                <div>
                  <div className="text-[0.82em] font-bold uppercase tracking-wider text-[#6e5a47] mb-[0.2em]">
                    การชำระเงิน (Payment)
                  </div>
                  <div className="font-semibold text-black">
                    {paymentMeta.th} ({paymentMeta.en})
                  </div>
                </div>
                {draft.shop.promptPayId && (
                  <div className="text-[0.85em] text-neutral-700 mt-[0.25em] font-mono">
                    PromptPay: {draft.shop.promptPayId}
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="mt-[0.75em]">
              <table className="w-full border-collapse text-[0.82em]">
                <thead>
                  <tr className="bg-[#f3eee7] border-y border-[#3a2f26] text-left text-[0.86em] uppercase tracking-wider text-[#2e241b]">
                    <th className="py-[0.45em] px-[0.4em] w-[1.8em]">#</th>
                    <th className="py-[0.45em] px-[0.4em]">รายการเสื้อ / SKU</th>
                    <th className="py-[0.45em] px-[0.4em]">ไซส์ &amp; สัดส่วน</th>
                    <th className="py-[0.45em] px-[0.4em] text-center">จำนวน</th>
                    {!isCompact && (
                      <th className="py-[0.45em] px-[0.4em] text-right">ราคา/หน่วย</th>
                    )}
                    <th className="py-[0.45em] px-[0.4em] text-right">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {draft.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isCompact ? 5 : 6}
                        className="py-[1.5em] text-center text-neutral-400"
                      >
                        ยังไม่มีรายการสินค้าในใบเสร็จ
                      </td>
                    </tr>
                  ) : (
                    draft.items.map((item, idx) => (
                      <tr key={item.lineId} className="align-top">
                        <td className="py-[0.5em] px-[0.4em] font-mono text-neutral-500">
                          {idx + 1}
                        </td>
                        <td className="py-[0.5em] px-[0.4em]">
                          <div className="font-semibold text-black flex items-center gap-[0.35em]">
                            <span
                              className="inline-block w-[0.65em] h-[0.65em] rounded-full border border-neutral-300 shrink-0"
                              style={{ backgroundColor: item.shirtColor }}
                            />
                            <span>{item.shirtName}</span>
                          </div>
                          <div className="text-[0.84em] font-mono text-neutral-500">
                            {item.sku} • {STYLE_BADGE_LABELS[item.shirtStyle] || item.shirtStyle}
                          </div>
                        </td>
                        <td className="py-[0.5em] px-[0.4em]">
                          <span className="inline-block px-[0.4em] py-[0.05em] rounded bg-neutral-100 border border-neutral-300 font-mono font-bold text-black">
                            {item.sizeLabel}
                          </span>
                          {item.sizeMeasureText && (
                            <div className="text-[0.82em] text-neutral-600 mt-[0.15em]">
                              {item.sizeMeasureText}
                            </div>
                          )}
                        </td>
                        <td className="py-[0.5em] px-[0.4em] text-center font-mono font-semibold">
                          {item.quantity}
                        </td>
                        {!isCompact && (
                          <td className="py-[0.5em] px-[0.4em] text-right font-mono">
                            {formatTHB(item.unitPrice)}
                          </td>
                        )}
                        <td className="py-[0.5em] px-[0.4em] text-right font-mono font-bold text-black">
                          {formatTHB(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="mt-[0.8em] pt-[0.6em] border-t border-neutral-300 flex flex-col sm:flex-row justify-between gap-[0.8em]">
              <div className="flex-1 text-[0.78em] text-neutral-600">
                {draft.notes && (
                  <div className="p-[0.5em] rounded bg-neutral-50 border border-neutral-200">
                    <span className="font-bold text-neutral-800">หมายเหตุ: </span>
                    {draft.notes}
                  </div>
                )}
              </div>

              <div className="w-full sm:w-[48%] space-y-[0.25em] text-[0.85em]">
                <div className="flex justify-between">
                  <span className="text-neutral-600">รวมเป็นเงิน (Subtotal)</span>
                  <span className="font-mono">{formatTHB(totals.subtotal)}</span>
                </div>
                {draft.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>ส่วนลด (Discount)</span>
                    <span className="font-mono">-{formatTHB(draft.discountAmount)}</span>
                  </div>
                )}
                {draft.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">ค่าจัดส่ง (Shipping)</span>
                    <span className="font-mono">{formatTHB(draft.shippingFee)}</span>
                  </div>
                )}
                {draft.vatMode !== 'none' && (
                  <div className="flex justify-between text-neutral-600">
                    <span>
                      ภาษีมูลค่าเพิ่ม 7% ({draft.vatMode === 'included_7' ? 'รวมในราคา' : 'แยกนอก'})
                    </span>
                    <span className="font-mono">{formatTHB(totals.vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-[0.4em] mt-[0.3em] border-t-2 border-[#1f1914] text-[1.15em] font-bold text-black">
                  <span>ยอดสุทธิ (Grand Total)</span>
                  <span className="font-mono">{formatTHB(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Signatures & Footer */}
          <div className="pt-[1.2em] mt-[1em] border-t border-neutral-200">
            <div className="grid grid-cols-2 gap-[1.5em] text-center text-[0.76em] text-neutral-700 mb-[0.8em]">
              <div>
                <div className="border-b border-neutral-400 h-[2em] mb-[0.25em]" />
                <div>ผู้รับเงิน / Cashier</div>
              </div>
              <div>
                <div className="border-b border-neutral-400 h-[2em] mb-[0.25em]" />
                <div>ผู้รับสินค้า / Customer</div>
              </div>
            </div>
            {draft.shop.footerNote && (
              <div className="text-center text-[0.74em] text-neutral-500">
                {draft.shop.footerNote}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TEMPLATE 3: FORMAL THAI TAX INVOICE (ใบกำกับภาษี / ใบเสร็จรับเงิน)
          ============================================================ */}
      {template === 'tax_invoice' && (
        <div className="flex flex-col flex-1 justify-between font-sans text-[0.94em]">
          <div>
            {/* Top Formal Banner */}
            <div className="flex justify-between items-start gap-[0.6em] pb-[0.65em] border-b-2 border-black">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[1.28em] text-black uppercase tracking-wide">
                  {draft.shop.shopName || 'ATELIER BANGKOK STUDIO'}
                </div>
                <div className="text-[0.78em] text-neutral-800 mt-[0.2em]">
                  {draft.shop.address}
                </div>
                <div className="text-[0.78em] text-neutral-800 mt-[0.15em]">
                  โทร: {draft.shop.phone || '-'}
                </div>
                <div className="text-[0.82em] font-bold text-black mt-[0.2em]">
                  เลขประจำตัวผู้เสียภาษี (ผู้ขาย):{' '}
                  <span className="font-mono">{draft.shop.taxId || '-'}</span> (สำนักงานใหญ่)
                </div>
              </div>

              <div className="text-right shrink-0 border-2 border-black px-[0.75em] py-[0.45em] rounded-sm">
                <div className="text-[0.72em] font-bold tracking-widest uppercase border-b border-black pb-[0.15em] mb-[0.2em]">
                  ต้นฉบับ / ORIGINAL
                </div>
                <div className="font-bold text-[1.05em] text-black">
                  ใบกำกับภาษี / ใบเสร็จรับเงิน
                </div>
                <div className="text-[0.76em] font-semibold tracking-wider text-neutral-700">
                  TAX INVOICE / RECEIPT
                </div>
              </div>
            </div>

            {/* Customer & Document Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-[0.5em] mt-[0.65em] border border-black text-[0.8em]">
              <div className="sm:col-span-7 p-[0.55em] sm:border-r border-black space-y-[0.18em]">
                <div>
                  <span className="font-bold">ชื่อผู้ซื้อ / บริษัท: </span>
                  <span>{draft.customerName || 'ลูกค้าทั่วไป / เงินสด'}</span>
                </div>
                <div>
                  <span className="font-bold">เลขประจำตัวผู้เสียภาษี (ผู้ซื้อ): </span>
                  <span className="font-mono font-bold">
                    {draft.customerTaxId || 'ไม่ระบุ (บุคคลธรรมดา)'}
                  </span>
                </div>
                <div>
                  <span className="font-bold">ที่อยู่: </span>
                  <span>{draft.customerAddress || '-'}</span>
                </div>
                <div>
                  <span className="font-bold">โทรศัพท์: </span>
                  <span>{draft.customerPhone || '-'}</span>
                </div>
              </div>

              <div className="sm:col-span-5 p-[0.55em] space-y-[0.22em] bg-neutral-50">
                <div className="flex justify-between gap-2">
                  <span className="font-bold">เลขที่เอกสาร:</span>
                  <span className="font-mono font-bold">{draft.receiptNo}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold">วันที่ออกเอกสาร:</span>
                  <span>{issueDateText}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold">การชำระเงิน:</span>
                  <span>{paymentMeta.th}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold">ประเภท VAT:</span>
                  <span>
                    {draft.vatMode === 'excluded_7'
                      ? 'แยกนอก 7%'
                      : draft.vatMode === 'included_7'
                      ? 'รวมใน 7%'
                      : 'ไม่มี VAT'}
                  </span>
                </div>
              </div>
            </div>

            {/* Formal Tax Table */}
            <div className="mt-[0.65em]">
              <table className="w-full border border-black border-collapse text-[0.8em]">
                <thead>
                  <tr className="bg-neutral-100 border-b border-black text-black">
                    <th className="border-r border-black py-[0.4em] px-[0.35em] text-center w-[2.2em]">
                      ลำดับ
                    </th>
                    <th className="border-r border-black py-[0.4em] px-[0.45em] text-left">
                      รายการสินค้า (Description) &amp; SKU
                    </th>
                    <th className="border-r border-black py-[0.4em] px-[0.35em] text-center">
                      ไซส์
                    </th>
                    <th className="border-r border-black py-[0.4em] px-[0.35em] text-center">
                      จำนวน
                    </th>
                    <th className="border-r border-black py-[0.4em] px-[0.4em] text-right">
                      ราคา/หน่วย
                    </th>
                    <th className="py-[0.4em] px-[0.45em] text-right">จำนวนเงิน (THB)</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-[1.6em] text-center text-neutral-400">
                        ไม่มีรายการสินค้า
                      </td>
                    </tr>
                  ) : (
                    draft.items.map((item, idx) => (
                      <tr key={item.lineId} className="border-b border-neutral-300 align-top">
                        <td className="border-r border-black py-[0.4em] px-[0.35em] text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="border-r border-black py-[0.4em] px-[0.45em]">
                          <div className="font-semibold text-black">{item.shirtName}</div>
                          <div className="text-[0.85em] font-mono text-neutral-600">
                            SKU: {item.sku}
                            {item.sizeMeasureText ? ` • ${item.sizeMeasureText}` : ''}
                          </div>
                        </td>
                        <td className="border-r border-black py-[0.4em] px-[0.35em] text-center font-mono font-bold">
                          {item.sizeLabel}
                        </td>
                        <td className="border-r border-black py-[0.4em] px-[0.35em] text-center font-mono">
                          {item.quantity}
                        </td>
                        <td className="border-r border-black py-[0.4em] px-[0.4em] text-right font-mono">
                          {formatTHB(item.unitPrice)}
                        </td>
                        <td className="py-[0.4em] px-[0.45em] text-right font-mono font-semibold">
                          {formatTHB(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Formal Tax Totals Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 border-x border-b border-black text-[0.82em]">
              <div className="sm:col-span-6 p-[0.55em] sm:border-r border-black flex flex-col justify-between">
                <div>
                  <div className="font-bold text-neutral-800">หมายเหตุ / Notes:</div>
                  <div className="text-neutral-700 mt-[0.15em]">
                    {draft.notes || 'สินค้าทุกชิ้นผ่านการตรวจวัดขนาดและคุณภาพมาตรฐาน'}
                  </div>
                </div>
                {draft.shop.promptPayId && (
                  <div className="text-[0.85em] font-mono text-neutral-700 mt-[0.4em]">
                    ชำระโอน / PromptPay: {draft.shop.promptPayId}
                  </div>
                )}
              </div>

              <div className="sm:col-span-6 divide-y divide-neutral-300">
                <div className="flex justify-between px-[0.6em] py-[0.3em]">
                  <span>รวมมูลค่าสินค้า (Subtotal)</span>
                  <span className="font-mono">{formatTHB(totals.subtotal)}</span>
                </div>
                {draft.discountAmount > 0 && (
                  <div className="flex justify-between px-[0.6em] py-[0.3em] text-rose-700">
                    <span>หัก ส่วนลด (Discount)</span>
                    <span className="font-mono">-{formatTHB(draft.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-[0.6em] py-[0.3em]">
                  <span>มูลค่าสินค้าก่อนภาษี (Pre-VAT)</span>
                  <span className="font-mono">{formatTHB(preVatBase)}</span>
                </div>
                <div className="flex justify-between px-[0.6em] py-[0.3em]">
                  <span>ภาษีมูลค่าเพิ่ม 7% (VAT 7%)</span>
                  <span className="font-mono">{formatTHB(totals.vatAmount)}</span>
                </div>
                {draft.shippingFee > 0 && (
                  <div className="flex justify-between px-[0.6em] py-[0.3em]">
                    <span>ค่าจัดส่ง (Shipping)</span>
                    <span className="font-mono">{formatTHB(draft.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between px-[0.6em] py-[0.45em] bg-neutral-100 font-bold text-[1.08em] text-black">
                  <span>จำนวนเงินรวมทั้งสิ้น (Grand Total)</span>
                  <span className="font-mono">{formatTHB(totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Formal Signatures */}
          <div className="pt-[1em] mt-[0.8em]">
            <div className="grid grid-cols-2 gap-[1.2em] border border-black p-[0.6em] text-[0.76em] text-center">
              <div>
                <div className="font-bold mb-[1.8em]">ในนาม {draft.shop.shopName}</div>
                <div className="border-t border-dotted border-black pt-[0.25em]">
                  ผู้มีอำนาจลงนาม / ผู้รับเงิน • วันที่ ____/____/____
                </div>
              </div>
              <div>
                <div className="font-bold mb-[1.8em]">ผู้รับสินค้า / Received By</div>
                <div className="border-t border-dotted border-black pt-[0.25em]">
                  ลงชื่อผู้รับสินค้า • วันที่ ____/____/____
                </div>
              </div>
            </div>
            {draft.shop.footerNote && (
              <div className="text-center text-[0.72em] text-neutral-600 mt-[0.4em]">
                {draft.shop.footerNote}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TEMPLATE 4: BOUTIQUE GIFT & GARMENT CARE SLIP
          ============================================================ */}
      {template === 'boutique_gift' && (
        <div className="flex flex-col flex-1 justify-between border border-[#c8b8a4] p-[0.9em] font-serif">
          <div>
            {/* Editorial Gift Header */}
            <div className="text-center border-b border-[#d9cbb8] pb-[0.75em]">
              <div className="text-[0.72em] font-sans uppercase tracking-[0.28em] text-[#8a7052]">
                Atelier Garment Edition
              </div>
              <div className="text-[1.4em] font-bold tracking-[0.14em] uppercase text-[#1f1812] mt-[0.1em] font-[family-name:var(--font-cinzel)]">
                {draft.shop.shopName || 'ATELIER BANGKOK STUDIO'}
              </div>
              <div className="text-[0.78em] font-sans text-[#6f5d4b] mt-[0.2em]">
                ใบส่งมอบเสื้อผ้า &amp; การ์ดดูแลเนื้อผ้า • Order #{draft.receiptNo}
              </div>
            </div>

            {/* Recipient Block */}
            <div className="my-[0.75em] p-[0.65em] bg-[#faf7f2] border border-[#e6dccf] font-sans text-[0.82em]">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[#7c664e] uppercase tracking-wider text-[0.85em] font-bold">
                  สำหรับคุณ (Recipient)
                </span>
                <span className="text-[0.85em] text-neutral-500">{issueDateText}</span>
              </div>
              <div className="font-bold text-[1.08em] text-[#1c1612] mt-[0.15em]">
                {draft.customerName || 'แขกคนสำคัญ (Valued Guest)'}
              </div>
              {(draft.customerPhone || draft.customerAddress) && (
                <div className="text-neutral-600 mt-[0.15em]">
                  {draft.customerPhone ? `โทร ${draft.customerPhone}` : ''}
                  {draft.customerPhone && draft.customerAddress ? ' • ' : ''}
                  {draft.customerAddress}
                </div>
              )}
            </div>

            {/* Garment Cards */}
            <div className="space-y-[0.55em] font-sans">
              <div className="text-[0.76em] font-bold uppercase tracking-widest text-[#7c664e]">
                รายการเสื้อในชุดของขวัญ ({draft.items.length} รายการ)
              </div>

              {draft.items.length === 0 ? (
                <div className="py-[1.2em] text-center text-[0.84em] text-neutral-400 border border-dashed border-[#d9cbb8]">
                  ยังไม่มีรายการเสื้อในใบส่งมอบ
                </div>
              ) : (
                draft.items.map((item) => (
                  <div
                    key={item.lineId}
                    className="p-[0.6em] border border-[#dfd3c3] bg-white flex items-start justify-between gap-[0.5em]"
                  >
                    <div className="flex items-start gap-[0.55em] min-w-0">
                      <span
                        className="w-[1.25em] h-[1.25em] rounded-full border border-neutral-300 shrink-0 mt-[0.15em] shadow-inner"
                        style={{ backgroundColor: item.shirtColor }}
                        title={item.shirtColor}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-[0.35em]">
                          <span className="font-bold text-[0.94em] text-[#1c1612]">
                            {item.shirtName}
                          </span>
                          <span className="px-[0.4em] py-[0.05em] text-[0.72em] font-mono uppercase bg-[#f3ece2] text-[#6d573e] border border-[#dfcfba] rounded">
                            {STYLE_BADGE_LABELS[item.shirtStyle] || item.shirtStyle}
                          </span>
                        </div>
                        <div className="text-[0.82em] text-[#4c4035] mt-[0.15em]">
                          ไซส์ <strong className="font-mono text-black">{item.sizeLabel}</strong>
                          {item.sizeMeasureText ? ` • ${item.sizeMeasureText}` : ''}
                        </div>
                        <div className="text-[0.75em] font-mono text-neutral-500 mt-[0.08em]">
                          SKU: {item.sku} • จำนวน {item.quantity} ตัว
                        </div>
                      </div>
                    </div>

                    {!draft.hidePricesOnSlip && (
                      <div className="text-right font-mono text-[0.86em] font-bold text-[#1c1612] shrink-0">
                        {formatTHB(item.quantity * item.unitPrice)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Price Summary or Gift Hidden Notice */}
            {draft.hidePricesOnSlip ? (
              <div className="mt-[0.75em] py-[0.45em] px-[0.7em] bg-[#f7f2ea] border border-[#e3d7c6] text-center font-sans text-[0.78em] tracking-wider uppercase text-[#755e44]">
                GIFT EDITION • ไม่แสดงราคาสินค้าบนใบส่งมอบ
              </div>
            ) : (
              <div className="mt-[0.75em] pt-[0.55em] border-t border-[#d9cbb8] font-sans text-[0.84em] space-y-[0.2em]">
                {draft.discountAmount > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>ส่วนลด</span>
                    <span className="font-mono">-{formatTHB(draft.discountAmount)}</span>
                  </div>
                )}
                {draft.shippingFee > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>ค่าจัดส่ง</span>
                    <span className="font-mono">{formatTHB(draft.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[1.08em] text-[#1c1612]">
                  <span>มูลค่ารวมสุทธิ</span>
                  <span className="font-mono">{formatTHB(totals.grandTotal)}</span>
                </div>
              </div>
            )}

            {/* Personal Note & Care Instructions */}
            {draft.notes && (
              <div className="mt-[0.75em] p-[0.6em] border-l-2 border-[#b4966c] bg-[#fcfaf7] font-sans text-[0.82em] text-[#3a3027]">
                <span className="font-bold">ข้อความพิเศษ: </span>
                {draft.notes}
              </div>
            )}
          </div>

          <div className="mt-[0.9em] pt-[0.65em] border-t border-[#d9cbb8] font-sans">
            <div className="text-[0.76em] text-[#5e4f40] bg-[#faf7f2] p-[0.55em] border border-[#ebe2d5] leading-relaxed">
              <strong className="text-[#2f251b]">คำแนะนำการถนอมผ้า (Garment Care):</strong>{' '}
              ควรซักด้วยน้ำเย็นหรือโหมดถนอมผ้า กลับด้านเสื้อก่อนตากในที่ร่ม หลีกเลี่ยงการฟอกขาว
              และรีดด้วยไฟอ่อนเพื่อคงทรงผ้าให้สวยยาวนาน
            </div>
            {draft.shop.footerNote && (
              <div className="text-center text-[0.74em] text-[#7b6957] mt-[0.45em]">
                {draft.shop.footerNote}
              </div>
            )}
          </div>
        </div>
      )}

      {draft.slipImageDataUrl && draft.includeSlipOnPrint !== false && (
        <div className="mt-[0.8em] pt-[0.6em] border-t border-dashed border-neutral-300 text-center">
          <div className="text-[0.72em] font-semibold text-neutral-600 mb-[0.35em]">
            หลักฐานการโอนเงิน / Payment Slip
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.slipImageDataUrl}
            alt={draft.slipFileName || 'Payment Slip'}
            className="mx-auto max-h-[42mm] max-w-full object-contain border border-neutral-200 rounded"
          />
        </div>
      )}
    </div>
  );
};
