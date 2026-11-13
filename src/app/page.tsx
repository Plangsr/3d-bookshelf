'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClothingRackCanvas } from '@/components/3d/ClothingRackCanvas';
import { ReceiptPreview } from '@/components/receipt/ReceiptPreview';
import {
  applyDynamicPrintPageStyle,
  ReceiptStudioModal,
} from '@/components/receipt/ReceiptStudioModal';
import { SizeManagerModal } from '@/components/receipt/SizeManagerModal';
import { ShirtStudioModal } from '@/components/studio/ShirtStudioModal';
import {
  DEFAULT_SHOP_PROFILE,
  INITIAL_PAPER_SIZES,
  INITIAL_SHIRTS,
} from '@/data/shirts';
import {
  calculateReceiptTotals,
  generateReceiptNumber,
  loadPaperSizes,
  loadReceiptDraft,
  loadReceiptHistory,
  loadShirts,
  loadShopProfile,
  savePaperSizes,
  saveReceiptDraft,
  saveReceiptHistory,
  saveShirts,
  saveShopProfile,
} from '@/lib/storage';
import type {
  ReceiptDraft,
  ReceiptLineItem,
  ReceiptPaperSize,
  ReceiptRecord,
  Shirt,
  ShirtSize,
  ShopProfile,
} from '@/types/shirt';

function createInitialDraft(shop: ShopProfile, paperSizeId: string): ReceiptDraft {
  return {
    receiptNo: 'RCP-ATELIER-0001',
    templateType: 'retail_standard',
    paperSizeId,
    shop,
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerTaxId: '',
    paymentMethod: 'cash',
    items: [],
    discountAmount: 0,
    shippingFee: 0,
    vatMode: 'none',
    hidePricesOnSlip: false,
    notes: '',
    subtotal: 0,
    vatAmount: 0,
    grandTotal: 0,
  };
}

export default function Home() {
  const [shirts, setShirts] = useState<Shirt[]>(INITIAL_SHIRTS);
  const [paperSizes, setPaperSizes] = useState<ReceiptPaperSize[]>(INITIAL_PAPER_SIZES);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(DEFAULT_SHOP_PROFILE);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptRecord[]>([]);
  const [draft, setDraft] = useState<ReceiptDraft>(() =>
    createInitialDraft(DEFAULT_SHOP_PROFILE, INITIAL_PAPER_SIZES[1]?.id ?? INITIAL_PAPER_SIZES[0].id)
  );

  // Modal visibility state
  const [isShirtStudioOpen, setIsShirtStudioOpen] = useState(false);
  const [editingShirt, setEditingShirt] = useState<Shirt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSizeManagerOpen, setIsSizeManagerOpen] = useState(false);

  // Optional temporary receipt override when reprinting a historical receipt
  const [printingRecord, setPrintingRecord] = useState<ReceiptRecord | null>(null);
  const shopSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate persisted client state & sync Google Sheets / API catalog in parallel
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      await Promise.resolve();
      if (!active) return;

      const localShirts = loadShirts();
      const localPaperSizes = loadPaperSizes();
      const localShop = loadShopProfile();
      const localHistory = loadReceiptHistory();
      const storedDraft = loadReceiptDraft();

      setShirts(localShirts);
      setPaperSizes(localPaperSizes);
      setShopProfile(localShop);
      setReceiptHistory(localHistory);

      const fallbackPaperId =
        localPaperSizes[1]?.id ?? localPaperSizes[0]?.id ?? 'size-80mm';
      const validPaperId =
        storedDraft?.paperSizeId &&
        localPaperSizes.some((p) => p.id === storedDraft.paperSizeId)
          ? storedDraft.paperSizeId
          : fallbackPaperId;

      const mergedDraft: ReceiptDraft = {
        ...createInitialDraft(localShop, validPaperId),
        ...(storedDraft ?? {}),
        receiptNo:
          typeof storedDraft?.receiptNo === 'string' && storedDraft.receiptNo.trim()
            ? storedDraft.receiptNo
            : generateReceiptNumber(),
        issuedAt:
          typeof storedDraft?.issuedAt === 'string' && storedDraft.issuedAt.trim()
            ? storedDraft.issuedAt
            : new Date().toISOString(),
        paperSizeId: validPaperId,
        shop: localShop,
        items: Array.isArray(storedDraft?.items) ? storedDraft.items : [],
      };
      setDraft(mergedDraft);

      const [shirtsRes, paperRes, shopRes, receiptsRes] = await Promise.allSettled([
        fetch('/api/shirts'),
        fetch('/api/paper-sizes'),
        fetch('/api/shop-profile'),
        fetch('/api/receipts'),
      ]);

      if (!active) return;

      let nextPaperSizes = localPaperSizes;
      let nextShop = localShop;
      let paperUpdated = false;
      let shopUpdated = false;

      if (shirtsRes.status === 'fulfilled' && shirtsRes.value.ok) {
        try {
          const data = (await shirtsRes.value.json()) as {
            shirts?: Shirt[];
            source?: string;
          };
          if (active && data.source === 'sheets' && Array.isArray(data.shirts)) {
            setShirts(data.shirts);
            saveShirts(data.shirts);
          }
        } catch {
          // Keep local catalog fallback
        }
      }

      if (paperRes.status === 'fulfilled' && paperRes.value.ok) {
        try {
          const data = (await paperRes.value.json()) as {
            paperSizes?: ReceiptPaperSize[];
            source?: string;
          };
          if (
            active &&
            data.source === 'sheets' &&
            Array.isArray(data.paperSizes) &&
            data.paperSizes.length > 0
          ) {
            nextPaperSizes = data.paperSizes;
            paperUpdated = true;
            setPaperSizes(nextPaperSizes);
            savePaperSizes(nextPaperSizes);
          }
        } catch {
          // Keep local paper size fallback
        }
      }

      if (shopRes.status === 'fulfilled' && shopRes.value.ok) {
        try {
          const data = (await shopRes.value.json()) as {
            shopProfile?: ShopProfile;
            source?: string;
          };
          if (active && data.source === 'sheets' && data.shopProfile) {
            nextShop = data.shopProfile;
            shopUpdated = true;
            setShopProfile(nextShop);
            saveShopProfile(nextShop);
          }
        } catch {
          // Keep local shop profile fallback
        }
      }

      if (receiptsRes.status === 'fulfilled' && receiptsRes.value.ok) {
        try {
          const data = (await receiptsRes.value.json()) as {
            receipts?: ReceiptRecord[];
            source?: string;
          };
          if (active && data.source === 'sheets' && Array.isArray(data.receipts)) {
            setReceiptHistory(data.receipts);
            saveReceiptHistory(data.receipts);
          }
        } catch {
          // Keep local receipt history fallback
        }
      }

      if (active && (paperUpdated || shopUpdated)) {
        setDraft((prev) => {
          const fallbackRemotePaperId =
            nextPaperSizes[1]?.id ?? nextPaperSizes[0]?.id ?? 'size-80mm';
          const ensuredPaperId = nextPaperSizes.some((p) => p.id === prev.paperSizeId)
            ? prev.paperSizeId
            : fallbackRemotePaperId;
          const syncedDraft: ReceiptDraft = {
            ...prev,
            ...(paperUpdated ? { paperSizeId: ensuredPaperId } : {}),
            ...(shopUpdated ? { shop: nextShop } : {}),
          };
          saveReceiptDraft(syncedDraft);
          return syncedDraft;
        });
      }
    };

    void hydrate();

    const handleAfterPrint = () => {
      setPrintingRecord(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      active = false;
      window.removeEventListener('afterprint', handleAfterPrint);
      if (shopSyncTimerRef.current) {
        clearTimeout(shopSyncTimerRef.current);
        shopSyncTimerRef.current = null;
      }
    };
  }, []);

  const activePaperSize = useMemo(
    () =>
      paperSizes.find((p) => p.id === draft.paperSizeId) ??
      paperSizes[0] ??
      INITIAL_PAPER_SIZES[1],
    [paperSizes, draft.paperSizeId]
  );

  const printableTarget = printingRecord ?? {
    ...draft,
    shop: shopProfile,
  };

  const printablePaperSize = useMemo(
    () =>
      paperSizes.find((p) => p.id === printableTarget.paperSizeId) ?? activePaperSize,
    [paperSizes, printableTarget.paperSizeId, activePaperSize]
  );

  const draftTotals = useMemo(
    () =>
      calculateReceiptTotals(
        draft.items,
        draft.discountAmount,
        draft.shippingFee,
        draft.vatMode
      ),
    [draft.items, draft.discountAmount, draft.shippingFee, draft.vatMode]
  );

  const printableTotals = useMemo(
    () =>
      calculateReceiptTotals(
        printableTarget.items,
        printableTarget.discountAmount,
        printableTarget.shippingFee,
        printableTarget.vatMode
      ),
    [
      printableTarget.items,
      printableTarget.discountAmount,
      printableTarget.shippingFee,
      printableTarget.vatMode,
    ]
  );

  // Keep <style id="dynamic-print-page-style"> synced with active paper size
  useEffect(() => {
    applyDynamicPrintPageStyle(printablePaperSize);
  }, [printablePaperSize]);

  const receiptItemCount = useMemo(
    () => draft.items.reduce((sum, item) => sum + item.quantity, 0),
    [draft.items]
  );

  // Shirt CRUD handlers
  const handleSaveShirt = async (savedShirt: Shirt) => {
    const exists = shirts.some((s) => s.id === savedShirt.id);
    const nextShirts = exists
      ? shirts.map((s) => (s.id === savedShirt.id ? savedShirt : s))
      : [savedShirt, ...shirts];

    setShirts(nextShirts);
    saveShirts(nextShirts);

    try {
      await fetch('/api/shirts', {
        method: exists ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedShirt),
      });
    } catch {
      // Persisted locally even if API sync fails
    }
  };

  const handleDeleteShirt = async (shirtId: string) => {
    const nextShirts = shirts.filter((s) => s.id !== shirtId);
    setShirts(nextShirts);
    saveShirts(nextShirts);

    try {
      await fetch('/api/shirts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shirtId }),
      });
    } catch {
      // Persisted locally even if API sync fails
    }
  };

  // Draft & Receipt handlers
  const handleUpdateDraft = (nextDraft: ReceiptDraft) => {
    const nextTotals = calculateReceiptTotals(
      nextDraft.items,
      nextDraft.discountAmount,
      nextDraft.shippingFee,
      nextDraft.vatMode
    );
    const enriched: ReceiptDraft = {
      ...nextDraft,
      shop: shopProfile,
      subtotal: nextTotals.subtotal,
      vatAmount: nextTotals.vatAmount,
      grandTotal: nextTotals.grandTotal,
    };
    setDraft(enriched);
    saveReceiptDraft(enriched);
  };

  const handleAddToReceipt = (shirt: Shirt, size: ShirtSize, quantity: number) => {
    const qty = Math.max(1, Math.floor(quantity) || 1);
    const existingIdx = draft.items.findIndex(
      (item) => item.shirtId === shirt.id && item.sizeId === size.id
    );

    let nextItems: ReceiptLineItem[];
    if (existingIdx !== -1) {
      nextItems = draft.items.map((item, idx) =>
        idx === existingIdx ? { ...item, quantity: item.quantity + qty } : item
      );
    } else {
      const measureText = `อก ${size.chestInch}" / ยาว ${size.lengthInch}"${
        size.shoulderInch ? ` / ไหล่ ${size.shoulderInch}"` : ''
      }`;
      const newLine: ReceiptLineItem = {
        lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        shirtId: shirt.id,
        sku: shirt.sku,
        shirtName: shirt.name,
        shirtColor: shirt.color,
        shirtStyle: shirt.style,
        sizeId: size.id,
        sizeLabel: size.label,
        sizeMeasureText: measureText,
        quantity: qty,
        unitPrice: size.price,
      };
      nextItems = [...draft.items, newLine];
    }

    handleUpdateDraft({
      ...draft,
      items: nextItems,
    });
  };

  const handleClearDraftItems = () => {
    handleUpdateDraft({
      ...draft,
      items: [],
      receiptNo: generateReceiptNumber(),
      issuedAt: new Date().toISOString(),
    });
  };

  const handleSavePaperSizes = async (nextSizes: ReceiptPaperSize[]) => {
    setPaperSizes(nextSizes);
    savePaperSizes(nextSizes);
    if (nextSizes.length > 0 && !nextSizes.some((p) => p.id === draft.paperSizeId)) {
      handleUpdateDraft({
        ...draft,
        paperSizeId: nextSizes[0].id,
      });
    }

    try {
      await fetch('/api/paper-sizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperSizes: nextSizes }),
      });
    } catch {
      // Persisted locally even if API sync fails
    }
  };

  const handleSelectPaperSize = (paperSizeId: string) => {
    handleUpdateDraft({
      ...draft,
      paperSizeId,
    });
  };

  const handleSaveShopProfile = (nextShop: ShopProfile) => {
    setShopProfile(nextShop);
    saveShopProfile(nextShop);
    const updatedDraft: ReceiptDraft = {
      ...draft,
      shop: nextShop,
    };
    setDraft(updatedDraft);
    saveReceiptDraft(updatedDraft);

    if (shopSyncTimerRef.current) {
      clearTimeout(shopSyncTimerRef.current);
    }
    shopSyncTimerRef.current = setTimeout(() => {
      shopSyncTimerRef.current = null;
      if (!nextShop.shopName.trim()) {
        return;
      }
      void fetch('/api/shop-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopProfile: nextShop }),
      }).catch(() => {
        // Persisted locally even if API sync fails
      });
    }, 600);
  };

  const handleSaveToHistory = (record: ReceiptRecord) => {
    const nextHistory = [record, ...receiptHistory.filter((r) => r.id !== record.id)];
    setReceiptHistory(nextHistory);
    saveReceiptHistory(nextHistory);
  };

  const handleDeleteHistory = async (id: string) => {
    const nextHistory = receiptHistory.filter((r) => r.id !== id);
    setReceiptHistory(nextHistory);
    saveReceiptHistory(nextHistory);

    try {
      await fetch(`/api/receipts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {
      // Persisted locally even if API sync fails
    }
  };

  const handlePrintReceipt = (recordOverride?: ReceiptRecord) => {
    if (recordOverride) {
      const targetPaper =
        paperSizes.find((p) => p.id === recordOverride.paperSizeId) ?? activePaperSize;
      setPrintingRecord(recordOverride);
      applyDynamicPrintPageStyle(targetPaper);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
      return;
    }

    const stampedDraft: ReceiptDraft = {
      ...draft,
      issuedAt: draft.issuedAt || new Date().toISOString(),
    };
    setDraft(stampedDraft);
    setPrintingRecord(null);
    applyDynamicPrintPageStyle(activePaperSize);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  return (
    <>
      <main className="relative w-screen h-screen overflow-hidden bg-[#0c0907] print:hidden">
        {/* 3D Boutique Clothing Rack Scene */}
        <ClothingRackCanvas
          shirts={shirts}
          receiptItemCount={receiptItemCount}
          receiptTotal={draftTotals.grandTotal}
          onOpenStudio={() => {
            setEditingShirt(null);
            setIsShirtStudioOpen(true);
          }}
          onEditShirt={(shirt) => {
            setEditingShirt(shirt);
            setIsShirtStudioOpen(true);
          }}
          onOpenReceipt={() => setIsReceiptModalOpen(true)}
          onOpenSizeManager={() => setIsSizeManagerOpen(true)}
          onAddToReceipt={handleAddToReceipt}
          onDeleteShirt={(shirtId) => void handleDeleteShirt(shirtId)}
        />

        {/* Shirt Studio Modal (Add / Edit Shirt + Sizes + AI Tag Scan) */}
        <ShirtStudioModal
          isOpen={isShirtStudioOpen}
          editingShirt={editingShirt}
          onClose={() => {
            setIsShirtStudioOpen(false);
            setEditingShirt(null);
          }}
          onSaveShirt={(shirt) => void handleSaveShirt(shirt)}
        />

        {/* Multi-Size Receipt Studio Modal */}
        <ReceiptStudioModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          shirts={shirts}
          draft={draft}
          onUpdateDraft={handleUpdateDraft}
          paperSizes={paperSizes}
          onSavePaperSizes={(sizes) => void handleSavePaperSizes(sizes)}
          shopProfile={shopProfile}
          onSaveShopProfile={handleSaveShopProfile}
          receiptHistory={receiptHistory}
          onSaveToHistory={handleSaveToHistory}
          onDeleteHistory={(id) => void handleDeleteHistory(id)}
          onOpenSizeManager={() => setIsSizeManagerOpen(true)}
          onClearDraftItems={handleClearDraftItems}
          onPrintReceipt={handlePrintReceipt}
        />

        {/* Size & Paper Manager Modal (rendered last + z-[60] so it stacks above ReceiptStudioModal) */}
        <SizeManagerModal
          isOpen={isSizeManagerOpen}
          onClose={() => setIsSizeManagerOpen(false)}
          paperSizes={paperSizes}
          selectedPaperSizeId={activePaperSize.id}
          onSelectPaperSize={handleSelectPaperSize}
          onSavePaperSizes={(sizes) => void handleSavePaperSizes(sizes)}
          shirts={shirts}
          onUpdateShirt={(shirt) => void handleSaveShirt(shirt)}
        />
      </main>

      {/* Dedicated Printable Receipt Root */}
      <div id="printable-receipt-root" className="hidden print:block">
        <ReceiptPreview
          draft={printableTarget}
          paperSize={printablePaperSize}
          totals={printableTotals}
          zoom={1}
        />
      </div>
    </>
  );
}
