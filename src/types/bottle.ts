export type ContainerType = 'bottle' | 'can';

export interface BottleRecord {
  id: string;
  name: string;
  containerType: ContainerType;
  diameterMm: number | null;
  lengthMm: number | null;
  ean13: string;
  photoDataUrl: string | null;
  photoFilename: string | null;
  selected: boolean;
  exportQuantity: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  barcodeWidthCm: number; // Strictly clamped to [2.70, 3.00] cm (first bar to last bar)
  pxPerCmCalibration: number; // Screen preview calibration (default 37.795 px/cm = 96 DPI)
}

export const MIN_BARCODE_WIDTH_CM = 2.7;
export const MAX_BARCODE_WIDTH_CM = 3.0;
export const DEFAULT_BARCODE_WIDTH_CM = 2.85;
export const DEFAULT_PX_PER_CM = 96 / 2.54; // 37.79527559 px/cm

export function clampBarcodeWidthCm(val: number): number {
  if (!Number.isFinite(val)) return DEFAULT_BARCODE_WIDTH_CM;
  const clamped = Math.min(MAX_BARCODE_WIDTH_CM, Math.max(MIN_BARCODE_WIDTH_CM, val));
  return Math.round(clamped * 100) / 100;
}

export function clampExportQuantity(val: number): number {
  if (!Number.isFinite(val)) return 1;
  return Math.min(999, Math.max(1, Math.floor(val)));
}

export function formatDimensionsLabel(
  diameterMm: number | null,
  lengthMm: number | null,
  verbose = false
): string {
  const hasD = diameterMm !== null && Number.isFinite(diameterMm) && diameterMm > 0;
  const hasL = lengthMm !== null && Number.isFinite(lengthMm) && lengthMm > 0;

  if (hasD && hasL) {
    return verbose
      ? `Średnica: ${diameterMm} mm × Długość: ${lengthMm} mm`
      : `Śr: ${diameterMm} mm × Dł: ${lengthMm} mm`;
  }
  if (hasD) {
    return verbose ? `Średnica: ${diameterMm} mm` : `Śr: ${diameterMm} mm`;
  }
  if (hasL) {
    return verbose ? `Długość: ${lengthMm} mm` : `Dł: ${lengthMm} mm`;
  }
  return 'Brak wymiarów';
}
