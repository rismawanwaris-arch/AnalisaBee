// Multer upload configs shared by any router that accepts a file — kept
// separate from middleware.ts since these are upload-specific, not general
// request handling.
import type express from "express";
import multer from "multer";
import path from "node:path";

const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EMPTY_ARCHIVE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

/** Validates Excel magic bytes (or safe POS XML/HTML/TSV exports saved as .xls) before parsing. */
export function isValidExcelBuffer(buffer: Buffer, originalname: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  const ext = path.extname(originalname).toLowerCase();

  if (ext === ".xlsx") {
    return (
      buffer.subarray(0, 4).equals(ZIP_LOCAL_HEADER) ||
      buffer.subarray(0, 4).equals(ZIP_EMPTY_ARCHIVE)
    );
  }

  if (ext === ".xls") {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE2_MAGIC)) {
      return true;
    }

    const head = buffer.subarray(0, Math.min(buffer.length, 4096));
    const hasUtf16Bom =
      (head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff);
    if (!hasUtf16Bom && head.includes(0x00)) {
      return false;
    }

    let text: string;
    if (head[0] === 0xff && head[1] === 0xfe) {
      text = head.subarray(2).toString("utf16le");
    } else if (head[0] === 0xfe && head[1] === 0xff) {
      const len = head.length - 2;
      const evenLen = len - (len % 2);
      const swapped = Buffer.from(head.subarray(2, 2 + evenLen));
      swapped.swap16();
      text = swapped.toString("utf16le");
    } else {
      text = head.toString("utf8").replace(/^\uFEFF/, "");
    }

    const trimmed = text.trimStart().toLowerCase();
    if (!trimmed) return false;
    if (/^(#!|%pdf-|gif8)/.test(trimmed)) return false;
    if (trimmed.includes("<!entity") || /<script[\s>]/i.test(trimmed)) return false;

    return (
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<workbook") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<!doctype html") ||
      trimmed.startsWith("<table") ||
      trimmed.startsWith("<tr") ||
      trimmed.startsWith("id;") ||
      /[\t,;]/.test(text)
    );
  }

  return false;
}

export function validateExcelUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.file) return next();
  if (!isValidExcelBuffer(req.file.buffer, req.file.originalname)) {
    return res.status(400).json({ error: "Isi file tidak valid atau bukan file Excel (.xls/.xlsx) yang sah." });
  }
  next();
}

// Excel imports (sales, master item, Tarik Tunai, Server) — validate file
// type server-side, consistent 25MB limit with the frontend.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xls" || ext === ".xlsx") return cb(null, true);
    cb(new Error("Format file tidak didukung. Gunakan .xls atau .xlsx."));
  },
});

// Backup restores: JSON, not spreadsheets, and a much higher size cap since a
// full sales-history dump can run into the tens of MB.
export const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".json") return cb(null, true);
    cb(new Error("Format file tidak didukung. Gunakan file .json hasil backup."));
  },
});
