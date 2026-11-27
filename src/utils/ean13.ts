import { clampBarcodeWidthCm } from '../types/bottle';

const L_CODES = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
] as const;

const G_CODES = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
] as const;

const R_CODES = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
] as const;

const PARITY_PATTERNS = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
] as const;

export const EAN13_BAR_MODULES = 95;
export const EAN13_QUIET_LEFT_MODULES = 11;
export const EAN13_QUIET_RIGHT_MODULES = 7;
export const EAN13_TOTAL_MODULES =
  EAN13_QUIET_LEFT_MODULES + EAN13_BAR_MODULES + EAN13_QUIET_RIGHT_MODULES; // 113

export function computeEan13CheckDigit(first12: string): number {
  const digits = first12.replace(/\D/g, '');
  if (digits.length !== 12) {
    throw new Error('Wymagane dokładnie 12 pierwszych cyfr do obliczenia sumy kontrolnej EAN-13.');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export interface Ean13ValidationResult {
  valid: boolean;
  normalized: string;
  expectedCheckDigit: number | null;
  error?: string;
}

export function validateEan13(raw: string): Ean13ValidationResult {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) {
    return {
      valid: false,
      normalized: '',
      expectedCheckDigit: null,
      error: 'Wprowadź 13-cyfrowy kod EAN-13 lub odczytaj go ze zdjęcia.',
    };
  }
  if (digits.length < 12) {
    return {
      valid: false,
      normalized: digits,
      expectedCheckDigit: null,
      error: `Kod ma ${digits.length} cyfr (wymagane 13 cyfr).`,
    };
  }
  if (digits.length === 12) {
    const check = computeEan13CheckDigit(digits);
    return {
      valid: false,
      normalized: digits,
      expectedCheckDigit: check,
      error: `Brak 13. cyfry kontrolnej (sugerowana: ${check}).`,
    };
  }
  const code13 = digits.slice(0, 13);
  const expected = computeEan13CheckDigit(code13.slice(0, 12));
  const actual = Number(code13[12]);
  if (actual !== expected) {
    return {
      valid: false,
      normalized: code13,
      expectedCheckDigit: expected,
      error: `Nieprawidłowa cyfra kontrolna: wpisano ${actual}, powinno być ${expected}.`,
    };
  }
  return {
    valid: true,
    normalized: code13,
    expectedCheckDigit: expected,
  };
}

export function autoFixEan13(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 12) {
    const padded = digits.padStart(12, '0');
    return padded + String(computeEan13CheckDigit(padded));
  }
  const first12 = digits.slice(0, 12);
  return first12 + String(computeEan13CheckDigit(first12));
}

export interface EncodedEan13 {
  code: string;
  modules: (0 | 1)[]; // length 95: strictly from first black bar (0) to last black bar (94)
  isGuard: boolean[]; // length 95
}

export function encodeEan13Modules(code13: string): EncodedEan13 {
  const validation = validateEan13(code13);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Nieprawidłowy kod EAN-13');
  }
  const code = validation.normalized;
  const firstDigit = Number(code[0]);
  const parity = PARITY_PATTERNS[firstDigit];

  const bits: (0 | 1)[] = [];
  const guard: boolean[] = [];

  const pushPattern = (pattern: string, guardFlag: boolean) => {
    for (let i = 0; i < pattern.length; i++) {
      bits.push(pattern[i] === '1' ? 1 : 0);
      guard.push(guardFlag);
    }
  };

  // Left guard: 101 (3 modules)
  pushPattern('101', true);

  // Left 6 digits: d1..d6 (42 modules)
  for (let i = 1; i <= 6; i++) {
    const digit = Number(code[i]);
    const enc = parity[i - 1] === 'L' ? L_CODES[digit] : G_CODES[digit];
    pushPattern(enc, false);
  }

  // Center guard: 01010 (5 modules)
  pushPattern('01010', true);

  // Right 6 digits: d7..d12 (42 modules)
  for (let i = 7; i <= 12; i++) {
    const digit = Number(code[i]);
    pushPattern(R_CODES[digit], false);
  }

  // Right guard: 101 (3 modules)
  pushPattern('101', true);

  return {
    code,
    modules: bits,
    isGuard: guard,
  };
}

export interface RenderedEan13Image {
  dataUrl: string;
  blob: Blob;
  barWidthCm: number; // Exact physical width from first bar to last bar (2.70..3.00 cm)
  totalWidthCm: number; // Including quiet zones
  totalHeightCm: number;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Renders a razor-sharp EAN-13 PNG where the distance from the FIRST black bar
 * to the LAST black bar equals exactly `barWidthCm` (2.70–3.00 cm).
 */
export async function renderEan13ToPng(
  code13: string,
  barWidthCmInput: number,
  options?: { modulePx?: number }
): Promise<RenderedEan13Image> {
  const encoded = encodeEan13Modules(code13);
  const barWidthCm = clampBarcodeWidthCm(barWidthCmInput);

  // Use integer pixels per module (e.g. 8 px/module -> ~904 px wide, >700 DPI at 2.85 cm)
  // so every single bar edge lands on an exact pixel boundary with zero blur!
  const modulePx = options?.modulePx ?? 8;
  const totalWidthPx = EAN13_TOTAL_MODULES * modulePx;

  // GS1 standard aspect ratio relative to 95-module symbol width:
  // Regular bar height ~ 0.60 * barSpan, guard extension ~ 0.08 * barSpan, text area ~ 0.14 * barSpan
  const barSpanPx = EAN13_BAR_MODULES * modulePx;
  const topMarginPx = Math.round(modulePx * 2.5);
  const regularBarHeightPx = Math.round(barSpanPx * 0.56);
  const guardExtensionPx = Math.round(modulePx * 5);
  const digitBandHeightPx = Math.round(modulePx * 11);
  const totalHeightPx = topMarginPx + regularBarHeightPx + guardExtensionPx + digitBandHeightPx;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidthPx;
  canvas.height = totalHeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nie można utworzyć kontekstu Canvas 2D.');
  }

  // Crisp white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidthPx, totalHeightPx);

  // Draw bars strictly from quietLeft offset
  ctx.fillStyle = '#000000';
  const startX = EAN13_QUIET_LEFT_MODULES * modulePx;
  for (let i = 0; i < encoded.modules.length; i++) {
    if (encoded.modules[i] === 1) {
      const h = encoded.isGuard[i]
        ? regularBarHeightPx + guardExtensionPx
        : regularBarHeightPx;
      ctx.fillRect(startX + i * modulePx, topMarginPx, modulePx, h);
    }
  }

  // Draw human-readable digits underneath ("linie + cyfry na dole – tak jak na butelce")
  const fontSizePx = Math.round(modulePx * 9.5);
  ctx.font = `600 ${fontSizePx}px "JetBrains Mono", "OCR B", "Courier New", monospace`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  const textY = topMarginPx + regularBarHeightPx + Math.round(modulePx * 2.2);

  // First digit in left quiet zone
  const firstDigitX = (EAN13_QUIET_LEFT_MODULES * 0.52) * modulePx;
  ctx.fillText(encoded.code[0], firstDigitX, textY);

  // Left 6 digits (modules 3..45)
  const leftGroupStartPx = startX + 3 * modulePx;
  const digitWidthPx = 7 * modulePx;
  for (let i = 0; i < 6; i++) {
    const cx = leftGroupStartPx + i * digitWidthPx + digitWidthPx / 2;
    ctx.fillText(encoded.code[1 + i], cx, textY);
  }

  // Right 6 digits (modules 50..92)
  const rightGroupStartPx = startX + 50 * modulePx;
  for (let i = 0; i < 6; i++) {
    const cx = rightGroupStartPx + i * digitWidthPx + digitWidthPx / 2;
    ctx.fillText(encoded.code[7 + i], cx, textY);
  }

  const totalWidthCm = barWidthCm * (EAN13_TOTAL_MODULES / EAN13_BAR_MODULES);
  const totalHeightCm = totalWidthCm * (totalHeightPx / totalWidthPx);
  const dataUrl = canvas.toDataURL('image/png');

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Nie udało się wygenerować pliku PNG dla kodu kreskowego.'));
    }, 'image/png');
  });

  return {
    dataUrl,
    blob,
    barWidthCm,
    totalWidthCm,
    totalHeightCm,
    pixelWidth: totalWidthPx,
    pixelHeight: totalHeightPx,
  };
}
