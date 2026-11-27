import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  clampBarcodeWidthCm,
  clampExportQuantity,
  DEFAULT_BARCODE_WIDTH_CM,
  type AppSettings,
  type BottleRecord,
} from '../types/bottle';

interface ZipDatabaseManifest {
  schemaVersion: number;
  exportedAt: string;
  barcodeWidthCm: number;
  items: Array<Omit<BottleRecord, 'photoDataUrl'>>;
}

function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
  if (!match) return 'jpg';
  const raw = match[1].toLowerCase();
  if (raw === 'jpeg') return 'jpg';
  if (raw === 'svg+xml') return 'svg';
  return raw;
}

function getMimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: mimeType });
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku graficznego z archiwum ZIP.'));
    reader.readAsDataURL(blob);
  });
}

export async function exportDatabaseToZip(
  bottles: BottleRecord[],
  settings: AppSettings
): Promise<void> {
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');

  const manifestItems: Array<Omit<BottleRecord, 'photoDataUrl'>> = [];

  for (const bottle of bottles) {
    let photoFilename: string | null = null;

    if (bottle.photoDataUrl) {
      const ext = getExtensionFromDataUrl(bottle.photoDataUrl);
      photoFilename = `${bottle.id}.${ext}`;
      const bytes = dataUrlToUint8Array(bottle.photoDataUrl);
      imagesFolder?.file(photoFilename, bytes);
    }

    const { photoDataUrl: _omitted, ...rest } = bottle;
    manifestItems.push({
      ...rest,
      photoFilename,
    });
  }

  const manifest: ZipDatabaseManifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    barcodeWidthCm: clampBarcodeWidthCm(settings.barcodeWidthCm),
    items: manifestItems,
  };

  zip.file('database.json', JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(zipBlob, `baza-butelek-backup-${dateStr}.zip`);
}

export async function importDatabaseFromZip(file: File): Promise<{
  bottles: BottleRecord[];
  barcodeWidthCm: number;
}> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('database.json');
  if (!manifestFile) {
    throw new Error('Nieprawidłowe archiwum ZIP: brak pliku database.json.');
  }

  const rawJson = await manifestFile.async('string');
  const parsed = JSON.parse(rawJson) as Partial<ZipDatabaseManifest>;

  if (!Array.isArray(parsed.items)) {
    throw new Error('Nieprawidłowa struktura pliku database.json.');
  }

  const restored: BottleRecord[] = [];

  for (const item of parsed.items) {
    let photoDataUrl: string | null = null;
    if (item.photoFilename) {
      const imgEntry =
        zip.file(`images/${item.photoFilename}`) ?? zip.file(item.photoFilename);
      if (imgEntry) {
        const bytes = await imgEntry.async('uint8array');
        const mime = getMimeFromFilename(item.photoFilename);
        photoDataUrl = await uint8ArrayToDataUrl(bytes, mime);
      }
    }

    restored.push({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      name: typeof item.name === 'string' ? item.name : '',
      containerType: item.containerType === 'can' ? 'can' : 'bottle',
      diameterMm:
        typeof item.diameterMm === 'number' && Number.isFinite(item.diameterMm)
          ? item.diameterMm
          : null,
      lengthMm:
        typeof item.lengthMm === 'number' && Number.isFinite(item.lengthMm)
          ? item.lengthMm
          : null,
      ean13: typeof item.ean13 === 'string' ? item.ean13.replace(/\D/g, '').slice(0, 13) : '',
      photoDataUrl,
      photoFilename: item.photoFilename ?? null,
      selected: Boolean(item.selected),
      exportQuantity: clampExportQuantity(
        typeof item.exportQuantity === 'number' ? item.exportQuantity : 1
      ),
      notes: typeof item.notes === 'string' ? item.notes : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    });
  }

  const barcodeWidthCm =
    typeof parsed.barcodeWidthCm === 'number'
      ? clampBarcodeWidthCm(parsed.barcodeWidthCm)
      : DEFAULT_BARCODE_WIDTH_CM;

  return { bottles: restored, barcodeWidthCm };
}
