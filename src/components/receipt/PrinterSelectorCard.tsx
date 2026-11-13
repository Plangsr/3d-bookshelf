'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cable, CheckCircle2, Plus, Printer, RefreshCw, Trash2, Usb } from 'lucide-react';
import { loadSavedPrinters, saveSavedPrinters } from '@/lib/storage';
import type { DetectedPrinterInfo, ReceiptPaperSize } from '@/types/shirt';

interface BrowserUsbDevice {
  productName?: string;
  manufacturerName?: string;
  vendorId: number;
  productId: number;
  serialNumber?: string;
}

interface BrowserUsbManager {
  getDevices: () => Promise<BrowserUsbDevice[]>;
  requestDevice: (options: { filters: Record<string, unknown>[] }) => Promise<BrowserUsbDevice>;
}

interface BrowserSerialPort {
  getInfo: () => { usbVendorId?: number; usbProductId?: number };
}

interface BrowserSerialManager {
  getPorts: () => Promise<BrowserSerialPort[]>;
  requestPort: () => Promise<BrowserSerialPort>;
}

interface NavigatorWithHardware extends Navigator {
  usb?: BrowserUsbManager;
  serial?: BrowserSerialManager;
}

interface PrinterSelectorCardProps {
  paperSizes: ReceiptPaperSize[];
  selectedPrinterId?: string;
  activePaperSizeId: string;
  onSelectPrinter: (printer: DetectedPrinterInfo | null) => void;
  onApplyMappedPaperSize?: (paperSizeId: string) => void;
}

export const PrinterSelectorCard: React.FC<PrinterSelectorCardProps> = ({
  paperSizes,
  selectedPrinterId,
  activePaperSizeId,
  onSelectPrinter,
  onApplyMappedPaperSize,
}) => {
  const [systemPrinters, setSystemPrinters] = useState<DetectedPrinterInfo[]>([]);
  const [usbPrinters, setUsbPrinters] = useState<DetectedPrinterInfo[]>([]);
  const [serialPrinters, setSerialPrinters] = useState<DetectedPrinterInfo[]>([]);
  const [manualPrinters, setManualPrinters] = useState<DetectedPrinterInfo[]>(() =>
    loadSavedPrinters()
  );
  const [envNote, setEnvNote] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const scanPrinters = useCallback(async () => {
    try {
      const res = await fetch('/api/printers');
      if (res.ok) {
        const data = (await res.json()) as {
          printers?: DetectedPrinterInfo[];
          note?: string;
        };
        setSystemPrinters(Array.isArray(data.printers) ? data.printers : []);
        setEnvNote(data.note ?? '');
      }
    } catch {
      // Ignore network hiccup
    }

    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithHardware) : null;
    if (nav?.usb) {
      try {
        const devices = await nav.usb.getDevices();
        setUsbPrinters(
          devices.map((d, idx) => ({
            id: `usb-${d.vendorId}-${d.productId}-${d.serialNumber || idx}`,
            name: d.productName?.trim() || `USB Printer (${d.vendorId.toString(16)}:${d.productId.toString(16)})`,
            source: 'webusb' as const,
            status: 'เชื่อมต่อ USB แล้ว',
            driverOrVendor: d.manufacturerName?.trim(),
            portOrId: `VID:${d.vendorId.toString(16).toUpperCase()} PID:${d.productId.toString(16).toUpperCase()}`,
          }))
        );
      } catch {
        // WebUSB unavailable in this context
      }
    }

    if (nav?.serial) {
      try {
        const ports = await nav.serial.getPorts();
        setSerialPrinters(
          ports.map((p, idx) => {
            const info = p.getInfo();
            return {
              id: `serial-${idx}-${info.usbVendorId ?? 'port'}`,
              name: `Serial / POS Port #${idx + 1}`,
              source: 'webserial' as const,
              status: 'จับคู่พอร์ตแล้ว',
              portOrId:
                info.usbVendorId !== undefined
                  ? `VID:${info.usbVendorId.toString(16).toUpperCase()}`
                  : 'COM / Serial',
            };
          })
        );
      } catch {
        // WebSerial unavailable
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!active) return;
      await scanPrinters();
    };
    void init();
    return () => {
      active = false;
    };
  }, [scanPrinters]);

  const handleRequestUsb = async () => {
    const nav = navigator as NavigatorWithHardware;
    if (!nav.usb) {
      setEnvNote('เบราว์เซอร์นี้ไม่รองรับ WebUSB (แนะนำใช้ Chrome / Edge บน Desktop)');
      return;
    }
    try {
      const device = await nav.usb.requestDevice({ filters: [] });
      const info: DetectedPrinterInfo = {
        id: `usb-${device.vendorId}-${device.productId}-${device.serialNumber || Date.now()}`,
        name:
          device.productName?.trim() ||
          `USB Printer (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
        source: 'webusb',
        status: 'เชื่อมต่อ USB แล้ว',
        driverOrVendor: device.manufacturerName?.trim(),
        portOrId: `VID:${device.vendorId.toString(16).toUpperCase()} PID:${device.productId.toString(16).toUpperCase()}`,
      };
      setUsbPrinters((prev) => {
        const exists = prev.some((p) => p.id === info.id);
        return exists ? prev : [info, ...prev];
      });
      onSelectPrinter(info);
    } catch {
      // User cancelled picker
    }
  };

  const handleRequestSerial = async () => {
    const nav = navigator as NavigatorWithHardware;
    if (!nav.serial) {
      setEnvNote('เบราว์เซอร์นี้ไม่รองรับ WebSerial (แนะนำใช้ Chrome / Edge บน Desktop)');
      return;
    }
    try {
      const port = await nav.serial.requestPort();
      const info = port.getInfo();
      const printer: DetectedPrinterInfo = {
        id: `serial-${Date.now()}`,
        name: `Serial Printer (${info.usbVendorId ? `VID:${info.usbVendorId.toString(16).toUpperCase()}` : 'COM'})`,
        source: 'webserial',
        status: 'จับคู่พอร์ตแล้ว',
        portOrId: info.usbVendorId
          ? `VID:${info.usbVendorId.toString(16).toUpperCase()}`
          : 'Serial/Bluetooth',
      };
      setSerialPrinters((prev) => [printer, ...prev]);
      onSelectPrinter(printer);
    } catch {
      // Cancelled
    }
  };

  const handleAddManualPrinter = () => {
    const name = newPrinterName.trim();
    if (!name) return;
    const nextItem: DetectedPrinterInfo = {
      id: `manual-${Date.now()}`,
      name,
      source: 'manual',
      status: 'โปรไฟล์เครื่องพิมพ์ที่ร้าน',
      defaultPaperSizeId: activePaperSizeId,
    };
    const next = [nextItem, ...manualPrinters];
    setManualPrinters(next);
    saveSavedPrinters(next);
    onSelectPrinter(nextItem);
    setNewPrinterName('');
    setShowAddForm(false);
  };

  const handleUpdateManualPaperMapping = (printerId: string, paperSizeId: string) => {
    const next = manualPrinters.map((p) =>
      p.id === printerId ? { ...p, defaultPaperSizeId: paperSizeId } : p
    );
    setManualPrinters(next);
    saveSavedPrinters(next);
  };

  const handleDeleteManualPrinter = (printerId: string) => {
    const next = manualPrinters.filter((p) => p.id !== printerId);
    setManualPrinters(next);
    saveSavedPrinters(next);
    if (selectedPrinterId === printerId) {
      onSelectPrinter(null);
    }
  };

  const allPrinters = useMemo(
    () => [...systemPrinters, ...usbPrinters, ...serialPrinters, ...manualPrinters],
    [systemPrinters, usbPrinters, serialPrinters, manualPrinters]
  );

  return (
    <div className="rounded-2xl border border-[#3a2a1f] bg-[#1a130e] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-[#e8c170]" />
          <div className="text-sm font-bold text-[#f7f1e8]">
            ข้อมูลเครื่องพิมพ์ (Detected &amp; Saved Printers)
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              setIsScanning(true);
              await scanPrinters();
              setIsScanning(false);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#120d0a] hover:bg-[#291e16] border border-[#3b2c21] text-[11px] text-[#d6c8b6] flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
          <button
            type="button"
            onClick={() => void handleRequestUsb()}
            className="px-2.5 py-1.5 rounded-lg bg-[#291e16] hover:bg-[#38291e] border border-[#543e2d] text-[11px] font-semibold text-[#e8c170] flex items-center gap-1"
          >
            <Usb className="w-3 h-3" />
            <span>เชื่อมต่อ USB</span>
          </button>
          <button
            type="button"
            onClick={() => void handleRequestSerial()}
            className="px-2.5 py-1.5 rounded-lg bg-[#120d0a] hover:bg-[#291e16] border border-[#3b2c21] text-[11px] text-[#d6c8b6] flex items-center gap-1"
          >
            <Cable className="w-3 h-3" />
            <span>Serial/COM</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-[#120d0a] hover:bg-[#291e16] border border-[#3b2c21] text-[11px] text-[#86efac] flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>บันทึกชื่อเครื่อง</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="flex flex-wrap gap-2 pt-1">
          <input
            type="text"
            value={newPrinterName}
            onChange={(e) => setNewPrinterName(e.target.value)}
            placeholder="ชื่อเครื่องพิมพ์ เช่น Xprinter XP-80T / Brother A4"
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-[#120d0a] border border-[#443326] text-xs text-[#faf5ee]"
          />
          <button
            type="button"
            onClick={handleAddManualPrinter}
            className="px-3 py-1.5 rounded-lg bg-[#e8c170] text-[#1c1410] text-xs font-bold"
          >
            บันทึก
          </button>
        </div>
      )}

      {allPrinters.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allPrinters.map((p) => {
            const active = selectedPrinterId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectPrinter(p);
                  if (p.defaultPaperSizeId && onApplyMappedPaperSize) {
                    onApplyMappedPaperSize(p.defaultPaperSizeId);
                  }
                }}
                className={`rounded-xl border p-2.5 text-xs cursor-pointer transition-colors ${
                  active
                    ? 'border-[#e8c170] bg-[#e8c170]/10'
                    : 'border-[#32241a] bg-[#120d0a] hover:border-[#543e2d]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#f5efe6] truncate flex items-center gap-1.5">
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#e8c170] shrink-0" />}
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-[#a99784] truncate mt-0.5">
                      {p.status}
                      {p.driverOrVendor ? ` • ${p.driverOrVendor}` : ''}
                      {p.portOrId ? ` • ${p.portOrId}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-[#291e16] text-[10px] text-[#e8c170] uppercase">
                      {p.source}
                    </span>
                    {p.source === 'manual' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteManualPrinter(p.id);
                        }}
                        className="text-red-300/75 hover:text-red-300 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {p.source === 'manual' && (
                  <div
                    className="mt-2 pt-1.5 border-t border-[#291e16] flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-[#a99784]">ขนาดคู่เครื่อง:</span>
                    <select
                      value={p.defaultPaperSizeId ?? activePaperSizeId}
                      onChange={(e) => {
                        handleUpdateManualPaperMapping(p.id, e.target.value);
                        if (onApplyMappedPaperSize) {
                          onApplyMappedPaperSize(e.target.value);
                        }
                      }}
                      className="flex-1 px-2 py-0.5 rounded bg-[#1a130e] border border-[#3b2c21] text-[11px] text-[#faf5ee]"
                    >
                      {paperSizes.map((ps) => (
                        <option key={ps.id} value={ps.id}>
                          {ps.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-[#2f231a] bg-[#120d0a] p-3 text-[11px] text-[#a99784] leading-relaxed">
          {envNote ||
            'ยังไม่มีเครื่องพิมพ์ที่ตรวจพบ — กด "เชื่อมต่อ USB" หรือ "บันทึกชื่อเครื่อง" ด้านบน หรือเลือกเครื่องพิมพ์จากหน้าต่าง Print ของเบราว์เซอร์เมื่อสั่งพิมพ์'}
        </div>
      )}
    </div>
  );
};
