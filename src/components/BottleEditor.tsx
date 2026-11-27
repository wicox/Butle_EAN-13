import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  ScanBarcode,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type { BottleRecord, ContainerType } from '../types/bottle';
import { scanBarcodeFromPhoto } from '../utils/barcodeScanner';
import { autoFixEan13, validateEan13 } from '../utils/ean13';

interface BottleEditorProps {
  bottle: BottleRecord | null;
  onChange: (updated: BottleRecord) => void;
  onAddNew: () => void;
  onNotify: (msg: { type: 'success' | 'error' | 'info'; text: string }) => void;
}

export const BottleEditor: React.FC<BottleEditorProps> = ({
  bottle,
  onChange,
  onAddNew,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!bottle) {
    return (
      <section className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-10 text-center min-h-[540px]">
        <h2 className="text-base font-semibold text-slate-900">
          Wybierz opakowanie z listy lub dodaj nowe
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Tutaj wgrasz zdjęcie butelki lub puszki, zaczytasz kod EAN-13, dodasz lub usuniesz
          wymiary (średnica, długość) oraz zaznaczysz pozycję do wydruku w Wordzie lub PDF.
        </p>
        <button
          type="button"
          onClick={onAddNew}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          Dodaj nową butelkę / puszkę
        </button>
      </section>
    );
  }

  const updateField = <K extends keyof BottleRecord>(key: K, value: BottleRecord[K]) => {
    onChange({
      ...bottle,
      [key]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify({ type: 'error', text: 'Wybierz plik graficzny (JPG, PNG, WebP).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const nextBottle: BottleRecord = {
        ...bottle,
        photoDataUrl: dataUrl,
        photoFilename: file.name,
        updatedAt: new Date().toISOString(),
      };
      onChange(nextBottle);

      // Automatically attempt to read EAN-13 if empty
      if (!bottle.ean13) {
        setScanning(true);
        try {
          const result = await scanBarcodeFromPhoto(dataUrl, false);
          onChange({
            ...nextBottle,
            ean13: result.ean13,
            containerType: result.containerType ?? nextBottle.containerType,
            name:
              !nextBottle.name && result.detectedName
                ? result.detectedName
                : nextBottle.name,
            updatedAt: new Date().toISOString(),
          });
          onNotify({
            type: 'success',
            text: `Odczytano kod EAN-13 (${result.ean13}) i wygenerowano podgląd obok.`,
          });
        } catch (err) {
          onNotify({
            type: 'info',
            text:
              err instanceof Error
                ? `Dodano zdjęcie. ${err.message}`
                : 'Dodano zdjęcie. Wpisz kod EAN-13 ręcznie lub kliknij skanowanie ponownie.',
          });
        } finally {
          setScanning(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScanClick = async (preferAi: boolean) => {
    if (!bottle.photoDataUrl) return;
    setScanning(true);
    try {
      const result = await scanBarcodeFromPhoto(bottle.photoDataUrl, preferAi);
      onChange({
        ...bottle,
        ean13: result.ean13,
        containerType: result.containerType ?? bottle.containerType,
        name: !bottle.name && result.detectedName ? result.detectedName : bottle.name,
        updatedAt: new Date().toISOString(),
      });
      onNotify({
        type: 'success',
        text: `Kod EAN-13 odczytany (${result.source === 'ai' ? 'analiza obrazu AI' : 'dekoder lokalny'}): ${result.ean13}`,
      });
    } catch (err) {
      onNotify({
        type: 'error',
        text: err instanceof Error ? err.message : 'Nie udało się odczytać kodu ze zdjęcia.',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleRemovePhoto = () => {
    onChange({
      ...bottle,
      photoDataUrl: null,
      photoFilename: null,
      updatedAt: new Date().toISOString(),
    });
  };

  const eanValidation = validateEan13(bottle.ean13);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dane butelki / puszki
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Zdjęcie, wymiary opakowania oraz odczytany kod kreskowy EAN-13
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
          <input
            type="checkbox"
            checked={bottle.selected}
            onChange={(e) => updateField('selected', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
          />
          <span>Zaznaczony do Word / PDF</span>
        </label>
      </div>

      {/* Photo upload / preview / remove */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">
            Zdjęcie butelki / puszki z kodem kreskowym
          </label>
          {bottle.photoDataUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Usuń zdjęcie
            </button>
          )}
        </div>

        {bottle.photoDataUrl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img
                  src={bottle.photoDataUrl}
                  alt={bottle.name || 'Zdjęcie opakowania'}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex-1 space-y-2.5 w-full">
                <p className="text-xs text-slate-600">
                  Kliknij przycisk poniżej, aby automatycznie odczytać kod kreskowy ze zdjęcia
                  i odtworzyć go na nowo w oknie obok.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => handleScanClick(false)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {scanning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ScanBarcode className="h-3.5 w-3.5" />
                    )}
                    {scanning ? 'Odczytywanie...' : 'Odczytaj kod ze zdjęcia'}
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => handleScanClick(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Odczyt precyzyjny AI (zakrzywione)
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Zmień zdjęcie
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handlePhotoFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/60'
            }`}
          >
            <ImagePlus className="h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Dodaj zdjęcie butelki lub puszki
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Przeciągnij plik tutaj lub kliknij, aby wybrać z dysku (JPG, PNG, WebP)
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhotoFile(f);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* Type and Name */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Typ opakowania</label>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'bottle', label: 'Butelka' },
                { id: 'can', label: 'Puszka' },
              ] as Array<{ id: ContainerType; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateField('containerType', opt.id)}
                className={`cursor-pointer rounded-md py-1.5 text-xs font-medium transition-colors ${
                  bottle.containerType === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="bottle-name" className="text-xs font-semibold text-slate-700">
            Nazwa / opis produktu (opcjonalnie)
          </label>
          <input
            id="bottle-name"
            type="text"
            value={bottle.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="np. Napój gazowany 0.5L lub Butelka PET 1.5L"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Add / remove dimensions (Diameter & Length) */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-800">
              Wymiary opakowania (drukowane nad kodem w tabeli)
            </h3>
            <p className="text-xs text-slate-500">
              Dodawaj lub usuwaj pola średnicy i długości w milimetrach
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bottle.diameterMm === null && (
              <button
                type="button"
                onClick={() => updateField('diameterMm', 66)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3 w-3" />
                Dodaj średnicę
              </button>
            )}
            {bottle.lengthMm === null && (
              <button
                type="button"
                onClick={() => updateField('lengthMm', 200)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3 w-3" />
                Dodaj długość
              </button>
            )}
          </div>
        </div>

        {bottle.diameterMm === null && bottle.lengthMm === null ? (
          <p className="text-xs text-slate-500 py-2">
            Brak przypisanych wymiarów. Kliknij „Dodaj średnicę” lub „Dodaj długość”, aby wprowadzić wymiary.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bottle.diameterMm !== null && (
              <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="dim-diameter"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Średnica (mm)
                  </label>
                  <input
                    id="dim-diameter"
                    type="number"
                    min={1}
                    max={500}
                    step="0.5"
                    value={bottle.diameterMm}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateField('diameterMm', Number.isFinite(val) ? val : 0);
                    }}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateField('diameterMm', null)}
                  title="Usuń wymiar średnicy"
                  aria-label="Usuń wymiar średnicy"
                  className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Usuń
                </button>
              </div>
            )}

            {bottle.lengthMm !== null && (
              <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="dim-length"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Długość / wysokość (mm)
                  </label>
                  <input
                    id="dim-length"
                    type="number"
                    min={1}
                    max={1000}
                    step="0.5"
                    value={bottle.lengthMm}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateField('lengthMm', Number.isFinite(val) ? val : 0);
                    }}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateField('lengthMm', null)}
                  title="Usuń wymiar długości"
                  aria-label="Usuń wymiar długości"
                  className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Usuń
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EAN-13 Input + check digit validation */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="ean13-input" className="text-xs font-semibold text-slate-700">
            Kod kreskowy EAN-13 (13 cyfr)
          </label>
          {bottle.ean13.length >= 12 && !eanValidation.valid && (
            <button
              type="button"
              onClick={() => updateField('ean13', autoFixEan13(bottle.ean13))}
              className="cursor-pointer text-xs font-medium text-blue-700 hover:underline"
            >
              Oblicz i popraw 13. cyfrę kontrolną
            </button>
          )}
        </div>

        <input
          id="ean13-input"
          type="text"
          inputMode="numeric"
          maxLength={13}
          value={bottle.ean13}
          onChange={(e) =>
            updateField('ean13', e.target.value.replace(/\D/g, '').slice(0, 13))
          }
          placeholder="np. 5901234123457"
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-base tracking-widest tabular-nums text-slate-900 placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
        />

        <div className="flex items-center gap-1.5 text-xs">
          {eanValidation.valid ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="text-emerald-700 font-medium">
                Poprawny kod EAN-13 — gotowy do wygenerowania i eksportu
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="text-amber-700">{eanValidation.error}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
