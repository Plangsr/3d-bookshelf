import { google } from 'googleapis';
import { Readable } from 'stream';

// Helper to get Google Drive Authenticated client using Service Account credentials
export function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment variables.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return google.drive({ version: 'v3', auth });
}

export async function uploadBufferToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId?: string
) {
  const drive = getGoogleDriveClient();

  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: readable,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  // Make public read so anyone viewing the 3D book cover can load the texture
  if (response.data.id) {
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (e) {
      console.warn('Could not set public permission on Drive file:', e);
    }
  }

  return response.data;
}
