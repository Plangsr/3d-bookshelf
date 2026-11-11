import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';

/**
 * Text post-processing and markdown formatting for OCR results
 */
function formatOcrText(rawText: string): string {
  if (!rawText) return '';

  // 1. Normalize line endings and whitespace
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Remove common scan artifacts/noise characters
  text = text.replace(/^[|·•~`_—\-=\s]{1,3}$/gm, '');

  // 3. Fix Thai vowel/tone mark disjointed spaces if any
  text = text.replace(/([ก-๙])\s+([่้๊๋์็ิีึืุู])/g, '$1$2');

  // 4. Split into lines to detect structure (headings, lists, paragraphs)
  const lines = text.split('\n');
  const cleanedParagraphs: string[] = [];
  let currentPara: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentPara.length > 0) {
        cleanedParagraphs.push(currentPara.join(' '));
        currentPara = [];
      }
      continue;
    }

    // Check if line looks like a chapter/heading
    const isHeading =
      /^(บทที่|ตอนที่|Chapter|Section|\d+\.|\d+\))\s+/i.test(trimmed) ||
      (trimmed.length < 40 && !/[.,;!?]$/.test(trimmed) && currentPara.length === 0);

    if (isHeading && currentPara.length === 0) {
      if (/^(บทที่|Chapter)/i.test(trimmed)) {
        cleanedParagraphs.push(`## ${trimmed}`);
      } else {
        cleanedParagraphs.push(`### ${trimmed}`);
      }
      continue;
    }

    currentPara.push(trimmed);
  }

  if (currentPara.length > 0) {
    cleanedParagraphs.push(currentPara.join(' '));
  }

  return cleanedParagraphs.join('\n\n').trim();
}

export async function POST(req: Request) {
  let worker: any = null;
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Convert Base64 data to Buffer for Tesseract OCR processing
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Initialize Tesseract OCR worker with Thai and English language models
    worker = await createWorker(['tha', 'eng'], 1, {
      errorHandler: (err) => console.error('Tesseract worker error:', err),
    });

    const result = await worker.recognize(imageBuffer);
    const rawText = result.data.text || '';
    const formattedMarkdown = formatOcrText(rawText);

    await worker.terminate();
    worker = null;

    return NextResponse.json({
      success: true,
      text: formattedMarkdown || rawText || '(ไม่พบข้อความในภาพ)',
      confidence: result.data.confidence,
    });
  } catch (error: any) {
    console.error('OCR API error:', error);
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // ignore
      }
    }
    return NextResponse.json(
      { success: false, error: error.message || 'การประมวลผล OCR ล้มเหลว' },
      { status: 500 }
    );
  }
}

