import { jsPDF } from 'jspdf';
import {
  clampBarcodeWidthCm,
  clampExportQuantity,
  formatDimensionsLabel,
  type BottleRecord,
} from '../types/bottle';
import {
  EAN13_BAR_MODULES,
  encodeEan13Modules,
  validateEan13,
} from './ean13';

/**
 * Renders Polish header text onto a high-DPI offscreen canvas strip so all Polish
 * diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż) appear crisply in the PDF without external font fetches.
 */
function renderHeaderStripDataUrl(
  dimensionsText: string,
  subtitleText: string,
  cellWidthMm: number
): { dataUrl: string; heightMm: number } {
  const pxPerMm = 12; // ~305 DPI
  const widthPx = Math.round(cellWidthMm * pxPerMm);
  const heightMm = 9.5;
  const heightPx = Math.round(heightMm * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 ${Math.round(3.1 * pxPerMm)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(dimensionsText, widthPx / 2, Math.round(3.2 * pxPerMm), widthPx - 24);

  ctx.fillStyle = '#475569';
  ctx.font = `500 ${Math.round(2.3 * pxPerMm)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(subtitleText, widthPx / 2, Math.round(7.1 * pxPerMm), widthPx - 24);

  return { dataUrl: canvas.toDataURL('image/png'), heightMm };
}

export async function exportSelectedToPdf(
  bottles: BottleRecord[],
  barWidthCmInput: number
): Promise<void> {
  const validBottles = bottles.filter((b) => b.selected && validateEan13(b.ean13).valid);
  if (validBottles.length === 0) {
    throw new Error('Zaznacz przynajmniej jedną butelkę lub puszkę z poprawnym 13-cyfrowym kodem EAN-13.');
  }

  const barWidthCm = clampBarcodeWidthCm(barWidthCmInput);
  const barWidthMm = barWidthCm * 10; // Exact 27.0 – 30.0 mm from first bar to last bar

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginX = 13.5;
  const marginTop = 18;
  const cols = 3;
  const cellW = (pageWidthMm - marginX * 2) / cols; // ~61 mm wide per cut-out cell
  const cellH = 42; // ~42 mm tall per cut-out cell
  const rowsPerPage = Math.floor((pageHeightMm - marginTop - 12) / cellH);

  // Precompute header strips and encoded modules once per unique bottle
  const preparedUnique = validBottles.map((bottle) => {
    const dimsText = formatDimensionsLabel(bottle.diameterMm, bottle.lengthMm, false);
    const typeLabel = bottle.containerType === 'can' ? 'Puszka' : 'Butelka';
    const subLine = bottle.name.trim() ? `${bottle.name.trim()} (${typeLabel})` : typeLabel;
    const header = renderHeaderStripDataUrl(dimsText, subLine, cellW - 4);
    const encoded = encodeEan13Modules(bottle.ean13);
    return { bottle, header, encoded };
  });

  const expandedItems: typeof preparedUnique = [];
  for (const entry of preparedUnique) {
    const qty = clampExportQuantity(entry.bottle.exportQuantity ?? 1);
    for (let c = 0; c < qty; c++) {
      expandedItems.push(entry);
    }
  }

  // Page header rendered via canvas for flawless Polish characters
  const drawPageTitle = () => {
    const titleCanvas = document.createElement('canvas');
    titleCanvas.width = 2100;
    titleCanvas.height = 90;
    const ctx = titleCanvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, titleCanvas.width, titleCanvas.height);
    ctx.fillStyle = '#475569';
    ctx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Kody EAN-13 do wycinania  ·  Szerokość: ${barWidthCm.toFixed(2)} cm  ·  Pozycji: ${validBottles.length}  ·  Łącznie: ${expandedItems.length} szt.`,
      0,
      45
    );
    doc.addImage(titleCanvas.toDataURL('image/png'), 'PNG', marginX, 8, 183, 7.8);
  };

  drawPageTitle();

  const perPage = cols * rowsPerPage;

  expandedItems.forEach(({ header, encoded }, index) => {
    if (index > 0 && index % perPage === 0) {
      doc.addPage();
      drawPageTitle();
    }

    const posOnPage = index % perPage;
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);

    const cellX = marginX + col * cellW;
    const cellY = marginTop + row * cellH;

    // Dashed cutting border around the cell
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.rect(cellX, cellY, cellW, cellH);
    doc.setLineDashPattern([], 0);

    doc.addImage(header.dataUrl, 'PNG', cellX + 2, cellY + 2.2, cellW - 4, header.heightMm);

    // Draw vector EAN-13 bars directly in PDF millimeters
    const moduleMm = barWidthMm / EAN13_BAR_MODULES;
    const barStartX = cellX + (cellW - barWidthMm) / 2 + 1.2; // Slight offset right to leave room for leading digit
    const barTopY = cellY + 13.5;
    const regularBarH = barWidthMm * 0.56;
    const guardExtraH = moduleMm * 5;

    doc.setFillColor(0, 0, 0);
    for (let m = 0; m < encoded.modules.length; m++) {
      if (encoded.modules[m] === 1) {
        const h = encoded.isGuard[m] ? regularBarH + guardExtraH : regularBarH;
        doc.rect(barStartX + m * moduleMm, barTopY, moduleMm + 0.015, h, 'F');
      }
    }

    // Human-readable digits below bars
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(0, 0, 0);
    const digitY = barTopY + regularBarH + 3.4;

    // Leading digit outside left guard
    doc.text(encoded.code[0], barStartX - moduleMm * 5.5, digitY, { align: 'center' });

    // Left 6 digits
    const leftGroupStart = barStartX + 3 * moduleMm;
    const digitSpan = 7 * moduleMm;
    for (let i = 0; i < 6; i++) {
      doc.text(encoded.code[1 + i], leftGroupStart + i * digitSpan + digitSpan / 2, digitY, {
        align: 'center',
      });
    }

    // Right 6 digits
    const rightGroupStart = barStartX + 50 * moduleMm;
    for (let i = 0; i < 6; i++) {
      doc.text(encoded.code[7 + i], rightGroupStart + i * digitSpan + digitSpan / 2, digitY, {
        align: 'center',
      });
    }
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`kody-ean13-butelki-${dateStr}.pdf`);
}
