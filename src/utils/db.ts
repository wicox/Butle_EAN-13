import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  clampBarcodeWidthCm,
  clampExportQuantity,
  DEFAULT_BARCODE_WIDTH_CM,
  DEFAULT_PX_PER_CM,
  type AppSettings,
  type BottleRecord,
} from '../types/bottle';

interface BottleDatabaseSchema extends DBSchema {
  bottles: {
    key: string;
    value: BottleRecord;
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'baza-butelek-ean13-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BottleDatabaseSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<BottleDatabaseSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('bottles')) {
          db.createObjectStore('bottles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllBottles(): Promise<BottleRecord[]> {
  const db = await getDb();
  const rows = await db.getAll('bottles');
  return rows
    .map((row) => ({
      ...row,
      exportQuantity: clampExportQuantity(row.exportQuantity ?? 1),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveBottle(record: BottleRecord): Promise<void> {
  const db = await getDb();
  await db.put('bottles', record);
}

export async function saveAllBottles(records: BottleRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('bottles', 'readwrite');
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
}

export async function deleteBottleById(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('bottles', id);
}

export async function loadAppSettings(): Promise<AppSettings> {
  const db = await getDb();
  const widthEntry = await db.get('settings', 'barcodeWidthCm');
  const pxEntry = await db.get('settings', 'pxPerCmCalibration');

  return {
    barcodeWidthCm:
      typeof widthEntry?.value === 'number'
        ? clampBarcodeWidthCm(widthEntry.value)
        : DEFAULT_BARCODE_WIDTH_CM,
    pxPerCmCalibration:
      typeof pxEntry?.value === 'number' && pxEntry.value >= 20 && pxEntry.value <= 80
        ? pxEntry.value
        : DEFAULT_PX_PER_CM,
  };
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const db = await getDb();
  if (settings.barcodeWidthCm !== undefined) {
    await db.put('settings', {
      key: 'barcodeWidthCm',
      value: clampBarcodeWidthCm(settings.barcodeWidthCm),
    });
  }
  if (settings.pxPerCmCalibration !== undefined) {
    await db.put('settings', {
      key: 'pxPerCmCalibration',
      value: settings.pxPerCmCalibration,
    });
  }
}
