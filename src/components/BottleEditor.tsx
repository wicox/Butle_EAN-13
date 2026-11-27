import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  ScanBarcode,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  clampExportQuantity,
  type BottleRecord,
  type ContainerType,
} from '../types/bottle';
import { scanBarcodeFromPhoto } from '../utils/barcodeScanner';
import { autoFixEan13, validateEan13 } from '../utils/ean13';

interface BottleEditorProps {
  bottle: BottleRecord | null;
  isEditing: boolean;
  onSetEditing: (editing: boolean) => void;
  onChange: (updated: BottleRecord) => void;
  onAddNew: () => void;
  onNotify: (msg: { type: 'success' | 'error' | 'info'; text: string }) => void;
}

export const BottleEditor: React.FC<BottleEditorProps> = ({
  bottle,
  isEditing,
  onSetEditing,
  onChange,
  onAddNew,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);
  const [photoZoomScale, setPhotoZoomScale] = useState(1.5);

  useEffect(() => {
    if (!photoZoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoZoomOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoZoomOpen]);

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
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Dane butelki / puszki
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              <span aria-hidden="true">·</span>
              {isEditing ? (
                <span className="text-blue-700">Tryb edycji</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Lock className="h-3 w-3" />
                  Podgląd (pola zablokowane)
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditing
              ? 'Edytuj zdjęcie, wymiary opakowania oraz kod kreskowy EAN-13'
              : 'Aby zmienić dane, kliknij ikonę ołówka (Edytuj) na liście obok kosza'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={() => onSetEditing(false)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              Zakończ edycję
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSetEditing(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edytuj dane
            </button>
          )}
        </div>
      </div>

      {/* Export selection & quantity */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
        <div className="inline-flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Ilość szt. do eksportu:
          </span>
          {isEditing ? (
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() =>
                  updateField(
                    'exportQuantity',
                    clampExportQuantity((bottle.exportQuantity ?? 1) - 1)
                  )
                }
                disabled={(bottle.exportQuantity ?? 1) <= 1}
                aria-label="Zmniejsz ilość sztuk"
                className="cursor-pointer px-1.5 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                min={1}
                max={999}
                value={bottle.exportQuantity ?? 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  updateField('exportQuantity', clampExportQuantity(val));
                }}
                aria-label="Ilość sztuk kodu do eksportu"
                className="w-11 border-x border-slate-200 py-0.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  updateField(
                    'exportQuantity',
                    clampExportQuantity((bottle.exportQuantity ?? 1) + 1)
                  )
                }
                disabled={(bottle.exportQuantity ?? 1) >= 999}
                aria-label="Zwiększ ilość sztuk"
                className="cursor-pointer px-1.5 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-slate-700">
              {bottle.exportQuantity ?? 1} szt.
            </span>
          )}
        </div>

        <label
          className={`inline-flex items-center gap-2 text-xs font-medium ${
            isEditing ? 'cursor-pointer text-slate-700' : 'cursor-not-allowed text-slate-500'
          }`}
        >
          <input
            type="checkbox"
            disabled={!isEditing}
            checked={bottle.selected}
            onChange={(e) => updateField('selected', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
          {isEditing && bottle.photoDataUrl && (
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
              <button
                type="button"
                onClick={() => {
                  setPhotoZoomScale(1.5);
                  setPhotoZoomOpen(true);
                }}
                title="Kliknij, aby powiększyć zdjęcie"
                className="group relative h-44 w-44 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <img
                  src={bottle.photoDataUrl}
                  alt={bottle.name || 'Zdjęcie opakowania'}
                  className="h-full w-full object-contain transition-transform duration-150 group-hover:scale-105"
                />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white opacity-90 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-3 w-3" />
                  Powiększ
                </span>
              </button>
              <div className="flex-1 space-y-2.5 w-full">
                <p className="text-xs text-slate-600">
                  {isEditing
                    ? 'Kliknij zdjęcie lub „Powiększ zdjęcie”, aby przybliżyć etykietę, albo odczytaj automatycznie kod kreskowy do okna obok.'
                    : 'Kliknij zdjęcie lub „Powiększ zdjęcie”, aby obejrzeć etykietę w dużym powiększeniu.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isEditing && (
                    <>
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
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoZoomScale(1.5);
                      setPhotoZoomOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                    Powiększ zdjęcie
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Zmień zdjęcie
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : isEditing ? (
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
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-7 text-center">
            <ImagePlus className="h-6 w-6 text-slate-300" />
            <p className="mt-1.5 text-xs text-slate-500">
              Brak dodanego zdjęcia dla tego opakowania.
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
                disabled={!isEditing}
                onClick={() => updateField('containerType', opt.id)}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  bottle.containerType === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500'
                } ${isEditing ? 'cursor-pointer hover:text-slate-900' : 'cursor-not-allowed opacity-80'}`}
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
            disabled={!isEditing}
            value={bottle.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={isEditing ? 'np. Napój gazowany 0.5L lub Butelka PET 1.5L' : 'Brak nazwy'}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
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
              {isEditing
                ? 'Dodawaj lub usuwaj pola średnicy i długości w milimetrach'
                : 'Zapisane wymiary opakowania'}
            </p>
          </div>
          {isEditing && (
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
          )}
        </div>

        {bottle.diameterMm === null && bottle.lengthMm === null ? (
          <p className="text-xs text-slate-500 py-2">
            {isEditing
              ? 'Brak przypisanych wymiarów. Kliknij „Dodaj średnicę” lub „Dodaj długość”, aby wprowadzić wymiary.'
              : 'Brak przypisanych wymiarów.'}
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
                    disabled={!isEditing}
                    min={1}
                    max={500}
                    step="0.5"
                    value={bottle.diameterMm}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateField('diameterMm', Number.isFinite(val) ? val : 0);
                    }}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
                  />
                </div>
                {isEditing && (
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
                )}
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
                    disabled={!isEditing}
                    min={1}
                    max={1000}
                    step="0.5"
                    value={bottle.lengthMm}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateField('lengthMm', Number.isFinite(val) ? val : 0);
                    }}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
                  />
                </div>
                {isEditing && (
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
                )}
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
          {isEditing && bottle.ean13.length >= 12 && !eanValidation.valid && (
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
          disabled={!isEditing}
          inputMode="numeric"
          maxLength={13}
          value={bottle.ean13}
          onChange={(e) =>
            updateField('ean13', e.target.value.replace(/\D/g, '').slice(0, 13))
          }
          placeholder={isEditing ? 'np. 5901234123457' : 'Brak kodu EAN-13'}
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-base tracking-widest tabular-nums text-slate-900 placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
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

      {/* Zoomed Photo Lightbox Modal */}
      {photoZoomOpen && bottle.photoDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4"
          onClick={() => setPhotoZoomOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Powiększony podgląd zdjęcia opakowania
                </h3>
                <p className="text-xs text-slate-500">
                  {bottle.name.trim() || 'Bez nazwy'} · Użyj przybliżenia, aby dokładnie odczytać kod z etykiety
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoZoomScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))
                    }
                    title="Pomniejsz"
                    aria-label="Pomniejsz zdjęcie"
                    className="cursor-pointer rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="w-14 text-center font-mono text-xs font-semibold tabular-nums text-slate-800">
                    {Math.round(photoZoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoZoomScale((s) => Math.min(4, Math.round((s + 0.25) * 100) / 100))
                    }
                    title="Powiększ"
                    aria-label="Powiększ zdjęcie"
                    className="cursor-pointer rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                {[1, 1.5, 2, 3].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPhotoZoomScale(preset)}
                    className={`hidden sm:inline-flex cursor-pointer rounded-md border px-2 py-1 font-mono text-xs tabular-nums ${
                      Math.abs(photoZoomScale - preset) < 0.05
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset * 100}%
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPhotoZoomOpen(false)}
                  aria-label="Zamknij powiększenie"
                  className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <div className="flex min-h-[380px] min-w-full items-center justify-center">
                <img
                  src={bottle.photoDataUrl}
                  alt={bottle.name || 'Powiększone zdjęcie opakowania'}
                  style={
                    photoZoomScale > 1
                      ? {
                          width: `${Math.round(photoZoomScale * 520)}px`,
                          maxWidth: 'none',
                          height: 'auto',
                        }
                      : {
                          width: `${Math.round(photoZoomScale * 100)}%`,
                          maxHeight: '65vh',
                          objectFit: 'contain',
                        }
                  }
                  className="rounded-lg bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
              <span className="text-xs text-slate-500">
                Przewijaj obszar powyżej przy dużym powiększeniu, aby przesuwać zdjęcie.
              </span>
              <div className="flex items-center gap-2">
                {isEditing && (
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
                    Odczytaj kod ze zdjęcia
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoZoomOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
