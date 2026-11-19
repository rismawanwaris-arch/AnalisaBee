import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("../lib/prisma", () => ({
  prisma: {},
}));

import { isAllowedMutationOrigin } from "./middleware";
import { isValidExcelBuffer } from "./uploads";

describe("CSRF & Origin guard: isAllowedMutationOrigin", () => {
  it("allows safe read methods and non-API paths", () => {
    expect(isAllowedMutationOrigin({ method: "GET", path: "/api/outlets", origin: "https://evil.example", host: "app.local" })).toBe(true);
    expect(isAllowedMutationOrigin({ method: "HEAD", path: "/api/auth/me", secFetchSite: "cross-site" })).toBe(true);
    expect(isAllowedMutationOrigin({ method: "POST", path: "/non-api", origin: "https://evil.example" })).toBe(true);
  });

  it("rejects Sec-Fetch-Site: cross-site on API mutations", () => {
    expect(
      isAllowedMutationOrigin({
        method: "POST",
        path: "/api/auth/login",
        origin: "https://app.local",
        host: "app.local",
        secFetchSite: "cross-site",
      })
    ).toBe(false);
  });

  it("allows same-origin mutations and blocks cross-origin mutations in production", () => {
    expect(
      isAllowedMutationOrigin({
        method: "POST",
        path: "/api/users",
        origin: "https://analisabee.ts.net:8080",
        host: "analisabee.ts.net:8080",
        secFetchSite: "same-origin",
        nodeEnv: "production",
      })
    ).toBe(true);

    expect(
      isAllowedMutationOrigin({
        method: "DELETE",
        path: "/api/users/2",
        origin: "http://localhost:5173",
        host: "analisabee.ts.net:8080",
        nodeEnv: "production",
      })
    ).toBe(false);

    expect(
      isAllowedMutationOrigin({
        method: "POST",
        path: "/api/auth/login",
        origin: "https://attacker.example",
        host: "analisabee.ts.net:8080",
        nodeEnv: "production",
      })
    ).toBe(false);
  });

  it("allows localhost origins only outside production", () => {
    expect(
      isAllowedMutationOrigin({
        method: "POST",
        path: "/api/auth/login",
        origin: "http://localhost:5173",
        host: "localhost:3001",
        nodeEnv: "development",
      })
    ).toBe(true);
  });
});

describe("Excel magic-byte validation: isValidExcelBuffer", () => {
  it("accepts real .xlsx PKZIP archives and rejects fake .xlsx payloads", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["A", "B"], [1, 2]]), "Sheet1");
    const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(isValidExcelBuffer(xlsxBuf, "report.xlsx")).toBe(true);
    expect(isValidExcelBuffer(Buffer.from("<html><script>alert(1)</script></html>"), "fake.xlsx")).toBe(false);
    expect(isValidExcelBuffer(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]), "elf.xlsx")).toBe(false);
  });

  it("accepts OLE2 .xls, XML/HTML table .xls, and TSV .xls while rejecting binaries and scripts", () => {
    const ole2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    expect(isValidExcelBuffer(ole2, "legacy.xls")).toBe(true);
    expect(isValidExcelBuffer(Buffer.from("<html><table><tr><td>1</td></tr></table></html>"), "pos.xls")).toBe(true);
    expect(isValidExcelBuffer(Buffer.from('<?xml version="1.0"?><Workbook></Workbook>'), "pos.xls")).toBe(true);
    expect(isValidExcelBuffer(Buffer.from("Nama\tNilai\nOutlet A\t1000"), "server.xls")).toBe(true);

    expect(isValidExcelBuffer(Buffer.from("<html><script>fetch('evil')</script><table></table></html>"), "xss.xls")).toBe(false);
    expect(isValidExcelBuffer(Buffer.from('<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe "1">]>'), "xxe.xls")).toBe(false);
    expect(isValidExcelBuffer(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01]), "elf.xls")).toBe(false);
  });
});
