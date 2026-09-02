// Default "Daftar Point Penjualan Accessories" rules. `pattern` is matched as
// a case-insensitive substring against Sale.item.name, so it deliberately
// stays short (product family, no color/size suffix) to cover every variant
// of that product the POS system might record.
export const DEFAULT_ITEM_POINTS: { pattern: string; points: number }[] = [
  { pattern: "Batok UI ME PC08 USB Type C", points: 50 },
  { pattern: "Batok Rapa CH7013 POWER ION 45W", points: 50 },
  { pattern: "TWS UFONE EB04", points: 50 },
  { pattern: "Charger UI ME PC01-CL", points: 50 },
  { pattern: "Kabel Data UI ME DCP05-CC", points: 50 },
  { pattern: "Power Bank Robot RT102", points: 30 },
  { pattern: "TWS UFONE EB05", points: 30 },
  { pattern: "Charger Minimo CGP02-CC", points: 30 },
  { pattern: "Car Holder UFONE CH02", points: 30 },
  { pattern: "TWS Robot Enco Buds 4", points: 20 },
  { pattern: "TWS Robot Airbuds T70E", points: 20 },
  { pattern: "Charger Ufone PC09", points: 20 },
  { pattern: "Car Charger Minimo MSF02", points: 20 },
  { pattern: "TWS UFONE EB01", points: 20 },
  { pattern: "Speaker Ichiko SZ1214", points: 15 },
  { pattern: "Kabel Data Vivan VZCC100", points: 15 },
  { pattern: "Charger Minimo CGP02-CL", points: 15 },
  { pattern: "Speaker Ichiko SZ1213", points: 15 },
  { pattern: "Charger Robot RT-A20C L C TO L", points: 15 },
  { pattern: "Kabel Data Vivan VSCC100", points: 15 },
  { pattern: "Kabel Data UI ME DCP01-L", points: 15 },
  { pattern: "Charger UI ME PC01-CC", points: 15 },
  { pattern: "Kabel Data Vivan VDCC100", points: 10 },
  { pattern: "Batok VIVAN POWER ICE 20W", points: 10 },
  { pattern: "HF Robot REC10E Type C", points: 10 },
  { pattern: "Batok Rapa CH1060 POWER II C TO C", points: 10 },
  { pattern: "Charger Robot RT-GC20-C", points: 10 },
  { pattern: "Charger Robot RT-A20C C TO C", points: 10 },
  { pattern: "Power Bank Ufone BP01", points: 10 },
  { pattern: "Speaker DPUS 5W SZ-8831", points: 10 },
  { pattern: "Kabel Data ufone CB02-M", points: 10 },
  { pattern: "Kabel Data ufone CB01-M", points: 10 },
  { pattern: "Kabel Data ufone CB02-C", points: 10 },
  { pattern: "Kabel Data ufone CB01-C", points: 10 },
  { pattern: "Kabel Data ufone CB02-L", points: 10 },
  { pattern: "Kabel Data ufone CB01-L", points: 10 },
  { pattern: "Kabel Data ufone CB02-CL", points: 10 },
  { pattern: "Kabel Data ufone CB01-CL", points: 10 },
  { pattern: "Kabel Data ufone CB02-CC", points: 10 },
  { pattern: "Kabel Data ufone CB01-CC", points: 10 },
  { pattern: "Kabel UI ME FLEX DCG01-C", points: 10 },
  { pattern: "Kabel UI ME FLEX DCG01-L", points: 10 },
  { pattern: "Kabel UI ME FLEX DCG01-M", points: 10 },
  { pattern: "Kabel UI ME DCG01-CC 60W", points: 10 },
  { pattern: "Kabel Data UI ME DCG01-CC 60W", points: 10 },
];

// Fallback for AKSESORIS items with no explicit rule above — the
// "UNTUK ACC YANG TIDAK ADA DI TABLE ATAS TETAP DAPAT POIN (5)" note.
export const DEFAULT_GROUP_POINTS: { itemGroup: string; points: number }[] = [
  { itemGroup: "ACC CAMPURAN NEW", points: 5 },
  { itemGroup: "ACC CAMPURAN LAMA", points: 5 },
];
