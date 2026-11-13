import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import type { DetectedPrinterInfo } from '@/types/shirt';

const execFileAsync = promisify(execFile);

interface WinPrinterRaw {
  Name?: unknown;
  DriverName?: unknown;
  PortName?: unknown;
  PrinterStatus?: unknown;
  Default?: unknown;
}

function formatWinPrinterStatus(status: unknown): string {
  if (typeof status === 'string' && status.trim()) return status.trim();
  if (status === 0 || status === 'Normal') return 'พร้อมใช้งาน (Ready)';
  if (status === 3 || status === 'Idle') return 'สแตนด์บาย (Idle)';
  if (status === 4 || status === 'Printing') return 'กำลังพิมพ์';
  if (status === 5 || status === 'Warmup') return 'Warmup';
  if (typeof status === 'number') return `Status #${status}`;
  return 'พร้อมใช้งาน';
}

export async function GET(request?: Request) {
  // Touch request.url so Next.js 16 (cacheComponents: true) evaluates runtime env per request.
  void request?.url;

  if (process.env.VERCEL === '1') {
    return NextResponse.json({
      supported: false,
      environment: 'cloud',
      printers: [] as DetectedPrinterInfo[],
      note: 'กำลังรันบน Vercel Cloud — เบราว์เซอร์ไม่อนุญาตให้อ่านเครื่องพิมพ์ของ Windows จากระยะไกลโดยตรง (สามารถกด "เชื่อมต่อ USB (WebUSB)" หรือเลือกเครื่องพิมพ์จากหน้าต่าง Print ของเบราว์เซอร์ได้)',
    });
  }

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus,Default | ConvertTo-Json -Compress',
        ],
        { timeout: 3500 }
      );

      const trimmed = stdout.trim();
      if (!trimmed) {
        return NextResponse.json({
          supported: true,
          environment: 'local-windows',
          printers: [] as DetectedPrinterInfo[],
        });
      }

      const parsed = JSON.parse(trimmed) as WinPrinterRaw | WinPrinterRaw[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const printers: DetectedPrinterInfo[] = list
        .filter((item) => typeof item?.Name === 'string' && item.Name.trim() !== '')
        .map((item, idx) => ({
          id: `win-${idx}-${String(item.Name).trim()}`,
          name: String(item.Name).trim(),
          source: 'windows' as const,
          status: formatWinPrinterStatus(item.PrinterStatus),
          driverOrVendor:
            typeof item.DriverName === 'string' ? item.DriverName.trim() : undefined,
          portOrId: typeof item.PortName === 'string' ? item.PortName.trim() : undefined,
          isDefault: Boolean(item.Default),
        }));

      return NextResponse.json({
        supported: true,
        environment: 'local-windows',
        printers,
      });
    } catch {
      return NextResponse.json({
        supported: false,
        environment: 'local-windows',
        printers: [] as DetectedPrinterInfo[],
        note: 'ไม่สามารถอ่านรายชื่อเครื่องพิมพ์จาก Windows Print Spooler ได้',
      });
    }
  }

  return NextResponse.json({
    supported: false,
    environment: process.platform,
    printers: [] as DetectedPrinterInfo[],
    note: 'ระบบอ่านเครื่องพิมพ์อัตโนมัติรองรับเมื่อรันในเครื่อง Windows หรือเชื่อมต่อผ่าน WebUSB / WebSerial บน Chrome',
  });
}
