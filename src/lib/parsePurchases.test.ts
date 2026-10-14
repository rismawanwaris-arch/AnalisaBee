import { describe, expect, it } from "vitest";
import { parsePurchaseText, parseFlexibleDate } from "./parsePurchases";

describe("parseFlexibleDate", () => {
  it("converts Excel serial number 46266 to 2026-09-01", () => {
    const d = parseFlexibleDate(46266);
    expect(d).not.toBeNull();
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("converts Excel serial string '46266.0' to 2026-09-01", () => {
    const d = parseFlexibleDate("46266.0");
    expect(d).not.toBeNull();
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("converts standard ISO date string", () => {
    const d = parseFlexibleDate("2026-09-01");
    expect(d).not.toBeNull();
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("converts DD/MM/YYYY date string", () => {
    const d = parseFlexibleDate("01/09/2026");
    expect(d).not.toBeNull();
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});

describe("parsePurchaseText", () => {
  const sampleCsv = `Mata Uang,No Faktur,Tanggal,Faktur Ref,Cabang,Vendor,Subtotal,Pajak,Diskon,Lain Lain,Total,No Detail,Kode Item,Nama Item,Qty,Satuan,Disc,Tax,Harga,Subtotal Item
Rupiah,BL00007543,46266.0,,ALFA 1 CELL,PETSHOP PADASUKA,2947153.0,0.0,0.0,0.0,2947153.0,1.0,002019,PASIR FORCATS 5 L,8.0,PCS,,,23750.0,190000.0
Rupiah,BL00007543,46266.0,,ALFA 1 CELL,PETSHOP PADASUKA,2947153.0,0.0,0.0,0.0,2947153.0,2.0,002699,LIFE CAT CAN KITTEN SALMON 400 GR,5.0,PCS,,,12699.0,63495.0
Rupiah,BL00007584,46275.0,,ALFA 1 CELL,PETSHOP PADASUKA,824950.0,0.0,0.0,0.0,824950.0,1.0,001179,BOLT IKAN 800 GR,50.0,PCS,,,16499.0,824950.0`;

  it("groups items correctly by No Faktur and parses numbers and dates", () => {
    const res = parsePurchaseText(sampleCsv);
    expect(res.errors).toHaveLength(0);
    expect(res.invoices).toHaveLength(2);

    const inv1 = res.invoices.find((i) => i.invoiceNumber === "BL00007543");
    expect(inv1).toBeDefined();
    expect(inv1?.vendor).toBe("PETSHOP PADASUKA");
    expect(inv1?.outletName).toBe("ALFA 1 CELL");
    expect(inv1?.date.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(inv1?.total).toBe(2947153);
    expect(inv1?.items).toHaveLength(2);
    expect(inv1?.items[0].itemName).toBe("PASIR FORCATS 5 L");
    expect(inv1?.items[0].qty).toBe(8);
    expect(inv1?.items[0].subtotal).toBe(190000);

    const inv2 = res.invoices.find((i) => i.invoiceNumber === "BL00007584");
    expect(inv2).toBeDefined();
    expect(inv2?.items).toHaveLength(1);
    expect(inv2?.items[0].qty).toBe(50);
  });
});
