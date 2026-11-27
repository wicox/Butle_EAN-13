import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  clampBarcodeWidthCm,
  clampExportQuantity,
  formatDimensionsLabel,
  type BottleRecord,
} from '../types/bottle';
import { renderEan13ToPng, validateEan13 } from './ean13';

// Word uses 96 DPI pixels -> 1 cm = 96 / 2.54 px (which docx converts cleanly via 9525 EMUs/px)
const PX_PER_CM_96DPI = 96 / 2.54;
// 1 cm = 566.929 twips (DXA)
const TWIPS_PER_CM = 567;

export async function exportSelectedToWord(
  bottles: BottleRecord[],
  barWidthCmInput: number
): Promise<void> {
  const validBottles = bottles.filter((b) => b.selected && validateEan13(b.ean13).valid);
  if (validBottles.length === 0) {
    throw new Error('Zaznacz przynajmniej jedną butelkę lub puszkę z poprawnym 13-cyfrowym kodem EAN-13.');
  }

  const barWidthCm = clampBarcodeWidthCm(barWidthCmInput);
  const columns = 3; // 3 columns on A4 (~18.6 cm usable -> ~6.2 cm per cut-out cell)
  const colWidthTwips = Math.round(6.1 * TWIPS_PER_CM);

  // Pre-render unique barcode PNGs once, then expand according to exportQuantity
  const uniqueRendered = await Promise.all(
    validBottles.map(async (bottle) => {
      const img = await renderEan13ToPng(bottle.ean13, barWidthCm, { modulePx: 8 });
      const buffer = await img.blob.arrayBuffer();
      return {
        bottle,
        img,
        buffer: new Uint8Array(buffer),
      };
    })
  );

  const renderedItems: typeof uniqueRendered = [];
  for (const entry of uniqueRendered) {
    const qty = clampExportQuantity(entry.bottle.exportQuantity ?? 1);
    for (let c = 0; c < qty; c++) {
      renderedItems.push(entry);
    }
  }

  const cellBorder = {
    style: BorderStyle.DASHED,
    size: 8, // 1pt dashed cutting guide
    color: '475569',
  };

  const rows: TableRow[] = [];

  for (let i = 0; i < renderedItems.length; i += columns) {
    const slice = renderedItems.slice(i, i + columns);
    const cells: TableCell[] = [];

    for (let col = 0; col < columns; col++) {
      const item = slice[col];
      if (!item) {
        cells.push(
          new TableCell({
            width: { size: colWidthTwips, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            children: [new Paragraph('')],
          })
        );
        continue;
      }

      const { bottle, img, buffer } = item;
      const dimsText = formatDimensionsLabel(bottle.diameterMm, bottle.lengthMm, false);
      const typeLabel = bottle.containerType === 'can' ? 'Puszka' : 'Butelka';
      const titleLine = bottle.name.trim()
        ? `${dimsText}`
        : `${dimsText}`;
      const subLine = bottle.name.trim()
        ? `${bottle.name.trim()} (${typeLabel})`
        : typeLabel;

      const imageWidthPx = img.totalWidthCm * PX_PER_CM_96DPI;
      const imageHeightPx = img.totalHeightCm * PX_PER_CM_96DPI;

      cells.push(
        new TableCell({
          width: { size: colWidthTwips, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: {
            top: 140,
            bottom: 140,
            left: 120,
            right: 120,
          },
          borders: {
            top: cellBorder,
            bottom: cellBorder,
            left: cellBorder,
            right: cellBorder,
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 40 },
              children: [
                new TextRun({
                  text: titleLine,
                  bold: true,
                  size: 18, // 9pt
                  font: 'Calibri',
                  color: '0F172A',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 80 },
              children: [
                new TextRun({
                  text: subLine,
                  size: 15, // 7.5pt
                  font: 'Calibri',
                  color: '475569',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [
                new ImageRun({
                  type: 'png',
                  data: buffer,
                  transformation: {
                    width: imageWidthPx,
                    height: imageHeightPx,
                  },
                }),
              ],
            }),
          ],
        })
      );
    }

    rows.push(
      new TableRow({
        cantSplit: true,
        height: { value: Math.round(4.1 * TWIPS_PER_CM), rule: HeightRule.ATLEAST },
        children: cells,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.round(21.0 * TWIPS_PER_CM),
              height: Math.round(29.7 * TWIPS_PER_CM),
            },
            margin: {
              top: Math.round(1.2 * TWIPS_PER_CM),
              bottom: Math.round(1.2 * TWIPS_PER_CM),
              left: Math.round(1.3 * TWIPS_PER_CM),
              right: Math.round(1.3 * TWIPS_PER_CM),
            },
          },
        },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 140 },
            children: [
              new TextRun({
                text: `Kody kreskowe EAN-13 do wycinania  ·  Szerokość kodu (od pierwszej do ostatniej kreski): ${barWidthCm.toFixed(2)} cm  ·  Pozycji: ${validBottles.length}  ·  Łącznie kodów: ${renderedItems.length} szt.`,
                size: 17,
                color: '475569',
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            layout: TableLayoutType.FIXED,
            width: {
              size: colWidthTwips * columns,
              type: WidthType.DXA,
            },
            columnWidths: [colWidthTwips, colWidthTwips, colWidthTwips],
            rows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `kody-ean13-butelki-${dateStr}.docx`);
}
