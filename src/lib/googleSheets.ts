import { google } from 'googleapis';

export const DEFAULT_SPREADSHEET_ID = '1i_tTqQkL7kd279Nc04-L_l7atRodk_145kFPMejfh3U';

export function extractSpreadsheetId(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const urlMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  return trimmed;
}

export function getSheetsDatabaseConfig(): { sheetId: string } | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  if (!clientEmail || !privateKey) {
    return null;
  }

  const rawSheetRef =
    process.env.GOOGLE_SHEET_SHIRTS_ID?.trim() ||
    process.env.GOOGLE_SHEET_ID?.trim() ||
    DEFAULT_SPREADSHEET_ID;

  const sheetId = extractSpreadsheetId(rawSheetRef);
  if (!sheetId) {
    return null;
  }

  return { sheetId };
}

export function getGoogleSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Service Account credentials missing in environment variables.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function deleteSheetRowById(
  sheetId: string,
  tabTitle: string,
  targetId: string
): Promise<boolean> {
  const trimmedId = targetId.trim();
  if (!trimmedId) return false;

  const sheets = getGoogleSheetsClient();
  const idLookup = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabTitle}!A:A`,
  });

  const rows = idLookup.data.values || [];
  const rowIndex = rows.findIndex((row, idx) => {
    const cellValue = String(row[0] ?? '').trim();
    if (idx === 0 && cellValue.toLowerCase() === 'id') {
      return false;
    }
    return cellValue === trimmedId;
  });

  if (rowIndex === -1) {
    return false;
  }

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });

  const targetTab = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === tabTitle
  );
  const tabSheetId = targetTab?.properties?.sheetId;

  if (tabSheetId === undefined || tabSheetId === null) {
    return false;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tabSheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}
