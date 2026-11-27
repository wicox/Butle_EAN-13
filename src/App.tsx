import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import {
  clampBarcodeWidthCm,
  clampExportQuantity,
  DEFAULT_BARCODE_WIDTH_CM,
  DEFAULT_PX_PER_CM,
  type BottleRecord,
} from './types/bottle';
import {
  deleteBottleById,
  loadAllBottles,
  loadAppSettings,
  saveAllBottles,
  saveAppSettings,
  saveBottle,
} from './utils/db';
import { exportSelectedToPdf } from './utils/exportPdf';
import { exportSelectedToWord } from './utils/exportWord';
import { exportDatabaseToZip, importDatabaseFromZip } from './utils/exportZip';
import { BarcodeWindow } from './components/BarcodeWindow';
import { BottleEditor } from './components/BottleEditor';
import { BottleList } from './components/BottleList';
import { GuideSection } from './components/GuideSection';
import { TopBar } from './components/TopBar';

interface NotificationState {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function App() {
  const [bottles, setBottles] = useState<BottleRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [barcodeWidthCm, setBarcodeWidthCm] = useState<number>(DEFAULT_BARCODE_WIDTH_CM);
  const [pxPerCmCalibration, setPxPerCmCalibration] = useState<number>(DEFAULT_PX_PER_CM);
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<'workspace' | 'guide'>('workspace');
  const [notification, setNotification] = useState<NotificationState | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [loadedBottles, settings] = await Promise.all([
          loadAllBottles(),
          loadAppSettings(),
        ]);
        if (!mounted) return;
        setBottles(loadedBottles);
        setActiveId(loadedBottles[0]?.id ?? null);
        setBarcodeWidthCm(settings.barcodeWidthCm);
        setPxPerCmCalibration(settings.pxPerCmCalibration);
      } catch (err) {
        if (!mounted) return;
        setNotification({
          type: 'error',
          text:
            err instanceof Error
              ? `Błąd odczytu lokalnej bazy: ${err.message}`
              : 'Nie udało się wczytać bazy danych.',
        });
      } finally {
        if (mounted) setLoadingDb(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleAddNew = async () => {
    const now = new Date().toISOString();
    const newItem: BottleRecord = {
      id: crypto.randomUUID(),
      name: '',
      containerType: 'bottle',
      diameterMm: 66,
      lengthMm: 220,
      ean13: '',
      photoDataUrl: null,
      photoFilename: null,
      selected: true,
      exportQuantity: 1,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    setBottles((prev) => [newItem, ...prev]);
    setActiveId(newItem.id);
    setActiveSection('workspace');
    await saveBottle(newItem);
  };

  const handleUpdateBottle = async (updated: BottleRecord) => {
    setBottles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    await saveBottle(updated);
  };

  const handleDeleteBottle = async (id: string) => {
    setBottles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
    await deleteBottleById(id);
    setNotification({ type: 'info', text: 'Usunięto opakowanie z bazy danych.' });
  };

  const handleToggleSelected = async (id: string) => {
    const target = bottles.find((b) => b.id === id);
    if (!target) return;
    const updated = {
      ...target,
      selected: !target.selected,
      updatedAt: new Date().toISOString(),
    };
    await handleUpdateBottle(updated);
  };

  const handleToggleAllSelected = async (selected: boolean) => {
    const updatedList = bottles.map((b) => ({
      ...b,
      selected,
      updatedAt: new Date().toISOString(),
    }));
    setBottles(updatedList);
    await saveAllBottles(updatedList);
  };

  const handleChangeBarcodeWidthCm = async (cm: number) => {
    const clamped = clampBarcodeWidthCm(cm);
    setBarcodeWidthCm(clamped);
    await saveAppSettings({ barcodeWidthCm: clamped });
  };

  const handleChangePxPerCm = async (px: number) => {
    setPxPerCmCalibration(px);
    await saveAppSettings({ pxPerCmCalibration: px });
  };

  const handleExportWord = async () => {
    try {
      await exportSelectedToWord(bottles, barcodeWidthCm);
      const totalCopies = bottles
        .filter((b) => b.selected && b.ean13.length === 13)
        .reduce((sum, b) => sum + clampExportQuantity(b.exportQuantity ?? 1), 0);
      setNotification({
        type: 'success',
        text: `Wygenerowano plik Word (.docx) — ${totalCopies} szt. kodów o szerokości ${barcodeWidthCm.toFixed(2)} cm.`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Błąd podczas generowania pliku Word.',
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportSelectedToPdf(bottles, barcodeWidthCm);
      const totalCopies = bottles
        .filter((b) => b.selected && b.ean13.length === 13)
        .reduce((sum, b) => sum + clampExportQuantity(b.exportQuantity ?? 1), 0);
      setNotification({
        type: 'success',
        text: `Wygenerowano plik PDF — ${totalCopies} szt. kodów o szerokości ${barcodeWidthCm.toFixed(2)} cm.`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Błąd podczas generowania pliku PDF.',
      });
    }
  };

  const handleExportZip = async () => {
    try {
      await exportDatabaseToZip(bottles, {
        barcodeWidthCm,
        pxPerCmCalibration,
      });
      setNotification({
        type: 'success',
        text: `Zapisano kopię zapasową ZIP (${bottles.length} pozycji wraz ze zdjęciami).`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Błąd podczas tworzenia archiwum ZIP.',
      });
    }
  };

  const handleImportZip = async (file: File) => {
    try {
      const imported = await importDatabaseFromZip(file);
      setBottles(imported.bottles);
      setActiveId(imported.bottles[0]?.id ?? null);
      setBarcodeWidthCm(imported.barcodeWidthCm);
      await saveAllBottles(imported.bottles);
      await saveAppSettings({ barcodeWidthCm: imported.barcodeWidthCm });
      setNotification({
        type: 'success',
        text: `Przywrócono bazę z pliku ZIP (${imported.bottles.length} pozycji).`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Nie udało się zaimportować pliku ZIP.',
      });
    }
  };

  const activeBottle = bottles.find((b) => b.id === activeId) ?? null;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onAddNew={handleAddNew}
      />

      {notification && (
        <div className="mx-auto mt-4 w-full max-w-[1440px] px-6">
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${
              notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : notification.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              {notification.type === 'error' && (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              )}
              {notification.type === 'info' && (
                <Info className="h-4 w-4 shrink-0 text-blue-600" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="cursor-pointer rounded p-1 hover:bg-black/5"
              aria-label="Zamknij komunikat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
        {activeSection === 'guide' ? (
          <GuideSection />
        ) : loadingDb ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 h-[560px] animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="lg:col-span-5 h-[560px] animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="lg:col-span-4 h-[560px] animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-3">
              <BottleList
                bottles={bottles}
                activeId={activeId}
                onSelectActive={setActiveId}
                onToggleSelected={handleToggleSelected}
                onToggleAllSelected={handleToggleAllSelected}
                onDelete={handleDeleteBottle}
                onExportZip={handleExportZip}
                onImportZip={handleImportZip}
                onAddNew={handleAddNew}
              />
            </div>

            <div className="lg:col-span-5">
              <BottleEditor
                bottle={activeBottle}
                onChange={handleUpdateBottle}
                onAddNew={handleAddNew}
                onNotify={setNotification}
              />
            </div>

            <div className="lg:col-span-4">
              <BarcodeWindow
                activeBottle={activeBottle}
                allBottles={bottles}
                barcodeWidthCm={barcodeWidthCm}
                pxPerCmCalibration={pxPerCmCalibration}
                onChangeBarcodeWidthCm={handleChangeBarcodeWidthCm}
                onChangePxPerCm={handleChangePxPerCm}
                onExportWord={handleExportWord}
                onExportPdf={handleExportPdf}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
