export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB is generous for a monthly export
const ALLOWED_EXTENSIONS = [".xls", ".xlsx"];

export function validateUploadedFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return "Format file tidak didukung. Gunakan .xls atau .xlsx.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File terlalu besar (maks ${MAX_FILE_BYTES / 1024 / 1024} MB).`;
  }
  return null;
}
