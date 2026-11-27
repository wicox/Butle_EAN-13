import React, { useRef, useState } from 'react';
import {
  CheckSquare,
  Download,
  FolderArchive,
  Package,
  Search,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatDimensionsLabel, type BottleRecord } from '../types/bottle';
import { validateEan13 } from '../utils/ean13';

type FilterTab = 'all' | 'bottle' | 'can' | 'selected';

interface BottleListProps {
  bottles: BottleRecord[];
  activeId: string | null;
  onSelectActive: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onToggleAllSelected: (selected: boolean) => void;
  onDelete: (id: string) => void;
  onExportZip: () => Promise<void>;
  onImportZip: (file: File) => Promise<void>;
  onAddNew: () => void;
}

export const BottleList: React.FC<BottleListProps> = ({
  bottles,
  activeId,
  onSelectActive,
  onToggleSelected,
  onToggleAllSelected,
  onDelete,
  onExportZip,
  onImportZip,
  onAddNew,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [zipBusy, setZipBusy] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const filtered = bottles.filter((b) => {
    if (filter === 'bottle' && b.containerType !== 'bottle') return false;
    if (filter === 'can' && b.containerType !== 'can') return false;
    if (filter === 'selected' && !b.selected) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.ean13.includes(q) ||
      (b.diameterMm !== null && String(b.diameterMm).includes(q)) ||
      (b.lengthMm !== null && String(b.lengthMm).includes(q))
    );
  });

  const selectedCount = bottles.filter((b) => b.selected).length;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => b.selected);

  const handleZipFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipBusy(true);
    try {
      await onImportZip(file);
    } finally {
      setZipBusy(false);
      e.target.value = '';
    }
  };

  const handleExportZipClick = async () => {
    setZipBusy(true);
    try {
      await onExportZip();
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <aside className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Baza opakowań ({bottles.length})
          </h2>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Do eksportu: {selectedCount}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj nazwy, EAN-13, wymiaru..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'all', label: 'Wszystkie' },
              { id: 'bottle', label: 'Butelki' },
              { id: 'can', label: 'Puszki' },
              { id: 'selected', label: 'Wybrane' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {bottles.length > 0 && (
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <button
              type="button"
              onClick={() => onToggleAllSelected(!allFilteredSelected)}
              className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-blue-700" />
              ) : (
                <Square className="h-3.5 w-3.5 text-slate-400" />
              )}
              {allFilteredSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
            <span className="text-slate-400 tabular-nums">
              Widocznych: {filtered.length}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[520px]">
        {bottles.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
              <Package className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-900">Baza jest pusta</p>
            <p className="mt-1 text-xs text-slate-500 max-w-[230px]">
              Dodaj pierwszą butelkę lub puszkę albo wczytaj wcześniej zapisaną kopię ZIP.
            </p>
            <button
              type="button"
              onClick={onAddNew}
              className="mt-4 cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Dodaj pierwszy rekord
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            Brak pozycji spełniających kryteria wyszukiwania.
          </div>
        ) : (
          filtered.map((item) => {
            const isActive = item.id === activeId;
            const eanStatus = validateEan13(item.ean13);
            const dims = formatDimensionsLabel(item.diameterMm, item.lengthMm, false);
            const typeLabel = item.containerType === 'can' ? 'Puszka' : 'Butelka';

            return (
              <div
                key={item.id}
                onClick={() => onSelectActive(item.id)}
                className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                  isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelected(item.id);
                  }}
                  aria-label={
                    item.selected
                      ? 'Usuń z eksportu Word/PDF'
                      : 'Zaznacz do eksportu Word/PDF'
                  }
                  className="shrink-0 cursor-pointer text-slate-400 hover:text-blue-700"
                >
                  {item.selected ? (
                    <CheckSquare className="h-4 w-4 text-blue-700" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>

                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                  {item.photoDataUrl ? (
                    <img
                      src={item.photoDataUrl}
                      alt={item.name || typeLabel}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {item.name.trim() || `${typeLabel} bez nazwy`}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums truncate">
                    <span>{typeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dims}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs font-mono tabular-nums">
                    <span
                      className={
                        eanStatus.valid ? 'text-slate-700' : 'text-amber-700'
                      }
                    >
                      {item.ean13 || 'Brak kodu EAN-13'}
                    </span>
                    {item.ean13 && !eanStatus.valid && (
                      <span className="font-sans text-[11px] text-amber-700">
                        (niepełny)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  title="Usuń opakowanie z bazy"
                  aria-label="Usuń opakowanie z bazy"
                  className="shrink-0 cursor-pointer rounded-md p-1.5 text-slate-400 opacity-70 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <FolderArchive className="h-3.5 w-3.5 text-slate-500" />
          <span>Archiwum bazy (zdjęcia + JSON)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={zipBusy || bottles.length === 0}
            onClick={handleExportZipClick}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Zapisz ZIP
          </button>
          <button
            type="button"
            disabled={zipBusy}
            onClick={() => zipInputRef.current?.click()}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            Przywróć ZIP
          </button>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleZipFileChange}
            className="hidden"
          />
        </div>
      </div>
    </aside>
  );
};
