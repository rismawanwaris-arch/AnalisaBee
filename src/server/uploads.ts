// Multer upload configs shared by any router that accepts a file — kept
// separate from middleware.ts since these are upload-specific, not general
// request handling.
import multer from "multer";
import path from "node:path";

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
