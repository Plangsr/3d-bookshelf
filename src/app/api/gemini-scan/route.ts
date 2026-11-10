import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const { imageBase64, mimeType = 'image/jpeg', mode = 'ocr' } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Mode 1: High-precision Book Page OCR & Markdown Structure
    if (mode === 'ocr') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              {
                text: 'คุณคือผู้เชี่ยวชาญด้านการแปลงหน้ากระดาษหนังสือเป็นข้อความ (Book OCR) กรุณาถอดข้อความภาษาไทยและภาษาอังกฤษจากรูปภาพนี้อย่างแม่นยำ 100% จัดย่อหน้า วรรคตอน และจัดรูปแบบเป็น Markdown ที่อ่านง่าย โดยตัดเสียงรบกวนหรือขอบหน้ากระดาษออก ให้เฉพาะเนื้อหาที่อ่านได้จริงเท่านั้น',
              },
            ],
          },
        ],
      });

      return NextResponse.json({
        success: true,
        text: response.text,
      });
    }

    // Mode 2: Categorization & Shelf Arrangement Advisor
    if (mode === 'categorize') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              {
                text: `วิเคราะห์ปกหรือหน้าหนังสือนี้ และแนะนำข้อมูลสำหรับการจัดวางบนชั้นหนังสือ 3D "The Complete Shelf":
ตอบกลับเป็น JSON format เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "title": "ชื่อหนังสือที่ตรวจพบ",
  "author": "ชื่อผู้แต่งที่ตรวจพบ",
  "category": "หมวดหมู่ (วรรณกรรม, ประวัติศาสตร์, วิทยาศาสตร์, ศิลปะ, ปรัชญา, ฯลฯ)",
  "recommendedColor": "รหัส Hex ของสีผ้าหุ้มปกที่เหมาะสม เช่น #1e293b (Navy), #4c171e (Burgundy), #1b3b2b (Forest), #382e25 (Walnut)",
  "recommendedFoil": "gold หรือ silver หรือ copper",
  "summary": "เรื่องย่อสั้นๆ ไม่เกิน 2 ประโยค"
}`,
              },
            ],
          },
        ],
      });

      const raw = response.text || '{}';
      const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return NextResponse.json({
        success: true,
        data: parsed,
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('Gemini Scan API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
