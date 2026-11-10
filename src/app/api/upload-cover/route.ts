import { NextResponse } from 'next/server';
import { uploadBufferToDrive } from '@/lib/googleDrive';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const coverType = (formData.get('type') as string) || 'front';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `book-${coverType}-${Date.now()}-${file.name}`;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const uploaded = await uploadBufferToDrive(buffer, filename, file.type, folderId);

    return NextResponse.json({
      success: true,
      fileId: uploaded.id,
      url: uploaded.webViewLink,
    });
  } catch (error: any) {
    console.error('Drive upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
