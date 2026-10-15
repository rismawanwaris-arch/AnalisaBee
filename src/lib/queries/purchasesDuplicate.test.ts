import { describe, expect, it, vi, beforeEach } from "vitest";
import { previewPurchaseImport, importPurchases } from "./purchases";
import { prisma } from "../prisma";
import type { ParsedPurchaseInvoice } from "../parsePurchases";

vi.mock("../ensureDefaults", () => ({
  ensureDefaults: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../prisma", () => ({
  prisma: {
    purchaseInvoice: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseBatch: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("previewPurchaseImport duplicate detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleInvoices: ParsedPurchaseInvoice[] = [
    {
      invoiceNumber: "INV-001",
      date: new Date("2026-09-01"),
      refInvoice: null,
      outletName: "ALFA 1 CELL",
      vendor: "VENDOR A",
      currency: "Rupiah",
      subtotal: 100000,
      tax: 0,
      discount: 0,
      otherFee: 0,
      total: 100000,
      items: [
        {
          itemSeq: 1,
          itemCode: "ITM-01",
          itemName: "Barang 1",
          qty: 2,
          unit: "PCS",
          discount: 0,
          tax: 0,
          price: 50000,
          subtotal: 100000,
        },
      ],
    },
    {
      invoiceNumber: "INV-002",
      date: new Date("2026-09-02"),
      refInvoice: null,
      outletName: "GUDANG",
      vendor: "VENDOR B",
      currency: "Rupiah",
      subtotal: 200000,
      tax: 0,
      discount: 0,
      otherFee: 0,
      total: 200000,
      items: [
        {
          itemSeq: 1,
          itemCode: "ITM-02",
          itemName: "Barang 2",
          qty: 4,
          unit: "PCS",
          discount: 0,
          tax: 0,
          price: 50000,
          subtotal: 200000,
        },
      ],
    },
  ];

  it("detects no duplicates when database has no matching invoices", async () => {
    vi.mocked(prisma.purchaseInvoice.findMany).mockResolvedValueOnce([]);

    const preview = await previewPurchaseImport(sampleInvoices, []);
    expect(preview.totalInvoices).toBe(2);
    expect(preview.newCount).toBe(2);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.duplicates).toHaveLength(0);
    expect(preview.newSample).toHaveLength(2);
    expect(preview.periodStart).toBe("2026-09-01");
    expect(preview.periodEnd).toBe("2026-09-02");
  });

  it("detects existing invoices as duplicates and returns their details", async () => {
    vi.mocked(prisma.purchaseInvoice.findMany).mockResolvedValueOnce([
      {
        invoiceNumber: "INV-001",
        date: new Date("2026-09-01"),
        vendor: "VENDOR A",
        outletName: "ALFA 1 CELL",
        total: 100000 as any,
        batch: {
          id: 42,
          filename: "previous_upload.xlsx",
          uploadedAt: new Date("2026-09-10T10:00:00Z"),
        },
      } as any,
    ]);

    const preview = await previewPurchaseImport(sampleInvoices, []);
    expect(preview.totalInvoices).toBe(2);
    expect(preview.newCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.duplicates).toHaveLength(1);
    expect(preview.duplicates[0].invoiceNumber).toBe("INV-001");
    expect(preview.duplicates[0].existingBatch?.filename).toBe("previous_upload.xlsx");
    expect(preview.newSample).toHaveLength(1);
    expect(preview.newSample[0].invoiceNumber).toBe("INV-002");
  });

  it("identifies 100% duplicate scenario when all invoices exist", async () => {
    vi.mocked(prisma.purchaseInvoice.findMany).mockResolvedValueOnce([
      {
        invoiceNumber: "INV-001",
        date: new Date("2026-09-01"),
        vendor: "VENDOR A",
        outletName: "ALFA 1 CELL",
        total: 100000 as any,
        batch: null,
      } as any,
      {
        invoiceNumber: "INV-002",
        date: new Date("2026-09-02"),
        vendor: "VENDOR B",
        outletName: "GUDANG",
        total: 200000 as any,
        batch: null,
      } as any,
    ]);

    const preview = await previewPurchaseImport(sampleInvoices, []);
    expect(preview.totalInvoices).toBe(2);
    expect(preview.newCount).toBe(0);
    expect(preview.duplicateCount).toBe(2);
    expect(preview.duplicates).toHaveLength(2);
  });
});

describe("importPurchases duplicate modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleInvoices: ParsedPurchaseInvoice[] = [
    {
      invoiceNumber: "INV-001",
      date: new Date("2026-09-01"),
      refInvoice: null,
      outletName: "ALFA 1 CELL",
      vendor: "VENDOR A",
      currency: "Rupiah",
      subtotal: 100000,
      tax: 0,
      discount: 0,
      otherFee: 0,
      total: 100000,
      items: [
        {
          itemSeq: 1,
          itemCode: "ITM-01",
          itemName: "Barang 1",
          qty: 2,
          unit: "PCS",
          discount: 0,
          tax: 0,
          price: 50000,
          subtotal: 100000,
        },
      ],
    },
    {
      invoiceNumber: "INV-002",
      date: new Date("2026-09-02"),
      refInvoice: null,
      outletName: "GUDANG",
      vendor: "VENDOR B",
      currency: "Rupiah",
      subtotal: 200000,
      tax: 0,
      discount: 0,
      otherFee: 0,
      total: 200000,
      items: [
        {
          itemSeq: 1,
          itemCode: "ITM-02",
          itemName: "Barang 2",
          qty: 4,
          unit: "PCS",
          discount: 0,
          tax: 0,
          price: 50000,
          subtotal: 200000,
        },
      ],
    },
  ];

  it("skips existing invoices when duplicateMode is 'skip'", async () => {
    vi.mocked(prisma.purchaseBatch.create).mockResolvedValueOnce({ id: 10 } as any);
    vi.mocked(prisma.purchaseBatch.update).mockResolvedValueOnce({ id: 10 } as any);

    // INV-001 exists in DB, INV-002 does not
    vi.mocked(prisma.purchaseInvoice.findUnique)
      .mockResolvedValueOnce({ id: 99 } as any) // INV-001
      .mockResolvedValueOnce(null); // INV-002

    vi.mocked(prisma.purchaseInvoice.create).mockResolvedValueOnce({ id: 101 } as any);

    const result = await importPurchases(sampleInvoices, "test.xlsx", 0, "skip");

    expect(result.insertedInvoices).toBe(1);
    expect(result.skippedInvoices).toBe(1);
    expect(result.updatedInvoices).toBe(0);

    // prisma.purchaseInvoice.create should be called once (only for INV-002)
    expect(prisma.purchaseInvoice.create).toHaveBeenCalledTimes(1);
    // prisma.purchaseInvoice.update should NOT be called
    expect(prisma.purchaseInvoice.update).not.toHaveBeenCalled();

    // Batch duplicate count should reflect skipped invoices
    expect(prisma.purchaseBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DONE",
          insertedCount: 1,
          duplicateCount: 1,
        }),
      })
    );
  });

  it("updates existing invoices when duplicateMode is 'overwrite'", async () => {
    vi.mocked(prisma.purchaseBatch.create).mockResolvedValueOnce({ id: 20 } as any);
    vi.mocked(prisma.purchaseBatch.update).mockResolvedValueOnce({ id: 20 } as any);

    // INV-001 exists in DB, INV-002 does not
    vi.mocked(prisma.purchaseInvoice.findUnique)
      .mockResolvedValueOnce({ id: 99 } as any) // INV-001
      .mockResolvedValueOnce(null); // INV-002

    vi.mocked(prisma.purchaseInvoice.update).mockResolvedValueOnce({ id: 99 } as any);
    vi.mocked(prisma.purchaseInvoice.create).mockResolvedValueOnce({ id: 102 } as any);

    const result = await importPurchases(sampleInvoices, "test.xlsx", 0, "overwrite");

    expect(result.insertedInvoices).toBe(1);
    expect(result.updatedInvoices).toBe(1);
    expect(result.skippedInvoices).toBe(0);

    // Both update and create were called once
    expect(prisma.purchaseInvoice.update).toHaveBeenCalledTimes(1);
    expect(prisma.purchaseInvoice.create).toHaveBeenCalledTimes(1);
  });
});
