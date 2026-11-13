import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

type ScanMode = 'ocr' | 'categorize';
type ShirtStyle = 'tshirt' | 'polo' | 'oxford' | 'hoodie';

interface ScanRequestBody {
  imageBase64?: string;
  image?: string;
  mimeType?: string;
  mode?: string;
}

interface ExtractedSizeRow {
  label: string;
  chestInch?: number;
  lengthInch?: number;
  shoulderInch?: number;
  price?: number;
}

interface OcrExtractedData {
  documentType: 'hangtag' | 'care_label' | 'size_table' | 'receipt' | 'other';
  text: string;
  name?: string;
  sku?: string;
  price?: number;
  fabricNote?: string;
  sizes?: ExtractedSizeRow[];
}

interface CategorizeResult {
  name: string;
  sku: string;
  category: string;
  style: ShirtStyle;
  recommendedColor: string;
  accentColor: string;
  fabricNote: string;
  estimatedPrice: number;
  summary: string;
}

const VALID_STYLES: ReadonlySet<ShirtStyle> = new Set(['tshirt', 'polo', 'oxford', 'hoodie']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function parseImagePayload(rawInput: string, fallbackMimeType: string): { base64: string; mimeType: string } {
  const trimmed = rawInput.trim();
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || fallbackMimeType,
      base64: dataUrlMatch[2].trim(),
    };
  }
  return {
    mimeType: fallbackMimeType,
    base64: trimmed,
  };
}

function extractJsonObject<T>(rawText: string): T | null {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeStyle(rawStyle: unknown): ShirtStyle {
  if (typeof rawStyle === 'string') {
    const normalized = rawStyle.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized === 'tshirt' || normalized === 'tee' || normalized === 'crewneck') return 'tshirt';
    if (normalized === 'polo' || normalized === 'poloshirt') return 'polo';
    if (normalized === 'oxford' || normalized === 'shirt' || normalized === 'buttondown' || normalized === 'dressshirt') {
      return 'oxford';
    }
    if (normalized === 'hoodie' || normalized === 'sweatshirt' || normalized === 'pullover') return 'hoodie';
    if (VALID_STYLES.has(rawStyle as ShirtStyle)) {
      return rawStyle as ShirtStyle;
    }
  }
  return 'tshirt';
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const match = /#[0-9a-fA-F]{6}/.exec(value.trim());
    if (match && HEX_COLOR_RE.test(match[0])) {
      return match[0].toLowerCase();
    }
  }
  return fallback;
}

function normalizePositiveNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.]/g, ''));
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.round(numeric * 100) / 100;
    }
  }
  return fallback;
}

function normalizeCategorizeResult(raw: Record<string, unknown> | null): CategorizeResult {
  const style = normalizeStyle(raw?.style);
  const skuPrefixMap: Record<ShirtStyle, string> = {
    tshirt: 'AT-TEE',
    polo: 'AT-POL',
    oxford: 'AT-OXF',
    hoodie: 'AT-HOD',
  };

  const rawName = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Atelier Studio Garment';
  const rawSku =
    typeof raw?.sku === 'string' && raw.sku.trim()
      ? raw.sku.trim().toUpperCase().replace(/\s+/g, '-')
      : `${skuPrefixMap[style]}-${String(Date.now()).slice(-3)}`;
  const rawCategory =
    typeof raw?.category === 'string' && raw.category.trim() ? raw.category.trim() : 'Boutique Essentials';
  const rawFabricNote =
    typeof raw?.fabricNote === 'string' && raw.fabricNote.trim()
      ? raw.fabricNote.trim()
      : '100% Combed Cotton Weave';
  const rawSummary =
    typeof raw?.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'เสื้อสไตล์บูทีคตัดเย็บประณีต สวมใส่สบายเหมาะสำหรับจัดวางในคอลเลกชัน';

  return {
    name: rawName,
    sku: rawSku,
    category: rawCategory,
    style,
    recommendedColor: normalizeHexColor(raw?.recommendedColor, '#1a2332'),
    accentColor: normalizeHexColor(raw?.accentColor, '#c8a96e'),
    fabricNote: rawFabricNote,
    estimatedPrice: normalizePositiveNumber(raw?.estimatedPrice, 890) ?? 890,
    summary: rawSummary,
  };
}

function normalizeOcrResult(rawText: string): { text: string; data: OcrExtractedData } {
  const parsed = extractJsonObject<Record<string, unknown>>(rawText);
  if (!parsed) {
    return {
      text: rawText.trim(),
      data: {
        documentType: 'other',
        text: rawText.trim(),
      },
    };
  }

  const rawDocType = typeof parsed.documentType === 'string' ? parsed.documentType : 'other';
  const validDocTypes = new Set(['hangtag', 'care_label', 'size_table', 'receipt', 'other']);
  const documentType = (validDocTypes.has(rawDocType) ? rawDocType : 'other') as OcrExtractedData['documentType'];

  const extractedSizes: ExtractedSizeRow[] = Array.isArray(parsed.sizes)
    ? parsed.sizes
        .map((item): ExtractedSizeRow | null => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const label = typeof row.label === 'string' ? row.label.trim() : '';
          if (!label) return null;
          return {
            label,
            chestInch: normalizePositiveNumber(row.chestInch),
            lengthInch: normalizePositiveNumber(row.lengthInch),
            shoulderInch: normalizePositiveNumber(row.shoulderInch),
            price: normalizePositiveNumber(row.price),
          };
        })
        .filter((row): row is ExtractedSizeRow => row !== null)
    : [];

  const text =
    typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim()
      : [
          typeof parsed.name === 'string' && parsed.name.trim() ? `สินค้า: ${parsed.name.trim()}` : null,
          typeof parsed.sku === 'string' && parsed.sku.trim() ? `SKU: ${parsed.sku.trim()}` : null,
          normalizePositiveNumber(parsed.price) !== undefined ? `ราคา: ฿${normalizePositiveNumber(parsed.price)}` : null,
          typeof parsed.fabricNote === 'string' && parsed.fabricNote.trim() ? `เนื้อผ้า: ${parsed.fabricNote.trim()}` : null,
          extractedSizes.length > 0
            ? `ตารางไซส์:\n${extractedSizes
                .map(
                  (s) =>
                    `- ${s.label}${s.chestInch ? ` | อก ${s.chestInch}"` : ''}${s.lengthInch ? ` | ยาว ${s.lengthInch}"` : ''}${s.price ? ` | ฿${s.price}` : ''}`
                )
                .join('\n')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n') || rawText.trim();

  const data: OcrExtractedData = {
    documentType,
    text,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : undefined,
    sku: typeof parsed.sku === 'string' && parsed.sku.trim() ? parsed.sku.trim() : undefined,
    price: normalizePositiveNumber(parsed.price),
    fabricNote: typeof parsed.fabricNote === 'string' && parsed.fabricNote.trim() ? parsed.fabricNote.trim() : undefined,
    sizes: extractedSizes.length > 0 ? extractedSizes : undefined,
  };

  return { text, data };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY is not configured. AI garment scanning is unavailable; please enter garment details manually.',
          code: 'MISSING_GEMINI_API_KEY',
        },
        { status: 503 }
      );
    }

    let body: ScanRequestBody;
    try {
      body = (await req.json()) as ScanRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const rawImage = typeof body.imageBase64 === 'string'
      ? body.imageBase64
      : typeof body.image === 'string'
      ? body.image
      : '';

    if (!rawImage.trim()) {
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      );
    }

    const requestedMode = (body.mode || 'ocr').trim().toLowerCase() as ScanMode;
    if (requestedMode !== 'ocr' && requestedMode !== 'categorize') {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Expected "ocr" or "categorize".' },
        { status: 400 }
      );
    }

    const fallbackMime = typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : 'image/jpeg';
    const { base64, mimeType } = parseImagePayload(rawImage, fallbackMime);

    if (!base64) {
      return NextResponse.json(
        { success: false, error: 'Invalid base64 image payload' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Mode 1: Garment Hangtag / Care Label / Size Table / Receipt OCR
    if (requestedMode === 'ocr') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
              {
                text: `คุณคือผู้เชี่ยวชาญด้านการอ่านป้ายสินค้าเสื้อผ้า ป้ายไซส์ ป้ายดูแลผ้า และใบเสร็จร้านเสื้อผ้า (Garment Tag & Receipt OCR)
กรุณาถอดข้อมูลภาษาไทยและภาษาอังกฤษจากรูปภาพนี้อย่างแม่นยำ แล้วตอบกลับเป็น JSON object เท่านั้น ตามโครงสร้างนี้:
{
  "documentType": "hangtag | care_label | size_table | receipt | other",
  "text": "ข้อความที่ถอดได้แบบสะอาด อ่านง่าย จัดบรรทัดชัดเจน (เหมาะสำหรับนำไปแสดงในช่องป้ายสินค้าหรือรายละเอียดใบเสร็จ)",
  "name": "ชื่อรุ่นเสื้อหรือแบรนด์ที่พบ (ถ้าไม่มีให้เว้นว่างหรือ null)",
  "sku": "รหัสสินค้า/SKU/Barcode ที่พบ (ถ้าไม่มีให้เว้นว่างหรือ null)",
  "price": ตัวเลขราคาเป็นบาทหรือสกุลหลักถ้าพบ (number หรือ null),
  "fabricNote": "ส่วนผสมเนื้อผ้าหรือคำแนะนำการซักรีดที่พบ (ถ้าไม่มีให้ null)",
  "sizes": [
    { "label": "S", "chestInch": 38, "lengthInch": 27, "shoulderInch": 17, "price": 890 }
  ]
}`,
              },
            ],
          },
        ],
      });

      const rawOutput = response.text || '';
      const { text, data } = normalizeOcrResult(rawOutput);

      return NextResponse.json({
        success: true,
        mode: 'ocr',
        text,
        data,
      });
    }

    // Mode 2: AI Shirt Photo Categorizer & Boutique Rack Metadata Advisor
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `วิเคราะห์รูปถ่ายเสื้อผ้านี้สำหรับระบบ Boutique 3D Clothing Rack & Receipt Studio
ตอบกลับเป็น JSON object เท่านั้น โดยมีโครงสร้างและชนิดข้อมูลดังนี้:
{
  "name": "ชื่อเสื้อสไตล์บูทีคที่เหมาะสม (ไทย/อังกฤษ)",
  "sku": "รหัส SKU แนะนำ เช่น AT-TEE-01, AT-POL-02, AT-OXF-03, AT-HOD-04",
  "category": "หมวดหมู่ เช่น Heavyweight Tee, Knit Polo, Japanese Oxford, Fleece Hoodie, Resort Linen",
  "style": "เลือกเพียงหนึ่งค่าจาก 'tshirt' | 'polo' | 'oxford' | 'hoodie'",
  "recommendedColor": "รหัส Hex สีหลักของตัวเสื้อ เช่น #1a2332, #4c171e, #1b3b2b, #e8e2d8, #382e25, #222225",
  "accentColor": "รหัส Hex สีตกแต่ง/ป้ายคอเสื้อ/กระดุมที่เข้ากัน เช่น #c8a96e หรือ #d4c5b2",
  "fabricNote": "การคาดการณ์ชนิดผ้าและน้ำหนักผ้า เช่น 100% Combed Heavyweight Cotton 240gsm",
  "estimatedPrice": ตัวเลขราคาขายปลีกแนะนำเป็นบาท (เช่น 890, 1290, 1890),
  "summary": "คำอธิบายจุดเด่นของเสื้อแบบสั้นกระชับ 1-2 ประโยค"
}`,
            },
          ],
        },
      ],
    });

    const rawOutput = response.text || '{}';
    const parsed = extractJsonObject<Record<string, unknown>>(rawOutput);
    const normalized = normalizeCategorizeResult(parsed);

    return NextResponse.json({
      success: true,
      mode: 'categorize',
      data: normalized,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected Gemini scan error';
    console.error('Gemini Scan API error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
