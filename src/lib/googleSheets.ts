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

export async function ensureSheetTabWithHeaders(
  sheetId: string,
  tabTitle: string,
  headers: string[]
): Promise<void> {
  const sheets = getGoogleSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });

  const existingTab = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === tabTitle
  );

  if (!existingTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
              },
            },
          },
        ],
      },
    });
  }

  const endCol = String.fromCharCode(64 + Math.min(26, Math.max(1, headers.length)));
  const headerRange = `${tabTitle}!A1:${endCol}1`;
  const existingHeaderRes = await sheets.spreadsheets.values
    .get({
      spreadsheetId: sheetId,
      range: headerRange,
    })
    .catch(() => null);

  const currentRow = existingHeaderRes?.data.values?.[0] ?? [];
  const needsHeaderUpdate =
    currentRow.length < headers.length ||
    headers.some((h, idx) => String(currentRow[idx] ?? '').trim() !== h);

  if (needsHeaderUpdate) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
  }
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
  const matchingIndices: number[] = [];
  rows.forEach((row, idx) => {
    const cellValue = String(row[0] ?? '').trim();
    if (idx === 0 && cellValue.toLowerCase() === 'id') {
      return;
    }
    if (cellValue === trimmedId) {
      matchingIndices.push(idx);
    }
  });

  if (matchingIndices.length === 0) {
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

  // Delete in descending row order so earlier deletions never shift subsequent indices.
  const requests = matchingIndices
    .sort((a, b) => b - a)
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId: tabSheetId,
          dimension: 'ROWS',
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests,
    },
  });

  return true;
}
