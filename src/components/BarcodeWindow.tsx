import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Ruler,
  Scissors,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  clampBarcodeWidthCm,
  DEFAULT_PX_PER_CM,
  formatDimensionsLabel,
  MAX_BARCODE_WIDTH_CM,
  MIN_BARCODE_WIDTH_CM,
  type BottleRecord,
} from '../types/bottle';
import {
  EAN13_QUIET_LEFT_MODULES,
  EAN13_TOTAL_MODULES,
  renderEan13ToPng,
  validateEan13,
} from '../utils/ean13';
import { Ean13Svg } from './Ean13Svg';

interface BarcodeWindowProps {
  activeBottle: BottleRecord | null;
  allBottles: BottleRecord[];
  barcodeWidthCm: number;
  pxPerCmCalibration: number;
  onChangeBarcodeWidthCm: (cm: number) => void;
  onChangePxPerCm: (px: number) => void;
  onExportWord: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

/**
 * Calibrated millimeter ruler aligned strictly to the 95 bar modules (first bar to last bar).
 */
const CalibratedRuler: React.FC<{
  barWidthCm: number;
  barWidthPx: number;
}> = ({ barWidthCm, barWidthPx }) => {
  const totalWidthPx = barWidthPx * (EAN13_TOTAL_MODULES / 95);
  const firstBarOffsetPx = barWidthPx * (EAN13_QUIET_LEFT_MODULES / 95);
  const rulerTotalCm = 3.2; // 32 mm ruler track
  const pxPerMm = barWidthPx / (barWidthCm * 10);
  const rulerWidthPx = rulerTotalCm * 10 * pxPerMm;

  const ticks: Array<{ mm: number; major: boolean; half: boolean }> = [];
  for (let mm = 0; mm <= 32; mm++) {
    ticks.push({
      mm,
      major: mm % 10 === 0,
      half: mm % 5 === 0 && mm % 10 !== 0,
    });
  }

  return (
    <div className="mt-2 select-none" style={{ width: Math.max(totalWidthPx, firstBarOffsetPx + rulerWidthPx) }}>
      {/* Dimension span bracket from first bar to last bar */}
      <div className="relative h-6" style={{ width: totalWidthPx }}>
        <div
          className="absolute top-0 bottom-0 border-l-2 border-r-2 border-blue-700"
          style={{
            left: `${firstBarOffsetPx}px`,
            width: `${barWidthPx}px`,
          }}
        >
          <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-700" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-1.5 font-mono text-[11px] font-semibold text-blue-700 tabular-nums whitespace-nowrap">
            {barWidthCm.toFixed(2)} cm
          </span>
        </div>
      </div>

      {/* Physical centimeter & millimeter scale starting exactly at the first bar (0.0 cm) */}
      <div
        className="relative mt-1 border-t border-slate-400 bg-slate-50/90 pt-1 pb-2"
        style={{
          marginLeft: `${firstBarOffsetPx}px`,
          width: `${rulerWidthPx}px`,
        }}
      >
        {/* Highlighted active span from 2.70 to 3.00 cm */}
        <div
          className="absolute top-0 h-1.5 bg-blue-200/80"
          style={{
            left: `${27 * pxPerMm}px`,
            width: `${3 * pxPerMm}px`,
          }}
          title="Dozwolony zakres: 2,70 – 3,00 cm"
        />

        <div className="relative h-7">
          {ticks.map((t) => (
            <div
              key={t.mm}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${t.mm * pxPerMm}px`, transform: 'translateX(-50%)' }}
            >
              <div
                className={`w-px ${
                  t.major
                    ? 'h-3.5 bg-slate-800'
                    : t.half
                      ? 'h-2.5 bg-slate-600'
                      : 'h-1.5 bg-slate-400'
                }`}
              />
              {t.major && (
                <span className="mt-0.5 font-mono text-[10px] font-semibold text-slate-700 tabular-nums">
                  {t.mm / 10} cm
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BarcodeWindow: React.FC<BarcodeWindowProps> = ({
  activeBottle,
  allBottles,
  barcodeWidthCm,
  pxPerCmCalibration,
  onChangeBarcodeWidthCm,
  onChangePxPerCm,
  onExportWord,
  onExportPdf,
}) => {
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [expandedWindow, setExpandedWindow] = useState(false);

  const selectedValidBottles = allBottles.filter(
    (b) => b.selected && validateEan13(b.ean13).valid
  );

  const activeValid = activeBottle ? validateEan13(activeBottle.ean13).valid : false;

  // Screen preview pixel width for bar-to-bar span (scaled for comfortable visibility while keeping ruler aligned 1:1)
  const barWidthPx = barcodeWidthCm * pxPerCmCalibration;
  const zoomedBarWidthPx = barWidthPx * 1.65;

  const handleDownloadPng = async () => {
    if (!activeBottle || !activeValid) return;
    const img = await renderEan13ToPng(activeBottle.ean13, barcodeWidthCm, { modulePx: 8 });
    saveAs(img.blob, `ean13-${activeBottle.ean13}-${barcodeWidthCm.toFixed(2)}cm.png`);
  };

  const handleWordClick = async () => {
    setExportingWord(true);
    try {
      await onExportWord();
    } finally {
      setExportingWord(false);
    }
  };

  const handlePdfClick = async () => {
    setExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setExportingPdf(false);
    }
  };

  const activeDims = activeBottle
    ? formatDimensionsLabel(activeBottle.diameterMm, activeBottle.lengthMm, false)
    : 'Brak wymiarów';

  return (
    <>
      <aside className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Window Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Okno kodu EAN-13 i linijka
            </h2>
            <p className="text-xs text-slate-500">
              Odtworzony kod kreskowy w skali rzeczywistej
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpandedWindow(true)}
            disabled={!activeValid}
            title="Otwórz powiększone okno podglądu"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Powiększ
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cut-out Cell Preview + Regenerated Barcode + Aligned Ruler */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Scissors className="h-3.5 w-3.5 text-slate-500" />
                Podgląd komórki tabeli do wycinania
              </span>
              <span className="font-mono tabular-nums">
                {barcodeWidthCm.toFixed(2)} cm
              </span>
            </div>

            <div className="flex flex-col items-center overflow-x-auto rounded-lg border-2 border-dashed border-slate-400 bg-white px-4 py-4">
              {activeBottle ? (
                <>
                  <div className="mb-2 text-center">
                    <div className="text-xs font-bold text-slate-900 tabular-nums">
                      {activeDims}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {activeBottle.name.trim()
                        ? `${activeBottle.name.trim()} (${activeBottle.containerType === 'can' ? 'Puszka' : 'Butelka'})`
                        : activeBottle.containerType === 'can'
                          ? 'Puszka'
                          : 'Butelka'}
                    </div>
                  </div>

                  <Ean13Svg code={activeBottle.ean13} barWidthPx={barWidthPx} />

                  {activeValid && (
                    <CalibratedRuler
                      barWidthCm={barcodeWidthCm}
                      barWidthPx={barWidthPx}
                    />
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Wybierz lub dodaj opakowanie, aby zobaczyć odtworzony kod EAN-13.
                </div>
              )}
            </div>
          </div>

          {/* Ruler Width Controls (2.70 cm – 3.00 cm) */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ruler-slider"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <Ruler className="h-3.5 w-3.5 text-blue-700" />
                Szerokość kodu (od 1. do ostatniej kreski)
              </label>
              <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                {barcodeWidthCm.toFixed(2)} cm
              </span>
            </div>

            <input
              id="ruler-slider"
              type="range"
              min={MIN_BARCODE_WIDTH_CM}
              max={MAX_BARCODE_WIDTH_CM}
              step={0.01}
              value={barcodeWidthCm}
              onChange={(e) =>
                onChangeBarcodeWidthCm(clampBarcodeWidthCm(parseFloat(e.target.value)))
              }
              className="w-full accent-blue-700 cursor-pointer"
            />

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
              <span>Min: 2,70 cm</span>
              <span>Środek: 2,85 cm</span>
              <span>Maks: 3,00 cm</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {[2.7, 2.8, 2.85, 2.9, 3.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChangeBarcodeWidthCm(preset)}
                    className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-xs tabular-nums transition-colors ${
                      Math.abs(barcodeWidthCm - preset) < 0.005
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset.toFixed(2)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowCalibration((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Kalibracja ekranu
              </button>
            </div>

            {showCalibration && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Skala podglądu na monitorze (px/cm)
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangePxPerCm(DEFAULT_PX_PER_CM)}
                    className="cursor-pointer text-blue-700 hover:underline"
                  >
                    Resetuj (96 DPI)
                  </button>
                </div>
                <input
                  type="range"
                  min={28}
                  max={56}
                  step={0.5}
                  value={pxPerCmCalibration}
                  onChange={(e) => onChangePxPerCm(parseFloat(e.target.value))}
                  className="w-full accent-slate-700 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Przyłóż fizyczną linijkę do ekranu i dopasuj podziałkę, aby podgląd 1:1
                  odpowiadał rzeczywistości. Eksport Word i PDF zawsze zapisuje dokładne
                  centymetry ({barcodeWidthCm.toFixed(2)} cm) niezależnie od skali monitora.
                </p>
              </div>
            )}
          </div>

          {/* Export Buttons (Word, PDF, PNG) */}
          <div className="space-y-2.5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Zaznaczone poprawne kody do tabeli:</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {selectedValidBottles.length} szt.
              </span>
            </div>

            <button
              type="button"
              disabled={exportingWord || selectedValidBottles.length === 0}
              onClick={handleWordClick}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportingWord
                ? 'Generowanie pliku Word...'
                : `Eksportuj zaznaczone do Word (.docx)`}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={exportingPdf || selectedValidBottles.length === 0}
                onClick={handlePdfClick}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5" />
                {exportingPdf ? 'Generowanie...' : 'Eksportuj PDF (.pdf)'}
              </button>

              <button
                type="button"
                disabled={!activeValid}
                onClick={handleDownloadPng}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Pobierz PNG
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Optional zoomed inspection window modal */}
      {expandedWindow && activeBottle && activeValid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setExpandedWindow(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Powiększony podgląd kodu EAN-13
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {activeDims} · Szerokość eksportu (od 1. do ostatniej kreski):{' '}
                  {barcodeWidthCm.toFixed(2)} cm
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedWindow(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center overflow-x-auto rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="mb-3 text-center">
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  {activeDims}
                </div>
                {activeBottle.name.trim() && (
                  <div className="text-xs text-slate-500">{activeBottle.name.trim()}</div>
                )}
              </div>
              <Ean13Svg code={activeBottle.ean13} barWidthPx={zoomedBarWidthPx} />
              <CalibratedRuler
                barWidthCm={barcodeWidthCm}
                barWidthPx={zoomedBarWidthPx}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Pobierz PNG
              </button>
              <button
                type="button"
                onClick={() => setExpandedWindow(false)}
                className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
