import { NextResponse } from 'next/server';
import { uploadBufferToDrive } from '@/lib/googleDrive';

type UploadImageType = 'front' | 'back';

function normalizeUploadType(rawType: FormDataEntryValue | null): UploadImageType {
  if (typeof rawType === 'string' && rawType.trim().toLowerCase() === 'back') {
    return 'back';
  }
  return 'front';
}

function sanitizeFilename(rawName: string | undefined): string {
  const baseName = (rawName || 'garment.jpg').split(/[\\/]/).pop() || 'garment.jpg';
  const cleaned = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return cleaned || 'garment.jpg';
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const type = normalizeUploadType(formData.get('type'));

    if (!fileEntry || !(fileEntry instanceof File) || fileEntry.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No image file uploaded' },
        { status: 400 }
      );
    }

    const hasDriveCreds = Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
    );

    if (!hasDriveCreds) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google Drive storage is not configured (missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY). Please fall back to local data URL or object URL.',
          code: 'DRIVE_NOT_CONFIGURED',
          fallbackRecommended: true,
        },
        { status: 503 }
      );
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const safeName = sanitizeFilename(fileEntry.name);
    const filename = `shirt-${type}-${Date.now()}-${safeName}`;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const mimeType = fileEntry.type || 'image/jpeg';

    const uploaded = await uploadBufferToDrive(buffer, filename, mimeType, folderId);

    return NextResponse.json({
      success: true,
      fileId: uploaded.id,
      filename,
      type,
      url: uploaded.webViewLink || uploaded.webContentLink || null,
      webContentLink: uploaded.webContentLink || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Drive upload failed';
    console.error('Drive upload error:', error);
    return NextResponse.json(
      { success: false, error: message, fallbackRecommended: true },
      { status: 500 }
    );
  }
}
