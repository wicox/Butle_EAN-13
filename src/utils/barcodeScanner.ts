import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
} from '@zxing/library';
import type { ContainerType } from '../types/bottle';
import { autoFixEan13, validateEan13 } from './ean13';

export interface BarcodeScanResult {
  ean13: string;
  source: 'local' | 'ai';
  confidence?: string;
  containerType?: ContainerType;
  detectedName?: string;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się załadować obrazu do skanowania.'));
    img.src = dataUrl;
  });
}

function tryDecodeCanvasWithZxing(canvas: HTMLCanvasElement): string | null {
  try {
    const reader = new MultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.EAN_8,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);

    const luminance = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
    const result = reader.decode(bitmap);
    const raw = result.getText().replace(/\D/g, '');
    if (raw.length === 13) return raw;
    if (raw.length === 12) return autoFixEan13(`0${raw}`);
    return raw || null;
  } catch {
    return null;
  }
}

async function scanLocally(imageDataUrl: string): Promise<string | null> {
  const img = await loadImageElement(imageDataUrl);

  // 1. Try native BarcodeDetector if available
  if ('BarcodeDetector' in window) {
    try {
      const Detector = (window as unknown as {
        BarcodeDetector: new (opts?: { formats: string[] }) => {
          detect: (img: HTMLImageElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;
      const detector = new Detector({ formats: ['ean_13', 'upc_a', 'ean_8'] });
      const results = await detector.detect(img);
      for (const r of results) {
        const digits = r.rawValue.replace(/\D/g, '');
        if (digits.length === 13 && validateEan13(digits).valid) {
          return digits;
        }
        if (digits.length === 12) {
          const candidate = `0${digits}`;
          if (validateEan13(candidate).valid) return candidate;
        }
      }
    } catch {
      // Ignore native detector failures and continue to ZXing
    }
  }

  // 2. Try ZXing across 0°, 90°, 180°, 270° rotations (bottle barcodes are often vertical!)
  const maxDim = 1400;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  for (const angleDeg of [0, 90, 270, 180]) {
    const canvas = document.createElement('canvas');
    const rotated = angleDeg === 90 || angleDeg === 270;
    canvas.width = rotated ? h : w;
    canvas.height = rotated ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    const decoded = tryDecodeCanvasWithZxing(canvas);
    if (decoded && decoded.length === 13) {
      return decoded;
    }
  }

  return null;
}

/**
 * Attempts fast client-side barcode decoding (BarcodeDetector + ZXing 4-orientation),
 * then falls back to server-side Gemini Vision (/api/scan-barcode) for curved or difficult bottle labels.
 */
export async function scanBarcodeFromPhoto(
  imageDataUrl: string,
  preferAi = false
): Promise<BarcodeScanResult> {
  if (!preferAi) {
    const localDigits = await scanLocally(imageDataUrl);
    if (localDigits && validateEan13(localDigits).valid) {
      return {
        ean13: localDigits,
        source: 'local',
        confidence: 'high',
      };
    }
  }

  const response = await fetch('/api/scan-barcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });

  const payload = (await response.json()) as {
    ean13?: string;
    confidence?: string;
    containerType?: ContainerType;
    detectedName?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Błąd odczytu kodu kreskowego z obrazu.');
  }

  const digits = (payload.ean13 ?? '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Nie znaleziono czytelnego kodu EAN-13 na tym zdjęciu. Spróbuj ostrzejszego zdjęcia lub wpisz kod ręcznie.');
  }

  const normalized = digits.length === 12 ? `0${digits}` : digits.slice(0, 13);

  return {
    ean13: normalized,
    source: 'ai',
    confidence: payload.confidence,
    containerType: payload.containerType,
    detectedName: payload.detectedName,
  };
}
